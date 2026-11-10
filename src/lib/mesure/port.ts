import type { EvenementEnvoye } from './catalogue'

// Port de mesure (story 4.8, AD-19). Le reste du code ne connaît que ce port ; le prestataire n'existe
// que dans son adaptateur (`adaptateur-prestataire.ts`). Un envoi ne lève jamais d'erreur.

export interface Mesure {
  envoyer(evenement: EvenementEnvoye): Promise<void>
}
