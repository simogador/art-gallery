import { prisma } from '@/lib/prisma'
import type { Acteur } from '@/lib/acces'
import type { EtatCommande } from './etats'
import { assuranceRequise } from './expedition-regles'
import type { SourceLivraison } from './livraison-regles'
import type { EtatReclamation, MotifReclamation } from './reclamation-regles'
import { SEUIL_ASSURANCE } from '@/lib/reglages'
import { alertesDeRetard, type AlerteRetard } from './suivi-equipe-regles'

// Commandes payées vues par l'équipe (story 8.3, FR-26, AD-10, AD-15, UJ-3) : lecture seule, admin seulement
// (acteur relu en base, vérifié ici). Aucune donnée personnelle de l'acheteur (ni adresse, ni téléphone, ni
// e-mail, ni nom : l'équipe l'identifie par le numéro de commande) ; aucun montant additionné (le remboursement
// est lu tel qu'enregistré). Les retards sont calculés à la lecture à partir des échéances stockées.

export type EtatCommandeEquipe = Extract<EtatCommande, 'confirmee' | 'prise_en_charge' | 'expediee' | 'livree' | 'retournee' | 'annulee'>

export type CommandeDeLEquipe = {
  id: string
  numero: string
  etat: EtatCommandeEquipe
  artiste: string | null
  oeuvres: string[]
  priseEnChargeAvant: Date | null
  priseEnChargeLe: Date | null
  expedieAvant: Date | null
  expedieeLe: Date | null
  transporteur: string | null
  numeroSuivi: string | null
  envoiAssure: boolean
  referenceAssurance: string | null
  remboursement: { etat: 'demande' | 'effectue'; montantCentimes: number; devise: string } | null
  annulation: { le: Date | null; motif: string | null } | null
  alertes: AlerteRetard[]
  /** Annulable par l'équipe : `confirmee` ou `prise_en_charge`. */
  annulable: boolean
  /** Livraison constatée (story 8.4) : date, source, preuve saisie par l'équipe et fin du délai de retour ; null avant. */
  livraison: { le: Date | null; source: SourceLivraison | null; preuve: string | null; retourAvant: Date | null } | null
  /** `expediee` : l'équipe peut enregistrer la livraison (« Enregistrer la livraison »). */
  livrable: boolean
  /** `expediee` : le prix des œuvres dépasse le seuil d'assurance, la preuve de livraison est obligatoire. */
  preuveRequise: boolean
  /**
   * Réclamation de l'acheteur (story 8.5) : motif, description et photos, lus de l'équipe seulement (jamais de
   * l'artiste ni d'un journal) ; décision et motif de refus. null sans réclamation.
   */
  reclamation: { motif: MotifReclamation; description: string; etat: EtatReclamation; motifRefus: string | null; decideLe: Date | null; photos: string[] } | null
  /** `livree` avec une réclamation acceptée : « Retour reçu » proposé. */
  retournable: boolean
  /** Réception du retour (`retournee`) ; null avant. */
  retourRecuLe: Date | null
  /** Montant de la commande (agrégat de la base des lignes figées), seulement pour une commande `retournable` ; borne du remboursement. */
  allocationCentimes: number | null
  devise: string
}

export type CommandesDeLEquipe = {
  commandes: CommandeDeLEquipe[]
  /** Numéros en retard, par alerte (calculés à la lecture). */
  alertes: { priseEnCharge: string[]; expedition: string[] }
  /** La liste des commandes à expédier a atteint son plafond : les plus récentes ne sont pas affichées. */
  tronque: boolean
}

/** Plafond des commandes à expédier (`confirmee`, `prise_en_charge`), les plus anciennes d'abord. */
export const LIMITE_A_EXPEDIER = 300
const LIMITE_EXPEDIEES = 50
const LIMITE_LIVREES = 50
const LIMITE_ANNULEES = 50
const LIMITE_RETOURNEES = 50
const LIMITE_RECLAMATIONS = 200

/**
 * Commandes payées : `confirmee`, `prise_en_charge`, `expediee` (les plus anciennes en tête) puis les dernières
 * `annulee` ayant été payées ou annulées par l'équipe. Non admin : null. Une erreur de lecture est levée à l'appelant.
 */
