'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { acteurCourant } from '@/lib/acces'
import { remettreEnVente } from '@/lib/curation'
import {
  annulerDeclaration,
  declarerDisponibilite,
  messageRefusDisponibilite,
  type CodeRefusDisponibilite,
} from '@/lib/disponibilite'

// Disponibilité tenue par l'artiste (story 2.8, FR-21). Droits (artiste propriétaire) et transitions
// vérifiés par les modules disponibilite et curation, à partir de l'acteur relu en base (AD-15).
// En cas de succès : site entier rafraîchi (la fiche publique change aussitôt), puis retour à la
// liste ou à la fiche de l'œuvre avec le bandeau ; sinon, le message à afficher.

export type RefusDisponibiliteAction = { ok: false; code: CodeRefusDisponibilite; message: string }

export type Retour = 'liste' | 'fiche'

function destination(retour: unknown, slug: string, param: string): string {
  return retour === 'fiche'
    ? `/dashboard/artiste/oeuvres/${encodeURIComponent(slug)}?${param}=1`
    : `/dashboard/artiste/oeuvres?${param}=${encodeURIComponent(slug)}`
}

function refus(code: CodeRefusDisponibilite): RefusDisponibiliteAction {
  return { ok: false, code, message: messageRefusDisponibilite(code) }
}

function rafraichir() {
  // Galerie, fiche publique, page de l'artiste, espace artiste et administration.
  revalidatePath('/', 'layout')
}

export async function actionDeclarer(slug: unknown, type: unknown, retour: unknown): Promise<RefusDisponibiliteAction> {
  const resultat = await declarerDisponibilite(await acteurCourant(), slug, type)
  if (!resultat.ok) return refus(resultat.code)
  rafraichir()
  redirect(destination(retour, slug as string, 'declaration'))
}

export async function actionAnnulerDeclaration(slug: unknown, retour: unknown): Promise<RefusDisponibiliteAction> {
  const resultat = await annulerDeclaration(await acteurCourant(), slug)
  if (!resultat.ok) return refus(resultat.code)
  rafraichir()
  redirect(destination(retour, slug as string, 'annulee'))
}

/** « Remettre en vente » : retour en curation, puis « Mes œuvres » avec le bandeau du délai de réponse. */
export async function actionRemettreEnVente(slug: unknown): Promise<RefusDisponibiliteAction> {
  const resultat = await remettreEnVente(await acteurCourant(), slug)
  if (!resultat.ok) return refus(resultat.code)
  rafraichir()
  redirect('/dashboard/artiste/oeuvres?envoyee=1')
}
