import type { Prisma } from '@/generated/prisma/client'
import { DUREE_DESINSCRIPTION_JOURS } from '@/lib/reglages'
import { consommerJeton, emettreJeton, jetonBienForme, revoquerJetons } from './jetons'

// Lien de désinscription de l'annonce d'ouverture (FR-35, AD-14, story 4.9) : jeton d'usage
// `desinscription` dont la cible est l'id de l'inscription. Seul `acces` crée et vérifie les jetons ;
// le module `demandes` (propriétaire de `InscriptionOuverture`) appelle ces fonctions dans ses
// propres transactions. La valeur en clair n'existe que dans l'e-mail.

type Tx = Prisma.TransactionClient

// Un jeton émis depuis moins de ce délai, ni révoqué ni consommé, signale un envoi en cours pour ce
// contact (deux annonces simultanées n'écrivent pas deux fois) ; au-delà, l'envoi est réputé perdu.
const ENVOI_EN_COURS_MINUTES = 5

/**
 * Émet le jeton de désinscription d'un contact, avec l'appelant qui tient déjà le verrou de la ligne
 * du contact. null si un envoi est déjà en cours pour lui (jeton récent encore valable).
 */
export async function emettreJetonDesinscription(tx: Tx, inscriptionId: string, maintenant = new Date()): Promise<string | null> {
  const recent = await tx.jeton.findFirst({
    where: {
      usage: 'desinscription',
      cible: inscriptionId,
      revoqueLe: null,
      consommeLe: null,
      createdAt: { gt: new Date(maintenant.getTime() - ENVOI_EN_COURS_MINUTES * 60_000) },
    },
    select: { id: true },
  })
  if (recent) return null
  await revoquerJetons(tx, 'desinscription', [inscriptionId], maintenant)
  const echeance = new Date(maintenant.getTime() + DUREE_DESINSCRIPTION_JOURS * 24 * 60 * 60 * 1000)
  return emettreJeton(tx, { usage: 'desinscription', cible: inscriptionId, echeance })
}

/** Révoque le jeton d'un contact dont l'e-mail n'est pas parti : le lien ne doit pas rester valable. */
export async function revoquerJetonDesinscription(tx: Tx, inscriptionId: string, maintenant = new Date()): Promise<void> {
  await revoquerJetons(tx, 'desinscription', [inscriptionId], maintenant)
}

/** Consomme un lien (une seule fois) et renvoie l'id de l'inscription visée ; null si inutilisable. */
export async function consommerJetonDesinscription(tx: Tx, valeur: string, maintenant = new Date()): Promise<string | null> {
  const jeton = await consommerJeton(tx, valeur, 'desinscription', maintenant)
  return jeton?.cible ?? null
}

/** Une valeur qui n'a pas la forme d'un jeton n'ouvre aucune transaction. */
export { jetonBienForme as lienDesinscriptionBienForme }
