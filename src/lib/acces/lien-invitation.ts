import { prisma } from '@/lib/prisma'
import { DUREE_INVITATION_JOURS } from '@/lib/reglages'
import { emettreJeton, revoquerJetons } from './jetons'

// Lien d'invitation émis à l'envoi de l'e-mail (story 4.1, AD-14). Le jeton n'existe pas avant ce
// moment ; sa valeur en clair n'est connue que de l'appelant (le gestionnaire d'envoi, pour l'e-mail).
// Fichier sans dépendance vers `evenements` : le gestionnaire de `notifications` l'importe sans cycle.

export type LienPret = { jeton: string; echeance: Date; email: string; artiste: string }

/**
 * Émet le jeton d'une invitation, une seule fois. Rien (null) si l'invitation n'a plus d'objet :
 * acceptée, déjà envoyée, artiste déjà relié, ou remplacée par une invitation plus récente du même
 * artiste (deux envois ne laissent jamais deux liens valables).
 */
export async function emettreLienInvitation(invitationId: string, maintenant = new Date()): Promise<LienPret | null> {
  return prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: { id: invitationId },
      select: { id: true, email: true, artistId: true, accepteeLe: true, envoyeeLe: true, artist: { select: { name: true } } },
    })
    if (!invitation || invitation.accepteeLe || invitation.envoyeeLe) return null
    // Même verrou que l'invitation : l'ordre « la plus récente » ne change pas pendant l'émission.
    await tx.$queryRaw`SELECT 1 FROM "Artist" WHERE "id" = ${invitation.artistId} FOR UPDATE`
    const artiste = await tx.artist.findUnique({ where: { id: invitation.artistId }, select: { userId: true } })
    if (!artiste || artiste.userId) return null
    const derniere = await tx.invitation.findFirst({
      where: { artistId: invitation.artistId, accepteeLe: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    })
    if (derniere?.id !== invitation.id) return null
    await revoquerJetons(tx, 'invitation', [invitation.id], maintenant)
    const echeance = new Date(maintenant.getTime() + DUREE_INVITATION_JOURS * 24 * 60 * 60 * 1000)
    const jeton = await emettreJeton(tx, { usage: 'invitation', cible: invitation.id, echeance })
    return { jeton, echeance, email: invitation.email, artiste: invitation.artist.name }
  })
}

/**
 * Note le résultat de l'envoi. Un échec révoque le jeton émis : le lien n'est parti nulle part, il
 * ne doit pas rester valable. L'équipe relance alors l'invitation.
 */
export async function noterEnvoiInvitation(
  invitationId: string,
  resultat: 'envoyee' | 'echec',
  maintenant = new Date(),
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (resultat === 'envoyee') {
      await tx.invitation.updateMany({ where: { id: invitationId }, data: { envoyeeLe: maintenant, echecEnvoiLe: null } })
      return
    }
    // Un échec n'efface jamais une invitation déjà partie : son lien reste valable.
    const { count } = await tx.invitation.updateMany({
      where: { id: invitationId, envoyeeLe: null },
      data: { echecEnvoiLe: maintenant },
    })
    if (count === 1) await revoquerJetons(tx, 'invitation', [invitationId], maintenant)
  })
}
