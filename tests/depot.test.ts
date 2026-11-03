import { createHash } from 'node:crypto'
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  apercuDimensions,
  centimesEnSaisie,
  elementsManquants,
  etatSections,
  nombreSectionsCompletes,
  offreEnSaisie,
  orientation,
  refusFichier,
  validerChamp,
  validerOffre,
  type DonneesDepot,
  type SaisieOffre,
} from '@/lib/curation/depot-regles'
import { MESSAGE_PRIX_INVALIDE } from '@/lib/catalogue/conversions'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 2.5 (FR-20) : dépôt d'une œuvre par son artiste — photos, informations, dimensions et prix.
// Story 2.6 : expédition par zone, visites en atelier, engagements et envoi en curation.

const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as Record<string, unknown> }))
const detruire = vi.hoisted(() => vi.fn(async () => ({ result: 'ok' })))

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('@/lib/acces', async (original) => ({
  ...(await original<typeof import('@/lib/acces')>()),
  acteurCourant: async () => acteur.courant,
}))
vi.mock('@/lib/cloudinary', async () => {
  const { v2 } = await import('cloudinary')
  return { cloudinary: { utils: v2.utils, uploader: { destroy: detruire } } }
})
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
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

const ARTISTE = { type: 'artist', userId: 'utilisateur-1', artiste: { id: 'artiste-1', slug: 'artiste-1', name: 'Artiste Un' } }
const AUTRE = { type: 'artist', userId: 'utilisateur-2', artiste: { id: 'artiste-2', slug: 'artiste-2', name: 'Artiste Deux' } }
const ADMIN = { type: 'admin', userId: 'admin-1' }
const SECRET = 'secret-de-test'
const NUAGE = 'nuage-test'

function trouver(n: ReactNode, predicat: (e: ReactElement) => boolean): ReactElement | null {
  if (!isValidElement(n)) {
    if (!Array.isArray(n)) return null
    for (const enfant of n) {
      const r = trouver(enfant, predicat)
      if (r) return r
    }
    return null
  }
  if (predicat(n)) return n
  return trouver((n.props as { children?: ReactNode }).children, predicat)
}

const saisie = (frais: string, preparation: string, transportMin: string, transportMax: string): SaisieOffre => ({
  nonLivree: false, frais, preparation, transportMin, transportMax,
})
const ZONES = [{ id: 'z-maroc', nom: 'Maroc' }, { id: 'z-monde', nom: 'Reste du monde' }]
const NON_LIVREE = { livree: false, fraisCentimes: null, preparationJours: null, transportMinJours: null, transportMaxJours: null }
const VIDE: DonneesDepot = {
  titre: '', technique: '', annee: null, histoire: '', ambiance: null, couleurDominante: null,
  hauteurMm: null, largeurMm: null, profondeurMm: null, prixCentimes: null, photos: [],
  offres: [], visitesAtelier: null, engagementCertificat: false, engagementEmballage: false, engagementReprise: false,
}
const PLEIN: DonneesDepot = {
  ...VIDE,
  titre: 'T', technique: 'Huile', annee: 2024, histoire: 'H', ambiance: 'calme', couleurDominante: 'bleu',
  hauteurMm: 600, largeurMm: 800, profondeurMm: null, prixCentimes: 95_000,
  photos: ['face_lumiere_du_jour', 'gros_plan', 'mise_en_situation'],
}
const COMPLET: DonneesDepot = {
  ...PLEIN,
  offres: [
    { zoneId: 'z-maroc', livree: true, fraisCentimes: 2500, preparationJours: 3, transportMinJours: 2, transportMaxJours: 5 },
    { zoneId: 'z-monde', ...NON_LIVREE },
  ],
  visitesAtelier: true, engagementCertificat: true, engagementEmballage: true, engagementReprise: true,
}

