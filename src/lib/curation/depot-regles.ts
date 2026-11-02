import { centimetresEnMillimetres, MESSAGE_PRIX_INVALIDE, prixEnCentimes } from '@/lib/catalogue/conversions'

// Dépôt d'une œuvre par l'artiste (story 2.5, FR-20) : règles pures, sans accès à la base.
// Partagées par le formulaire (composants client) et par le module curation (serveur), qui
// revalide toujours à la frontière. Listes fermées décidées par le porteur le 2026-11-02,
// modifiables ici : codes snake_case sans accent stockés en base, libellés affichés.

/* ── Listes fermées ─────────────────────────────────────────────────────── */

export const COULEURS_DOMINANTES = [
  { code: 'ocre', libelle: 'Ocre' },
  { code: 'bleu', libelle: 'Bleu' },
  { code: 'blanc', libelle: 'Blanc' },
  { code: 'vert', libelle: 'Vert' },
  { code: 'rouge', libelle: 'Rouge' },
  { code: 'noir', libelle: 'Noir' },
  { code: 'gris', libelle: 'Gris' },
  { code: 'jaune', libelle: 'Jaune' },
  { code: 'multicolore', libelle: 'Multicolore' },
] as const

export const AMBIANCES = [
  { code: 'calme', libelle: 'Calme' },
  { code: 'lumineuse', libelle: 'Lumineuse' },
  { code: 'intense', libelle: 'Intense' },
  { code: 'melancolique', libelle: 'Mélancolique' },
  { code: 'joyeuse', libelle: 'Joyeuse' },
  { code: 'mysterieuse', libelle: 'Mystérieuse' },
] as const

const estDans = (liste: readonly { code: string }[], code: string | null): boolean =>
  code !== null && liste.some((e) => e.code === code)

/* ── Limites ────────────────────────────────────────────────────────────── */

export const LIMITES_DEPOT = {
  titre: 120,
  technique: 120,
  histoire: 300,
  anneeMin: 1900,
  dimensionMinMm: 1,
  dimensionMaxMm: 10_000,
} as const

/** Année d'un brouillon qui n'en a pas encore : `Artwork.year` est obligatoire en base. */
export const ANNEE_NON_RENSEIGNEE = 0

/** Nombre de caractères tel que l'artiste les compte (un emoji ou une lettre accentuée = 1). */
export function longueur(texte: string): number {
  return Array.from(texte.normalize('NFC')).length
}

/* ── Photos ─────────────────────────────────────────────────────────────── */

export type TypePhoto = 'face_lumiere_du_jour' | 'gros_plan' | 'mise_en_situation' | 'video'

const MO = 1024 * 1024

export const PHOTOS: readonly {
  type: TypePhoto
  legende: string
  obligatoire: boolean
  nature: 'image' | 'video'
  tailleMaxOctets: number
}[] = [
  { type: 'face_lumiere_du_jour', legende: 'Œuvre de face, lumière du jour', obligatoire: true, nature: 'image', tailleMaxOctets: 20 * MO },
  { type: 'gros_plan', legende: 'Gros plan de la matière', obligatoire: true, nature: 'image', tailleMaxOctets: 20 * MO },
  { type: 'mise_en_situation', legende: 'Mise en situation avec repère d’échelle', obligatoire: true, nature: 'image', tailleMaxOctets: 20 * MO },
  { type: 'video', legende: 'Vidéo', obligatoire: false, nature: 'video', tailleMaxOctets: 100 * MO },
]

/** Formats acceptés par nature, signés avec l'envoi (`allowed_formats`) et revérifiés à l'enregistrement. */
export const FORMATS_AUTORISES: Record<'image' | 'video', readonly string[]> = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
  video: ['mp4', 'mov', 'webm'],
}

export const TYPES_PHOTO: readonly TypePhoto[] = PHOTOS.map((p) => p.type)

export function estTypePhoto(valeur: unknown): valeur is TypePhoto {
  return typeof valeur === 'string' && (TYPES_PHOTO as readonly string[]).includes(valeur)
}

export function photo(type: TypePhoto) {
  return PHOTOS.find((p) => p.type === type)!
}

