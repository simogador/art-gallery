'use server'

import { acteurCourant } from '@/lib/acces'
import { LONGUEUR_MAX, LONGUEUR_MIN } from '@/lib/commandes/expedition-regles'
import { marquerExpediee, prendreEnCharge, type ChampExpedition, type ErreurChampExpedition, type ErreursExpedition, type SaisieExpedition } from '@/lib/commandes'
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

export type ResultatActionExpedition = { ok: boolean; message: string; erreurs?: Partial<Record<ChampExpedition, string>> }

/** Texte du message d'un champ refusé (liste fermée de codes, textes de `fr`). */
function messageChamp(champ: ChampExpedition, code: ErreurChampExpedition): string {
  const e = fr.commandesArtiste.expedition.erreurs
  switch (code) {
    case 'requis':
      return e.requis
    case 'trop_court':
      return e.tropCourt(LONGUEUR_MIN)
    case 'trop_long':
      return e.tropLong(LONGUEUR_MAX)
    case 'assurance_requise':
      return champ === 'envoiAssure' ? e.assuranceCase : e.assuranceReference
    default: {
      const inattendu: never = code
      return inattendu
    }
  }
}

function messages(erreurs: ErreursExpedition): Partial<Record<ChampExpedition, string>> {
  const sortie: Partial<Record<ChampExpedition, string>> = {}
  for (const champ of Object.keys(erreurs) as ChampExpedition[]) {
    const code = erreurs[champ]
    if (code) sortie[champ] = messageChamp(champ, code)
  }
  return sortie
}

// Action « Marquer comme expédiée » (story 8.2, AD-15) : acteur relu en base, `commandes` décide de l'accès, du
// seuil d'assurance et de la transition. Réponses sans détail technique ; la référence d'assurance n'est jamais
// journalisée.
export async function actionMarquerExpediee(numero: string, saisie: SaisieExpedition): Promise<ResultatActionExpedition> {
  const t = fr.commandesArtiste.expedition
  try {
    const r = await marquerExpediee(await acteurCourant(), String(numero ?? ''), {
      transporteur: String(saisie?.transporteur ?? ''),
      numeroSuivi: String(saisie?.numeroSuivi ?? ''),
      envoiAssure: saisie?.envoiAssure === true,
      referenceAssurance: String(saisie?.referenceAssurance ?? ''),
    })
    if (r.ok) return { ok: true, message: r.dejaExpediee ? t.deja : t.reussi }
    if (r.code === 'invalide' || r.code === 'assurance_requise') {
      const erreurs = messages(r.erreurs)
      return { ok: false, message: t.resume(Object.keys(erreurs).length), erreurs }
    }
    return { ok: false, message: r.code === 'acces_refuse' ? t.erreurs.accesRefuse : r.code === 'etat_invalide' ? t.erreurs.etatInvalide : t.erreurs.introuvable }
  } catch {
    console.error('[commandes-artiste] expédition en échec')
    return { ok: false, message: t.erreurs.indisponible }
  }
}
