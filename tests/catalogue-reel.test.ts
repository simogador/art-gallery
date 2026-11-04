import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import type { ReactElement } from 'react'
import type { Artwork } from '@/lib/types'
import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { amorcageInterdit, AmorcageProductionInterdit } from '@/lib/garde-production'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 2.9 (FR-16) : catalogue réel uniquement. Une œuvre n'est visible que si elle est publiée et
// que son artiste a un accord signé et est actif ; un artiste n'apparaît qu'avec un accord et une
// œuvre visible ; une exposition, qu'avec une œuvre visible. Plus aucune lecture de src/data.

vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'acheteur', email: 'a@exemple.test' } })) }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => ({ type: 'visiteur' }) }))
const stripe = vi.hoisted(() => ({ creerSession: vi.fn() }))
vi.mock('@/lib/stripe', () => ({ getStripe: () => ({ checkout: { sessions: { create: stripe.creerSession } } }) }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirection:${url}`)
  },
  permanentRedirect: (url: string) => {
    throw new Error(`redirection-permanente:${url}`)
  },
  notFound: () => {
    throw new Error('introuvable')
  },
}))

const fichiers = (dossier: string): string[] =>
  readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom)
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(ts|tsx)$/.test(nom) ? [chemin] : []
  })

describe('plus aucune donnée de démonstration dans le code', () => {
  it('src/data n’existe plus et aucun fichier de src/ ne l’importe', () => {
    expect(existsSync('src/data')).toBe(false)
    const trouves = fichiers('src')
      .filter((f) => !f.split(path.sep).join('/').startsWith('src/generated/'))
      .filter((f) => /@\/data\b|['"](\.\.\/)+data\//.test(readFileSync(f, 'utf8')))
    expect(trouves).toEqual([])
  })

  it('aucune valeur inventée sur l’accueil ni sur la page de connexion', () => {
    const textes = ['src/components/sections/Hero.tsx', 'src/app/auth/connexion/LoginForm.tsx']
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n')
    for (const invente of ['340+', 'Lumière Dorée', 'Sophie Marceau', '12 400', "value: '5'", "value: '60'"]) {
      expect(textes).not.toContain(invente)
    }
  })

  it('le seed ne crée plus aucun catalogue de démonstration', () => {
    const seed = readFileSync('prisma/seed.ts', 'utf8')
    expect(seed).not.toMatch(/\.(artist|artwork|exhibition|artworkExhibition)\.(upsert|create|createMany)\b/)
    expect(seed).not.toMatch(/rothko|kusama|basquiat/i)
  })
})

describe('œuvre mise en avant de l’accueil', () => {
  it('coup de cœur disponible, sinon première disponible, sinon première visible, sinon aucune', async () => {
    // Partie pure (mappers) : aucune connexion à la base n'est ouverte ici.
    const { oeuvreMiseEnAvant } = await import('@/lib/catalogue/mappers')
    const w = (id: string, featured: boolean, sold: boolean) => ({ id, featured, sold }) as unknown as Artwork
    const coeurVendu = w('coeur-vendu', true, true)
    const dispo = w('dispo', false, false)
    const coeurDispo = w('coeur-dispo', true, false)
    expect(oeuvreMiseEnAvant([coeurVendu, dispo, coeurDispo])?.id).toBe('coeur-dispo')
    expect(oeuvreMiseEnAvant([coeurVendu, dispo])?.id).toBe('dispo')
    expect(oeuvreMiseEnAvant([coeurVendu, w('vendue', false, true)])?.id).toBe('coeur-vendu')
    expect(oeuvreMiseEnAvant([])).toBeNull()
  })
})

describe('seed : refus sur la production (garde-production)', () => {
  const URL_PROD = 'postgresql://u:p@ep-cool-name-123456-pooler.eu-central-1.aws.neon.tech/neondb'

  it('refuse VERCEL_ENV=production ou une DATABASE_URL sur DATABASE_PRODUCTION_ID, accepte une autre base', () => {
    expect(amorcageInterdit({ VERCEL_ENV: 'production', DATABASE_URL: 'postgresql://u@localhost/x' })).toBe(true)
    expect(amorcageInterdit({ DATABASE_PRODUCTION_ID: 'ep-cool-name-123456', DATABASE_URL: URL_PROD })).toBe(true)
    expect(amorcageInterdit({ VERCEL_ENV: 'preview', DATABASE_PRODUCTION_ID: 'ep-cool-name-123456', DATABASE_URL: URL_PROD })).toBe(true)
    expect(amorcageInterdit({ DATABASE_PRODUCTION_ID: 'ep-autre-999', DATABASE_URL: URL_PROD })).toBe(false)
    expect(amorcageInterdit({ DATABASE_URL: 'postgresql://u@localhost/x' })).toBe(false)
  })

  it('`prisma/seed.ts` s’arrête avec le message de garde-production', () => {
    // Les trois variables sont toujours définies (vides si absentes) : dotenv ne remplace jamais une
    // variable déjà présente, donc le .env.local du poste ne change pas le résultat.
    const lancer = (env: Partial<Record<'VERCEL_ENV' | 'DATABASE_PRODUCTION_ID' | 'DATABASE_URL', string>>) => {
      try {
        execFileSync(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], {
          env: {
            PATH: process.env.PATH ?? '', VERCEL_ENV: '', DATABASE_PRODUCTION_ID: '', DATABASE_URL: '', ...env,
          } as unknown as NodeJS.ProcessEnv,
          encoding: 'utf8',
          stdio: 'pipe',
        })
        return { code: 0, sortie: '' }
      } catch (e) {
        const err = e as { status: number; stderr: string }
        return { code: err.status, sortie: err.stderr }
      }
    }
    const refus = lancer({ DATABASE_PRODUCTION_ID: 'ep-cool-name-123456', DATABASE_URL: URL_PROD })
    expect(refus.code).toBe(1)
    expect(refus.sortie).toContain(new AmorcageProductionInterdit().message)
    const refusVercel = lancer({ VERCEL_ENV: 'production', DATABASE_URL: URL_PROD })
    expect(refusVercel.code).toBe(1)
    expect(refusVercel.sortie).toContain(new AmorcageProductionInterdit().message)
    expect(lancer({ DATABASE_URL: 'postgresql://u@localhost/x' }).code).toBe(0)
  })
})

describe('base : règle de visibilité « accord signé requis »', () => {
  let base: BaseJetable
  let db: Client

  async function artiste(slug: string, accordSigneLe: string | null, active = true) {
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt", "accordSigneLe", active)
       VALUES ($1, $1, $2, 'FR', 1980, 'Bio', '', now(), $3, $4)`,
      [slug, `Nom ${slug}`, accordSigneLe, active],
    )
  }
  async function oeuvre(slug: string, artistId: string, publication = 'publiee', disponibilite = 'disponible') {
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, dimensions, description, "imageUrl", price, "prixCentimes",
                              "hauteurMm", "largeurMm", available, publication, disponibilite, "artistId", "updatedAt")
       VALUES ($1, $1, $2, 2024, 'Huile sur toile', '', 'Description', '', 100, 10000, 1000, 800,
               $3, $4::"Publication", $5::"Disponibilite", $6, now())`,
      [slug, `Titre ${slug}`, publication === 'publiee' && disponibilite === 'disponible', publication, disponibilite, artistId],
    )
  }
  async function exposition(slug: string, oeuvres: string[], passee = false) {
    await db.query(
      `INSERT INTO "Exhibition" (id, slug, title, description, location, "startDate", "endDate", "imageUrl", "updatedAt")
       VALUES ($1, $1, $2, 'Description', 'Paris', now() - interval '60 days',
               now() + CASE WHEN $3 THEN interval '-30 days' ELSE interval '30 days' END, '', now())`,
      [slug, `Expo ${slug}`, passee],
    )
    for (const o of oeuvres) {
      await db.query(`INSERT INTO "ArtworkExhibition" ("artworkId", "exhibitionId") VALUES ($1, $2)`, [o, slug])
    }
  }

  // Démonstration (aucun accord) et réel (accord signé), comme en production après la story 2.7.
  async function catalogueMixte() {
    await artiste('mark-rothko', null)
    await oeuvre('no-61-rust-and-blue', 'mark-rothko')
    await oeuvre('orange-red-yellow', 'mark-rothko', 'publiee', 'retiree')
    await artiste('mustapha-timija', '2026-11-04')
    await oeuvre('aube', 'mustapha-timija')
    await oeuvre('brouillon', 'mustapha-timija', 'brouillon')
    await exposition('chromatic-meditations', ['no-61-rust-and-blue'])
    await exposition('premiere', ['aube', 'no-61-rust-and-blue'])
  }

  const catalogue = () => import('@/lib/catalogue')
  const element = (x: unknown) => x as ReactElement<Record<string, unknown>>

  beforeAll(async () => {
    base = await creerBaseJetable()
    process.env.DATABASE_URL = base.url
    db = new Client({ connectionString: base.url })
    await db.connect()
  })

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$disconnect()
    await db?.end()
    await base?.supprimer()
  })

  beforeEach(async () => {
    await db.query('DELETE FROM "ArtworkExhibition"')
    await db.query('DELETE FROM "Exhibition"')
    await db.query('DELETE FROM "Artwork"')
    await db.query('DELETE FROM "Artist"')
  })

  it('démonstration : œuvres d’un artiste sans accord absentes partout, fiches et page artiste en 404', async () => {
    await catalogueMixte()
    const c = await catalogue()
    expect((await c.getAllArtworks()).map((w) => w.id)).toEqual(['aube'])
    expect(await c.getArtworkBySlug('no-61-rust-and-blue')).toBeNull()
    expect((await c.getAllArtists()).map((a) => a.id)).toEqual(['mustapha-timija'])
    expect(await c.getArtistBySlug('mark-rothko')).toBeNull()
    expect(await c.getArtistArtworksBySlug('mark-rothko')).toEqual([])

    const { default: Fiche } = await import('@/app/galerie/[id]/page')
    await expect(Fiche({ params: { id: 'no-61-rust-and-blue' } })).rejects.toThrow('introuvable')
    // Retirée d'un artiste sans accord : 404, pas de redirection vers une page artiste masquée.
    await expect(Fiche({ params: { id: 'orange-red-yellow' } })).rejects.toThrow('introuvable')
    const { default: PageArtiste } = await import('@/app/artistes/[id]/page')
    await expect(PageArtiste({ params: { id: 'mark-rothko' } })).rejects.toThrow('introuvable')

    // Exposition : seule celle qui contient une œuvre visible ; seules ses œuvres visibles comptent.
    expect((await c.getAllExhibitions()).map((e) => [e.id, e.worksCount, e.artists])).toEqual([
      ['premiere', 1, ['Nom mustapha-timija']],
    ])
    expect(await c.getExhibitionBySlug('chromatic-meditations')).toBeNull()
    expect((await c.getExhibitionArtworksBySlug('premiere')).map((w) => w.id)).toEqual(['aube'])
    expect((await c.getRelatedExhibitions('autre')).map((e) => e.id)).toEqual(['premiere'])
    expect((await c.getExhibitionArtistsBySlug('premiere')).map((a) => a.id)).toEqual(['mustapha-timija'])
    // Même technique (« Huile ») que l'œuvre de démonstration : elle n'est pas parmi les œuvres liées.
    const aube = (await c.getArtworkBySlug('aube'))!
    expect((await c.getRelatedArtworks(aube, 10)).map((w) => w.id)).not.toContain('no-61-rust-and-blue')

    const accueil = await c.accueilPublic()
    expect(accueil.oeuvres.map((w) => w.id)).toEqual(['aube'])
    expect(accueil.miseEnAvant?.id).toBe('aube')
    expect(accueil.chiffres).toEqual({ oeuvres: 1, artistes: 1, expositions: 1 })
  })

  it('réel : une œuvre validée d’un artiste avec accord est la seule affichée en galerie', async () => {
    await catalogueMixte()
    const { default: Galerie } = await import('@/app/galerie/page')
    const props = element(await Galerie()).props
    expect((props.artworks as { id: string }[]).map((w) => w.id)).toEqual(['aube'])
    expect(props.artistNames).toEqual(['Nom mustapha-timija'])

    const { default: Fiche } = await import('@/app/galerie/[id]/page')
    await expect(Fiche({ params: { id: 'aube' } })).resolves.toBeTruthy()
    const { default: PageArtiste } = await import('@/app/artistes/[id]/page')
    const profil = element(await PageArtiste({ params: { id: 'mustapha-timija' } })).props
    expect((profil.artworks as { id: string }[]).map((w) => w.id)).toEqual(['aube'])
  })

  it('accord effacé ou artiste inactif : ses œuvres et sa page disparaissent du site public', async () => {
    await catalogueMixte()
    const c = await catalogue()
    await db.query(`UPDATE "Artist" SET "accordSigneLe" = NULL WHERE slug = 'mustapha-timija'`)
    expect(await c.getAllArtworks()).toEqual([])
    expect(await c.getArtworkBySlug('aube')).toBeNull()
    expect(await c.getAllArtists()).toEqual([])
    expect(await c.getAllExhibitions()).toEqual([])

    await db.query(`UPDATE "Artist" SET "accordSigneLe" = '2026-11-04', active = false WHERE slug = 'mustapha-timija'`)
    expect(await c.getAllArtworks()).toEqual([])
    expect(await c.getArtistBySlug('mustapha-timija')).toBeNull()

    await db.query(`UPDATE "Artist" SET active = true WHERE slug = 'mustapha-timija'`)
    expect((await c.getAllArtworks()).map((w) => w.id)).toEqual(['aube'])
  })

  it('artiste avec accord mais sans œuvre visible : absent de la liste et de sa page', async () => {
    await artiste('sans-oeuvre', '2026-11-04')
    await oeuvre('en-curation', 'sans-oeuvre', 'en_curation')
    const c = await catalogue()
    expect(await c.getAllArtists()).toEqual([])
    expect(await c.getArtistBySlug('sans-oeuvre')).toBeNull()
  })

  it('base vide : accueil, galerie, artistes et expositions rendent leur état vide sans erreur', async () => {
    const c = await catalogue()
    expect(await c.accueilPublic()).toEqual({
      oeuvres: [], artistes: [], expositions: [], miseEnAvant: null,
      chiffres: { oeuvres: 0, artistes: 0, expositions: 0 },
    })

    const { default: Accueil } = await import('@/app/page')
    const { Hero, Gallery } = await import('@/components/sections')
    const enfants = (element(await Accueil()).props.children as unknown[]).filter(Boolean).map(element)
    // Sections artistes et expositions masquées ; la collection affiche son état vide.
    expect(enfants.map((e) => e.type)).toEqual([Hero, Gallery])
    expect(enfants[0].props).toEqual({ oeuvre: null, chiffres: { oeuvres: 0, artistes: 0, expositions: 0 }, expositionEnCours: false })
    expect(enfants[1].props).toEqual({ artworks: [] })

    const { default: Galerie } = await import('@/app/galerie/page')
    expect(element(await Galerie()).props.artworks).toEqual([])
    const { default: Artistes } = await import('@/app/artistes/page')
    expect(element(await Artistes()).props.artists).toEqual([])
    const { default: Expositions } = await import('@/app/expositions/page')
    expect(element(await Expositions()).props.exhibitions).toEqual([])
  })

  it('accueil avec catalogue réel : sections remplies, œuvre mise en avant et chiffres réels', async () => {
    await catalogueMixte()
    const { default: Accueil } = await import('@/app/page')
    const { Hero, Gallery, Artists, Exhibitions } = await import('@/components/sections')
    const enfants = (element(await Accueil()).props.children as unknown[]).filter(Boolean).map(element)
    expect(enfants.map((e) => e.type)).toEqual([Hero, Gallery, Artists, Exhibitions])
    expect((enfants[0].props.oeuvre as { id: string }).id).toBe('aube')
    expect(enfants[0].props.chiffres).toEqual({ oeuvres: 1, artistes: 1, expositions: 1 })
    expect(enfants[0].props.expositionEnCours).toBe(true)
  })

  it('seule exposition visible passée : pas de badge « Exposition en cours »', async () => {
    await artiste('mustapha-timija', '2026-11-04')
    await oeuvre('aube', 'mustapha-timija')
    await exposition('archive', ['aube'], true)
    const { default: Accueil } = await import('@/app/page')
    const { Hero } = await import('@/components/sections')
    const enfants = (element(await Accueil()).props.children as unknown[]).filter(Boolean).map(element)
    const hero = enfants.find((e) => e.type === Hero)!
    expect(hero.props.chiffres).toEqual({ oeuvres: 1, artistes: 1, expositions: 1 })
    expect(hero.props.expositionEnCours).toBe(false)
  })

  describe('panier : œuvre devenue invisible', () => {
    beforeEach(() => {
      vi.stubEnv('LOT2_OUVERT', 'oui')
      stripe.creerSession.mockReset().mockResolvedValue({ url: 'https://paiement.exemple.test/s' })
    })
    afterEach(() => vi.unstubAllEnvs())

    const payer = async (slug: string) => {
      const { POST } = await import('@/app/api/checkout/route')
      return POST(new Request('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify({ items: [{ id: slug }] }),
      }) as never)
    }

    it('refus au paiement avec le message existant, pour la démonstration comme pour un accord effacé', async () => {
      await catalogueMixte()
      const demo = await payer('no-61-rust-and-blue')
      expect(demo.status).toBe(400)
      expect((await demo.json()).error).toContain("n'est plus disponible")

      expect((await payer('aube')).status).toBe(200)
      await db.query(`UPDATE "Artist" SET "accordSigneLe" = NULL WHERE slug = 'mustapha-timija'`)
      const efface = await payer('aube')
      expect(efface.status).toBe(400)
      expect((await efface.json()).error).toContain("n'est plus disponible")
      expect(stripe.creerSession).toHaveBeenCalledOnce()
    })
  })
})
