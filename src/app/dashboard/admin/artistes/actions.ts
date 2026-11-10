'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { acteurCourant, inviterArtiste, messageRefusInvitation } from '@/lib/acces'
import {
  CHAMPS_FICHE_ARTISTE,
  enregistrerAccord,
  enregistrerFichePublique,
  enregistrerPhotoArtiste,
  messageRefusCuration,
  messageRefusFicheArtiste,
  preparerEnvoiPhotoArtiste,
  type EnvoiSigne,
} from '@/lib/curation'

// Invitation d'un artiste (story 2.4). Le lien est construit sur l'origine de la requête (préversion
// ou production) et renvoyé une seule fois : seule son empreinte est en base.

export type EtatInvitation =
  | { ok: true; lien: string; echeance: string }
  | { ok: false; message: string }
  | null

// Un proxy peut enchaîner plusieurs valeurs (« a, b ») : seule la première est celle du client.
const premiere = (valeur: string | null) => valeur?.split(',')[0]?.trim() || null

function origine(): string {
  const h = headers()
  const hote = premiere(h.get('x-forwarded-host')) ?? premiere(h.get('host')) ?? 'localhost:3000'
  const protocole = premiere(h.get('x-forwarded-proto')) ?? (hote.startsWith('localhost') ? 'http' : 'https')
  return `${protocole}://${hote}`
}

export async function actionInviter(artistId: string, _etat: EtatInvitation, formData: FormData): Promise<EtatInvitation> {
  const resultat = await inviterArtiste(await acteurCourant(), artistId, String(formData.get('email') ?? ''))
  if (!resultat.ok) return { ok: false, message: messageRefusInvitation(resultat.code) }
  revalidatePath('/dashboard/admin/artistes')
  return { ok: true, lien: `${origine()}/auth/invitation/${resultat.jeton}`, echeance: resultat.echeance.toISOString() }
}

// Accord écrit signé (story 2.7, FR-16) : date enregistrée ou effacée par le module curation.
export type EtatAccord = { ok: true; message: string } | { ok: false; message: string } | null

export async function actionEnregistrerAccord(artistId: string, _etat: EtatAccord, formData: FormData): Promise<EtatAccord> {
  // Seule l'action explicite « Effacer la date » efface : un enregistrement sans date est refusé.
  const effacer = formData.get('effacer') === '1'
  const date = formData.get('date')
  if (!effacer && (typeof date !== 'string' || date.trim() === '')) return { ok: false, message: 'Choisissez une date.' }
  const resultat = await enregistrerAccord(await acteurCourant(), artistId, effacer ? '' : date)
  if (!resultat.ok) return { ok: false, message: resultat.erreur ?? messageRefusCuration(resultat.code) }
  revalidatePath('/dashboard/admin', 'layout')
  return { ok: true, message: resultat.accordSigneLe ? 'Date de signature enregistrée.' : 'Date de signature effacée.' }
}

// Page publique de l'artiste (story 3.11, FR-19) : textes et photos écrits par le module curation,
// admin seulement. Le navigateur envoie les photos directement à Cloudinary (signature du serveur).
export type EtatFiche = { ok: true; message: string } | { ok: false; message: string } | null

export async function actionEnregistrerFiche(artistId: string, _etat: EtatFiche, formData: FormData): Promise<EtatFiche> {
  const champs = Object.fromEntries(CHAMPS_FICHE_ARTISTE.map((c) => [c, formData.get(c)]))
  const resultat = await enregistrerFichePublique(await acteurCourant(), artistId, champs)
  if (!resultat.ok) return { ok: false, message: resultat.erreur ?? messageRefusFicheArtiste(resultat.code) }
  revalidatePath('/dashboard/admin/artistes')
  return { ok: true, message: 'Page enregistrée. Elle apparaît sur le site dans la minute.' }
}

export type ReponseEnvoiArtiste =
  | { ok: true; envoi: EnvoiSigne }
  | { ok: false; message: string }

export async function actionPreparerEnvoiArtiste(artistId: string, cible: unknown): Promise<ReponseEnvoiArtiste> {
  const resultat = await preparerEnvoiPhotoArtiste(await acteurCourant(), artistId, cible)
  if (!resultat.ok) return { ok: false, message: resultat.erreur ?? messageRefusFicheArtiste(resultat.code) }
  return { ok: true, envoi: resultat.envoi }
}

export type ReponsePhotoArtiste = { ok: true; url: string } | { ok: false; message: string }

export async function actionEnregistrerPhotoArtiste(artistId: string, cible: unknown, reponse: unknown): Promise<ReponsePhotoArtiste> {
  const resultat = await enregistrerPhotoArtiste(await acteurCourant(), artistId, cible, reponse)
  if (!resultat.ok) return { ok: false, message: resultat.erreur ?? messageRefusFicheArtiste(resultat.code) }
  revalidatePath('/dashboard/admin/artistes')
  return { ok: true, url: resultat.url }
}
