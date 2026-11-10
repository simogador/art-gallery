import type { EvenementEnvoye } from './catalogue'
import type { Mesure } from './port'

// Adaptateur « journal » (story 4.8, AD-22) : hors production (poste local, préversion, tests), rien
// ne part. Seul le nom de l'événement est journalisé : ni slug, ni source, ni identifiant du visiteur.

export const adaptateurJournal: Mesure = {
  async envoyer(evenement: EvenementEnvoye): Promise<void> {
    console.info('[mesure] événement non envoyé (hors production)', { nom: evenement.nom })
  },
}
