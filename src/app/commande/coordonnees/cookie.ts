// Cookie httpOnly qui rattache le navigateur d'un acheteur sans compte à son passage en caisse (story 7.3).
// Il porte le jeton `commande_publique` ; même chemin que le cookie `commande` de la vente assistée.
export const COOKIE_PASSAGE = 'passage'
export const CHEMIN_COOKIE_PASSAGE = '/commande'
