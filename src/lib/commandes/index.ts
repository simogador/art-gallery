import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'

// Module commandes (FR-10, AD-3, AD-9, AR-10, story 6.1) : seul propriétaire de PassageEnCaisse,
// CoordonneesAcheteur, Commande, LigneCommande et Paiement. `creerPassageEnCaisse` ne contrôle aucun
// acteur : l'appelant (6.3, 7.2) le fait. L'ancienne table Order reste lue et écrite par le code actuel.

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
  lireLienVenteAssistee,
  lireRecapitulatifAssiste,
  poserVenteAssistee,
  preparerLienVenteAssistee,
  type CommandeRecapitulatif,
  type LienVenteAssistee,
  type LigneRecapitulatif,
  type Recapitulatif,
  type RefusVenteAssistee,
  type ResultatVenteAssistee,
  type SaisieVenteAssistee,
} from './vente-assistee'
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
