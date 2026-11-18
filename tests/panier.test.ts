import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 7.2 (FR-10, FR-11, AD-13) : panier public, recomposé par le serveur à partir de slugs. Règles
// pures (slugs, sommes de `livraison`) puis base réelle (`composerPanier`, action `recalculerPanier`).

const cookie = vi.hoisted(() => ({ pays: undefined as string | undefined }))
vi.mock('next/headers', () => ({
  cookies: () => ({ get: (nom: string) => (nom === 'pays' && cookie.pays ? { value: cookie.pays } : undefined) }),
  headers: () => ({ get: () => null }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))

describe('slugs du panier (règles pures)', () => {
  it('dédoublonnés, nettoyés, plafonnés ; toute autre valeur est ignorée', async () => {
    const { nettoyerSlugs, PLAFOND_PANIER } = await import('@/lib/panier/regles')
    expect(nettoyerSlugs(['a', ' b ', 'a', '', '  ', 'a b', 3, null, { id: 'x' }, 'c'])).toEqual(['a', 'b', 'c'])
    expect(nettoyerSlugs('a')).toEqual([])
    expect(nettoyerSlugs(undefined)).toEqual([])
    expect(nettoyerSlugs(['x'.repeat(500)])).toEqual([])
    const beaucoup = Array.from({ length: PLAFOND_PANIER + 15 }, (_, i) => `o${i}`)
    expect(nettoyerSlugs(beaucoup)).toHaveLength(PLAFOND_PANIER)
    // Ancien stockage (objets avec prix) : aucun identifiant n'en est tiré.
    expect(nettoyerSlugs([{ id: 'o1', price: 1200 }])).toEqual([])
  })
})

describe('sommerPrixLivres (livraison, seul endroit des sommes)', () => {
  const livre = (total: number, frais: number, min: number, max: number, devise = 'EUR') =>
    ({ livree: true, totalCentimes: total, fraisCentimes: frais, devise, delaiMinJours: min, delaiMaxJours: max }) as const

  it('additionne prix, frais et total ; délai du colis = plus long minimum et plus long maximum', async () => {
    const { sommerPrixLivres, prixSansFrais } = await import('@/lib/livraison/prix')
    const somme = sommerPrixLivres([livre(104000, 4000, 8, 12), livre(52000, 2000, 10, 14)])
    expect(somme).toEqual({
      livrees: 2,
      nonLivrees: 0,
      devise: 'EUR',
      prixCentimes: 150000,
      fraisCentimes: 6000,
      totalCentimes: 156000,
      delaiMinJours: 10,
      delaiMaxJours: 14,
    })
    expect(prixSansFrais(livre(104000, 4000, 8, 12))).toBe(100000)
    expect(prixSansFrais({ livree: false, raison: 'non_livree' })).toBeNull()
  })

  it('œuvre non livrée : comptée à part, jamais additionnée ; devises mêlées : devise nulle', async () => {
    const { sommerPrixLivres } = await import('@/lib/livraison/prix')
    const a = sommerPrixLivres([livre(1000, 100, 1, 2), { livree: false, raison: 'pas_de_zone' }, undefined])
    expect(a).toMatchObject({ livrees: 1, nonLivrees: 2, totalCentimes: 1000, devise: 'EUR' })
    expect(sommerPrixLivres([livre(1000, 100, 1, 2), livre(500, 50, 1, 2, 'USD')]).devise).toBeNull()
    expect(sommerPrixLivres([])).toMatchObject({ livrees: 0, nonLivrees: 0, totalCentimes: 0, devise: null, delaiMinJours: 0 })
  })
})

describe('base : composerPanier et recalculerPanier', () => {
  let base: BaseJetable
  let db: Client

  async function oeuvre(slug: string, options: { artiste?: string; dispo?: string; publication?: string; frais?: number | null; prix?: number | null } = {}) {
    const { artiste = 'art-a', dispo = 'disponible', publication = 'publiee', frais = 4000, prix = 100000 } = options
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", devise,
         publication, disponibilite, "artistId", "updatedAt")
       VALUES ($1, $1, $2, 2024, 'Huile', 'D', 'https://res.cloudinary.com/x/p.jpg', $3, 'EUR', $4::"Publication", $5::"Disponibilite", $6, now())`,
      [slug, `Titre ${slug}`, prix, publication, dispo, artiste],
    )
    if (frais !== null) {
      await db.query(
        `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", livree, "fraisCentimes", "preparationJours", "transportMinJours", "transportMaxJours", devise, "updatedAt")
         VALUES (gen_random_uuid()::text, $1, 'zone-ue', true, $2, 3, 5, 9, 'EUR', now())`,
        [slug, frais],
      )
    }
  }

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
    cookie.pays = undefined
    for (const table of ['OffreLivraison', 'ZonePays', 'Zone', 'Artwork', 'Artist']) await db.query(`DELETE FROM "${table}"`)
    for (const id of ['art-a', 'art-b']) {
      await db.query(
        `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "accordSigneLe", "updatedAt")
         VALUES ($1, $1, $1, 'MA', 1980, 'Bio', '', now(), now())`,
        [id],
      )
    }
    await db.query(`INSERT INTO "Zone" (id, nom, "updatedAt") VALUES ('zone-ue', 'Union européenne', now())`)
    await db.query(`INSERT INTO "ZonePays" ("codePays", "zoneId") VALUES ('FR', 'zone-ue')`)
  })

  it('deux artistes : une carte numérotée par artiste, sommes de livraison, total général', async () => {
    await oeuvre('o1', { artiste: 'art-a', prix: 100000, frais: 4000 })
    await oeuvre('o2', { artiste: 'art-b', prix: 50000, frais: 2000 })
    await oeuvre('o3', { artiste: 'art-a', prix: 20000, frais: 1000 })
    const { composerPanier } = await import('@/lib/panier')
    const panier = await composerPanier(['o1', 'o2', 'o3', 'o1'], 'FR')

    expect(panier.pays).toEqual({ code: 'FR', nom: 'France' })
    expect(panier.commandes.map((c) => [c.numero, c.artiste.slug, c.lignes.map((l) => l.slug)])).toEqual([
      [1, 'art-a', ['o1', 'o3']],
      [2, 'art-b', ['o2']],
    ])
    const [a, b] = panier.commandes
    expect(a.somme).toMatchObject({ livrees: 2, prixCentimes: 120000, fraisCentimes: 5000, totalCentimes: 125000, delaiMinJours: 8, delaiMaxJours: 12 })
    expect(b.somme).toMatchObject({ totalCentimes: 52000, devise: 'EUR' })
    expect(a.lignes[0]).toMatchObject({ prixOeuvreCentimes: 100000, titre: 'Titre o1' })
    expect(panier.total).toMatchObject({ livrees: 3, nonLivrees: 0, totalCentimes: 177000 })
    expect(panier.indisponibles).toEqual([])
  })

  it('les montants viennent de la base, jamais du navigateur : un prix changé est relu', async () => {
    await oeuvre('o1', { prix: 100000, frais: 4000 })
    const { composerPanier } = await import('@/lib/panier')
    expect((await composerPanier(['o1'], 'FR')).total.totalCentimes).toBe(104000)
    await db.query(`UPDATE "Artwork" SET "prixCentimes" = 90000 WHERE slug = 'o1'`)
    await db.query(`UPDATE "OffreLivraison" SET "fraisCentimes" = 0`)
    expect((await composerPanier(['o1'], 'FR')).total.totalCentimes).toBe(90000)
  })

  it('autre pays : tout est recalculé ; pays non livré : ligne non livrée, hors du total', async () => {
    await oeuvre('o1')
    await oeuvre('o2', { artiste: 'art-b', prix: 50000, frais: 2000 })
    await db.query(`INSERT INTO "Zone" (id, nom, "updatedAt") VALUES ('zone-us', 'Amérique du Nord', now())`)
    await db.query(`INSERT INTO "ZonePays" ("codePays", "zoneId") VALUES ('US', 'zone-us')`)
    await db.query(
      `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", livree, "fraisCentimes", "preparationJours", "transportMinJours", "transportMaxJours", devise, "updatedAt")
       VALUES (gen_random_uuid()::text, 'o1', 'zone-us', true, 30000, 3, 10, 15, 'EUR', now())`,
    )
    const { composerPanier } = await import('@/lib/panier')
    const us = await composerPanier(['o1', 'o2'], 'US')
    expect(us.pays.code).toBe('US')
    const carteA = us.commandes.find((c) => c.artiste.slug === 'art-a')!
    const carteB = us.commandes.find((c) => c.artiste.slug === 'art-b')!
    expect(carteA.somme).toMatchObject({ totalCentimes: 130000, delaiMinJours: 13 })
    expect(carteB.lignes[0].prixLivre).toEqual({ livree: false, raison: 'non_livree' })
    expect(carteB.somme).toMatchObject({ livrees: 0, nonLivrees: 1, totalCentimes: 0 })
    expect(us.total).toMatchObject({ livrees: 1, nonLivrees: 1, totalCentimes: 130000 })
    const fr = await composerPanier(['o1', 'o2'], 'FR')
    expect(fr.total.totalCentimes).toBe(156000)
  })

  it('œuvre indisponible : vendue, réservée, vendue ailleurs, retirée, non visible ou inconnue ; les autres commandes restent intactes', async () => {
    await oeuvre('bonne', { artiste: 'art-b', prix: 50000, frais: 2000 })
    await oeuvre('vendue', { dispo: 'vendue' })
    await oeuvre('reservee', { dispo: 'reservee' })
    await oeuvre('ailleurs', { dispo: 'vendue_ailleurs' })
    await oeuvre('retiree', { dispo: 'retiree' })
    await oeuvre('brouillon', { publication: 'brouillon' })
    await oeuvre('sans-prix', { prix: null, frais: null })
    // Œuvres proches du même artiste : quatre disponibles, trois seulement proposées, hors panier.
    for (const s of ['p1', 'p2', 'p3', 'p4']) await oeuvre(s, { artiste: 'art-a' })
    const { composerPanier } = await import('@/lib/panier')
    const panier = await composerPanier(['vendue', 'bonne', 'reservee', 'ailleurs', 'retiree', 'brouillon', 'sans-prix', 'inconnue', 'p1'], 'FR')

    expect(panier.commandes.map((c) => c.artiste.slug).sort()).toEqual(['art-a', 'art-b'])
    expect(panier.commandes.find((c) => c.artiste.slug === 'art-b')!.somme.totalCentimes).toBe(52000)
    expect(panier.commandes.find((c) => c.artiste.slug === 'art-a')!.lignes.map((l) => l.slug)).toEqual(['p1'])
    expect(panier.indisponibles.map((l) => l.slug)).toEqual(['vendue', 'reservee', 'ailleurs', 'retiree', 'brouillon', 'sans-prix', 'inconnue'])

    const ligne = (slug: string) => panier.indisponibles.find((l) => l.slug === slug)!
    const vendue = ligne('vendue')
    expect(vendue).toMatchObject({ titre: 'Titre vendue', artisteSlug: 'art-a' })
    expect(vendue.proches).toHaveLength(3)
    expect(vendue.proches.map((o) => o.id)).not.toContain('p1')
    expect(vendue.proches.every((o) => !o.sold && o.prixLivre?.livree)).toBe(true)
    // Les œuvres proches ne sont montrées qu'une fois par artiste (sous la première ligne de cet artiste).
    for (const slug of ['reservee', 'ailleurs', 'retiree', 'brouillon', 'sans-prix']) expect(ligne(slug).proches, slug).toEqual([])
    // Retirée : le titre n'est plus public, l'artiste l'est encore ; brouillon : titre masqué ; inconnue : rien.
    expect(ligne('retiree')).toMatchObject({ titre: null, artisteSlug: 'art-a' })
    expect(ligne('brouillon')).toMatchObject({ titre: null })
    expect(JSON.stringify(panier)).not.toContain('Titre brouillon')
    expect(ligne('inconnue')).toMatchObject({ titre: null, artisteSlug: null, proches: [] })
  })

  it('œuvre retirée seule : ses trois œuvres proches viennent de son artiste', async () => {
    await oeuvre('retiree', { dispo: 'retiree' })
    for (const s of ['p1', 'p2', 'p3', 'p4']) await oeuvre(s, { artiste: 'art-a' })
    const { composerPanier } = await import('@/lib/panier')
    const panier = await composerPanier(['retiree'], 'FR')
    expect(panier.commandes).toEqual([])
    expect(panier.indisponibles).toHaveLength(1)
    expect(panier.indisponibles[0]).toMatchObject({ slug: 'retiree', titre: null, artisteSlug: 'art-a' })
    expect(panier.indisponibles[0].proches).toHaveLength(3)
  })

  it('une seule lecture des œuvres de l’artiste, même avec plusieurs œuvres indisponibles du même artiste', async () => {
    await oeuvre('v1', { dispo: 'vendue' })
    await oeuvre('v2', { dispo: 'vendue' })
    await oeuvre('p1', { artiste: 'art-a' })
    const catalogue = await import('@/lib/catalogue')
    const lecture = vi.spyOn(catalogue, 'getArtistArtworksBySlug')
    const { composerPanier } = await import('@/lib/panier')
    const panier = await composerPanier(['v1', 'v2'], 'FR')
    expect(lecture).toHaveBeenCalledTimes(1)
    expect(panier.indisponibles.map((l) => l.proches.length)).toEqual([1, 0])
    lecture.mockRestore()
  })

  it('plafond : seules les 20 premières œuvres sont composées, même toutes livrées', async () => {
    const { composerPanier, PLAFOND_PANIER } = await import('@/lib/panier')
    const slugs = Array.from({ length: PLAFOND_PANIER + 5 }, (_, i) => `l${i}`)
    for (const s of slugs) await oeuvre(s, { prix: 10000, frais: 1000 })
    const panier = await composerPanier(slugs, 'FR')
    expect(panier.commandes.flatMap((c) => c.lignes)).toHaveLength(PLAFOND_PANIER)
    expect(panier.total).toMatchObject({ livrees: PLAFOND_PANIER, totalCentimes: PLAFOND_PANIER * 11000 })
  })

  it('panier vide, valeurs invalides et plafond : jamais d’erreur', async () => {
    const { composerPanier, PLAFOND_PANIER } = await import('@/lib/panier')
    for (const entree of [[], undefined, null, 'o1', [{ id: 'o1', price: 5 }]]) {
      const p = await composerPanier(entree, 'FR')
      expect(p.commandes).toEqual([])
      expect(p.indisponibles).toEqual([])
      expect(p.total.livrees).toBe(0)
    }
    const beaucoup = Array.from({ length: PLAFOND_PANIER + 10 }, (_, i) => `x${i}`)
    expect((await composerPanier(beaucoup, 'FR')).indisponibles).toHaveLength(PLAFOND_PANIER)
  })

  it('action recalculerPanier : pays lu dans le cookie, jamais dans la saisie ; erreur de base : { ok: false }', async () => {
    await oeuvre('o1')
    const { recalculerPanier } = await import('@/app/panier/actions')
    const r = await recalculerPanier(['o1'])
    expect(r.ok && r.panier.pays.code).toBe('FR')
    cookie.pays = 'zz'
    const invalide = await recalculerPanier(['o1'])
    expect(invalide.ok && invalide.panier.pays.code).toBe('FR')
    cookie.pays = 'US'
    const us = await recalculerPanier(['o1'])
    expect(us.ok && us.panier.pays.code).toBe('US')
    expect(us.ok && us.panier.total.livrees).toBe(0)

    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {})
    const catalogue = await import('@/lib/catalogue')
    const lecture = vi.spyOn(catalogue, 'getArtworkBySlug').mockRejectedValueOnce(new Error('base injoignable'))
    expect(await recalculerPanier(['o1'])).toEqual({ ok: false })
    expect(erreur).toHaveBeenCalledWith('panier_recalcul_echoue', 'Error')
    expect(JSON.stringify(erreur.mock.calls)).not.toContain('o1')
    lecture.mockRestore()
    erreur.mockRestore()
  })
})
