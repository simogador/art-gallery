import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import { lirePassageDuNavigateur } from '@/lib/acces/commande-publique'
import { adaptateurEncaissement, MONTANT_MAX_CENTIMES, type EncaissementOuvrable } from '@/lib/paiement'
import { reservationsActivesDuPassage } from '@/lib/disponibilite'
import { estEchue } from '@/lib/disponibilite/reservation-regles'
import { lot2Ouvert } from '@/lib/reglages'
import { lirePassagePublic, type PassagePublic } from './passage-public'

// Récapitulatif et paiement de l'acheteur sans compte (story 7.4, FR-11, FR-14, AD-4). Le passage est
// retrouvé par le jeton `commande_publique` du cookie, jamais par un identifiant du navigateur. Les montants
// d'une commande et du passage sont lus par AGRÉGAT de la base sur les lignes figées (`_sum`, `_max`) :
// aucune addition dans le code ni dans l'interface. Le seul écrivain de `Paiement` reste ce module
//  ; sans adaptateur d'encaissement (OQ-1 ouverte), aucun Paiement n'est créé. Jamais d'e-mail
// ni d'adresse dans les journaux.

export type CommandePaiement = {
  numero: string
  artiste: string
  devise: string
  lignes: PassagePublic['commandes'][number]['lignes']
  prixCentimes: number
  fraisCentimes: number
  totalCentimes: number
  delaiMinJours: number
  delaiMaxJours: number
}

export type RecapitulatifPaiement = {
  passageId: string
  pays: string
  devise: string
  echeance: Date
  echue: boolean
  commandes: CommandePaiement[]
  /** Total du passage, lu par agrégat de la base. */
  totalCentimes: number
}

/**
 * Passage de l'acheteur prêt pour la page de paiement, ou null (jeton absent, périmé, passage payé, annulé ou
 * abandonné). Commandes, agrégat par commande et total sont lus dans UNE transaction (lecture cohérente), les
 * commandes en attente de paiement seulement. Une commande du passage sans ligne ou introuvable lève une erreur
 * (la page affiche l'état de panne, « Réessayer ») : ce n'est pas « aucune commande à payer ».
 */
export async function lireRecapitulatifPaiement(jeton: string | undefined, maintenant: Date = new Date()): Promise<RecapitulatifPaiement | null> {
  const passage = await lirePassagePublic(jeton, maintenant)
  if (!passage) return null
  const numeros = passage.commandes.map((c) => c.numero)
  const { lues, parCommande, general } = await prisma.$transaction(async (tx) => {
    const lues = await tx.commande.findMany({
      where: { passageId: passage.passageId, numero: { in: numeros }, etat: 'en_attente_paiement' },
      select: { id: true, numero: true, artist: { select: { name: true } } },
    })
    const ids = lues.map((c) => c.id)
    const parCommande = await tx.ligneCommande.groupBy({
      by: ['commandeId'],
      where: { commandeId: { in: ids } },
      _sum: { prixCentimes: true, fraisCentimes: true, totalCentimes: true },
      _max: { delaiMinJours: true, delaiMaxJours: true },
    })
    const general = await tx.ligneCommande.aggregate({ where: { commandeId: { in: ids } }, _sum: { totalCentimes: true } })
    return { lues, parCommande, general }
  })
  const commandes: CommandePaiement[] = []
  for (const c of passage.commandes) {
    const lue = lues.find((x) => x.numero === c.numero)
    const agregat = parCommande.find((g) => g.commandeId === lue?.id)
    if (!lue || !agregat) throw new Error('recapitulatif_incoherent')
    commandes.push({
      numero: c.numero,
      artiste: lue.artist?.name ?? '',
      devise: c.devise,
      lignes: c.lignes,
      prixCentimes: agregat._sum.prixCentimes ?? 0,
      fraisCentimes: agregat._sum.fraisCentimes ?? 0,
      totalCentimes: agregat._sum.totalCentimes ?? 0,
      delaiMinJours: agregat._max.delaiMinJours ?? 0,
      delaiMaxJours: agregat._max.delaiMaxJours ?? 0,
    })
  }
  return {
    passageId: passage.passageId,
    pays: passage.pays,
    devise: passage.devise,
    echeance: passage.echeance,
    echue: passage.echue,
    commandes,
    totalCentimes: general._sum.totalCentimes ?? 0,
  }
}

export type ResultatOuverturePaiement =
  | { ok: true; paiementId: string; montantCentimes: number; devise: string; referenceExterne: string; reutilise: boolean }
  | { ok: false; code: 'ferme' | 'aucun_adaptateur' | 'introuvable' | 'echue' | 'refuse' | 'total_change' | 'paiement_deja_ouvert' }

type Client = Prisma.TransactionClient

/** Total des commandes en attente (non abandonnées) du passage, par agrégat de la base ; null si aucune. */
async function totalEnAttente(tx: Client, passageId: string, maintenant: Date): Promise<number | null> {
  const enAttente = await tx.commande.findMany({
    where: { passageId, etat: 'en_attente_paiement', OR: [{ abandonneLe: null }, { abandonneLe: { gt: maintenant } }] },
    select: { id: true },
  })
  if (enAttente.length === 0) return null
  const somme = await tx.ligneCommande.aggregate({ where: { commandeId: { in: enAttente.map((c) => c.id) } }, _sum: { totalCentimes: true } })
  return somme._sum.totalCentimes ?? 0
}

// Appels en cours dans ce processus, par passage : deux ouvertures simultanées partagent un seul appel à
// l'adaptateur. Entre instances, le verrou et l'index partiel ne laissent qu'un Paiement ouvert ; l'appel de
// l'autre instance reste une session de prestataire orpheline (limite documentée pour la story 7.5).
const enVol = new Map<string, Promise<ResultatOuverturePaiement>>()

