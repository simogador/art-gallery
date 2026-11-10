'use server'

import { cookies } from 'next/headers'
import { estCodePays, nomPays } from '@/lib/livraison/pays'
import { cookiePays } from '@/lib/livraison/prix'
import { mesurerDepuisAction } from '@/lib/mesure'

// Story 3.3 : pays de livraison choisi par le visiteur (composant PaysLivraison). Pose le cookie
// `pays` (un an) ; la page, rafraîchie par l'appelant (router.refresh), recalcule prix et délais
// côté serveur. Aucun compte requis, aucune donnée personnelle enregistrée.

export type ResultatPays = { ok: true; code: string; nom: string } | { ok: false }

export async function choisirPaysLivraison(code: unknown): Promise<ResultatPays> {
  if (typeof code !== 'string' || !estCodePays(code)) return { ok: false }
  cookies().set(cookiePays(code))
  // Story 4.8 : choix du pays mesuré avec le consentement du visiteur (sans effet sinon, sans erreur).
  await mesurerDepuisAction({ nom: 'ChoixPays' })
  return { ok: true, code, nom: nomPays(code) }
}
