'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { acteurCourant, inviterArtiste, messageRefusInvitation } from '@/lib/acces'

// Invitation d'un artiste (story 2.4). Le lien est construit sur l'origine de la requête (préversion
// ou production) et renvoyé une seule fois : seule son empreinte est en base.

export type EtatInvitation =
  | { ok: true; lien: string; echeance: string }
  | { ok: false; message: string }
  | null

function origine(): string {
  const h = headers()
  const hote = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const protocole = h.get('x-forwarded-proto') ?? (hote.startsWith('localhost') ? 'http' : 'https')
  return `${protocole}://${hote}`
}

export async function actionInviter(artistId: string, _etat: EtatInvitation, formData: FormData): Promise<EtatInvitation> {
  const resultat = await inviterArtiste(await acteurCourant(), artistId, String(formData.get('email') ?? ''))
  if (!resultat.ok) return { ok: false, message: messageRefusInvitation(resultat.code) }
  revalidatePath('/dashboard/admin/artistes')
  return { ok: true, lien: `${origine()}/auth/invitation/${resultat.jeton}`, echeance: resultat.echeance.toISOString() }
}
