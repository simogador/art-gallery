'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { acteurCourant } from '@/lib/acces'
import {
  enregistrerChamp,
  enregistrerOffreDepot,
  enregistrerPhoto,
  envoyerEnCuration,
  reprendreZones,
  estChampDepot,
  messageRefusDepot,
  preparerEnvoiPhoto,
  type DepotLu,
  type EnvoiSigne,
  type ChampOffre,
  type RefusDepot,
} from '@/lib/curation'

// Actions serveur du formulaire de dépôt (story 2.5). Les droits (artiste propriétaire, brouillon
// seulement) sont vérifiés par le module curation à partir de l'acteur relu en base (AD-15).
// Story 2.6 : saisie d'une zone, reprise des zones, envoi en curation.

export type RefusAction = {
  ok: false
  code: RefusDepot['code']
  message: string
  erreursOffre?: Partial<Record<ChampOffre, string>>
}
export type ReponseDepot = { ok: true; depot: DepotLu } | RefusAction
export type ReponseEnvoi = { ok: true; slug: string; envoi: EnvoiSigne } | RefusAction

function refus(r: RefusDepot): RefusAction {
  return {
    ok: false,
    code: r.code,
    message: r.erreur ?? messageRefusDepot(r.code),
    ...(r.erreursOffre ? { erreursOffre: r.erreursOffre } : {}),
  }
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

export async function actionEnregistrerOffre(slug: unknown, zoneId: unknown, saisie: unknown): Promise<ReponseDepot> {
  const resultat = await enregistrerOffreDepot(await acteurCourant(), slugOuNull(slug), zoneId, saisie)
  if (!resultat.ok) return refus(resultat)
  rafraichir()
  return resultat
}

export async function actionReprendreZones(slug: unknown): Promise<ReponseDepot> {
  const resultat = await reprendreZones(await acteurCourant(), slugOuNull(slug))
  if (!resultat.ok) return refus(resultat)
  rafraichir()
  return resultat
}

/** Envoi en curation : en cas de succès, retour à « Mes œuvres » avec le bandeau du délai de réponse. */
export async function actionEnvoyerEnCuration(slug: unknown): Promise<RefusAction> {
  const resultat = await envoyerEnCuration(await acteurCourant(), slugOuNull(slug))
  if (!resultat.ok) return refus(resultat)
  rafraichir()
  redirect('/dashboard/artiste/oeuvres?envoyee=1')
}
