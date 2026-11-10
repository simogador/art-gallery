// Réglages lus côté serveur (AD-17). L'ouverture du Lot 2 est un geste du porteur,
// comme MAINTENANCE_MODE : variable Vercel LOT2_OUVERT.

// Seule fonction qui dit si le Lot 2 (achat en ligne) est ouvert : uniquement si
// LOT2_OUVERT vaut « oui ». Absente ou toute autre valeur : fermé.
export function lot2Ouvert(env: Record<string, string | undefined> = process.env): boolean {
  return env.LOT2_OUVERT?.trim().toLowerCase() === 'oui'
}

// Adresse publique du site (story 3.8, NFR-2) : base des adresses canoniques et du sitemap, jamais
// la requête. Changer de domaine = une PR.
export const URL_SITE = 'https://www.errancy.art'

/** Adresse absolue d'une page du site (`chemin` commence par « / »). */
export function urlAbsolue(chemin: string): string {
  return `${URL_SITE}${chemin}`
}

// Maintenance active (story 3.8) : règle partagée par le middleware et le sitemap. Active en
// production Vercel sauf MAINTENANCE_MODE=off ; MAINTENANCE_MODE=on la force ; aperçus et dev : site réel.
export function maintenanceActive(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.MAINTENANCE_MODE === 'off') return false
  if (env.MAINTENANCE_MODE === 'on') return true
  return env.VERCEL_ENV === 'production'
}

// Limitation des envois du formulaire « Me notifier » de la page de maintenance (FR-35) :
// au plus `parIp` envois par adresse IP et `parEmail` par e-mail sur `fenetreMinutes`.
export const LIMITES_INSCRIPTION_OUVERTURE = { fenetreMinutes: 60, parIp: 10, parEmail: 3 } as const

// Invitation des artistes (story 2.4, UXQ-8, décision du porteur du 2026-11-02) : durée de
// validité du lien, et adresse de « Écrire à l'équipe ».
export const DUREE_INVITATION_JOURS = 7
export const CONTACT_EQUIPE = 'contact@errancy.art'

// E-mails transactionnels (story 4.1, décision du porteur du 2026-11-10) : expéditeur « Errancy »,
// réponses reçues à l'adresse de l'équipe.
export const EXPEDITEUR_COURRIELS = `Errancy <${CONTACT_EQUIPE}>`
export const REPONSE_COURRIELS = CONTACT_EQUIPE

// Passage pendant la maintenance, décidé en edge par le middleware à partir du rôle du jeton :
// les admins voient tout ; les artistes seulement leur espace privé, pour déposer leurs œuvres
// avant l'ouverture (décision du porteur du 2026-11-02, story 2.4). Les pages /auth restent ouvertes.
export function passeLaMaintenance(role: string | null, chemin: string): boolean {
  if (chemin === '/auth' || chemin.startsWith('/auth/')) return true
  if (role === 'admin') return true
  return role === 'artist' && (chemin === '/dashboard/artiste' || chemin.startsWith('/dashboard/artiste/'))
}

// Délai de réponse de l'équipe après un envoi en curation, annoncé à l'artiste (story 2.6,
// décision du porteur du 2026-11-03) : « sous 7 jours ».
export const DELAI_REPONSE_CURATION_JOURS = 7

// Délai pendant lequel l'artiste peut annuler une déclaration « vendue ailleurs » ou « retirée »
// (story 2.8, décision du porteur du 2026-11-04) : au-delà, « Remettre en vente » (curation) ou
// « Écrire à l'équipe ».
export const DELAI_ANNULATION_DECLARATION_MINUTES = 15

// Format d'une œuvre sur la fiche (story 3.5, décision du porteur du 2026-11-07) : selon le plus
// grand côté (hauteur ou largeur), petit < 40 cm, grand > 100 cm, moyen entre les deux (bornes
// incluses). Changer un seuil = une PR (ni écran d'administration, ni migration).
export const SEUIL_FORMAT_PETIT_CM = 40
export const SEUIL_FORMAT_GRAND_CM = 100

/** Écart relatif de la hauteur et de la largeur en deçà duquel une œuvre est dite carrée (5 %). */
export const TOLERANCE_CARRE = 0.05

export type OrientationOeuvre = 'portrait' | 'paysage' | 'carre'
export type FormatOeuvre = 'petit' | 'moyen' | 'grand'

/** Orientation d'après hauteur et largeur (mm) ; null si l'une manque ou n'est pas positive. */
export function orientationOeuvre(hauteurMm: number | null, largeurMm: number | null): OrientationOeuvre | null {
  if (hauteurMm === null || largeurMm === null || hauteurMm <= 0 || largeurMm <= 0) return null
  if (Math.abs(hauteurMm - largeurMm) <= TOLERANCE_CARRE * Math.max(hauteurMm, largeurMm)) return 'carre'
  return hauteurMm > largeurMm ? 'portrait' : 'paysage'
}

/**
 * Format d'après le plus grand côté (mm) ; null si hauteur ou largeur manque. Les seuils sont ceux
 * de `reglages` ; le paramètre ne sert qu'aux tests.
 */
export function formatOeuvre(
  hauteurMm: number | null,
  largeurMm: number | null,
  seuilsCm: { petit: number; grand: number } = { petit: SEUIL_FORMAT_PETIT_CM, grand: SEUIL_FORMAT_GRAND_CM },
): FormatOeuvre | null {
  if (hauteurMm === null || largeurMm === null || hauteurMm <= 0 || largeurMm <= 0) return null
  const plusGrandMm = Math.max(hauteurMm, largeurMm)
  if (plusGrandMm < seuilsCm.petit * 10) return 'petit'
  if (plusGrandMm > seuilsCm.grand * 10) return 'grand'
  return 'moyen'
}
