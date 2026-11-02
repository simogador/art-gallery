// Règles du mot de passe à l'activation d'une invitation (story 2.4), sans accès à la base :
// partagées par le module, les messages et le formulaire.
export const LONGUEUR_MIN_MOT_DE_PASSE = 8
// bcrypt ignore tout au-delà de 72 octets : un mot de passe plus long serait tronqué sans le dire.
export const OCTETS_MAX_MOT_DE_PASSE = 72
