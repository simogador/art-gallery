import { slugValide } from './catalogue'

// Règles pures de la mesure (story 4.8), importables côté client : consentement, cookies, liste
// blanche de chemins, source d'arrivée. Aucun accès à la base ni aux requêtes.

export type ChoixConsentement = 'accepte' | 'refuse'

// Cookies. `mesure_choix` garde le choix du visiteur (un an) ; les deux autres sont des cookies de
// mesure, posés seulement après un « Accepter » et supprimés en cas de refus ou de retrait.
export const COOKIE_CHOIX = 'mesure_choix'
export const COOKIE_VISITEUR = 'mesure_id'
export const COOKIE_SOURCE = 'mesure_source'
export const COOKIES_DE_MESURE = [COOKIE_VISITEUR, COOKIE_SOURCE] as const
export const DUREE_CHOIX_SECONDES = 365 * 24 * 60 * 60

export function lireChoix(valeur: string | undefined | null): ChoixConsentement | null {
  if (valeur === 'oui') return 'accepte'
  if (valeur === 'non') return 'refuse'
  return null
}

export function valeurChoix(choix: ChoixConsentement): 'oui' | 'non' {
  return choix === 'accepte' ? 'oui' : 'non'
}

export function estChoix(valeur: unknown): valeur is ChoixConsentement {
  return valeur === 'accepte' || valeur === 'refuse'
}

// Liste blanche de chemins mesurables : accueil, galerie et fiches (et leur demande de visite),
// artistes, conseil. Jamais `/auth/invitation/<jeton>`, `/dashboard`, `/api` ni aucun autre chemin.
const CHEMINS_MESURABLES = [
  /^\/$/,
  /^\/galerie$/,
  /^\/galerie\/[a-z0-9-]+$/,
  /^\/galerie\/[a-z0-9-]+\/visite$/,
  /^\/artistes$/,
  /^\/artistes\/[a-z0-9-]+$/,
  /^\/conseil$/,
]

/** Chemin (sans paramètres ni ancre) autorisé à la mesure. */
export function cheminMesurable(chemin: unknown): boolean {
  return typeof chemin === 'string' && chemin.length <= 300 && CHEMINS_MESURABLES.some((r) => r.test(chemin))
}

/** Chemin d'une adresse complète ou relative, sans paramètres ni ancre ; null si illisible. */
export function cheminDe(adresse: string | null | undefined): string | null {
  if (!adresse) return null
  try {
    return new URL(adresse, 'https://site.invalide').pathname
  } catch {
    return null
  }
}

/** Slug d'œuvre d'un chemin de fiche (`/galerie/<slug>` ou `/galerie/<slug>/visite`), sinon null. */
export function slugDuChemin(chemin: string | null): string | null {
  const m = chemin ? /^\/galerie\/([a-z0-9-]+)(?:\/visite)?$/.exec(chemin) : null
  return m ? slugValide(m[1]) : null
}

/**
 * Source d'arrivée : `utm_source` (nettoyé), sinon le domaine du référent (jamais l'adresse
 * complète). Un référent du site lui-même ne compte pas : null.
 */
export function sourceArrivee(entree: { utm?: unknown; referent?: unknown; hotes: readonly string[] }): string | null {
  if (typeof entree.utm === 'string') {
    const utm = entree.utm.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40)
    if (utm) return utm
  }
  if (typeof entree.referent === 'string' && entree.referent.trim()) {
    try {
      const hote = new URL(entree.referent).hostname.toLowerCase().replace(/^www\./, '')
      if (!hote) return null
      const propres = entree.hotes.map((h) => h.toLowerCase().replace(/^www\./, '').replace(/:\d+$/, ''))
      return propres.includes(hote) ? null : hote.slice(0, 80)
    } catch {
      return null
    }
  }
  return 'direct'
}
