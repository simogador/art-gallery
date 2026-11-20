import { prisma } from '@/lib/prisma'
import { lirePassageDuNavigateur } from '@/lib/acces/commande-publique'
import { emettreJetonSuivi, lirePassageDuSuivi, nombreLiensSuiviActifs, revoquerJetonSuivi } from '@/lib/acces/suivi'
import { PLAFOND_LIENS_SUIVI } from '@/lib/reglages'
import { construireFrise, type EtapeSuivi, type EtatCommandeSuivi } from './suivi-regles'

// Suivi des commandes d'un acheteur sans compte (FR-15, AD-14, story 7.7). Lecture seule, sauf l'émission et
// la révocation de jetons (par `acces`) : le passage est retrouvé par le jeton `suivi` (cookie `httpOnly`
// après l'échange `/suivi/[jeton]`), jamais par un identifiant du navigateur. Étapes faites : dates réelles
// lues en base (création de la commande, constat du paiement) ; date de livraison PRÉVUE : délai figé sur
// les lignes (agrégat de la base, plus long minimum et maximum) appliqué à la date du constat. Aucun montant
// n'est lu ni additionné ici. Jamais d'adresse, de téléphone, d'e-mail ni de coordonnées d'artiste dans le
// résultat ; jamais d'e-mail ni de lien dans les journaux (ids seulement).

export type CommandeSuivie = {
  numero: string
  etat: EtatCommandeSuivi
  artiste: string
  /** Titres figés des œuvres de la commande. */
  oeuvres: string[]
  delaiMinJours: number
  delaiMaxJours: number
  etapes: EtapeSuivi[]
}

export type Suivi = {
  /** Toutes les commandes du passage sont annulées : la page dit « close ». */
  fermee: boolean
  /** Vide quand le suivi est fermé : une page close ne montre rien de plus. */
  commandes: CommandeSuivie[]
}

/**
 * Commandes du passage visé par le jeton de suivi, ou null : jeton absent, mal formé, inconnu, révoqué ou
 * périmé, passage introuvable ou sans commande de ce parcours (une `historique` n'a pas de passage).
 * Fermé (toutes annulées) : `fermee` vrai et aucune commande rendue. Lecture cohérente dans une seule
 * transaction ; une commande sans ligne lève `suivi_incoherent` (état de panne de la page).
 */
export async function lireSuiviPassage(jeton: string | undefined, maintenant: Date = new Date()): Promise<Suivi | null> {
  const lien = await lirePassageDuSuivi(prisma, jeton, maintenant)
  if (!lien) return null
  const { passage, paiement, parCommande } = await prisma.$transaction(async (tx) => {
    const passage = await tx.passageEnCaisse.findUnique({
      where: { id: lien.passageId },
      select: {
        commandes: {
          where: { etat: { in: ['confirmee', 'prise_en_charge', 'expediee', 'en_attente_paiement', 'annulee'] } },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            numero: true,
            etat: true,
            createdAt: true,
            priseEnChargeLe: true,
            expedieeLe: true,
            transporteur: true,
            numeroSuivi: true,
            artist: { select: { name: true } },
            lignes: { orderBy: { createdAt: 'asc' }, select: { titre: true } },
          },
        },
      },
    })
    const paiement = await tx.paiement.findFirst({
      where: { passageId: lien.passageId, etat: 'constate', constateLe: { not: null } },
      orderBy: { constateLe: 'desc' },
      select: { constateLe: true },
    })
    const parCommande = await tx.ligneCommande.groupBy({
      by: ['commandeId'],
      where: { commandeId: { in: passage?.commandes.map((c) => c.id) ?? [] } },
      _max: { delaiMinJours: true, delaiMaxJours: true },
    })
    return { passage, paiement, parCommande }
  })
  if (!passage || passage.commandes.length === 0) return null
  if (passage.commandes.every((c) => c.etat === 'annulee')) return { fermee: true, commandes: [] }

  const commandes: CommandeSuivie[] = passage.commandes.map((c) => {
    const agregat = parCommande.find((g) => g.commandeId === c.id)
    if (!agregat || c.lignes.length === 0) throw new Error('suivi_incoherent')
    const etat = c.etat as EtatCommandeSuivi
    const delaiMinJours = agregat._max.delaiMinJours ?? 0
    const delaiMaxJours = agregat._max.delaiMaxJours ?? 0
    return {
      numero: c.numero,
      etat,
      artiste: c.artist?.name ?? '',
      oeuvres: c.lignes.map((l) => l.titre),
      delaiMinJours,
      delaiMaxJours,
      etapes: construireFrise({
        etat, creeeLe: c.createdAt, constateLe: paiement?.constateLe ?? null, delaiMinJours, delaiMaxJours, priseEnChargeLe: c.priseEnChargeLe,
        expedieeLe: c.expedieeLe, transporteur: c.transporteur, numeroSuivi: c.numeroSuivi,
      }),
    }
  })
  return { fermee: false, commandes }
}

