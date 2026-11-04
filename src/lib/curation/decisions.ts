import type { Prisma } from '@/generated/prisma/client'
import type { RenvoiCuration } from './depot-regles'

// Décisions de curation (story 2.7) : lecture partagée par le dépôt (bandeau de l'artiste) et la
// file de l'équipe. Les écritures sont dans ./file (validerOeuvre, renvoyerOeuvre).

/**
 * Dernier renvoi de l'œuvre à l'artiste, tant qu'elle n'a pas été renvoyée en curation depuis :
 * la dernière décision est un renvoi, postérieur au dernier envoi. null sinon.
 */
export async function dernierRenvoi(tx: Prisma.TransactionClient, artworkId: string): Promise<RenvoiCuration | null> {
  // Requêtes l'une après l'autre : une transaction interactive n'en exécute qu'une à la fois.
  const decision = await tx.decisionCuration.findFirst({
    where: { artworkId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { decision: true, commentaire: true, createdAt: true },
  })
  if (!decision || decision.decision !== 'renvoyer' || !decision.commentaire) return null
  const oeuvre = await tx.artwork.findUnique({ where: { id: artworkId }, select: { envoyeeEnCurationLe: true } })
  const envoyeeLe = oeuvre?.envoyeeEnCurationLe
  if (envoyeeLe && envoyeeLe > decision.createdAt) return null
  return { commentaire: decision.commentaire, le: decision.createdAt }
}

/** Dernier renvoi de l'œuvre par l'équipe, qu'elle ait été renvoyée en curation depuis ou non. */
export async function dernierRenvoiEquipe(tx: Prisma.TransactionClient, artworkId: string): Promise<RenvoiCuration | null> {
  const d = await tx.decisionCuration.findFirst({
    where: { artworkId, decision: 'renvoyer' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { commentaire: true, createdAt: true },
  })
  return d?.commentaire ? { commentaire: d.commentaire, le: d.createdAt } : null
}
