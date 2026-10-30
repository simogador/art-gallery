import { prisma } from '@/lib/prisma'
import { RETIREE, VISIBLE } from '@/lib/disponibilite'
import { mapArtwork } from './mappers'
import type { Artwork } from '@/lib/types'

export async function getAllArtworks(): Promise<Artwork[]> {
  // Pages publiques (story 2.2) : œuvres visibles seulement (publiées, non retirées).
  const rows = await prisma.artwork.findMany({
    where: VISIBLE,
    orderBy: [{ featured: 'desc' }, { year: 'desc' }],
    include: { artist: { select: { slug: true, name: true } } },
  })
  return rows.map(mapArtwork)
}

// null si l'œuvre n'existe pas ou n'est pas visible (non publiée, ou retirée : voir artisteDOeuvreRetiree).
export async function getArtworkBySlug(slug: string): Promise<Artwork | null> {
  const row = await prisma.artwork.findFirst({
    where: { slug, ...VISIBLE },
    include: { artist: { select: { slug: true, name: true } } },
  })
  return row ? mapArtwork(row) : null
}

export async function getRelatedArtworks(artwork: Artwork, count = 3): Promise<Artwork[]> {
  const rows = await prisma.artwork.findMany({
    where: {
      ...VISIBLE,
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

// Œuvre retirée après publication : slug de son artiste, vers lequel sa fiche redirige (permanentRedirect).
export async function artisteDOeuvreRetiree(slug: string): Promise<string | null> {
  const row = await prisma.artwork.findFirst({
    where: { slug, ...RETIREE },
    select: { artist: { select: { slug: true } } },
  })
  return row?.artist.slug ?? null
}
