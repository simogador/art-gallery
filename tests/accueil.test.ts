import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Artwork } from '@/lib/types'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 3.10 (FR-18) : accueil curatorial — sélection de l'équipe (marqueur `featured`, écrit par
// curation), dernières œuvres publiées, en-tête (Menu, retour, Lot 2 fermé). Base réelle.

const chemin = vi.hoisted(() => ({ courant: '/', pays: undefined as string | undefined }))

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: (f: (...a: unknown[]) => Promise<unknown>) => async (...a: unknown[]) => {
    const v = await f(...a)
    return v === undefined ? v : JSON.parse(JSON.stringify(v)) // comme le vrai cache : dates en texte
  } }))
vi.mock('next/headers', () => ({ cookies: () => ({ get: (nom: string) => (nom === 'pays' && chemin.pays ? { value: chemin.pays } : undefined) }), headers: () => new Headers() }))
vi.mock('next/navigation', () => ({
  usePathname: () => chemin.courant,
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  redirect: (url: string) => {
    throw new Error(`redirection:${url}`)
  },
  notFound: () => {
    throw new Error('introuvable')
  },
}))

const ADMIN = { type: 'admin', userId: 'admin-1' }
const ARTISTE = { type: 'artist', userId: 'u-1', artiste: { id: 'artiste-1', slug: 'mustapha-timija', name: 'Mustapha Timija' } }
const VISITEUR = { type: 'visiteur' }

const oeuvreMin = (id: string, o: Partial<Artwork> = {}) => ({ id, featured: false, sold: false, ...o }) as unknown as Artwork

describe('règles pures de l’accueil', () => {
  it('sélection : marquées et disponibles seulement, ordre conservé', async () => {
    const { selectionAccueil } = await import('@/lib/catalogue/mappers')
    const liste = [oeuvreMin('a', { featured: true }), oeuvreMin('b'), oeuvreMin('c', { featured: true, sold: true }), oeuvreMin('d', { featured: true })]
    expect(selectionAccueil(liste).map((o) => o.id)).toEqual(['a', 'd'])
    expect(selectionAccueil([oeuvreMin('x')])).toEqual([])
  })

  it('nouveautés : plus récentes d’abord, hors sélection et hors vendues, limitées', async () => {
    const { nouveautesAccueil, selectionAccueil } = await import('@/lib/catalogue/mappers')
    const liste = [
      oeuvreMin('vieille', { deposeLe: '2026-01-01T00:00:00.000Z' }),
      oeuvreMin('marquee', { featured: true, deposeLe: '2026-11-09T00:00:00.000Z' }),
      oeuvreMin('vendue', { sold: true, deposeLe: '2026-11-08T00:00:00.000Z' }),
      oeuvreMin('recente', { deposeLe: '2026-11-05T00:00:00.000Z' }),
      oeuvreMin('sans-date'),
      oeuvreMin('milieu', { deposeLe: '2026-06-01T00:00:00.000Z' }),
    ]
    const selection = selectionAccueil(liste)
    expect(nouveautesAccueil(liste, selection).map((o) => o.id)).toEqual(['recente', 'milieu', 'vieille', 'sans-date'])
    expect(nouveautesAccueil(liste, selection, 2).map((o) => o.id)).toEqual(['recente', 'milieu'])
  })
})

