import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import type { Acteur } from '@/lib/acces'
import { vendreOeuvresDuPassage } from '@/lib/disponibilite'
import { ecrireEvenement, repartirApresValidation } from '@/lib/evenements'
import { MONTANT_MAX_CENTIMES, type FaitPaiementConstate } from '@/lib/paiement'
import { annulerEnAttente, demanderRemboursement } from './annulation'
import { transitionPermise } from './etats'

// Paiement constaté (story 6.4, FR-13, AD-4, AD-8) : point d'entrée unique du module commandes pour
// un paiement reçu, quelle qu'en soit la source (aujourd'hui, le constat manuel de l'équipe). Une seule
// transaction : `Paiement` `ouvert` → `constate` par mise à jour conditionnelle, œuvres du passage `vendue`
// (par `disponibilite`, qui ferme leurs réservations `confirmee`), commandes `confirmee`, événements
// `PaiementConstate` et `CommandeConfirmee`. Un paiement couvre tout le passage (décision 1A, OQ-16
// ouverte) : le montant doit égaler le total des commandes en attente du passage, plus celles déjà
// annulées avant ce paiement, lu par agrégat de la base (totaux de lignes figés), jamais par une addition
// dans le code. Un montant ou une devise différents ne confirment rien et laissent un incident.
// Paiement tardif (story 6.5) : la décision est prise commande par commande. Œuvres vendables et
// échéance d'abandon non dépassée : confirmée. Œuvre prise par un autre, commande déjà annulée ou
// abandonnée : jamais confirmée, `annulee`, remboursement `demande` égal à son allocation et incident ;
// les autres commandes du passage restent confirmées. Seul l'acteur `admin`, vérifié ici. Jamais
// d'e-mail ni d'adresse dans les journaux.

export type CauseIncident = 'montant_different' | 'devise_differente' | 'oeuvre_indisponible' | 'commande_annulee'

export type ResultatPaiementConstate =
  | { ok: true; paiementId: string; commandes: number; annulees: number; dejaConstate: boolean }
  | { ok: false; code: 'acces_refuse' | 'invalide' | 'introuvable' }
  | { ok: false; code: 'refuse'; cause: 'montant_different' | 'devise_differente'; incidentId: string }

function faitValide(fait: FaitPaiementConstate): boolean {
  return (
    !!fait &&
    typeof fait.passageId === 'string' && fait.passageId !== '' &&
    typeof fait.source === 'string' && fait.source.trim() !== '' &&
    typeof fait.referenceExterne === 'string' && fait.referenceExterne.trim() !== '' &&
    typeof fait.montantCentimes === 'number' && Number.isSafeInteger(fait.montantCentimes) && fait.montantCentimes > 0 && fait.montantCentimes <= MONTANT_MAX_CENTIMES &&
    (fait.devise === undefined || (typeof fait.devise === 'string' && /^[A-Za-z]{3}$/.test(fait.devise)))
  )
}

/**
 * Traite un paiement constaté pour un passage en caisse. Rejoué (même paire source + référence) ou
 * constaté sous une autre référence alors que le passage est déjà constaté : succès sans effet
 * (`dejaConstate`). Deux constats simultanés se suivent sous le verrou de la ligne du passage : un seul
 * vend, l'autre ne change rien.
 */
