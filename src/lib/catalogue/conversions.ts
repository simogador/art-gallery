// Conversions exactes du prix et des dimensions (AD-5, AD-20, story 2.1).
// Module pur : aucun accès à la base, utilisable côté client comme côté serveur.
// Story 3.2 : la mise en forme à l'affichage passe par src/lib/i18n (formaterDimensions délègue).
// Story 2.10 : les anciennes colonnes `price` et `dimensions` ont disparu ; seules les colonnes
// exactes (prixCentimes, devise, hauteurMm, largeurMm, profondeurMm) sont écrites.

import { enCentimetres, formaterDimensions as formaterDimensionsI18n } from '@/lib/i18n/formats'

export const DEVISE = 'EUR'

// Plus grand entier d'une colonne PostgreSQL INTEGER.
const ENTIER_MAX = 2_147_483_647

export const EXEMPLE_DIMENSIONS = '120 × 80 cm'

export const MESSAGE_DIMENSIONS_ILLISIBLES =
  `Dimensions illisibles : indiquez la hauteur puis la largeur (et la profondeur si besoin), suivies de l’unité, par exemple « ${EXEMPLE_DIMENSIONS} ».`

export const MESSAGE_PRIX_INVALIDE =
  'Prix invalide : indiquez un montant positif en euros, avec au plus deux décimales (par exemple « 1 250,50 »).'

export type Dimensions = {
  hauteurMm: number
  largeurMm: number
  profondeurMm: number | null
}

export type DimensionsEnBase = {
  hauteurMm: number | null
  largeurMm: number | null
  profondeurMm: number | null
}

/* ── Prix ───────────────────────────────────────────────────────────────── */

// Espaces ignorés (y compris insécables U+00A0 et fines U+202F, que produit formaterMontant).
const ESPACES = /[ \t\u00a0\u202f]/g

export type PrixLu = { ok: true; centimes: number | null } | { ok: false }

// Saisie d'un prix en euros → centimes entiers, sans passer par un Float.
// Vide, null ou zéro : pas de prix (comme l'ancien formulaire). Virgule ou point décimal,
// au plus deux décimales, jamais négatif.
export function prixEnCentimes(saisie: unknown): PrixLu {
  if (saisie === null || saisie === undefined) return { ok: true, centimes: null }
  let texte: string
  if (typeof saisie === 'number') {
    if (!Number.isFinite(saisie)) return { ok: false }
    texte = String(saisie)
  } else if (typeof saisie === 'string') {
    texte = saisie
  } else {
    return { ok: false }
  }
  texte = texte.replace(ESPACES, '').replace(',', '.')
  if (texte === '') return { ok: true, centimes: null }

  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(texte)
  if (!m) return { ok: false }
  const centimes = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
  if (!Number.isSafeInteger(centimes) || centimes > ENTIER_MAX) return { ok: false }
  return { ok: true, centimes: centimes === 0 ? null : centimes }
}

// Centimes → euros (type d'affichage `price`) ; l'affichage passe par formaterMontant (i18n).
export function centimesEnEuros(centimes: number | null | undefined): number | null {
  return centimes === null || centimes === undefined ? null : centimes / 100
}

/* ── Dimensions ─────────────────────────────────────────────────────────── */

// Nombres séparés par x, X ou × (2 ou 3), virgule ou point décimal, unité cm ou mm finale
// obligatoire, espaces libres. Aucun autre texte. Hauteur, puis largeur, puis profondeur.
const S = '[ \\t\\u00a0\\u202f]*'
const N = '([0-9]{1,6}(?:[.,][0-9]+)?)'
const X = `${S}[xX×]${S}`
export const MOTIF_DIMENSIONS = `^${S}${N}${X}${N}(?:${X}${N})?${S}(cm|mm)${S}$`
const REGEX_DIMENSIONS = new RegExp(MOTIF_DIMENSIONS)

// Nombre décimal (texte) × 10^decalage, arrondi à l'entier (moitié vers le haut), sans Float.
function versMillimetres(nombre: string, decalage: number): number {
  const [entier, fraction = ''] = nombre.replace(',', '.').split('.')
  const chiffres = fraction.padEnd(decalage + 1, '0')
  const base = Number(entier + chiffres.slice(0, decalage))
  return chiffres[decalage] >= '5' ? base + 1 : base
}

