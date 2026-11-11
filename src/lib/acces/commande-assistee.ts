import type { Prisma } from '@/generated/prisma/client'
import { emettreJeton, jetonBienForme, lireJetonValide, revoquerJetons } from './jetons'

// Lien de la commande d'une vente assistée (story 6.3, AD-14) : jeton d'usage `commande_assistee`
// dont la cible est l'id du passage en caisse. Émis à l'envoi de l'e-mail (sa valeur en clair n'existe
// que là), valable jusqu'à l'échéance de la réservation, non consommé par l'échange (le lien se rouvre
// jusqu'à l'échéance). Seul `acces` crée et vérifie les jetons ; `commandes` appelle ces fonctions dans
// ses propres transactions. Aucune dépendance vers `evenements` ni `notifications`.

type Tx = Prisma.TransactionClient

/** Émet le lien d'un passage (les liens précédents sont révoqués) : valeur en clair à transmettre une fois. */
export async function emettreJetonCommandeAssistee(tx: Tx, passageId: string, echeance: Date, maintenant = new Date()): Promise<string> {
  await revoquerJetons(tx, 'commande_assistee', [passageId], maintenant)
  return emettreJeton(tx, { usage: 'commande_assistee', cible: passageId, echeance })
}

/** Révoque le lien d'un passage (e-mail non parti, réservation terminée). */
export async function revoquerJetonCommandeAssistee(tx: Tx, passageId: string, maintenant = new Date()): Promise<void> {
  await revoquerJetons(tx, 'commande_assistee', [passageId], maintenant)
}

/** Passage visé par un lien encore utilisable (ni révoqué, ni échu), sans le consommer ; null sinon. */
export async function lirePassageDuLien(tx: Tx, valeur: string, maintenant = new Date()): Promise<{ passageId: string; echeance: Date } | null> {
  if (typeof valeur !== 'string' || !jetonBienForme(valeur)) return null
  const jeton = await lireJetonValide(tx, valeur, 'commande_assistee', maintenant)
  return jeton ? { passageId: jeton.cible, echeance: jeton.echeance } : null
}

/** Vrai si un lien de ce passage est actif : l'e-mail est parti (un échec d'envoi révoque le lien). */
export async function lienActifDuPassage(tx: Tx, passageId: string, maintenant = new Date()): Promise<boolean> {
  const n = await tx.jeton.count({
    where: { usage: 'commande_assistee', cible: passageId, consommeLe: null, revoqueLe: null, echeance: { gt: maintenant } },
  })
  return n > 0
}
