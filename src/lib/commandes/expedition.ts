import { prisma } from '@/lib/prisma'
import type { Acteur } from '@/lib/acces'
import { ecrireEvenement, repartirApresValidation } from '@/lib/evenements'
import { SEUIL_ASSURANCE } from '@/lib/reglages'
import { transitionPermise } from './etats'
import { assuranceRequise, validerExpedition, type ErreursExpedition, type SaisieExpedition } from './expedition-regles'

// Expédition par l'artiste (story 8.2, FR-22, AD-9, AD-15, AD-16, OQ-5) : `prise_en_charge` → `expediee`.
// Acteur `artist` relu en base, commandes de SES œuvres seulement (`introuvable` sinon, sans dire si elle existe).
// Mise à jour conditionnelle sous le verrou de la ligne du passage (comme `prendreEnCharge`), auteur et date,
// événement `CommandeExpediee` dans la transaction, répartition attendue après. Rejouée : succès sans effet,
// la première saisie n'est jamais écrasée. Au-dessus du seuil d'assurance (`SEUIL_ASSURANCE`, prix des
// œuvres lu par agrégat de la base, sans frais), case et référence obligatoires. La référence d'assurance
// n'est jamais écrite dans un journal ni un événement (ids seulement).

const LONGUEUR_NUMERO_MAX = 64

export type ResultatExpedition =
  | { ok: true; dejaExpediee: boolean }
  | { ok: false; code: 'acces_refuse' | 'introuvable' | 'etat_invalide' }
  | { ok: false; code: 'invalide' | 'assurance_requise'; erreurs: ErreursExpedition }

function numeroLisible(numero: unknown): numero is string {
  return typeof numero === 'string' && numero.trim() !== '' && numero.length <= LONGUEUR_NUMERO_MAX
}

export async function marquerExpediee(acteur: Acteur, numero: string, saisie: Partial<SaisieExpedition>, maintenant: Date = new Date()): Promise<ResultatExpedition> {
  if (acteur.type !== 'artist') return { ok: false, code: 'acces_refuse' }
  const artistId = acteur.artiste?.id ?? null
  if (!artistId || !numeroLisible(numero)) return { ok: false, code: 'introuvable' }
  if (!transitionPermise('prise_en_charge', 'expediee')) throw new Error('transition_interdite')

  const interne = await prisma.$transaction(
    async (tx): Promise<{ resultat: ResultatExpedition; evenements: string[] }> => {
      const fin = (resultat: ResultatExpedition, evenements: string[] = []) => ({ resultat, evenements })
      const trouvee = await tx.commande.findUnique({ where: { numero: numero.trim() }, select: { id: true, artistId: true, passageId: true } })
      if (!trouvee || trouvee.artistId !== artistId || !trouvee.passageId) return fin({ ok: false, code: 'introuvable' })
      await tx.$queryRaw`SELECT "id" FROM "PassageEnCaisse" WHERE "id" = ${trouvee.passageId} FOR UPDATE`
      const commande = await tx.commande.findUnique({ where: { id: trouvee.id }, select: { etat: true, devise: true } })
      if (!commande) return fin({ ok: false, code: 'introuvable' })
      if (commande.etat === 'expediee') return fin({ ok: true, dejaExpediee: true })
      if (commande.etat !== 'prise_en_charge') return fin({ ok: false, code: 'etat_invalide' })

      // Prix des œuvres de la commande : agrégat de la base, jamais une addition dans le code (décision 4A).
      const somme = await tx.ligneCommande.aggregate({ where: { commandeId: trouvee.id }, _sum: { prixCentimes: true } })
      const assurance = assuranceRequise(somme._sum.prixCentimes, commande.devise, SEUIL_ASSURANCE)
      const valide = validerExpedition(saisie, assurance)
      if (!valide.ok) {
        const e = valide.erreurs
        const manqueAssuranceSeule = !e.transporteur && !e.numeroSuivi && e.referenceAssurance !== 'trop_long'
        return fin({ ok: false, code: manqueAssuranceSeule ? 'assurance_requise' : 'invalide', erreurs: e })
      }
      const v = valide.valeur
      const maj = await tx.commande.updateMany({
        where: { id: trouvee.id, etat: 'prise_en_charge', artistId },
        data: {
          etat: 'expediee',
          transporteur: v.transporteur,
          numeroSuivi: v.numeroSuivi,
          envoiAssure: v.envoiAssure,
          referenceAssurance: v.referenceAssurance,
          expedieeLe: maintenant,
          expedieePar: acteur.userId,
        },
      })
      // Filet : jamais atteint sous le verrou du passage.
      if (maj.count !== 1) return fin({ ok: true, dejaExpediee: true })
      const evenement = await ecrireEvenement(tx, { nom: 'CommandeExpediee', charge: { commandeId: trouvee.id } })
      return fin({ ok: true, dejaExpediee: false }, [evenement])
    },
    { maxWait: 5000, timeout: 20000 },
  )
  await repartirApresValidation(interne.evenements)
  return interne.resultat
}
