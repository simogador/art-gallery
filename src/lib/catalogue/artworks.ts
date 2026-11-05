import { prisma } from '@/lib/prisma'
import { ARTISTE_VISIBLE, RETIREE, VISIBLE } from '@/lib/disponibilite'
import { prixLivre, prixLivresPourPays } from '@/lib/livraison'
import { mapArtwork } from './mappers'
import type { Artwork } from '@/lib/types'

// Story 3.3 : avec `codePays` (cookie `pays` lu par la page), chaque œuvre porte son prix livré vers
// ce pays (`Artwork.prixLivre`), calculé par le module livraison (seul endroit du calcul).

export async function getAllArtworks(codePays?: string): Promise<Artwork[]> {
  // Pages publiques (stories 2.2, 2.9) : œuvres visibles seulement (publiées, non retirées, d'un
  // artiste avec accord signé et actif).
  const rows = await prisma.artwork.findMany({
    where: VISIBLE,
    orderBy: [{ featured: 'desc' }, { year: 'desc' }],
    include: { artist: { select: { slug: true, name: true } } },
  })
  if (codePays === undefined) return rows.map(mapArtwork)
  const prix = await prixLivresPourPays(codePays, rows.map((r) => r.id))
  return rows.map((r) => ({ ...mapArtwork(r), prixLivre: prix.get(r.id) }))
}

// null si l'œuvre n'existe pas ou n'est pas visible (non publiée, ou retirée : voir artisteDOeuvreRetiree).
export async function getArtworkBySlug(slug: string, codePays?: string): Promise<Artwork | null> {
  const row = await prisma.artwork.findFirst({
    where: { slug, ...VISIBLE },
    include: { artist: { select: { slug: true, name: true } } },
  })
  if (!row) return null
  if (codePays === undefined) return mapArtwork(row)
  return { ...mapArtwork(row), prixLivre: await prixLivre(row, codePays) }
}

export async function getRelatedArtworks(artwork: Artwork, count = 3, codePays?: string): Promise<Artwork[]> {
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
  if (codePays === undefined) return rows.map(mapArtwork)
  const prix = await prixLivresPourPays(codePays, rows.map((r) => r.id))
  return rows.map((r) => ({ ...mapArtwork(r), prixLivre: prix.get(r.id) }))
}

// Œuvre retirée après publication : slug de son artiste, vers lequel sa fiche redirige (permanentRedirect).
// Story 2.9 : seulement si la page de l'artiste est publique (accord signé, actif, au moins une autre
// œuvre visible) ; sinon null, et la fiche répond 404 plutôt que de rediriger vers une page en 404.
export async function artisteDOeuvreRetiree(slug: string): Promise<string | null> {
  const row = await prisma.artwork.findFirst({
    where: { slug, ...RETIREE, artist: ARTISTE_VISIBLE },
    select: { artist: { select: { slug: true } } },
  })
  return row?.artist.slug ?? null
}
