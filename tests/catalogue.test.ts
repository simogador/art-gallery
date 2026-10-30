import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  champsDimensions,
  champsPrix,
  centimesEnEuros,
  formaterDimensions,
  lireDimensions,
  MOTIF_DIMENSIONS,
  prixEnCentimes,
} from '@/lib/catalogue/conversions'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 2.1 (AD-5, AD-20) : prix en centimes, dimensions en millimètres.

const UTILISATEUR = 'artiste-utilisateur'
vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: UTILISATEUR, role: 'artist' } })) }))
const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as Record<string, unknown> }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => acteur.courant }))

const SQL_RECOPIE = readFileSync(path.resolve('scripts/sql/recopie-prix-dimensions.sql'), 'utf8')
const SQL_ILLISIBLES = readFileSync(path.resolve('scripts/sql/dimensions-illisibles.sql'), 'utf8')
const SQL_PRIX_NON_RECOPIES = readFileSync(path.resolve('scripts/sql/prix-non-recopies.sql'), 'utf8')
const SQL_ECARTS = readFileSync(path.resolve('scripts/sql/ecarts-prix-dimensions.sql'), 'utf8')
// Story 2.2 : le catalogue ne lit que des œuvres publiées ; base migrée et recopiée.
const SQL_RECOPIE_ETATS = readFileSync(path.resolve('scripts/sql/recopie-publication-disponibilite.sql'), 'utf8')

// Textes de dimensions communs au test TypeScript et au test SQL : les deux lectures doivent s'accorder.
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
    expect(formaterDimensions({ hauteurMm: 2946, largeurMm: 2321, profondeurMm: null })).toBe('294,6 × 232,1 cm')
    expect(formaterDimensions({ hauteurMm: 450, largeurMm: 300, profondeurMm: 280 })).toBe('45 × 30 × 28 cm')
    expect(formaterDimensions({ hauteurMm: null, largeurMm: 300, profondeurMm: null })).toBe('')
    for (const texte of DIMENSIONS_ECHANTILLON) {
      const d = lireDimensions(texte)
      if (d) expect(lireDimensions(formaterDimensions(d))).toEqual(d)
    }
  })
})

describe('saisie du formulaire (double écriture)', () => {
  it('écrit anciennes et nouvelles colonnes, cohérentes', () => {
    expect(champsPrix('1 250,50')).toEqual({ ok: true, champs: { price: 1250.5, prixCentimes: 125050, devise: 'EUR' } })
    expect(champsDimensions('60 × 80 cm')).toEqual({
      ok: true,
      champs: { dimensions: '60 × 80 cm', hauteurMm: 600, largeurMm: 800, profondeurMm: null },
    })
    expect(champsDimensions('')).toEqual({
      ok: true,
      champs: { dimensions: '', hauteurMm: null, largeurMm: null, profondeurMm: null },
    })
  })

  it('refuse une saisie illisible avec un message en français et un exemple', () => {
    const refus = champsDimensions('environ 1 m')
    expect(refus.ok).toBe(false)
    if (!refus.ok) expect(refus.erreur).toContain('« 120 × 80 cm »')
    expect(champsPrix('abc').ok).toBe(false)
  })
})

