// Table de transitions d'états d'une commande (AD-9), seule du module commandes. Partie pure, sans
// accès à la base. Story 6.1 : création (état initial) ; story 6.4 : confirmation par le constat d'un
// paiement (`traiterPaiementConstate`) ; l'annulation (6.5, 6.6) viendra s'appuyer sur cette table.

export const ETATS_COMMANDE = ['en_attente_paiement', 'confirmee', 'annulee', 'historique'] as const
export type EtatCommande = (typeof ETATS_COMMANDE)[number]

/** État d'une commande à sa création par un passage en caisse. */
export const ETAT_INITIAL: EtatCommande = 'en_attente_paiement'

/** Transitions permises : une commande confirmée ou annulée ne bouge plus ; une annulée n'est jamais confirmée. */
export const TRANSITIONS: Readonly<Record<EtatCommande, readonly EtatCommande[]>> = {
  en_attente_paiement: ['confirmee', 'annulee'],
  confirmee: [],
  annulee: [],
  historique: [],
}

export function transitionPermise(de: EtatCommande, vers: EtatCommande): boolean {
  return TRANSITIONS[de].includes(vers)
}