export async function traiterPaiementConstate(acteur: Acteur, fait: FaitPaiementConstate): Promise<ResultatPaiementConstate> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  if (!faitValide(fait)) return { ok: false, code: 'invalide' }
  const source = fait.source.trim()
  const reference = fait.referenceExterne.trim()
  const constatePar = fait.constatePar ?? acteur.userId
  const constateLe = fait.constateLe instanceof Date && !Number.isNaN(fait.constateLe.getTime()) ? fait.constateLe : new Date()

  const interne = await prisma.$transaction(
    async (tx): Promise<{ resultat: ResultatPaiementConstate; evenements: string[] }> => {
      const fin = (resultat: ResultatPaiementConstate, evenements: string[] = []) => ({ resultat, evenements })

      // Verrou du passage : deux constats simultanés se suivent.
      const verrou = await tx.$queryRaw<{ devise: string }[]>`SELECT "devise" FROM "PassageEnCaisse" WHERE "id" = ${fait.passageId} FOR UPDATE`
      if (verrou.length === 0) return fin({ ok: false, code: 'introuvable' })
      const devisePassage = verrou[0].devise.toUpperCase()

      const connu = await tx.paiement.findUnique({ where: { source_referenceExterne: { source, referenceExterne: reference } } })
      if (connu && connu.passageId !== fait.passageId) return fin({ ok: false, code: 'invalide' })
      if (connu?.etat === 'constate') return fin({ ok: true, paiementId: connu.id, commandes: 0, annulees: 0, dejaConstate: true })
      if (connu && connu.etat !== 'ouvert') return fin({ ok: false, code: 'invalide' })
      const dejaConstate = await tx.paiement.findFirst({ where: { passageId: fait.passageId, etat: 'constate' }, select: { id: true } })
      if (dejaConstate) return fin({ ok: true, paiementId: dejaConstate.id, commandes: 0, annulees: 0, dejaConstate: true })

      // Commandes du paiement : en attente, et annulées avant lui (jamais confirmées : remboursement).
      const commandes = await tx.commande.findMany({
        where: { passageId: fait.passageId, etat: { in: ['en_attente_paiement', 'annulee'] } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          etat: true,
          abandonneLe: true,
          lignes: { orderBy: { createdAt: 'asc' }, select: { artworkId: true, slug: true } },
          remboursement: { select: { id: true } },
        },
      })
      if (commandes.length === 0) return fin({ ok: false, code: 'invalide' })

      // Paiement ouvert du passage : repris (référence et montant mis à jour) ou créé ; un seul par passage.
      const ouvert = connu ?? (await tx.paiement.findFirst({ where: { passageId: fait.passageId, etat: 'ouvert' } }))
      const paiement = ouvert
        ? await tx.paiement.update({ where: { id: ouvert.id }, data: { source, referenceExterne: reference, montantCentimes: fait.montantCentimes } })
        : await tx.paiement.create({ data: { passageId: fait.passageId, source, referenceExterne: reference, montantCentimes: fait.montantCentimes } })

      const refuser = async (cause: 'montant_different' | 'devise_differente', extra: { attenduCentimes?: number } = {}) => {
        // Un même incident non traité du même paiement n'est pas écrit deux fois.
        const existant = await tx.incident.findFirst({ where: { paiementId: paiement.id, cause, traiteLe: null }, select: { id: true } })
        const valeurs = {
          commandeId: null,
          attenduCentimes: extra.attenduCentimes ?? null,
          recuCentimes: fait.montantCentimes,
        }
        // Un incident non traité de même cause est mis à jour avec la dernière tentative.
        const incident = existant
          ? await tx.incident.update({ where: { id: existant.id }, data: valeurs, select: { id: true } })
          : await tx.incident.create({ data: { passageId: fait.passageId, paiementId: paiement.id, cause, ...valeurs }, select: { id: true } })
        return fin({ ok: false, code: 'refuse', cause, incidentId: incident.id })
      }

      const devise = (fait.devise ?? devisePassage).toUpperCase()
      const somme = await tx.ligneCommande.aggregate({
        where: { commande: { passageId: fait.passageId, etat: { in: ['en_attente_paiement', 'annulee'] } } },
        _sum: { totalCentimes: true },
      })
      const attendu = somme._sum.totalCentimes ?? 0
      // Deux totaux acceptés, chacun lu par agrégat : en attente seul (les commandes annulées ne sont pas
      // payées : elles ne sont ni confirmées ni remboursées), ou en attente + annulées avant ce paiement.
      const sommeEnAttente = await tx.ligneCommande.aggregate({
        where: { commande: { passageId: fait.passageId, etat: 'en_attente_paiement' } },
        _sum: { totalCentimes: true },
      })
      const attenduEnAttente = sommeEnAttente._sum.totalCentimes ?? 0
      if (devise !== devisePassage) return refuser('devise_differente', { attenduCentimes: attendu })
      const enAttenteSeul = fait.montantCentimes !== attendu && fait.montantCentimes === attenduEnAttente
      if (fait.montantCentimes !== attendu && !enAttenteSeul) return refuser('montant_different', { attenduCentimes: attendu })

      // Paiement constaté : l'argent est arrivé, quel que soit le sort de chaque commande.
      const constate = await tx.paiement.updateMany({
        where: { id: paiement.id, etat: 'ouvert' },
        data: { etat: 'constate', constatePar, constateLe },
      })
      // Filet : jamais atteint sous le verrou du passage ; annule la transaction entière.
      if (constate.count !== 1) throw new Error('paiement_conflit')
      if (!transitionPermise('en_attente_paiement', 'confirmee')) throw new Error('transition_interdite')

      const evenements: string[] = [await ecrireEvenement(tx, { nom: 'PaiementConstate', charge: { paiementId: paiement.id } })]
      let confirmees = 0
      let annulees = 0
      // Écrit le remboursement et l'incident d'une commande qui ne sera pas confirmée (un seul de chaque).
      const rembourser = async (commande: { id: string }, cause: 'oeuvre_indisponible' | 'commande_annulee') => {
        const r = await demanderRemboursement(tx, commande, paiement.id, devisePassage)
        const deja = await tx.incident.findFirst({ where: { paiementId: paiement.id, commandeId: commande.id, cause }, select: { id: true } })
        if (!deja) {
          await tx.incident.create({
            data: { passageId: fait.passageId, paiementId: paiement.id, commandeId: commande.id, cause, attenduCentimes: r.montantCentimes, recuCentimes: fait.montantCentimes },
          })
        }
      }
      for (const c of commandes) {
        // Déjà annulée : jamais confirmée ; remboursée seulement si le paiement les couvrait.
        if (c.etat === 'annulee' && enAttenteSeul) continue
        if (c.etat === 'annulee') {
          await rembourser(c, 'commande_annulee')
          annulees += 1
          continue
        }
        const artworkIds = c.lignes.flatMap((l) => (l.artworkId ? [l.artworkId] : []))
        const abandonnee = c.abandonneLe !== null && c.abandonneLe.getTime() <= constateLe.getTime()
        let cause: 'oeuvre_indisponible' | 'commande_annulee' | null = null
        if (abandonnee) cause = 'commande_annulee'
        else if (artworkIds.length !== c.lignes.length) cause = 'oeuvre_indisponible'
        else {
          const vente = await vendreOeuvresDuPassage(fait.passageId, artworkIds, tx, constateLe)
          if (vente.ok) {
            const maj = await tx.commande.updateMany({ where: { id: c.id, etat: 'en_attente_paiement' }, data: { etat: 'confirmee' } })
            if (maj.count !== 1) throw new Error('commande_conflit')
            evenements.push(...vente.evenements, await ecrireEvenement(tx, { nom: 'CommandeConfirmee', charge: { commandeId: c.id } }))
            confirmees += 1
          } else cause = 'oeuvre_indisponible'
        }
        if (cause !== null) {
          const ev = await annulerEnAttente(tx, { id: c.id, passageId: fait.passageId, artworkIds }, constatePar, constateLe)
          if (ev === null) throw new Error('commande_conflit')
          evenements.push(...ev)
          await rembourser(c, cause)
          annulees += 1
        }
      }
      return fin({ ok: true, paiementId: paiement.id, commandes: confirmees, annulees, dejaConstate: false }, evenements)
    },
    { maxWait: 5000, timeout: 20000 },
  )
  await repartirApresValidation(interne.evenements)
  return interne.resultat
}

