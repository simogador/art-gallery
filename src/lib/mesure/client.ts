// Partie de la mesure importable côté navigateur (story 4.8) : adresse de la route, événement de
// réouverture de la bannière et envoi d'un événement. Aucun prestataire, aucun SDK : le navigateur
// ne parle qu'à notre route, qui relit le consentement.

export const ROUTE_MESURE = '/api/mesure'
/** Événement de fenêtre qui rouvre la bannière (lien « Gérer la mesure » du pied de page). */
export const EVENEMENT_GERER_MESURE = 'errancy:gerer-mesure'

/** Envoi sans attente ni erreur : n'empêche jamais l'ouverture de WhatsApp. */
export function signalerClicConseil(slug: string | null): void {
  try {
    void fetch(ROUTE_MESURE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'evenement', nom: 'ClicConseil', slug, chemin: window.location.pathname }),
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // Mesure facultative.
  }
}
