import { centimetresEnMillimetres, MESSAGE_PRIX_INVALIDE, prixEnCentimes } from '@/lib/catalogue/conversions'
import { enPouces, formaterDimensions, formaterMontant, SEPARATEUR } from '@/lib/i18n/formats'

// Dépôt d'une œuvre par l'artiste (stories 2.5 et 2.6, FR-20) : règles pures, sans accès à la base.
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
  { type: 'face_lumiere_du_jour', legende: 'Œuvre de face, lumière du jour', obligatoire: true, nature: 'image', tailleMaxOctets: 10 * MO },
  { type: 'gros_plan', legende: 'Gros plan de la matière', obligatoire: true, nature: 'image', tailleMaxOctets: 10 * MO },
  { type: 'mise_en_situation', legende: 'Mise en situation avec repère d’échelle', obligatoire: true, nature: 'image', tailleMaxOctets: 10 * MO },
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
  | 'visitesAtelier'
  | 'engagementCertificat'
  | 'engagementEmballage'
  | 'engagementReprise'

export const CHAMPS_DEPOT: readonly ChampDepot[] = [
  'titre', 'technique', 'annee', 'histoire', 'ambiance', 'hauteur', 'largeur', 'profondeur', 'couleurDominante', 'prix',
  'visitesAtelier', 'engagementCertificat', 'engagementEmballage', 'engagementReprise',
]

/** Les trois engagements de la section 5 (story 2.6), dans l'ordre d'affichage. */
export const ENGAGEMENTS = ['engagementCertificat', 'engagementEmballage', 'engagementReprise'] as const
export type ChampEngagement = (typeof ENGAGEMENTS)[number]

/** Saisie d'un choix oui / non (visites en atelier, engagements) : « oui », « non » ou vide. */
export const OUI = 'oui'
export const NON = 'non'

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
  visitesAtelier: 'Acceptez-vous les visites en atelier ?',
  engagementCertificat: 'Je fournis un certificat d’authenticité signé avec l’œuvre.',
  engagementEmballage: 'J’emballe l’œuvre selon le guide d’emballage Errancy.',
  engagementReprise: 'J’accepte la reprise d’une œuvre retournée dans son emballage d’origine.',
}

/** Valeur prête à enregistrer : texte, nombre (année, millimètres, centimes), booléen (oui / non) ou null (champ vidé). */
export type ValeurChamp = string | number | boolean | null
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
    case 'visitesAtelier':
      if (saisie === '') return { ok: true, valeur: null }
      return saisie === OUI || saisie === NON
        ? { ok: true, valeur: saisie === OUI }
        : { ok: false, erreur: 'Répondez par oui ou par non.' }
    case 'engagementCertificat':
    case 'engagementEmballage':
    case 'engagementReprise':
      return saisie === OUI || saisie === NON ? { ok: true, valeur: saisie === OUI } : { ok: false, erreur: 'Valeur illisible.' }
  }
}

/* ── Expédition par zone (story 2.6, AD-12) ─────────────────────────────── */

export const LIMITES_EXPEDITION = {
  fraisMaxCentimes: 1_000_000,
  preparationMin: 0,
  preparationMax: 60,
  transportMin: 1,
  transportMax: 90,
} as const

/** Zone ouverte par l'équipe, telle que montrée à l'artiste. */
export type ZoneDepot = { id: string; nom: string }

/** Offre enregistrée d'une œuvre pour une zone : livrée (frais et délais) ou « je ne livre pas ». */
export type OffreDepot = {
  zoneId: string
  livree: boolean
  fraisCentimes: number | null
  preparationJours: number | null
  transportMinJours: number | null
  transportMaxJours: number | null
}

export type ChampOffre = 'frais' | 'preparation' | 'transportMin' | 'transportMax'
export const CHAMPS_OFFRE: readonly ChampOffre[] = ['frais', 'preparation', 'transportMin', 'transportMax']

export const LIBELLES_OFFRE: Record<ChampOffre, string> = {
  frais: 'Frais d’expédition (€)',
  preparation: 'Préparation (jours)',
  transportMin: 'Transport, au moins (jours)',
  transportMax: 'Transport, au plus (jours)',
}

/** Saisie d'une zone dans le formulaire : textes des quatre champs et case « Je ne livre pas cette zone ». */
export type SaisieOffre = { nonLivree: boolean } & Record<ChampOffre, string>

