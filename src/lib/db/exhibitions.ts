import { prisma } from '@/lib/prisma'
import { mapExhibition, mapArtwork, mapArtist } from '@/lib/db/mappers'
import type { Exhibition, Artwork, Artist } from '@/lib/types'

const ARTWORK_INCLUDE = {
  artworks: {
    include: {
      artwork: {
        include: { artist: { select: { slug: true, name: true } } },
      },
    },
  },
  _count: { select: { artworks: true } },
} as const

export async function getAllExhibitions(): Promise<Exhibition[]> {
  const rows = await prisma.exhibition.findMany({
    orderBy: [{ featured: 'desc' }, { startDate: 'desc' }],
    include: ARTWORK_INCLUDE,
  })
  return rows.map(mapExhibition)
}

export async function getExhibitionBySlug(slug: string): Promise<Exhibition | null> {
  const row = await prisma.exhibition.findUnique({
    where: { slug },
    include: ARTWORK_INCLUDE,
  })
  return row ? mapExhibition(row) : null
}

export async function getExhibitionArtworksBySlug(slug: string): Promise<Artwork[]> {
  const row = await prisma.exhibition.findUnique({
    where: { slug },
    include: {
      artworks: {
        include: {
          artwork: { include: { artist: { select: { slug: true, name: true } } } },
        },
      },
    },
  })
  return row?.artworks.map((r) => mapArtwork(r.artwork)) ?? []
}

export async function getExhibitionArtistsBySlug(slug: string): Promise<Artist[]> {
  const row = await prisma.exhibition.findUnique({
    where: { slug },
    include: {
      artworks: {
        include: {
          artwork: {
            include: {
              artist: {
                include: {
                  _count: { select: { artworks: true } },
                  artworks: {
                    select: {
                      medium: true,
                      exhibitions: { select: { exhibitionId: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!row) return []
  const seen = new Set<string>()
  return row.artworks
    .map((r) => r.artwork.artist)
    .filter((a) => { if (seen.has(a.id)) return false; seen.add(a.id); return true })
    .map(mapArtist)
}

export async function getRelatedExhibitions(slug: string, count = 3): Promise<Exhibition[]> {
  const rows = await prisma.exhibition.findMany({
    where: { slug: { not: slug } },
    orderBy: [{ featured: 'desc' }, { startDate: 'desc' }],
    take: count,
    include: ARTWORK_INCLUDE,
  })
  return rows.map(mapExhibition)
}
