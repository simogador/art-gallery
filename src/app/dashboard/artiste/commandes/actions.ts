'use server'

import { acteurCourant } from '@/lib/acces'
import { prendreEnCharge } from '@/lib/commandes'
import { fr } from '@/lib/i18n'

// Action « Je prends en charge » (story 8.1, AD-15) : l'acteur est relu en base, le module `commandes` décide de
// l'accès (artiste de la commande seulement) et de la transition. Réponses sans détail technique ; journal d'ids
// seulement (le numéro de commande n'est pas une donnée personnelle, mais il n'est pas journalisé ici non plus).

export type ResultatActionPriseEnCharge = { ok: boolean; message: string }

export async function actionPrendreEnCharge(numero: string): Promise<ResultatActionPriseEnCharge> {
  const t = fr.commandesArtiste.action
  try {
    const r = await prendreEnCharge(await acteurCourant(), String(numero ?? ''))
    if (r.ok) return { ok: true, message: r.dejaPriseEnCharge ? t.deja : t.reussi }
    const message = r.code === 'acces_refuse' ? t.erreurs.accesRefuse : r.code === 'etat_invalide' ? t.erreurs.etatInvalide : t.erreurs.introuvable
    return { ok: false, message }
  } catch {
    console.error('[commandes-artiste] prise en charge en échec')
    return { ok: false, message: t.erreurs.indisponible }
  }
}
