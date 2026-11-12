// Module paiement (story 6.4, AD-4) : ports d'encaissement, de remboursement et de reversement, et
// l'adaptateur de constat manuel. La table `Paiement` reste au module `commandes` (décision de la 6.1).
export { MONTANT_MAX_CENTIMES } from './ports'
export type { Encaissement, FaitPaiementConstate, Remboursement, Reversement } from './ports'
export {
  LONGUEUR_MAX_REFERENCE,
  SOURCE_CONSTAT_MANUEL,
  constatManuel,
  constaterManuellement,
  remboursementManuel,
  lireReference,
} from './adaptateurs/constat-manuel'
