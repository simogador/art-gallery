import { AMBIANCES } from '@/lib/curation/depot-regles'
import { fr } from '@/lib/i18n'
import { normaliserEmail } from './email'

// Règles pures de la demande de sélection (story 4.2, FR-8) : partagées par le formulaire (validation
// à la sortie du champ) et par le serveur (qui revérifie tout). Aucun accès à la base.

export const LIMITES_SELECTION = {
  espaceMax: 1000,
  precisionMax: 1000,
  budgetMaxEuros: 1_000_000,
  telephoneChiffresMin: 6,
  telephoneChiffresMax: 15,
  telephoneLongueurMax: 40,
} as const

export type ChampSelection = 'espace' | 'ambiances' | 'precision' | 'budget' | 'email' | 'telephone'
export const CHAMPS_SELECTION: readonly ChampSelection[] = ['espace', 'ambiances', 'precision', 'budget', 'email', 'telephone']

/** Saisie telle que le formulaire la porte : que des textes. */
export type EntreeSelection = {
  espace: string
  ambiances: string[]
  precision: string
  budget: string
  email: string
  telephone: string
}

export type ValeurSelection = {
  espace: string
  ambiances: string[]
  precision: string | null
  budgetCentimes: number
  email: string
  telephone: string | null
}

export type ErreursSelection = Partial<Record<ChampSelection, string>>

// Le caractère nul n'existe pas dans un texte PostgreSQL : il ferait échouer l'enregistrement à chaque essai.
const texte = (v: unknown): string => (typeof v === 'string' ? v.replace(/\u0000/g, '') : '')

/** Rend une saisie quelconque (corps d'une requête) à la forme attendue : jamais d'exception. */
export function lireEntreeSelection(brut: unknown): EntreeSelection {
  const o = typeof brut === 'object' && brut !== null && !Array.isArray(brut) ? (brut as Record<string, unknown>) : {}
  return {
    espace: texte(o.espace),
    ambiances: Array.isArray(o.ambiances) ? o.ambiances.filter((a): a is string => typeof a === 'string').slice(0, 50) : [],
    precision: texte(o.precision),
    budget: texte(o.budget),
    email: texte(o.email),
    telephone: texte(o.telephone),
  }
}

const longueur = (t: string) => Array.from(t.normalize('NFC')).length

/** Budget en euros entiers : « 1500 », « 1 500 », « 1500 € » ; null si illisible ou nul. */
export function lireBudgetEuros(saisie: string): number | null {
  const propre = saisie.replace(/[\s  €]/g, '')
  if (!/^\d{1,9}$/.test(propre)) return null
  const euros = Number(propre)
  return euros > 0 ? euros : null
}

/** Téléphone facultatif (partagé avec la demande de visite) : null si vide, « invalide » s'il ne se lit pas. */
export function lireTelephone(saisie: string): string | null | 'invalide' {
  const propre = saisie.trim()
  if (propre === '') return null
  if (propre.length > LIMITES_SELECTION.telephoneLongueurMax || !/^[\d\s+().-]+$/.test(propre)) return 'invalide'
  const chiffres = propre.replace(/\D/g, '').length
  return chiffres >= LIMITES_SELECTION.telephoneChiffresMin && chiffres <= LIMITES_SELECTION.telephoneChiffresMax
    ? propre.replace(/\s+/g, ' ')
    : 'invalide'
}

const CODES_AMBIANCES: readonly string[] = AMBIANCES.map((a) => a.code)

/** Message d'erreur d'un champ, ou null s'il est correct. */
export function erreurChamp(champ: ChampSelection, entree: EntreeSelection): string | null {
  const e = fr.conseil.erreurs
  switch (champ) {
    case 'espace': {
      const t = entree.espace.trim()
      if (t === '') return e.espaceVide
      return longueur(t) > LIMITES_SELECTION.espaceMax ? e.espaceLong : null
    }
    case 'ambiances':
      if (entree.ambiances.length === 0) return e.ambiancesVides
      return entree.ambiances.length <= CODES_AMBIANCES.length && entree.ambiances.every((a) => CODES_AMBIANCES.includes(a))
        ? null
        : e.ambianceInconnue
    case 'precision':
      return longueur(entree.precision.trim()) > LIMITES_SELECTION.precisionMax ? e.precisionLongue : null
    case 'budget': {
      const euros = lireBudgetEuros(entree.budget)
      if (euros === null) return e.budgetInvalide
      return euros > LIMITES_SELECTION.budgetMaxEuros ? e.budgetTropGrand : null
    }
    case 'email':
      return normaliserEmail(entree.email) === null ? e.emailInvalide : null
    case 'telephone':
      return lireTelephone(entree.telephone) === 'invalide' ? e.telephoneInvalide : null
  }
}

export type ResultatValidation = { ok: true; valeur: ValeurSelection } | { ok: false; erreurs: ErreursSelection }

export function validerSelection(brut: unknown): ResultatValidation {
  const entree = lireEntreeSelection(brut)
  const erreurs: ErreursSelection = {}
  for (const champ of CHAMPS_SELECTION) {
    const message = erreurChamp(champ, entree)
    if (message) erreurs[champ] = message
  }
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs }
  const telephone = lireTelephone(entree.telephone)
  return {
    ok: true,
    valeur: {
      espace: entree.espace.trim(),
      // Dans l'ordre de la liste, sans doublon.
      ambiances: CODES_AMBIANCES.filter((code) => entree.ambiances.includes(code)),
      precision: entree.precision.trim() === '' ? null : entree.precision.trim(),
      budgetCentimes: (lireBudgetEuros(entree.budget) as number) * 100,
      email: normaliserEmail(entree.email) as string,
      telephone: telephone === 'invalide' ? null : telephone,
    },
  }
}
