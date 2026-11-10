'use server'

import { revalidatePath } from 'next/cache'
import { acteurCourant } from '@/lib/acces'
import { changerEtatDemande, messageRefusEtatDemande } from '@/lib/demandes'

// Changement d'état d'une demande (story 4.6). Les droits (admin seulement, rôle relu en base, AD-15)
// sont vérifiés par le module demandes ; la page est rafraîchie après un succès.

export type ResultatActionEtat = { ok: true } | { ok: false; message: string }

export async function actionEtatDemande(type: string, id: string, etat: string): Promise<ResultatActionEtat> {
  const resultat = await changerEtatDemande(await acteurCourant(), type, id, etat)
  if (!resultat.ok) return { ok: false, message: messageRefusEtatDemande(resultat.code) }
  revalidatePath('/dashboard/admin/demandes')
  return { ok: true }
}
