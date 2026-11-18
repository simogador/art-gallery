'use server'

import { cookies, headers } from 'next/headers'
import {
  annulerPassagePublic,
  completerCoordonneesDuLien,
  poserPassagePublic,
  reprendrePassagePublic,
  type ErreursCoordonnees,
} from '@/lib/commandes'
import { TOLERANCE_PASSAGE_MS } from '@/lib/acces/commande-publique'
import { COOKIE_COMMANDE } from '@/app/commande/cookie'
import { COOKIE_PAYS, lirePays } from '@/lib/livraison'
import { nettoyerSlugs } from '@/lib/panier/regles'
import { CHEMIN_COOKIE_PASSAGE, COOKIE_PASSAGE } from './cookie'

// Le cookie `passage` est toujours posé ici, par `cookies().set` de l'action serveur, jamais par le client.
// Story 7.3 (FR-10, FR-12) : actions serveur des coordonnées sans compte. Le navigateur n'envoie que des
// slugs et des textes ; le pays vient du cookie `pays`, le passage du cookie `passage`. Le module
// `commandes` revérifie tout (Lot 2, œuvres, prix, plafond). Réponses sans détail technique ; jamais
// d'e-mail, d'adresse ni de slug dans les journaux.

export type ReponseCoordonnees =
  | { ok: true }
  | { ok: false; code: 'invalide'; erreurs: ErreursCoordonnees }
  | { ok: false; code: 'oeuvre_indisponible' | 'non_livree' | 'prix_change'; slug: string }
  | {
      ok: false
      code: 'plafond_atteint' | 'ferme' | 'liste_vide' | 'devise_differente' | 'indisponible' | 'trop_de_demandes' | 'reservation_en_cours'
    }

function adresseIp(): string | null {
  const h = headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
}

function effacerCookiePassage() {
  cookies().set(COOKIE_PASSAGE, '', { httpOnly: true, path: CHEMIN_COOKIE_PASSAGE, maxAge: 0, sameSite: 'lax' })
}

function poserCookiePassage(jeton: string, echeance: Date) {
  cookies().set(COOKIE_PASSAGE, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: CHEMIN_COOKIE_PASSAGE,
    // Lisible après l'échéance : l'acheteur retrouve son passage pour retenter la réservation.
    expires: new Date(echeance.getTime() + TOLERANCE_PASSAGE_MS),
  })
}

function journaliser(nom: string, erreur: unknown) {
  console.error(nom, erreur instanceof Error ? erreur.name : 'inconnue')
}

/** « Continuer » : crée le passage et réserve les œuvres, ou reprend le passage déjà réservé de ce navigateur. */
export async function envoyerCoordonnees(slugs: unknown, saisie: unknown): Promise<ReponseCoordonnees> {
  try {
    const pays = lirePays(cookies().get(COOKIE_PAYS)?.value)
    const resultat = await poserPassagePublic({
      coordonnees: saisie,
      pays,
      oeuvres: nettoyerSlugs(slugs),
      jeton: cookies().get(COOKIE_PASSAGE)?.value,
      ip: adresseIp(),
    })
    if (resultat.ok) {
      if (resultat.jeton) poserCookiePassage(resultat.jeton, resultat.echeance)
      return { ok: true }
    }
    if (resultat.code === 'coordonnees_invalides') return { ok: false, code: 'invalide', erreurs: resultat.erreurs }
    if (resultat.code === 'oeuvre_indisponible' || resultat.code === 'non_livree') return { ok: false, code: resultat.code, slug: resultat.slug }
    return { ok: false, code: resultat.code === 'invalide' ? 'indisponible' : resultat.code }
  } catch (erreur) {
    journaliser('coordonnees_envoi_echoue', erreur)
    return { ok: false, code: 'indisponible' }
  }
}

/** « Continuer » après l'échéance : retente la réservation du même passage. */
export async function reprendreReservation(): Promise<ReponseCoordonnees> {
  try {
    const resultat = await reprendrePassagePublic(cookies().get(COOKIE_PASSAGE)?.value)
    if (resultat.ok) {
      if (resultat.jeton) poserCookiePassage(resultat.jeton, resultat.echeance)
      return { ok: true }
    }
    if (resultat.code === 'oeuvre_indisponible' || resultat.code === 'prix_change') return { ok: false, code: resultat.code, slug: resultat.slug }
    if (resultat.code === 'plafond_atteint' || resultat.code === 'ferme') return { ok: false, code: resultat.code }
    return { ok: false, code: 'indisponible' }
  } catch (erreur) {
    journaliser('coordonnees_reprise_echoue', erreur)
    return { ok: false, code: 'indisponible' }
  }
}

/** Passage posé par l'équipe : l'acheteur complète adresse et téléphone (le lien de l'e-mail l'a rattaché). */
export async function completerCoordonnees(saisie: unknown): Promise<ReponseCoordonnees> {
  try {
    const resultat = await completerCoordonneesDuLien(cookies().get(COOKIE_COMMANDE)?.value, saisie)
    if (resultat.ok) return { ok: true }
    if (resultat.code === 'coordonnees_invalides') return { ok: false, code: 'invalide', erreurs: resultat.erreurs }
    return { ok: false, code: 'indisponible' }
  } catch (erreur) {
    journaliser('coordonnees_completer_echoue', erreur)
    return { ok: false, code: 'indisponible' }
  }
}

export type ReponseModification = { ok: true } | { ok: false; code: 'etat_invalide' | 'indisponible' }

/** « Modifier ma commande » : annule le passage du navigateur (réservations libérées) et efface son cookie. */
export async function modifierMaCommande(): Promise<ReponseModification> {
  try {
    const resultat = await annulerPassagePublic(cookies().get(COOKIE_PASSAGE)?.value)
    if (!resultat.ok) return { ok: false, code: 'etat_invalide' }
    effacerCookiePassage()
    return { ok: true }
  } catch (erreur) {
    journaliser('coordonnees_modification_echoue', erreur)
    return { ok: false, code: 'indisponible' }
  }
}
