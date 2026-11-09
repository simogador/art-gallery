import { AMBIANCES, COULEURS_DOMINANTES } from '@/lib/curation/depot-regles'
import { comparerPrixLivre, totalLivre } from '@/lib/livraison/prix'
import { formatOeuvre, orientationOeuvre, type FormatOeuvre, type OrientationOeuvre } from '@/lib/reglages'
import type { ArtMedium, Artwork } from '@/lib/types'

// Filtres de la galerie (story 3.9, FR-17, UX-DR20) : partie pure, sans accès à la base, importable
// côté client. Lecture et écriture des paramètres d'adresse, listes fermées, filtrage et tri en
// mémoire sur le catalogue lu avec son prix livré (`getAllArtworks(pays)`). Le prix livré n'est
// jamais recalculé ici : on lit `Artwork.prixLivre` (module livraison, story 3.3).

/** Nombre d'œuvres affichées d'abord, et ajoutées à chaque « Afficher plus d'œuvres ». */
export const PAS_AFFICHAGE = 24
/** Plafond de `n` dans l'adresse (une adresse trafiquée ne demande pas tout le catalogue d'un coup). */
export const MAX_AFFICHAGE = 960
/** Plafond du prix maximum saisi, en euros. */
export const MAX_PRIX_EUROS = 10_000_000

export const FORMATS = ['petit', 'moyen', 'grand'] as const
export const ORIENTATIONS = ['portrait', 'paysage', 'carre'] as const
export const TRIS = ['defaut', 'prix-croissant', 'prix-decroissant'] as const
export type TriGalerie = (typeof TRIS)[number]

/** Technique = catégorie de l'œuvre (`Artwork.medium` de l'interface), pas le texte libre. */
export const TECHNIQUES = [
  { code: 'peinture', medium: 'Peinture' },
  { code: 'sculpture', medium: 'Sculpture' },
  { code: 'photographie', medium: 'Photographie' },
  { code: 'art-numerique', medium: 'Art numérique' },
] as const satisfies readonly { code: string; medium: Exclude<ArtMedium, 'Tout'> }[]
export type CodeTechnique = (typeof TECHNIQUES)[number]['code']

export type FiltresGalerie = {
  /** Prix livré maximum, en euros entiers. */
  prixMax?: number
  format?: FormatOeuvre
  orientation?: OrientationOeuvre
  couleur?: string
  ambiance?: string
  technique?: CodeTechnique
  /** Slug de l'artiste. */
  artiste?: string
  /** Nationalité saisie de l'artiste, telle qu'en base. */
  pays?: string
  disponibles: boolean
  tri: TriGalerie
  /** Nombre d'œuvres affichées. */
  n: number
}

/** Options tirées des œuvres visibles : une valeur d'adresse absente de ces listes est ignorée. */
export type OptionsGalerie = {
  artistes: { slug: string; nom: string }[]
  pays: string[]
}

/** Clés des filtres dans l'adresse, dans l'ordre des puces et de l'écriture. */
export const CLES_FILTRES = ['prix', 'format', 'orientation', 'couleur', 'ambiance', 'technique', 'artiste', 'paysartiste', 'dispo'] as const
export type CleFiltre = (typeof CLES_FILTRES)[number]

export type ParametresAdresse = Record<string, string | string[] | undefined>

export const SANS_FILTRE: FiltresGalerie = { disponibles: false, tri: 'defaut', n: PAS_AFFICHAGE }

const premier = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? '')).trim()
const dans = <T extends string>(liste: readonly T[], v: string): T | undefined => liste.find((x) => x === v)

function entierPositif(v: string, max: number): number | undefined {
  const brut = v.replace(/[\s  ]/g, '')
  if (!/^\d{1,9}$/.test(brut)) return undefined
  const n = Number(brut)
  return n >= 1 && n <= max ? n : undefined
}

/**
 * Filtres lus dans l'adresse. Toute valeur inconnue (liste fermée, artiste ou pays absents des
 * `options`, nombre illisible) est ignorée, sans erreur. Sans `options`, artiste et pays sont
 * ignorés aussi : ils ne se valident que contre les œuvres visibles.
 */
export function lireFiltres(params: ParametresAdresse, options?: OptionsGalerie): FiltresGalerie {
  const filtres: FiltresGalerie = { disponibles: false, tri: 'defaut', n: PAS_AFFICHAGE }

  const prixMax = entierPositif(premier(params.prix), MAX_PRIX_EUROS)
  if (prixMax !== undefined) filtres.prixMax = prixMax
  const format = dans(FORMATS, premier(params.format))
  if (format) filtres.format = format
  const orientation = dans(ORIENTATIONS, premier(params.orientation))
  if (orientation) filtres.orientation = orientation
  const couleur = COULEURS_DOMINANTES.find((c) => c.code === premier(params.couleur))
  if (couleur) filtres.couleur = couleur.code
  const ambiance = AMBIANCES.find((a) => a.code === premier(params.ambiance))
  if (ambiance) filtres.ambiance = ambiance.code
  const technique = TECHNIQUES.find((t) => t.code === premier(params.technique))
  if (technique) filtres.technique = technique.code
  const artiste = premier(params.artiste)
  if (artiste && options?.artistes.some((a) => a.slug === artiste)) filtres.artiste = artiste
  const pays = premier(params.paysartiste)
  if (pays && options?.pays.includes(pays)) filtres.pays = pays
  if (premier(params.dispo) === '1') filtres.disponibles = true
  const tri = dans(TRIS, premier(params.tri))
  if (tri) filtres.tri = tri

  const n = entierPositif(premier(params.n), MAX_AFFICHAGE)
  if (n !== undefined) filtres.n = Math.max(PAS_AFFICHAGE, n)
  return filtres
}

