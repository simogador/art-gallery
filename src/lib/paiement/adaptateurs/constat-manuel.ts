import { MONTANT_MAX_CENTIMES, type Encaissement, type FaitPaiementConstate } from '../ports'

// Adaptateur « constat manuel » (story 6.4) : l'équipe constate un virement ou un lien de paiement reçu
// hors de l'application et en garde la trace (qui, quand, référence). Aucun appel externe.

export const SOURCE_CONSTAT_MANUEL = 'constat_manuel'

export const constatManuel: Encaissement = { source: SOURCE_CONSTAT_MANUEL }

export const LONGUEUR_MAX_REFERENCE = 120

/** Référence saisie : espaces de bord retirés, non vide, 120 caractères au plus, sans retour à la ligne. */
export function lireReference(saisie: unknown): string | null {
  if (typeof saisie !== 'string') return null
  const reference = saisie.trim()
  return reference !== '' && reference.length <= LONGUEUR_MAX_REFERENCE && !/[\r\n]/.test(reference) ? reference : null
}

/** Fait de paiement produit par un constat de l'équipe ; null si la référence ou le montant sont invalides. */
export function constaterManuellement(entree: {
  passageId: string
  reference: unknown
  montantCentimes: unknown
  par: string
  quand?: Date
}): FaitPaiementConstate | null {
  const reference = lireReference(entree.reference)
  const montant = entree.montantCentimes
  if (reference === null || typeof montant !== 'number' || !Number.isSafeInteger(montant) || montant <= 0 || montant > MONTANT_MAX_CENTIMES) return null
  return {
    passageId: entree.passageId,
    source: SOURCE_CONSTAT_MANUEL,
    referenceExterne: reference,
    montantCentimes: montant,
    constatePar: entree.par,
    constateLe: entree.quand ?? new Date(),
  }
}
