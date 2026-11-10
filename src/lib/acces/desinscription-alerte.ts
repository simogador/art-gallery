import type { Prisma } from '@/generated/prisma/client'
import { DUREE_DESINSCRIPTION_ALERTE_JOURS } from '@/lib/reglages'
import { consommerJeton, emettreJeton, jetonBienForme, revoquerJetons } from './jetons'

// Lien de désinscription de l'e-mail « Me prévenir » (FR-9, AD-14, story 4.5) : jeton d'usage
// `desinscription_alerte` dont la cible est l'id de l'inscription (l'usage `desinscription` reste celui
// des contacts de la maintenance). Seul `acces` crée et vérifie les jetons ; le module `demandes`
// (propriétaire de `InscriptionPrevenir`) appelle ces fonctions dans ses propres transactions. La
// valeur en clair n'existe que dans l'e-mail.

type Tx = Prisma.TransactionClient

/** Émet le lien d'une inscription, à l'envoi de l'e-mail de confirmation (les liens précédents sont révoqués). */
export async function emettreJetonDesinscriptionAlerte(tx: Tx, inscriptionId: string, maintenant = new Date()): Promise<string> {
  await revoquerJetons(tx, 'desinscription_alerte', [inscriptionId], maintenant)
  const echeance = new Date(maintenant.getTime() + DUREE_DESINSCRIPTION_ALERTE_JOURS * 24 * 60 * 60 * 1000)
  return emettreJeton(tx, { usage: 'desinscription_alerte', cible: inscriptionId, echeance })
}

/** Révoque le lien d'une inscription dont l'e-mail n'est pas parti. */
export async function revoquerJetonDesinscriptionAlerte(tx: Tx, inscriptionId: string, maintenant = new Date()): Promise<void> {
  await revoquerJetons(tx, 'desinscription_alerte', [inscriptionId], maintenant)
}

/** Consomme un lien (une seule fois) et renvoie l'id de l'inscription visée ; null si inutilisable. */
export async function consommerJetonDesinscriptionAlerte(tx: Tx, valeur: string, maintenant = new Date()): Promise<string | null> {
  const jeton = await consommerJeton(tx, valeur, 'desinscription_alerte', maintenant)
  return jeton?.cible ?? null
}

/** Une valeur qui n'a pas la forme d'un jeton n'ouvre aucune transaction. */
export { jetonBienForme as lienDesinscriptionAlerteBienForme }