describe('base : accueil et sélection de l’équipe', () => {
  let base: BaseJetable
  let db: Client
  const acteur = { courant: VISITEUR as unknown }

  async function oeuvre(slug: string, o: { publication?: string; disponibilite?: string; featured?: boolean; creeeLe?: string } = {}) {
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes",
                              "hauteurMm", "largeurMm", publication, disponibilite, featured, "artistId", "createdAt", "updatedAt")
       VALUES ($1, $1, $2, 2024, 'Huile sur toile', 'Histoire', '', 10000, 1000, 800,
               $3::"Publication", $4::"Disponibilite", $5, 'artiste-1', $6::timestamp, now())`,
      [slug, `Titre ${slug}`, o.publication ?? 'publiee', o.disponibilite ?? 'disponible', o.featured ?? false, o.creeeLe ?? '2026-11-01'],
    )
  }
  const featured = async (slug: string) =>
    (await db.query(`SELECT featured FROM "Artwork" WHERE slug = $1`, [slug])).rows[0].featured as boolean

  beforeAll(async () => {
    vi.doMock('@/lib/acces', async (original) => ({
      ...(await original<typeof import('@/lib/acces')>()),
      acteurCourant: async () => acteur.courant,
    }))
    base = await creerBaseJetable()
    process.env.DATABASE_URL = base.url
    db = new Client({ connectionString: base.url })
    await db.connect()
    await db.query(`INSERT INTO "User" (id, email, role, "updatedAt") VALUES ('admin-1', 'admin@exemple.test', 'admin', now())`)
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt", "accordSigneLe", active)
       VALUES ('artiste-1', 'mustapha-timija', 'Mustapha Timija', 'MA', 1980, 'Bio', '', now(), '2026-11-01', true)`,
    )
  })

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$disconnect()
    await db?.end()
    await base?.supprimer()
  })

  beforeEach(async () => {
    acteur.courant = VISITEUR
    chemin.courant = '/'
    chemin.pays = undefined
    await db.query('DELETE FROM "Artwork"')
    await db.query('DELETE FROM "Zone"')
  })

  describe('definirSelection', () => {
    it('admin : marque et démarque une œuvre publiée', async () => {
      const { definirSelection } = await import('@/lib/curation')
      await oeuvre('aube')
      expect(await definirSelection(ADMIN as never, 'aube', true)).toEqual({ ok: true })
      expect(await featured('aube')).toBe(true)
      expect(await definirSelection(ADMIN as never, 'aube', false)).toEqual({ ok: true })
      expect(await featured('aube')).toBe(false)
    })

    it('refus : non-admin, brouillon, en curation, retirée, inconnue ; rien n’est écrit', async () => {
      const { definirSelection } = await import('@/lib/curation')
      await oeuvre('aube')
      await oeuvre('brouillon', { publication: 'brouillon' })
      await oeuvre('en-curation', { publication: 'en_curation' })
      await oeuvre('retiree', { disponibilite: 'retiree' })
      expect(await definirSelection(ARTISTE as never, 'aube', true)).toEqual({ ok: false, code: 'acces_refuse' })
      expect(await definirSelection(VISITEUR as never, 'aube', true)).toEqual({ ok: false, code: 'acces_refuse' })
      expect(await definirSelection(ADMIN as never, 'brouillon', true)).toEqual({ ok: false, code: 'non_publiee' })
      expect(await definirSelection(ADMIN as never, 'en-curation', true)).toEqual({ ok: false, code: 'non_publiee' })
      expect(await definirSelection(ADMIN as never, 'retiree', true)).toEqual({ ok: false, code: 'retiree' })
      expect(await definirSelection(ADMIN as never, 'inconnue', true)).toEqual({ ok: false, code: 'introuvable' })
      for (const slug of ['aube', 'brouillon', 'en-curation', 'retiree']) expect(await featured(slug), slug).toBe(false)
    })

    it('une œuvre retirée déjà marquée peut être démarquée', async () => {
      const { definirSelection } = await import('@/lib/curation')
      await oeuvre('retiree', { disponibilite: 'retiree', featured: true })
      expect(await definirSelection(ADMIN as never, 'retiree', false)).toEqual({ ok: true })
      expect(await featured('retiree')).toBe(false)
    })

    it('l’action serveur de l’administration revient à la liste avec le résultat', async () => {
      const { actionSelection } = await import('@/app/dashboard/admin/oeuvres/actions')
      await oeuvre('aube')
      acteur.courant = ADMIN
      await expect(actionSelection('aube', true)).rejects.toThrow('redirection:/dashboard/admin/oeuvres?selection=marquee')
      expect(await featured('aube')).toBe(true)
      acteur.courant = ARTISTE
      await expect(actionSelection('aube', false)).rejects.toThrow('selection=acces_refuse')
      expect(await featured('aube')).toBe(true)
    })
  })

  describe('accueil', () => {
    it('sélection (marquées disponibles) puis nouveautés (récentes, hors sélection, hors vendues)', async () => {
      await oeuvre('marquee', { featured: true, creeeLe: '2026-01-01' })
      await oeuvre('marquee-vendue', { featured: true, disponibilite: 'vendue', creeeLe: '2026-02-01' })
      await oeuvre('ancienne', { creeeLe: '2026-03-01' })
      await oeuvre('recente', { creeeLe: '2026-11-05' })
      await oeuvre('vendue', { disponibilite: 'vendue', creeeLe: '2026-11-08' })
      await oeuvre('brouillon', { publication: 'brouillon', creeeLe: '2026-11-09' })
      const { accueilPublic } = await import('@/lib/catalogue')
      const accueil = await accueilPublic('FR')
      expect(accueil.selection.map((o) => o.id)).toEqual(['marquee'])
      expect(accueil.nouveautes.map((o) => o.id)).toEqual(['recente', 'ancienne'])
    })

    it('l’ordre par date de dépôt tient quand createdAt revient en texte du cache', async () => {
      await oeuvre('a-ancienne', { creeeLe: '2026-01-01' })
      await oeuvre('b-recente', { creeeLe: '2026-11-05' })
      await oeuvre('c-milieu', { creeeLe: '2026-06-01' })
      const { accueilPublic } = await import('@/lib/catalogue')
      expect((await accueilPublic('FR')).nouveautes.map((o) => o.id)).toEqual(['b-recente', 'c-milieu', 'a-ancienne'])
    })

    it('vignette : prix livré du pays du cookie, texte de non-livraison hors zone', async () => {
      await oeuvre('aube')
      await db.query(`INSERT INTO "Zone" (id, nom, "updatedAt") VALUES ('zone-us', 'Amérique', now())`)
      await db.query(`INSERT INTO "ZonePays" ("codePays", "zoneId") VALUES ('US', 'zone-us')`)
      await db.query(
        `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", "fraisCentimes", "preparationJours", "transportMinJours", "transportMaxJours", "updatedAt")
         VALUES (gen_random_uuid()::text, 'aube', 'zone-us', 5000, 3, 5, 10, now())`,
      )
      const { default: Accueil } = await import('@/app/page')
      const { formaterMontant, fr } = await import('@/lib/i18n')
      chemin.pays = 'US'
      const livre = renderToStaticMarkup(await Accueil())
      expect(livre).toContain(formaterMontant(15000, 'EUR'))
      expect(livre).toContain(fr.livraison.droitsNonInclus)
      chemin.pays = 'JP'
      const nonLivre = renderToStaticMarkup(await Accueil())
      expect(nonLivre).not.toContain(formaterMontant(15000, 'EUR'))
      expect(nonLivre).toContain('Pas de livraison vers')
    })

    it('page : deux sections de vignettes vers les fiches et « Parcourir la galerie »', async () => {
      await oeuvre('marquee', { featured: true })
      await oeuvre('recente')
      const { default: Accueil } = await import('@/app/page')
      const html = renderToStaticMarkup(await Accueil())
      expect(html).toContain('Sélection de l’équipe')
      expect(html).toContain('Dernières œuvres publiées')
      expect(html).toContain('href="/galerie/marquee"')
      expect(html).toContain('href="/galerie/recente"')
      expect(html).toContain('Parcourir la galerie')
      expect(html).toContain('href="/galerie"')
      expect(html).toContain('aria-hidden="true"')
    })

    it('aucune œuvre marquée : la sélection est absente, les nouveautés seules', async () => {
      await oeuvre('recente')
      const { default: Accueil } = await import('@/app/page')
      const html = renderToStaticMarkup(await Accueil())
      expect(html).not.toContain('Sélection de l’équipe')
      expect(html).toContain('Dernières œuvres publiées')
    })

    it('catalogue vide : état vide sans erreur, accès à la galerie conservé', async () => {
      const { default: Accueil } = await import('@/app/page')
      const html = renderToStaticMarkup(await Accueil())
      expect(html).toContain('La collection arrive bientôt')
      expect(html).not.toContain('Sélection de l’équipe')
      expect(html).toContain('Parcourir la galerie')
    })

    it('œuvre marquée mais vendue : absente de la sélection', async () => {
      await oeuvre('marquee-vendue', { featured: true, disponibilite: 'vendue' })
      const { default: Accueil } = await import('@/app/page')
      const html = renderToStaticMarkup(await Accueil())
      expect(html).not.toContain('Sélection de l’équipe')
      expect(html).not.toContain('Dernières œuvres publiées')
      expect(html).toContain('La collection arrive bientôt')
    })
  })

  describe('en-tête', () => {
    const rendre = async (lot2: boolean) => {
      const { Header } = await import('@/components/layout/Header')
      return renderToStaticMarkup(createElement(Header, { session: null, lot2Ouvert: lot2 }))
    }

    it('Lot 2 fermé : « Menu » et la marque, ni « Panier » ni retour sur l’accueil', async () => {
      const html = await rendre(false)
      expect(html).toContain('Menu')
      expect(html).toContain('Galerie')
      expect(html).not.toContain('/panier')
      expect(html).not.toContain('Panier')
      expect(html).not.toContain('‹')
    })

    it('Lot 2 ouvert : le panier revient', async () => {
      expect(await rendre(true)).toContain('/panier')
    })

    it.each([
      ['/galerie/aube', '‹ Galerie', 'href="/galerie"'],
      ['/artistes/mustapha-timija', '‹ Artistes', 'href="/artistes"'],
      ['/expositions/premiere', '‹ Expositions', 'href="/expositions"'],
    ])('écran profond %s : %s vers la liste parente', async (url, texte, lien) => {
      chemin.courant = url
      const html = await rendre(false)
      expect(html).toContain(texte)
      expect(html).toContain(lien)
    })

    it('le lien Panier du menu mobile est derrière lot2Ouvert, et le layout le transmet', async () => {
      const { readFileSync } = await import('node:fs')
      const header = readFileSync('src/components/layout/Header.tsx', 'utf8')
      const liens = [...header.matchAll(/href="\/panier"/g)].map((m) => m.index!)
      expect(liens.length).toBeGreaterThan(0)
      for (const i of liens) {
        const avant = header.slice(0, i)
        expect(avant.lastIndexOf('{lot2Ouvert && ('), 'lien /panier hors de lot2Ouvert').toBeGreaterThan(-1)
      }
      expect(readFileSync('src/app/layout.tsx', 'utf8')).toContain('lot2Ouvert={lot2Ouvert()}')
    })

    it('listes elles-mêmes : pas de retour', async () => {
      for (const url of ['/galerie', '/artistes', '/expositions', '/galerie/']) {
        chemin.courant = url
        expect(await rendre(false), url).not.toContain('‹')
      }
    })
  })
})
