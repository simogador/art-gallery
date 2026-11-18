// Ports du paiement (story 6.4, FR-13, AD-4, AD-8) : interfaces seulement, sans accès à la base. Le
// prestataire de paiement n'est pas choisi (OQ-1 ouverte) : seul le constat manuel de l'équipe existe
// (`adaptateurs/constat-manuel.ts`). Aucun nom de prestataire hors de `adaptateurs/`.

/** Fait de paiement constaté, tel que le module `commandes` le traite (`traiterPaiementConstate`). */
export type FaitPaiementConstate = {
  /** Passage en caisse payé : un paiement couvre tout le passage. */
  passageId: string
  /** Origine du constat (nom de l'adaptateur). */
  source: string
  /** Référence du paiement chez la source : avec `source`, elle identifie le paiement une seule fois. */
  referenceExterne: string
  montantCentimes: number
  /** Devise du paiement ; absente, celle du passage. */
  devise?: string
  /** Utilisateur qui a constaté, si le constat est humain. */
  constatePar?: string
  constateLe: Date
}

/** Demande d'ouverture d'un paiement (story 7.4) : le montant est celui que `commandes` a lu par agrégat, jamais un autre. */
export type DemandeOuverturePaiement = { passageId: string; montantCentimes: number; devise: string }

/** Réponse de l'adaptateur : la référence qui l'identifie chez lui (avec `source`, elle est unique en base). */
export type ReponseOuverturePaiement = { ok: true; referenceExterne: string } | { ok: false }

/** Encaissement : produit des faits de paiement (constat manuel aujourd'hui, prestataire plus tard). */
export interface Encaissement {
  readonly source: string
  /**
   * Ouvre un paiement chez le prestataire (story 7.4, point d'entrée appelé par `commandes`). Absent pour le
   * constat manuel, qui n'ouvre rien : l'équipe constate après coup.
   */
  ouvrir?(demande: DemandeOuverturePaiement): Promise<ReponseOuverturePaiement>
}

/** Encaissement capable d'ouvrir un paiement : celui que le sélecteur renvoie quand un adaptateur est configuré. */
export type EncaissementOuvrable = Encaissement & Required<Pick<Encaissement, 'ouvrir'>>

/** Remboursement d'un paiement (story 6.5) : seule l'implémentation manuelle existe (`adaptateurs/constat-manuel.ts`). */
export interface Remboursement {
  rembourser(demande: { paiementId: string; montantCentimes: number }): Promise<{ ok: boolean; reference?: string }>
}

/** Reversement à l'artiste (hors périmètre de cette story, décision du porteur à venir). */
export interface Reversement {
  reverser(demande: { artistId: string; montantCentimes: number }): Promise<{ ok: boolean; reference?: string }>
}

/** Plus grand montant accepté (centimes) : la colonne est un entier PostgreSQL de 32 bits. */
export const MONTANT_MAX_CENTIMES = 2_147_483_647
