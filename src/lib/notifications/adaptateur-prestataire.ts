import { EXPEDITEUR_COURRIELS, REPONSE_COURRIELS } from '@/lib/reglages'
import type { Courriel, EnvoiCourriel, ResultatEnvoi } from './port'

// Adaptateur du prestataire d'e-mails choisi par le porteur (AQ-1, décision du 2026-11-10) : Resend,
// région UE (la région se choisit à la création du domaine d'envoi, pas dans l'appel). Seul fichier
// de `src/` qui nomme le prestataire ; sa clé d'API est la variable Vercel `RESEND_API_KEY`
// (jamais dans le dépôt). Appel HTTP direct, sans SDK.
//
// Jamais de donnée personnelle dans les journaux : seuls le code d'échec et l'état HTTP sont notés.

const POINT_D_ENTREE = 'https://api.resend.com/emails'
const DELAI_MS = 8000

export function creerAdaptateurPrestataire(
  env: Record<string, string | undefined> = process.env,
  appel: typeof fetch = fetch,
): EnvoiCourriel {
  return {
    async envoyer(courriel: Courriel): Promise<ResultatEnvoi> {
      const cle = env.RESEND_API_KEY?.trim()
      if (!cle) {
        console.error('[notifications] envoi impossible : clé d’API absente', { cle: courriel.cle })
        return { ok: false, code: 'non_configure' }
      }
      try {
        const reponse = await appel(POINT_D_ENTREE, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cle}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': courriel.cle,
          },
          body: JSON.stringify({
            from: EXPEDITEUR_COURRIELS,
            to: [courriel.a],
            reply_to: REPONSE_COURRIELS,
            subject: courriel.sujet,
            text: courriel.texte,
            html: courriel.html,
          }),
          signal: AbortSignal.timeout(DELAI_MS),
        })
        if (reponse.ok) return { ok: true }
        console.error('[notifications] envoi refusé par le prestataire', { cle: courriel.cle, etat: reponse.status })
        // 4xx (sauf 429) : la demande est refusée telle quelle ; sinon le service est indisponible.
        const refus = reponse.status >= 400 && reponse.status < 500 && reponse.status !== 429
        return { ok: false, code: refus ? 'refuse' : 'indisponible' }
      } catch {
        console.error('[notifications] prestataire injoignable', { cle: courriel.cle })
        return { ok: false, code: 'indisponible' }
      }
    },
  }
}
