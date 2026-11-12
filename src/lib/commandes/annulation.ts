import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import type { Acteur } from '@/lib/acces'
import { libererReservation } from '@/lib/disponibilite'
import { ecrireEvenement, repartirApresValidation } from '@/lib/evenements'
import { transitionPermise } from './etats'

// Annulation, remboursement et incidents (story 6.5, FR-13, FR-31, NFR-4). Une commande annulée n'est
// jamais confirmée (table de transitions, `etats.ts`). Un remboursement est demandé pour une commande
// annulée dont le paiement est arrivé, égal à son allocation (total de ses lignes figées, lu par
// agrégat de la base) ; il est unique par commande (contrainte en base) et exécuté à la main par
// l'équipe (OQ-1 ouverte). Seul l'acteur `admin`, vérifié ici pour les gestes de l'équipe. Aucun
// e-mail (décision 3A) ; jamais d'e-mail ni d'adresse dans les journaux.

// ── Dans la transaction du constat (paiement.ts) ─────────────────────────────

/**
 * Demande le remboursement d'une commande, une seule fois : relue si elle existe déjà (aucun second
 * remboursement). Le montant est l'allocation de la commande, agrégat de la base.
 */
export async function demanderRemboursement(
  tx: Prisma.TransactionClient,
  commande: { id: string },
  paiementId: string,
  devise: string,
): Promise<{ id: string | null; montantCentimes: number; nouveau: boolean }> {
  const existant = await tx.remboursementCommande.findUnique({ where: { commandeId: commande.id }, select: { id: true, montantCentimes: true } })
  if (existant) return { ...existant, nouveau: false }
  const somme = await tx.ligneCommande.aggregate({ where: { commandeId: commande.id }, _sum: { totalCentimes: true } })
  const montantCentimes = somme._sum.totalCentimes ?? 0
  // Jamais de remboursement de 0 centime (contrainte en base) : l'incident seul en garde la trace.
  if (montantCentimes <= 0) return { id: null, montantCentimes, nouveau: false }
  const cree = await tx.remboursementCommande.create({
    data: { commandeId: commande.id, paiementId, montantCentimes, devise: devise.toUpperCase() },
    select: { id: true },
  })
  return { id: cree.id, montantCentimes, nouveau: true }
}

/**
 * Passe une commande en attente à `annulee` (mise à jour conditionnelle, table de transitions), libère
 * la réservation de ses œuvres (jamais une œuvre vendue ailleurs ou retirée) et écrit l'événement
 * `CommandeAnnulee`. Rend les ids d'événements, ou null si la commande n'était plus en attente.
 */
export async function annulerEnAttente(
  tx: Prisma.TransactionClient,
  commande: { id: string; passageId: string; artworkIds: readonly string[] },
  par: string,
  maintenant: Date,
): Promise<string[] | null> {
  if (!transitionPermise('en_attente_paiement', 'annulee')) throw new Error('transition_interdite')
  const maj = await tx.commande.updateMany({ where: { id: commande.id, etat: 'en_attente_paiement' }, data: { etat: 'annulee' } })
  if (maj.count !== 1) return null
  const liberation = commande.artworkIds.length === 0
    ? { evenements: [] as string[] }
    : await libererReservation(commande.passageId, { issue: 'liberee', par, maintenant, artworkIds: commande.artworkIds }, tx)
  return [...liberation.evenements, await ecrireEvenement(tx, { nom: 'CommandeAnnulee', charge: { commandeId: commande.id } })]
}

// ── Gestes de l'équipe ───────────────────────────────────────────────────────

export type ResultatAnnulation =
  | { ok: true; dejaAnnulee: boolean }
  | { ok: false; code: 'acces_refuse' | 'invalide' | 'introuvable' | 'etat_invalide' }

/**
 * « Annuler la commande » (admin seulement) : une commande en attente de paiement devient `annulee`, la
 * réservation de ses œuvres est libérée, sans remboursement (rien n'a été reçu). Rejouée sur une commande
 * déjà annulée : succès sans effet. Une commande confirmée ou historique : `etat_invalide`.
 */
