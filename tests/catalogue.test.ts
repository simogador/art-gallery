import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  champsDimensions,
  champsDimensionsModifiees,
  champsPrix,
  centimesEnEuros,
  formaterDimensions,
  lireDimensions,
  prixEnCentimes,
} from '@/lib/catalogue/conversions'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 2.1 (AD-5, AD-20) : prix en centimes, dimensions en millimètres.

const UTILISATEUR = 'artiste-utilisateur'
// Story 3.4 : unstable_cache en passe-plat (pas de cache dans les tests), revalidateTag espionné.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: UTILISATEUR, role: 'artist' } })) }))
const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as Record<string, unknown> }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => acteur.courant }))

// Textes de dimensions saisis dans l'ancien formulaire d'édition (« h × l (× p) cm|mm »).
const DIMENSIONS_ECHANTILLON = [
  '120 × 90 cm',
  '294.6 × 232,1 cm',
  '45 x 30 x 28 cm',
  '800×600 mm',
  '60 X 80 cm',
  '  70 ×  50   cm  ',
  '70\u00a0×\u00a050\u00a0cm',
  '1,15 × 1,14 cm',
  '10,05 × 2,5 mm',
  '0,04 × 10 cm',
  '0 × 10 cm',
  'Impression 80 × 80 cm',
  '120 cm',
  'variable',
  '',
  'environ 1 m',
  '11 × 7.9 × 23 m',
  '120 × 90 CM',
  '120 × 90',
  '120 × 90 × 10 × 5 cm',
  '1 200 × 900 mm',
  '120 ×× 90 cm',
  '-120 × 90 cm',
  '1234567 × 1 cm',
]

describe('prixEnCentimes', () => {
  it('convertit sans Float, virgule ou point, espaces ignorés', () => {
    expect(prixEnCentimes(12400)).toEqual({ ok: true, centimes: 1240000 })
    expect(prixEnCentimes('1 250,50')).toEqual({ ok: true, centimes: 125050 })
    expect(prixEnCentimes('1\u202f250,5')).toEqual({ ok: true, centimes: 125050 })
    expect(prixEnCentimes('0.29')).toEqual({ ok: true, centimes: 29 })
    expect(prixEnCentimes(1250.5)).toEqual({ ok: true, centimes: 125050 })
    expect(prixEnCentimes('19.99')).toEqual({ ok: true, centimes: 1999 })
  })

  it('traite l’absence de prix, ou un prix nul, comme vide', () => {
    expect(prixEnCentimes('0')).toEqual({ ok: true, centimes: null })
    expect(prixEnCentimes('0,00')).toEqual({ ok: true, centimes: null })
    expect(prixEnCentimes(0)).toEqual({ ok: true, centimes: null })
    expect(prixEnCentimes(null)).toEqual({ ok: true, centimes: null })
    expect(prixEnCentimes(undefined)).toEqual({ ok: true, centimes: null })
    expect(prixEnCentimes('  ')).toEqual({ ok: true, centimes: null })
  })

  it.each(['-5', '-0,01', 'abc', '12,345', '1.250,50', '1e3', '21474836,48', -5, Number.NaN, true, {}])(
    'refuse « %s »',
    (saisie) => {
      expect(prixEnCentimes(saisie)).toEqual({ ok: false })
    },
  )

  it('revient en euros pour l’affichage', () => {
    expect(centimesEnEuros(125050)).toBe(1250.5)
    expect(centimesEnEuros(null)).toBeNull()
  })
})

