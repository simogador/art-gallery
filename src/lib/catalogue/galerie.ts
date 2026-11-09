import { getAllArtworks } from './artworks'
import {
  appliquerFiltres,
  lireFiltres,
  optionsDepuis,
  type FiltresGalerie,
  type OptionsGalerie,
  type ParametresAdresse,
} from './filtres'
import type { Artwork } from '@/lib/types'

// Galerie filtrée (story 3.9) : lit le catalogue visible avec son prix livré vers `codePays`
// (`getAllArtworks`, le même calcul que la fiche, story 3.3), puis filtre, trie et pagine en
// mémoire (volume d'un catalogue de galerie ; à repasser en SQL si le catalogue grossit).

export type GalerieLue = {
  filtres: FiltresGalerie
  options: OptionsGalerie
  /** Œuvres visibles, tous filtres confondus. */
  totalCatalogue: number
  /** Œuvres qui passent les filtres. */
  total: number
  /** Les `filtres.n` premières. */
  oeuvres: Artwork[]
}

export async function lireGalerie(codePays: string, params: ParametresAdresse): Promise<GalerieLue> {
  const catalogue = await getAllArtworks(codePays)
  const options = optionsDepuis(catalogue)
  const filtres = lireFiltres(params, options)
  const filtrees = appliquerFiltres(catalogue, filtres)
  return {
    filtres,
    options,
    totalCatalogue: catalogue.length,
    total: filtrees.length,
    oeuvres: filtrees.slice(0, filtres.n),
  }
}