// Certains navigateurs ne donnent pas de type aux photos HEIC des iPhone : on se fie alors à l'extension.
const EXTENSIONS_IMAGE = /\.(jpe?g|png|webp|heic|heif)$/i

/** Vérification avant envoi (le navigateur, pas le serveur, envoie le fichier) : message, ou null si accepté. */
export function refusFichier(type: TypePhoto, fichier: { type: string; size: number; name: string }): string | null {
  const p = photo(type)
  const nature =
    fichier.type.startsWith('image/') || (!fichier.type && EXTENSIONS_IMAGE.test(fichier.name))
      ? 'image'
      : fichier.type.startsWith('video/')
        ? 'video'
        : null
  const max = `${p.tailleMaxOctets / MO} Mo`
  if (nature !== p.nature) {
    return p.nature === 'video'
      ? `Choisissez une vidéo (${max} au plus).`
      : `Choisissez une photo (JPEG, PNG, HEIC…) de ${max} au plus.`
  }
  if (fichier.size > p.tailleMaxOctets) {
    return `Ce fichier dépasse ${max} : choisissez-en un plus léger.`
  }
  return null
}

/* ── Champs ─────────────────────────────────────────────────────────────── */

export type ChampDepot =
  | 'titre'
  | 'technique'
  | 'annee'
  | 'histoire'
  | 'ambiance'
  | 'hauteur'
  | 'largeur'
  | 'profondeur'
  | 'couleurDominante'
  | 'prix'

export const CHAMPS_DEPOT: readonly ChampDepot[] = [
  'titre', 'technique', 'annee', 'histoire', 'ambiance', 'hauteur', 'largeur', 'profondeur', 'couleurDominante', 'prix',
]

export function estChampDepot(valeur: unknown): valeur is ChampDepot {
  return typeof valeur === 'string' && (CHAMPS_DEPOT as readonly string[]).includes(valeur)
}

export const LIBELLES_CHAMPS: Record<ChampDepot, string> = {
  titre: 'Titre',
  technique: 'Technique',
  annee: 'Année',
  histoire: 'Histoire courte',
  ambiance: 'Ambiance',
  hauteur: 'Hauteur (cm)',
  largeur: 'Largeur (cm)',
  profondeur: 'Profondeur (cm, facultative)',
  couleurDominante: 'Couleur dominante',
  prix: 'Prix de l’œuvre seule (€)',
}

/** Valeur prête à enregistrer : texte, nombre (année, millimètres, centimes) ou null (champ vidé). */
export type ValeurChamp = string | number | null
export type ChampLu = { ok: true; valeur: ValeurChamp } | { ok: false; erreur: string }

function texteBorne(saisie: string, max: number, nom: string): ChampLu {
  const texte = saisie.normalize('NFC').trim()
  const n = longueur(texte)
  if (n > max) return { ok: false, erreur: `${nom} ne doit pas dépasser ${max} caractères (${n} actuellement).` }
  return { ok: true, valeur: texte }
}

function dimension(saisie: string, nom: string, facultative: boolean): ChampLu {
  const message = `Indiquez ${nom} en centimètres, entre 0,1 et ${LIMITES_DEPOT.dimensionMaxMm / 10} (par exemple « 60 » ou « 31,5 »)${facultative ? ', ou laissez le champ vide' : ''}.`
  const mm = centimetresEnMillimetres(saisie)
  if (mm === null) return { ok: true, valeur: null }
  if (mm === 'illisible' || mm < LIMITES_DEPOT.dimensionMinMm || mm > LIMITES_DEPOT.dimensionMaxMm) {
    return { ok: false, erreur: message }
  }
  return { ok: true, valeur: mm }
}

/**
 * Valide un champ à la sortie (jamais à chaque frappe) et le convertit dans son unité de stockage :
 * année entière, dimensions en millimètres, prix en centimes. Un champ vidé vaut null (ou texte vide).
 */
