import { echeanceDepassee } from './prise-en-charge-regles'

// Commandes de l'équipe (story 8.3, FR-26, AD-10) : règles pures, sans accès à la base, importables côté client.
// Les échéances sont stockées sur la commande ; « en retard » se calcule à la lecture, jamais par une tâche.

export type AlerteRetard = 'prise_en_charge_en_retard' | 'expedition_en_retard'

/** Longueur du motif d'annulation par l'équipe (caractères, après suppression des espaces de bord). */
export const MOTIF_ANNULATION = { min: 10, max: 500 } as const

export type ErreurMotif = 'obligatoire' | 'trop_court' | 'trop_long'

/** Motif d'annulation : texte de 10 à 500 caractères. */
export function validerMotif(brut: unknown): { ok: true; motif: string } | { ok: false; erreur: ErreurMotif } {
  const motif = typeof brut === 'string' ? brut.trim() : ''
  if (motif === '') return { ok: false, erreur: 'obligatoire' }
  if (motif.length < MOTIF_ANNULATION.min) return { ok: false, erreur: 'trop_court' }
  if (motif.length > MOTIF_ANNULATION.max) return { ok: false, erreur: 'trop_long' }
  return { ok: true, motif }
}

/**
 * Alertes de retard d'une commande, calculées à la lecture : prise en charge au-delà de l'échéance (commande
 * encore `confirmee`), expédition au-delà de `expedieAvant` (`confirmee` ou `prise_en_charge`, pas encore expédiée).
 * Une commande sans échéance (ancienne) ne donne aucune alerte.
 */
export function alertesDeRetard(
  commande: { etat: string; priseEnChargeAvant: Date | null; expedieAvant: Date | null },
  maintenant: Date = new Date(),
): AlerteRetard[] {
  const alertes: AlerteRetard[] = []
  if (commande.etat === 'confirmee' && echeanceDepassee(commande.priseEnChargeAvant, maintenant)) alertes.push('prise_en_charge_en_retard')
  if ((commande.etat === 'confirmee' || commande.etat === 'prise_en_charge') && echeanceDepassee(commande.expedieAvant, maintenant)) alertes.push('expedition_en_retard')
  return alertes
}
