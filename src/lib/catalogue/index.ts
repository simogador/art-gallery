// Module catalogue (AD-8, story 2.1) : lectures du catalogue public et de l'espace artiste.
// Reprend l'ancien src/lib/db/. Prix et dimensions s'y lisent dans les colonnes exactes
// (prixCentimes, hauteurMm, largeurMm, profondeurMm). Pages publiques : œuvres visibles seulement,
// selon la définition du module disponibilite (stories 2.2 et 2.9 : accord signé de l'artiste requis).
// Story 2.9 : seule source des pages publiques ; src/data (démonstration) a été supprimé.
// Composants client : importer ./conversions ou ./mappers (purs), jamais ce fichier, qui charge Prisma.

export { accueilPublic, type AccueilPublic, type ChiffresAccueil } from './accueil'
export { getAllArtworks, getArtworkBySlug, getRelatedArtworks, artisteDOeuvreRetiree } from './artworks'
export { getAllArtists, getArtistBySlug, getArtistArtworksBySlug } from './artists'
export { lireGalerie, type GalerieLue } from './galerie'
export { adressesPubliques, type AdressesPubliques } from './adresses'
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
  type EtatAffiche,
} from './espace-artiste'
export * from './conversions'
export { gradient, accent, oeuvreMiseEnAvant } from './mappers'
