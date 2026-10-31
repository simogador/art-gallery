'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { acteurCourant } from '@/lib/acces'
import { creerZone, messageRefusZone, modifierZone, supprimerZone } from '@/lib/livraison'

// Actions serveur de l'écran des zones (story 2.3). Les droits sont vérifiés par le module
// livraison à partir de l'acteur relu en base (AD-15).

export type EtatFormulaireZone = { ok: boolean; message: string } | null

function saisie(formData: FormData) {
  return {
    nom: String(formData.get('nom') ?? ''),
    pays: formData.getAll('pays').map(String),
  }
}

function rafraichir() {
  revalidatePath('/dashboard/admin/zones', 'layout')
  revalidatePath('/dashboard/artiste/oeuvres/nouvelle')
}

export async function actionCreerZone(_etat: EtatFormulaireZone, formData: FormData): Promise<EtatFormulaireZone> {
  const resultat = await creerZone(await acteurCourant(), saisie(formData))
  if (!resultat.ok) return { ok: false, message: messageRefusZone(resultat) }
  rafraichir()
  redirect('/dashboard/admin/zones')
}

export async function actionModifierZone(
  id: string,
  _etat: EtatFormulaireZone,
  formData: FormData,
): Promise<EtatFormulaireZone> {
  const resultat = await modifierZone(await acteurCourant(), id, saisie(formData))
  if (!resultat.ok) return { ok: false, message: messageRefusZone(resultat) }
  rafraichir()
  return { ok: true, message: 'Zone enregistrée.' }
}

export async function actionSupprimerZone(id: string, _etat: EtatFormulaireZone): Promise<EtatFormulaireZone> {
  const resultat = await supprimerZone(await acteurCourant(), id)
  if (!resultat.ok) return { ok: false, message: messageRefusZone(resultat) }
  rafraichir()
  redirect('/dashboard/admin/zones')
}
