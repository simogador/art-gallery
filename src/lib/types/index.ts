export type ArtMedium = 'Tout' | 'Peinture' | 'Sculpture' | 'Photographie' | 'Art numérique'

export interface Artwork {
  id:          string
  title:       string
  artist:      string
  artistId:    string
  year:        number
  medium:      Exclude<ArtMedium, 'Tout'>
  technique:   string
  price:       number
  size:        string
  description: string
  tags:        string[]
  featured:    boolean
  sold:        boolean
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
  worksCount:  number
  yearsActive: string
  exhibitions: number
  /** Tailwind gradient classes used as portrait placeholder */
  gradient:    string
  featured:    boolean
}
