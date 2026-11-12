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

// Demande de sélection personnalisée (story 4.2, FR-8, décision du porteur du 2026-11-10) : délai de
// réponse annoncé (48 heures), limites d'envoi par IP et par e-mail (fenêtre glissante), et fenêtre
// où un même envoi répété (double appui) ne crée pas de seconde demande. Changer une valeur = une PR.
export const DELAI_REPONSE_DEMANDE_HEURES = 48
export const LIMITES_DEMANDE_SELECTION = { fenetreMinutes: 60, parIp: 5, parEmail: 3 } as const
export const DOUBLON_DEMANDE_MINUTES = 10

// Demande de visite (story 4.3, FR-8) : même délai annoncé (48 heures, décision du porteur du
// 2026-11-10), mêmes limites d'envoi que la sélection (compteurs distincts) et même fenêtre de doublon.
export const LIMITES_DEMANDE_VISITE = { fenetreMinutes: 60, parIp: 5, parEmail: 3 } as const

// « Me prévenir » sur une œuvre réservée (story 4.5, FR-9) : limites d'envoi (compteurs distincts :
// un même e-mail peut suivre plusieurs œuvres, d'où un seuil par e-mail un peu plus large) et durée du
// lien de désinscription de l'e-mail de confirmation (un an, comme celui de l'annonce d'ouverture).
export const LIMITES_INSCRIPTION_PREVENIR = { fenetreMinutes: 60, parIp: 10, parEmail: 5 } as const
export const DUREE_DESINSCRIPTION_ALERTE_JOURS = 365

// Conseil WhatsApp (story 4.4, FR-7, OQ-7, décision du porteur du 2026-11-10) : l'équipe répond du
// lundi au vendredi, de 9 h à 18 h, heure de Londres (`Europe/London`, heure d'été comprise ; jours
// 1 = lundi … 5 = vendredi), en moins de `DELAI_CONSEIL_HEURES` heures pendant ces horaires. Pas de
// jours fériés. Changer une valeur = une PR (ni écran d'administration, ni migration).
export const CONSEIL_HORAIRES = { fuseau: 'Europe/London', jours: [1, 2, 3, 4, 5], debut: 9, fin: 18 } as const
export const DELAI_CONSEIL_HEURES = 2

// Numéro WhatsApp Business : variable Vercel `WHATSAPP_NUMERO`, saisie par le porteur lui-même (comme
// LOT2_OUVERT, seul endroit qui la lit). Aucune valeur par défaut : absente ou vide, null. La
// validation et le lien `wa.me` sont dans `src/lib/conseil`. Jamais écrit dans le code, un test, une
// PR ni un journal.
export function numeroWhatsApp(env: Record<string, string | undefined> = process.env): string | null {
  const brut = env.WHATSAPP_NUMERO?.trim()
  return brut ? brut : null
}

// Mesure du tunnel (FR-27, AD-19, story 4.8) : clé d'API et adresse d'hébergement (UE) du prestataire
// de mesure, variables Vercel `MESURE_CLE` et `MESURE_ADRESSE` saisies par le porteur (seul endroit
// qui les lit ; jamais dans le code, un test, une PR ni un journal). Aucune valeur par défaut : absente
// ou invalide, null et rien ne part. L'adresse doit être en https (sans barre finale).
export function cleMesure(env: Record<string, string | undefined> = process.env): string | null {
  const brut = env.MESURE_CLE?.trim()
  return brut ? brut : null
}

export function adresseMesure(env: Record<string, string | undefined> = process.env): string | null {
  const brut = env.MESURE_ADRESSE?.trim().replace(/\/+$/, '')
  return brut && /^https:\/\/[^\s/]+$/.test(brut) ? brut : null
}

// Invitation des artistes (story 2.4, UXQ-8, décision du porteur du 2026-11-02) : durée de
// validité du lien, et adresse de « Écrire à l'équipe ».
export const DUREE_INVITATION_JOURS = 7
export const CONTACT_EQUIPE = 'contact@errancy.art'

// Annonce de l'ouverture (FR-35, story 4.9) : le lien de désinscription de l'e-mail reste valable un
// an (un contact qui l'ouvre tard doit encore pouvoir s'y fier) ; un envoi ne dépasse pas cette durée
// (limite d'une fonction Vercel) : les contacts non atteints restent à prévenir pour un second envoi.
export const DUREE_DESINSCRIPTION_JOURS = 365
export const DUREE_MAX_ANNONCE_SECONDES = 40

// Débit de l'annonce : pause entre deux envois (limite de débit du prestataire) et arrêt après cette
// série d'échecs consécutifs (panne probable : inutile d'insister).
export const PAUSE_ENTRE_ENVOIS_MS = 600
export const ECHECS_CONSECUTIFS_MAX = 5

// E-mails transactionnels (story 4.1, décision du porteur du 2026-11-10) : expéditeur « Errancy »,
// réponses reçues à l'adresse de l'équipe.
export const EXPEDITEUR_COURRIELS = `Errancy <${CONTACT_EQUIPE}>`
export const REPONSE_COURRIELS = CONTACT_EQUIPE

// Passage pendant la maintenance, décidé en edge par le middleware à partir du rôle du jeton :
// les admins voient tout ; les artistes seulement leur espace privé, pour déposer leurs œuvres
// avant l'ouverture (décision du porteur du 2026-11-02, story 2.4). Les pages /auth restent ouvertes, ainsi
// que /commande (lien de l'acheteur d'une vente assistée, décision du porteur du 2026-11-11, story 6.3 bis) :
// la maintenance reste pilotée par `MAINTENANCE_MODE`, rien ici ne la lève.
export function passeLaMaintenance(role: string | null, chemin: string): boolean {
  if (chemin === '/auth' || chemin.startsWith('/auth/')) return true
  if (chemin === '/commande' || chemin.startsWith('/commande/')) return true
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

// Réservation (story 6.2, FR-12, AD-7) : durée d'une réservation posée au paiement et plafond de
// réservations simultanées d'origine `paiement` par e-mail et par appareil (décision du porteur du
// 2026-11-11 ; la vente assistée de l'équipe n'est pas limitée).
export const DUREE_RESERVATION_PAIEMENT_MINUTES = 30
export const PLAFONDS_RESERVATION = { parEmail: 3, parAppareil: 3 } as const

// Vente assistée (story 6.3, FR-12) : durée de la réservation posée par l'équipe (48 h par défaut,
// réglable à la pose entre ces bornes) ; le lien envoyé à l'acheteur vit autant que la réservation.
export const DUREE_RESERVATION_VENTE_ASSISTEE_HEURES = 48
export const LIMITES_RESERVATION_VENTE_ASSISTEE_HEURES = { min: 1, max: 336 } as const

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
