// Cookie httpOnly qui rattache le navigateur d'un acheteur sans compte à son passage en caisse (story 7.3).
// Il porte le jeton `commande_publique` seul. Chemin `/` (story 7.6) : un seul cookie ne peut cibler deux
// préfixes (`/commande` et `/confirmation`), il est donc envoyé à toutes les routes ; le nom change (pas de
// cookie réel avant l'ouverture du Lot 2) parce qu'un même nom ne tient qu'une entrée par `cookies().set`.
export const COOKIE_PASSAGE = 'passage_acheteur'
export const CHEMIN_COOKIE_PASSAGE = '/'
