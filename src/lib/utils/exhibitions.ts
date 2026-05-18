import { EXHIBITIONS } from '@/data/exhibitions'
import { ARTWORKS }    from '@/data/artworks'
import { ARTISTS }     from '@/data/artists'
import type { Exhibition } from '@/lib/types'

export function getExhibitionById(id: string): Exhibition | undefined {
  return EXHIBITIONS.find((e) => e.id === id)
}

export function getRelatedExhibitions(exhibition: Exhibition, count = 3): Exhibition[] {
  return EXHIBITIONS
    .filter((e) => e.id !== exhibition.id)
    .sort((a, b) => {
      const sameStatus = +(b.status === exhibition.status) - +(a.status === exhibition.status)
      if (sameStatus !== 0) return sameStatus
      return +b.featured - +a.featured
    })
    .slice(0, count)
}

export function getExhibitionArtworks(exhibition: Exhibition) {
  return ARTWORKS.filter((a) => exhibition.artists.includes(a.artist))
}

export function getExhibitionArtistData(exhibition: Exhibition) {
  return ARTISTS.filter((a) => exhibition.artists.includes(a.name))
}
