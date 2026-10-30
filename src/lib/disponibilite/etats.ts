import type { Prisma } from '@/generated/prisma/client'

// Module disponibilite (AD-6, AD-7, story 2.2) : partie pure, sans accès à la base.
// Seule définition de « visible » et de « disponible », en prédicat (objet déjà lu) et en
// fragment de requête Prisma (filtre en base). Importable par un composant client
// (via catalogue/mappers) : n'importer ici que des types depuis Prisma.

export type Publication = 'brouillon' | 'en_curation' | 'publiee'
export type Disponibilite = 'disponible' | 'reservee' | 'vendue' | 'vendue_ailleurs' | 'retiree'

/** Les deux axes d'une œuvre. Colonnes vides (œuvre pas encore recopiée) : ni visible ni disponible. */
export type EtatOeuvre = { publication: Publication | null; disponibilite: Disponibilite | null }

/** Fragment de `select` : les colonnes nécessaires aux prédicats ci-dessous. */
export const CHAMPS_ETAT = { publication: true, disponibilite: true } as const

/** Visible : publiée et non retirée. Les colonnes vides ne sont jamais visibles. */
export const VISIBLE = {
  publication: 'publiee',
  disponibilite: { in: ['disponible', 'reservee', 'vendue', 'vendue_ailleurs'] },
} satisfies Prisma.ArtworkWhereInput

/** Disponible : publiée et disponible à la vente. */
export const DISPONIBLE = {
  publication: 'publiee',
  disponibilite: 'disponible',
} satisfies Prisma.ArtworkWhereInput

/** Retirée de la vente après publication : sa fiche redirige vers la page de l'artiste. */
export const RETIREE = {
  publication: 'publiee',
  disponibilite: 'retiree',
} satisfies Prisma.ArtworkWhereInput

/** Vendue (par Errancy ou marquée vendue par l'équipe) : chiffre d'affaires et comptages. */
export const VENDUE = { disponibilite: 'vendue' } satisfies Prisma.ArtworkWhereInput

/** Publiée (axe publication seul) : comptages de l'administration. */
export const PUBLIEE = { publication: 'publiee' } satisfies Prisma.ArtworkWhereInput

export function estVisible(e: EtatOeuvre): boolean {
  return e.publication === 'publiee' && e.disponibilite !== null && e.disponibilite !== 'retiree'
}

export function estDisponible(e: EtatOeuvre): boolean {
  return e.publication === 'publiee' && e.disponibilite === 'disponible'
}

export function estVendue(e: EtatOeuvre): boolean {
  return e.disponibilite === 'vendue'
}

/** Axe publication seul (bascule « Publiée / Brouillon » de l'administration). */
export function estPubliee(e: EtatOeuvre): boolean {
  return e.publication === 'publiee'
}

/** Axe disponibilité seul (bascule « Disponible / Vendue » de l'administration), quelle que soit la publication. */
export function estMarqueeDisponible(e: EtatOeuvre): boolean {
  return e.disponibilite === 'disponible'
}

/** Œuvre dont un des axes est encore vide (pas encore recopiée) : aucune écriture d'un seul axe. */
export function estRecopiee(e: EtatOeuvre): boolean {
  return e.publication !== null && e.disponibilite !== null
}

/** Bascule admin « Disponible / Vendue » possible seulement entre ces deux états ; les autres
 * (réservée, vendue ailleurs, retirée) ont leur propre parcours et s'affichent en lecture seule. */
export function basculePossible(e: EtatOeuvre): boolean {
  return e.disponibilite === 'disponible' || e.disponibilite === 'vendue'
}

/**
 * Ancienne colonne `available`, écrite en double jusqu'à la story 2.10 : égale à « disponible »,
 * pour que le code précédent, qui ne lit qu'elle, reste juste en cas de retour arrière.
 */
export function champAvailable(e: EtatOeuvre): { available: boolean } {
  return { available: estDisponible(e) }
}

/** Les sept états affichés à l'artiste, calculés à partir des deux axes. */
export type CodeEtat = 'brouillon' | 'en_curation' | Disponibilite

export const LIBELLES_ETAT: Record<CodeEtat, string> = {
  brouillon: 'Brouillon',
  en_curation: 'En curation',
  disponible: 'Disponible',
  reservee: 'Réservée',
  vendue: 'Vendue',
  vendue_ailleurs: 'Vendue ailleurs',
  retiree: 'Retirée',
}

// Colonnes vides (œuvre pas encore recopiée) : « Brouillon », puisqu'elle n'est pas visible.
export function codeEtat(e: EtatOeuvre): CodeEtat {
  if (e.publication === 'en_curation') return 'en_curation'
  if (e.publication !== 'publiee' || e.disponibilite === null) return 'brouillon'
  return e.disponibilite
}

export function libelleEtat(e: EtatOeuvre): string {
  return LIBELLES_ETAT[codeEtat(e)]
}
