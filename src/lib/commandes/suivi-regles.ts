// Frise d'une commande pour le suivi de l'acheteur (story 7.7, FR-15) : règles pures, sans accès à la base,
// importables côté client. Les dates des étapes faites sont lues en base par l'appelant (création de la
// commande, constat du paiement) ; la date de livraison n'est jamais qu'une date PRÉVUE, calculée à partir du
// délai figé sur les lignes (plus long minimum et plus long maximum) appliqué à la date du constat. Calcul de
// dates seulement, jamais de montant. Story 8.1 : étape « Prise en charge par l'artiste », faite et datée (date
// lue en base) entre le paiement et la livraison. Transporteur, numéro de suivi et expédition : stories 8.2 et 8.4.

export type EtatCommandeSuivi = 'confirmee' | 'prise_en_charge' | 'en_attente_paiement' | 'annulee'
export type CleEtape = 'recue' | 'paiement' | 'prise_en_charge' | 'livraison' | 'annulee'

export type EtapeSuivi = {
  cle: CleEtape
  faite: boolean
  /** Date réelle d'une étape faite ; début de la fenêtre pour la livraison prévue ; null si inconnue. */
  date: Date | null
  /** Fin de la fenêtre de livraison prévue (livraison seulement), sinon null. */
  fin: Date | null
}

/** Date `jours` jours plus tard (jours calendaires, heure UTC conservée). Entrée illisible : null. */
export function ajouterJours(date: Date | null | undefined, jours: number): Date | null {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()) || !Number.isInteger(jours) || jours < 0) return null
  const d = new Date(date.getTime())
  d.setUTCDate(d.getUTCDate() + jours)
  return d
}

/**
 * Étapes connues d'une commande, dans l'ordre : commande reçue, paiement constaté, livraison prévue. Une
 * commande annulée n'a que « reçue » et « annulée » (sans date : la base ne l'enregistre pas), avec « paiement
 * constaté » entre les deux si un paiement a été constaté pour le passage (story 6.5 : annulée après paiement,
 * remboursement à traiter). Un délai à 0 ou absent est INCONNU : pas de date de livraison ; `min` à 0 avec
 * `max` positif : seule la borne utile (fin) est donnée. La livraison prévue n'a de date que si le constat est
 * connu. Une commande prise en charge (8.1) a en plus l'étape `prise_en_charge`, faite à `priseEnChargeLe`, entre
 * le paiement et la livraison ; une commande confirmée non encore prise en charge n'a pas cette étape.
 */
export function construireFrise(p: {
  etat: EtatCommandeSuivi
  creeeLe: Date
  constateLe: Date | null
  delaiMinJours: number | null
  delaiMaxJours: number | null
  /** Date de la prise en charge par l'artiste (8.1), lue en base ; absente sauf pour `prise_en_charge`. */
  priseEnChargeLe?: Date | null
}): EtapeSuivi[] {
  const recue: EtapeSuivi = { cle: 'recue', faite: true, date: p.creeeLe, fin: null }
  if (p.etat === 'annulee') {
    const annulee: EtapeSuivi = { cle: 'annulee', faite: true, date: null, fin: null }
    return p.constateLe ? [recue, { cle: 'paiement', faite: true, date: p.constateLe, fin: null }, annulee] : [recue, annulee]
  }
  const priseEnCharge = p.etat === 'prise_en_charge'
  const confirmee = p.etat === 'confirmee' || priseEnCharge
  const min = typeof p.delaiMinJours === 'number' && p.delaiMinJours > 0 ? p.delaiMinJours : null
  const max = typeof p.delaiMaxJours === 'number' && p.delaiMaxJours > 0 ? p.delaiMaxJours : min
  const connu = confirmee && max !== null
  return [
    recue,
    { cle: 'paiement', faite: confirmee, date: confirmee ? p.constateLe : null, fin: null },
    ...(priseEnCharge ? [{ cle: 'prise_en_charge' as const, faite: true, date: p.priseEnChargeLe ?? null, fin: null }] : []),
    {
      cle: 'livraison',
      faite: false,
      date: connu && min !== null ? ajouterJours(p.constateLe, min) : null,
      fin: connu ? ajouterJours(p.constateLe, max) : null,
    },
  ]
}
