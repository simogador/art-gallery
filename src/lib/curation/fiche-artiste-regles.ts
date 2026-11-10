import { fr } from '@/lib/i18n/fr'
import { longueur } from './depot-regles'

// Page publique d'un artiste (story 3.11, FR-19) : règles pures, sans accès à la base. Partagées par
// le formulaire d'administration (composant client) et par le module curation (serveur), qui
// revalide toujours à la frontière. Pages gérées par l'équipe (OQ-14).

export type ChampFicheArtiste = 'bio' | 'statement' | 'formation' | 'expositions'

export const CHAMPS_FICHE_ARTISTE: readonly ChampFicheArtiste[] = ['bio', 'statement', 'formation', 'expositions']

/** Longueurs maximales en caractères (la biographie est obligatoire : la colonne n'est pas vide). */
export const LIMITES_FICHE_ARTISTE: Record<ChampFicheArtiste, number> = {
  bio: 3000,
  statement: 3000,
  formation: 1500,
  expositions: 3000,
}

export const LIBELLES_FICHE_ARTISTE: Record<ChampFicheArtiste, string> = {
  bio: 'Biographie',
  statement: 'Démarche',
  formation: 'Formation',
  expositions: 'Expositions',
}

export type SaisieFicheArtiste = Partial<Record<ChampFicheArtiste, unknown>>

export type FicheArtisteLue =
  | { ok: true; champs: { bio: string; statement: string | null; formation: string | null; expositions: string | null } }
  | { ok: false; erreur: string }

function texte(valeur: unknown): string | null {
  // Caractères de contrôle (dont le nul, refusé par PostgreSQL) retirés, sauf retour à la ligne et tabulation.
  return typeof valeur === 'string'
    ? valeur
        .replace(/\r\n/g, '\n')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
        .normalize('NFC')
        .trim()
    : null
}

/**
 * Lit la saisie de l'équipe : textes nettoyés (NFC, espaces de bord retirés). Biographie obligatoire ;
 * démarche, formation et expositions facultatives (vide = effacé, la section n'est plus affichée).
 */
export function lireFicheArtiste(saisie: unknown): FicheArtisteLue {
  const s = (saisie ?? {}) as SaisieFicheArtiste
  const lus: Record<string, string | null> = {}
  for (const champ of CHAMPS_FICHE_ARTISTE) {
    const t = texte(s[champ] ?? '')
    if (t === null) return { ok: false, erreur: `${LIBELLES_FICHE_ARTISTE[champ]} : texte illisible.` }
    const n = longueur(t)
    if (n > LIMITES_FICHE_ARTISTE[champ]) {
      return {
        ok: false,
        erreur: `${LIBELLES_FICHE_ARTISTE[champ]} : ${LIMITES_FICHE_ARTISTE[champ]} caractères au plus (${n} actuellement).`,
      }
    }
    lus[champ] = t === '' ? null : t
  }
  if (lus.bio === null) return { ok: false, erreur: 'Biographie : écrivez au moins une phrase.' }
  return {
    ok: true,
    champs: { bio: lus.bio, statement: lus.statement, formation: lus.formation, expositions: lus.expositions },
  }
}

/* ── Photos ─────────────────────────────────────────────────────────────── */

export type CiblePhotoArtiste = 'portrait' | 'atelier'

export const CIBLES_PHOTO_ARTISTE: readonly { cible: CiblePhotoArtiste; libelle: string }[] = [
  { cible: 'portrait', libelle: 'Portrait' },
  { cible: 'atelier', libelle: 'Photo d’atelier' },
]

export function estCiblePhotoArtiste(valeur: unknown): valeur is CiblePhotoArtiste {
  return valeur === 'portrait' || valeur === 'atelier'
}

export const TAILLE_MAX_PHOTO_ARTISTE = 10 * 1024 * 1024

const MESSAGE_PHOTO_ARTISTE_TYPE = fr.artistes.fichier.type
const MESSAGE_PHOTO_ARTISTE_POIDS = fr.artistes.fichier.poids

const EXTENSIONS_IMAGE = /\.(jpe?g|png|webp|heic|heif)$/i

/** Contrôle avant envoi d'une photo d'artiste (le navigateur envoie le fichier) : message, ou null si accepté. */
export function refusFichierArtiste(fichier: { type: string; size: number; name: string }): string | null {
  const image = fichier.type ? fichier.type.startsWith('image/') : EXTENSIONS_IMAGE.test(fichier.name)
  if (!image) return MESSAGE_PHOTO_ARTISTE_TYPE
  if (fichier.size > TAILLE_MAX_PHOTO_ARTISTE) return MESSAGE_PHOTO_ARTISTE_POIDS
  return null
}