/** Valeur de chaque filtre actif dans l'adresse (le tri et `n` n'en font pas partie). */
function valeursFiltres(f: FiltresGalerie): Partial<Record<CleFiltre, string>> {
  return {
    ...(f.prixMax !== undefined ? { prix: String(f.prixMax) } : {}),
    ...(f.format ? { format: f.format } : {}),
    ...(f.orientation ? { orientation: f.orientation } : {}),
    ...(f.couleur ? { couleur: f.couleur } : {}),
    ...(f.ambiance ? { ambiance: f.ambiance } : {}),
    ...(f.technique ? { technique: f.technique } : {}),
    ...(f.artiste ? { artiste: f.artiste } : {}),
    ...(f.pays ? { paysartiste: f.pays } : {}),
    ...(f.disponibles ? { dispo: '1' } : {}),
  }
}

/** Clés des filtres actifs, dans l'ordre des puces. */
export function filtresActifs(f: FiltresGalerie): CleFiltre[] {
  const valeurs = valeursFiltres(f)
  return CLES_FILTRES.filter((cle) => valeurs[cle] !== undefined)
}

/** Filtres sans celui de la clé donnée. */
export function sansFiltre(f: FiltresGalerie, cle: CleFiltre): FiltresGalerie {
  const copie = { ...f }
  if (cle === 'prix') delete copie.prixMax
  else if (cle === 'dispo') copie.disponibles = false
  else if (cle === 'paysartiste') delete copie.pays
  else delete copie[cle]
  return copie
}

/**
 * Adresse de la galerie pour ces filtres (valeurs par défaut omises, ordre fixe). `n` n'y figure
 * que s'il dépasse le pas : retirer un filtre ou en changer relance donc la liste au début.
 */
export function adresseGalerie(f: FiltresGalerie, opts: { n?: number } = {}): string {
  const q = new URLSearchParams()
  for (const [cle, valeur] of Object.entries(valeursFiltres(f))) q.set(cle, valeur)
  if (f.tri !== 'defaut') q.set('tri', f.tri)
  const n = opts.n ?? PAS_AFFICHAGE
  if (n > PAS_AFFICHAGE) q.set('n', String(n))
  const texte = q.toString()
  return texte ? `/galerie?${texte}` : '/galerie'
}

/** Œuvre affichée sans prix (vendue, vendue ailleurs, réservée) : jamais retenue par un filtre de prix. */
const prixLivreAffiche = (o: Artwork): number | null => (o.sold ? null : totalLivre(o))

/** Filtre et trie le catalogue ; l'ordre d'entrée est conservé pour le tri par défaut. */
export function appliquerFiltres(oeuvres: readonly Artwork[], f: FiltresGalerie): Artwork[] {
  const technique = TECHNIQUES.find((t) => t.code === f.technique)?.medium
  const liste = oeuvres.filter((o) => {
    if (f.prixMax !== undefined) {
      // Une œuvre non livrée vers le pays n'est jamais retenue.
      const total = prixLivreAffiche(o)
      if (total === null || total > f.prixMax * 100) return false
    }
    if (f.format && formatOeuvre(o.hauteurMm, o.largeurMm) !== f.format) return false
    if (f.orientation && orientationOeuvre(o.hauteurMm, o.largeurMm) !== f.orientation) return false
    if (f.couleur && o.couleurDominante !== f.couleur) return false
    if (f.ambiance && o.ambiance !== f.ambiance) return false
    if (technique && o.medium !== technique) return false
    if (f.artiste && o.artistId !== f.artiste) return false
    if (f.pays && o.paysArtiste?.trim() !== f.pays) return false
    if (f.disponibles && o.sold) return false
    return true
  })
  if (f.tri === 'defaut') return liste
  const sens = f.tri === 'prix-croissant' ? 1 : -1
  // Une œuvre sans prix affiché (vendue) passe après les autres, comme une œuvre non livrée.
  const sansPrix = (o: Artwork): Artwork => (o.sold ? { ...o, prixLivre: undefined } : o)
  return [...liste].sort((a, b) => comparerPrixLivre(sansPrix(a), sansPrix(b), sens))
}

/** Options (artistes, pays) tirées des œuvres lues, triées par nom français. */
export function optionsDepuis(oeuvres: readonly Artwork[]): OptionsGalerie {
  const artistes = new Map<string, string>()
  const pays = new Set<string>()
  for (const o of oeuvres) {
    artistes.set(o.artistId, o.artist)
    const p = o.paysArtiste?.trim()
    if (p) pays.add(p)
  }
  return {
    artistes: [...artistes].map(([slug, nom]) => ({ slug, nom })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    pays: [...pays].sort((a, b) => a.localeCompare(b, 'fr')),
  }
}
