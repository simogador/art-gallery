// Expédition d'une commande par l'artiste (story 8.2, FR-22, OQ-5) : règles pures, sans accès à la base,
// importables côté client. Transporteur et numéro de suivi : textes libres requis (2 à 60 caractères, décision 2A
// du porteur) ; au-dessus du seuil d'assurance, la case « envoi assuré avec preuve de livraison » et la
// référence d'assurance (60 caractères au plus) sont obligatoires. Le seuil vient de `reglages`.

export const LONGUEUR_MIN = 2
export const LONGUEUR_MAX = 60

export type SaisieExpedition = {
  transporteur: string
  numeroSuivi: string
  envoiAssure: boolean
  referenceAssurance: string
}

export type ChampExpedition = 'transporteur' | 'numeroSuivi' | 'envoiAssure' | 'referenceAssurance'
export type ErreurChamp = 'requis' | 'trop_court' | 'trop_long' | 'assurance_requise'
export type ErreursExpedition = Partial<Record<ChampExpedition, ErreurChamp>>

export type ExpeditionValide = { transporteur: string; numeroSuivi: string; envoiAssure: boolean; referenceAssurance: string | null }

/** Espaces de bord retirés, espaces internes réduits à un seul. */
function nettoyer(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
}

/**
 * Le prix des œuvres dépasse le seuil d'assurance (strictement). Une autre devise que celle du seuil, un prix
 * illisible : traités comme au-dessus (prudence).
 */
export function assuranceRequise(prixCentimes: number | null | undefined, devise: string | null | undefined, seuil: { devise: string; centimes: number }): boolean {
  if (typeof prixCentimes !== 'number' || !Number.isFinite(prixCentimes)) return true
  if (typeof devise !== 'string' || devise.toUpperCase() !== seuil.devise.toUpperCase()) return true
  return prixCentimes > seuil.centimes
}

function erreurTexte(v: string): ErreurChamp | undefined {
  if (v === '') return 'requis'
  if ([...v].length < LONGUEUR_MIN) return 'trop_court'
  if ([...v].length > LONGUEUR_MAX) return 'trop_long'
  return undefined
}

/**
 * Valide la saisie. `assurance` : la commande est au-dessus du seuil. Sous le seuil, la case et la référence
 * sont facultatives (une référence saisie est conservée si la case est cochée, sinon ignorée).
 */
export function validerExpedition(brut: Partial<SaisieExpedition> | null | undefined, assurance: boolean):
  | { ok: true; valeur: ExpeditionValide }
  | { ok: false; erreurs: ErreursExpedition } {
  const transporteur = nettoyer(brut?.transporteur)
  const numeroSuivi = nettoyer(brut?.numeroSuivi)
  const reference = nettoyer(brut?.referenceAssurance)
  const envoiAssure = brut?.envoiAssure === true
  const erreurs: ErreursExpedition = {}
  const et = erreurTexte(transporteur)
  if (et) erreurs.transporteur = et
  const en = erreurTexte(numeroSuivi)
  if (en) erreurs.numeroSuivi = en
  if (assurance) {
    if (!envoiAssure) erreurs.envoiAssure = 'assurance_requise'
    if (reference === '') erreurs.referenceAssurance = 'assurance_requise'
  }
  if (reference !== '' && [...reference].length > LONGUEUR_MAX) erreurs.referenceAssurance = 'trop_long'
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs }
  const assure = envoiAssure
  return { ok: true, valeur: { transporteur, numeroSuivi, envoiAssure: assure, referenceAssurance: assure && reference !== '' ? reference : null } }
}