describe('base : recopie, lectures et écritures', () => {
  let base: BaseJetable
  let db: Client

  // Insertion par l'ancien code : sans aucune des nouvelles colonnes.
  async function ancienneOeuvre(slug: string, dimensions: string, price: number | null, available = true) {
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, dimensions, description, "imageUrl", price, available, "artistId", "updatedAt")
       VALUES ($1, $1, $2, 2020, 'Huile sur toile', $3, 'Description', '', $4, $5, 'artiste-1', now())`,
      [slug, `Titre ${slug}`, dimensions, price, available],
    )
  }
  const colonnes = async (slug: string) =>
    (
      await db.query(
        `SELECT price, dimensions, "prixCentimes", devise, "hauteurMm", "largeurMm", "profondeurMm" FROM "Artwork" WHERE slug = $1`,
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
    await db.query('DELETE FROM "Artwork"')
  })

  it('le script SQL emploie exactement le motif de lireDimensions', () => {
    expect(SQL_RECOPIE).toContain(`'${MOTIF_DIMENSIONS}'`)
  })

  it('recopie prix et dimensions, deux fois sans changement, et liste les illisibles', async () => {
    for (const [i, texte] of DIMENSIONS_ECHANTILLON.entries()) {
      await ancienneOeuvre(`oeuvre-${String(i).padStart(2, '0')}`, texte, i === 0 ? 12400 : i === 1 ? null : 1250.5)
    }
    await ancienneOeuvre('trop-chere', '100 × 100 cm', 110_500_000)
    await ancienneOeuvre('prix-nul', '100 × 100 cm', 0)
    await ancienneOeuvre('trois-decimales', '100 × 100 cm', 12.345)
    await ancienneOeuvre('minuscule', '100 × 100 cm', 0.001)

    await db.query(SQL_RECOPIE)
    const premier = (await db.query('SELECT * FROM "Artwork" ORDER BY slug')).rows
    await db.query(SQL_RECOPIE)
    const second = (await db.query('SELECT * FROM "Artwork" ORDER BY slug')).rows
    expect(second).toEqual(premier)

    // Accord avec lireDimensions, ligne par ligne.
    for (const [i, texte] of DIMENSIONS_ECHANTILLON.entries()) {
      const ligne = await colonnes(`oeuvre-${String(i).padStart(2, '0')}`)
      const attendu = lireDimensions(texte)
      expect(
        { hauteurMm: ligne.hauteurMm, largeurMm: ligne.largeurMm, profondeurMm: ligne.profondeurMm },
        texte,
      ).toEqual(attendu ?? { hauteurMm: null, largeurMm: null, profondeurMm: null })
      expect(ligne.dimensions).toBe(texte)
    }

    expect(await colonnes('oeuvre-00')).toMatchObject({ price: 12400, prixCentimes: 1240000, devise: 'EUR' })
    expect(await colonnes('oeuvre-01')).toMatchObject({ price: null, prixCentimes: null })
    expect(await colonnes('oeuvre-02')).toMatchObject({ prixCentimes: 125050 })

    const illisibles = (await db.query(SQL_ILLISIBLES)).rows.map((r) => r.dimensions).sort()
    const attendus = DIMENSIONS_ECHANTILLON.filter((t) => !lireDimensions(t)).sort()
    expect(illisibles).toEqual(attendus)

    const prixNonRecopies = (await db.query(SQL_PRIX_NON_RECOPIES)).rows.map((r) => r.slug)
    // Jamais arrondi : plus de deux décimales ou moins d'un centime restent vides et listés.
    expect(prixNonRecopies).toEqual(['minuscule', 'prix-nul', 'trois-decimales', 'trop-chere'])
    expect(await colonnes('trois-decimales')).toMatchObject({ prixCentimes: null })
    expect(await colonnes('minuscule')).toMatchObject({ prixCentimes: null })

    // Juste après la recopie, aucun écart entre anciennes et nouvelles colonnes.
    expect((await db.query(SQL_ECARTS)).rows).toEqual([])
  })

  it('la requête d’écarts liste les œuvres modifiées par l’ancien code après la recopie', async () => {
    expect(SQL_ECARTS).toContain(`'${MOTIF_DIMENSIONS}'`)
    for (const slug of ['prix-change', 'prix-efface', 'dims-changees', 'dims-illisibles', 'intacte']) {
      await ancienneOeuvre(slug, '100 × 100 cm', 100)
    }
    await ancienneOeuvre('sans-prix', 'variable', null)
    await db.query(SQL_RECOPIE)

    // L'ancien code écrit price et dimensions, jamais les nouvelles colonnes.
    await db.query(`UPDATE "Artwork" SET price = 250 WHERE slug = 'prix-change'`)
    await db.query(`UPDATE "Artwork" SET price = NULL WHERE slug = 'prix-efface'`)
    await db.query(`UPDATE "Artwork" SET dimensions = '50 × 40 cm' WHERE slug = 'dims-changees'`)
    await db.query(`UPDATE "Artwork" SET dimensions = 'variable' WHERE slug = 'dims-illisibles'`)
    await db.query(`UPDATE "Artwork" SET price = 30 WHERE slug = 'sans-prix'`)

    const ecarts = async () => (await db.query(SQL_ECARTS)).rows.map((r) => r.slug)
    expect(await ecarts()).toEqual(['dims-changees', 'dims-illisibles', 'prix-change', 'prix-efface', 'sans-prix'])

    // Correction documentée : vider les nouvelles colonnes des œuvres listées, relancer la recopie.
    await db.query(
      `UPDATE "Artwork" SET "prixCentimes" = NULL, "hauteurMm" = NULL, "largeurMm" = NULL, "profondeurMm" = NULL
       WHERE slug = ANY($1)`,
      [await ecarts()],
    )
    await db.query(SQL_RECOPIE)
    expect(await ecarts()).toEqual([])
    expect(await colonnes('prix-change')).toMatchObject({ prixCentimes: 25000 })
    expect(await colonnes('dims-changees')).toMatchObject({ hauteurMm: 500, largeurMm: 400 })
  })

  it('n’écrase jamais une valeur déjà présente', async () => {
    await ancienneOeuvre('deja-saisie', 'Impression 80 × 80 cm', 100)
    await db.query(
      `UPDATE "Artwork" SET "prixCentimes" = 9999, "hauteurMm" = 800, "largeurMm" = 800 WHERE slug = 'deja-saisie'`,
    )
    await db.query(SQL_RECOPIE)
    expect(await colonnes('deja-saisie')).toMatchObject({ prixCentimes: 9999, hauteurMm: 800, largeurMm: 800, profondeurMm: null })
  })

  it('le catalogue lit les nouvelles colonnes, pas les anciennes', async () => {
    // Anciennes colonnes volontairement différentes : seule la lecture des nouvelles donne ces valeurs.
    await ancienneOeuvre('exacte', 'variable', 1)
    await db.query(
      `UPDATE "Artwork" SET "prixCentimes" = 125050, "hauteurMm" = 600, "largeurMm" = 800 WHERE slug = 'exacte'`,
    )
    await ancienneOeuvre('illisible', 'environ 1 m', 2)
    await db.query(SQL_RECOPIE_ETATS)

    const { getArtworkBySlug, getAllArtworks } = await import('@/lib/catalogue')
    expect(await getArtworkBySlug('exacte')).toMatchObject({ price: 1250.5, size: '60 × 80 cm' })
    // Illisible : aucune taille affichée ; prix absent affiché comme aujourd'hui (0).
    expect(await getArtworkBySlug('illisible')).toMatchObject({ price: 0, size: '' })
    expect((await getAllArtworks()).map((w) => w.id).sort()).toEqual(['exacte', 'illisible'])
  })

  it('l’espace artiste lit les nouvelles colonnes et somme les centimes exactement', async () => {
    await ancienneOeuvre('vendue-1', '10 × 10 cm', 1, false)
    await ancienneOeuvre('vendue-2', 'variable', 1, false)
    await db.query(`UPDATE "Artwork" SET "prixCentimes" = 10, "hauteurMm" = 100, "largeurMm" = 100 WHERE slug = 'vendue-1'`)
    await db.query(`UPDATE "Artwork" SET "prixCentimes" = 20 WHERE slug = 'vendue-2'`)
    await db.query(SQL_RECOPIE_ETATS)

    const { accueilArtiste, oeuvresDeLArtiste, oeuvreAEditer } = await import('@/lib/catalogue')
    expect((await accueilArtiste(UTILISATEUR))?.chiffreAffairesCentimes).toBe(30)
    const lues = await oeuvresDeLArtiste(UTILISATEUR)
    expect(lues?.oeuvres.find((o) => o.slug === 'vendue-1')).toMatchObject({ prix: 0.1, dimensions: '10 × 10 cm' })
    // Édition : dimensions exactes formatées, sinon l'ancien texte pour la saisie manuelle.
    expect(await oeuvreAEditer(UTILISATEUR, 'vendue-1')).toMatchObject({ dimensions: '10 × 10 cm', price: 0.1 })
    expect(await oeuvreAEditer(UTILISATEUR, 'vendue-2')).toMatchObject({ dimensions: 'variable', dimensionsLues: '' })
    expect(await oeuvreAEditer('quelqu-un-d-autre', 'vendue-1')).toBeNull()
  })

  it('le formulaire d’édition préremplit l’ancien prix tant qu’il n’est pas recopié', async () => {
    await ancienneOeuvre('non-recopiee', '10 × 10 cm', 110_500_000)
    const { oeuvreAEditer } = await import('@/lib/catalogue')
    expect(await oeuvreAEditer(UTILISATEUR, 'non-recopiee')).toMatchObject({ price: 110_500_000 })
  })

  describe('routes d’écriture', () => {
    const requete = (url: string, method: string, corps: unknown) =>
      new Request(`http://localhost${url}`, { method, body: JSON.stringify(corps) }) as never
    const parametres = (slug: string) => ({ params: Promise.resolve({ slug }) })
    const saisie = { title: 'Nouvelle', year: '2024', technique: 'Huile', description: '' }

    it('la création par l’artiste écrit anciennes et nouvelles colonnes', async () => {
      acteur.courant = { type: 'artist', userId: UTILISATEUR, artiste: { id: 'artiste-1', slug: 'artiste-1', name: 'Artiste Un' } }
      const { POST } = await import('@/app/api/artiste/oeuvres/route')
      const reponse = await POST(requete('/api/artiste/oeuvres', 'POST', { ...saisie, price: '1 250,50', dimensions: '60 × 80 cm' }))
      expect(reponse.status).toBe(201)
      const { slug } = await reponse.json()
      expect(await colonnes(slug)).toEqual({
        price: 1250.5, dimensions: '60 × 80 cm', prixCentimes: 125050, devise: 'EUR',
        hauteurMm: 600, largeurMm: 800, profondeurMm: null,
      })
    })

    it.each([
      [{ price: '1000', dimensions: 'environ 1 m' }, '« 120 × 80 cm »'],
      [{ price: '-5', dimensions: '60 × 80 cm' }, 'Prix invalide'],
      [{ price: 'abc', dimensions: '60 × 80 cm' }, 'Prix invalide'],
      [{ price: '10,123', dimensions: '60 × 80 cm' }, 'Prix invalide'],
    ])('refuse en 400 la saisie %o', async (champs, message) => {
      acteur.courant = { type: 'artist', userId: UTILISATEUR, artiste: { id: 'artiste-1', slug: 'artiste-1', name: 'Artiste Un' } }
      const { POST } = await import('@/app/api/artiste/oeuvres/route')
      const reponse = await POST(requete('/api/artiste/oeuvres', 'POST', { ...saisie, ...champs }))
      expect(reponse.status).toBe(400)
      expect((await reponse.json()).error).toContain(message)
      expect((await db.query('SELECT count(*)::int AS n FROM "Artwork"')).rows[0].n).toBe(0)
    })

    it('la modification par l’artiste écrit les deux, ou refuse sans rien changer', async () => {
      acteur.courant = { type: 'artist', userId: UTILISATEUR, artiste: { id: 'artiste-1', slug: 'artiste-1', name: 'Artiste Un' } }
      await ancienneOeuvre('a-modifier', 'variable', 10)
      const { PUT } = await import('@/app/api/artiste/oeuvres/[slug]/route')

      const refus = await PUT(requete('/api/artiste/oeuvres/a-modifier', 'PUT', { ...saisie, price: '10', dimensions: 'environ 1 m' }), parametres('a-modifier'))
      expect(refus.status).toBe(400)
      expect(await colonnes('a-modifier')).toMatchObject({ price: 10, dimensions: 'variable', prixCentimes: null })

      const ok = await PUT(requete('/api/artiste/oeuvres/a-modifier', 'PUT', { ...saisie, price: '99,9', dimensions: '45 x 30 x 28 cm' }), parametres('a-modifier'))
      expect(ok.status).toBe(200)
      expect(await colonnes('a-modifier')).toEqual({
        price: 99.9, dimensions: '45 × 30 × 28 cm', prixCentimes: 9990, devise: 'EUR',
        hauteurMm: 450, largeurMm: 300, profondeurMm: 280,
      })
    })

    it('une ancienne dimension illisible renvoyée telle quelle n’empêche pas la modification', async () => {
      acteur.courant = { type: 'artist', userId: UTILISATEUR, artiste: { id: 'artiste-1', slug: 'artiste-1', name: 'Artiste Un' } }
      await ancienneOeuvre('illisible-a-garder', 'Impression 80 × 80 cm', 10)
      const artiste = await import('@/app/api/artiste/oeuvres/[slug]/route')
      const ok = await artiste.PUT(
        requete('/x', 'PUT', { ...saisie, title: 'Renommée', price: '10', dimensions: 'Impression 80 × 80 cm' }),
        parametres('illisible-a-garder'),
      )
      expect(ok.status).toBe(200)
      expect(await colonnes('illisible-a-garder')).toMatchObject({
        dimensions: 'Impression 80 × 80 cm', hauteurMm: null, largeurMm: null, prixCentimes: 1000,
      })
      // Un nouveau texte illisible reste refusé.
      const refus = await artiste.PUT(requete('/x', 'PUT', { ...saisie, price: '10', dimensions: 'environ 1 m' }), parametres('illisible-a-garder'))
      expect(refus.status).toBe(400)

      acteur.courant = { type: 'admin', userId: 'admin' }
      const admin = await import('@/app/api/admin/oeuvres/[slug]/route')
      expect((await admin.PUT(requete('/x', 'PUT', { title: 'Admin', dimensions: 'Impression 80 × 80 cm' }), parametres('illisible-a-garder'))).status).toBe(200)
      expect((await admin.PUT(requete('/x', 'PUT', { dimensions: '120 cm' }), parametres('illisible-a-garder'))).status).toBe(400)
      expect(await colonnes('illisible-a-garder')).toMatchObject({ dimensions: 'Impression 80 × 80 cm', hauteurMm: null })
    })

    it('la modification par l’admin écrit les deux, ou refuse en 400', async () => {
      acteur.courant = { type: 'admin', userId: 'admin' }
      await ancienneOeuvre('admin-modifie', '10 × 10 cm', 10)
      const { PUT } = await import('@/app/api/admin/oeuvres/[slug]/route')

      expect((await PUT(requete('/x', 'PUT', { dimensions: '120 cm' }), parametres('admin-modifie'))).status).toBe(400)
      expect((await PUT(requete('/x', 'PUT', { price: '-5' }), parametres('admin-modifie'))).status).toBe(400)

      const ok = await PUT(requete('/x', 'PUT', { price: '1 250,50', dimensions: '800×600 mm' }), parametres('admin-modifie'))
      expect(ok.status).toBe(200)
      expect(await colonnes('admin-modifie')).toMatchObject({
        price: 1250.5, prixCentimes: 125050, dimensions: '80 × 60 cm', hauteurMm: 800, largeurMm: 600,
      })

      // Prix effacé : anciennes et nouvelles colonnes vidées ensemble.
      await PUT(requete('/x', 'PUT', { price: '' }), parametres('admin-modifie'))
      expect(await colonnes('admin-modifie')).toMatchObject({ price: null, prixCentimes: null })
    })
  })
})
