'use server'

import { cookies } from 'next/headers'
import { AuthError } from 'next-auth'
import { signIn } from '@/auth'
import { activerInvitation, messageRefusActivation, type RefusActivation } from '@/lib/acces'
import { CHEMIN_COOKIE_INVITATION, COOKIE_INVITATION } from './cookie'

// Activation d'une invitation (story 2.4) : compte créé par le module acces, puis connexion.

export type EtatActivation = {
  message: string
  champ: 'motDePasse' | 'confirmation' | 'charte' | null
  expire: boolean
} | null

const CHAMP: Partial<Record<RefusActivation['code'], 'motDePasse' | 'confirmation' | 'charte'>> = {
  mot_de_passe_court: 'motDePasse',
  mots_de_passe_differents: 'confirmation',
  charte_non_acceptee: 'charte',
}

export async function actionActiver(_etat: EtatActivation, formData: FormData): Promise<EtatActivation> {
  const jeton = cookies().get(COOKIE_INVITATION)?.value ?? ''
  const motDePasse = String(formData.get('motDePasse') ?? '')
  const resultat = await activerInvitation(jeton, {
    motDePasse,
    confirmation: String(formData.get('confirmation') ?? ''),
    charteAcceptee: formData.get('charte') === 'oui',
  })
  if (!resultat.ok) {
    return { message: messageRefusActivation(resultat.code), champ: CHAMP[resultat.code] ?? null, expire: resultat.code === 'invalide' }
  }

  cookies().delete({ name: COOKIE_INVITATION, path: CHEMIN_COOKIE_INVITATION })
  try {
    // Redirige vers l'espace artiste (l'exception de redirection de Next.js est propagée).
    await signIn('credentials', { email: resultat.email, password: motDePasse, redirectTo: '/dashboard/artiste' })
  } catch (erreur) {
    if (erreur instanceof AuthError) {
      return { message: 'Votre accès est créé. Connectez-vous avec votre e-mail et votre mot de passe.', champ: null, expire: false }
    }
    throw erreur
  }
  return null
}
