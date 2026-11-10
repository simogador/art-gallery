import type { Artist, Artwork, Exhibition, ArtMedium, ExhibitionStatus, PhotoFiche } from '@/lib/types'
import { centimesEnEuros } from './conversions'
import { formaterDate } from '@/lib/i18n/formats'
// Partie pure du module disponibilite : ce fichier reste importable par un composant client.
import { estDisponible, type EtatOeuvre } from '@/lib/disponibilite/etats'

/* ── Visual palettes (deterministic from slug) ─────────────────────────── */

const GRADIENTS = [
  'from-amber-200 to-orange-300',
  'from-stone-300 to-neutral-400',
  'from-slate-300 to-gray-400',
  'from-violet-300 to-purple-400',
  'from-sky-200 to-blue-300',
  'from-emerald-200 to-teal-300',
  'from-rose-200 to-pink-300',
  'from-indigo-200 to-blue-300',
]

const ACCENTS = ['#C9A84C', '#6B6B65', '#A8A8A2', '#7C3AED', '#3B82F6', '#059669', '#DC2626', '#0891B2']

function hash(s: string) {
  return s.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
}

export function gradient(slug: string) {
  return GRADIENTS[hash(slug) % GRADIENTS.length]
}

export function accent(slug: string) {
  return ACCENTS[hash(slug) % ACCENTS.length]
}

/* ── Medium normalizer ──────────────────────────────────────────────────── */

export function toArtMedium(medium: string): Exclude<ArtMedium, 'Tout'> {
  const m = medium.toLowerCase()
  if (m.includes('photo') || m.includes('tirage') || m.includes('cyanotype') || m.includes('argentique')) return 'Photographie'
  if (m.includes('installation') || m.includes('polystyrène') || m.includes('bronze') || m.includes('marbre') || m.includes('acier') || m.includes('verre')) return 'Sculpture'
  if (m.includes('numérique') || m.includes('algorithme') || m.includes('génératif') || m.includes('simulation')) return 'Art numérique'
  return 'Peinture'
}

/* ── Exhibition status ──────────────────────────────────────────────────── */

export function computeStatus(start: Date, end: Date): ExhibitionStatus {
  const now = new Date()
  if (now < start) return 'a-venir'
  if (now > end) return 'passee'
  return 'en-cours'
}

// « 4 novembre 2026 », heure de Paris (story 3.2 : formaterDate de i18n).
export function formatDate(date: Date): string {
  return formaterDate(date)
}

/* ── DB → UI type mappers ───────────────────────────────────────────────── */

type DbArtist = {
  id: string
  slug: string
  name: string
  nationality: string
  birthYear: number
  deathYear: number | null
  bio: string
  statement?: string | null
  formation?: string | null
  expositions?: string | null
  atelierUrl?: string | null
  featured: boolean
  imageUrl?: string | null
  _count?: { artworks: number }
  artworks?: { medium: string }[]
}

export function mapArtist(a: DbArtist): Artist {
  const worksCount = a._count?.artworks ?? a.artworks?.length ?? 0
  const primaryMedium = a.artworks?.length
    ? a.artworks.reduce<Record<string, number>>((acc, w) => {
        const d = toArtMedium(w.medium)
        acc[d] = (acc[d] ?? 0) + 1
        return acc
      }, {})
    : {}
  const discipline = Object.entries(primaryMedium).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'Art contemporain'

  return {
    id: a.slug,
    name: a.name,
    discipline,
    country: a.nationality,
    bio: a.bio.trim(),
    worksCount,
    // Story 3.11 : ni « années d'activité » ni compteur d'expositions déduits ; seulement ce que l'équipe a saisi.
    statement: a.statement?.trim() || null,
    formation: a.formation?.trim() || null,
    expositions: a.expositions?.trim() || null,
    atelierUrl: a.atelierUrl?.trim() || null,
    gradient: gradient(a.slug),
    featured: a.featured,
    imageUrl: a.imageUrl?.trim() || null,
  }
}

type DbArtwork = {
  id: string
  slug: string
  title: string
  year: number
  medium: string
  description: string
  imageUrl: string
  // Story 2.1 : prix et dimensions lus dans les colonnes exactes, jamais dans price ni dimensions.
  prixCentimes: number | null
  hauteurMm: number | null
  largeurMm: number | null
  profondeurMm: number | null
  featured: boolean
  engagementCertificat: boolean
  // Story 4.3 : l'artiste accepte les visites en atelier (null : non renseigné, donc non).
  visitesAtelier?: boolean | null
  // Story 3.10 : date de dépôt (Date, ou texte après l'aller-retour JSON du cache).
  createdAt?: Date | string
  artist: { slug: string; name: string; nationality?: string }
  // Story 3.9 : lus seulement par la galerie.
  ambiance?: string | null
  couleurDominante?: string | null
  // Story 3.5 : photos de prise de vue, présentes seulement quand la lecture les demande.
  photos?: { type: string; url: string; largeur: number | null; hauteur: number | null }[]
} & EtatOeuvre

/* ── Description de la fiche (story 3.8) ────────────────────────────────── */

/** Description : l'histoire (155 caractères) ; sans histoire, artiste, technique et année. */
export function descriptionFiche(a: { description: string; artist: string; technique: string; year: number }): string {
  const histoire = a.description.trim().replace(/\s+/g, ' ')
  if (histoire) return histoire.slice(0, 155)
  return [a.artist, a.technique, a.year > 0 ? String(a.year) : ''].filter(Boolean).join(', ')
}

/* ── Photos de la fiche (story 3.5) ─────────────────────────────────────── */