// ── Lecture pour l'équipe ────────────────────────────────────────────────────

export type CommandeEnAttente = {
  passageId: string
  acheteur: { nom: string; email: string } | null
  devise: string
  /** Total à recevoir : agrégat de la base des totaux de lignes figés (commandes en attente). */
  totalCentimes: number
  /** Total des commandes en attente et des commandes annulées du passage ; absent sans commande annulée. */
  totalAvecAnnuleesCentimes: number | null
  commandes: { id: string; numero: string; oeuvres: string[] }[]
}

export type IncidentDeLEquipe = {
  id: string
  passageId: string
  cause: CauseIncident
  attenduCentimes: number | null
  recuCentimes: number | null
  /** Numéro de la commande concernée, si l'incident en désigne une. */
  commandeNumero: string | null
  devise: string | null
  creeLe: Date
  acheteur: { nom: string; email: string } | null
}

/** Passages dont des commandes attendent leur paiement, du plus ancien au plus récent. Admin seulement, sinon null. */
export async function commandesEnAttenteDeLEquipe(acteur: Acteur): Promise<CommandeEnAttente[] | null> {
  if (acteur.type !== 'admin') return null
  const commandes = await prisma.commande.findMany({
    where: { etat: 'en_attente_paiement', passageId: { not: null } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, passageId: true, numero: true, devise: true, lignes: { orderBy: { createdAt: 'asc' }, select: { titre: true } } },
  })
  const passages = [...new Set(commandes.map((c) => c.passageId as string))]
  if (passages.length === 0) return []
  const [coordonnees, sommes, sommesAvecAnnulees] = await Promise.all([
    prisma.coordonneesAcheteur.findMany({ where: { passageId: { in: passages } }, select: { passageId: true, nom: true, email: true } }),
    // Total à recevoir par passage : agrégat de la base, jamais une addition dans le code.
    prisma.$queryRaw<{ passageId: string; total: number }[]>`
      SELECT c."passageId", SUM(l."totalCentimes")::bigint AS total
      FROM "Commande" c JOIN "LigneCommande" l ON l."commandeId" = c."id"
      WHERE c."passageId" = ANY(${passages}) AND c."etat" = 'en_attente_paiement'
      GROUP BY c."passageId"`,
    prisma.$queryRaw<{ passageId: string; total: number }[]>`
      SELECT c."passageId", SUM(l."totalCentimes")::bigint AS total
      FROM "Commande" c JOIN "LigneCommande" l ON l."commandeId" = c."id"
      WHERE c."passageId" = ANY(${passages}) AND c."etat" IN ('en_attente_paiement', 'annulee')
      AND EXISTS (SELECT 1 FROM "Commande" a WHERE a."passageId" = c."passageId" AND a."etat" = 'annulee')
      GROUP BY c."passageId"`,
  ])
  const acheteur = new Map(coordonnees.map((c) => [c.passageId, { nom: c.nom, email: c.email }]))
  const total = new Map(sommes.map((s) => [s.passageId, Number(s.total)]))
  const totalAvecAnnulees = new Map(sommesAvecAnnulees.map((s) => [s.passageId, Number(s.total)]))
  const parPassage = new Map<string, CommandeEnAttente>()
  for (const c of commandes) {
    const id = c.passageId as string
    const existant = parPassage.get(id) ?? { passageId: id, acheteur: acheteur.get(id) ?? null, devise: c.devise, totalCentimes: total.get(id) ?? 0, totalAvecAnnuleesCentimes: totalAvecAnnulees.get(id) ?? null, commandes: [] }
    existant.commandes.push({ id: c.id, numero: c.numero, oeuvres: c.lignes.map((l) => l.titre) })
    parPassage.set(id, existant)
  }
  return [...parPassage.values()]
}

/** Incidents non traités, du plus récent au plus ancien. Admin seulement, sinon null. */
export async function incidentsDeLEquipe(acteur: Acteur): Promise<IncidentDeLEquipe[] | null> {
  if (acteur.type !== 'admin') return null
  const lus = await prisma.incident.findMany({
    where: { traiteLe: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 100,
    include: { commande: { select: { numero: true } }, passage: { select: { devise: true, coordonnees: { select: { nom: true, email: true } } } } },
  })
  return lus.map((i) => ({
    id: i.id,
    passageId: i.passageId,
    cause: i.cause,
    attenduCentimes: i.attenduCentimes,
    recuCentimes: i.recuCentimes,
    commandeNumero: i.commande?.numero ?? null,
    devise: i.passage.devise,
    creeLe: i.createdAt,
    acheteur: i.passage.coordonnees ? { nom: i.passage.coordonnees.nom, email: i.passage.coordonnees.email } : null,
  }))
}
