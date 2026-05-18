import { ARTISTS } from '@/data/artists'
import { ARTWORKS } from '@/data/artworks'
import type { Artist } from '@/lib/types'

export function getArtistById(id: string): Artist | undefined {
  return ARTISTS.find((a) => a.id === id)
}

export function getArtistArtworks(artistId: string) {
  return ARTWORKS.filter((a) => a.artistId === artistId)
}
