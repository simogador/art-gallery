import { fr } from '@/lib/i18n'
import { normaliserEmail } from '@/lib/demandes/email'

// Règles pures des coordonnées de l'acheteur sans compte (story 6.1) : jamais de `User`. Partagées par
// le futur formulaire (6.3, 7.2) et par le serveur, qui revérifie tout. Aucun accès à la base.

export type ChampCoordonnees = 'email' | 'nom' | 'adresse' | 'telephone'
export const CHAMPS_COORDONNEES: readonly ChampCoordonnees[] = ['email', 'nom', 'adresse', 'telephone']

export const LIMITES_COORDONNEES = { nom: 120, adresse: 500, telephone: { min: 6, max: 30 } } as const

/** Saisie telle qu'elle arrive : que des textes. */
export type EntreeCoordonnees = Record<ChampCoordonnees, string>
export type ValeurCoordonnees = { email: string; nom: string; adresse: string | null; telephone: string | null }
export type ErreursCoordonnees = Partial<Record<ChampCoordonnees, string>>

// Le caractère nul n'existe pas dans un texte PostgreSQL.
const texte = (v: unknown): string => (typeof v === 'string' ? v.replace(/\u0000/g, '') : '')
const FORMAT_TELEPHONE = /^\+?[0-9 ().-]+$/

export function lireEntreeCoordonnees(brut: unknown): EntreeCoordonnees {
  const o = typeof brut === 'object' && brut !== null && !Array.isArray(brut) ? (brut as Record<string, unknown>) : {}
  return { email: texte(o.email), nom: texte(o.nom), adresse: texte(o.adresse), telephone: texte(o.telephone) }
}

/** Message d'erreur d'un champ, ou null s'il est correct (adresse et téléphone sont facultatifs). */
export function erreurChampCoordonnees(champ: ChampCoordonnees, entree: EntreeCoordonnees): string | null {
  const e = fr.commandes.erreurs
  switch (champ) {
    case 'email':
      return normaliserEmail(entree.email) === null ? e.emailInvalide : null
    case 'nom': {
      const nom = entree.nom.trim()
      if (nom === '') return e.nomManquant
      return nom.length > LIMITES_COORDONNEES.nom ? e.nomTropLong(LIMITES_COORDONNEES.nom) : null
    }
    case 'adresse':
      return entree.adresse.trim().length > LIMITES_COORDONNEES.adresse ? e.adresseTropLongue(LIMITES_COORDONNEES.adresse) : null
    case 'telephone': {
      const t = entree.telephone.trim()
      if (t === '') return null
      const chiffres = t.replace(/\D/g, '').length
      const ok =
        FORMAT_TELEPHONE.test(t) && t.length <= LIMITES_COORDONNEES.telephone.max && chiffres >= LIMITES_COORDONNEES.telephone.min
      return ok ? null : e.telephoneInvalide
    }
  }
}

export type ResultatValidationCoordonnees =
  | { ok: true; valeur: ValeurCoordonnees }
  | { ok: false; erreurs: ErreursCoordonnees }

export function validerCoordonnees(brut: unknown): ResultatValidationCoordonnees {
  const entree = lireEntreeCoordonnees(brut)
  const erreurs: ErreursCoordonnees = {}
  for (const champ of CHAMPS_COORDONNEES) {
    const message = erreurChampCoordonnees(champ, entree)
    if (message) erreurs[champ] = message
  }
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs }
  return {
    ok: true,
    valeur: {
      email: normaliserEmail(entree.email) as string,
      nom: entree.nom.normalize('NFC').trim().replace(/\s+/g, ' '),
      adresse: entree.adresse.trim() === '' ? null : entree.adresse.normalize('NFC').trim(),
      telephone: entree.telephone.trim() === '' ? null : entree.telephone.trim(),
    },
  }
}
