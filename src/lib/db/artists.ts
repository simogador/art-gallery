import { prisma } from '@/lib/prisma'
import { mapArtist, mapArtwork } from '@/lib/db/mappers'
import type { Artist, Artwork } from '@/lib/types'

export async function getAllArtists(): Promise<Artist[]> {
  const rows = await prisma.artist.findMany({
    orderBy: [{ featured: 'desc' }, { name: 'asc' }],
    include: {
      _count: { select: { artworks: true } },
      artworks: {
        select: {
          medium: true,
          exhibitions: { select: { exhibitionId: true } },
        },
      },
    },
  })
  return rows.map(mapArtist)
}

export async function getArtistBySlug(slug: string): Promise<Artist | null> {
  const row = await prisma.artist.findUnique({
    where: { slug },
    include: {
      _count: { select: { artworks: true } },
      artworks: {
        select: {
          medium: true,
          exhibitions: { select: { exhibitionId: true } },
        },
      },
    },
  })
  return row ? mapArtist(row) : null
}

export async function getArtistArtworksBySlug(slug: string): Promise<Artwork[]> {
  const rows = await prisma.artwork.findMany({
    where: { artist: { slug } },
    orderBy: [{ featured: 'desc' }, { year: 'desc' }],
    include: { artist: { select: { slug: true, name: true } } },
  })
  return rows.map(mapArtwork)
}
