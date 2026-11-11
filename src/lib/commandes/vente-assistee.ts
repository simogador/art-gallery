import { prisma } from '@/lib/prisma'
import type { Acteur } from '@/lib/acces'
import {
  emettreJetonCommandeAssistee,
  lienActifDuPassage,
  lirePassageDuLien,
  revoquerJetonCommandeAssistee,
} from '@/lib/acces/commande-assistee'
import { reserverOeuvres, reservationsActivesDuPassage, type ResultatReservation } from '@/lib/disponibilite'
import { estEchue } from '@/lib/disponibilite/reservation-regles'
import { ecrireEvenement, repartirApresValidation } from '@/lib/evenements'
import { DUREE_RESERVATION_VENTE_ASSISTEE_HEURES, LIMITES_RESERVATION_VENTE_ASSISTEE_HEURES } from '@/lib/reglages'
import { creerPassageEnCaisse, type CommandeCreee, type RefusPassage } from './passage'

// Vente assistée (story 6.3, FR-12, FR-26, UJ-4) : l'équipe réserve des œuvres pour un acheteur
// identifié (passage en caisse puis réservation `vente_assistee`, tout ou rien) ; un événement envoie
// son lien par e-mail ; le lien rouvre le récapitulatif de sa commande. Seul l'acteur `admin` pose la
// réservation, vérifié ici à partir de l'acteur relu en base (AD-15). `LOT2_OUVERT` n'a aucun effet
// (AD-17). Jamais d'e-mail ni de lien dans les journaux.

export type SaisieVenteAssistee = {
  email: string
  nom: string
  /** Code ISO du pays de livraison. */
  pays: string
  /** Slugs des œuvres. */
  oeuvres: readonly string[]
  /** Durée de la réservation en heures entières ; défaut `DUREE_RESERVATION_VENTE_ASSISTEE_HEURES`. */
  heures?: number
}

export type RefusVenteAssistee =
  | { ok: false; code: 'acces_refuse' | 'liste_vide' | 'devise_differente' | 'plafond_atteint' | 'invalide' }
  | Extract<RefusPassage, { code: 'coordonnees_invalides' | 'oeuvre_indisponible' | 'non_livree' }>

export type ResultatVenteAssistee =
  | { ok: true; passageId: string; commandes: CommandeCreee[]; echeance: Date; envoye: boolean }
  | RefusVenteAssistee

/** Refus qui annule la transaction entière (rien n'est écrit si une étape suivante refuse). */
class Refus extends Error {
  constructor(readonly refus: RefusVenteAssistee) {
    super('vente_assistee_refusee')
  }
}

/** Durée en heures entières dans les bornes de `reglages`, sinon null. */
export function heuresValides(heures: unknown): number | null {
  const { min, max } = LIMITES_RESERVATION_VENTE_ASSISTEE_HEURES
  return typeof heures === 'number' && Number.isInteger(heures) && heures >= min && heures <= max ? heures : null
}

function refusDeReservation(r: Extract<ResultatReservation, { ok: false }>): RefusVenteAssistee {
  return r.code === 'oeuvre_indisponible' ? { ok: false, code: 'oeuvre_indisponible', slug: r.slug } : { ok: false, code: r.code }
}

/**
 * Pose la vente assistée : en une transaction, passage en caisse (coordonnées e-mail et nom
 * seulement, l'adresse de livraison viendra au paiement) puis réservation `vente_assistee` de toutes
 * les œuvres, ou rien (refus typé de 6.1 ou 6.2, œuvre nommée). Les événements (changement de
 * disponibilité, `VenteAssisteePosee`) sont écrits avec elle et répartis, attendus, avant de répondre :
 * le gestionnaire émet le lien et envoie l'e-mail. `envoye` dit si un lien actif existe ensuite (un
 * échec d'envoi le révoque : la réservation reste posée, l'équipe le voit).
 */
export async function poserVenteAssistee(
  acteur: Acteur,
  saisie: SaisieVenteAssistee,
  maintenant: Date = new Date(),
): Promise<ResultatVenteAssistee> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  const heures = saisie.heures === undefined ? DUREE_RESERVATION_VENTE_ASSISTEE_HEURES : heuresValides(saisie.heures)
  if (heures === null) return { ok: false, code: 'invalide' }
  const echeance = new Date(maintenant.getTime() + heures * 3_600_000)
  const slugs = Array.isArray(saisie.oeuvres) ? saisie.oeuvres.filter((s): s is string => typeof s === 'string') : []

  let evenements: string[] = []
  let pose: { passageId: string; commandes: CommandeCreee[] }
  try {
    pose = await prisma.$transaction(
      async (tx) => {
        const passage = await creerPassageEnCaisse(
          { pays: saisie.pays, oeuvres: slugs, coordonnees: { email: saisie.email, nom: saisie.nom, adresse: '', telephone: '' } },
          {},
          tx,
        )
        if (!passage.ok) throw new Refus(passage)
        const reserve = await reserverOeuvres(
          { passageId: passage.passageId, slugs, origine: 'vente_assistee', echeance, email: saisie.email, maintenant },
          tx,
        )
        if (!reserve.ok) throw new Refus(refusDeReservation(reserve))
        const vente = await ecrireEvenement(tx, { nom: 'VenteAssisteePosee', charge: { passageId: passage.passageId } })
        evenements = [...reserve.evenements, vente]
        return { passageId: passage.passageId, commandes: passage.commandes }
      },
      { maxWait: 5000, timeout: 20000 },
    )
  } catch (erreur) {
    if (erreur instanceof Refus) return erreur.refus
    throw erreur
  }
  // Après la validation, avant de répondre (AD-11) : le gestionnaire envoie l'e-mail.
  await repartirApresValidation(evenements)
  const envoye = await lienActifDuPassage(prisma, pose.passageId)
  return { ok: true, passageId: pose.passageId, commandes: pose.commandes, echeance, envoye }
}

