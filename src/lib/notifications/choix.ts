import { adaptateurJournal } from './adaptateur-journal'
import { creerAdaptateurPrestataire } from './adaptateur-prestataire'
import type { EnvoiCourriel } from './port'

/**
 * Adaptateur d'envoi selon l'environnement : le prestataire en production Vercel seulement ; partout
 * ailleurs (local, préversion, tests) le journal, qui n'envoie rien (AD-22).
 */
export function choisirEnvoi(env: Record<string, string | undefined> = process.env): EnvoiCourriel {
  return env.VERCEL_ENV === 'production' ? creerAdaptateurPrestataire(env) : adaptateurJournal
}

/** Adaptateur de l'environnement courant (les tests le remplacent par `vi.mock`). */
export function envoiActif(): EnvoiCourriel {
  return choisirEnvoi()
}
