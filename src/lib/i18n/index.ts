// Module i18n (story 3.2, AD-18) : dictionnaire français typé et formats communs, locale `fr`,
// sans bibliothèque d'internationalisation. Pur : importable côté client comme côté serveur.
// Aucun sélecteur de langue ni de devise (OQ-6), aucun préfixe de langue dans les URL.

export { fr, type Dictionnaire } from './fr'
export {
  DATE_ABSENTE,
  ESPACE_FINE,
  SEPARATEUR,
  FUSEAU_PAR_DEFAUT,
  MONTANT_ABSENT,
  autreUnite,
  enCentimetres,
  enPouces,
  formaterDate,
  formaterDateHeure,
  formaterDimensions,
  formaterDimensionsDouble,
  formaterHeure,
  formaterMontant,
  type MillimetresAffiches,
  type OptionsDate,
} from './formats'
export {
  COOKIE_UNITE,
  DUREE_COOKIE_UNITE_S,
  UNITES,
  UNITE_PAR_DEFAUT,
  cookieUnite,
  estUnite,
  lireUnite,
  type Unite,
} from './unite'
