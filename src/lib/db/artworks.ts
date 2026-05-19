import { prisma } from '@/lib/prisma'
import { mapArtwork } from '@/lib/db/mappers'
import type { Artwork } from '@/lib/types'

export async function getAllArtworks(): Promise<Artwork[]> {
  const rows = await prisma.artwork.findMany({
    orderBy: [{ featured: 'desc' }, { year: 'desc' }],
    include: { artist: { select: { slug: true, name: true } } },
  })
  return rows.map(mapArtwork)
}

export async function getArtworkBySlug(slug: string): Promise<Artwork | null> {
  const row = await prisma.artwork.findUnique({
    where: { slug },
    include: { artist: { select: { slug: true, name: true } } },
  })
  return row ? mapArtwork(row) : null
}

export async function getRelatedArtworks(artwork: Artwork, count = 3): Promise<Artwork[]> {
  const rows = await prisma.artwork.findMany({
    where: {
      slug: { not: artwork.id },
      OR: [
        { artist: { slug: artwork.artistId } },
        { medium: { contains: artwork.technique?.split(' ')[0] ?? '' } },
      ],
    },
    take: count,
    orderBy: { featured: 'desc' },
    include: { artist: { select: { slug: true, name: true } } },
  })
  return rows.map(mapArtwork)
}
