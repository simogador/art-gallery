import { prisma } from '@/lib/prisma'
import { ARTISTE_VISIBLE, VISIBLE } from '@/lib/disponibilite'
import { mapArtist, mapArtwork } from './mappers'
import type { Artist, Artwork } from '@/lib/types'

// Pages publiques (story 2.2) : seules les œuvres visibles comptent et sont listées.
// Story 2.9 : seuls les artistes visibles (accord signé, actifs, au moins une œuvre visible) apparaissent.
const ARTISTE_INCLUDE = {
  _count: { select: { artworks: { where: VISIBLE } } },
  artworks: {
    where: VISIBLE,
    select: {
      medium: true,
      exhibitions: { select: { exhibitionId: true } },
    },
  },
} as const

export async function getAllArtists(): Promise<Artist[]> {
  const rows = await prisma.artist.findMany({
    where: ARTISTE_VISIBLE,
    orderBy: [{ featured: 'desc' }, { name: 'asc' }],
    include: ARTISTE_INCLUDE,
  })
  return rows.map(mapArtist)
}

export async function getArtistBySlug(slug: string): Promise<Artist | null> {
  const row = await prisma.artist.findFirst({
    where: { slug, ...ARTISTE_VISIBLE },
    include: ARTISTE_INCLUDE,
  })
  return row ? mapArtist(row) : null
}

export async function getArtistArtworksBySlug(slug: string): Promise<Artwork[]> {
  const rows = await prisma.artwork.findMany({
    // AND : VISIBLE porte déjà une condition sur l'artiste, qu'un `artist` voisin écraserait.
    where: { AND: [VISIBLE, { artist: { slug } }] },
    orderBy: [{ featured: 'desc' }, { year: 'desc' }],
    include: { artist: { select: { slug: true, name: true } } },
  })
  return rows.map(mapArtwork)
}
