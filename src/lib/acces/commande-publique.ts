import type { Prisma } from '@/generated/prisma/client'
import { DUREE_ABANDON_COMMANDE_JOURS } from '@/lib/reglages'
import { emettreJeton, jetonBienForme, lireJetonRecent, revoquerJetons } from './jetons'

// Rattachement du navigateur d'un acheteur sans compte à son passage en caisse (story 7.3, AD-14) :
// jeton d'usage `commande_publique` dont la cible est l'id du passage et l'échéance celle de la
// réservation. Émis à la création du passage (ou à sa retentative), sa valeur en clair ne vit que dans le
// cookie `httpOnly` de l'acheteur ; seule son empreinte est en base. Non consommé : il se relit jusqu'à
// l'échéance, puis encore pendant la durée d'abandon d'une commande (`DUREE_ABANDON_COMMANDE_JOURS`),
// pour que l'acheteur retrouve son passage échu et retente la réservation. Seul `acces` crée et vérifie
// les jetons ; `commandes` appelle ces fonctions dans ses propres transactions.

type Tx = Prisma.TransactionClient

/** Temps pendant lequel le jeton d'un passage échu reste lisible après son échéance. */
export const TOLERANCE_PASSAGE_MS = DUREE_ABANDON_COMMANDE_JOURS * 24 * 3_600_000

/** Émet le jeton d'un passage (les précédents sont révoqués) : valeur en clair à poser dans le cookie. */
export async function emettreJetonCommandePublique(tx: Tx, passageId: string, echeance: Date, maintenant = new Date()): Promise<string> {
  await revoquerJetons(tx, 'commande_publique', [passageId], maintenant)
  return emettreJeton(tx, { usage: 'commande_publique', cible: passageId, echeance })
}

export async function revoquerJetonCommandePublique(tx: Tx, passageId: string, maintenant = new Date()): Promise<void> {
  await revoquerJetons(tx, 'commande_publique', [passageId], maintenant)
}

/** Passage visé par un jeton lisible (ni révoqué, ni échu depuis plus d'une durée d'abandon), sans le consommer. */
export async function lirePassageDuNavigateur(
  tx: Tx,
  valeur: string | undefined,
  maintenant = new Date(),
): Promise<{ passageId: string; echeance: Date } | null> {
  if (typeof valeur !== 'string' || !jetonBienForme(valeur)) return null
  const jeton = await lireJetonRecent(tx, valeur, 'commande_publique', TOLERANCE_PASSAGE_MS, maintenant)
  return jeton ? { passageId: jeton.cible, echeance: jeton.echeance } : null
}
