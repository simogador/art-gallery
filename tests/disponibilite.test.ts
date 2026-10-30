import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  champAvailable,
  codeEtat,
  estDisponible,
  estVisible,
  libelleEtat,
  type Disponibilite,
  type EtatOeuvre,
  type Publication,
} from '@/lib/disponibilite/etats'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 2.2 (AD-6, AD-7, AD-20) : publication et disponibilité, deux axes distincts.

const UTILISATEUR = 'artiste-utilisateur'
vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: UTILISATEUR, email: 'a@exemple.test' } })) }))
const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as Record<string, unknown> }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => acteur.courant }))

const stripe = vi.hoisted(() => ({ creerSession: vi.fn(), evenement: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    checkout: { sessions: { create: stripe.creerSession } },
    webhooks: { constructEvent: stripe.evenement },
  }),
}))
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

const SQL_RECOPIE = readFileSync(path.resolve('scripts/sql/recopie-publication-disponibilite.sql'), 'utf8')
const SQL_ECARTS = readFileSync(path.resolve('scripts/sql/ecarts-publication-disponibilite.sql'), 'utf8')
const SQL_CORRECTION = readFileSync(path.resolve('scripts/sql/corriger-ecarts-publication-disponibilite.sql'), 'utf8')
const SQL_VENDUES_SANS_COMMANDE = readFileSync(path.resolve('scripts/sql/vendues-sans-commande.sql'), 'utf8')

const PUBLICATIONS: (Publication | null)[] = ['brouillon', 'en_curation', 'publiee', null]
const DISPONIBILITES: (Disponibilite | null)[] = ['disponible', 'reservee', 'vendue', 'vendue_ailleurs', 'retiree', null]

describe('définitions de « visible » et « disponible »', () => {
  it('visible : publiée et non retirée ; disponible : publiée et disponible ; colonnes vides : ni l’un ni l’autre', () => {
    for (const publication of PUBLICATIONS) {
      for (const disponibilite of DISPONIBILITES) {
        const e: EtatOeuvre = { publication, disponibilite }
        const publiee = publication === 'publiee'
        expect(estVisible(e), JSON.stringify(e)).toBe(publiee && disponibilite !== null && disponibilite !== 'retiree')
        expect(estDisponible(e), JSON.stringify(e)).toBe(publiee && disponibilite === 'disponible')
        expect(champAvailable(e)).toEqual({ available: estDisponible(e) })
      }
    }
  })

  it('calcule les sept états de l’écran artiste', () => {
    expect(libelleEtat({ publication: 'brouillon', disponibilite: 'disponible' })).toBe('Brouillon')
    expect(libelleEtat({ publication: 'en_curation', disponibilite: 'disponible' })).toBe('En curation')
    expect(libelleEtat({ publication: 'publiee', disponibilite: 'disponible' })).toBe('Disponible')
    expect(libelleEtat({ publication: 'publiee', disponibilite: 'reservee' })).toBe('Réservée')
    expect(libelleEtat({ publication: 'publiee', disponibilite: 'vendue' })).toBe('Vendue')
    expect(libelleEtat({ publication: 'publiee', disponibilite: 'vendue_ailleurs' })).toBe('Vendue ailleurs')
    expect(libelleEtat({ publication: 'publiee', disponibilite: 'retiree' })).toBe('Retirée')
    // Colonnes vides (œuvre pas encore recopiée) : non visible, affichée comme brouillon.
    expect(codeEtat({ publication: null, disponibilite: null })).toBe('brouillon')
    expect(codeEtat({ publication: 'publiee', disponibilite: null })).toBe('brouillon')
  })
})

