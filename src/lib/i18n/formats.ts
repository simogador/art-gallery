// Formats français communs (story 3.2, AD-18, AR-11) : montants, dimensions, dates et heures.
// Module pur, sans bibliothèque d'internationalisation : importable côté client comme côté serveur.
// Seul endroit de src/ qui emploie Intl.DateTimeFormat (hors Intl.DisplayNames des pays) ;
// aucun toLocaleString ailleurs. Montants en centimes entiers, dimensions en millimètres (AD-5) :
// les conversions n'ont lieu qu'ici, à l'affichage.

import type { Unite } from './unite'

/** Espace fine insécable (U+202F) : séparateur de milliers, avant « € », autour de « × », avant l'unité. */
export const ESPACE_FINE = ' '

/** Montant absent (prix non renseigné). */
export const MONTANT_ABSENT = '—'

/** Date ou heure absente ou illisible. */
export const DATE_ABSENTE = '—'

/**
 * Séparateur « · » entre deux éléments d'une ligne : espace insécable (U+00A0) avant, espace simple
 * après, pour que « · » ne commence jamais une ligne. Seul séparateur de ce genre dans l'interface.
 */
export const SEPARATEUR = '\u00a0· '

/** Fuseau par défaut des dates et heures affichées. */
export const FUSEAU_PAR_DEFAUT = 'Europe/Paris'

const SYMBOLES: Record<string, string> = { EUR: '€' }

/* ── Montants ───────────────────────────────────────────────────────────── */

function milliers(entier: number): string {
  return String(entier).replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_FINE)
}

/**
 * Centimes entiers → « 1 450 € » (U+202F entre les milliers et avant le symbole) ; centimes
 * affichés seulement s'ils existent (« 1 450,50 € »). null ou indéfini : « — ».
 */
export function formaterMontant(centimes: number | null | undefined, devise = 'EUR'): string {
  if (centimes === null || centimes === undefined || !Number.isFinite(centimes)) return MONTANT_ABSENT
  const arrondi = Math.round(centimes)
  const signe = arrondi < 0 ? '-' : ''
  const absolu = Math.abs(arrondi)
  const reste = absolu % 100
  const euros = (absolu - reste) / 100
  const nombre = reste === 0 ? milliers(euros) : `${milliers(euros)},${String(reste).padStart(2, '0')}`
  const code = devise.toUpperCase()
  return `${signe}${nombre}${ESPACE_FINE}${SYMBOLES[code] ?? code}`
}

/* ── Dimensions ─────────────────────────────────────────────────────────── */

export type MillimetresAffiches = {
  hauteurMm: number | null
  largeurMm: number | null
  profondeurMm?: number | null
}

/** Millimètres → centimètres, une décimale au plus, virgule (2946 → « 294,6 », 600 → « 60 »). */
export function enCentimetres(mm: number): string {
  const reste = mm % 10
  return reste === 0 ? String((mm - reste) / 10) : `${(mm - reste) / 10},${reste}`
}

/** Millimètres → pouces, à une décimale (sans « ,0 »), virgule (600 → « 23,6 », 610 → « 24 »). */
export function enPouces(mm: number): string {
  const dixiemes = Math.round((mm * 10) / 25.4)
  const reste = dixiemes % 10
  return reste === 0 ? String(dixiemes / 10) : `${(dixiemes - reste) / 10},${reste}`
}

const SEPARATEUR_DIMENSIONS = `${ESPACE_FINE}×${ESPACE_FINE}`

/**
 * Millimètres → « 61 × 76 cm » ou « 24 × 29,9 in » (hauteur, largeur, puis profondeur s'il y en a ;
 * U+202F autour de « × » et avant l'unité). Hauteur ou largeur absente : chaîne vide.
 */
export function formaterDimensions(d: MillimetresAffiches | null | undefined, unite: Unite = 'cm'): string {
  if (!d || d.hauteurMm === null || d.largeurMm === null) return ''
  const p = d.profondeurMm ?? null
  const valeurs = [d.hauteurMm, d.largeurMm, ...(p === null ? [] : [p])]
  const enUnite = unite === 'in' ? enPouces : enCentimetres
  return `${valeurs.map(enUnite).join(SEPARATEUR_DIMENSIONS)}${ESPACE_FINE}${unite}`
}

/** L'autre unité que celle choisie. */
export function autreUnite(unite: Unite): Unite {
  return unite === 'in' ? 'cm' : 'in'
}

/**
 * Fiche : les deux unités, celle choisie d'abord (« 24 × 29,9 in » puis « 61 × 76 cm »).
 * null si hauteur ou largeur manque.
 */
export function formaterDimensionsDouble(
  d: MillimetresAffiches | null | undefined,
  unite: Unite = 'cm',
): [string, string] | null {
  const choisie = formaterDimensions(d, unite)
  if (choisie === '') return null
  return [choisie, formaterDimensions(d, autreUnite(unite))]
}

/* ── Dates et heures ────────────────────────────────────────────────────── */

export type OptionsDate = {
  /** Fuseau IANA, Europe/Paris par défaut. */
  fuseau?: string
  /** « 4 novembre 2026 » (long, par défaut) ou « 4 nov. 2026 » (court). */
  mois?: 'long' | 'court'
  /** Année affichée (par défaut oui). */
  annee?: boolean
}

/** Date lisible, ou null (date invalide, texte illisible) : jamais d'exception d'Intl. */
function dateValide(date: Date | string | null | undefined): Date | null {
  if (date === null || date === undefined) return null
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Mise en forme d'Intl, ou null si le fuseau est inconnu (RangeError). */
function intl(d: Date, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatPart[] | null {
  try {
    return new Intl.DateTimeFormat('fr-FR', options).formatToParts(d)
  } catch {
    return null
  }
}

/** « 4 novembre 2026 » (ou « 4 nov. 2026 »), dans le fuseau demandé (Europe/Paris par défaut) ; « — » si illisible. */
export function formaterDate(date: Date | string | null | undefined, options: OptionsDate = {}): string {
  const { fuseau = FUSEAU_PAR_DEFAUT, mois = 'long', annee = true } = options
  const d = dateValide(date)
  const lu = d && intl(d, {
    day: 'numeric',
    month: mois === 'court' ? 'short' : 'long',
    ...(annee ? { year: 'numeric' as const } : {}),
    timeZone: fuseau,
  })
  return lu ? lu.map((p) => p.value).join('') : DATE_ABSENTE
}

/** « 15 h 42 », « 9 h 05 » : 24 heures, dans le fuseau demandé (Europe/Paris par défaut) ; « — » si illisible. */
export function formaterHeure(date: Date | string | null | undefined, fuseau: string = FUSEAU_PAR_DEFAUT): string {
  const d = dateValide(date)
  const lu = d && intl(d, { hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone: fuseau })
  if (!lu) return DATE_ABSENTE
  const partie = (type: Intl.DateTimeFormatPartTypes) => lu.find((p) => p.type === type)?.value ?? ''
  return `${Number(partie('hour'))} h ${partie('minute')}`
}

/** « 4 novembre 2026 à 15 h 42 » (options de formaterDate ; même fuseau) ; « — » si illisible. */
export function formaterDateHeure(date: Date | string | null | undefined, options: OptionsDate = {}): string {
  const jour = formaterDate(date, options)
  const heure = formaterHeure(date, options.fuseau)
  return jour === DATE_ABSENTE || heure === DATE_ABSENTE ? DATE_ABSENTE : `${jour} à ${heure}`
}
