import { prisma } from '@/lib/prisma'
import { VISIBLE } from '@/lib/disponibilite'
import { mapExhibition, mapArtwork, mapArtist } from './mappers'
import type { Exhibition, Artwork, Artist } from '@/lib/types'

// Pages publiques (story 2.2) : seules les œuvres visibles sont listées et comptées.
const ARTWORK_INCLUDE = {
  artworks: {
    where: { artwork: VISIBLE },
    include: {
      artwork: {
        include: { artist: { select: { slug: true, name: true } } },
      },
    },
  },
  _count: { select: { artworks: { where: { artwork: VISIBLE } } } },
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
        where: { artwork: VISIBLE },
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
        where: { artwork: VISIBLE },
        include: {
          artwork: {
            include: {
              artist: {
                include: {
                  _count: { select: { artworks: { where: VISIBLE } } },
                  artworks: {
                    where: VISIBLE,
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
