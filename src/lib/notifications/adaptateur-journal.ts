import type { Courriel, EnvoiCourriel, ResultatEnvoi } from './port'

// Adaptateur « journal » (story 4.1, AD-22) : hors production (poste local, préversion), aucun
// e-mail ne part. Seule la clé d'idempotence (ids d'événement) est journalisée : ni adresse,
// ni sujet, ni texte (le lien d'invitation y figure).

export const adaptateurJournal: EnvoiCourriel = {
  async envoyer(courriel: Courriel): Promise<ResultatEnvoi> {
    console.info('[notifications] e-mail non envoyé (hors production)', { cle: courriel.cle })
    return { ok: true }
  },
}
