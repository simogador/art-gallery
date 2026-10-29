// Conversions exactes du prix et des dimensions (AD-5, AD-20, story 2.1).
// Module pur : aucun accès à la base, utilisable côté client comme côté serveur.
// La lecture des dimensions suit exactement les règles de scripts/sql/recopie-prix-dimensions.sql ;
// tests/catalogue.test.ts vérifie l'accord des deux.

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

// Espaces ignorés (y compris insécables, que produit toLocaleString('fr-FR')).
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

// Centimes → euros, pour l'affichage (formatPrice) et l'ancienne colonne price.
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

function enCentimetres(mm: number): string {
  const reste = mm % 10
  return reste === 0 ? String((mm - reste) / 10) : `${(mm - reste) / 10},${reste}`
}

// Millimètres → « 120 × 90 cm » (ou « 45 × 30 × 28 cm »). Vide sans hauteur ni largeur.
export function formaterDimensions(d: DimensionsEnBase | null | undefined): string {
  if (!d || d.hauteurMm === null || d.largeurMm === null) return ''
  const valeurs = [d.hauteurMm, d.largeurMm, ...(d.profondeurMm === null ? [] : [d.profondeurMm])]
  return `${valeurs.map(enCentimetres).join(' × ')} cm`
}

/* ── Saisie du formulaire (double écriture, AD-20 temps 1 à 3) ─────────── */

// Modification : un texte renvoyé tel quel alors qu'il est illisible (ancienne valeur préremplie)
// laisse toutes les colonnes de dimensions intactes, pour pouvoir modifier les autres champs.
// Un nouveau texte illisible reste refusé.
export function champsDimensionsModifiees(
  saisie: unknown,
  texteEnBase: string,
): SaisieLue<ChampsDimensions | Record<string, never>> {
  const lu = champsDimensions(saisie)
  if (!lu.ok && typeof saisie === 'string' && saisie.trim() === texteEnBase.trim()) {
    return { ok: true, champs: {} }
  }
  return lu
}

export type ChampsPrix = { price: number | null; prixCentimes: number | null; devise: string }
export type ChampsDimensions = {
  dimensions: string
  hauteurMm: number | null
  largeurMm: number | null
  profondeurMm: number | null
}

export type SaisieLue<T> = { ok: true; champs: T } | { ok: false; erreur: string }

// Prix saisi → anciennes et nouvelles colonnes, cohérentes.
export function champsPrix(saisie: unknown): SaisieLue<ChampsPrix> {
  const lu = prixEnCentimes(saisie)
  if (!lu.ok) return { ok: false, erreur: MESSAGE_PRIX_INVALIDE }
  return { ok: true, champs: { price: centimesEnEuros(lu.centimes), prixCentimes: lu.centimes, devise: DEVISE } }
}

// Dimensions saisies → anciennes et nouvelles colonnes. Vide : aucune dimension.
export function champsDimensions(saisie: unknown): SaisieLue<ChampsDimensions> {
  if (saisie !== null && saisie !== undefined && typeof saisie !== 'string') {
    return { ok: false, erreur: MESSAGE_DIMENSIONS_ILLISIBLES }
  }
  const texte = (saisie ?? '').trim()
  if (texte === '') {
    return { ok: true, champs: { dimensions: '', hauteurMm: null, largeurMm: null, profondeurMm: null } }
  }
  const d = lireDimensions(texte)
  if (!d) return { ok: false, erreur: MESSAGE_DIMENSIONS_ILLISIBLES }
  // L'ancienne colonne reçoit le texte normalisé, relu à l'identique par lireDimensions.
  return { ok: true, champs: { dimensions: formaterDimensions(d), ...d } }
}
