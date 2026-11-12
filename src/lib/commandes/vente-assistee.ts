import { prisma } from '@/lib/prisma'
import type { Acteur } from '@/lib/acces'
import {
  emettreJetonCommandeAssistee,
  lienActifDuPassage,
  lirePassageDuLien,
  revoquerJetonCommandeAssistee,
} from '@/lib/acces/commande-assistee'
import {
  libererReservation,
  reserverOeuvres,
  reservationsActivesDuPassage,
  reservationsPourAdmin,
  type ReservationLue,
  type ResultatReservation,
} from '@/lib/disponibilite'
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

// ── Story 6.3 bis : voir, libérer et renvoyer (FR-12, FR-26) ─────────────────────────────────

export type ResultatLiberationAssistee =
  | { ok: true; liberees: number }
  | { ok: false; code: 'acces_refuse' | 'invalide' }

/**
 * Libère la vente assistée d'un passage : les œuvres encore réservées redeviennent disponibles (une œuvre
 * vendue ailleurs ou retirée entre-temps n'est jamais écrasée), l'issue `liberee` porte l'auteur et la
 * date, le lien est révoqué, dans une seule transaction ; événements répartis après. Admin seulement
 * (acteur relu en base). Idempotent : rejouée, succès sans effet. Une réservation d'une autre origine
 * (paiement) n'est pas libérée ici (`invalide`). La commande reste `en_attente_paiement` (story 6.5).
 */
export async function libererVenteAssistee(
  acteur: Acteur,
  passageId: string,
  maintenant: Date = new Date(),
): Promise<ResultatLiberationAssistee> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  if (typeof passageId !== 'string' || passageId === '') return { ok: false, code: 'invalide' }
  const resultat = await prisma.$transaction(
    async (tx): Promise<{ ok: true; liberees: number; evenements: string[] } | { ok: false; code: 'invalide' }> => {
      const passage = await tx.passageEnCaisse.findUnique({ where: { id: passageId }, select: { id: true } })
      if (!passage) return { ok: false, code: 'invalide' }
      const actives = await reservationsActivesDuPassage(passageId, tx)
      if (actives.some((r) => r.origine !== 'vente_assistee')) return { ok: false, code: 'invalide' }
      const liberation = await libererReservation(passageId, { issue: 'liberee', par: acteur.userId, maintenant }, tx)
      await revoquerJetonCommandeAssistee(tx, passageId, maintenant)
      return { ok: true, liberees: liberation.liberees, evenements: liberation.evenements }
    },
    { maxWait: 5000, timeout: 20000 },
  )
  if (!resultat.ok) return resultat
  await repartirApresValidation(resultat.evenements)
  return { ok: true, liberees: resultat.liberees }
}

export type ResultatRenvoi =
  | { ok: true; envoye: boolean }
  | { ok: false; code: 'acces_refuse' | 'reservation_terminee' | 'lien_actif' }

/**
 * Renvoie le lien d'une vente assistée dont l'e-mail n'est pas parti : même adresse (lue en base), même
 * échéance (celle de la réservation). Seulement pour une réservation de vente assistée active, non
 * échue, sans lien actif. Réutilise l'événement `VenteAssisteePosee` : son gestionnaire émet le jeton
 * et envoie ; un échec d'envoi révoque le jeton (`envoye` faux). Admin seulement.
 */
export async function renvoyerLienVenteAssistee(
  acteur: Acteur,
  passageId: string,
  maintenant: Date = new Date(),
): Promise<ResultatRenvoi> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  if (typeof passageId !== 'string' || passageId === '') return { ok: false, code: 'reservation_terminee' }
  const resultat = await prisma.$transaction(async (tx) => {
    const actives = (await reservationsActivesDuPassage(passageId, tx)).filter(
      (r) => r.origine === 'vente_assistee' && !estEchue(r.echeance, maintenant),
    )
    if (actives.length === 0) return { ok: false as const, code: 'reservation_terminee' as const }
    if (await lienActifDuPassage(tx, passageId, maintenant)) return { ok: false as const, code: 'lien_actif' as const }
    const evenement = await ecrireEvenement(tx, { nom: 'VenteAssisteePosee', charge: { passageId } })
    return { ok: true as const, evenement }
  })
  if (!resultat.ok) return resultat
  await repartirApresValidation([resultat.evenement])
  return { ok: true, envoye: await lienActifDuPassage(prisma, passageId) }
}

