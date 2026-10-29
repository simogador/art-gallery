// Module catalogue (AD-8, story 2.1) : lectures du catalogue public et de l'espace artiste.
// Reprend l'ancien src/lib/db/. Prix et dimensions s'y lisent dans les colonnes exactes
// (prixCentimes, hauteurMm, largeurMm, profondeurMm).
// Composants client : importer ./conversions ou ./mappers (purs), jamais ce fichier, qui charge Prisma.

export { getAllArtworks, getArtworkBySlug, getRelatedArtworks } from './artworks'
export { getAllArtists, getArtistBySlug, getArtistArtworksBySlug } from './artists'
export {
  getAllExhibitions,
  getExhibitionBySlug,
  getExhibitionArtworksBySlug,
  getExhibitionArtistsBySlug,
  getRelatedExhibitions,
} from './exhibitions'
export {
  accueilArtiste,
  oeuvresDeLArtiste,
  oeuvreAEditer,
  versOeuvreAEditer,
  type AccueilArtiste,
  type OeuvreArtiste,
  type OeuvreAEditer,
} from './espace-artiste'
export * from './conversions'
export { gradient, accent } from './mappers'
