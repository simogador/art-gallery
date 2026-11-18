import type { Prisma } from '@/generated/prisma/client'
import { DUREE_SUIVI_JOURS } from '@/lib/reglages'
import { emettreJeton, jetonBienForme, lireJetonValide, revoquerJetonParValeur } from './jetons'

// Lien de suivi des commandes d'un acheteur sans compte (FR-15, AD-14, story 7.7) : jeton d'usage `suivi`
// dont la cible est l'id du passage en caisse et l'échéance `DUREE_SUIVI_JOURS` après l'émission. Émis à
// l'envoi d'un e-mail de commande à l'acheteur (sa valeur en clair n'existe que dans l'e-mail) ou à la
// demande de l'acheteur depuis `/confirmation` (valeur posée dans son cookie `httpOnly`) ; seule son
// empreinte est en base. Non consommé par l'échange : le lien se rouvre jusqu'à l'échéance. Les liens déjà
// émis ne sont PAS révoqués par une nouvelle émission (les anciens e-mails gardent leur lien) : un échec
// d'envoi ne révoque que le jeton émis pour cet envoi. Seul `acces` crée et vérifie les jetons ;
// `commandes` appelle ces fonctions dans ses propres transactions.

type Tx = Prisma.TransactionClient

/** Émet un lien de suivi pour un passage : valeur en clair à transmettre une seule fois. */
export async function emettreJetonSuivi(tx: Tx, passageId: string, maintenant = new Date()): Promise<{ jeton: string; echeance: Date }> {
  const echeance = new Date(maintenant.getTime() + DUREE_SUIVI_JOURS * 24 * 3_600_000)
  const jeton = await emettreJeton(tx, { usage: 'suivi', cible: passageId, echeance })
  return { jeton, echeance }
}

/** Révoque le jeton émis pour un envoi qui a échoué (celui-là seulement). */
export async function revoquerJetonSuivi(tx: Tx, valeur: string, maintenant = new Date()): Promise<void> {
  await revoquerJetonParValeur(tx, valeur, maintenant)
}

/** Passage visé par un lien de suivi encore utilisable (ni révoqué, ni échu), sans le consommer ; null sinon. */
export async function lirePassageDuSuivi(
  tx: Tx,
  valeur: string | undefined,
  maintenant = new Date(),
): Promise<{ passageId: string; echeance: Date } | null> {
  if (typeof valeur !== 'string' || !jetonBienForme(valeur)) return null
  const jeton = await lireJetonValide(tx, valeur, 'suivi', maintenant)
  return jeton ? { passageId: jeton.cible, echeance: jeton.echeance } : null
}

/** Nombre de liens de suivi encore actifs (ni révoqués, ni échus) d'un passage. */
export async function nombreLiensSuiviActifs(tx: Tx, passageId: string, maintenant = new Date()): Promise<number> {
  return tx.jeton.count({ where: { usage: 'suivi', cible: passageId, consommeLe: null, revoqueLe: null, echeance: { gt: maintenant } } })
}

/** Une valeur qui n'a pas la forme d'un jeton n'ouvre aucune transaction. */
export { jetonBienForme as lienSuiviBienForme }
