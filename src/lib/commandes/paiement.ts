import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import type { Acteur } from '@/lib/acces'
import { vendreOeuvresDuPassage } from '@/lib/disponibilite'
import { ecrireEvenement, repartirApresValidation } from '@/lib/evenements'
import { MONTANT_MAX_CENTIMES, type FaitPaiementConstate } from '@/lib/paiement'
import { transitionPermise } from './etats'

// Paiement constaté (story 6.4, FR-13, AD-4, AD-8) : point d'entrée unique du module commandes pour
// un paiement reçu, quelle qu'en soit la source (aujourd'hui, le constat manuel de l'équipe). Une seule
// transaction : `Paiement` `ouvert` → `constate` par mise à jour conditionnelle, œuvres du passage `vendue`
// (par `disponibilite`, qui ferme leurs réservations `confirmee`), commandes `confirmee`, événements
// `PaiementConstate` et `CommandeConfirmee`. Un paiement couvre tout le passage (décision 1A, OQ-16
// ouverte) : toutes les commandes en attente du passage sont confirmées ensemble, ou aucune. Le total
// attendu vient d'un agrégat de la base (totaux de lignes figés), jamais d'une addition dans le code.
// Un montant ou une devise différents, ou une œuvre plus vendable, ne confirment rien et laissent un
// incident (annulation et remboursement : story 6.5). Seul l'acteur `admin`, vérifié ici. Jamais
// d'e-mail ni d'adresse dans les journaux.

export type CauseIncident = 'montant_different' | 'devise_differente' | 'oeuvre_indisponible'

export type ResultatPaiementConstate =
  | { ok: true; paiementId: string; commandes: number; dejaConstate: boolean }
  | { ok: false; code: 'acces_refuse' | 'invalide' | 'introuvable' }
  | { ok: false; code: 'refuse'; cause: CauseIncident; incidentId: string; slug?: string }

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
      if (connu?.etat === 'constate') return fin({ ok: true, paiementId: connu.id, commandes: 0, dejaConstate: true })
      if (connu && connu.etat !== 'ouvert') return fin({ ok: false, code: 'invalide' })
      const dejaConstate = await tx.paiement.findFirst({ where: { passageId: fait.passageId, etat: 'constate' }, select: { id: true } })
      if (dejaConstate) return fin({ ok: true, paiementId: dejaConstate.id, commandes: 0, dejaConstate: true })

      const commandes = await tx.commande.findMany({
        where: { passageId: fait.passageId, etat: 'en_attente_paiement' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, lignes: { select: { artworkId: true, slug: true } } },
      })
      if (commandes.length === 0) return fin({ ok: false, code: 'invalide' })

      // Paiement ouvert du passage : repris (référence et montant mis à jour) ou créé ; un seul par passage.
      const ouvert = connu ?? (await tx.paiement.findFirst({ where: { passageId: fait.passageId, etat: 'ouvert' } }))
      const paiement = ouvert
        ? await tx.paiement.update({ where: { id: ouvert.id }, data: { source, referenceExterne: reference, montantCentimes: fait.montantCentimes } })
        : await tx.paiement.create({ data: { passageId: fait.passageId, source, referenceExterne: reference, montantCentimes: fait.montantCentimes } })

      const refuser = async (cause: CauseIncident, extra: { attenduCentimes?: number; slug?: string; commandeId?: string } = {}) => {
        // Un même incident non traité du même paiement n'est pas écrit deux fois.
        const existant = await tx.incident.findFirst({ where: { paiementId: paiement.id, cause, traiteLe: null }, select: { id: true } })
        const valeurs = {
          commandeId: extra.commandeId ?? null,
          attenduCentimes: extra.attenduCentimes ?? null,
          recuCentimes: fait.montantCentimes,
        }
        // Un incident non traité de même cause est mis à jour avec la dernière tentative.
        const incident = existant
          ? await tx.incident.update({ where: { id: existant.id }, data: valeurs, select: { id: true } })
          : await tx.incident.create({ data: { passageId: fait.passageId, paiementId: paiement.id, cause, ...valeurs }, select: { id: true } })
        return fin({ ok: false, code: 'refuse', cause, incidentId: incident.id, ...(extra.slug ? { slug: extra.slug } : {}) })
      }

      const devise = (fait.devise ?? devisePassage).toUpperCase()
      const somme = await tx.ligneCommande.aggregate({
        where: { commande: { passageId: fait.passageId, etat: 'en_attente_paiement' } },
        _sum: { totalCentimes: true },
      })
      const attendu = somme._sum.totalCentimes ?? 0
      if (devise !== devisePassage) return refuser('devise_differente', { attenduCentimes: attendu })
      if (fait.montantCentimes !== attendu) return refuser('montant_different', { attenduCentimes: attendu })

      const lignes = commandes.flatMap((c) => c.lignes.map((l) => ({ ...l, commandeId: c.id })))
      const sansOeuvre = lignes.find((l) => l.artworkId === null)
      if (sansOeuvre) return refuser('oeuvre_indisponible', { attenduCentimes: attendu, slug: sansOeuvre.slug, commandeId: sansOeuvre.commandeId })
      const vente = await vendreOeuvresDuPassage(fait.passageId, lignes.map((l) => l.artworkId as string), tx, constateLe)
      if (!vente.ok) {
        const ligne = lignes.find((l) => l.artworkId === vente.artworkId)
        return refuser('oeuvre_indisponible', { attenduCentimes: attendu, slug: ligne?.slug, commandeId: ligne?.commandeId })
      }

      const constate = await tx.paiement.updateMany({
        where: { id: paiement.id, etat: 'ouvert' },
        data: { etat: 'constate', constatePar, constateLe },
      })
      // Filet : jamais atteint sous le verrou du passage ; annule la transaction entière.
      if (constate.count !== 1) throw new Error('paiement_conflit')
      if (!transitionPermise('en_attente_paiement', 'confirmee')) throw new Error('transition_interdite')
      const confirmees = await tx.commande.updateMany({
        where: { id: { in: commandes.map((c) => c.id) }, etat: 'en_attente_paiement' },
        data: { etat: 'confirmee' },
      })
      if (confirmees.count !== commandes.length) throw new Error('commande_conflit')

      const evenements = [...vente.evenements, await ecrireEvenement(tx, { nom: 'PaiementConstate', charge: { paiementId: paiement.id } })]
      for (const c of commandes) evenements.push(await ecrireEvenement(tx, { nom: 'CommandeConfirmee', charge: { commandeId: c.id } }))
      return fin({ ok: true, paiementId: paiement.id, commandes: commandes.length, dejaConstate: false }, evenements)
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
  /** Total à recevoir : agrégat de la base des totaux de lignes figés. */
  totalCentimes: number
  commandes: { numero: string; oeuvres: string[] }[]
}

