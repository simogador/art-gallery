import { assuranceRequise } from './expedition-regles'
import { ajouterJours } from './suivi-regles'

// Livraison constatée (story 8.4, FR-29, AD-10) : règles pures, sans accès à la base, importables côté client.
// Source de la constatation : l'acheteur (`acheteur`, sous le seuil d'assurance seulement), l'équipe d'après le
// suivi du transporteur (`equipe_suivi`, sous le seuil) ou d'après une preuve (`equipe_preuve`, référence saisie,
// seule source au-dessus du seuil). La preuve est une référence de 2 à 200 caractères (décision 3A), jamais un fichier.

export const SOURCES_LIVRAISON = ['acheteur', 'equipe_suivi', 'equipe_preuve'] as const
export type SourceLivraison = (typeof SOURCES_LIVRAISON)[number]
export type SourceEquipe = Exclude<SourceLivraison, 'acheteur'>

export const PREUVE = { min: 2, max: 200 } as const

export type ErreurPreuve = 'requis' | 'trop_court' | 'trop_long'
export type ErreursLivraison = { source?: 'invalide' | 'preuve_requise'; preuve?: ErreurPreuve }

/** Sources permises : au-dessus du seuil d'assurance (8.2), seule l'équipe, sur preuve saisie. */
export function sourcesPermises(prixCentimes: number | null | undefined, devise: string | null | undefined, seuil: { devise: string; centimes: number }): SourceLivraison[] {
  return assuranceRequise(prixCentimes, devise, seuil) ? ['equipe_preuve'] : [...SOURCES_LIVRAISON]
}

/** Fin du délai de retour : date de livraison + `jours` jours calendaires (null si la date est illisible). */
export function retourAvant(livreeLe: Date, jours: number): Date | null {
  return ajouterJours(livreeLe, jours)
}

function nettoyer(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
}

export function estSourceEquipe(v: unknown): v is SourceEquipe {
  return v === 'equipe_suivi' || v === 'equipe_preuve'
}

/**
 * Saisie de l'équipe. `auDessus` : le prix des œuvres dépasse le seuil d'assurance (preuve obligatoire). Une
 * preuve saisie est conservée si elle est lisible (facultative sous le seuil avec `equipe_suivi`, toujours
 * requise avec `equipe_preuve`). Refus : `preuve_requise` (au-dessus du seuil, source ou référence manquante) ou `invalide`.
 */
export function validerLivraison(
  brut: { source?: unknown; preuve?: unknown } | null | undefined,
  auDessus: boolean,
): { ok: true; source: SourceEquipe; preuve: string | null } | { ok: false; code: 'invalide' | 'preuve_requise'; erreurs: ErreursLivraison } {
  const source = brut?.source
  const preuve = nettoyer(brut?.preuve)
  const erreurs: ErreursLivraison = {}
  if (!estSourceEquipe(source)) erreurs.source = 'invalide'
  else if (auDessus && source !== 'equipe_preuve') erreurs.source = 'preuve_requise'
  const longueur = [...preuve].length
  const obligatoire = auDessus || source === 'equipe_preuve'
  if (preuve === '') {
    if (obligatoire) erreurs.preuve = 'requis'
  } else if (longueur < PREUVE.min) erreurs.preuve = 'trop_court'
  else if (longueur > PREUVE.max) erreurs.preuve = 'trop_long'
  if (Object.keys(erreurs).length > 0) {
    const manque = auDessus && (erreurs.source === 'preuve_requise' || erreurs.preuve === 'requis') && erreurs.source !== 'invalide' && erreurs.preuve !== 'trop_court' && erreurs.preuve !== 'trop_long'
    return { ok: false, code: manque ? 'preuve_requise' : 'invalide', erreurs }
  }
  return { ok: true, source: source as SourceEquipe, preuve: preuve === '' ? null : preuve }
}
