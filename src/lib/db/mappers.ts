import type { Artist, Artwork, Exhibition, ArtMedium, ExhibitionStatus } from '@/lib/types'

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

export function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
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
  featured: boolean
  _count?: { artworks: number }
  artworks?: { medium: string; exhibitions: { exhibitionId: string }[] }[]
}

export function mapArtist(a: DbArtist): Artist {
  const worksCount = a._count?.artworks ?? a.artworks?.length ?? 0
  const exhibitionIds = new Set(a.artworks?.flatMap((w) => w.exhibitions.map((e) => e.exhibitionId)) ?? [])
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
    bio: a.bio,
    worksCount,
    yearsActive: `${a.birthYear + 20} — ${a.deathYear ?? 'présent'}`,
    exhibitions: exhibitionIds.size,
    gradient: gradient(a.slug),
    featured: a.featured,
  }
}

type DbArtwork = {
  id: string
  slug: string
  title: string
  year: number
  medium: string
  dimensions: string
  description: string
  imageUrl: string
  price: number | null
  available: boolean
  featured: boolean
  artist: { slug: string; name: string }
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
    price: w.price ?? 0,
    size: w.dimensions,
    description: w.description,
    tags: [],
    featured: w.featured,
    sold: !w.available,
    imageUrl: w.imageUrl ?? null,
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