/**
 * Ouvre le paiement du passage du navigateur (story 7.4). Aucune page ne l'appelle encore : la story 7.5
 * l'appellera depuis une action serveur déclenchée par l'acheteur. Ordre : Lot 2 fermé → `ferme` ; sans
 * adaptateur (aujourd'hui) → `aucun_adaptateur` avant toute lecture ou écriture ; total lu par agrégat ;
 * appel de l'adaptateur HORS transaction (jamais d'appel externe sous le verrou) ; puis, sous le verrou de la
 * ligne du passage, revérification (réservation non échue, commandes en attente, total ÉGAL à celui envoyé,
 * sinon `total_change`) et création du seul Paiement `ouvert` (index partiel `Paiement_ouvert_par_passage`).
 * Un Paiement ouvert de même source et de même montant est repris sans rappeler l'adaptateur ; une autre source
 * (constat manuel) ou un autre montant : `paiement_deja_ouvert`, jamais d'écrasement. Si la transaction échoue
 * après l'appel de l'adaptateur, la session créée chez le prestataire reste orpheline (à clore ou laisser
 * expirer par l'adaptateur de la 7.5). Aucune page n'est écrite par un simple affichage.
 */
export async function ouvrirPaiement(
  jeton: string | undefined,
  options: { adaptateur?: EncaissementOuvrable | null; maintenant?: Date } = {},
): Promise<ResultatOuverturePaiement> {
  if (!lot2Ouvert()) return { ok: false, code: 'ferme' }
  const adaptateur = options.adaptateur === undefined ? adaptateurEncaissement() : options.adaptateur
  if (!adaptateur) return { ok: false, code: 'aucun_adaptateur' }
  const maintenant = options.maintenant ?? new Date()
  const passage = await lirePassagePublic(jeton, maintenant)
  if (!passage) return { ok: false, code: 'introuvable' }
  if (passage.echue) return { ok: false, code: 'echue' }

  const cle = passage.passageId
  const enCours = enVol.get(cle)
  if (enCours) return enCours
  const appel = ouvrir(jeton as string, passage.passageId, adaptateur, maintenant).finally(() => enVol.delete(cle))
  enVol.set(cle, appel)
  return appel
}

async function ouvrir(jeton: string, passageId: string, adaptateur: EncaissementOuvrable, maintenant: Date): Promise<ResultatOuverturePaiement> {
  try {
    const montant = await totalEnAttente(prisma, passageId, maintenant)
    if (montant === null) return { ok: false, code: 'introuvable' }
    if (!Number.isSafeInteger(montant) || montant <= 0 || montant > MONTANT_MAX_CENTIMES) return { ok: false, code: 'refuse' }
    const passageLu = await prisma.passageEnCaisse.findUnique({ where: { id: passageId }, select: { devise: true } })
    if (!passageLu) return { ok: false, code: 'introuvable' }
    const devise = passageLu.devise.toUpperCase()

    const ouvert = await prisma.paiement.findFirst({ where: { passageId, etat: 'ouvert' } })
    if (ouvert) {
      return ouvert.source === adaptateur.source && ouvert.montantCentimes === montant
        ? { ok: true, paiementId: ouvert.id, montantCentimes: montant, devise, referenceExterne: ouvert.referenceExterne, reutilise: true }
        : { ok: false, code: 'paiement_deja_ouvert' }
    }

    // Appel externe : hors de toute transaction.
    const reponse = await adaptateur.ouvrir({ passageId, montantCentimes: montant, devise })
    if (!reponse.ok || typeof reponse.referenceExterne !== 'string' || reponse.referenceExterne.trim() === '') return { ok: false, code: 'refuse' }
    const reference = reponse.referenceExterne.trim()

    return await prisma.$transaction(
      async (tx): Promise<ResultatOuverturePaiement> => {
        const lien = await lirePassageDuNavigateur(tx, jeton, maintenant)
        if (!lien || lien.passageId !== passageId) return { ok: false, code: 'introuvable' }
        const verrou = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "PassageEnCaisse" WHERE "id" = ${passageId} FOR UPDATE`
        if (verrou.length === 0) return { ok: false, code: 'introuvable' }
        // Réservation relue sous verrou : une réservation échue entre-temps ne se paie pas.
        const actives = (await reservationsActivesDuPassage(passageId, tx)).filter((r) => !estEchue(r.echeance, maintenant))
        if (actives.length === 0) return { ok: false, code: 'echue' }
        const total = await totalEnAttente(tx, passageId, maintenant)
        if (total === null) return { ok: false, code: 'introuvable' }
        if (total !== montant) return { ok: false, code: 'total_change' }
        const deja = await tx.paiement.findFirst({ where: { passageId, etat: 'ouvert' } })
        if (deja) {
          return deja.source === adaptateur.source && deja.montantCentimes === montant
            ? { ok: true, paiementId: deja.id, montantCentimes: montant, devise, referenceExterne: deja.referenceExterne, reutilise: true }
            : { ok: false, code: 'paiement_deja_ouvert' }
        }
        const paiement = await tx.paiement.create({
          data: { passageId, source: adaptateur.source, referenceExterne: reference, montantCentimes: montant, etat: 'ouvert' },
        })
        return { ok: true, paiementId: paiement.id, montantCentimes: montant, devise, referenceExterne: reference, reutilise: false }
      },
      { maxWait: 5000, timeout: 20000 },
    )
  } catch {
    // Collision de référence ou panne de l'adaptateur : refus sans détail technique (ni jeton, ni e-mail).
    console.error('ouverture_paiement_echec', { passageId })
    return { ok: false, code: 'refuse' }
  }
}
