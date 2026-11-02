'use server'

import { revalidatePath } from 'next/cache'
import { acteurCourant } from '@/lib/acces'
import {
  enregistrerChamp,
  enregistrerPhoto,
  estChampDepot,
  messageRefusDepot,
  preparerEnvoiPhoto,
  type DepotLu,
  type EnvoiSigne,
  type RefusDepot,
} from '@/lib/curation'

// Actions serveur du formulaire de dépôt (story 2.5). Les droits (artiste propriétaire, brouillon
// seulement) sont vérifiés par le module curation à partir de l'acteur relu en base (AD-15).

export type RefusAction = { ok: false; code: RefusDepot['code']; message: string }
export type ReponseDepot = { ok: true; depot: DepotLu } | RefusAction
export type ReponseEnvoi = { ok: true; slug: string; envoi: EnvoiSigne } | RefusAction

function refus(r: RefusDepot): RefusAction {
  return { ok: false, code: r.code, message: r.erreur ?? messageRefusDepot(r.code) }
}

const slugOuNull = (slug: unknown): string | null => (typeof slug === 'string' && slug ? slug : null)

function rafraichir() {
  revalidatePath('/dashboard/artiste', 'layout')
}

export async function actionEnregistrerChamp(slug: unknown, champ: unknown, valeur: unknown): Promise<ReponseDepot> {
  if (!estChampDepot(champ)) return refus({ ok: false, code: 'valeur_invalide' })
  const resultat = await enregistrerChamp(await acteurCourant(), slugOuNull(slug), champ, valeur)
  if (!resultat.ok) return refus(resultat)
  rafraichir()
  return resultat
}

export async function actionPreparerEnvoi(slug: unknown, type: unknown): Promise<ReponseEnvoi> {
  const resultat = await preparerEnvoiPhoto(await acteurCourant(), slugOuNull(slug), type)
  if (!resultat.ok) return refus(resultat)
  if (slugOuNull(slug) === null) rafraichir()
  return resultat
}

export async function actionEnregistrerPhoto(slug: unknown, type: unknown, reponse: unknown): Promise<ReponseDepot> {
  const s = slugOuNull(slug)
  if (!s) return refus({ ok: false, code: 'introuvable' })
  const resultat = await enregistrerPhoto(await acteurCourant(), s, type, reponse)
  if (!resultat.ok) return refus(resultat)
  rafraichir()
  return resultat
}