describe('règles pures du dépôt', () => {
  it('60 × 80 cm : « 23,6 × 31,5 in · paysage » ; orientation', () => {
    expect(apercuDimensions({ hauteur: '60', largeur: '80', profondeur: '' })).toBe('23,6 × 31,5 in · paysage')
    expect(apercuDimensions({ hauteur: '80', largeur: '60', profondeur: '4' })).toBe('31,5 × 23,6 × 1,6 in · portrait')
    expect(apercuDimensions({ hauteur: '50', largeur: '50', profondeur: '' })).toBe('19,7 × 19,7 in · carré')
    expect(apercuDimensions({ hauteur: '60', largeur: '', profondeur: '' })).toBeNull()
    expect(apercuDimensions({ hauteur: '0', largeur: '80', profondeur: '' })).toBeNull()
    expect(orientation(600, 800)).toBe('paysage')
  })

  it('dimensions en millimètres, de 1 mm à 1 000 cm', () => {
    expect(validerChamp('hauteur', '60')).toEqual({ ok: true, valeur: 600 })
    expect(validerChamp('largeur', '31,5')).toEqual({ ok: true, valeur: 315 })
    expect(validerChamp('largeur', '1000')).toEqual({ ok: true, valeur: 10_000 })
    expect(validerChamp('profondeur', '')).toEqual({ ok: true, valeur: null })
    for (const invalide of ['0', '-5', '1000,1', '1001', 'abc', '0,04']) {
      expect(validerChamp('hauteur', invalide), invalide).toMatchObject({ ok: false })
    }
  })

  it('prix en centimes ; illisible : MESSAGE_PRIX_INVALIDE', () => {
    expect(validerChamp('prix', '1 250,50')).toEqual({ ok: true, valeur: 125_050 })
    expect(validerChamp('prix', 'mille')).toEqual({ ok: false, erreur: MESSAGE_PRIX_INVALIDE })
    expect(centimesEnSaisie(125_050)).toBe('1250,50')
    expect(centimesEnSaisie(95_000)).toBe('950')
    expect(validerChamp('prix', centimesEnSaisie(125_050))).toEqual({ ok: true, valeur: 125_050 })
  })

  it('limites des textes, de l’année et des listes fermées', () => {
    const annee = new Date().getFullYear()
    expect(validerChamp('titre', '  La Sqala  ')).toEqual({ ok: true, valeur: 'La Sqala' })
    expect(validerChamp('titre', 'x'.repeat(121))).toMatchObject({ ok: false })
    expect(validerChamp('technique', 'x'.repeat(120))).toMatchObject({ ok: true })
    expect(validerChamp('histoire', 'é'.repeat(300))).toMatchObject({ ok: true })
    expect(validerChamp('histoire', 'é'.repeat(301))).toMatchObject({ ok: false })
    expect(validerChamp('annee', String(annee))).toEqual({ ok: true, valeur: annee })
    expect(validerChamp('annee', '1899')).toMatchObject({ ok: false })
    expect(validerChamp('annee', String(annee + 1))).toMatchObject({ ok: false })
    expect(validerChamp('ambiance', 'melancolique')).toEqual({ ok: true, valeur: 'melancolique' })
    expect(validerChamp('ambiance', 'Mélancolique')).toMatchObject({ ok: false })
    expect(validerChamp('couleurDominante', 'multicolore')).toEqual({ ok: true, valeur: 'multicolore' })
    expect(validerChamp('couleurDominante', 'violet')).toMatchObject({ ok: false })
  })

  it('refuse avant envoi un fichier d’un autre type ou trop lourd', () => {
    const Mo = 1024 * 1024
    expect(refusFichier('gros_plan', { type: 'image/jpeg', size: 8 * Mo, name: 'a.jpg' })).toBeNull()
    expect(refusFichier('gros_plan', { type: '', size: 8 * Mo, name: 'IMG_1.HEIC' })).toBeNull()
    expect(refusFichier('gros_plan', { type: 'image/jpeg', size: 11 * Mo, name: 'a.jpg' })).toContain('10 Mo')
    expect(refusFichier('gros_plan', { type: 'application/pdf', size: Mo, name: 'a.pdf' })).toContain('photo')
    expect(refusFichier('gros_plan', { type: 'video/mp4', size: Mo, name: 'a.mp4' })).toContain('photo')
    expect(refusFichier('video', { type: 'video/mp4', size: 99 * Mo, name: 'a.mp4' })).toBeNull()
    expect(refusFichier('video', { type: 'video/mp4', size: 101 * Mo, name: 'a.mp4' })).toContain('100 Mo')
    expect(refusFichier('video', { type: 'image/png', size: Mo, name: 'a.png' })).toContain('vidéo')
  })

  it('sections : complétude des cinq sections', () => {
    expect(nombreSectionsCompletes(etatSections(VIDE, ZONES))).toBe(0)
    const sections = etatSections(PLEIN, ZONES)
    expect(sections.map((s) => [s.titre, s.complet])).toEqual([
      ['Photos', true], ['Informations', true], ['Dimensions et prix', true], ['Expédition', false], ['Engagements', false],
    ])
    expect(etatSections({ ...PLEIN, photos: ['face_lumiere_du_jour'] }, ZONES)[0].manques).toEqual([
      'Gros plan de la matière', 'Mise en situation avec repère d’échelle',
    ])
    expect(etatSections({ ...PLEIN, ambiance: 'retiree-de-la-liste' }, ZONES)[1].complet).toBe(false)
    expect(nombreSectionsCompletes(etatSections(COMPLET, ZONES))).toBe(5)
    expect(elementsManquants(COMPLET, ZONES)).toEqual([])
  })

  it('zone livrée : 25 €, préparation 3, transport 2 à 5 → 2 500 centimes, 3, 2, 5', () => {
    expect(validerOffre(saisie('25', '3', '2', '5'))).toEqual({
      ok: true, offre: { livree: true, fraisCentimes: 2500, preparationJours: 3, transportMinJours: 2, transportMaxJours: 5 },
    })
    expect(validerOffre(saisie('0', '0', '1', '1'))).toMatchObject({ ok: true, offre: { fraisCentimes: 0, preparationJours: 0 } })
    expect(validerOffre(saisie('10 000', '60', '90', '90'))).toMatchObject({ ok: true, offre: { fraisCentimes: 1_000_000 } })
    expect(offreEnSaisie({ zoneId: 'z', livree: true, fraisCentimes: 2550, preparationJours: 3, transportMinJours: 2, transportMaxJours: 5 }))
      .toEqual(saisie('25,50', '3', '2', '5'))
    expect(offreEnSaisie({ zoneId: 'z', livree: true, fraisCentimes: 0, preparationJours: 0, transportMinJours: 1, transportMaxJours: 1 }).frais).toBe('0')
  })

  it('zone : min > max, négatif ou hors bornes → erreur reliée au champ', () => {
    expect(validerOffre(saisie('25', '3', '6', '5'))).toEqual({
      ok: false, erreurs: { transportMax: expect.stringContaining('supérieur ou égal') },
    })
    for (const [s, champ] of [
      [saisie('-5', '3', '2', '5'), 'frais'],
      [saisie('10 000,01', '3', '2', '5'), 'frais'],
      [saisie('vingt', '3', '2', '5'), 'frais'],
      [saisie('25', '61', '2', '5'), 'preparation'],
      [saisie('25', '-1', '2', '5'), 'preparation'],
      [saisie('25', '2,5', '2', '5'), 'preparation'],
      [saisie('25', '3', '0', '5'), 'transportMin'],
      [saisie('25', '3', '2', '91'), 'transportMax'],
      [saisie('25', '', '2', '5'), 'preparation'],
    ] as const) {
      const r = validerOffre(s)
      expect(r.ok, JSON.stringify(s)).toBe(false)
      expect(r.ok ? {} : Object.keys(r.erreurs), JSON.stringify(s)).toEqual([champ])
    }
    expect(validerOffre(null)).toMatchObject({ ok: false })
    expect(validerOffre({ nonLivree: 'oui' })).toMatchObject({ ok: false })
  })

  it('zone refusée : offre non livrée, frais et délais vides ; quatre champs vides : aucune offre', () => {
    expect(validerOffre({ ...saisie('25', '3', '2', '5'), nonLivree: true })).toEqual({
      ok: true, offre: { livree: false, fraisCentimes: null, preparationJours: null, transportMinJours: null, transportMaxJours: null },
    })
    expect(validerOffre(saisie('', '', '', ''))).toEqual({ ok: true, offre: null })
  })

  it('expédition : chaque zone renseignée, au moins une livrée, visites en atelier renseignées', () => {
    const libelles = (d: DonneesDepot, zones = ZONES) => elementsManquants(d, zones).filter((m) => m.section === 'expedition')
    expect(libelles({ ...COMPLET, offres: [] })).toEqual([
      { section: 'expedition', libelle: 'Maroc : frais et délais, ou « Je ne livre pas »', cible: 'depot-zone-z-maroc-frais' },
      { section: 'expedition', libelle: 'Reste du monde : frais et délais, ou « Je ne livre pas »', cible: 'depot-zone-z-monde-frais' },
    ])
    const refusees = COMPLET.offres.map((o) => ({ ...NON_LIVREE, zoneId: o.zoneId }))
    expect(libelles({ ...COMPLET, offres: refusees })).toEqual([
      { section: 'expedition', libelle: 'Livrez au moins une zone', cible: 'depot-zone-z-maroc-nonLivree' },
    ])
    expect(etatSections({ ...COMPLET, offres: refusees }, ZONES)[3].manques).toEqual(['Livrez au moins une zone'])
    expect(libelles({ ...COMPLET, visitesAtelier: null })).toEqual([
      { section: 'expedition', libelle: 'Visites en atelier', cible: 'depot-visitesAtelier' },
    ])
    expect(libelles({ ...COMPLET, visitesAtelier: false })).toEqual([])
    // Sans zone ouverte par l'équipe : la section ne peut pas être complète, le lien mène à la section.
    expect(libelles(COMPLET, [])).toEqual([
      { section: 'expedition', libelle: 'Zones de livraison (pas encore ouvertes par l’équipe)', cible: 'section-expedition' },
    ])
  })

  it('engagements : les trois cases ; éléments manquants avec l’id du champ ciblé', () => {
    expect(elementsManquants({ ...COMPLET, engagementEmballage: false }, ZONES)).toEqual([
      { section: 'engagements', libelle: 'Emballage conforme au guide Errancy', cible: 'depot-engagementEmballage' },
    ])
    expect(elementsManquants({ ...COMPLET, photos: ['face_lumiere_du_jour', 'mise_en_situation'] }, ZONES)).toEqual([
      { section: 'photos', libelle: 'Gros plan de la matière', cible: 'depot-photo-gros_plan' },
    ])
    expect(elementsManquants({ ...COMPLET, prixCentimes: null }, ZONES)).toEqual([
      { section: 'dimensions', libelle: 'Prix', cible: 'depot-prix' },
    ])
    expect(elementsManquants(VIDE, ZONES)).toHaveLength(9 + 3 + 2 + 1 + 3)
    expect(validerChamp('visitesAtelier', 'oui')).toEqual({ ok: true, valeur: true })
    expect(validerChamp('visitesAtelier', 'non')).toEqual({ ok: true, valeur: false })
    expect(validerChamp('visitesAtelier', '')).toEqual({ ok: true, valeur: null })
    expect(validerChamp('visitesAtelier', 'peut-être')).toMatchObject({ ok: false })
    expect(validerChamp('engagementReprise', 'oui')).toEqual({ ok: true, valeur: true })
    expect(validerChamp('engagementReprise', '')).toMatchObject({ ok: false })
  })
})

