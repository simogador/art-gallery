import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'

// Module commandes (FR-10, AD-3, AD-9, AR-10, story 6.1) : seul propriétaire de PassageEnCaisse,
// CoordonneesAcheteur, Commande, LigneCommande et Paiement. `creerPassageEnCaisse` ne contrôle aucun
// acteur : l'appelant (6.3, 7.2) le fait.

export {
  creerPassageEnCaisse,
  type CommandeCreee,
  type EntreePassage,
  type RefusPassage,
  type ResultatPassage,
} from './passage'
export {
  abandonnerLienVenteAssistee,
  heuresValides,
  libererVenteAssistee,
  lireLienVenteAssistee,
  lireRecapitulatifAssiste,
  poserVenteAssistee,
  preparerLienVenteAssistee,
  renvoyerLienVenteAssistee,
  reservationsDeLEquipe,
  type JournalDeLEquipe,
  type LienVenteAssistee,
  type RefusVenteAssistee,
  type ResultatLiberationAssistee,
  type ResultatRenvoi,
  type VenteDeLEquipe,
  type ResultatVenteAssistee,
  type SaisieVenteAssistee,
} from './vente-assistee'
export {
  annulerPassagePublic,
  completerCoordonneesDuLien,
  completerCoordonneesDuPassage,
  lirePassagePublic,
  oublierPassagePublic,
  poserPassagePublic,
  reprendrePassagePublic,
  type PassagePublic,
  type RefusPassagePublic,
  type ResultatAnnulationPassage,
  type ResultatComplement,
  type ResultatPassagePublic,
  type ResultatReprise,
  type SaisiePassagePublic,
} from './passage-public'
export {
  lireRecapitulatifPaiement,
  ouvrirPaiement,
  type CommandePaiement,
  type RecapitulatifPaiement,
  type ResultatOuverturePaiement,
} from './paiement-acheteur'
export {
  etatGlobal,
  lireConfirmationPassage,
  type CommandeConfirmation,
  type Confirmation,
  type EtatCommandeConfirmation,
  type EtatConfirmation,
} from './confirmation'
export {
  abandonnerLienSuivi,
  emettreLienSuiviDeCommande,
  lireLienSuivi,
  lireSuiviPassage,
  ouvrirSuiviDuNavigateur,
  type CommandeSuivie,
  type Suivi,
} from './suivi'
export { ajouterJours, construireFrise, type CleEtape, type EtapeSuivi, type EtatCommandeSuivi } from './suivi-regles'
export { type CommandeRecapitulatif, type LigneRecapitulatif, type Recapitulatif } from './recapitulatif'
export {
  commandesEnAttenteDeLEquipe,
  incidentsDeLEquipe,
  traiterPaiementConstate,
  type CauseIncident,
  type CommandeEnAttente,
  type IncidentDeLEquipe,
  type ResultatPaiementConstate,
} from './paiement'
export {
  annulerCommande,
  annulerParLEquipe,
  marquerRemboursementEffectue,
  remboursementsDeLEquipe,
  type RemboursementDeLEquipe,
  type ResultatAnnulation,
  type ResultatAnnulationEquipe,
  type ResultatRemboursementEffectue,
} from './annulation'
export { annulerSuiteReservationAnnulee } from './reservation-annulee'
export {
  commandeDeLArtiste,
  commandesDeLArtiste,
  nombreAPrendreEnCharge,
  prendreEnCharge,
  type CommandeDeLArtiste,
  type DetailCommandeArtiste,
  type EtatCommandeArtiste,
  type ResultatCommandeArtiste,
  type ResultatCommandesArtiste,
  type ResultatNombre,
  type ResultatPriseEnCharge,
} from './prise-en-charge'
export { commandesDeLEquipe, type CommandeDeLEquipe, type CommandesDeLEquipe, type EtatCommandeEquipe } from './suivi-equipe'
export { MOTIF_ANNULATION, alertesDeRetard, validerMotif, type AlerteRetard, type ErreurMotif } from './suivi-equipe-regles'
export { marquerExpediee, type ResultatExpedition } from './expedition'
export {
  assuranceRequise,
  validerExpedition,
  type ChampExpedition,
  type ErreurChamp as ErreurChampExpedition,
  type ErreursExpedition,
  type SaisieExpedition,
} from './expedition-regles'
export { echeanceDepassee, prenom, PRENOM_ABSENT } from './prise-en-charge-regles'
export { ETAT_INITIAL, ETATS_COMMANDE, TRANSITIONS, transitionPermise, type EtatCommande } from './etats'
export { ALPHABET_NUMERO, FORME_NUMERO, PREFIXE_NUMERO, genererNumero } from './numero'
export {
  CHAMPS_COORDONNEES,
  LIMITES_COORDONNEES,
  erreurChampCoordonnees,
  lireEntreeCoordonnees,
  validerCoordonnees,
  type ChampCoordonnees,
  type EntreeCoordonnees,
  type ErreursCoordonnees,
  type ValeurCoordonnees,
} from './coordonnees-regles'

/** Commande et ses lignes figées, relues telles qu'écrites (jamais recalculées). */
export async function lireCommande(id: string, tx: Prisma.TransactionClient = prisma) {
  return tx.commande.findUnique({
    where: { id },
    include: { lignes: { orderBy: { createdAt: 'asc' } } },
  })
}