export async function commandesDeLEquipe(acteur: Acteur, maintenant: Date = new Date(), limiteAExpedier: number = LIMITE_A_EXPEDIER): Promise<CommandesDeLEquipe | null> {
  if (acteur.type !== 'admin') return null
  const select = {
    id: true,
    numero: true,
    etat: true,
    priseEnChargeAvant: true,
    priseEnChargeLe: true,
    expedieAvant: true,
    expedieeLe: true,
    transporteur: true,
    numeroSuivi: true,
    envoiAssure: true,
    referenceAssurance: true,
    annuleeLe: true,
    motifAnnulation: true,
    devise: true,
    livreeLe: true,
    livraisonSource: true,
    preuveLivraison: true,
    retourAvant: true,
    retourRecuLe: true,
    reclamation: {
      select: {
        motif: true,
        description: true,
        etat: true,
        motifRefus: true,
        decideLe: true,
        photos: { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }], select: { url: true } },
      },
    },
    artist: { select: { name: true } },
    lignes: { orderBy: { createdAt: 'asc' as const }, select: { titre: true } },
    remboursement: { select: { etat: true, montantCentimes: true, devise: true } },
  }
  const [aExpedier, expediees, livrees, aTraiter, retournees, annulees] = await Promise.all([
    // À expédier : alertes calculées sur celles-ci ; les expédiées (qui s'accumulent jusqu'à la 8.4) ne les évincent pas.
    prisma.commande.findMany({
      where: { passageId: { not: null }, etat: { in: ['confirmee', 'prise_en_charge'] } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limiteAExpedier + 1,
      select,
    }),
    prisma.commande.findMany({
      where: { passageId: { not: null }, etat: 'expediee' },
      orderBy: [{ expedieeLe: 'desc' }, { id: 'desc' }],
      take: LIMITE_EXPEDIEES,
      select,
    }),
    prisma.commande.findMany({
      where: { passageId: { not: null }, etat: 'livree' },
      orderBy: [{ livreeLe: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      take: LIMITE_LIVREES,
      select,
    }),
    // Réclamations à traiter (ouvertes, ou acceptées dont le retour n'est pas encore reçu) : jamais évincées par la limite des livrées.
    prisma.commande.findMany({
      where: { passageId: { not: null }, etat: 'livree', reclamation: { is: { etat: { in: ['ouverte', 'acceptee'] } } } },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: LIMITE_RECLAMATIONS,
      select,
    }),
    prisma.commande.findMany({
      where: { passageId: { not: null }, etat: 'retournee' },
      orderBy: [{ retourRecuLe: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      take: LIMITE_RETOURNEES,
      select,
    }),
    prisma.commande.findMany({
      // Annulée après paiement : un remboursement existe ou l'équipe l'a annulée (jamais une simple attente abandonnée).
      where: { passageId: { not: null }, etat: 'annulee', OR: [{ remboursement: { isNot: null } }, { annuleeLe: { not: null } }] },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: LIMITE_ANNULEES,
      select,
    }),
  ])
  const tronque = aExpedier.length > limiteAExpedier
  // Prix des œuvres des commandes expédiées, par agrégat de la base (seuil d'assurance de la 8.2) : jamais additionné ici.
  const prixExpediees = await prisma.ligneCommande.groupBy({
    by: ['commandeId'],
    where: { commandeId: { in: expediees.map((c) => c.id) } },
    _sum: { prixCentimes: true },
  })
  // Les réclamations à traiter d'abord ; une livrée déjà lue plus haut n'est pas répétée.
  const dejaLues = new Set(aTraiter.map((c) => c.id))
  const toutes = [...aExpedier.slice(0, limiteAExpedier), ...expediees, ...aTraiter, ...livrees.filter((c) => !dejaLues.has(c.id)), ...retournees, ...annulees]
  // Montant de la commande (agrégat de la base) pour borner le remboursement d'un retour : jamais additionné ici.
  const retournables = toutes.filter((c) => c.etat === 'livree' && c.reclamation?.etat === 'acceptee')
  const allocations = await prisma.ligneCommande.groupBy({
    by: ['commandeId'],
    where: { commandeId: { in: retournables.map((c) => c.id) } },
    _sum: { totalCentimes: true },
  })
  const commandes = toutes.map((c): CommandeDeLEquipe => {
    const etat = c.etat as EtatCommandeEquipe
    return {
      id: c.id,
      numero: c.numero,
      etat,
      artiste: c.artist?.name ?? null,
      oeuvres: c.lignes.map((l) => l.titre),
      priseEnChargeAvant: c.priseEnChargeAvant,
      priseEnChargeLe: c.priseEnChargeLe,
      expedieAvant: c.expedieAvant,
      expedieeLe: c.expedieeLe,
      transporteur: c.transporteur,
      numeroSuivi: c.numeroSuivi,
      envoiAssure: c.envoiAssure,
      referenceAssurance: c.referenceAssurance,
      remboursement: c.remboursement ? { etat: c.remboursement.etat === 'effectue' ? 'effectue' : 'demande', montantCentimes: c.remboursement.montantCentimes, devise: c.remboursement.devise } : null,
      annulation: etat === 'annulee' ? { le: c.annuleeLe, motif: c.motifAnnulation } : null,
      alertes: alertesDeRetard({ etat, priseEnChargeAvant: c.priseEnChargeAvant, expedieAvant: c.expedieAvant }, maintenant),
      annulable: etat === 'confirmee' || etat === 'prise_en_charge',
      livraison:
        etat === 'livree' || etat === 'retournee'
          ? { le: c.livreeLe, source: (c.livraisonSource as SourceLivraison | null) ?? null, preuve: c.preuveLivraison, retourAvant: c.retourAvant }
          : null,
      livrable: etat === 'expediee',
      reclamation: c.reclamation
        ? {
            motif: c.reclamation.motif,
            description: c.reclamation.description,
            etat: c.reclamation.etat,
            motifRefus: c.reclamation.motifRefus,
            decideLe: c.reclamation.decideLe,
            photos: c.reclamation.photos.map((p) => p.url),
          }
        : null,
      retournable: etat === 'livree' && c.reclamation?.etat === 'acceptee',
      retourRecuLe: c.retourRecuLe,
      allocationCentimes: etat === 'livree' && c.reclamation?.etat === 'acceptee' ? (allocations.find((g) => g.commandeId === c.id)?._sum.totalCentimes ?? 0) : null,
      devise: c.devise,
      preuveRequise: etat === 'expediee' && assuranceRequise(prixExpediees.find((g) => g.commandeId === c.id)?._sum.prixCentimes, c.devise, SEUIL_ASSURANCE),
    }
  })
  return {
    commandes,
    alertes: {
      priseEnCharge: commandes.filter((c) => c.alertes.includes('prise_en_charge_en_retard')).map((c) => c.numero),
      expedition: commandes.filter((c) => c.alertes.includes('expedition_en_retard')).map((c) => c.numero),
    },
    tronque,
  }
}