describe('base : dépôt de l’artiste', () => {
  let base: BaseJetable
  let db: Client

  const ligne = async (slug: string) =>
    (
      await db.query(
        `SELECT id, slug, title, year, medium, description, ambiance, "couleurDominante", price, "prixCentimes",
                dimensions, "hauteurMm", "largeurMm", "profondeurMm", "imageUrl", "artistId",
                publication::text AS publication, disponibilite::text AS disponibilite, available
         FROM "Artwork" WHERE slug = $1`,
        [slug],
      )
    ).rows[0]
  const nombre = async () => (await db.query('SELECT count(*)::int AS n FROM "Artwork"')).rows[0].n
  const photos = async () => (await db.query('SELECT type::text AS type, url, "publicId" FROM "PhotoOeuvre" ORDER BY type')).rows

  async function publiee(slug: string, artiste = 'artiste-1') {
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, dimensions, description, "imageUrl", price, "prixCentimes",
                              available, publication, disponibilite, "artistId", "updatedAt")
       VALUES ($1, $1, 'Publiée', 2020, 'Huile', '10 × 10 cm', 'D', '', 100, 10000, true, 'publiee', 'disponible', $2, now())`,
      [slug, artiste],
    )
  }

  beforeAll(async () => {
    base = await creerBaseJetable()
    process.env.DATABASE_URL = base.url
    db = new Client({ connectionString: base.url })
    await db.connect()
    for (const n of ['1', '2']) {
      await db.query(`INSERT INTO "User" (id, email, role, "updatedAt") VALUES ($1, $2, 'artist', now())`, [
        `utilisateur-${n}`, `artiste${n}@exemple.test`,
      ])
      await db.query(
        `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt", "userId")
         VALUES ($1, $1, $2, 'MA', 1980, 'Bio', '', now(), $3)`,
        [`artiste-${n}`, `Artiste ${n}`, `utilisateur-${n}`],
      )
    }
  })

  afterAll(async () => {
    await db?.end()
    await base?.supprimer()
  })

  beforeEach(async () => {
    acteur.courant = { type: 'visiteur' }
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = NUAGE
    process.env.CLOUDINARY_API_KEY = 'cle-publique'
    process.env.CLOUDINARY_API_SECRET = SECRET
    detruire.mockClear()
    await db.query('DELETE FROM "Artwork"')
    await db.query('DELETE FROM "Zone"')
  })

  it('premier champ : crée le brouillon (brouillon + disponible, available faux), slug tiré du titre', async () => {
    const { enregistrerChamp } = await import('@/lib/curation')
    const r = await enregistrerChamp(ARTISTE as never, null, 'titre', 'La Sqala sous la brume')
    if (!r.ok) throw new Error(r.code)
    expect(r.depot.slug).toBe('la-sqala-sous-la-brume')
    expect(await ligne(r.depot.slug)).toMatchObject({
      title: 'La Sqala sous la brume', year: 0, medium: '', dimensions: '', imageUrl: '', artistId: 'artiste-1',
      publication: 'brouillon', disponibilite: 'disponible', available: false, prixCentimes: null,
    })
    const { getArtworkBySlug, getAllArtworks } = await import('@/lib/catalogue')
    expect(await getArtworkBySlug(r.depot.slug)).toBeNull()
    expect(await getAllArtworks()).toEqual([])
  })

  it('slug provisoire « brouillon-xxxxxxxx », puis recalculé depuis le titre tant que l’œuvre est en brouillon', async () => {
    const { enregistrerChamp } = await import('@/lib/curation')
    const r = await enregistrerChamp(ARTISTE as never, null, 'prix', '950')
    if (!r.ok) throw new Error(r.code)
    expect(r.depot.slug).toMatch(/^brouillon-[0-9a-f]{8}$/)
    await publiee('nouvelle-lune')
    const titre = await enregistrerChamp(ARTISTE as never, r.depot.slug, 'titre', 'Nouvelle lune')
    expect(titre).toMatchObject({ ok: true, depot: { slug: 'nouvelle-lune-2', titre: 'Nouvelle lune', prixCentimes: 95_000 } })
    // Même titre : slug inchangé ; titre vidé : slug conservé.
    expect(await enregistrerChamp(ARTISTE as never, 'nouvelle-lune-2', 'titre', 'Nouvelle  lune')).toMatchObject({ depot: { slug: 'nouvelle-lune-2' } })
    expect(await enregistrerChamp(ARTISTE as never, 'nouvelle-lune-2', 'titre', '')).toMatchObject({ depot: { slug: 'nouvelle-lune-2', titre: '' } })
    // « nouvelle » masquerait /dashboard/artiste/oeuvres/nouvelle.
    expect(await enregistrerChamp(ARTISTE as never, 'nouvelle-lune-2', 'titre', 'Nouvelle')).toMatchObject({ depot: { slug: 'nouvelle-2' } })
  })

  it('un slug suffixé n’est gardé que si sa base reste prise par une autre œuvre', async () => {
    const { enregistrerChamp } = await import('@/lib/curation')
    const r = await enregistrerChamp(ARTISTE as never, null, 'titre', 'Nuit 2024')
    if (!r.ok) throw new Error(r.code)
    expect(r.depot.slug).toBe('nuit-2024')
    expect(await enregistrerChamp(ARTISTE as never, 'nuit-2024', 'titre', 'Nuit')).toMatchObject({ depot: { slug: 'nuit' } })
    await enregistrerChamp(ARTISTE as never, 'nuit', 'titre', 'Autre')
    await publiee('nuit')
    expect(await enregistrerChamp(ARTISTE as never, 'autre', 'titre', 'Nuit')).toMatchObject({ depot: { slug: 'nuit-2' } })
    expect(await enregistrerChamp(ARTISTE as never, 'nuit-2', 'titre', 'Nuit')).toMatchObject({ depot: { slug: 'nuit-2' } })
  })

  it('un brouillon créé par son seul prix s’affiche « Sans titre », sans année', async () => {
    const { enregistrerChamp } = await import('@/lib/curation')
    const r = await enregistrerChamp(ARTISTE as never, null, 'prix', '950')
    if (!r.ok) throw new Error(r.code)
    const { oeuvresDeLArtiste } = await import('@/lib/catalogue')
    expect((await oeuvresDeLArtiste('utilisateur-1'))?.oeuvres).toEqual([
      expect.objectContaining({ slug: r.depot.slug, title: 'Sans titre', year: null, etat: 'brouillon' }),
    ])
  })

  it('informations, dimensions et prix : millimètres, centimes et anciennes colonnes', async () => {
    const { enregistrerChamp, lireDepot } = await import('@/lib/curation')
    const r = await enregistrerChamp(ARTISTE as never, null, 'titre', 'Remparts')
    if (!r.ok) throw new Error(r.code)
    const slug = r.depot.slug
    for (const [champ, valeur] of [
      ['technique', 'Acrylique sur toile'], ['annee', '2024'], ['histoire', 'Les remparts un matin de brume.'],
      ['ambiance', 'calme'], ['hauteur', '60'], ['largeur', '80'], ['couleurDominante', 'bleu'], ['prix', '1 250,50'],
    ] as const) {
      expect((await enregistrerChamp(ARTISTE as never, slug, champ, valeur)).ok, champ).toBe(true)
    }
    expect(await ligne(slug)).toMatchObject({
      medium: 'Acrylique sur toile', year: 2024, description: 'Les remparts un matin de brume.', ambiance: 'calme',
      couleurDominante: 'bleu', hauteurMm: 600, largeurMm: 800, profondeurMm: null, dimensions: '60 × 80 cm',
      prixCentimes: 125_050, price: 1250.5,
    })
    await enregistrerChamp(ARTISTE as never, slug, 'profondeur', '4,5')
    expect(await ligne(slug)).toMatchObject({ profondeurMm: 45, dimensions: '60 × 80 × 4,5 cm' })
    // Hauteur vidée : plus d'ancien texte, comme une œuvre sans dimensions.
    await enregistrerChamp(ARTISTE as never, slug, 'hauteur', '')
    expect(await ligne(slug)).toMatchObject({ hauteurMm: null, largeurMm: 800, dimensions: '' })

    const lu = await lireDepot(ARTISTE as never, slug)
    if (!lu.ok) throw new Error(lu.code)
    expect(etatSections(lu.depot, []).map((s) => s.complet)).toEqual([false, true, false, false, false])
  })

  it.each([['hauteur', '0'], ['hauteur', '-5'], ['largeur', '1001'], ['prix', '12,345'], ['annee', '1850']] as const)(
    'refuse %s « %s » avec son message, sans rien écrire',
    async (champ, valeur) => {
      const { enregistrerChamp } = await import('@/lib/curation')
      const r = await enregistrerChamp(ARTISTE as never, null, 'titre', 'Œuvre')
      if (!r.ok) throw new Error(r.code)
      const avant = await ligne(r.depot.slug)
      const refus = await enregistrerChamp(ARTISTE as never, r.depot.slug, champ, valeur)
      expect(refus).toMatchObject({ ok: false, code: 'valeur_invalide' })
      expect(refus.ok ? '' : refus.erreur).toBeTruthy()
      expect(await ligne(r.depot.slug)).toEqual(avant)
    },
  )

  it('seul l’artiste propriétaire lit et modifie son brouillon', async () => {
    const { enregistrerChamp, lireDepot } = await import('@/lib/curation')
    const r = await enregistrerChamp(ARTISTE as never, null, 'titre', 'À moi')
    if (!r.ok) throw new Error(r.code)
    const slug = r.depot.slug
    const avant = await ligne(slug)
    for (const autre of [AUTRE, ADMIN, { type: 'user', userId: 'u' }, { type: 'visiteur' }, { type: 'artist', userId: 'x', artiste: null }]) {
      expect(await lireDepot(autre as never, slug), JSON.stringify(autre)).toMatchObject({ ok: false, code: 'acces_refuse' })
      expect(await enregistrerChamp(autre as never, slug, 'titre', 'Volée')).toMatchObject({ ok: false, code: 'acces_refuse' })
    }
    // Aucun acteur autre qu'un artiste ne crée de brouillon.
    expect(await enregistrerChamp(ADMIN as never, null, 'titre', 'Admin')).toMatchObject({ ok: false, code: 'acces_refuse' })
    expect(await ligne(slug)).toEqual(avant)
    expect(await nombre()).toBe(1)
    expect(await lireDepot(ARTISTE as never, 'inexistante')).toMatchObject({ ok: false, code: 'introuvable' })
  })

  it('une œuvre publiée refuse toute écriture du dépôt (transition_interdite)', async () => {
    await publiee('publiee-1')
    const { enregistrerChamp, lireDepot, preparerEnvoiPhoto } = await import('@/lib/curation')
    const avant = await ligne('publiee-1')
    expect(await lireDepot(ARTISTE as never, 'publiee-1')).toMatchObject({ ok: false, code: 'transition_interdite' })
    expect(await enregistrerChamp(ARTISTE as never, 'publiee-1', 'prix', '1')).toMatchObject({ ok: false, code: 'transition_interdite' })
    expect(await preparerEnvoiPhoto(ARTISTE as never, 'publiee-1', 'gros_plan')).toMatchObject({ ok: false, code: 'transition_interdite' })
    expect(await ligne('publiee-1')).toEqual(avant)
  })

  describe('pages', () => {
    it('nouvelle : formulaire de dépôt vide, réservé aux artistes', async () => {
      const { default: Nouvelle } = await import('@/app/dashboard/artiste/oeuvres/nouvelle/page')
      const { PageDepot } = await import('@/app/dashboard/artiste/oeuvres/depot/PageDepot')
      acteur.courant = ARTISTE
      const page = await Nouvelle()
      expect(page.type).toBe(PageDepot)
      expect(page.props).toMatchObject({ depot: null })
      acteur.courant = { type: 'user', userId: 'u' }
      await expect(Nouvelle()).rejects.toThrow('redirection:/dashboard')
    })

    it('[slug] : brouillon → dépôt ; autre artiste → 404 ; publiée → ancienne page', async () => {
      const { enregistrerChamp } = await import('@/lib/curation')
      const { default: Page } = await import('@/app/dashboard/artiste/oeuvres/[slug]/page')
      const { PageDepot } = await import('@/app/dashboard/artiste/oeuvres/depot/PageDepot')
      const { ArtworkForm } = await import('@/components/dashboard/ArtworkForm')
      const r = await enregistrerChamp(ARTISTE as never, null, 'titre', 'Brouillon de test')
      if (!r.ok) throw new Error(r.code)
      const params = (slug: string) => ({ params: Promise.resolve({ slug }) })

      acteur.courant = ARTISTE
      const depot = await Page(params(r.depot.slug))
      expect(depot.type).toBe(PageDepot)
      expect(depot.props.depot).toMatchObject({ slug: r.depot.slug, titre: 'Brouillon de test' })

      acteur.courant = AUTRE
      await expect(Page(params(r.depot.slug))).rejects.toThrow('introuvable')

      await publiee('publiee-2')
      acteur.courant = ARTISTE
      const ancienne = await Page(params('publiee-2'))
      expect(trouver(ancienne, (e) => e.type === ArtworkForm)).not.toBeNull()
    })
  })

  describe('photos : envoi signé', () => {
    const reponse = (publicId: string, surcharge: Record<string, unknown> = {}) => ({
      public_id: publicId,
      version: 1730000000,
      signature: createHash('sha1').update(`public_id=${publicId}&version=1730000000${SECRET}`).digest('hex'),
      secure_url: `https://res.cloudinary.com/${NUAGE}/image/upload/v1730000000/${publicId}.jpg`,
      resource_type: 'image',
      format: 'jpg',
      bytes: 8 * 1024 * 1024,
      width: 3000,
      height: 4000,
      ...surcharge,
    })

    async function preparer(slug: string | null, type = 'gros_plan', qui = ARTISTE) {
      const { preparerEnvoiPhoto } = await import('@/lib/curation')
      const r = await preparerEnvoiPhoto(qui as never, slug, type)
      if (!r.ok) throw new Error(r.code)
      return r
    }

    it('signe un public_id imposé sous errancy/oeuvres/<id>/, sans jamais renvoyer le secret', async () => {
      const r = await preparer(null, 'gros_plan')
      const { id } = await ligne(r.slug)
      expect(r.slug).toMatch(/^brouillon-[0-9a-f]{8}$/)
      expect(r.envoi.publicId).toMatch(new RegExp(`^errancy/oeuvres/${id}/gros_plan-[0-9a-f]{8}$`))
      expect(r.envoi).toMatchObject({
        cloudName: NUAGE, apiKey: 'cle-publique', folder: `errancy/oeuvres/${id}`, allowedFormats: 'jpg,jpeg,png,webp,heic,heif',
      })
      expect(r.envoi.signature).toBe(
        createHash('sha1')
          .update(`allowed_formats=${r.envoi.allowedFormats}&public_id=${r.envoi.publicId}&timestamp=${r.envoi.timestamp}${SECRET}`)
          .digest('hex'),
      )
      expect((await preparer(r.slug, 'video')).envoi.allowedFormats).toBe('mp4,mov,webm')
      expect(JSON.stringify(r)).not.toContain(SECRET)
    })

    it('sans configuration Cloudinary : envoi_indisponible, aucun brouillon créé', async () => {
      delete process.env.CLOUDINARY_API_SECRET
      const { preparerEnvoiPhoto } = await import('@/lib/curation')
      expect(await preparerEnvoiPhoto(ARTISTE as never, null, 'gros_plan')).toMatchObject({ ok: false, code: 'envoi_indisponible' })
      expect(await nombre()).toBe(0)
    })

    it('enregistre une réponse authentique ; la photo de face alimente imageUrl ; « Remplacer » remplace dans la même case', async () => {
      const { enregistrerPhoto } = await import('@/lib/curation')
      const p1 = await preparer(null, 'face_lumiere_du_jour')
      const r1 = await enregistrerPhoto(ARTISTE as never, p1.slug, 'face_lumiere_du_jour', reponse(p1.envoi.publicId))
      expect(r1).toMatchObject({ ok: true, depot: { photos: ['face_lumiere_du_jour'] } })
      const url1 = reponse(p1.envoi.publicId).secure_url
      expect((await ligne(p1.slug)).imageUrl).toBe(url1)
      expect(detruire).not.toHaveBeenCalled()

      const p2 = await preparer(p1.slug, 'face_lumiere_du_jour')
      const r2 = await enregistrerPhoto(ARTISTE as never, p1.slug, 'face_lumiere_du_jour', reponse(p2.envoi.publicId))
      expect(r2.ok).toBe(true)
      const url2 = reponse(p2.envoi.publicId).secure_url
      expect(await photos()).toEqual([{ type: 'face_lumiere_du_jour', url: url2, publicId: p2.envoi.publicId }])
      expect((await ligne(p1.slug)).imageUrl).toBe(url2)
      expect(detruire).toHaveBeenCalledWith(p1.envoi.publicId, { resource_type: 'image', invalidate: true })
    })

    it('vidéo : ressource vidéo seulement', async () => {
      const { enregistrerPhoto } = await import('@/lib/curation')
      const p = await preparer(null, 'video')
      const video = reponse(p.envoi.publicId, {
        resource_type: 'video',
        format: 'mp4',
        secure_url: `https://res.cloudinary.com/${NUAGE}/video/upload/v1730000000/${p.envoi.publicId}.mp4`,
      })
      expect(await enregistrerPhoto(ARTISTE as never, p.slug, 'video', reponse(p.envoi.publicId))).toMatchObject({ ok: false, code: 'fichier_refuse' })
      expect(await enregistrerPhoto(ARTISTE as never, p.slug, 'video', video)).toMatchObject({ ok: true })
      expect((await ligne(p.slug)).imageUrl).toBe('')
    })

    it('signature falsifiée, public_id d’une autre œuvre ou d’une autre case, adresse détournée : rien n’est enregistré', async () => {
      const { enregistrerPhoto } = await import('@/lib/curation')
      const p = await preparer(null, 'gros_plan')
      const autre = await preparer(null, 'gros_plan')
      const vraie = reponse(p.envoi.publicId)
      const tentatives = [
        { ...vraie, signature: '0'.repeat(40) },
        { ...vraie, version: 1730000001 },
        { ...vraie, public_id: `${p.envoi.publicId}x` },
        reponse(autre.envoi.publicId),
        reponse(p.envoi.publicId.replace('gros_plan', 'mise_en_situation')),
        { ...vraie, secure_url: 'https://exemple.test/image.jpg' },
        { ...vraie, secure_url: `https://res.cloudinary.com/autre-nuage/image/upload/v1730000000/${p.envoi.publicId}.jpg` },
        {},
        null,
      ]
      for (const t of tentatives) {
        expect(await enregistrerPhoto(ARTISTE as never, p.slug, 'gros_plan', t), JSON.stringify(t)).toMatchObject({
          ok: false, code: 'signature_invalide',
        })
      }
      // Une signature valide pour une autre case ne vaut pas pour celle-ci.
      expect(await enregistrerPhoto(ARTISTE as never, p.slug, 'mise_en_situation', vraie)).toMatchObject({ ok: false, code: 'signature_invalide' })
      expect(await photos()).toEqual([])
    })

    it('format ou poids non conformes : fichier_refuse, fichier supprimé de Cloudinary, rien d’enregistré', async () => {
      const { enregistrerPhoto } = await import('@/lib/curation')
      const p = await preparer(null, 'gros_plan')
      const pdf = { ...reponse(p.envoi.publicId), format: 'pdf' }
      expect(await enregistrerPhoto(ARTISTE as never, p.slug, 'gros_plan', pdf)).toMatchObject({ ok: false, code: 'fichier_refuse' })
      expect(detruire).toHaveBeenCalledWith(p.envoi.publicId, { resource_type: 'image', invalidate: true })
      const lourd = { ...reponse(p.envoi.publicId), bytes: 11 * 1024 * 1024 }
      expect(await enregistrerPhoto(ARTISTE as never, p.slug, 'gros_plan', lourd)).toMatchObject({ ok: false, code: 'fichier_refuse' })
      expect(await enregistrerPhoto(ARTISTE as never, p.slug, 'gros_plan', { ...reponse(p.envoi.publicId), bytes: undefined })).toMatchObject({
        ok: false, code: 'fichier_refuse',
      })
      expect(await photos()).toEqual([])
    })

    it('HEIC : adresse enregistrée en .jpg (conversion à la livraison)', async () => {
      const { enregistrerPhoto } = await import('@/lib/curation')
      const p = await preparer(null, 'face_lumiere_du_jour')
      const base = `https://res.cloudinary.com/${NUAGE}/image/upload/v1730000000/${p.envoi.publicId}`
      const heic = { ...reponse(p.envoi.publicId), format: 'heic', secure_url: `${base}.heic` }
      expect(await enregistrerPhoto(ARTISTE as never, p.slug, 'face_lumiere_du_jour', heic)).toMatchObject({ ok: true })
      expect((await photos())[0].url).toBe(`${base}.jpg`)
      expect((await ligne(p.slug)).imageUrl).toBe(`${base}.jpg`)
    })

    it('œuvre publiée : aucune photo enregistrée (transition_interdite)', async () => {
      const { enregistrerPhoto } = await import('@/lib/curation')
      await publiee('publiee-photo')
      const p = await preparer(null, 'gros_plan')
      expect(await enregistrerPhoto(ARTISTE as never, 'publiee-photo', 'gros_plan', reponse(p.envoi.publicId))).toMatchObject({
        ok: false, code: 'transition_interdite',
      })
      expect(await photos()).toEqual([])
    })

    it('un autre artiste ne signe ni n’enregistre de photo sur ce brouillon', async () => {
      const { enregistrerPhoto, preparerEnvoiPhoto } = await import('@/lib/curation')
      const p = await preparer(null, 'gros_plan')
      expect(await preparerEnvoiPhoto(AUTRE as never, p.slug, 'gros_plan')).toMatchObject({ ok: false, code: 'acces_refuse' })
      expect(await enregistrerPhoto(AUTRE as never, p.slug, 'gros_plan', reponse(p.envoi.publicId))).toMatchObject({
        ok: false, code: 'acces_refuse',
      })
      expect(await photos()).toEqual([])
    })
  })

  describe('actions serveur', () => {
    it('relisent l’acteur, refusent un champ inconnu et renvoient un message en français', async () => {
      const { actionEnregistrerChamp, actionEnregistrerPhoto } = await import('@/app/dashboard/artiste/oeuvres/depot/actions')
      acteur.courant = ARTISTE
      const r = await actionEnregistrerChamp(null, 'titre', 'Par action')
      expect(r).toMatchObject({ ok: true, depot: { slug: 'par-action' } })
      expect(await actionEnregistrerChamp('par-action', 'price', '1')).toMatchObject({ ok: false, code: 'valeur_invalide' })
      expect(await actionEnregistrerChamp('par-action', 'prix', 'beaucoup')).toEqual({
        ok: false, code: 'valeur_invalide', message: MESSAGE_PRIX_INVALIDE,
      })
      acteur.courant = AUTRE
      const refus = await actionEnregistrerChamp('par-action', 'titre', 'Volée')
      expect(refus).toMatchObject({ ok: false, code: 'acces_refuse' })
      expect(refus.ok ? '' : refus.message).toMatch(/votre compte/)
      expect(await actionEnregistrerPhoto('par-action', 'gros_plan', {})).toMatchObject({ ok: false })
      const { actionPreparerEnvoi } = await import('@/app/dashboard/artiste/oeuvres/depot/actions')
      expect(await actionPreparerEnvoi('par-action', 'gros_plan')).toMatchObject({ ok: false, code: 'acces_refuse' })
      acteur.courant = ARTISTE
      const avant = await nombre()
      expect(await actionPreparerEnvoi('par-action', 'gros_plan')).toMatchObject({ ok: true, slug: 'par-action' })
      expect(await nombre()).toBe(avant)
      expect((await ligne('par-action')).title).toBe('Par action')
    })
  })

  describe('expédition, engagements et envoi en curation (story 2.6)', () => {
    const offres = async (slug: string) =>
      (
        await db.query(
          `SELECT z.nom, o.livree, o."fraisCentimes", o."preparationJours", o."transportMinJours", o."transportMaxJours"
           FROM "OffreLivraison" o JOIN "Artwork" a ON a.id = o."artworkId" JOIN "Zone" z ON z.id = o."zoneId"
           WHERE a.slug = $1 ORDER BY z."createdAt", z.nom`,
          [slug],
        )
      ).rows

    async function zone(nom: string, decalage = 0): Promise<string> {
      const id = `z-${nom.toLowerCase().replace(/[^a-z]+/g, '-')}`
      await db.query(
        `INSERT INTO "Zone" (id, nom, "createdAt", "updatedAt") VALUES ($1, $2, now() + make_interval(secs => $3), now())`,
        [id, nom, decalage],
      )
      return id
    }

    const livree = (frais: string, preparation = '3', min = '2', max = '5') => ({
      nonLivree: false, frais, preparation, transportMin: min, transportMax: max,
    })
    const refusee = { nonLivree: true, frais: '', preparation: '', transportMin: '', transportMax: '' }

    /** Brouillon complet sauf ce que `sauf` retire ; zones Maroc (livrée) et Reste du monde (refusée). */
    async function complet(titre: string, sauf: string[] = []): Promise<string> {
      const { enregistrerChamp, enregistrerOffreDepot } = await import('@/lib/curation')
      const r = await enregistrerChamp(ARTISTE as never, null, 'titre', titre)
      if (!r.ok) throw new Error(r.code)
      const slug = r.depot.slug
      const champs = [
        ['technique', 'Huile'], ['annee', '2024'], ['histoire', 'Une histoire.'], ['ambiance', 'calme'], ['hauteur', '60'],
        ['largeur', '80'], ['couleurDominante', 'bleu'], ['prix', '950'], ['visitesAtelier', 'non'],
        ['engagementCertificat', 'oui'], ['engagementEmballage', 'oui'], ['engagementReprise', 'oui'],
      ] as const
      for (const [champ, valeur] of champs) {
        if (!sauf.includes(champ)) expect((await enregistrerChamp(ARTISTE as never, slug, champ, valeur)).ok, champ).toBe(true)
      }
      const { id } = await ligne(slug)
      for (const type of ['face_lumiere_du_jour', 'gros_plan', 'mise_en_situation']) {
        if (sauf.includes(type)) continue
        await db.query(
          `INSERT INTO "PhotoOeuvre" (id, "artworkId", type, url, "publicId", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2::"TypePhoto", 'https://res.cloudinary.com/x/image/upload/a.jpg', $3, now())`,
          [id, type, `errancy/oeuvres/${id}/${type}`],
        )
      }
      const zones = (await db.query('SELECT id, nom FROM "Zone"')).rows as { id: string; nom: string }[]
      for (const z of zones) {
        const s = z.nom === 'Maroc' ? livree('25') : refusee
        expect((await enregistrerOffreDepot(ARTISTE as never, slug, z.id, s)).ok, z.nom).toBe(true)
      }
      return slug
    }

    it('zone livrée, puis refusée, puis vidée ; une saisie refusée n’écrit rien', async () => {
      const { enregistrerOffreDepot } = await import('@/lib/curation')
      const maroc = await zone('Maroc')
      const r = await enregistrerOffreDepot(ARTISTE as never, null, maroc, livree('25'))
      if (!r.ok) throw new Error(r.code)
      // Premier enregistrement : crée le brouillon.
      expect(r.depot.slug).toMatch(/^brouillon-[0-9a-f]{8}$/)
      expect(await offres(r.depot.slug)).toEqual([
        { nom: 'Maroc', livree: true, fraisCentimes: 2500, preparationJours: 3, transportMinJours: 2, transportMaxJours: 5 },
      ])
      expect(r.depot.offres).toEqual([
        { zoneId: maroc, livree: true, fraisCentimes: 2500, preparationJours: 3, transportMinJours: 2, transportMaxJours: 5 },
      ])
      for (const invalide of [livree('25', '3', '6', '5'), livree('-1'), livree('25', '61'), livree('25', '3', '0', '5'), livree('25', '')]) {
        const refus = await enregistrerOffreDepot(ARTISTE as never, r.depot.slug, maroc, invalide)
        expect(refus, JSON.stringify(invalide)).toMatchObject({ ok: false, code: 'valeur_invalide' })
        expect(refus.ok ? {} : refus.erreursOffre, JSON.stringify(invalide)).not.toEqual({})
      }
      expect((await offres(r.depot.slug))[0].fraisCentimes).toBe(2500)
      // Aucune écriture, pas même un brouillon, sur une saisie refusée sans brouillon.
      const avant = await nombre()
      expect(await enregistrerOffreDepot(ARTISTE as never, null, maroc, livree('-1'))).toMatchObject({ ok: false })
      expect(await nombre()).toBe(avant)

      await enregistrerOffreDepot(ARTISTE as never, r.depot.slug, maroc, { ...livree('25'), nonLivree: true })
      expect(await offres(r.depot.slug)).toEqual([
        { nom: 'Maroc', livree: false, fraisCentimes: null, preparationJours: null, transportMinJours: null, transportMaxJours: null },
      ])
      await enregistrerOffreDepot(ARTISTE as never, r.depot.slug, maroc, livree('', '', '', ''))
      expect(await offres(r.depot.slug)).toEqual([])
      expect(await enregistrerOffreDepot(ARTISTE as never, r.depot.slug, 'zone-inconnue', livree('25'))).toMatchObject({
        ok: false, code: 'zone_introuvable',
      })
    })

    it('aucune zone livrée : section 4 « Livrez au moins une zone », envoi refusé', async () => {
      const { enregistrerOffreDepot, envoyerEnCuration, lireDepot } = await import('@/lib/curation')
      const maroc = await zone('Maroc')
      await zone('Reste du monde', 1)
      const slug = await complet('Toutes refusées')
      await enregistrerOffreDepot(ARTISTE as never, slug, maroc, refusee)
      const lu = await lireDepot(ARTISTE as never, slug)
      if (!lu.ok) throw new Error(lu.code)
      const { zonesOuvertes } = await import('@/lib/livraison')
      expect(etatSections(lu.depot, await zonesOuvertes())[3]).toMatchObject({ complet: false, manques: ['Livrez au moins une zone'] })
      expect(await envoyerEnCuration(ARTISTE as never, slug)).toEqual({ ok: false, code: 'depot_incomplet' })
      expect((await ligne(slug)).publication).toBe('brouillon')
    })

    it('reprendre : les 5 offres de la dernière autre œuvre recopiées et enregistrées ; sans œuvre antérieure, rien', async () => {
      const { enregistrerChamp, enregistrerOffreDepot, reprendreZones, lireDepot } = await import('@/lib/curation')
      const ids = []
      for (const [i, nom] of ['Maroc', 'Union européenne', 'Europe hors UE', 'Amérique du Nord', 'Reste du monde'].entries()) {
        ids.push(await zone(nom, i))
      }
      const premiere = await enregistrerChamp(ARTISTE as never, null, 'titre', 'Première')
      if (!premiere.ok) throw new Error(premiere.code)
      expect(premiere.depot.repriseDisponible).toBe(false)
      expect(await reprendreZones(ARTISTE as never, 'premiere')).toEqual({ ok: false, code: 'introuvable' })
      for (const [i, id] of ids.entries()) {
        await enregistrerOffreDepot(ARTISTE as never, 'premiere', id, i === 4 ? refusee : livree(String(10 * (i + 1))))
      }
      // Les œuvres d'un autre artiste ne comptent pas.
      const { repriseZonesPossible } = await import('@/lib/curation')
      expect(await repriseZonesPossible(AUTRE as never)).toBe(false)
      expect(await repriseZonesPossible(ARTISTE as never)).toBe(true)

      const seconde = await enregistrerChamp(ARTISTE as never, null, 'titre', 'Seconde')
      if (!seconde.ok) throw new Error(seconde.code)
      expect(seconde.depot.repriseDisponible).toBe(true)
      await enregistrerOffreDepot(ARTISTE as never, 'seconde', ids[0], livree('99'))
      const r = await reprendreZones(ARTISTE as never, 'seconde')
      expect(r).toMatchObject({ ok: true, depot: { slug: 'seconde' } })
      expect(await offres('seconde')).toEqual(await offres('premiere'))
      expect(await offres('seconde')).toHaveLength(5)
      expect(await reprendreZones(AUTRE as never, 'seconde')).toMatchObject({ ok: false, code: 'acces_refuse' })
      // Sans brouillon : le crée, avec les zones reprises.
      const nouveau = await reprendreZones(ARTISTE as never, null)
      if (!nouveau.ok) throw new Error(nouveau.code)
      expect(nouveau.depot.offres).toHaveLength(5)
      const lu = await lireDepot(ARTISTE as never, 'premiere')
      expect(lu).toMatchObject({ ok: true, depot: { repriseDisponible: true } })
    })

    it('envoi incomplet : depot_incomplet, reste brouillon ; envoi complet : en_curation, date, puis transition_interdite', async () => {
      const { envoyerEnCuration, enregistrerChamp, lireDepot, enregistrerOffreDepot } = await import('@/lib/curation')
      await zone('Maroc')
      await zone('Reste du monde', 1)
      const incomplet = await complet('Sans gros plan', ['gros_plan'])
      expect(await envoyerEnCuration(ARTISTE as never, incomplet)).toEqual({ ok: false, code: 'depot_incomplet' })
      expect(await ligne(incomplet)).toMatchObject({ publication: 'brouillon' })
      expect((await db.query(`SELECT "envoyeeEnCurationLe" FROM "Artwork" WHERE slug = $1`, [incomplet])).rows[0].envoyeeEnCurationLe).toBeNull()

      const slug = await complet('Prête')
      expect(await envoyerEnCuration(AUTRE as never, slug)).toMatchObject({ ok: false, code: 'acces_refuse' })
      expect(await envoyerEnCuration(ADMIN as never, slug)).toMatchObject({ ok: false, code: 'acces_refuse' })
      const avant = Date.now()
      expect(await envoyerEnCuration(ARTISTE as never, slug)).toEqual({ ok: true, slug })
      const l = (await db.query(
        `SELECT publication::text AS publication, disponibilite::text AS disponibilite, available, "envoyeeEnCurationLe",
                "visitesAtelier", "engagementCertificat", "engagementEmballage", "engagementReprise"
         FROM "Artwork" WHERE slug = $1`, [slug],
      )).rows[0]
      expect(l).toMatchObject({
        publication: 'en_curation', disponibilite: 'disponible', available: false,
        visitesAtelier: false, engagementCertificat: true, engagementEmballage: true, engagementReprise: true,
      })
      expect(l.envoyeeEnCurationLe.getTime()).toBeGreaterThanOrEqual(avant - 1000)
      expect(await envoyerEnCuration(ARTISTE as never, slug)).toEqual({ ok: false, code: 'transition_interdite' })
      // Une œuvre en curation ne se modifie plus par l'artiste.
      expect(await enregistrerChamp(ARTISTE as never, slug, 'prix', '1')).toMatchObject({ ok: false, code: 'transition_interdite' })
      const { id: maroc } = (await db.query(`SELECT id FROM "Zone" WHERE nom = 'Maroc'`)).rows[0]
      expect(await enregistrerOffreDepot(ARTISTE as never, slug, maroc, livree('1'))).toMatchObject({ ok: false, code: 'transition_interdite' })
      expect(await lireDepot(ARTISTE as never, slug)).toMatchObject({ ok: false, code: 'transition_interdite' })
      // Absente du catalogue.
      const { getArtworkBySlug } = await import('@/lib/catalogue')
      expect(await getArtworkBySlug(slug)).toBeNull()
    })

    it('sans zone ouverte par l’équipe : envoi impossible', async () => {
      const { envoyerEnCuration } = await import('@/lib/curation')
      const slug = await complet('Sans zone')
      expect(await envoyerEnCuration(ARTISTE as never, slug)).toEqual({ ok: false, code: 'depot_incomplet' })
    })

    it('autre artiste : rien n’est écrit sur le brouillon d’autrui', async () => {
      const { enregistrerOffreDepot, envoyerEnCuration, reprendreZones } = await import('@/lib/curation')
      const maroc = await zone('Maroc')
      const slug = await complet('À moi')
      const avant = await offres(slug)
      expect(await enregistrerOffreDepot(AUTRE as never, slug, maroc, refusee)).toMatchObject({ ok: false, code: 'acces_refuse' })
      expect(await enregistrerChampAutre(slug)).toMatchObject({ ok: false, code: 'acces_refuse' })
      expect(await reprendreZones(AUTRE as never, slug)).toMatchObject({ ok: false, code: 'acces_refuse' })
      expect(await envoyerEnCuration(AUTRE as never, slug)).toMatchObject({ ok: false, code: 'acces_refuse' })
      expect(await offres(slug)).toEqual(avant)
      expect((await ligne(slug)).publication).toBe('brouillon')
    })

    async function enregistrerChampAutre(slug: string) {
      const { enregistrerChamp } = await import('@/lib/curation')
      return enregistrerChamp(AUTRE as never, slug, 'engagementCertificat', 'non')
    }

    it('actions : envoi complet → retour à « Mes œuvres » ; incomplet → message', async () => {
      const { actionEnvoyerEnCuration, actionEnregistrerOffre } = await import('@/app/dashboard/artiste/oeuvres/depot/actions')
      const maroc = await zone('Maroc')
      const slug = await complet('Par action')
      acteur.courant = ARTISTE
      expect(await actionEnregistrerOffre(slug, maroc, livree('25', '3', '6', '5'))).toMatchObject({
        ok: false, code: 'valeur_invalide', erreursOffre: { transportMax: expect.any(String) },
      })
      const incomplet = await complet('Incomplet', ['engagementReprise'])
      const refus = await actionEnvoyerEnCuration(incomplet)
      expect(refus).toMatchObject({ ok: false, code: 'depot_incomplet' })
      expect(refus.message).toMatch(/Il manque/)
      await expect(actionEnvoyerEnCuration(slug)).rejects.toThrow('redirection:/dashboard/artiste/oeuvres?envoyee=1')
      expect((await ligne(slug)).publication).toBe('en_curation')
      expect(await actionEnvoyerEnCuration(slug)).toMatchObject({ ok: false, code: 'transition_interdite' })
    })

    it('pages : œuvre en curation en lecture seule avec le délai ; bandeau après envoi sur « Mes œuvres »', async () => {
      const { envoyerEnCuration } = await import('@/lib/curation')
      const { default: Page } = await import('@/app/dashboard/artiste/oeuvres/[slug]/page')
      const { RecapitulatifCuration } = await import('@/app/dashboard/artiste/oeuvres/depot/RecapitulatifCuration')
      await zone('Maroc')
      await zone('Reste du monde', 1)
      const slug = await complet('Lecture seule')
      await envoyerEnCuration(ARTISTE as never, slug)

      acteur.courant = ARTISTE
      const page = await Page({ params: Promise.resolve({ slug }) })
      expect(page.type).toBe(RecapitulatifCuration)
      expect(page.props).toMatchObject({ delaiJours: 7, recap: { slug, titre: 'Lecture seule' } })
      const html = renderToStaticMarkup(createElement(RecapitulatifCuration, page.props))
      expect(html).toContain('sous 7 jours')
      expect(html).toContain('En curation')
      expect(html).toContain('25 € · préparation 3 j · transport 2 à 5 j')
      expect(html).toContain('Je ne livre pas cette zone')
      expect(html).not.toMatch(/<(input|textarea|select|button|form)\b/)
      expect(html).not.toMatch(/gratuit|garantie/i)

      acteur.courant = AUTRE
      await expect(Page({ params: Promise.resolve({ slug }) })).rejects.toThrow('introuvable')

      acteur.courant = ARTISTE
      const { default: Oeuvres } = await import('@/app/dashboard/artiste/oeuvres/page')
      const { StatusBadge } = await import('@/components/dashboard/StatusBadge')
      const texte = (n: ReactNode): string =>
        Array.isArray(n) ? n.map(texte).join('') : isValidElement(n) ? texte((n.props as { children?: ReactNode }).children) : n == null || typeof n === 'boolean' ? '' : String(n)
      const bandeau = (n: ReactNode) => trouver(n, (e) => (e.props as { role?: string }).role === 'status')
      const avec = await Oeuvres({ searchParams: Promise.resolve({ envoyee: '1' }) })
      expect(texte(bandeau(avec))).toMatch(/envoyée à l.équipe Errancy.*En curation.*sous 7 jours/)
      expect(trouver(avec, (e) => e.type === StatusBadge && (e.props as { libelle: string }).libelle === 'En curation')).not.toBeNull()
      expect(bandeau(await Oeuvres({ searchParams: Promise.resolve({}) }))).toBeNull()
    })

    it('ancienne route PUT : refuse un brouillon et une œuvre en curation, accepte une œuvre publiée', async () => {
      const { PUT } = await import('@/app/api/artiste/oeuvres/[slug]/route')
      const { auth } = await import('@/auth')
      const { envoyerEnCuration } = await import('@/lib/curation')
      await zone('Maroc')
      const brouillon = await complet('Brouillon PUT')
      const enCuration = await complet('Curation PUT')
      await envoyerEnCuration(ARTISTE as never, enCuration)
      await publiee('publiee-put')
      acteur.courant = ARTISTE
      const corps = { title: 'Modifiée', year: '2020', technique: 'Huile', dimensions: '10 × 10 cm', price: '100', description: 'D' }
      const appel = async (slug: string) => {
        vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'utilisateur-1' } } as never)
        const req = new Request(`http://local/api/artiste/oeuvres/${slug}`, { method: 'PUT', body: JSON.stringify(corps) })
        return PUT(req as never, { params: Promise.resolve({ slug }) })
      }
      expect((await appel(brouillon)).status).toBe(409)
      expect((await appel(enCuration)).status).toBe(409)
      expect((await ligne(enCuration)).title).toBe('Curation PUT')
      expect((await appel('publiee-put')).status).toBe(200)
      expect((await ligne('publiee-put')).title).toBe('Modifiée')
    })

    it('ancienne route DELETE : refuse une œuvre en curation, supprime un brouillon', async () => {
      const { DELETE } = await import('@/app/api/artiste/oeuvres/[slug]/route')
      const { auth } = await import('@/auth')
      const { envoyerEnCuration } = await import('@/lib/curation')
      await zone('Maroc')
      const brouillon = await complet('Brouillon DELETE')
      const enCuration = await complet('Curation DELETE')
      await envoyerEnCuration(ARTISTE as never, enCuration)
      acteur.courant = ARTISTE
      const appel = async (slug: string) => {
        vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'utilisateur-1' } } as never)
        return DELETE(new Request(`http://local/api/artiste/oeuvres/${slug}`, { method: 'DELETE' }) as never, { params: Promise.resolve({ slug }) })
      }
      expect((await appel(enCuration)).status).toBe(409)
      expect(await ligne(enCuration)).toBeDefined()
      expect((await appel(brouillon)).status).toBe(200)
      expect(await ligne(brouillon)).toBeUndefined()
    })
  })
})
