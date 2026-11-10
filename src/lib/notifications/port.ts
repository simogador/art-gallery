// Port d'envoi d'e-mail (story 4.1, AD-11, AQ-1). Le reste du code ne connaît que ce port ; le
// prestataire et son SDK n'existent que dans son adaptateur (`adaptateur-prestataire.ts`).

export type Courriel = {
  /** Destinataire : jamais journalisé. */
  a: string
  sujet: string
  texte: string
  html: string
  /** Clé d'idempotence (événement + gestionnaire) : un même envoi rejoué n'est pas livré deux fois. */
  cle: string
}

export type CodeEchecEnvoi = 'non_configure' | 'refuse' | 'indisponible'

export type ResultatEnvoi = { ok: true } | { ok: false; code: CodeEchecEnvoi }

export interface EnvoiCourriel {
  envoyer(courriel: Courriel): Promise<ResultatEnvoi>
}
