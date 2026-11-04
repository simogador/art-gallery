'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { acteurCourant } from '@/lib/acces'
import { messageRefusCuration, renvoyerOeuvre, validerOeuvre, type CodeRefusCuration } from '@/lib/curation'

// Décisions de curation (story 2.7). Les droits (admin seulement) et les transitions sont vérifiés
// par le module curation à partir de l'acteur relu en base (AD-15). En cas de succès, retour à la
// file avec un bandeau ; sinon, le message à afficher (et l'erreur du commentaire, reliée au champ).

export type EtatDecision = { ok: false; code: CodeRefusCuration; message: string; erreurCommentaire?: string } | null

function rafraichir() {
  // Œuvre publiée ou renvoyée : galerie, pages d'artistes, espace de l'artiste et administration.
  revalidatePath('/', 'layout')
}

export async function actionValider(slug: string, _etat: EtatDecision, formData: FormData): Promise<EtatDecision> {
  const resultat = await validerOeuvre(await acteurCourant(), slug, formData.getAll('controle'))
  if (!resultat.ok) return { ok: false, code: resultat.code, message: messageRefusCuration(resultat.code) }
  rafraichir()
  redirect('/dashboard/admin/oeuvres?decision=validee')
}

export async function actionRenvoyer(slug: string, _etat: EtatDecision, formData: FormData): Promise<EtatDecision> {
  const resultat = await renvoyerOeuvre(
    await acteurCourant(),
    slug,
    formData.get('commentaire'),
    formData.getAll('controle'),
  )
  if (!resultat.ok) {
    if (resultat.code === 'commentaire_invalide') {
      const erreur = resultat.erreur ?? messageRefusCuration(resultat.code)
      return { ok: false, code: resultat.code, message: erreur, erreurCommentaire: erreur }
    }
    return { ok: false, code: resultat.code, message: messageRefusCuration(resultat.code) }
  }
  rafraichir()
  redirect('/dashboard/admin/oeuvres?decision=renvoyee')
}
