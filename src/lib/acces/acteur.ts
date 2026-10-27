// Construction de l'acteur à partir de l'utilisateur relu en base (sans accès à la base).

export type ArtisteLie = { id: string; slug: string; name: string }

export type Acteur =
  | { type: 'visiteur' }
  | { type: 'user'; userId: string }
  | { type: 'artist'; userId: string; artiste: ArtisteLie | null }
  | { type: 'admin'; userId: string }

type UtilisateurLu = { id: string; role: string; artist: ArtisteLie | null } | null

// Rôle inconnu : traité comme `user`, jamais comme un rôle privilégié.
export function acteurDepuis(utilisateur: UtilisateurLu): Acteur {
  if (!utilisateur) return { type: 'visiteur' }
  switch (utilisateur.role) {
    case 'admin':
      return { type: 'admin', userId: utilisateur.id }
    case 'artist':
      return { type: 'artist', userId: utilisateur.id, artiste: utilisateur.artist }
    default:
      return { type: 'user', userId: utilisateur.id }
  }
}