describe('lireDimensions', () => {
  it.each([
    ['120 × 90 cm', { hauteurMm: 1200, largeurMm: 900, profondeurMm: null }],
    ['294.6 × 232,1 cm', { hauteurMm: 2946, largeurMm: 2321, profondeurMm: null }],
    ['45 x 30 x 28 cm', { hauteurMm: 450, largeurMm: 300, profondeurMm: 280 }],
    ['800×600 mm', { hauteurMm: 800, largeurMm: 600, profondeurMm: null }],
    ['60 X 80 cm', { hauteurMm: 600, largeurMm: 800, profondeurMm: null }],
    ['1,15 × 1,14 cm', { hauteurMm: 12, largeurMm: 11, profondeurMm: null }],
    ['10,05 × 2,5 mm', { hauteurMm: 10, largeurMm: 3, profondeurMm: null }],
  ])('lit « %s »', (texte, attendu) => {
    expect(lireDimensions(texte)).toEqual(attendu)
  })

  it.each(['Impression 80 × 80 cm', '120 cm', 'variable', '', 'environ 1 m', '120 × 90', '0,04 × 10 cm', '120 × 90 CM'])(
    'ne devine jamais « %s »',
    (texte) => {
      expect(lireDimensions(texte)).toBeNull()
    },
  )

  it('formate en centimètres et se relit à l’identique', () => {
    // Story 3.2 : espaces fines insécables (U+202F) autour de « × » et avant l'unité.
    expect(formaterDimensions({ hauteurMm: 2946, largeurMm: 2321, profondeurMm: null })).toBe('294,6\u202f×\u202f232,1\u202fcm')
    expect(formaterDimensions({ hauteurMm: 450, largeurMm: 300, profondeurMm: 280 })).toBe('45\u202f×\u202f30\u202f×\u202f28\u202fcm')
    expect(formaterDimensions({ hauteurMm: null, largeurMm: 300, profondeurMm: null })).toBe('')
    for (const texte of DIMENSIONS_ECHANTILLON) {
      const d = lireDimensions(texte)
      if (d) expect(lireDimensions(formaterDimensions(d))).toEqual(d)
    }
  })
})

describe('saisie du formulaire (colonnes exactes seulement, story 2.10)', () => {
  it('n’écrit que les centimes et les millimètres', () => {
    expect(champsPrix('1 250,50')).toEqual({ ok: true, champs: { prixCentimes: 125050, devise: 'EUR' } })
    expect(champsDimensions('60 × 80 cm')).toEqual({
      ok: true,
      champs: { hauteurMm: 600, largeurMm: 800, profondeurMm: null },
    })
    expect(champsDimensions('')).toEqual({
      ok: true,
      champs: { hauteurMm: null, largeurMm: null, profondeurMm: null },
    })
  })

  it('à l’édition, le texte prérempli renvoyé tel quel ne change aucune colonne', () => {
    const partielle = { hauteurMm: 600, largeurMm: null, profondeurMm: null }
    expect(champsDimensionsModifiees('', partielle)).toEqual({ ok: true, champs: {} })
    const complete = { hauteurMm: 600, largeurMm: 805, profondeurMm: null }
    expect(champsDimensionsModifiees(' 60 × 80,5 cm ', complete)).toEqual({ ok: true, champs: {} })
    // Story 3.2 : le texte prérempli (espaces fines) renvoyé tel quel, aux espaces près.
    expect(champsDimensionsModifiees('60\u202f×\u202f80,5\u202fcm', complete)).toEqual({ ok: true, champs: {} })
    expect(champsDimensionsModifiees('70 × 80 cm', complete)).toEqual({
      ok: true,
      champs: { hauteurMm: 700, largeurMm: 800, profondeurMm: null },
    })
    expect(champsDimensionsModifiees('', complete)).toEqual({
      ok: true,
      champs: { hauteurMm: null, largeurMm: null, profondeurMm: null },
    })
    expect(champsDimensionsModifiees('environ 1 m', partielle).ok).toBe(false)
  })

  it('refuse une saisie illisible avec un message en français et un exemple', () => {
    const refus = champsDimensions('environ 1 m')
    expect(refus.ok).toBe(false)
    if (!refus.ok) expect(refus.erreur).toContain('« 120 × 80 cm »')
    expect(champsPrix('abc').ok).toBe(false)
  })
})