export function validerChamp(champ: ChampDepot, saisie: unknown, maintenant: Date = new Date()): ChampLu {
  if (typeof saisie !== 'string') return { ok: false, erreur: 'Valeur illisible.' }
  switch (champ) {
    case 'titre':
      return texteBorne(saisie, LIMITES_DEPOT.titre, 'Le titre')
    case 'technique':
      return texteBorne(saisie, LIMITES_DEPOT.technique, 'La technique')
    case 'histoire':
      return texteBorne(saisie, LIMITES_DEPOT.histoire, 'L’histoire courte')
    case 'annee': {
      const texte = saisie.trim()
      if (texte === '') return { ok: true, valeur: null }
      const max = maintenant.getFullYear()
      const annee = /^\d{4}$/.test(texte) ? Number(texte) : NaN
      if (!(annee >= LIMITES_DEPOT.anneeMin && annee <= max)) {
        return { ok: false, erreur: `Indiquez une année entre ${LIMITES_DEPOT.anneeMin} et ${max}, en quatre chiffres.` }
      }
      return { ok: true, valeur: annee }
    }
    case 'ambiance':
      if (saisie === '') return { ok: true, valeur: null }
      return estDans(AMBIANCES, saisie) ? { ok: true, valeur: saisie } : { ok: false, erreur: 'Choisissez une ambiance dans la liste.' }
    case 'couleurDominante':
      if (saisie === '') return { ok: true, valeur: null }
      return estDans(COULEURS_DOMINANTES, saisie)
        ? { ok: true, valeur: saisie }
        : { ok: false, erreur: 'Choisissez une couleur dominante dans la liste.' }
    case 'hauteur':
      return dimension(saisie, 'la hauteur', false)
    case 'largeur':
      return dimension(saisie, 'la largeur', false)
    case 'profondeur':
      return dimension(saisie, 'la profondeur', true)
    case 'prix': {
      const lu = prixEnCentimes(saisie)
      return lu.ok ? { ok: true, valeur: lu.centimes } : { ok: false, erreur: MESSAGE_PRIX_INVALIDE }
    }
  }
}

/* ── Affichage ──────────────────────────────────────────────────────────── */

export type Orientation = 'portrait' | 'paysage' | 'carre'

export const LIBELLES_ORIENTATION: Record<Orientation, string> = { portrait: 'portrait', paysage: 'paysage', carre: 'carré' }

/**
 * Écart relatif entre hauteur et largeur en deçà duquel l'œuvre est dite carrée (réglable).
 * 0 : carrée seulement si hauteur et largeur sont égales au millimètre.
 */
export const ECART_CARRE = 0

export function orientation(hauteurMm: number, largeurMm: number): Orientation {
  if (Math.abs(hauteurMm - largeurMm) <= ECART_CARRE * Math.max(hauteurMm, largeurMm)) return 'carre'
  return hauteurMm > largeurMm ? 'portrait' : 'paysage'
}

/** Millimètres → pouces, à une décimale, virgule française (600 → « 23,6 »). */
export function enPouces(mm: number): string {
  const dixiemes = Math.round((mm * 10) / 25.4)
  const reste = dixiemes % 10
  return reste === 0 ? String(dixiemes / 10) : `${(dixiemes - reste) / 10},${reste}`
}

/** « 23,6 × 31,5 in · paysage » à partir de la saisie en cm ; null tant que hauteur ou largeur manque ou est invalide. */
export function apercuDimensions(saisie: { hauteur: string; largeur: string; profondeur: string }): string | null {
  const h = validerChamp('hauteur', saisie.hauteur)
  const l = validerChamp('largeur', saisie.largeur)
  const p = validerChamp('profondeur', saisie.profondeur)
  if (!h.ok || !l.ok || typeof h.valeur !== 'number' || typeof l.valeur !== 'number') return null
  const valeurs = [h.valeur, l.valeur, ...(p.ok && typeof p.valeur === 'number' ? [p.valeur] : [])]
  return `${valeurs.map(enPouces).join(' × ')} in · ${LIBELLES_ORIENTATION[orientation(h.valeur, l.valeur)]}`
}

/** Centimes → saisie du champ prix (125 050 → « 1250,50 »), vide sans prix. */
export function centimesEnSaisie(centimes: number | null): string {
  if (centimes === null) return ''
  const reste = centimes % 100
  const euros = (centimes - reste) / 100
  return reste === 0 ? String(euros) : `${euros},${String(reste).padStart(2, '0')}`
}

/* ── Sections et complétude ─────────────────────────────────────────────── */

