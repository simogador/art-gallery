'use server'

import { cookies } from 'next/headers'
import { constaterLivraisonAcheteur } from '@/lib/commandes'
import { fr } from '@/lib/i18n'
import { COOKIE_SUIVI } from './cookie'

// « J'ai reçu l'œuvre » (story 8.4, FR-29, AD-14). Le passage est celui du jeton `suivi` du cookie du navigateur,
// jamais un identifiant fourni par le client ; seul le numéro de commande vient du client, et `commandes` vérifie
// qu'il appartient à ce passage. Réponses sans détail technique ; journal sans numéro ni jeton.

export type ReponseReception = { ok: true; message: string } | { ok: false; message: string }

export async function confirmerReception(numero: string): Promise<ReponseReception> {
  const t = fr.suivi.reception
  try {
    const r = await constaterLivraisonAcheteur(cookies().get(COOKIE_SUIVI)?.value, String(numero ?? ''))
    if (r.ok) return { ok: true, message: r.dejaLivree ? t.deja : t.reussi }
    switch (r.code) {
      case 'etat_invalide':
        return { ok: false, message: t.erreurs.etatInvalide }
      case 'preuve_requise':
        return { ok: false, message: t.erreurs.preuveRequise }
      case 'introuvable':
      case 'acces_refuse':
        return { ok: false, message: t.erreurs.introuvable }
      default:
        return { ok: false, message: t.erreurs.indisponible }
    }
  } catch (erreur) {
    console.error('reception_echoue', erreur instanceof Error ? erreur.name : 'inconnue')
    return { ok: false, message: t.erreurs.indisponible }
  }
}
