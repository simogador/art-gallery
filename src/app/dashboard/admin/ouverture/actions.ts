'use server'

import { revalidatePath } from 'next/cache'
import { acteurCourant } from '@/lib/acces'
import { annoncerOuverture, envoyerEssaiOuverture, type BilanAnnonce } from '@/lib/notifications'
import { fr } from '@/lib/i18n'

// Annonce de l'ouverture (story 4.9, FR-35). Les droits (admin seulement, rôle relu en base, AD-15)
// sont vérifiés par le module notifications ; aucun détail technique ni adresse dans les réponses.

export type ResultatActionEssai = { ok: true; reel: boolean } | { ok: false; message: string }
export type ResultatActionAnnonce = { ok: true; bilan: BilanAnnonce } | { ok: false; message: string }

export async function actionEssaiOuverture(): Promise<ResultatActionEssai> {
  try {
    const resultat = await envoyerEssaiOuverture(await acteurCourant())
    if (!resultat.ok) return { ok: false, message: fr.ouverture.refus[resultat.code] }
    return { ok: true, reel: resultat.reel }
  } catch {
    return { ok: false, message: fr.ouverture.refus.indisponible }
  }
}

/** `nombre` : le nombre de contacts confirmé à l'écran ; seuls ces contacts (les plus anciens) sont traités. */
export async function actionAnnoncerOuverture(nombre: number): Promise<ResultatActionAnnonce> {
  if (!Number.isInteger(nombre) || nombre < 1) return { ok: false, message: fr.ouverture.refus.nombre_invalide }
  try {
    const resultat = await annoncerOuverture(await acteurCourant(), { max: nombre })
    if (!resultat.ok) return { ok: false, message: fr.ouverture.refus[resultat.code] }
    revalidatePath('/dashboard/admin/ouverture')
    revalidatePath('/dashboard/admin')
    return { ok: true, bilan: resultat.bilan }
  } catch {
    // Des e-mails ont pu partir : la page, rechargée, montre le nombre de contacts encore à prévenir.
    revalidatePath('/dashboard/admin/ouverture')
    return { ok: false, message: fr.ouverture.refus.indisponible }
  }
}
