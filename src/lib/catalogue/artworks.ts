import { prisma } from '@/lib/prisma'
import { ARTISTE_VISIBLE, RETIREE, VISIBLE } from '@/lib/disponibilite'
import { prixLivresPourPays } from '@/lib/livraison'
import { mapArtwork } from './mappers'
import { enCache, ETIQUETTE_CATALOGUE, etiquetteArtiste, etiquetteOeuvre } from './cache'
import type { Artwork } from '@/lib/types'

// Story 3.3 : avec `codePays` (cookie `pays` lu par la page), chaque œuvre porte son prix livré vers
// ce pays (`Artwork.prixLivre`), calculé par le module livraison (seul endroit du calcul).

export async function getAllArtworks(codePays?: string): Promise<Artwork[]> {
  // Pages publiques (stories 2.2, 2.9) : œuvres visibles seulement (publiées, non retirées, d'un
  // artiste avec accord signé et actif).
  // Story 3.4 : lignes en cache (étiquette de la liste) ; le prix livré, lui, est calculé à chaque requête.
  // Story 3.9 : la nationalité de l'artiste sert au filtre « pays de l'artiste » de la galerie.
  const rows = await enCache(['oeuvres', 'nationalite'], [ETIQUETTE_CATALOGUE], () =>
    prisma.artwork.findMany({
      where: VISIBLE,
      orderBy: [{ featured: 'desc' }, { year: 'desc' }],
      include: { artist: { select: { slug: true, name: true, nationality: true } } },
    }),
  )
  if (codePays === undefined) return rows.map(mapArtwork)
  const prix = await prixLivresPourPays(codePays, rows.map((r) => r.id))
  return rows.map((r) => ({ ...mapArtwork(r), prixLivre: prix.get(r.id) }))
}

// null si l'œuvre n'existe pas ou n'est pas visible (non publiée, ou retirée : voir artisteDOeuvreRetiree).
export async function getArtworkBySlug(slug: string, codePays?: string): Promise<Artwork | null> {
  // Story 3.4 : ids relus (léger, hors cache) pour étiqueter la lecture par œuvre et par artiste.
  const ids = await prisma.artwork.findUnique({ where: { slug }, select: { id: true, artistId: true } })
  if (!ids) return null
  const row = await enCache(
    ['oeuvre', slug],
    [etiquetteOeuvre(ids.id), etiquetteArtiste(ids.artistId), ETIQUETTE_CATALOGUE],
    () =>
      prisma.artwork.findFirst({
        where: { slug, ...VISIBLE },
        // Story 3.5 : photos du carrousel (le type `video` est écarté au mappage).
        include: {
          artist: { select: { slug: true, name: true } },
          photos: {
            select: { type: true, url: true, largeur: true, hauteur: true },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        },
      }),
  )
  if (!row) return null
  if (codePays === undefined) return mapArtwork(row)
  // Prix livré relu en base (prix et frais à jour), jamais tiré de la ligne en cache.
  const prix = await prixLivresPourPays(codePays, [row.id])
  return { ...mapArtwork(row), prixLivre: prix.get(row.id) }
}

export async function getRelatedArtworks(artwork: Artwork, count = 3, codePays?: string): Promise<Artwork[]> {
  const technique = artwork.technique?.split(' ')[0] ?? ''
  const rows = await enCache(['apparentees', artwork.id, artwork.artistId, technique, String(count)], [ETIQUETTE_CATALOGUE], () =>
    prisma.artwork.findMany({
      where: {
        ...VISIBLE,
        slug: { not: artwork.id },
        OR: [
          { artist: { slug: artwork.artistId } },
          { medium: { contains: technique } },
        ],
      },
      take: count,
      orderBy: { featured: 'desc' },
      include: { artist: { select: { slug: true, name: true } } },
    }),
  )
  if (codePays === undefined) return rows.map(mapArtwork)
  const prix = await prixLivresPourPays(codePays, rows.map((r) => r.id))
  return rows.map((r) => ({ ...mapArtwork(r), prixLivre: prix.get(r.id) }))
}

// Œuvre retirée après publication : slug de son artiste, vers lequel sa fiche redirige (permanentRedirect).
// Story 2.9 : seulement si la page de l'artiste est publique (accord signé, actif, au moins une autre
// œuvre visible) ; sinon null, et la fiche répond 404 plutôt que de rediriger vers une page en 404.
export async function artisteDOeuvreRetiree(slug: string): Promise<string | null> {
  const row = await enCache(['retiree', slug], [ETIQUETTE_CATALOGUE], () =>
    prisma.artwork.findFirst({
      where: { slug, ...RETIREE, artist: ARTISTE_VISIBLE },
      select: { artist: { select: { slug: true } } },
    }),
  )
  return row?.artist.slug ?? null
}