export type VenteDeLEquipe = {
  passageId: string
  beneficiaire: { nom: string; email: string } | null
  origine: ReservationLue['origine']
  echeance: Date
  echue: boolean
  /** Un lien actif existe : l'e-mail est parti. */
  lienActif: boolean
  /** Vrai seulement pour une vente assistée : libérer et renvoyer ne valent pas pour les autres origines. */
  liberable: boolean
  oeuvres: { slug: string; titre: string }[]
}
export type JournalDeLEquipe = {
  passageId: string
  slug: string
  titre: string
  beneficiaire: { nom: string; email: string } | null
  origine: ReservationLue['origine']
  issue: NonNullable<ReservationLue['issue']>
  issueLe: Date | null
  /** Nom (ou e-mail) de l'administrateur qui a libéré ; null si l'issue est automatique ou l'utilisateur inconnu. */
  par: string | null
}

/**
 * Vue de l'équipe : réservations en cours regroupées par passage (œuvres, bénéficiaire, origine,
 * échéance, lien actif ou non) et journal des 50 dernières terminées (issue, auteur, date). Admin
 * seulement ; null sinon. Bénéficiaire lu sur `CoordonneesAcheteur` (jamais journalisé).
 */
export async function reservationsDeLEquipe(
  acteur: Acteur,
  maintenant: Date = new Date(),
): Promise<{ enCours: VenteDeLEquipe[]; terminees: JournalDeLEquipe[] } | null> {
  if (acteur.type !== 'admin') return null
  const lues = await reservationsPourAdmin(acteur)
  if (!lues) return null
  const passages = [...new Set([...lues.enCours, ...lues.terminees].map((r) => r.passageId))]
  const auteurs = [...new Set(lues.terminees.map((r) => r.issuePar).filter((p): p is string => p !== null))]
  const [coordonnees, liens, utilisateurs] = await Promise.all([
    prisma.coordonneesAcheteur.findMany({ where: { passageId: { in: passages } }, select: { passageId: true, nom: true, email: true } }),
    prisma.jeton.findMany({
      where: {
        usage: 'commande_assistee', cible: { in: lues.enCours.map((r) => r.passageId) },
        consommeLe: null, revoqueLe: null, echeance: { gt: maintenant },
      },
      select: { cible: true },
    }),
    prisma.user.findMany({ where: { id: { in: auteurs } }, select: { id: true, name: true, email: true } }),
  ])
  const beneficiaire = new Map(coordonnees.map((c) => [c.passageId, { nom: c.nom, email: c.email }]))
  const avecLien = new Set(liens.map((l) => l.cible))
  const nomDe = new Map(utilisateurs.map((u) => [u.id, u.name?.trim() || u.email]))

  const parPassage = new Map<string, VenteDeLEquipe>()
  for (const r of lues.enCours) {
    const existant = parPassage.get(r.passageId)
    if (existant) {
      existant.oeuvres.push({ slug: r.slug, titre: r.titre })
      if (r.echeance.getTime() < existant.echeance.getTime()) existant.echeance = r.echeance
      continue
    }
    parPassage.set(r.passageId, {
      passageId: r.passageId,
      beneficiaire: beneficiaire.get(r.passageId) ?? null,
      origine: r.origine,
      echeance: r.echeance,
      echue: false,
      lienActif: avecLien.has(r.passageId),
      liberable: r.origine === 'vente_assistee',
      oeuvres: [{ slug: r.slug, titre: r.titre }],
    })
  }
  const enCours = [...parPassage.values()].map((v) => ({ ...v, echue: estEchue(v.echeance, maintenant) }))
  const terminees = lues.terminees.map((r): JournalDeLEquipe => ({
    passageId: r.passageId,
    slug: r.slug,
    titre: r.titre,
    beneficiaire: beneficiaire.get(r.passageId) ?? null,
    origine: r.origine,
    issue: r.issue!,
    issueLe: r.issueLe,
    par: r.issuePar ? (nomDe.get(r.issuePar) ?? null) : null,
  }))
  return { enCours, terminees }
}
