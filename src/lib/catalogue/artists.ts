import { prisma } from '@/lib/prisma'
import { VISIBLE } from '@/lib/disponibilite'
import { mapArtist, mapArtwork } from './mappers'
import type { Artist, Artwork } from '@/lib/types'

// Pages publiques (story 2.2) : seules les œuvres visibles comptent et sont listées.
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
    orderBy: [{ featured: 'desc' }, { name: 'asc' }],
    include: ARTISTE_INCLUDE,
  })
  return rows.map(mapArtist)
}

export async function getArtistBySlug(slug: string): Promise<Artist | null> {
  const row = await prisma.artist.findUnique({
    where: { slug },
    include: ARTISTE_INCLUDE,
  })
  return row ? mapArtist(row) : null
}

export async function getArtistArtworksBySlug(slug: string): Promise<Artwork[]> {
  const rows = await prisma.artwork.findMany({
    where: { artist: { slug }, ...VISIBLE },
    orderBy: [{ featured: 'desc' }, { year: 'desc' }],
    include: { artist: { select: { slug: true, name: true } } },
  })
  return rows.map(mapArtwork)
}
