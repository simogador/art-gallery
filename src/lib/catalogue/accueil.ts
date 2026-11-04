import { getAllArtworks } from './artworks'
import { getAllArtists } from './artists'
import { getAllExhibitions } from './exhibitions'
import { oeuvreMiseEnAvant } from './mappers'
import type { Artist, Artwork, Exhibition } from '@/lib/types'

// Story 2.9 : l'accueil ne montre que le catalogue réel (œuvres, artistes et expositions visibles,
// règle de disponibilite). Aucune valeur inventée : chiffres et œuvre mise en avant en sont tirés.

export type ChiffresAccueil = { oeuvres: number; artistes: number; expositions: number }

export type AccueilPublic = {
  oeuvres: Artwork[]
  artistes: Artist[]
  expositions: Exhibition[]
  /** Œuvre de la section d'ouverture ; null sans œuvre visible. */
  miseEnAvant: Artwork | null
  chiffres: ChiffresAccueil
}


export async function accueilPublic(): Promise<AccueilPublic> {
  const [oeuvres, artistes, expositions] = await Promise.all([getAllArtworks(), getAllArtists(), getAllExhibitions()])
  return {
    oeuvres,
    artistes,
    expositions,
    miseEnAvant: oeuvreMiseEnAvant(oeuvres),
    chiffres: { oeuvres: oeuvres.length, artistes: artistes.length, expositions: expositions.length },
  }
}
