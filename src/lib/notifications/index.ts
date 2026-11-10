// Module notifications (story 4.1, AD-11, AQ-1) : port d'envoi d'e-mail, adaptateurs (prestataire
// en production, « journal » ailleurs), contenus et gestionnaires d'événements. Les gestionnaires
// sont reliés aux événements dans `src/lib/abonnements.ts`.

export {
  alerterEquipeDemande,
  alerterEquipeVisite,
  envoyerAccuseDemande,
  envoyerAccuseVisite,
  envoyerInvitation,
  envoyerResultatCuration,
} from './gestionnaires'
export { annoncerOuverture, envoyerEssaiOuverture, type BilanAnnonce, type ResultatAnnonce, type ResultatEssai } from './annonce'
export { choisirEnvoi, envoiReel } from './choix'
export type { Courriel, EnvoiCourriel, ResultatEnvoi } from './port'