export type IncidentDeLEquipe = {
  id: string
  passageId: string
  cause: CauseIncident
  attenduCentimes: number | null
  recuCentimes: number | null
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
    select: { passageId: true, numero: true, devise: true, lignes: { orderBy: { createdAt: 'asc' }, select: { titre: true } } },
  })
  const passages = [...new Set(commandes.map((c) => c.passageId as string))]
  if (passages.length === 0) return []
  const [coordonnees, sommes] = await Promise.all([
    prisma.coordonneesAcheteur.findMany({ where: { passageId: { in: passages } }, select: { passageId: true, nom: true, email: true } }),
    // Total à recevoir par passage : agrégat de la base, jamais une addition dans le code.
    prisma.$queryRaw<{ passageId: string; total: number }[]>`
      SELECT c."passageId", SUM(l."totalCentimes")::bigint AS total
      FROM "Commande" c JOIN "LigneCommande" l ON l."commandeId" = c."id"
      WHERE c."passageId" = ANY(${passages}) AND c."etat" = 'en_attente_paiement'
      GROUP BY c."passageId"`,
  ])
  const acheteur = new Map(coordonnees.map((c) => [c.passageId, { nom: c.nom, email: c.email }]))
  const total = new Map(sommes.map((s) => [s.passageId, Number(s.total)]))
  const parPassage = new Map<string, CommandeEnAttente>()
  for (const c of commandes) {
    const id = c.passageId as string
    const existant = parPassage.get(id) ?? { passageId: id, acheteur: acheteur.get(id) ?? null, devise: c.devise, totalCentimes: total.get(id) ?? 0, commandes: [] }
    existant.commandes.push({ numero: c.numero, oeuvres: c.lignes.map((l) => l.titre) })
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
    include: { passage: { select: { devise: true, coordonnees: { select: { nom: true, email: true } } } } },
  })
  return lus.map((i) => ({
    id: i.id,
    passageId: i.passageId,
    cause: i.cause,
    attenduCentimes: i.attenduCentimes,
    recuCentimes: i.recuCentimes,
    devise: i.passage.devise,
    creeLe: i.createdAt,
    acheteur: i.passage.coordonnees ? { nom: i.passage.coordonnees.nom, email: i.passage.coordonnees.email } : null,
  }))
}