/** Données d'un dépôt telles qu'enregistrées (lues par curation.lireDepot). */
export type DonneesDepot = {
  titre: string
  technique: string
  /** null : pas encore renseignée. */
  annee: number | null
  histoire: string
  ambiance: string | null
  couleurDominante: string | null
  hauteurMm: number | null
  largeurMm: number | null
  profondeurMm: number | null
  prixCentimes: number | null
  /** Types de photos déjà enregistrées. */
  photos: TypePhoto[]
}

export type PhotoDepot = { url: string; largeur: number | null; hauteur: number | null }

/** Dépôt relu par le serveur (curation.lireDepot) et transmis au formulaire. */
export type DepotLu = DonneesDepot & {
  slug: string
  photosLues: Partial<Record<TypePhoto, PhotoDepot>>
}

export type IdSection = 'photos' | 'informations' | 'dimensions' | 'expedition' | 'engagements'

export type EtatSection = { id: IdSection; numero: number; titre: string; complet: boolean; manques: string[] }

export const NOMBRE_SECTIONS = 5

/**
 * État des cinq sections. Expédition et Engagements restent « À compléter » : leur saisie vient
 * avec la story 2.6.
 */
export function etatSections(d: DonneesDepot): EtatSection[] {
  const manquesPhotos = PHOTOS.filter((p) => p.obligatoire && !d.photos.includes(p.type)).map((p) => p.legende)
  const manquesInfos = [
    !d.titre && LIBELLES_CHAMPS.titre,
    !d.technique && LIBELLES_CHAMPS.technique,
    d.annee === null && LIBELLES_CHAMPS.annee,
    !d.histoire && LIBELLES_CHAMPS.histoire,
    !estDans(AMBIANCES, d.ambiance) && LIBELLES_CHAMPS.ambiance,
  ].filter((m): m is string => Boolean(m))
  const manquesDims = [
    d.hauteurMm === null && 'Hauteur',
    d.largeurMm === null && 'Largeur',
    !estDans(COULEURS_DOMINANTES, d.couleurDominante) && LIBELLES_CHAMPS.couleurDominante,
    d.prixCentimes === null && 'Prix',
  ].filter((m): m is string => Boolean(m))
  const section = (id: IdSection, numero: number, titre: string, manques: string[]): EtatSection => ({
    id, numero, titre, complet: manques.length === 0, manques,
  })
  return [
    section('photos', 1, 'Photos', manquesPhotos),
    section('informations', 2, 'Informations', manquesInfos),
    section('dimensions', 3, 'Dimensions et prix', manquesDims),
    section('expedition', 4, 'Expédition', ['Frais et délais par zone']),
    section('engagements', 5, 'Engagements', ['Certificat, emballage et reprise']),
  ]
}

export function nombreSectionsCompletes(sections: EtatSection[]): number {
  return sections.filter((s) => s.complet).length
}

/* ── Refus ──────────────────────────────────────────────────────────────── */

export type CodeRefusDepot =
  | 'acces_refuse'
  | 'introuvable'
  | 'transition_interdite'
  | 'valeur_invalide'
  | 'signature_invalide'
  | 'fichier_refuse'
  | 'envoi_indisponible'

export const MESSAGE_NON_ENREGISTRE = 'Non enregistré, réessayez.'

export function messageRefusDepot(code: CodeRefusDepot): string {
  switch (code) {
    case 'acces_refuse':
      return 'Cette œuvre n’est pas accessible depuis votre compte.'
    case 'introuvable':
      return 'Cette œuvre n’existe plus. Rechargez la page.'
    case 'transition_interdite':
      return 'Cette œuvre n’est plus un brouillon : elle ne se modifie plus depuis ce formulaire. Rechargez la page.'
    case 'valeur_invalide':
      return 'Valeur refusée : vérifiez votre saisie.'
    case 'signature_invalide':
      return 'Le fichier n’a pas pu être vérifié et n’a pas été enregistré. Envoyez-le de nouveau.'
    case 'fichier_refuse':
      return 'Ce fichier ne correspond pas à cette case : choisissez une photo, ou une vidéo pour la case Vidéo.'
    case 'envoi_indisponible':
      return 'L’envoi de photos est momentanément indisponible. Réessayez plus tard ou écrivez à l’équipe.'
  }
}
