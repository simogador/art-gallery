// Unité des dimensions choisie par le visiteur (story 3.2) : cm par défaut, pouces sur demande.
// Mémorisée sur l'appareil dans le cookie `unite` (un an), lu par le serveur (layout racine) pour un
// rendu sans clignotement. Module pur : le cookie est passé en argument, jamais lu ici.

export const UNITES = ['cm', 'in'] as const
export type Unite = (typeof UNITES)[number]

export const UNITE_PAR_DEFAUT: Unite = 'cm'
export const COOKIE_UNITE = 'unite'
/** Un an, en secondes. */
export const DUREE_COOKIE_UNITE_S = 365 * 24 * 60 * 60

export function estUnite(valeur: unknown): valeur is Unite {
  return typeof valeur === 'string' && (UNITES as readonly string[]).includes(valeur)
}

/** Valeur du cookie → unité ; cookie absent ou invalide : cm. */
export function lireUnite(valeur: string | null | undefined): Unite {
  return estUnite(valeur) ? valeur : UNITE_PAR_DEFAUT
}

/** Texte à écrire dans document.cookie pour mémoriser l'unité un an sur tout le site. */
export function cookieUnite(unite: Unite): string {
  return `${COOKIE_UNITE}=${unite}; Path=/; Max-Age=${DUREE_COOKIE_UNITE_S}; SameSite=Lax`
}
