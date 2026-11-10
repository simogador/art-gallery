// Module notifications (story 4.1, AD-11, AQ-1) : port d'envoi d'e-mail, adaptateurs (prestataire
// en production, « journal » ailleurs), contenus et gestionnaires d'événements. Les gestionnaires
// sont reliés aux événements dans `src/lib/abonnements.ts`.

export { alerterEquipeDemande, envoyerAccuseDemande, envoyerInvitation, envoyerResultatCuration } from './gestionnaires'
export { choisirEnvoi } from './choix'
export type { Courriel, EnvoiCourriel, ResultatEnvoi } from './port'
