// Règles pures de la réservation (story 6.2, FR-12, AD-7) : échéances, plafond, codes de refus.
// Importable côté client : aucun accès à la base.

export type OrigineReservation = 'paiement' | 'vente_assistee' | 'priorite'
export type IssueReservation = 'expiree' | 'liberee' | 'confirmee' | 'interrompue'

export type CodeRefusReservation = 'liste_vide' | 'invalide' | 'oeuvre_indisponible' | 'plafond_atteint'

/** Une réservation est échue à l'instant exact de son échéance (l'échéance est exclue). */
export function estEchue(echeance: Date, maintenant: Date): boolean {
  return echeance.getTime() <= maintenant.getTime()
}

/** Échéance d'une réservation posée `maintenant` pour `minutes` minutes. */
export function echeanceApres(maintenant: Date, minutes: number): Date {
  return new Date(maintenant.getTime() + minutes * 60_000)
}

/** Le plafond est dépassé si les réservations actives d'autres passages plus les nouvelles excèdent `plafond`. */
export function plafondDepasse(actives: number, nouvelles: number, plafond: number): boolean {
  return actives + nouvelles > plafond
}

/** Adresse normalisée avant empreinte : espaces retirés, minuscules. */
export function normaliserEmailReservation(email: string): string {
  return email.trim().toLowerCase()
}
