import type { PrixLivre } from '@/lib/livraison/prix'

export type ArtMedium = 'Tout' | 'Peinture' | 'Sculpture' | 'Photographie' | 'Art numérique'

/** Prise de vue d'une photo de la fiche (story 3.5) ; `principale` : repli sur `Artwork.imageUrl`. */
export type PriseDeVue = 'mise_en_situation' | 'face_lumiere_du_jour' | 'gros_plan' | 'principale'

export interface PhotoFiche {
  url:     string
  type:    PriseDeVue
  largeur: number | null
  hauteur: number | null
}

export interface Artwork {
  id:          string
  title:       string
  artist:      string
  artistId:    string
  year:        number
  medium:      Exclude<ArtMedium, 'Tout'>
  technique:   string
  /** Ambiance et couleur dominante saisies au dépôt (codes de `curation/depot-regles`) ; galerie, story 3.9. */
  ambiance?:         string | null
  couleurDominante?: string | null
  /** Nationalité saisie de l'artiste (« pays de l'artiste » de la galerie, story 3.9). */
  paysArtiste?:      string
  price:       number
  /**
   * Prix livré vers le pays du visiteur (story 3.3), calculé par le module livraison ; absent quand
   * la page ne l'a pas demandé. Aucun composant ne calcule de prix.
   */
  prixLivre?:  PrixLivre
  /** Dimensions en millimètres (AD-5), affichées par formaterDimensions de i18n dans l'unité choisie. */
  hauteurMm:   number | null
  largeurMm:   number | null
  profondeurMm: number | null
  description: string
  /** L'artiste s'est engagé à fournir un certificat d'authenticité signé (`engagementCertificat`, story 3.6). */
  certificat:  boolean
  tags:        string[]
  featured:    boolean
  sold:        boolean
  /** Date de dépôt (ISO), pour classer les dernières œuvres de l'accueil (story 3.10) ; absente hors catalogue. */
  deposeLe?:   string
  imageUrl:    string | null
  /**
   * Photos de la fiche (story 3.5), images seulement, mise en situation d'abord ; absentes des
   * lectures qui ne les demandent pas (galerie, accueil).
   */
  photos?:     PhotoFiche[]
  /** Tailwind gradient classes used as image placeholder */
  gradient:    string
  accentColor: string
}

export type ExhibitionStatus = 'en-cours' | 'a-venir' | 'passee'

export interface Exhibition {
  id:          string
  title:       string
  subtitle:    string
  artists:     string[]
  status:      ExhibitionStatus
  dateStart:   string
  dateEnd:     string
  venue:       string
  description: string
  worksCount:  number
  featured:    boolean
  gradient:    string
  accentColor: string
}

export interface Artist {
  id:          string
  name:        string
  discipline:  string
  country:     string
  bio:         string
  /** Œuvres visibles de l'artiste (comptage réel). */
  worksCount:  number
  /** Démarche de l'artiste (story 3.11) ; absente : section non affichée. */
  statement?:   string | null
  /** Formation et expositions : textes libres de l'équipe (story 3.11) ; absents : sections non affichées. */
  formation?:   string | null
  expositions?: string | null
  /** Photo d'atelier (story 3.11). Jamais de coordonnées (site, e-mail, compte) : FR-8. */
  atelierUrl?:  string | null
  /** Tailwind gradient classes used as portrait placeholder */
  gradient:    string
  featured:    boolean
  /** Portrait (story 3.8, image de partage) ; absent ou vide : pas d'image. */
  imageUrl?:   string | null
}
