import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { acteurDepuis, type Acteur } from './acteur'

// Module acces (AD-15, story 1.8) : le rôle est relu en base à chaque demande, jamais pris
// dans le jeton de session. Un changement de rôle par un admin vaut dès le rechargement,
// sans reconnexion.

export { acteurDepuis, type Acteur, type ArtisteLie } from './acteur'

// Acteur de la requête courante : session pour l'identité, base pour le rôle.
// Un compte supprimé depuis la connexion redevient un visiteur.
export async function acteurCourant(): Promise<Acteur> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return { type: 'visiteur' }

  const utilisateur = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, artist: { select: { id: true, slug: true, name: true } } },
  })
  return acteurDepuis(utilisateur)
}