/** Échange du lien : jeton lisible (non consommé) et date d'échéance, sinon null. N'écrit rien. */
export async function lireLienSuivi(jeton: string | undefined, maintenant: Date = new Date()): Promise<{ echeance: Date } | null> {
  const lien = await lirePassageDuSuivi(prisma, jeton, maintenant)
  return lien ? { echeance: lien.echeance } : null
}

/**
 * Émet un lien de suivi pour le passage d'une commande, au moment d'un envoi d'e-mail à l'acheteur. null si la
 * commande n'a pas de passage (commande historique, introuvable) : pas de lien. Valeur en clair à transmettre
 * une seule fois ; les liens précédents du passage restent valables. Jamais refusée pour cause de plafond (seul
 * `ouvrirSuiviDuNavigateur` est borné). `exigerCommandeVivante` (e-mail d'annulation) : si le passage
 * n'a plus aucune commande confirmée ni en attente, le lien n'ouvrirait que la page « close » : aucun jeton
 * n'est émis (null).
 */
export async function emettreLienSuiviDeCommande(
  commandeId: string,
  options: { exigerCommandeVivante?: boolean } = {},
  maintenant: Date = new Date(),
): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const commande = await tx.commande.findUnique({ where: { id: commandeId }, select: { passageId: true } })
    if (!commande?.passageId) return null
    if (options.exigerCommandeVivante) {
      const vivantes = await tx.commande.count({ where: { passageId: commande.passageId, etat: { in: ['confirmee', 'prise_en_charge', 'expediee', 'en_attente_paiement'] } } })
      if (vivantes === 0) return null
    }
    return (await emettreJetonSuivi(tx, commande.passageId, maintenant)).jeton
  })
}

/**
 * Lien de suivi pour l'acheteur dont le navigateur porte un jeton `commande_publique` valide (bouton de
 * `/confirmation`). Le passage vient du jeton du navigateur, jamais d'un identifiant fourni par le client.
 * Réutilise le lien `suivi` déjà porté par le navigateur s'il vise le même passage (pas de jeton en plus à
 * chaque appui) ; sinon en émet un, dans la limite de `PLAFOND_LIENS_SUIVI` liens actifs (`trop_de_liens`). null : jeton du navigateur absent ou invalide, ou passage sans commande.
 */
export async function ouvrirSuiviDuNavigateur(
  jetonPassage: string | undefined,
  jetonSuiviExistant: string | undefined,
  maintenant: Date = new Date(),
): Promise<{ jeton: string; echeance: Date; reutilise: boolean } | { refus: 'trop_de_liens' } | null> {
  return prisma.$transaction(async (tx) => {
    const lien = await lirePassageDuNavigateur(tx, jetonPassage, maintenant)
    if (!lien) return null
    const nombre = await tx.commande.count({ where: { passageId: lien.passageId, etat: { in: ['confirmee', 'prise_en_charge', 'expediee', 'en_attente_paiement', 'annulee'] } } })
    if (nombre === 0) return null
    const existant = await lirePassageDuSuivi(tx, jetonSuiviExistant, maintenant)
    if (existant && existant.passageId === lien.passageId && typeof jetonSuiviExistant === 'string') {
      return { jeton: jetonSuiviExistant, echeance: existant.echeance, reutilise: true }
    }
    // Plafond de liens actifs par passage : seul ce chemin est borné, jamais l'émission des e-mails.
    if ((await nombreLiensSuiviActifs(tx, lien.passageId, maintenant)) >= PLAFOND_LIENS_SUIVI) return { refus: 'trop_de_liens' }
    const emis = await emettreJetonSuivi(tx, lien.passageId, maintenant)
    return { ...emis, reutilise: false }
  })
}

/** Révoque le lien émis pour un e-mail qui n'est pas parti (celui-là seulement). */
export async function abandonnerLienSuivi(jeton: string, maintenant: Date = new Date()): Promise<void> {
  await prisma.$transaction((tx) => revoquerJetonSuivi(tx, jeton, maintenant))
}
