import { adaptateurJournal } from './adaptateur-journal'
import { creerAdaptateurPrestataire } from './adaptateur-prestataire'
import type { Mesure } from './port'

/**
 * Adaptateur de mesure selon l'environnement : le prestataire en production Vercel seulement ;
 * partout ailleurs (local, préversion, tests) le journal, qui n'envoie rien (AD-22).
 */
export function choisirMesure(env: Record<string, string | undefined> = process.env): Mesure {
  return env.VERCEL_ENV === 'production' ? creerAdaptateurPrestataire(env) : adaptateurJournal
}

/** Adaptateur de l'environnement courant (les tests le remplacent par `vi.mock`). */
export function mesureActive(): Mesure {
  return choisirMesure()
}
