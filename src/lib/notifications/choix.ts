import { adaptateurJournal } from './adaptateur-journal'
import { creerAdaptateurPrestataire } from './adaptateur-prestataire'
import type { EnvoiCourriel } from './port'

/**
 * Adaptateur d'envoi selon l'environnement : le prestataire en production Vercel seulement ; partout
 * ailleurs (local, préversion, tests) le journal, qui n'envoie rien (AD-22).
 */
export function choisirEnvoi(env: Record<string, string | undefined> = process.env): EnvoiCourriel {
  return envoiReel(env) ? creerAdaptateurPrestataire(env) : adaptateurJournal
}

/**
 * Vrai seulement si l'e-mail part réellement (prestataire choisi : production Vercel). L'adaptateur
 * « journal » répond « ok » sans rien envoyer : ce qui n'a de sens que si l'envoi est réel (annonce
 * de l'ouverture, qui supprime les adresses) doit le vérifier ici.
 */
export function envoiReel(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === 'production'
}

/** Adaptateur de l'environnement courant (les tests le remplacent par `vi.mock`). */
export function envoiActif(): EnvoiCourriel {
  return choisirEnvoi()
}