const ORDRE_PRISES: Record<string, number> = { mise_en_situation: 0, face_lumiere_du_jour: 1, gros_plan: 2 }

/**
 * Photos du carrousel : images seulement (la vidéo en est exclue), mise en situation en tête, puis
 * face, puis gros plan. Œuvre sans photo de prise de vue (déposée avant la story 2.5) : repli sur
 * `imageUrl`, une seule photo ; sans rien : liste vide.
 */
export function photosDeFiche(
  photos: { type: string; url: string; largeur: number | null; hauteur: number | null }[] | undefined,
  imageUrl: string | null,
): PhotoFiche[] {
  const images = (photos ?? [])
    .filter((p) => Object.hasOwn(ORDRE_PRISES, p.type) && p.url)
    .sort((a, b) => ORDRE_PRISES[a.type] - ORDRE_PRISES[b.type])
    .map((p): PhotoFiche => ({ url: p.url, type: p.type as PhotoFiche['type'], largeur: p.largeur, hauteur: p.hauteur }))
  if (images.length > 0) return images
  return imageUrl ? [{ url: imageUrl, type: 'principale', largeur: null, hauteur: null }] : []
}

/** Date de dépôt en ISO ; absente ou illisible : undefined (jamais d'exception). */
function dateDepot(d: Date | string | undefined): string | undefined {
  if (d === undefined) return undefined
  const t = new Date(d).getTime()
  return Number.isNaN(t) ? undefined : new Date(t).toISOString()
}

export function mapArtwork(w: DbArtwork): Artwork {
  return {
    id: w.slug,
    title: w.title,
    artist: w.artist.name,
    artistId: w.artist.slug,
    year: w.year,
    medium: toArtMedium(w.medium),
    technique: w.medium,
    ...(w.ambiance !== undefined ? { ambiance: w.ambiance } : {}),
    ...(w.couleurDominante !== undefined ? { couleurDominante: w.couleurDominante } : {}),
    ...(w.artist.nationality !== undefined ? { paysArtiste: w.artist.nationality } : {}),
    price: centimesEnEuros(w.prixCentimes) ?? 0,
    // Story 3.2 : millimètres, mis en forme à l'affichage dans l'unité choisie (formaterDimensions
    // de i18n) ; hauteur ou largeur vide : aucune taille affichée.
    hauteurMm: w.hauteurMm,
    largeurMm: w.largeurMm,
    profondeurMm: w.profondeurMm,
    description: w.description,
    certificat: w.engagementCertificat === true,
    visitesAtelier: w.visitesAtelier === true,
    tags: [],
    featured: w.featured,
    // Story 2.2 : « vendue » pour l'UI = non disponible (réservée, vendue ailleurs… comprises).
    sold: !estDisponible(w),
    ...(dateDepot(w.createdAt) ? { deposeLe: dateDepot(w.createdAt) } : {}),
    imageUrl: w.imageUrl ?? null,
    ...(w.photos ? { photos: photosDeFiche(w.photos, w.imageUrl ?? null) } : {}),
    gradient: gradient(w.slug),
    accentColor: accent(w.slug),
  }
}

type DbExhibition = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  description: string
  location: string
  startDate: Date
  endDate: Date
  featured: boolean
  artworks?: { artwork: { artist: { name: string } } }[]
  _count?: { artworks: number }
}

export function mapExhibition(e: DbExhibition): Exhibition {
  const artistNames = [...new Set(e.artworks?.map((a) => a.artwork.artist.name) ?? [])]
  return {
    id: e.slug,
    title: e.title,
    subtitle: e.subtitle ?? '',
    artists: artistNames,
    status: computeStatus(e.startDate, e.endDate),
    dateStart: formatDate(e.startDate),
    dateEnd: formatDate(e.endDate),
    venue: e.location,
    description: e.description,
    worksCount: e._count?.artworks ?? e.artworks?.length ?? 0,
    featured: e.featured,
    gradient: gradient(e.slug),
    accentColor: accent(e.slug),
  }
}

/* ── Accueil (story 2.9) ────────────────────────────────────────────────── */

/** Œuvre mise en avant : coup de cœur encore disponible, sinon la première disponible, sinon la première visible. */
export function oeuvreMiseEnAvant(oeuvres: Artwork[]): Artwork | null {
  return oeuvres.find((o) => o.featured && !o.sold) ?? oeuvres.find((o) => !o.sold) ?? oeuvres[0] ?? null
}

/** Sélection de l'équipe : œuvres marquées (`featured`) et encore disponibles, dans l'ordre reçu. */
export function selectionAccueil(oeuvres: Artwork[]): Artwork[] {
  return oeuvres.filter((o) => o.featured && !o.sold)
}

/** Nombre de dernières œuvres publiées montrées sur l'accueil. */
export const NOMBRE_NOUVEAUTES = 6

/**
 * Dernières œuvres : les plus récentes par date de dépôt (pas de date de publication en base), hors
 * sélection de l'équipe et hors œuvres vendues ; sans date, en dernier, dans l'ordre reçu.
 */
export function nouveautesAccueil(oeuvres: Artwork[], selection: Artwork[], nombre = NOMBRE_NOUVEAUTES): Artwork[] {
  const choisies = new Set(selection.map((o) => o.id))
  return oeuvres
    .filter((o) => !o.sold && !choisies.has(o.id))
    .map((o, i) => ({ o, i, t: Number.isNaN(Date.parse(o.deposeLe ?? '')) ? Number.NEGATIVE_INFINITY : Date.parse(o.deposeLe ?? '') }))
    .sort((a, b) => (b.t === a.t ? a.i - b.i : b.t > a.t ? 1 : -1))
    .slice(0, nombre)
    .map(({ o }) => o)
}
