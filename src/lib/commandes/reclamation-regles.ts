// Réclamation et retour (story 8.5, FR-30, FR-15, AD-10) : règles pures, sans accès à la base, importables côté
// client. Le délai de retour est stocké sur la commande (`retourAvant`, story 8.4) ; « échu » se calcule à la
// lecture, jamais par une tâche. Une réclamation ouverte dans le délai reste traitable après l'échéance.

export const MOTIFS_RECLAMATION = ['abimee', 'non_conforme', 'changement_avis'] as const
export type MotifReclamation = (typeof MOTIFS_RECLAMATION)[number]

export const ETATS_RECLAMATION = ['ouverte', 'acceptee', 'refusee'] as const
export type EtatReclamation = (typeof ETATS_RECLAMATION)[number]

/** Description du problème : 10 à 1 000 caractères, espaces de bord retirés. */
export const DESCRIPTION_RECLAMATION = { min: 10, max: 1000 } as const

/** Photos jointes (décision 1A) : 3 au plus, images seulement, 5 Mo au plus chacune. */
export const PHOTOS_RECLAMATION = { max: 3, octetsMax: 5 * 1024 * 1024 } as const
/** Formats acceptés par Cloudinary pour une photo de réclamation (signés avec l'envoi, revérifiés à l'enregistrement). */
export const FORMATS_PHOTO_RECLAMATION = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'] as const

export type ErreursReclamation = {
  motif?: 'invalide'
  description?: 'requis' | 'trop_court' | 'trop_long'
  photos?: 'trop' | 'invalide'
}

export function estMotifReclamation(valeur: unknown): valeur is MotifReclamation {
  return typeof valeur === 'string' && (MOTIFS_RECLAMATION as readonly string[]).includes(valeur)
}

/**
 * Saisie du signalement : motif de la liste fermée, description non vide (1 000 caractères au plus), nombre de
 * photos (3 au plus). Les photos elles-mêmes sont vérifiées par le module (signature de Cloudinary).
 */
export function validerReclamation(brut: { motif?: unknown; description?: unknown } | null | undefined, nombrePhotos: number):
  | { ok: true; motif: MotifReclamation; description: string }
  | { ok: false; erreurs: ErreursReclamation } {
  const erreurs: ErreursReclamation = {}
  if (!estMotifReclamation(brut?.motif)) erreurs.motif = 'invalide'
  const description = typeof brut?.description === 'string' ? brut.description.trim() : ''
  if (description === '') erreurs.description = 'requis'
  else if ([...description].length < DESCRIPTION_RECLAMATION.min) erreurs.description = 'trop_court'
  else if ([...description].length > DESCRIPTION_RECLAMATION.max) erreurs.description = 'trop_long'
  if (!Number.isInteger(nombrePhotos) || nombrePhotos < 0 || nombrePhotos > PHOTOS_RECLAMATION.max) erreurs.photos = 'trop'
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs }
  return { ok: true, motif: brut?.motif as MotifReclamation, description }
}

/**
 * Le délai de retour est échu (bornes incluses : à l'instant de `retourAvant`, il l'est). Sans date de fin (une
 * livraison d'avant la story 8.4, ou une date illisible), rien n'autorise un signalement : échu.
 */
export function delaiRetourEchu(retourAvant: Date | null | undefined, maintenant: Date = new Date()): boolean {
  if (!(retourAvant instanceof Date) || Number.isNaN(retourAvant.getTime())) return true
  return retourAvant.getTime() <= maintenant.getTime()
}

/** Le bouton « Signaler un problème » est proposé : commande livrée, délai non échu, aucune réclamation déjà déposée. */
export function peutSignalerProbleme(c: { etat: string; retourAvant: Date | null | undefined; aReclamation: boolean }, maintenant: Date = new Date()): boolean {
  return c.etat === 'livree' && !c.aReclamation && !delaiRetourEchu(c.retourAvant, maintenant)
}

/** Montant remboursé à la réception du retour : entier de centimes, strictement positif, jamais au-delà de l'allocation. */
export function montantRemboursable(montantCentimes: unknown, allocationCentimes: number): boolean {
  return typeof montantCentimes === 'number' && Number.isInteger(montantCentimes) && montantCentimes > 0 && montantCentimes <= allocationCentimes
}
