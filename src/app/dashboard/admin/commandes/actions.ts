'use server'

import { acteurCourant } from '@/lib/acces'
import { heuresValides, libererVenteAssistee, poserVenteAssistee, renvoyerLienVenteAssistee, type ErreursCoordonnees } from '@/lib/commandes'
import { lireIdentifiants } from '@/lib/commandes/vente-assistee-regles'
import { fr, formaterDateHeure } from '@/lib/i18n'
import { DUREE_RESERVATION_VENTE_ASSISTEE_HEURES } from '@/lib/reglages'

// Vente assistée (story 6.3). Les droits (admin seulement, rôle relu en base, AD-15) sont vérifiés par
// le module commandes ; aucun détail technique ni adresse dans les réponses d'erreur.

export type SaisieFormulaireVente = { email: string; nom: string; pays: string; oeuvres: string; heures: string }
export type ResultatActionVente =
  | { ok: true; message: string; envoye: boolean }
  | { ok: false; message: string; erreurs?: ErreursCoordonnees }

export async function actionPoserVenteAssistee(saisie: SaisieFormulaireVente): Promise<ResultatActionVente> {
  const t = fr.venteAssistee
  const brut = typeof saisie?.heures === 'string' ? saisie.heures.trim() : ''
  const heures = brut === '' ? DUREE_RESERVATION_VENTE_ASSISTEE_HEURES : /^\d+$/.test(brut) ? heuresValides(Number(brut)) : null
  if (heures === null) return { ok: false, message: t.refus.invalide }
  try {
    const resultat = await poserVenteAssistee(await acteurCourant(), {
      email: String(saisie.email ?? ''),
      nom: String(saisie.nom ?? ''),
      pays: String(saisie.pays ?? ''),
      oeuvres: lireIdentifiants(String(saisie.oeuvres ?? '')),
      heures,
    })
    if (!resultat.ok) {
      switch (resultat.code) {
        case 'oeuvre_indisponible':
          return { ok: false, message: t.refus.oeuvre_indisponible(resultat.slug) }
        case 'non_livree':
          return { ok: false, message: t.refus.non_livree(resultat.slug) }
        case 'coordonnees_invalides':
          return { ok: false, message: t.refus.coordonnees_invalides, erreurs: resultat.erreurs }
        case 'devise_differente':
          return { ok: false, message: t.refus.monnaies_differentes }
        default:
          return { ok: false, message: t.refus[resultat.code] }
      }
    }
    return {
      ok: true,
      envoye: resultat.envoye,
      message: resultat.envoye ? t.succes(String(saisie.email).trim(), formaterDateHeure(resultat.echeance)) : t.emailNonParti,
    }
  } catch {
    return { ok: false, message: t.refus.indisponible }
  }
}

// Story 6.3 bis : libérer une réservation et renvoyer le lien. Droits vérifiés par le module commandes.
export type ResultatActionReservation = { ok: true; message: string } | { ok: false; message: string }

export async function actionLibererVenteAssistee(passageId: string): Promise<ResultatActionReservation> {
  const t = fr.venteAssistee.suivi
  try {
    const r = await libererVenteAssistee(await acteurCourant(), String(passageId ?? ''))
    if (!r.ok) return { ok: false, message: t.refus[r.code] }
    return { ok: true, message: r.liberees === 0 ? t.dejaTerminee : t.liberee }
  } catch {
    return { ok: false, message: t.refus.indisponible }
  }
}

export async function actionRenvoyerLien(passageId: string): Promise<ResultatActionReservation> {
  const t = fr.venteAssistee.suivi
  try {
    const r = await renvoyerLienVenteAssistee(await acteurCourant(), String(passageId ?? ''))
    if (!r.ok) return { ok: false, message: t.refus[r.code] }
    return r.envoye ? { ok: true, message: t.renvoyee } : { ok: false, message: fr.venteAssistee.emailNonParti }
  } catch {
    return { ok: false, message: t.refus.indisponible }
  }
}
