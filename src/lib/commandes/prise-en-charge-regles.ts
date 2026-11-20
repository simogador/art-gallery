// Prise en charge d'une commande par l'artiste (story 8.1, FR-22, AD-10, AD-16) : règles pures, sans accès à la
// base, importables côté client. Le prénom montré à l'artiste est le premier mot du nom saisi par l'acheteur
// (décision 1A du porteur du 2026-11-19) ; l'échéance est stockée sur la commande, « dépassée » se calcule à la
// lecture (jamais de compte à rebours).

/** Signe affiché quand le nom saisi est vide. */
export const PRENOM_ABSENT = '—'

/** Premier mot du nom saisi (« Claire Martin » → « Claire ») ; vide → « — ». */
export function prenom(nom: string | null | undefined): string {
  const premier = typeof nom === 'string' ? nom.trim().split(/\s+/)[0] ?? '' : ''
  return premier === '' ? PRENOM_ABSENT : premier
}

/** L'échéance de prise en charge est passée (bornes incluses) ; sans échéance, jamais dépassée. */
export function echeanceDepassee(echeance: Date | null | undefined, maintenant: Date = new Date()): boolean {
  if (!(echeance instanceof Date) || Number.isNaN(echeance.getTime())) return false
  return echeance.getTime() <= maintenant.getTime()
}
