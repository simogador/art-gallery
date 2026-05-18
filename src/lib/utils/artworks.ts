import { ARTWORKS } from '@/data/artworks'
import type { Artwork } from '@/lib/types'

export function getArtworkById(id: string): Artwork | undefined {
  return ARTWORKS.find((a) => a.id === id)
}

export function getRelatedArtworks(artwork: Artwork, count = 3): Artwork[] {
  return ARTWORKS
    .filter((a) => a.id !== artwork.id && (a.artistId === artwork.artistId || a.medium === artwork.medium))
    .slice(0, count)
}

export function formatPrice(price: number): string {
  return price.toLocaleString('fr-FR') + ' €'
}