export type OffreLue =
  | { ok: true; offre: Omit<OffreDepot, 'zoneId'> | null }
  | { ok: false; erreurs: Partial<Record<ChampOffre, string>> }

function fraisEnCentimes(saisie: string): number | null | 'invalide' {
  const texte = saisie.trim()
  if (texte === '') return null
  const lu = prixEnCentimes(texte)
  if (!lu.ok) return 'invalide'
  // prixEnCentimes lit « 0 » comme une absence de prix ; ici, 0 € est un montant.
  const centimes = lu.centimes ?? 0
  return centimes > LIMITES_EXPEDITION.fraisMaxCentimes ? 'invalide' : centimes
}

function jours(saisie: string, min: number, max: number): number | null | 'invalide' {
  const texte = saisie.trim()
  if (texte === '') return null
  if (!/^\d{1,3}$/.test(texte)) return 'invalide'
  const n = Number(texte)
  return n >= min && n <= max ? n : 'invalide'
}

/** Erreur d'un seul champ d'une zone, à sa sortie (null : valeur acceptable ou vide). */
export function erreurChampOffre(champ: ChampOffre, saisie: Record<ChampOffre, string>): string | null {
  const L = LIMITES_EXPEDITION
  switch (champ) {
    case 'frais':
      return fraisEnCentimes(saisie.frais) === 'invalide'
        ? `Indiquez les frais en euros, de 0 à ${formaterMontant(L.fraisMaxCentimes)} (par exemple « 25 » ou « 12,50 »).`
        : null
    case 'preparation':
      return jours(saisie.preparation, L.preparationMin, L.preparationMax) === 'invalide'
        ? `Indiquez un nombre entier de jours, de ${L.preparationMin} à ${L.preparationMax}.`
        : null
    case 'transportMin':
      return jours(saisie.transportMin, L.transportMin, L.transportMax) === 'invalide'
        ? `Indiquez un nombre entier de jours, de ${L.transportMin} à ${L.transportMax}.`
        : null
    case 'transportMax': {
      const max = jours(saisie.transportMax, L.transportMin, L.transportMax)
      if (max === 'invalide') return `Indiquez un nombre entier de jours, de ${L.transportMin} à ${L.transportMax}.`
      const min = jours(saisie.transportMin, L.transportMin, L.transportMax)
      if (typeof min === 'number' && typeof max === 'number' && min > max) {
        return 'Le transport au plus doit être supérieur ou égal au transport au moins.'
      }
      return null
    }
  }
}

/** Les quatre champs de la zone sont-ils tous vides, tous remplis, ou en partie ? */
export function remplissageOffre(saisie: Record<ChampOffre, string>): 'vide' | 'complet' | 'partiel' {
  const remplis = CHAMPS_OFFRE.filter((c) => saisie[c].trim() !== '').length
  return remplis === 0 ? 'vide' : remplis === CHAMPS_OFFRE.length ? 'complet' : 'partiel'
}

/**
 * Valide la saisie d'une zone et la convertit (centimes, jours entiers). « Je ne livre pas » : offre
 * non livrée, frais et délais vides. Quatre champs vides : aucune offre (null, la zone redevient à
 * compléter). Sinon les quatre valeurs sont exigées et bornées ; un refus n'écrit rien.
 */
export function validerOffre(saisie: unknown): OffreLue {
  const s = saisie as Partial<SaisieOffre> | null
  if (!s || typeof s !== 'object' || typeof s.nonLivree !== 'boolean' || CHAMPS_OFFRE.some((c) => typeof s[c] !== 'string')) {
    return { ok: false, erreurs: { frais: 'Valeur illisible.' } }
  }
  const lue = s as SaisieOffre
  if (lue.nonLivree) {
    return {
      ok: true,
      offre: { livree: false, fraisCentimes: null, preparationJours: null, transportMinJours: null, transportMaxJours: null },
    }
  }
  if (remplissageOffre(lue) === 'vide') return { ok: true, offre: null }
  const erreurs: Partial<Record<ChampOffre, string>> = {}
  for (const c of CHAMPS_OFFRE) {
    const e = lue[c].trim() === '' ? `Indiquez : ${LIBELLES_OFFRE[c].toLowerCase()}.` : erreurChampOffre(c, lue)
    if (e) erreurs[c] = e
  }
  if (Object.keys(erreurs).length) return { ok: false, erreurs }
  const L = LIMITES_EXPEDITION
  return {
    ok: true,
    offre: {
      livree: true,
      fraisCentimes: fraisEnCentimes(lue.frais) as number,
      preparationJours: jours(lue.preparation, L.preparationMin, L.preparationMax) as number,
      transportMinJours: jours(lue.transportMin, L.transportMin, L.transportMax) as number,
      transportMaxJours: jours(lue.transportMax, L.transportMin, L.transportMax) as number,
    },
  }
}

