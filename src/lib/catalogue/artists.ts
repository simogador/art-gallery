import { prisma } from '@/lib/prisma'
import { ARTISTE_VISIBLE, DISPONIBLE, VISIBLE } from '@/lib/disponibilite'
import { prixLivresPourPays } from '@/lib/livraison'
import { mapArtist, mapArtwork } from './mappers'
import { enCache, ETIQUETTE_CATALOGUE, etiquetteArtiste } from './cache'
import type { Artist, Artwork } from '@/lib/types'

// Pages publiques (story 2.2) : seules les œuvres visibles comptent et sont listées.
// Story 2.9 : seuls les artistes visibles (accord signé, actifs, au moins une œuvre visible) apparaissent.
const ARTISTE_INCLUDE = {
  _count: { select: { artworks: { where: VISIBLE } } },
  artworks: {
    where: VISIBLE,
    select: { medium: true },
  },
} as const

export async function getAllArtists(): Promise<Artist[]> {
  const artistes = await enCache(['artistes'], [ETIQUETTE_CATALOGUE], async () => {
    const rows = await prisma.artist.findMany({
      where: ARTISTE_VISIBLE,
      orderBy: [{ featured: 'desc' }, { name: 'asc' }],
      include: ARTISTE_INCLUDE,
    })
    return rows.map(mapArtist)
  })
  return artistes
}

export async function getArtistBySlug(slug: string): Promise<Artist | null> {
  const id = await prisma.artist.findUnique({ where: { slug }, select: { id: true } })
  if (!id) return null
  return enCache(['artiste', slug], [etiquetteArtiste(id.id), ETIQUETTE_CATALOGUE], async () => {
    const row = await prisma.artist.findFirst({
      where: { slug, ...ARTISTE_VISIBLE },
      include: ARTISTE_INCLUDE,
    })
    return row ? mapArtist(row) : null
  })
}

// Story 3.11 (FR-19) : œuvres disponibles de l'artiste (les vendues, réservées et retirées n'y figurent
// pas). Avec `codePays` (cookie `pays` lu par la page), chacune porte son prix livré et son délai
// (module livraison, relu à chaque requête, jamais en cache).
export async function getArtistArtworksBySlug(slug: string, codePays?: string): Promise<Artwork[]> {
  const id = await prisma.artist.findUnique({ where: { slug }, select: { id: true } })
  if (!id) return []
  const rows = await enCache(['artiste-oeuvres-disponibles', slug], [etiquetteArtiste(id.id), ETIQUETTE_CATALOGUE], () =>
    prisma.artwork.findMany({
      // AND : VISIBLE porte déjà une condition sur l'artiste, qu'un `artist` voisin écraserait.
      where: { AND: [VISIBLE, DISPONIBLE, { artist: { slug } }] },
      orderBy: [{ featured: 'desc' }, { year: 'desc' }],
      include: { artist: { select: { slug: true, name: true } } },
    }),
  )
  if (codePays === undefined) return rows.map(mapArtwork)
  const prix = await prixLivresPourPays(codePays, rows.map((r) => r.id))
  return rows.map((r) => ({ ...mapArtwork(r), prixLivre: prix.get(r.id) }))
}