describe('seuls les modules disponibilite et curation lisent ou écrivent les deux colonnes', () => {
  const fichiers = (dossier: string): string[] =>
    readdirSync(dossier).flatMap((nom) => {
      const chemin = path.join(dossier, nom)
      return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(ts|tsx)$/.test(nom) ? [chemin] : []
    })
  const AUTORISES = ['src/generated/', 'src/lib/disponibilite/', 'src/lib/curation/']

  it('aucun accès brut à publication ou disponibilite dans src/ hors des deux modules', () => {
    const acces = /\b(publication|disponibilite)\b\s*[:=?]|\.(publication|disponibilite)\b|['"](publication|disponibilite)['"]/
    const trouves = fichiers('src')
      .filter((f) => !AUTORISES.some((a) => f.split(path.sep).join('/').startsWith(a)))
      .flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .filter((ligne) => !/^\s*(\/\/|\*|\/\*)/.test(ligne) && acces.test(ligne))
          .map((ligne) => `${f}: ${ligne.trim()}`),
      )
    expect(trouves).toEqual([])
  })

  it('aucune lecture de l’ancienne colonne available hors des deux modules', () => {
    // Seule exception : le champ `available` du corps de la requête admin (bascule), transmis à disponibilite.
    const lecture = /\.available\b|\bavailable\s*[:?]/
    const trouves = fichiers('src')
      .filter((f) => !AUTORISES.some((a) => f.split(path.sep).join('/').startsWith(a)))
      .flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .filter((ligne) => !/^\s*(\/\/|\*|\/\*)/.test(ligne) && lecture.test(ligne.replace(/\bbody\.available\b/g, '')))
          .map((ligne) => `${f}: ${ligne.trim()}`),
      )
    expect(trouves).toEqual([])
  })
})