/** Offre enregistrée → saisie du formulaire (2 500 centimes → « 25 »). */
export function offreEnSaisie(o: OffreDepot | undefined): SaisieOffre {
  const n = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))
  return {
    nonLivree: o ? !o.livree : false,
    frais: o?.livree ? (o.fraisCentimes === 0 ? '0' : centimesEnSaisie(o.fraisCentimes)) : '',
    preparation: o?.livree ? n(o.preparationJours) : '',
    transportMin: o?.livree ? n(o.transportMinJours) : '',
    transportMax: o?.livree ? n(o.transportMaxJours) : '',
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

/** Millimètres → pouces, à une décimale, virgule française (600 → « 23,6 ») : enPouces de i18n. */
export { enPouces }

/** « 23,6 × 31,5 in · paysage » à partir de la saisie en cm ; null tant que hauteur ou largeur manque ou est invalide. */
export function apercuDimensions(saisie: { hauteur: string; largeur: string; profondeur: string }): string | null {
  const h = validerChamp('hauteur', saisie.hauteur)
  const l = validerChamp('largeur', saisie.largeur)
  const p = validerChamp('profondeur', saisie.profondeur)
  if (!h.ok || !l.ok || typeof h.valeur !== 'number' || typeof l.valeur !== 'number') return null
  const pouces = formaterDimensions(
    { hauteurMm: h.valeur, largeurMm: l.valeur, profondeurMm: p.ok && typeof p.valeur === 'number' ? p.valeur : null },
    'in',
  )
  return `${pouces}${SEPARATEUR}${LIBELLES_ORIENTATION[orientation(h.valeur, l.valeur)]}`
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
  /** Offres enregistrées, une au plus par zone (story 2.6). */
  offres: OffreDepot[]
  /** null : pas encore renseignée. */
  visitesAtelier: boolean | null
  engagementCertificat: boolean
  engagementEmballage: boolean
  engagementReprise: boolean
}

export type PhotoDepot = { url: string; largeur: number | null; hauteur: number | null }

/** Dépôt relu par le serveur (curation.lireDepot) et transmis au formulaire. */
export type DepotLu = DonneesDepot & {
  slug: string
  /** Devise du prix (`Artwork.devise`, story 3.2), pour formaterMontant. */
  devise: string
  photosLues: Partial<Record<TypePhoto, PhotoDepot>>
  /** Une autre œuvre de l'artiste a des offres : « Reprendre les zones de ma dernière œuvre » est proposé. */
  repriseDisponible: boolean
  /** Dernier renvoi de l'équipe (story 2.7), affiché jusqu'au prochain envoi en curation ; null sinon. */
  renvoi: RenvoiCuration | null
}

/** Commentaire de l'équipe quand elle renvoie une œuvre à l'artiste (story 2.7). */
export type RenvoiCuration = { commentaire: string; le: Date }

export type IdSection = 'photos' | 'informations' | 'dimensions' | 'expedition' | 'engagements'

export type EtatSection = { id: IdSection; numero: number; titre: string; complet: boolean; manques: string[] }

export const NOMBRE_SECTIONS = 5

/** Élément qui manque pour envoyer en curation, avec l'id de l'élément d'interface où placer le focus. */
export type ElementManquant = { section: IdSection; libelle: string; cible: string }

/** Ids des éléments d'interface du formulaire, partagés par le formulaire et la liste des manques. */
export const ID_CHAMP = {
  champ: (champ: ChampDepot) => `depot-${champ}`,
  photo: (type: TypePhoto) => `depot-photo-${type}`,
  zone: (zoneId: string, champ: ChampOffre | 'nonLivree') => `depot-zone-${zoneId}-${champ}`,
  section: (id: IdSection) => `section-${id}`,
}

const SECTIONS: readonly { id: IdSection; titre: string }[] = [
  { id: 'photos', titre: 'Photos' },
  { id: 'informations', titre: 'Informations' },
  { id: 'dimensions', titre: 'Dimensions et prix' },
  { id: 'expedition', titre: 'Expédition' },
  { id: 'engagements', titre: 'Engagements' },
]

export const MESSAGE_AUCUNE_ZONE_LIVREE = 'Livrez au moins une zone'

/**
 * Tout ce qui manque pour envoyer l'œuvre en curation, dans l'ordre du formulaire. Expédition :
 * chaque zone ouverte par l'équipe a une offre ou « je ne livre pas », au moins une est livrée, et
 * les visites en atelier sont renseignées ; sans zone ouverte, la section ne peut pas être complète.
 */
export function elementsManquants(d: DonneesDepot, zones: readonly ZoneDepot[]): ElementManquant[] {
  const m: ElementManquant[] = []
  const champ = (section: IdSection, c: ChampDepot, libelle = LIBELLES_CHAMPS[c]) =>
    m.push({ section, libelle, cible: ID_CHAMP.champ(c) })

  for (const p of PHOTOS) {
    if (p.obligatoire && !d.photos.includes(p.type)) m.push({ section: 'photos', libelle: p.legende, cible: ID_CHAMP.photo(p.type) })
  }
  if (!d.titre) champ('informations', 'titre')
  if (!d.technique) champ('informations', 'technique')
  if (d.annee === null) champ('informations', 'annee')
  if (!d.histoire) champ('informations', 'histoire')
  if (!estDans(AMBIANCES, d.ambiance)) champ('informations', 'ambiance')
  if (d.hauteurMm === null) champ('dimensions', 'hauteur', 'Hauteur')
  if (d.largeurMm === null) champ('dimensions', 'largeur', 'Largeur')
  if (!estDans(COULEURS_DOMINANTES, d.couleurDominante)) champ('dimensions', 'couleurDominante')
  if (d.prixCentimes === null) champ('dimensions', 'prix', 'Prix')

  if (zones.length === 0) {
    m.push({ section: 'expedition', libelle: 'Zones de livraison (pas encore ouvertes par l’équipe)', cible: ID_CHAMP.section('expedition') })
  } else {
    const offres = new Map(d.offres.map((o) => [o.zoneId, o]))
    for (const z of zones) {
      if (!offres.has(z.id)) {
        m.push({ section: 'expedition', libelle: `${z.nom} : frais et délais, ou « Je ne livre pas »`, cible: ID_CHAMP.zone(z.id, 'frais') })
      }
    }
    const toutesRenseignees = zones.every((z) => offres.has(z.id))
    if (toutesRenseignees && !zones.some((z) => offres.get(z.id)?.livree)) {
      m.push({ section: 'expedition', libelle: MESSAGE_AUCUNE_ZONE_LIVREE, cible: ID_CHAMP.zone(zones[0].id, 'nonLivree') })
    }
  }
  if (d.visitesAtelier === null) champ('expedition', 'visitesAtelier', 'Visites en atelier')

  if (!d.engagementCertificat) champ('engagements', 'engagementCertificat', 'Certificat d’authenticité signé')
  if (!d.engagementEmballage) champ('engagements', 'engagementEmballage', 'Emballage conforme au guide Errancy')
  if (!d.engagementReprise) champ('engagements', 'engagementReprise', 'Reprise d’une œuvre retournée')
  return m
}

/** État des cinq sections, à partir des éléments manquants. */
export function etatSections(d: DonneesDepot, zones: readonly ZoneDepot[]): EtatSection[] {
  const manquants = elementsManquants(d, zones)
  return SECTIONS.map((s, i) => {
    const manques = manquants.filter((e) => e.section === s.id).map((e) => e.libelle)
    return { id: s.id, numero: i + 1, titre: s.titre, complet: manques.length === 0, manques }
  })
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
  | 'zone_introuvable'
  | 'depot_incomplet'

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
    case 'zone_introuvable':
      return 'Cette zone de livraison n’existe plus. Rechargez la page.'
    case 'depot_incomplet':
      return 'Il manque encore des éléments : rechargez la page pour voir la liste à jour.'
  }
}
