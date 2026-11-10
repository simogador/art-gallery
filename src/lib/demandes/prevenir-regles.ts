import { fr } from '@/lib/i18n'
import { normaliserEmail } from './email'

// Règles pures de l'inscription « Me prévenir » (story 4.5, FR-9) : partagées par le formulaire
// (validation à la sortie du champ) et par le serveur (qui revérifie tout). Aucun accès à la base.

export type ChampPrevenir = 'email'
export const CHAMPS_PREVENIR: readonly ChampPrevenir[] = ['email']

/** Saisie telle que le formulaire la porte : que des textes. */
export type EntreePrevenir = { email: string }
export type ValeurPrevenir = { email: string }
export type ErreursPrevenir = Partial<Record<ChampPrevenir, string>>

// Le caractère nul n'existe pas dans un texte PostgreSQL.
const texte = (v: unknown): string => (typeof v === 'string' ? v.replace(/\u0000/g, '') : '')

/** Rend une saisie quelconque (corps d'une requête) à la forme attendue : jamais d'exception. */
export function lireEntreePrevenir(brut: unknown): EntreePrevenir {
  const o = typeof brut === 'object' && brut !== null && !Array.isArray(brut) ? (brut as Record<string, unknown>) : {}
  return { email: texte(o.email) }
}

/** Message d'erreur d'un champ, ou null s'il est correct. */
export function erreurChampPrevenir(champ: ChampPrevenir, entree: EntreePrevenir): string | null {
  switch (champ) {
    case 'email':
      return normaliserEmail(entree.email) === null ? fr.prevenir.erreurs.emailInvalide : null
  }
}

export type ResultatValidationPrevenir = { ok: true; valeur: ValeurPrevenir } | { ok: false; erreurs: ErreursPrevenir }

export function validerPrevenir(brut: unknown): ResultatValidationPrevenir {
  const entree = lireEntreePrevenir(brut)
  const erreurs: ErreursPrevenir = {}
  for (const champ of CHAMPS_PREVENIR) {
    const message = erreurChampPrevenir(champ, entree)
    if (message) erreurs[champ] = message
  }
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs }
  return { ok: true, valeur: { email: normaliserEmail(entree.email) as string } }
}

/** Ordre d'arrivée : le plus ancien d'abord, départage par id (aucun numéro n'est stocké). */
export function comparerArrivee(a: { createdAt: Date; id: string }, b: { createdAt: Date; id: string }): number {
  const ecart = a.createdAt.getTime() - b.createdAt.getTime()
  if (ecart !== 0) return ecart
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Rang (à partir de 1) d'une inscription parmi celles d'une même œuvre ; 0 si elle n'y figure pas. */
export function rangParmi(id: string, inscriptions: { createdAt: Date; id: string }[]): number {
  const trie = [...inscriptions].sort(comparerArrivee)
  const i = trie.findIndex((x) => x.id === id)
  return i + 1
}
