import { prisma } from '@/lib/prisma'
import type { EtatCommande } from './etats'

// Lecture des données des e-mails de commande (FR-34, FR-25, FR-31) : numéro, lignes figées, adresse de
// l'acheteur, artiste et état du remboursement, relus en base au moment de l'envoi (les événements ne
// portent que des ids). Aucune écriture, aucun montant additionné (les lignes portent leur total figé).
// Une commande sans passage (historique) ou sans coordonnées n'a personne à prévenir : null.

export type LigneCourriel = {
  titre: string
  totalCentimes: number
  devise: string
  delaiMinJours: number
  delaiMaxJours: number
}

export type DonneesCourrielCommande = {
  numero: string
  etat: EtatCommande
  lignes: LigneCourriel[]
  acheteur: { email: string; nom: string }
  artiste: { nom: string; email: string | null } | null
  /** État du remboursement demandé, absent si aucun (annulation sans paiement reçu). */
  remboursement: 'demande' | 'effectue' | null
  /** Échéance de prise en charge par l'artiste (story 8.1), posée à la confirmation ; null avant. */
  priseEnChargeAvant: Date | null
  /** Code ISO du pays de livraison du passage. */
  pays: string | null
}

export async function lireDonneesCourrielCommande(commandeId: string): Promise<DonneesCourrielCommande | null> {
  const commande = await prisma.commande.findUnique({
    where: { id: commandeId },
    select: {
      numero: true,
      etat: true,
      passageId: true,
      priseEnChargeAvant: true,
      passage: { select: { paysLivraison: true, coordonnees: { select: { email: true, nom: true } } } },
      artist: { select: { name: true, user: { select: { email: true } } } },
      remboursement: { select: { etat: true } },
      lignes: {
        orderBy: { createdAt: 'asc' },
        select: { titre: true, totalCentimes: true, devise: true, delaiMinJours: true, delaiMaxJours: true },
      },
    },
  })
  const coordonnees = commande?.passage?.coordonnees
  if (!commande || !commande.passageId || !coordonnees?.email) return null
  return {
    numero: commande.numero,
    etat: commande.etat as EtatCommande,
    lignes: commande.lignes,
    acheteur: { email: coordonnees.email, nom: coordonnees.nom },
    artiste: commande.artist ? { nom: commande.artist.name, email: commande.artist.user?.email ?? null } : null,
    remboursement: commande.remboursement ? (commande.remboursement.etat === 'effectue' ? 'effectue' : 'demande') : null,
    priseEnChargeAvant: commande.priseEnChargeAvant,
    pays: commande.passage?.paysLivraison ?? null,
  }
}

/** Numéro seul, pour l'alerte de l'équipe (aucune donnée de l'acheteur) ; null pour une commande historique. */
export async function lireNumeroCommandeAvecPassage(commandeId: string): Promise<{ numero: string; etat: EtatCommande } | null> {
  const commande = await prisma.commande.findUnique({ where: { id: commandeId }, select: { numero: true, etat: true, passageId: true } })
  if (!commande || !commande.passageId) return null
  return { numero: commande.numero, etat: commande.etat as EtatCommande }
}
