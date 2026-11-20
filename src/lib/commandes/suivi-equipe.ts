import { prisma } from '@/lib/prisma'
import type { Acteur } from '@/lib/acces'
import type { EtatCommande } from './etats'
import { alertesDeRetard, type AlerteRetard } from './suivi-equipe-regles'

// Commandes payées vues par l'équipe (story 8.3, FR-26, AD-10, AD-15, UJ-3) : lecture seule, admin seulement
// (acteur relu en base, vérifié ici). Aucune donnée personnelle de l'acheteur (ni adresse, ni téléphone, ni
// e-mail, ni nom : l'équipe l'identifie par le numéro de commande) ; aucun montant additionné (le remboursement
// est lu tel qu'enregistré). Les retards sont calculés à la lecture à partir des échéances stockées.

export type EtatCommandeEquipe = Extract<EtatCommande, 'confirmee' | 'prise_en_charge' | 'expediee' | 'annulee'>

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
const LIMITE_ANNULEES = 50

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
    artist: { select: { name: true } },
    lignes: { orderBy: { createdAt: 'asc' as const }, select: { titre: true } },
    remboursement: { select: { etat: true, montantCentimes: true, devise: true } },
  }
  const [aExpedier, expediees, annulees] = await Promise.all([
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
      // Annulée après paiement : un remboursement existe ou l'équipe l'a annulée (jamais une simple attente abandonnée).
      where: { passageId: { not: null }, etat: 'annulee', OR: [{ remboursement: { isNot: null } }, { annuleeLe: { not: null } }] },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: LIMITE_ANNULEES,
      select,
    }),
  ])
  const tronque = aExpedier.length > limiteAExpedier
  const commandes = [...aExpedier.slice(0, limiteAExpedier), ...expediees, ...annulees].map((c): CommandeDeLEquipe => {
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
