import { prisma } from '@/lib/prisma'
import {
  CHAMPS_ETAT, VENDUE, codeEtat, estDisponible, estVendue, estVisible, libelleEtat, type CodeEtat, type EtatOeuvre,
} from '@/lib/disponibilite'
import { centimesEnEuros, formaterDimensions } from './conversions'

// Lectures de l'espace artiste (story 2.1) : prix et dimensions viennent des colonnes exactes ;
// état (story 2.2) calculé par le module disponibilite.
// L'appelant a vérifié l'acteur (acteurCourant) ; userId est celui de l'acteur `artist`.

const CHAMPS_OEUVRE = {
  id: true, slug: true, title: true, year: true, medium: true,
  prixCentimes: true, hauteurMm: true, largeurMm: true, profondeurMm: true,
  featured: true, imageUrl: true, createdAt: true, ...CHAMPS_ETAT,
} as const

type OeuvreLue = {
  id: string; slug: string; title: string; year: number; medium: string
  prixCentimes: number | null; hauteurMm: number | null; largeurMm: number | null; profondeurMm: number | null
  featured: boolean; imageUrl: string; createdAt: Date
} & EtatOeuvre

/** État affiché à l'artiste (story 2.2), calculé par le module disponibilite. */
export type EtatAffiche = {
  /** Code des sept états : brouillon, en_curation, disponible, reservee, vendue, vendue_ailleurs, retiree. */
  etat: CodeEtat
  /** « Brouillon », « En curation », « Disponible », « Réservée », « Vendue », « Vendue ailleurs », « Retirée ». */
  libelleEtat: string
  /** Publiée et disponible à la vente. */
  disponible: boolean
  /** Visible dans la galerie (publiée, non retirée) : sa fiche publique existe. */
  visible: boolean
  /** Vendue (même règle que le chiffre d'affaires). */
  vendue: boolean
}

function etatAffiche(e: EtatOeuvre): EtatAffiche {
  return {
    etat: codeEtat(e), libelleEtat: libelleEtat(e),
    disponible: estDisponible(e), visible: estVisible(e), vendue: estVendue(e),
  }
}

export type OeuvreArtiste = {
  id: string
  slug: string
  title: string
  year: number
  medium: string
  /** Euros, pour formatPrice ; null sans prix. */
  prix: number | null
  /** « 120 × 90 cm », vide si les dimensions sont illisibles. */
  dimensions: string
  featured: boolean
  imageUrl: string
  createdAt: Date
} & EtatAffiche

function versOeuvreArtiste(w: OeuvreLue): OeuvreArtiste {
  return {
    id: w.id, slug: w.slug, title: w.title, year: w.year, medium: w.medium,
    prix: centimesEnEuros(w.prixCentimes),
    dimensions: formaterDimensions(w),
    featured: w.featured, imageUrl: w.imageUrl, createdAt: w.createdAt,
    ...etatAffiche(w),
  }
}

export type AccueilArtiste = {
  artiste: { id: string; slug: string; name: string }
  total: number
  recentes: OeuvreArtiste[]
  /** Somme exacte des prix des œuvres vendues, en centimes. */
  chiffreAffairesCentimes: number
}

export async function accueilArtiste(userId: string): Promise<AccueilArtiste | null> {
  const artiste = await prisma.artist.findFirst({
    where: { userId },
    select: {
      id: true, slug: true, name: true,
      artworks: { orderBy: { createdAt: 'desc' }, take: 5, select: CHAMPS_OEUVRE },
      _count: { select: { artworks: true } },
    },
  })
  if (!artiste) return null

  const vendues = await prisma.artwork.aggregate({
    where: { artistId: artiste.id, ...VENDUE },
    _sum: { prixCentimes: true },
  })

  return {
    artiste: { id: artiste.id, slug: artiste.slug, name: artiste.name },
    total: artiste._count.artworks,
    recentes: artiste.artworks.map(versOeuvreArtiste),
    chiffreAffairesCentimes: vendues._sum.prixCentimes ?? 0,
  }
}

export async function oeuvresDeLArtiste(
  userId: string,
): Promise<{ artiste: { id: string; slug: string; name: string }; oeuvres: OeuvreArtiste[] } | null> {
  const artiste = await prisma.artist.findFirst({
    where: { userId },
    select: { id: true, slug: true, name: true },
  })
  if (!artiste) return null

  const oeuvres = await prisma.artwork.findMany({
    where: { artistId: artiste.id },
    orderBy: { createdAt: 'desc' },
    select: CHAMPS_OEUVRE,
  })
  return { artiste, oeuvres: oeuvres.map(versOeuvreArtiste) }
}

export type OeuvreAEditer = {
  slug: string
  title: string
  year: number
  medium: string
  /** Texte prérempli : dimensions exactes, sinon l'ancien texte illisible à corriger. */
  dimensions: string
  /** Dimensions exactes formatées, vide si illisibles (affichage). */
  dimensionsLues: string
  /** Euros, pour le formulaire ; null sans prix. */
  price: number | null
  description: string
  imageUrl: string
} & EtatAffiche

// Formulaire d'édition : seule lecture des anciennes colonnes, pour ne rien perdre d'une valeur
// pas encore recopiée (prix) ou illisible (dimensions, à corriger à la main).
export function versOeuvreAEditer(w: {
  slug: string; title: string; year: number; medium: string; description: string; imageUrl: string
  dimensions: string; price: number | null
  prixCentimes: number | null; hauteurMm: number | null; largeurMm: number | null; profondeurMm: number | null
} & EtatOeuvre): OeuvreAEditer {
  const dimensionsLues = formaterDimensions(w)
  return {
    slug: w.slug, title: w.title, year: w.year, medium: w.medium,
    dimensions: dimensionsLues || w.dimensions,
    dimensionsLues,
    price: centimesEnEuros(w.prixCentimes) ?? w.price,
    description: w.description, imageUrl: w.imageUrl,
    ...etatAffiche(w),
  }
}

const CHAMPS_EDITION = {
  slug: true, title: true, year: true, medium: true, description: true, imageUrl: true,
  dimensions: true, price: true, artistId: true, ...CHAMPS_ETAT,
  prixCentimes: true, hauteurMm: true, largeurMm: true, profondeurMm: true,
} as const

// Œuvre de l'artiste à éditer ; null si elle n'existe pas ou appartient à un autre artiste.
export async function oeuvreAEditer(userId: string, slug: string): Promise<OeuvreAEditer | null> {
  const artiste = await prisma.artist.findFirst({ where: { userId }, select: { id: true } })
  if (!artiste) return null
  const oeuvre = await prisma.artwork.findUnique({ where: { slug }, select: CHAMPS_EDITION })
  if (!oeuvre || oeuvre.artistId !== artiste.id) return null
  return versOeuvreAEditer(oeuvre)
}
