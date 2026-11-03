import { createHash } from 'node:crypto'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  apercuDimensions,
  centimesEnSaisie,
  etatSections,
  nombreSectionsCompletes,
  orientation,
  refusFichier,
  validerChamp,
  type DonneesDepot,
} from '@/lib/curation/depot-regles'
import { MESSAGE_PRIX_INVALIDE } from '@/lib/catalogue/conversions'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 2.5 (FR-20) : dépôt d'une œuvre par son artiste — photos, informations, dimensions et prix.

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

  it('sections : trois saisissables, Expédition et Engagements à compléter (story 2.6)', () => {
    const vide: DonneesDepot = {
      titre: '', technique: '', annee: null, histoire: '', ambiance: null, couleurDominante: null,
      hauteurMm: null, largeurMm: null, profondeurMm: null, prixCentimes: null, photos: [],
    }
    expect(nombreSectionsCompletes(etatSections(vide))).toBe(0)
    const plein: DonneesDepot = {
      titre: 'T', technique: 'Huile', annee: 2024, histoire: 'H', ambiance: 'calme', couleurDominante: 'bleu',
      hauteurMm: 600, largeurMm: 800, profondeurMm: null, prixCentimes: 95_000,
      photos: ['face_lumiere_du_jour', 'gros_plan', 'mise_en_situation'],
    }
    const sections = etatSections(plein)
    expect(sections.map((s) => [s.titre, s.complet])).toEqual([
      ['Photos', true], ['Informations', true], ['Dimensions et prix', true], ['Expédition', false], ['Engagements', false],
    ])
    expect(etatSections({ ...plein, photos: ['face_lumiere_du_jour'] })[0].manques).toEqual([
      'Gros plan de la matière', 'Mise en situation avec repère d’échelle',
    ])
    expect(etatSections({ ...plein, ambiance: 'retiree-de-la-liste' })[1].complet).toBe(false)
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
    expect(etatSections(lu.depot).map((s) => s.complet)).toEqual([false, true, false, false, false])
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
})
