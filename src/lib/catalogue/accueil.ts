import { getAllArtworks } from './artworks'
import { getAllArtists } from './artists'
import { getAllExhibitions } from './exhibitions'
import { oeuvreMiseEnAvant, nouveautesAccueil, selectionAccueil } from './mappers'
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
  /** Sélection de l'équipe (story 3.10) : œuvres marquées et disponibles ; vide sans œuvre marquée. */
  selection: Artwork[]
  /** Dernières œuvres publiées (story 3.10), hors sélection et hors vendues. */
  nouveautes: Artwork[]
  chiffres: ChiffresAccueil
}


/**
 * `codePays` (cookie `pays`, lu par la page) donne à chaque vignette son prix livré, comme la galerie.
 * Sélection et nouveautés se lisent dans le catalogue visible (règle `VISIBLE`, cache de 60 s).
 */
export async function accueilPublic(codePays?: string): Promise<AccueilPublic> {
  const [oeuvres, artistes, expositions] = await Promise.all([getAllArtworks(codePays), getAllArtists(), getAllExhibitions()])
  const selection = selectionAccueil(oeuvres)
  return {
    oeuvres,
    artistes,
    expositions,
    miseEnAvant: oeuvreMiseEnAvant(oeuvres),
    selection,
    nouveautes: nouveautesAccueil(oeuvres, selection),
    chiffres: { oeuvres: oeuvres.length, artistes: artistes.length, expositions: expositions.length },
  }
}