describe('base : recopie, lectures et écritures', () => {
  let base: BaseJetable
  let db: Client

  // Insertion par l'ancien code : sans les nouvelles colonnes.
  async function ancienneOeuvre(slug: string, available = true, prixCentimes = 10000) {
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, dimensions, description, "imageUrl", price, "prixCentimes", available, "artistId", "updatedAt")
       VALUES ($1, $1, $2, 2020, 'Huile sur toile', '10 × 10 cm', 'Description', '', $3, $4, $5, 'artiste-1', now())`,
      [slug, `Titre ${slug}`, prixCentimes / 100, prixCentimes, available],
    )
  }
  async function oeuvre(slug: string, publication: Publication | null, disponibilite: Disponibilite | null) {
    await ancienneOeuvre(slug, estDisponible({ publication, disponibilite }))
    await db.query(
      `UPDATE "Artwork" SET publication = $2::"Publication", disponibilite = $3::"Disponibilite" WHERE slug = $1`,
      [slug, publication, disponibilite],
    )
  }
  const etat = async (slug: string) =>
    (await db.query(`SELECT publication, disponibilite, available FROM "Artwork" WHERE slug = $1`, [slug])).rows[0]

  const ADMIN = { type: 'admin', userId: 'admin' }
  const ARTISTE = { type: 'artist', userId: UTILISATEUR, artiste: { id: 'artiste-1', slug: 'artiste-1', name: 'Artiste Un' } }

  beforeAll(async () => {
    base = await creerBaseJetable()
    process.env.DATABASE_URL = base.url
    db = new Client({ connectionString: base.url })
    await db.connect()
    await db.query(
      `INSERT INTO "User" (id, email, role, "updatedAt") VALUES ($1, 'artiste@exemple.test', 'artist', now())`,
      [UTILISATEUR],
    )
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt", "userId")
       VALUES ('artiste-1', 'artiste-1', 'Artiste Un', 'FR', 1980, 'Bio', '', now(), $1)`,
      [UTILISATEUR],
    )
  })

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$disconnect()
    await db?.end()
    await base?.supprimer()
  })

  beforeEach(async () => {
    acteur.courant = { type: 'visiteur' }
    await db.query('DELETE FROM "Order"')
    await db.query('DELETE FROM "ArtworkExhibition"')
    await db.query('DELETE FROM "Artwork"')
  })

  it('la recopie suit available, deux fois sans changement, sans écraser une valeur présente', async () => {
    await ancienneOeuvre('dispo', true)
    await ancienneOeuvre('vendue', false)
    await ancienneOeuvre('deja-brouillon', true)
    await db.query(
      `UPDATE "Artwork" SET publication = 'brouillon', disponibilite = 'retiree' WHERE slug = 'deja-brouillon'`,
    )

    await db.query(SQL_RECOPIE)
    const premier = (await db.query('SELECT * FROM "Artwork" ORDER BY slug')).rows
    await db.query(SQL_RECOPIE)
    expect((await db.query('SELECT * FROM "Artwork" ORDER BY slug')).rows).toEqual(premier)

    expect(await etat('dispo')).toEqual({ publication: 'publiee', disponibilite: 'disponible', available: true })
    expect(await etat('vendue')).toEqual({ publication: 'publiee', disponibilite: 'vendue', available: false })
    expect(await etat('deja-brouillon')).toMatchObject({ publication: 'brouillon', disponibilite: 'retiree' })
  })

  it('la requête d’écarts liste les œuvres créées ou modifiées par l’ancien code après la recopie', async () => {
    await ancienneOeuvre('intacte', true)
    await ancienneOeuvre('vendue-par-l-ancien-code', true)
    await ancienneOeuvre('remise-en-vente', false)
    await db.query(SQL_RECOPIE)
    await oeuvre('brouillon-du-nouveau-code', 'brouillon', 'disponible')
    expect((await db.query(SQL_ECARTS)).rows).toEqual([])

    // L'ancien code écrit available, jamais les nouvelles colonnes.
    await db.query(`UPDATE "Artwork" SET available = false WHERE slug = 'vendue-par-l-ancien-code'`)
    await db.query(`UPDATE "Artwork" SET available = true WHERE slug = 'remise-en-vente'`)
    await ancienneOeuvre('creee-par-l-ancien-code', true)

    const ecarts = async () => (await db.query(SQL_ECARTS)).rows.map((r) => r.slug)
    expect(await ecarts()).toEqual(['creee-par-l-ancien-code', 'remise-en-vente', 'vendue-par-l-ancien-code'])

    // Correction ciblée (script documenté), deux fois sans changement.
    await db.query(SQL_CORRECTION)
    await db.query(SQL_CORRECTION)
    expect(await ecarts()).toEqual([])
    expect(await etat('vendue-par-l-ancien-code')).toEqual({ publication: 'publiee', disponibilite: 'vendue', available: false })
    expect(await etat('remise-en-vente')).toEqual({ publication: 'publiee', disponibilite: 'disponible', available: true })
    expect(await etat('creee-par-l-ancien-code')).toEqual({ publication: 'publiee', disponibilite: 'disponible', available: true })
    expect(await etat('brouillon-du-nouveau-code')).toMatchObject({ publication: 'brouillon' })
  })

  it('la correction ne touche jamais un état inconnu de l’ancien code', async () => {
    const etats: [string, Publication, Disponibilite][] = [
      ['brouillon', 'brouillon', 'disponible'],
      ['curation', 'en_curation', 'vendue'],
      ['reservee', 'publiee', 'reservee'],
      ['ailleurs', 'publiee', 'vendue_ailleurs'],
      ['retiree', 'publiee', 'retiree'],
    ]
    for (const [slug, publication, disponibilite] of etats) await oeuvre(slug, publication, disponibilite)
    // L'ancien code les remet toutes en vente.
    await db.query(`UPDATE "Artwork" SET available = true`)
    await db.query(`UPDATE "Artwork" SET publication = NULL WHERE slug = 'reservee'`)
    await db.query(SQL_CORRECTION)
    for (const [slug, publication, disponibilite] of etats) {
      expect(await etat(slug), slug).toMatchObject({ publication: slug === 'reservee' ? 'publiee' : publication, disponibilite })
    }
    // Elles restent listées, pour un traitement à la main.
    expect((await db.query(SQL_ECARTS)).rows.map((r) => r.slug)).toEqual(['ailleurs', 'brouillon', 'curation', 'reservee', 'retiree'])
  })

  it('liste les œuvres publiées et vendues qu’aucune commande ne contient', async () => {
    await oeuvre('vendue-commandee', 'publiee', 'vendue')
    await oeuvre('vendue-commandee-2', 'publiee', 'vendue')
    await oeuvre('masquee', 'publiee', 'vendue')
    await oeuvre('brouillon-vendu', 'brouillon', 'vendue')
    await oeuvre('dispo', 'publiee', 'disponible')
    await db.query(
      `INSERT INTO "Order" (id, "stripeSessionId", "artworkIds", amount, "updatedAt")
       VALUES ('o1', 'cs_x', 'autre,vendue-commandee,vendue-commandee-2', 100, now())`,
    )
    expect((await db.query(SQL_VENDUES_SANS_COMMANDE)).rows.map((r) => r.slug)).toEqual(['masquee'])
  })

  it('la galerie ne liste que les œuvres visibles, la vendue marquée vendue', async () => {
    await oeuvre('a-disponible', 'publiee', 'disponible')
    await oeuvre('b-vendue', 'publiee', 'vendue')
    await oeuvre('c-brouillon', 'brouillon', 'disponible')
    await oeuvre('d-retiree', 'publiee', 'retiree')
    await ancienneOeuvre('e-colonnes-vides', true)

    const { getAllArtworks, getArtistBySlug, getArtistArtworksBySlug } = await import('@/lib/catalogue')
    const galerie = await getAllArtworks()
    expect(galerie.map((w) => [w.id, w.sold]).sort()).toEqual([
      ['a-disponible', false],
      ['b-vendue', true],
    ])
    expect((await getArtistArtworksBySlug('artiste-1')).map((w) => w.id).sort()).toEqual(['a-disponible', 'b-vendue'])
    expect((await getArtistBySlug('artiste-1'))?.worksCount).toBe(2)
  })

  it('œuvres liées et expositions ne montrent que les œuvres visibles', async () => {
    await oeuvre('a-disponible', 'publiee', 'disponible')
    await oeuvre('b-vendue', 'publiee', 'vendue')
    await oeuvre('c-brouillon', 'brouillon', 'disponible')
    await oeuvre('d-retiree', 'publiee', 'retiree')
    await ancienneOeuvre('e-colonnes-vides', true)
    await db.query('DELETE FROM "Exhibition"')
    await db.query(
      `INSERT INTO "Exhibition" (id, slug, title, description, location, "startDate", "endDate", "imageUrl", "updatedAt")
       VALUES ('expo-1', 'expo-1', 'Expo', 'Description', 'Paris', now(), now() + interval '30 days', '', now())`,
    )
    await db.query(`INSERT INTO "ArtworkExhibition" ("artworkId", "exhibitionId") SELECT id, 'expo-1' FROM "Artwork"`)

    const catalogue = await import('@/lib/catalogue')
    const visible = (await catalogue.getArtworkBySlug('a-disponible'))!
    expect((await catalogue.getRelatedArtworks(visible, 10)).map((w) => w.id)).toEqual(['b-vendue'])

    expect((await catalogue.getAllExhibitions()).map((e) => e.worksCount)).toEqual([2])
    expect((await catalogue.getExhibitionBySlug('expo-1'))?.worksCount).toBe(2)
    expect((await catalogue.getExhibitionArtworksBySlug('expo-1')).map((w) => w.id).sort()).toEqual(['a-disponible', 'b-vendue'])
    const artistes = await catalogue.getExhibitionArtistsBySlug('expo-1')
    expect(artistes.map((a) => [a.id, a.worksCount])).toEqual([['artiste-1', 2]])

    // Sans œuvre visible, l'artiste n'apparaît plus dans l'exposition.
    await db.query(`UPDATE "Artwork" SET publication = 'brouillon'`)
    expect(await catalogue.getExhibitionArtistsBySlug('expo-1')).toEqual([])
    expect((await catalogue.getExhibitionBySlug('expo-1'))?.worksCount).toBe(0)
  })

  it('une réservée ou une vendue ailleurs reste visible, comme vendue', async () => {
    await oeuvre('reservee', 'publiee', 'reservee')
    await oeuvre('ailleurs', 'publiee', 'vendue_ailleurs')
    const { getAllArtworks } = await import('@/lib/catalogue')
    expect((await getAllArtworks()).map((w) => [w.id, w.sold]).sort()).toEqual([
      ['ailleurs', true],
      ['reservee', true],
    ])
  })

  describe('fiche d’une œuvre', () => {
    const fiche = async (id: string) => {
      const { default: Page } = await import('@/app/galerie/[id]/page')
      return Page({ params: { id } })
    }

    it('retirée : redirection permanente vers la page de son artiste', async () => {
      await oeuvre('retiree', 'publiee', 'retiree')
      await expect(fiche('retiree')).rejects.toThrow('redirection-permanente:/artistes/artiste-1')
    })

    it.each([
      ['brouillon', 'brouillon' as const, 'disponible' as const],
      ['en-curation', 'en_curation' as const, 'disponible' as const],
      ['brouillon-retiree', 'brouillon' as const, 'retiree' as const],
      ['vide', null, null],
    ])('non publiée (%s) : 404', async (slug, publication, disponibilite) => {
      await oeuvre(slug, publication, disponibilite)
      await expect(fiche(slug)).rejects.toThrow('introuvable')
    })

    it('inconnue : 404 ; visible : affichée', async () => {
      await expect(fiche('inconnue')).rejects.toThrow('introuvable')
      await oeuvre('visible', 'publiee', 'vendue')
      await expect(fiche('visible')).resolves.toBeTruthy()
    })
  })

  describe('paiement (Lot 2 ouvert)', () => {
    beforeEach(() => {
      vi.stubEnv('LOT2_OUVERT', 'oui')
      stripe.creerSession.mockReset().mockResolvedValue({ url: 'https://paiement.exemple.test/s' })
    })
    afterEach(() => vi.unstubAllEnvs())

    const payer = async (slug: string) => {
      const { POST } = await import('@/app/api/checkout/route')
      return POST(
        new Request('http://localhost/api/checkout', {
          method: 'POST',
          body: JSON.stringify({ items: [{ id: slug }] }),
        }) as never,
      )
    }

    it.each([
      ['publiee' as const, 'vendue' as const],
      ['publiee' as const, 'reservee' as const],
      ['publiee' as const, 'retiree' as const],
      ['publiee' as const, 'vendue_ailleurs' as const],
      ['brouillon' as const, 'disponible' as const],
    ])('refuse une œuvre %s / %s : « n’est plus disponible »', async (publication, disponibilite) => {
      await oeuvre('refusee', publication, disponibilite)
      // available volontairement à true : seule la nouvelle définition décide.
      await db.query(`UPDATE "Artwork" SET available = true WHERE slug = 'refusee'`)
      const reponse = await payer('refusee')
      expect(reponse.status).toBe(400)
      expect((await reponse.json()).error).toContain("n'est plus disponible")
      expect(stripe.creerSession).not.toHaveBeenCalled()
    })

    it('accepte une œuvre publiée et disponible', async () => {
      await oeuvre('payable', 'publiee', 'disponible')
      expect((await payer('payable')).status).toBe(200)
      expect(stripe.creerSession).toHaveBeenCalledOnce()
    })
  })

  describe('webhook de paiement', () => {
    const recevoir = async (evenement: unknown) => {
      stripe.evenement.mockReset().mockReturnValue(evenement)
      const { POST } = await import('@/app/api/webhooks/stripe/route')
      return POST(
        new Request('http://localhost/api/webhooks/stripe', {
          method: 'POST',
          headers: { 'stripe-signature': 'signature' },
          body: '{}',
        }) as never,
      )
    }

    it('session payée : vendue et available = false, idempotent', async () => {
      await oeuvre('payee-1', 'publiee', 'disponible')
      await oeuvre('payee-2', 'publiee', 'disponible')
      await oeuvre('autre', 'publiee', 'disponible')
      const evenement = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_1', payment_intent: 'pi_1', amount_total: 20000, currency: 'eur',
            metadata: { artworkIds: 'payee-1,payee-2', userId: UTILISATEUR }, customer_details: null,
          },
        },
      }
      expect((await recevoir(evenement)).status).toBe(200)
      expect((await recevoir(evenement)).status).toBe(200)
      for (const slug of ['payee-1', 'payee-2']) {
        expect(await etat(slug)).toEqual({ publication: 'publiee', disponibilite: 'vendue', available: false })
      }
      expect(await etat('autre')).toMatchObject({ disponibilite: 'disponible', available: true })
      expect((await db.query('SELECT count(*)::int AS n FROM "Order"')).rows[0].n).toBe(1)
    })

    it('payée alors qu’elle n’était pas en vente : vendue quand même, slugs journalisés', async () => {
      const etats: [string, Publication, Disponibilite][] = [
        ['p-dispo', 'publiee', 'disponible'],
        ['p-reservee', 'publiee', 'reservee'],
        ['p-retiree', 'publiee', 'retiree'],
        ['p-ailleurs', 'publiee', 'vendue_ailleurs'],
        ['p-brouillon', 'brouillon', 'disponible'],
        ['p-deja-vendue', 'publiee', 'vendue'],
      ]
      for (const [slug, publication, disponibilite] of etats) await oeuvre(slug, publication, disponibilite)
      const journal = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        const { marquerVendues } = await import('@/lib/disponibilite')
        expect(await marquerVendues(etats.map(([slug]) => slug))).toBe(6)
        expect(journal).toHaveBeenCalledOnce()
        const [, slugs] = journal.mock.calls[0]
        expect(slugs).toEqual(['p-ailleurs', 'p-brouillon', 'p-deja-vendue', 'p-retiree'])
        expect(JSON.stringify(journal.mock.calls)).not.toContain('@')
      } finally {
        journal.mockRestore()
      }
      for (const [slug] of etats) expect(await etat(slug), slug).toMatchObject({ disponibilite: 'vendue', available: false })
    })

    it('paiement de secours (payment_intent) : vendue et available = false', async () => {
      await oeuvre('secours', 'publiee', 'disponible')
      const evenement = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_2', amount_received: 10000, currency: 'eur', receipt_email: null,
            metadata: { artworkIds: 'secours', userId: UTILISATEUR },
          },
        },
      }
      expect((await recevoir(evenement)).status).toBe(200)
      expect(await etat('secours')).toEqual({ publication: 'publiee', disponibilite: 'vendue', available: false })
    })
  })

  it('une œuvre créée par l’artiste naît brouillon + disponible, absente du catalogue', async () => {
    acteur.courant = ARTISTE
    const { POST } = await import('@/app/api/artiste/oeuvres/route')
    const reponse = await POST(
      new Request('http://localhost/api/artiste/oeuvres', {
        method: 'POST',
        body: JSON.stringify({ title: 'Nouvelle', year: '2024', technique: 'Huile', price: '100', dimensions: '60 × 80 cm' }),
      }) as never,
    )
    expect(reponse.status).toBe(201)
    const { slug } = await reponse.json()
    // available = « disponible » (publiée et disponible) : faux tant qu'elle n'est pas publiée.
    expect(await etat(slug)).toEqual({ publication: 'brouillon', disponibilite: 'disponible', available: false })

    const { getAllArtworks, getArtworkBySlug, oeuvresDeLArtiste } = await import('@/lib/catalogue')
    expect(await getAllArtworks()).toEqual([])
    expect(await getArtworkBySlug(slug)).toBeNull()
    expect((await oeuvresDeLArtiste(UTILISATEUR))?.oeuvres[0]).toMatchObject({
      slug, etat: 'brouillon', libelleEtat: 'Brouillon', disponible: false,
    })
  })

  describe('administration', () => {
    const modifier = async (slug: string, corps: unknown) => {
      const { PUT } = await import('@/app/api/admin/oeuvres/[slug]/route')
      return PUT(
        new Request(`http://localhost/api/admin/oeuvres/${slug}`, { method: 'PUT', body: JSON.stringify(corps) }) as never,
        { params: Promise.resolve({ slug }) },
      )
    }

    it('un admin publie puis dépublie ; available suit « disponible »', async () => {
      await oeuvre('a-publier', 'brouillon', 'disponible')
      acteur.courant = ADMIN
      expect((await modifier('a-publier', { publiee: true })).status).toBe(200)
      expect(await etat('a-publier')).toEqual({ publication: 'publiee', disponibilite: 'disponible', available: true })
      const { getAllArtworks } = await import('@/lib/catalogue')
      expect((await getAllArtworks()).map((w) => w.id)).toEqual(['a-publier'])

      expect((await modifier('a-publier', { publiee: false })).status).toBe(200)
      expect(await etat('a-publier')).toEqual({ publication: 'brouillon', disponibilite: 'disponible', available: false })
    })

    it('un admin bascule Disponible / Vendue ; available cohérent', async () => {
      await oeuvre('a-basculer', 'publiee', 'disponible')
      acteur.courant = ADMIN
      expect((await modifier('a-basculer', { available: false })).status).toBe(200)
      expect(await etat('a-basculer')).toEqual({ publication: 'publiee', disponibilite: 'vendue', available: false })
      expect((await modifier('a-basculer', { available: true })).status).toBe(200)
      expect(await etat('a-basculer')).toEqual({ publication: 'publiee', disponibilite: 'disponible', available: true })

      // Brouillon remis en vente : disponible, mais available reste faux tant qu'il n'est pas publié.
      await oeuvre('brouillon-vendu', 'brouillon', 'vendue')
      expect((await modifier('brouillon-vendu', { available: true })).status).toBe(200)
      expect(await etat('brouillon-vendu')).toEqual({ publication: 'brouillon', disponibilite: 'disponible', available: false })
    })

    it.each([['reservee' as const], ['vendue_ailleurs' as const], ['retiree' as const]])(
      'bascule refusée en 409 pour une œuvre %s, sans rien changer',
      async (disponibilite) => {
        await oeuvre('figee', 'publiee', disponibilite)
        acteur.courant = ADMIN
        for (const available of [true, false]) {
          const reponse = await modifier('figee', { available })
          expect(reponse.status).toBe(409)
        }
        expect(await etat('figee')).toEqual({ publication: 'publiee', disponibilite, available: false })
        const { definirDisponibilite } = await import('@/lib/disponibilite')
        expect(await definirDisponibilite(ADMIN as never, 'figee', true)).toEqual({ ok: false, code: 'transition_interdite' })
      },
    )

    it('œuvre non recopiée (un axe vide) : publication et bascule refusées', async () => {
      await ancienneOeuvre('vide', true)
      await oeuvre('sans-dispo', 'publiee', null)
      await oeuvre('sans-publication', null, 'disponible')
      acteur.courant = ADMIN
      const { definirPublication } = await import('@/lib/curation')
      const { definirDisponibilite } = await import('@/lib/disponibilite')
      for (const slug of ['vide', 'sans-dispo', 'sans-publication']) {
        const avant = await etat(slug)
        expect(await definirPublication(ADMIN as never, slug, true), slug).toEqual({ ok: false, code: 'non_recopiee' })
        expect(await definirDisponibilite(ADMIN as never, slug, true), slug).toEqual({ ok: false, code: 'non_recopiee' })
        expect((await modifier(slug, { publiee: true })).status).toBe(409)
        expect((await modifier(slug, { available: false })).status).toBe(409)
        expect(await etat(slug)).toEqual(avant)
      }
    })

    it('publication et paiement concurrents : available jamais vrai sur une œuvre vendue', async () => {
      const { definirPublication } = await import('@/lib/curation')
      const { marquerVendues } = await import('@/lib/disponibilite')
      const journal = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        for (let i = 0; i < 10; i++) {
          await oeuvre(`course-${i}`, 'brouillon', 'disponible')
          await Promise.all([definirPublication(ADMIN as never, `course-${i}`, true), marquerVendues([`course-${i}`])])
          expect(await etat(`course-${i}`)).toEqual({ publication: 'publiee', disponibilite: 'vendue', available: false })
        }
      } finally {
        journal.mockRestore()
      }
    })

    it('œuvre inconnue : 404', async () => {
      acteur.courant = ADMIN
      expect((await modifier('inconnue', { publiee: true })).status).toBe(404)
      expect((await modifier('inconnue', { available: true })).status).toBe(404)
      expect((await modifier('inconnue', { title: 'X' })).status).toBe(404)
    })

    it.each([
      ['visiteur', { type: 'visiteur' }],
      ['utilisateur', { type: 'user', userId: 'u' }],
      ['artiste', ARTISTE],
    ])('refusé en 403 pour un %s, sans rien changer', async (_nom, refuse) => {
      await oeuvre('protegee', 'brouillon', 'disponible')
      acteur.courant = refuse
      expect((await modifier('protegee', { publiee: true })).status).toBe(403)
      expect((await modifier('protegee', { available: false })).status).toBe(403)
      expect(await etat('protegee')).toEqual({ publication: 'brouillon', disponibilite: 'disponible', available: false })
    })

    it('les fonctions des modules vérifient elles-mêmes l’acteur', async () => {
      await oeuvre('directe', 'brouillon', 'disponible')
      const { definirPublication } = await import('@/lib/curation')
      const { definirDisponibilite } = await import('@/lib/disponibilite')
      expect(await definirPublication(ARTISTE as never, 'directe', true)).toEqual({ ok: false, code: 'acces_refuse' })
      expect(await definirDisponibilite(ARTISTE as never, 'directe', false)).toEqual({ ok: false, code: 'acces_refuse' })
      expect(await etat('directe')).toMatchObject({ publication: 'brouillon', disponibilite: 'disponible' })
    })

    it('les comptages viennent du module', async () => {
      await oeuvre('c1', 'publiee', 'disponible')
      await oeuvre('c2', 'publiee', 'vendue')
      await oeuvre('c3', 'brouillon', 'disponible')
      await ancienneOeuvre('c4', true)
      const { compterOeuvres } = await import('@/lib/disponibilite')
      expect(await compterOeuvres()).toEqual({ total: 4, disponibles: 1, vendues: 1, nonPubliees: 2 })
    })
  })

  it('espace artiste : libellés des états et chiffre d’affaires des œuvres vendues', async () => {
    await oeuvre('e-dispo', 'publiee', 'disponible')
    await oeuvre('e-vendue', 'publiee', 'vendue')
    await oeuvre('e-curation', 'en_curation', 'disponible')
    await oeuvre('e-retiree', 'publiee', 'retiree')
    const { accueilArtiste, oeuvresDeLArtiste, oeuvreAEditer } = await import('@/lib/catalogue')
    const libelles = Object.fromEntries((await oeuvresDeLArtiste(UTILISATEUR))!.oeuvres.map((o) => [o.slug, o.libelleEtat]))
    expect(libelles).toEqual({ 'e-dispo': 'Disponible', 'e-vendue': 'Vendue', 'e-curation': 'En curation', 'e-retiree': 'Retirée' })
    expect((await accueilArtiste(UTILISATEUR))?.chiffreAffairesCentimes).toBe(10000)
    expect(await oeuvreAEditer(UTILISATEUR, 'e-curation')).toMatchObject({ etat: 'en_curation', disponible: false })
  })
})
