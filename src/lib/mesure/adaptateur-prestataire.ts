import { adresseMesure, cleMesure } from '@/lib/reglages'
import type { EvenementEnvoye } from './catalogue'
import type { Mesure } from './port'

// Adaptateur du prestataire de mesure choisi par le porteur (décision du 2026-10-27, OQ-9) : PostHog
// hébergé dans l'UE. Seul fichier de `src/` qui nomme le prestataire. Appel HTTP direct vers
// l'API de capture, sans SDK. La clé et l'adresse d'hébergement viennent des variables Vercel lues
// par `reglages` (jamais dans le dépôt). Aucun profil de personne n'est créé et aucune adresse IP du
// visiteur n'est transmise : l'appel part du serveur.
//
// Une erreur de mesure ne casse jamais l'action du visiteur ; seuls l'état HTTP et le nom de
// l'événement sont journalisés.

const DELAI_MS = 1000

export function creerAdaptateurPrestataire(
  env: Record<string, string | undefined> = process.env,
  appel: typeof fetch = fetch,
): Mesure {
  return {
    async envoyer(evenement: EvenementEnvoye): Promise<void> {
      const cle = cleMesure(env)
      const adresse = adresseMesure(env)
      if (!cle || !adresse) {
        console.error('[mesure] envoi impossible : clé ou adresse absente', { nom: evenement.nom })
        return
      }
      try {
        const reponse = await appel(`${adresse}/capture/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: cle,
            event: evenement.nom,
            distinct_id: evenement.visiteur,
            properties: {
              slug: evenement.slug,
              source: evenement.source,
              $process_person_profile: false,
              $lib: 'errancy-serveur',
            },
          }),
          signal: AbortSignal.timeout(DELAI_MS),
        })
        if (!reponse.ok) console.error('[mesure] événement refusé par le prestataire', { nom: evenement.nom, etat: reponse.status })
      } catch {
        console.error('[mesure] prestataire injoignable', { nom: evenement.nom })
      }
    },
  }
}
