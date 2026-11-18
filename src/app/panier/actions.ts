'use server'

import { cookies } from 'next/headers'
import { COOKIE_PAYS, lirePays } from '@/lib/livraison'
import { composerPanier, type PanierCompose } from '@/lib/panier'

// Story 7.2 (FR-10, AD-13) : recalcul du panier côté serveur. Le navigateur n'envoie que des slugs
// (validés, plafonnés, dédoublonnés par `composerPanier`) ; le pays vient du cookie `pays`, jamais d'un
// paramètre ; prix, frais, délais et totaux sont relus en base. Aucune erreur technique n'est renvoyée.

export type ResultatPanier = { ok: true; panier: PanierCompose } | { ok: false }

export async function recalculerPanier(slugs: unknown): Promise<ResultatPanier> {
  try {
    const pays = lirePays(cookies().get(COOKIE_PAYS)?.value)
    return { ok: true, panier: await composerPanier(slugs, pays) }
  } catch (erreur) {
    // Aucun slug ni donnée personnelle dans le journal.
    console.error('panier_recalcul_echoue', erreur instanceof Error ? erreur.name : 'inconnue')
    return { ok: false }
  }
}
