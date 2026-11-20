import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import type { Acteur } from '@/lib/acces'
import { lirePassageDuSuivi } from '@/lib/acces/suivi'
import { ecrireEvenement, repartirApresValidation } from '@/lib/evenements'
import { DUREE_RETOUR_JOURS, SEUIL_ASSURANCE } from '@/lib/reglages'
import { transitionPermise } from './etats'
import { assuranceRequise } from './expedition-regles'
import { retourAvant, validerLivraison, type ErreursLivraison, type SourceLivraison } from './livraison-regles'

// Livraison constatée (story 8.4, FR-29, FR-22, AD-9, AD-10, AD-15) : `expediee` → `livree`. Deux acteurs :
// l'acheteur, par son jeton de suivi (le passage vient du jeton, jamais d'un identifiant du client ; la commande
// doit appartenir à ce passage), sous le seuil d'assurance seulement ; l'équipe (admin relu en base), qui
// choisit « suivi du transporteur » ou « preuve » et DOIT saisir une preuve au-dessus du seuil. Mise à jour
// conditionnelle sous le verrou de la ligne du passage (comme `marquerExpediee`), date, source, auteur, fin du
// délai de retour (`retourAvant`, AD-10), événement `CommandeLivree` dans la transaction, répartition attendue
// après. Rejouée : succès sans effet (`dejaLivree`), la première date et la première source ne sont jamais
// écrasées. Le prix des œuvres est lu par agrégat de la base (jamais additionné ici). Aucune donnée
// personnelle dans les journaux ni les événements (ids seulement) ; la preuve n'est jamais journalisée.

const LONGUEUR_NUMERO_MAX = 64

export type ResultatLivraison =
  | { ok: true; dejaLivree: boolean }
  | { ok: false; code: 'acces_refuse' | 'introuvable' | 'etat_invalide' }
  | { ok: false; code: 'preuve_requise' | 'invalide'; erreurs?: ErreursLivraison }

function numeroLisible(numero: unknown): numero is string {
  return typeof numero === 'string' && numero.trim() !== '' && numero.length <= LONGUEUR_NUMERO_MAX
}

type Constat = {
  par: string | null
  /** Contrôle fait sous le verrou, avec le prix des œuvres : `null` = permis, sinon le refus à rendre. */
  decider: (auDessus: boolean) => { ok: true; preuve: string | null; source: SourceLivraison } | Extract<ResultatLivraison, { ok: false }>
  /** Vérifie que la commande trouvée est bien celle du demandeur (acheteur : son passage). */
  appartient: (tx: Prisma.TransactionClient, commande: { passageId: string | null }) => Promise<boolean>
}

async function constater(numero: string, constat: Constat, maintenant: Date): Promise<ResultatLivraison> {
  if (!numeroLisible(numero)) return { ok: false, code: 'introuvable' }
  if (!transitionPermise('expediee', 'livree')) throw new Error('transition_interdite')
  const interne = await prisma.$transaction(
    async (tx): Promise<{ resultat: ResultatLivraison; evenements: string[] }> => {
      const fin = (resultat: ResultatLivraison, evenements: string[] = []) => ({ resultat, evenements })
      const trouvee = await tx.commande.findUnique({ where: { numero: numero.trim() }, select: { id: true, passageId: true } })
      if (!trouvee || !trouvee.passageId || !(await constat.appartient(tx, trouvee))) return fin({ ok: false, code: 'introuvable' })
      await tx.$queryRaw`SELECT "id" FROM "PassageEnCaisse" WHERE "id" = ${trouvee.passageId} FOR UPDATE`
      const commande = await tx.commande.findUnique({ where: { id: trouvee.id }, select: { etat: true, devise: true } })
      if (!commande) return fin({ ok: false, code: 'introuvable' })
      if (commande.etat === 'livree') return fin({ ok: true, dejaLivree: true })
      if (commande.etat !== 'expediee') return fin({ ok: false, code: 'etat_invalide' })
      // Prix des œuvres : agrégat de la base (seuil de la 8.2, sans frais), jamais additionné dans le code.
      const somme = await tx.ligneCommande.aggregate({ where: { commandeId: trouvee.id }, _sum: { prixCentimes: true } })
      const decision = constat.decider(assuranceRequise(somme._sum.prixCentimes, commande.devise, SEUIL_ASSURANCE))
      if (!decision.ok) return fin(decision)
      const maj = await tx.commande.updateMany({
        where: { id: trouvee.id, etat: 'expediee' },
        data: {
          etat: 'livree',
          livreeLe: maintenant,
          livraisonSource: decision.source,
          livraisonPar: constat.par,
          preuveLivraison: decision.preuve,
          retourAvant: retourAvant(maintenant, DUREE_RETOUR_JOURS),
        },
      })
      // Filet : jamais atteint sous le verrou du passage.
      if (maj.count !== 1) return fin({ ok: true, dejaLivree: true })
      const evenement = await ecrireEvenement(tx, { nom: 'CommandeLivree', charge: { commandeId: trouvee.id } })
      return fin({ ok: true, dejaLivree: false }, [evenement])
    },
    { maxWait: 5000, timeout: 20000 },
  )
  await repartirApresValidation(interne.evenements)
  return interne.resultat
}

/**
 * « J'ai reçu l'œuvre » : l'acheteur constate la livraison avec le jeton `suivi` de son navigateur. Jeton absent,
 * mal formé, inconnu, révoqué ou périmé, ou numéro d'un autre passage : `introuvable`, rien d'écrit. Au-dessus du
 * seuil d'assurance : `preuve_requise` (seule l'équipe peut constater).
 */
export async function constaterLivraisonAcheteur(jetonSuivi: string | undefined, numero: string, maintenant: Date = new Date()): Promise<ResultatLivraison> {
  const lien = await lirePassageDuSuivi(prisma, jetonSuivi, maintenant)
  if (!lien) return { ok: false, code: 'introuvable' }
  return constater(
    numero,
    {
      par: null,
      appartient: async (_tx, c) => c.passageId === lien.passageId,
      decider: (auDessus) => (auDessus ? { ok: false, code: 'preuve_requise' } : { ok: true, source: 'acheteur', preuve: null }),
    },
    maintenant,
  )
}

/**
 * « Enregistrer la livraison » par l'équipe : admin seulement (acteur relu en base). Source « suivi du
 * transporteur » ou « preuve » ; au-dessus du seuil d'assurance, la preuve (référence de 2 à 200 caractères) est
 * obligatoire (`preuve_requise`, erreurs par champ).
 */
export async function enregistrerLivraison(
  acteur: Acteur,
  numero: string,
  saisie: { source?: unknown; preuve?: unknown },
  maintenant: Date = new Date(),
): Promise<ResultatLivraison> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  return constater(
    numero,
    {
      par: acteur.userId,
      appartient: async () => true,
      decider: (auDessus) => {
        const v = validerLivraison(saisie, auDessus)
        return v.ok ? { ok: true, source: v.source, preuve: v.preuve } : { ok: false, code: v.code, erreurs: v.erreurs }
      },
    },
    maintenant,
  )
}
