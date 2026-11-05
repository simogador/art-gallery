import { prisma } from '@/lib/prisma'
import {
  CHAMPS_ARTISTE_ACCORD, CHAMPS_ETAT, VENDUE, aUnAccord, codeEtat, contactEquipeSeulement, declarationsPossibles, estDisponible, estPubliee, estVendue, estVisible,
  libelleEtatArtiste, remiseEnVentePossible, type ArtisteAccord, type CodeEtat, type EtatOeuvre, type TypeDeclaration,
} from '@/lib/disponibilite'
import { centimesEnEuros, formaterDimensions } from './conversions'

// Lectures de l'espace artiste (story 2.1) : prix et dimensions viennent des colonnes exactes ;
// état (story 2.2) calculé par le module disponibilite.
// L'appelant a vérifié l'acteur (acteurCourant) ; userId est celui de l'acteur `artist`.

const CHAMPS_OEUVRE = {
  id: true, slug: true, title: true, year: true, medium: true,
  prixCentimes: true, hauteurMm: true, largeurMm: true, profondeurMm: true,
  featured: true, imageUrl: true, createdAt: true, ...CHAMPS_ETAT,
  // Story 2.9 : « visible » dépend aussi de l'accord signé de l'artiste.
  artist: { select: CHAMPS_ARTISTE_ACCORD },
} as const

type OeuvreLue = {
  id: string; slug: string; title: string; year: number; medium: string
  prixCentimes: number | null; hauteurMm: number | null; largeurMm: number | null; profondeurMm: number | null
  featured: boolean; imageUrl: string; createdAt: Date
  artist: ArtisteAccord
} & EtatOeuvre

/** État affiché à l'artiste (story 2.2), calculé par le module disponibilite. */
export type EtatAffiche = {
  /** Code des sept états : brouillon, en_curation, disponible (« Publiée »), reservee, vendue, vendue_ailleurs, retiree. */
  etat: CodeEtat
  /** « Brouillon », « En curation », « Publiée », « Réservée », « Vendue », « Vendue ailleurs », « Retirée ». */
  libelleEtat: string
  /** Publiée et disponible à la vente. */
  disponible: boolean
  /** Visible dans la galerie (publiée, non retirée, accord signé) : sa fiche publique existe. */
  visible: boolean
  /** Story 2.9 : publiée mais masquée du site public, faute d'accord signé enregistré (ou artiste inactif). */
  masqueeSansAccord: boolean
  /** Vendue (même règle que le chiffre d'affaires). */
  vendue: boolean
  /** Story 2.8 : déclarations proposées (« Vendue ailleurs », « Retirer de la vente »). */
  declarations: TypeDeclaration[]
  /** Story 2.8 : vendue par Errancy, seul « Écrire à l'équipe » est proposé (voir aussi ecrireAEquipe). */
  contactEquipe: boolean
  /** Story 2.8 : retirée, « Remettre en vente » (retour en curation). */
  remiseEnVente: boolean
}

function etatAffiche(e: EtatOeuvre & { artist: ArtisteAccord }): EtatAffiche {
  return {
    etat: codeEtat(e), libelleEtat: libelleEtatArtiste(e),
    disponible: estDisponible(e), visible: estVisible(e), masqueeSansAccord: estPubliee(e) && !aUnAccord(e.artist),
    vendue: estVendue(e),
    declarations: declarationsPossibles(e), contactEquipe: contactEquipeSeulement(e), remiseEnVente: remiseEnVentePossible(e),
  }
}

export type OeuvreArtiste = {
  id: string
  slug: string
  /** « Sans titre » pour un brouillon dont le titre n'est pas encore saisi (story 2.5). */
  title: string
  /** null pour un brouillon dont l'année n'est pas encore saisie (0 en base, story 2.5). */
  year: number | null
  medium: string
  /** Euros, pour formatPrice ; null sans prix. */
  prix: number | null
  /** Millimètres (story 3.2), affichés dans l'unité choisie par formaterDimensions de i18n. */
  hauteurMm: number | null
  largeurMm: number | null
  profondeurMm: number | null
  featured: boolean
  imageUrl: string
  createdAt: Date
} & EtatAffiche

function versOeuvreArtiste(w: OeuvreLue): OeuvreArtiste {
  return {
    id: w.id, slug: w.slug, title: w.title.trim() || 'Sans titre', year: w.year > 0 ? w.year : null,
    medium: w.medium,
    prix: centimesEnEuros(w.prixCentimes),
    hauteurMm: w.hauteurMm, largeurMm: w.largeurMm, profondeurMm: w.profondeurMm,
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
  /** Préremplissage du formulaire, toujours en cm (« 120 × 90 cm », relu par lireDimensions), vide sans hauteur ni largeur. */
  dimensions: string
  /** Millimètres, pour l'affichage dans l'unité choisie (story 3.2). */
  hauteurMm: number | null
  largeurMm: number | null
  profondeurMm: number | null
  /** Euros, pour le formulaire ; null sans prix. */
  price: number | null
  description: string
  imageUrl: string
} & EtatAffiche

// Formulaire d'édition : prix et dimensions lus dans les colonnes exactes seulement (story 2.10) ;
// une œuvre sans millimètres a un champ de dimensions vide.
export function versOeuvreAEditer(w: {
  slug: string; title: string; year: number; medium: string; description: string; imageUrl: string
  prixCentimes: number | null; hauteurMm: number | null; largeurMm: number | null; profondeurMm: number | null
  artist: ArtisteAccord
} & EtatOeuvre): OeuvreAEditer {
  return {
    slug: w.slug, title: w.title, year: w.year, medium: w.medium,
    dimensions: formaterDimensions(w),
    hauteurMm: w.hauteurMm, largeurMm: w.largeurMm, profondeurMm: w.profondeurMm,
    price: centimesEnEuros(w.prixCentimes),
    description: w.description, imageUrl: w.imageUrl,
    ...etatAffiche(w),
  }
}

const CHAMPS_EDITION = {
  slug: true, title: true, year: true, medium: true, description: true, imageUrl: true,
  artistId: true, ...CHAMPS_ETAT,
  artist: { select: CHAMPS_ARTISTE_ACCORD },
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
