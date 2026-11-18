import type { EncaissementOuvrable } from './ports'

// Sélecteur de l'adaptateur d'encaissement (story 7.4, AD-4). Aucun prestataire n'est retenu (OQ-1 ouverte) :
// il renvoie `null`, et la page de paiement montre une zone neutre. La story 7.5 branchera ici l'adaptateur
// du prestataire retenu, le seul endroit hors `adaptateurs/` qui le choisira, sans jamais le nommer.

export function adaptateurEncaissement(): EncaissementOuvrable | null {
  return null
}
