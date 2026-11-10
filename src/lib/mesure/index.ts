// Module mesure (FR-27, AD-19, NFR-6, story 4.8) : événements typés, port `Mesure`, adaptateurs
// (prestataire en production, « journal » ailleurs), consentement du visiteur et compteur des choix.
// Les composants client importent seulement `./regles` et `./client` (purs).

export { NOMS_EVENEMENTS, EVENEMENTS_DU_NAVIGATEUR, estNomEvenement, slugValide } from './catalogue'
export type { EvenementEnvoye, EvenementMesure, NomEvenement } from './catalogue'
export type { Mesure } from './port'
export { choisirMesure } from './choix'
export { appliquerChoix, choixDuVisiteur, enregistrerArrivee, mesurer, mesurerDepuisAction } from './serveur'
export { compterChoix } from './compteur'
export {
  COOKIE_CHOIX,
  COOKIE_SOURCE,
  COOKIE_VISITEUR,
  cheminMesurable,
  lireChoix,
  slugDuChemin,
  sourceArrivee,
  type ChoixConsentement,
} from './regles'