// Texte libre → millimètres entiers, ou null si illisible : jamais deviné.
export function lireDimensions(texte: string | null | undefined): Dimensions | null {
  if (!texte) return null
  const m = REGEX_DIMENSIONS.exec(texte)
  if (!m) return null
  const decalage = m[4] === 'cm' ? 1 : 0
  const [hauteurMm, largeurMm] = [versMillimetres(m[1], decalage), versMillimetres(m[2], decalage)]
  const profondeurMm = m[3] === undefined ? null : versMillimetres(m[3], decalage)
  if (hauteurMm < 1 || largeurMm < 1 || (profondeurMm !== null && profondeurMm < 1)) return null
  return { hauteurMm, largeurMm, profondeurMm }
}

// Millimètres → « 120 × 90 cm » (ou « 45 × 30 × 28 cm »), en centimètres, espaces fines
// insécables (U+202F) : délègue à formaterDimensions de i18n. Vide sans hauteur ni largeur.
// Ce texte prérempli les formulaires d'édition et se relit à l'identique (lireDimensions).
export function formaterDimensions(d: DimensionsEnBase | null | undefined): string {
  return formaterDimensionsI18n(d, 'cm')
}

// Espaces normalisés pour comparer un texte posté au texte prérempli (U+202F, U+00A0, espaces multiples).
const normaliserEspaces = (texte: string) => texte.replace(/[\s\u00a0\u202f]+/g, ' ').trim()

/* ── Saisie du formulaire (colonnes exactes seulement, story 2.10) ──────── */

export type ChampsPrix = { prixCentimes: number | null; devise: string }
export type ChampsDimensions = DimensionsEnBase

export type SaisieLue<T> = { ok: true; champs: T } | { ok: false; erreur: string }

// Prix saisi → colonnes exactes (centimes, devise).
export function champsPrix(saisie: unknown): SaisieLue<ChampsPrix> {
  const lu = prixEnCentimes(saisie)
  if (!lu.ok) return { ok: false, erreur: MESSAGE_PRIX_INVALIDE }
  return { ok: true, champs: { prixCentimes: lu.centimes, devise: DEVISE } }
}

// Dimensions saisies (« 120 × 80 cm ») → millimètres. Vide : aucune dimension.
export function champsDimensions(saisie: unknown): SaisieLue<ChampsDimensions> {
  if (saisie !== null && saisie !== undefined && typeof saisie !== 'string') {
    return { ok: false, erreur: MESSAGE_DIMENSIONS_ILLISIBLES }
  }
  const texte = (saisie ?? '').trim()
  if (texte === '') {
    return { ok: true, champs: { hauteurMm: null, largeurMm: null, profondeurMm: null } }
  }
  const d = lireDimensions(texte)
  if (!d) return { ok: false, erreur: MESSAGE_DIMENSIONS_ILLISIBLES }
  return { ok: true, champs: d }
}

// Modification (routes PUT d'édition) : le formulaire est prérempli avec formaterDimensions des
// millimètres en base. Ce texte renvoyé tel quel (aux espaces près) laisse les trois colonnes intactes : une œuvre aux
// dimensions partielles (hauteur seule, préremplie vide) ne perd pas les autres à l'enregistrement.
export function champsDimensionsModifiees(
  saisie: unknown,
  enBase: DimensionsEnBase,
): SaisieLue<ChampsDimensions | Record<string, never>> {
  if (typeof saisie === 'string' && normaliserEspaces(saisie) === normaliserEspaces(formaterDimensions(enBase))) {
    return { ok: true, champs: {} }
  }
  return champsDimensions(saisie)
}

/* ── Dimensions saisies en centimètres, champ par champ (story 2.5) ────── */

const REGEX_CM = new RegExp(`^${S}${N}${S}$`)

// Une dimension saisie en centimètres (« 60 », « 31,5 ») → millimètres entiers, arrondis comme
// lireDimensions. Vide : null ; illisible (texte, signe moins…) : 'illisible'. L'appelant vérifie les bornes.
export function centimetresEnMillimetres(saisie: unknown): number | null | 'illisible' {
  if (saisie === null || saisie === undefined) return null
  if (typeof saisie !== 'string') return 'illisible'
  if (saisie.trim() === '') return null
  const m = REGEX_CM.exec(saisie)
  return m ? versMillimetres(m[1], 1) : 'illisible'
}

// Millimètres → centimètres affichés dans un champ de saisie (« 31,5 »), vide si null.
export function millimetresEnCentimetres(mm: number | null | undefined): string {
  return mm === null || mm === undefined ? '' : enCentimetres(mm)
}