describe('base : lectures et écritures', () => {
  let base: BaseJetable
  let db: Client

  // Œuvre publiée et disponible, prix et dimensions exacts facultatifs.
  async function oeuvre(
    slug: string,
    { prixCentimes = null, hauteurMm = null, largeurMm = null, disponibilite = 'disponible' }:
      { prixCentimes?: number | null; hauteurMm?: number | null; largeurMm?: number | null; disponibilite?: string } = {},
  ) {
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", "hauteurMm", "largeurMm",
                              publication, disponibilite, "artistId", "updatedAt")
       VALUES ($1, $1, $2, 2020, 'Huile sur toile', 'Description', '', $3, $4, $5, 'publiee', $6::"Disponibilite", 'artiste-1', now())`,
      [slug, `Titre ${slug}`, prixCentimes, hauteurMm, largeurMm, disponibilite],
    )
  }
  const colonnes = async (slug: string) =>
    (
      await db.query(
        `SELECT "prixCentimes", devise, "hauteurMm", "largeurMm", "profondeurMm" FROM "Artwork" WHERE slug = $1`,
        [slug],
      )
    ).rows[0]

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
      // Accord signé (story 2.9) : sans lui, aucune œuvre de l'artiste n'est visible.
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt", "userId", "accordSigneLe")
       VALUES ('artiste-1', 'artiste-1', 'Artiste Un', 'FR', 1980, 'Bio', '', now(), $1, '2026-11-01')`,
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
    await db.query('DELETE FROM "Artwork"')
  })

  it('les anciennes colonnes price, dimensions et available n’existent plus (story 2.10)', async () => {
    const { rows } = await db.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'Artwork' AND column_name IN ('price', 'dimensions', 'available')`,
    )
    expect(rows).toEqual([])
  })

  it('le catalogue lit les colonnes exactes', async () => {
    await oeuvre('exacte', { prixCentimes: 125050, hauteurMm: 600, largeurMm: 800 })
    await oeuvre('sans-dimensions')

    const { getArtworkBySlug, getAllArtworks } = await import('@/lib/catalogue')
    // Story 3.2 : le type d'affichage porte les millimètres, mis en forme dans l'unité choisie.
    expect(await getArtworkBySlug('exacte')).toMatchObject({ price: 1250.5, hauteurMm: 600, largeurMm: 800, profondeurMm: null })
    // Sans millimètres : aucune taille affichée ; prix absent affiché comme aujourd'hui (0).
    expect(await getArtworkBySlug('sans-dimensions')).toMatchObject({ price: 0, hauteurMm: null, largeurMm: null })
    expect((await getAllArtworks()).map((w) => w.id).sort()).toEqual(['exacte', 'sans-dimensions'])
  })

  it('l’espace artiste lit les colonnes exactes et somme les centimes exactement', async () => {
    await oeuvre('vendue-1', { prixCentimes: 10, hauteurMm: 100, largeurMm: 100, disponibilite: 'vendue' })
    await oeuvre('vendue-2', { prixCentimes: 20, disponibilite: 'vendue' })

    const { accueilArtiste, oeuvresDeLArtiste, oeuvreAEditer } = await import('@/lib/catalogue')
    expect((await accueilArtiste(UTILISATEUR))?.chiffreAffairesCentimes).toBe(30)
    const lues = await oeuvresDeLArtiste(UTILISATEUR)
    expect(lues?.oeuvres.find((o) => o.slug === 'vendue-1')).toMatchObject({ prix: 0.1, hauteurMm: 100, largeurMm: 100, profondeurMm: null })
    // Édition : dimensions exactes formatées ; sans millimètres, champ vide (story 2.10).
    expect(await oeuvreAEditer(UTILISATEUR, 'vendue-1')).toMatchObject({ dimensions: '10\u202f×\u202f10\u202fcm', hauteurMm: 100, largeurMm: 100, price: 0.1 })
    expect(await oeuvreAEditer(UTILISATEUR, 'vendue-2')).toMatchObject({ dimensions: '', price: 0.2 })
    expect(await oeuvreAEditer('quelqu-un-d-autre', 'vendue-1')).toBeNull()
  })

  it('le formulaire d’édition laisse le prix vide sans centimes', async () => {
    await oeuvre('sans-prix')
    const { oeuvreAEditer } = await import('@/lib/catalogue')
    expect(await oeuvreAEditer(UTILISATEUR, 'sans-prix')).toMatchObject({ price: null, dimensions: '' })
  })

  describe('routes d’écriture', () => {
    const requete = (url: string, method: string, corps: unknown) =>
      new Request(`http://localhost${url}`, { method, body: JSON.stringify(corps) }) as never
    const parametres = (slug: string) => ({ params: Promise.resolve({ slug }) })
    const saisie = { title: 'Nouvelle', year: '2024', technique: 'Huile', description: '' }

    it('le dépôt par l’artiste écrit centimes et millimètres (story 2.5)', async () => {
      const artiste = { type: 'artist', userId: UTILISATEUR, artiste: { id: 'artiste-1', slug: 'artiste-1', name: 'Artiste Un' } }
      const { enregistrerChamp } = await import('@/lib/curation')
      const cree = await enregistrerChamp(artiste as never, null, 'prix', '1 250,50')
      if (!cree.ok) throw new Error(cree.code)
      const slug = cree.depot.slug
      expect((await enregistrerChamp(artiste as never, slug, 'hauteur', '60')).ok).toBe(true)
      expect(await colonnes(slug)).toEqual({ prixCentimes: 125050, devise: 'EUR', hauteurMm: 600, largeurMm: null, profondeurMm: null })
      expect((await enregistrerChamp(artiste as never, slug, 'largeur', '80')).ok).toBe(true)
      expect(await colonnes(slug)).toEqual({ prixCentimes: 125050, devise: 'EUR', hauteurMm: 600, largeurMm: 800, profondeurMm: null })
    })

    it.each([
      ['prix', '-5', 'Prix invalide'],
      ['prix', 'abc', 'Prix invalide'],
      ['prix', '10,123', 'Prix invalide'],
      ['hauteur', 'environ 1 m', 'centimètres'],
    ] as const)('refuse le champ %s « %s » sans créer de brouillon', async (champ, valeur, message) => {
      const artiste = { type: 'artist', userId: UTILISATEUR, artiste: { id: 'artiste-1', slug: 'artiste-1', name: 'Artiste Un' } }
      const { enregistrerChamp } = await import('@/lib/curation')
      const refus = await enregistrerChamp(artiste as never, null, champ, valeur)
      expect(refus).toMatchObject({ ok: false, code: 'valeur_invalide' })
      expect(refus.ok ? '' : refus.erreur).toContain(message)
      expect((await db.query('SELECT count(*)::int AS n FROM "Artwork"')).rows[0].n).toBe(0)
    })

    it('la modification par l’artiste écrit centimes et millimètres, ou refuse sans rien changer', async () => {
      acteur.courant = { type: 'artist', userId: UTILISATEUR, artiste: { id: 'artiste-1', slug: 'artiste-1', name: 'Artiste Un' } }
      await oeuvre('a-modifier', { prixCentimes: 1000 })
      const { PUT } = await import('@/app/api/artiste/oeuvres/[slug]/route')

      const refus = await PUT(requete('/api/artiste/oeuvres/a-modifier', 'PUT', { ...saisie, price: '10', dimensions: 'environ 1 m' }), parametres('a-modifier'))
      expect(refus.status).toBe(400)
      expect(await colonnes('a-modifier')).toMatchObject({ prixCentimes: 1000, hauteurMm: null })

      const ok = await PUT(requete('/api/artiste/oeuvres/a-modifier', 'PUT', { ...saisie, price: '99,9', dimensions: '45 x 30 x 28 cm' }), parametres('a-modifier'))
      expect(ok.status).toBe(200)
      expect(await colonnes('a-modifier')).toEqual({ prixCentimes: 9990, devise: 'EUR', hauteurMm: 450, largeurMm: 300, profondeurMm: 280 })

      // Champ de dimensions vide alors que l’œuvre a des millimètres : la modification passe, dimensions vidées.
      const vide = await PUT(requete('/x', 'PUT', { ...saisie, title: 'Renommée', price: '10', dimensions: '' }), parametres('a-modifier'))
      expect(vide.status).toBe(200)
      expect(await colonnes('a-modifier')).toMatchObject({ prixCentimes: 1000, hauteurMm: null, largeurMm: null, profondeurMm: null })
    })

    it('la modification par l’admin écrit centimes et millimètres, ou refuse en 400', async () => {
      acteur.courant = { type: 'admin', userId: 'admin' }
      await oeuvre('admin-modifie', { prixCentimes: 1000, hauteurMm: 100, largeurMm: 100 })
      const { PUT } = await import('@/app/api/admin/oeuvres/[slug]/route')

      expect((await PUT(requete('/x', 'PUT', { dimensions: '120 cm' }), parametres('admin-modifie'))).status).toBe(400)
      expect((await PUT(requete('/x', 'PUT', { price: '-5' }), parametres('admin-modifie'))).status).toBe(400)
      expect(await colonnes('admin-modifie')).toMatchObject({ prixCentimes: 1000, hauteurMm: 100 })

      const ok = await PUT(requete('/x', 'PUT', { price: '1 250,50', dimensions: '800×600 mm' }), parametres('admin-modifie'))
      expect(ok.status).toBe(200)
      expect(await colonnes('admin-modifie')).toMatchObject({ prixCentimes: 125050, hauteurMm: 800, largeurMm: 600 })

      // Prix effacé : centimes vidés.
      await PUT(requete('/x', 'PUT', { price: '' }), parametres('admin-modifie'))
      expect(await colonnes('admin-modifie')).toMatchObject({ prixCentimes: null })
      // Œuvre inconnue : 404.
      expect((await PUT(requete('/x', 'PUT', { dimensions: '10 × 10 cm' }), parametres('inconnue'))).status).toBe(404)
    })
  })
})
