// Table de transitions d'états d'une commande (AD-9), seule du module commandes. Partie pure, sans
// accès à la base. Story 6.1 : création (état initial) ; story 6.4 : confirmation par le constat d'un
// paiement (`traiterPaiementConstate`) ; l'annulation (6.5, 6.6) s'appuie sur cette table ; story 8.1 : prise
// en charge par l'artiste (`prendreEnCharge`) ; story 8.2 : expédition (`marquerExpediee`) ; story 8.3 : annulation par l'équipe d'une confirmée ou prise en charge ; story 8.4 : livraison constatée (`expediee` → `livree`) ; story 8.5 : retour reçu après une réclamation acceptée (`livree` → `retournee`).

export const ETATS_COMMANDE = ['en_attente_paiement', 'confirmee', 'prise_en_charge', 'expediee', 'livree', 'retournee', 'annulee', 'historique'] as const
export type EtatCommande = (typeof ETATS_COMMANDE)[number]

/** État d'une commande à sa création par un passage en caisse. */
export const ETAT_INITIAL: EtatCommande = 'en_attente_paiement'

/** Transitions permises : une confirmée est prise en charge (8.1) ou annulée par l'équipe (8.3, comme une prise en charge) ; une annulée n'est jamais confirmée. */
export const TRANSITIONS: Readonly<Record<EtatCommande, readonly EtatCommande[]>> = {
  en_attente_paiement: ['confirmee', 'annulee'],
  confirmee: ['prise_en_charge', 'annulee'],
  prise_en_charge: ['expediee', 'annulee'],
  expediee: ['livree'],
  livree: ['retournee'],
  retournee: [],
  annulee: [],
  historique: [],
}

export function transitionPermise(de: EtatCommande, vers: EtatCommande): boolean {
  return TRANSITIONS[de].includes(vers)
}
