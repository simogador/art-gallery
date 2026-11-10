import { createHash, randomBytes } from 'node:crypto'
import type { Prisma, UsageJeton } from '@/generated/prisma/client'

// Jetons (AD-14, story 2.4) : aléatoires (256 bits), seule l'empreinte SHA-256 est stockée, avec
// l'usage, la cible et l'échéance. La valeur en clair n'est jamais stockée ni journalisée.

type Tx = Prisma.TransactionClient

// 32 octets en base64url : 43 caractères [A-Za-z0-9_-].
const FORMAT = /^[A-Za-z0-9_-]{43}$/

/** Forme d'un jeton émis par `emettreJeton` : permet d'écarter une valeur absurde sans toucher la base. */
export function jetonBienForme(valeur: string): boolean {
  return FORMAT.test(valeur)
}

export function empreinteJeton(valeur: string): string {
  return createHash('sha256').update(valeur).digest('hex')
}

/** Crée un jeton et renvoie sa valeur en clair, à transmettre une seule fois. */
export async function emettreJeton(
  tx: Tx,
  { usage, cible, echeance }: { usage: UsageJeton; cible: string; echeance: Date },
): Promise<string> {
  const valeur = randomBytes(32).toString('base64url')
  await tx.jeton.create({ data: { empreinte: empreinteJeton(valeur), usage, cible, echeance } })
  return valeur
}

/** Cible d'un jeton encore utilisable (ni consommé, ni révoqué, ni échu), sinon null. */
export async function lireJetonValide(
  tx: Tx,
  valeur: string,
  usage: UsageJeton,
  maintenant = new Date(),
): Promise<{ id: string; cible: string; echeance: Date } | null> {
  if (!FORMAT.test(valeur)) return null
  const jeton = await tx.jeton.findUnique({
    where: { empreinte: empreinteJeton(valeur) },
    select: { id: true, cible: true, echeance: true, usage: true, consommeLe: true, revoqueLe: true },
  })
  if (!jeton || jeton.usage !== usage || jeton.consommeLe || jeton.revoqueLe || jeton.echeance <= maintenant) {
    return null
  }
  return { id: jeton.id, cible: jeton.cible, echeance: jeton.echeance }
}

/**
 * Consomme un jeton encore utilisable, par une seule mise à jour conditionnelle : de deux envois
 * simultanés, un seul obtient la cible. null si le jeton n'est plus utilisable.
 */
export async function consommerJeton(
  tx: Tx,
  valeur: string,
  usage: UsageJeton,
  maintenant = new Date(),
): Promise<{ cible: string } | null> {
  const jeton = await lireJetonValide(tx, valeur, usage, maintenant)
  if (!jeton) return null
  const { count } = await tx.jeton.updateMany({
    where: { id: jeton.id, consommeLe: null, revoqueLe: null, echeance: { gt: maintenant } },
    data: { consommeLe: maintenant },
  })
  return count === 1 ? { cible: jeton.cible } : null
}

/** Révoque les jetons encore utilisables d'un usage pour ces cibles. */
export async function revoquerJetons(tx: Tx, usage: UsageJeton, cibles: string[], maintenant = new Date()) {
  if (cibles.length === 0) return
  await tx.jeton.updateMany({
    where: { usage, cible: { in: cibles }, consommeLe: null, revoqueLe: null },
    data: { revoqueLe: maintenant },
  })
}