export type LienVenteAssistee = { jeton: string; echeance: Date; email: string; nom: string }

/**
 * Émet le lien d'une vente assistée, à l'envoi de l'e-mail (AD-14) : échéance = celle de la réservation
 * active, adresse et nom lus en base. null si le passage n'a plus de réservation de vente assistée
 * active et non échue (rien à envoyer).
 */
export async function preparerLienVenteAssistee(passageId: string, maintenant: Date = new Date()): Promise<LienVenteAssistee | null> {
  return prisma.$transaction(async (tx) => {
    const coordonnees = await tx.coordonneesAcheteur.findUnique({ where: { passageId }, select: { email: true, nom: true } })
    if (!coordonnees) return null
    const actives = (await reservationsActivesDuPassage(passageId, tx)).filter(
      (r) => r.origine === 'vente_assistee' && !estEchue(r.echeance, maintenant),
    )
    if (actives.length === 0) return null
    const echeance = new Date(Math.min(...actives.map((r) => r.echeance.getTime())))
    const jeton = await emettreJetonCommandeAssistee(tx, passageId, echeance, maintenant)
    return { jeton, echeance, email: coordonnees.email, nom: coordonnees.nom }
  })
}

/** Révoque le lien d'un passage dont l'e-mail n'est pas parti. */
export async function abandonnerLienVenteAssistee(passageId: string, maintenant: Date = new Date()): Promise<void> {
  await prisma.$transaction((tx) => revoquerJetonCommandeAssistee(tx, passageId, maintenant))
}

export type LigneRecapitulatif = {
  slug: string
  titre: string
  prixCentimes: number
  fraisCentimes: number
  totalCentimes: number
  devise: string
  delaiMinJours: number
  delaiMaxJours: number
}
export type CommandeRecapitulatif = { numero: string; devise: string; lignes: LigneRecapitulatif[] }
export type Recapitulatif = { pays: string; devise: string; echeance: Date; commandes: CommandeRecapitulatif[] }

/** Lien encore valable : jeton actif et réservation de vente assistée active et non échue, sinon null. */
export async function lireLienVenteAssistee(jeton: string, maintenant: Date = new Date()): Promise<{ passageId: string; echeance: Date } | null> {
  const lien = await lirePassageDuLien(prisma, jeton, maintenant)
  if (!lien) return null
  const actives = (await reservationsActivesDuPassage(lien.passageId)).filter(
    (r) => r.origine === 'vente_assistee' && !estEchue(r.echeance, maintenant),
  )
  if (actives.length === 0) return null
  return { passageId: lien.passageId, echeance: new Date(Math.min(...actives.map((r) => r.echeance.getTime()))) }
}

/**
 * Récapitulatif de l'acheteur : commandes par artiste, lignes figées à la création du passage (jamais
 * recalculées, aucun total additionné ici) et échéance de la réservation. null si le lien n'est plus actif.
 * Relu en base à chaque appel.
 */
export async function lireRecapitulatifAssiste(jeton: string, maintenant: Date = new Date()): Promise<Recapitulatif | null> {
  const lien = await lireLienVenteAssistee(jeton, maintenant)
  if (!lien) return null
  const passage = await prisma.passageEnCaisse.findUnique({
    where: { id: lien.passageId },
    select: {
      paysLivraison: true,
      devise: true,
      commandes: {
        orderBy: { createdAt: 'asc' },
        select: {
          numero: true,
          devise: true,
          lignes: {
            orderBy: { createdAt: 'asc' },
            select: {
              slug: true, titre: true, prixCentimes: true, fraisCentimes: true, totalCentimes: true, devise: true,
              delaiMinJours: true, delaiMaxJours: true,
            },
          },
        },
      },
    },
  })
  if (!passage) return null
  return { pays: passage.paysLivraison, devise: passage.devise, echeance: lien.echeance, commandes: passage.commandes }
}
