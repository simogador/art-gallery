import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'

// Lecture des commandes d'un passage (stories 6.3 et 7.3) : lignes figées à la création du passage,
// jamais recalculées, aucun total additionné ici. Seule lecture partagée par la page de la vente
// assistée (`/commande`) et par celle de l'acheteur sans compte (`/commande/coordonnees`).

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
export type Recapitulatif = {
  pays: string
  devise: string
  echeance: Date
  commandes: CommandeRecapitulatif[]
  /** Story 7.3 : l'adresse de livraison est déjà enregistrée sur le passage. */
  adresseRenseignee: boolean
}

export type PassageLu = {
  pays: string
  devise: string
  adresseRenseignee: boolean
  commandes: (CommandeRecapitulatif & { etat: string; abandonneLe: Date | null })[]
}

/** Commandes non annulées du passage (une annulée n'est jamais proposée au paiement), ou null si le passage n'existe pas. */
export async function lireCommandesDuPassage(passageId: string, tx: Prisma.TransactionClient = prisma): Promise<PassageLu | null> {
  const passage = await tx.passageEnCaisse.findUnique({
    where: { id: passageId },
    select: {
      paysLivraison: true,
      devise: true,
      coordonnees: { select: { adresse: true } },
      commandes: {
        where: { etat: { not: 'annulee' } },
        orderBy: { createdAt: 'asc' },
        select: {
          numero: true,
          devise: true,
          etat: true,
          abandonneLe: true,
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
  return {
    pays: passage.paysLivraison,
    devise: passage.devise,
    adresseRenseignee: (passage.coordonnees?.adresse ?? '').trim() !== '',
    commandes: passage.commandes,
  }
}
