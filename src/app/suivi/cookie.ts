// Cookie httpOnly qui porte le jeton `suivi` après l'échange du lien (story 7.7, AD-14). Chemin `/suivi` : il
// sert la page `/suivi` et la route d'échange `/suivi/<jeton>`, et n'est envoyé nulle part ailleurs. Posé par
// la route d'échange ou par l'action `ouvrirSuivi` de `/confirmation`, jamais par le client ; il expire à
// l'échéance du jeton.
export const COOKIE_SUIVI = 'suivi'
export const CHEMIN_COOKIE_SUIVI = '/suivi'

/**
 * Options du cookie `suivi`, les mêmes pour la route d'échange et pour l'action `ouvrirSuivi` : `httpOnly`,
 * `sameSite` lax, chemin `/suivi`, expiration = échéance du jeton, `secure` en production seulement (critère
 * unique : `NODE_ENV`).
 */
export function optionsCookieSuivi(echeance: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: CHEMIN_COOKIE_SUIVI,
    expires: echeance,
  }
}
