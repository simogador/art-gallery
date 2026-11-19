'use server'

import { cookies } from 'next/headers'
import { ouvrirSuiviDuNavigateur } from '@/lib/commandes'
import { COOKIE_PASSAGE } from '@/app/commande/coordonnees/cookie'
import { COOKIE_SUIVI, optionsCookieSuivi } from '@/app/suivi/cookie'

// « Suivre mes commandes » (story 7.7, FR-15, AD-14). Le passage est celui du jeton `commande_publique` du
// cookie du navigateur (jamais un identifiant fourni par le client) ; l'action émet un jeton `suivi` pour ce
// passage (ou garde celui que le navigateur porte déjà pour lui), le pose dans le cookie `httpOnly` `suivi` (par
// `cookies().set` d'ici, jamais par le client) et laisse le client ouvrir `/suivi`. Cookie absent, jeton
// invalide ou passage sans commande : réponse neutre, rien n'est écrit. Réponses sans détail technique ; jamais
// d'e-mail ni de jeton dans les journaux. Pas de limite par IP : l'action exige un jeton de passage valide, réutilise
// le lien déjà porté par le navigateur et est bornée par `PLAFOND_LIENS_SUIVI` liens actifs par passage
// (`trop_de_liens`, message neutre).

export type ReponseSuivi = { ok: true } | { ok: false; code: 'invalide' | 'trop_de_liens' | 'indisponible' }

export async function ouvrirSuivi(): Promise<ReponseSuivi> {
  try {
    const lien = await ouvrirSuiviDuNavigateur(cookies().get(COOKIE_PASSAGE)?.value, cookies().get(COOKIE_SUIVI)?.value)
    if (!lien) return { ok: false, code: 'invalide' }
    if ('refus' in lien) return { ok: false, code: 'trop_de_liens' }
    cookies().set(COOKIE_SUIVI, lien.jeton, optionsCookieSuivi(lien.echeance))
    return { ok: true }
  } catch (erreur) {
    console.error('suivi_ouverture_echoue', erreur instanceof Error ? erreur.name : 'inconnue')
    return { ok: false, code: 'indisponible' }
  }
}