export async function annulerCommande(acteur: Acteur, commandeId: string): Promise<ResultatAnnulation> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  if (typeof commandeId !== 'string' || commandeId === '') return { ok: false, code: 'invalide' }

  const interne = await prisma.$transaction(
    async (tx): Promise<{ resultat: ResultatAnnulation; evenements: string[] }> => {
      const lue = await tx.commande.findUnique({ where: { id: commandeId }, select: { passageId: true } })
      if (!lue) return { resultat: { ok: false, code: 'introuvable' }, evenements: [] }
      if (!lue.passageId) return { resultat: { ok: false, code: 'etat_invalide' }, evenements: [] }
      // Même verrou que le constat d'un paiement : les deux gestes se suivent.
      await tx.$queryRaw`SELECT "id" FROM "PassageEnCaisse" WHERE "id" = ${lue.passageId} FOR UPDATE`
      const commande = await tx.commande.findUnique({
        where: { id: commandeId },
        select: { id: true, etat: true, passageId: true, lignes: { select: { artworkId: true } } },
      })
      if (!commande || !commande.passageId) return { resultat: { ok: false, code: 'introuvable' }, evenements: [] }
      if (commande.etat === 'annulee') return { resultat: { ok: true, dejaAnnulee: true }, evenements: [] }
      if (commande.etat !== 'en_attente_paiement') return { resultat: { ok: false, code: 'etat_invalide' }, evenements: [] }
      const evenements = await annulerEnAttente(
        tx,
        { id: commande.id, passageId: commande.passageId, artworkIds: commande.lignes.flatMap((l) => (l.artworkId ? [l.artworkId] : [])) },
        acteur.userId,
        new Date(),
      )
      if (evenements === null) return { resultat: { ok: false, code: 'etat_invalide' }, evenements: [] }
      return { resultat: { ok: true, dejaAnnulee: false }, evenements }
    },
    { maxWait: 5000, timeout: 20000 },
  )
  await repartirApresValidation(interne.evenements)
  return interne.resultat
}

export type ResultatRemboursementEffectue =
  | { ok: true; dejaEffectue: boolean }
  | { ok: false; code: 'acces_refuse' | 'invalide' | 'introuvable' }

/**
 * « Marquer comme effectué » (admin seulement), après le remboursement fait à la main : `demande` →
 * `effectue` par mise à jour conditionnelle, avec l'auteur et la date. Rejoué : succès sans effet.
 */
export async function marquerRemboursementEffectue(acteur: Acteur, remboursementId: string): Promise<ResultatRemboursementEffectue> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  if (typeof remboursementId !== 'string' || remboursementId === '') return { ok: false, code: 'invalide' }
  const maj = await prisma.remboursementCommande.updateMany({
    where: { id: remboursementId, etat: 'demande' },
    data: { etat: 'effectue', effectuePar: acteur.userId, effectueLe: new Date() },
  })
  if (maj.count === 1) return { ok: true, dejaEffectue: false }
  const existe = await prisma.remboursementCommande.findUnique({ where: { id: remboursementId }, select: { etat: true } })
  return existe ? { ok: true, dejaEffectue: true } : { ok: false, code: 'introuvable' }
}

export type RemboursementDeLEquipe = {
  id: string
  commandeNumero: string
  montantCentimes: number
  devise: string
  demandeLe: Date
  acheteur: { nom: string; email: string } | null
}

/** Remboursements à traiter (état `demande`), du plus ancien au plus récent. Admin seulement, sinon null. */
export async function remboursementsDeLEquipe(acteur: Acteur): Promise<RemboursementDeLEquipe[] | null> {
  if (acteur.type !== 'admin') return null
  const lus = await prisma.remboursementCommande.findMany({
    where: { etat: 'demande' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 200,
    include: { commande: { select: { numero: true, passage: { select: { coordonnees: { select: { nom: true, email: true } } } } } } },
  })
  return lus.map((r) => ({
    id: r.id,
    commandeNumero: r.commande.numero,
    montantCentimes: r.montantCentimes,
    devise: r.devise,
    demandeLe: r.createdAt,
    acheteur: r.commande.passage?.coordonnees ? { nom: r.commande.passage.coordonnees.nom, email: r.commande.passage.coordonnees.email } : null,
  }))
}
