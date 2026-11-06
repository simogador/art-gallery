import { prisma } from '@/lib/prisma'
import { EXPOSITION_VISIBLE, VISIBLE } from '@/lib/disponibilite'
import { mapExhibition, mapArtwork, mapArtist } from './mappers'
import { enCache, ETIQUETTE_CATALOGUE } from './cache'
import type { Exhibition, Artwork, Artist } from '@/lib/types'

// Pages publiques (story 2.2) : seules les œuvres visibles sont listées et comptées.
// Story 2.9 : une exposition n'apparaît que si elle contient au moins une œuvre visible.
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

// Story 3.4 : lectures en cache (étiquette de la liste, revalidate 60 s) ; le statut d'une exposition
// (à venir, en cours, passée) est donc calculé à la mise en cache, à 60 s près.
export async function getAllExhibitions(): Promise<Exhibition[]> {
  return enCache(['expositions'], [ETIQUETTE_CATALOGUE], async () => {
    const rows = await prisma.exhibition.findMany({
      where: EXPOSITION_VISIBLE,
      orderBy: [{ featured: 'desc' }, { startDate: 'desc' }],
      include: ARTWORK_INCLUDE,
    })
    return rows.map(mapExhibition)
  })
}

export async function getExhibitionBySlug(slug: string): Promise<Exhibition | null> {
  return enCache(['exposition', slug], [ETIQUETTE_CATALOGUE], async () => {
    const row = await prisma.exhibition.findFirst({
      where: { slug, ...EXPOSITION_VISIBLE },
      include: ARTWORK_INCLUDE,
    })
    return row ? mapExhibition(row) : null
  })
}

export async function getExhibitionArtworksBySlug(slug: string): Promise<Artwork[]> {
  return enCache(['exposition-oeuvres', slug], [ETIQUETTE_CATALOGUE], async () => {
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
  })
}

export async function getExhibitionArtistsBySlug(slug: string): Promise<Artist[]> {
  return enCache(['exposition-artistes', slug], [ETIQUETTE_CATALOGUE], async () => {
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
  })
}

export async function getRelatedExhibitions(slug: string, count = 3): Promise<Exhibition[]> {
  return enCache(['expositions-apparentees', slug, String(count)], [ETIQUETTE_CATALOGUE], async () => {
    const rows = await prisma.exhibition.findMany({
      where: { slug: { not: slug }, ...EXPOSITION_VISIBLE },
      orderBy: [{ featured: 'desc' }, { startDate: 'desc' }],
      take: count,
      include: ARTWORK_INCLUDE,
    })
    return rows.map(mapExhibition)
  })
}
