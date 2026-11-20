import { prisma } from '@/lib/prisma'
import { lirePassageDuNavigateur } from '@/lib/acces/commande-publique'
import { reservationsActivesDuPassage } from '@/lib/disponibilite'
import { estEchue } from '@/lib/disponibilite/reservation-regles'
import type { LigneRecapitulatif } from './recapitulatif'

// Confirmation de commande de l'acheteur sans compte (story 7.6, FR-13, UJ-1). Lecture seule : le passage
// est retrouvé par le jeton `commande_publique` du cookie (lisible jusqu'à une durée d'abandon après son
// échéance), jamais par un identifiant du navigateur ; rien n'est écrit et aucun prestataire n'est
// interrogé : l'état d'une commande est celui de la base (`confirmee` après le constat de paiement, 6.4).
// Prix, frais, total et délai d'une commande sont des AGRÉGATS de la base sur les lignes figées, jamais une
// addition dans le code. Jamais d'e-mail ni d'adresse dans les journaux ; le nom est rendu tel que saisi.

export type EtatCommandeConfirmation = 'confirmee' | 'en_attente_paiement' | 'annulee'
export type EtatConfirmation = 'confirmee' | 'en_attente' | 'annulee' | 'mixte'

export type CommandeConfirmation = {
  numero: string
  etat: EtatCommandeConfirmation
  artiste: string
  devise: string
  lignes: LigneRecapitulatif[]
  prixCentimes: number
  fraisCentimes: number
  totalCentimes: number
  delaiMinJours: number
  delaiMaxJours: number
}

export type Confirmation = {
  /** Nom de l'acheteur tel que saisi (champ unique), jamais son e-mail. */
  nom: string
  etat: EtatConfirmation
  commandes: CommandeConfirmation[]
  /** Échéance de la réservation (celle du jeton si plus aucune n'est active). */
  echeance: Date
  /** Une commande attend son paiement mais aucune réservation n'est plus active : « a pris fin ». */
  reservationEchue: boolean
}

/** État d'ensemble : un seul état commun, sinon `mixte`. Liste vide : `en_attente` (jamais rendue). */
export function etatGlobal(etats: readonly EtatCommandeConfirmation[]): EtatConfirmation {
  const distincts = new Set(etats)
  if (distincts.size > 1) return 'mixte'
  const [seul] = Array.from(distincts)
  if (seul === 'confirmee') return 'confirmee'
  if (seul === 'annulee') return 'annulee'
  return 'en_attente'
}

/**
 * Commandes du passage de l'acheteur, quel que soit leur état (confirmée, en attente, annulée), ou null :
 * jeton absent, mal formé, inconnu, révoqué ou trop ancien, passage introuvable ou sans commande de ce parcours
 * (une commande `historique`, recopiée d'une ancienne commande, n'en fait pas partie). Lecture cohérente
 * dans une seule transaction ; une commande sans ligne lève `confirmation_incoherente` (état de panne de la
 * page, jamais « aucune commande »).
 */
export async function lireConfirmationPassage(jeton: string | undefined, maintenant: Date = new Date()): Promise<Confirmation | null> {
  const lien = await lirePassageDuNavigateur(prisma, jeton, maintenant)
  if (!lien) return null
  const { passage, parCommande } = await prisma.$transaction(async (tx) => {
    const passage = await tx.passageEnCaisse.findUnique({
      where: { id: lien.passageId },
      select: {
        coordonnees: { select: { nom: true } },
        commandes: {
          // Story 8.1 : une commande prise en charge par l'artiste reste une commande confirmée pour l'acheteur.
          where: { etat: { in: ['confirmee', 'prise_en_charge', 'expediee', 'en_attente_paiement', 'annulee'] } },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            numero: true,
            etat: true,
            devise: true,
            artist: { select: { name: true } },
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
    const ids = passage?.commandes.map((c) => c.id) ?? []
    const parCommande = await tx.ligneCommande.groupBy({
      by: ['commandeId'],
      where: { commandeId: { in: ids } },
      _sum: { prixCentimes: true, fraisCentimes: true, totalCentimes: true },
      _max: { delaiMinJours: true, delaiMaxJours: true },
    })
    return { passage, parCommande }
  })
  if (!passage || passage.commandes.length === 0) return null

  const commandes: CommandeConfirmation[] = passage.commandes.map((c) => {
    const agregat = parCommande.find((g) => g.commandeId === c.id)
    if (!agregat || c.lignes.length === 0) throw new Error('confirmation_incoherente')
    return {
      numero: c.numero,
      etat: (c.etat === 'prise_en_charge' || c.etat === 'expediee' ? 'confirmee' : c.etat) as EtatCommandeConfirmation,
      artiste: c.artist?.name ?? '',
      devise: c.devise,
      lignes: c.lignes,
      prixCentimes: agregat._sum.prixCentimes ?? 0,
      fraisCentimes: agregat._sum.fraisCentimes ?? 0,
      totalCentimes: agregat._sum.totalCentimes ?? 0,
      delaiMinJours: agregat._max.delaiMinJours ?? 0,
      delaiMaxJours: agregat._max.delaiMaxJours ?? 0,
    }
  })
  const enAttente = commandes.some((c) => c.etat === 'en_attente_paiement')
  const actives = (await reservationsActivesDuPassage(lien.passageId)).filter((r) => !estEchue(r.echeance, maintenant))
  const echeance = actives.length > 0 ? new Date(Math.min(...actives.map((r) => r.echeance.getTime()))) : lien.echeance
  return {
    nom: passage.coordonnees?.nom ?? '',
    etat: etatGlobal(commandes.map((c) => c.etat)),
    commandes,
    echeance,
    reservationEchue: enAttente && actives.length === 0,
  }
}
