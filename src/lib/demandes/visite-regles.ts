import { fr, fuseauValide, heureMuraleEnUtc } from '@/lib/i18n'
import { normaliserEmail } from './email'
import { lireTelephone } from './selection-regles'

// Règles pures de la demande de visite (story 4.3, FR-8) : partagées par le formulaire (validation à
// la sortie du champ) et par le serveur (qui revérifie tout). Aucun accès à la base. Les créneaux
// sont saisis en heures « murales » dans le fuseau de l'appareil (champ `datetime-local`), convertis
// en UTC avec ce fuseau ; jamais le fuseau de Paris imposé (UXQ-10).

export const LIMITES_VISITE = {
  creneauxMin: 2,
  creneauxMax: 3,
  /** Un créneau à plus de 90 jours est refusé. */
  horizonJours: 90,
  /** Champs de créneau lus au plus (le formulaire en a trois). */
  creneauxLus: 10,
} as const

export const TYPES_VISITE = ['distance', 'atelier'] as const
export type TypeVisite = (typeof TYPES_VISITE)[number]

export type ChampVisite = 'type' | 'creneaux' | 'email' | 'telephone'
export const CHAMPS_VISITE: readonly ChampVisite[] = ['type', 'creneaux', 'email', 'telephone']

/** Saisie telle que le formulaire la porte : que des textes. */
export type EntreeVisite = {
  type: string
  /** Heures murales « AAAA-MM-JJTHH:MM » ; les champs vides sont ignorés. */
  creneaux: string[]
  /** Fuseau IANA de l'appareil. */
  fuseau: string
  email: string
  telephone: string
}

/** Ce que l'œuvre permet, et l'instant de référence (« dans le futur », « à 90 jours au plus »). */
export type ContexteVisite = { atelierAccepte: boolean; maintenant: Date }

export type ValeurVisite = {
  type: TypeVisite
  /** Instants UTC, dans l'ordre de saisie. */
  creneaux: Date[]
  fuseau: string
  email: string
  telephone: string | null
}

export type ErreursVisite = Partial<Record<ChampVisite, string>>

// Le caractère nul n'existe pas dans un texte PostgreSQL.
const texte = (v: unknown): string => (typeof v === 'string' ? v.replace(/\u0000/g, '') : '')

/** Rend une saisie quelconque (corps d'une requête) à la forme attendue : jamais d'exception. */
export function lireEntreeVisite(brut: unknown): EntreeVisite {
  const o = typeof brut === 'object' && brut !== null && !Array.isArray(brut) ? (brut as Record<string, unknown>) : {}
  return {
    type: texte(o.type),
    creneaux: Array.isArray(o.creneaux) ? o.creneaux.slice(0, LIMITES_VISITE.creneauxLus).map(texte) : [],
    fuseau: texte(o.fuseau),
    email: texte(o.email),
    telephone: texte(o.telephone),
  }
}

/** Les créneaux renseignés (champs non vides). */
export function creneauxSaisis(entree: EntreeVisite): string[] {
  return entree.creneaux.map((c) => c.trim()).filter((c) => c !== '')
}

/** Créneaux convertis en UTC, ou le message d'erreur du groupe. */
function lireCreneaux(entree: EntreeVisite, maintenant: Date): Date[] | string {
  const e = fr.visite.erreurs
  if (!fuseauValide(entree.fuseau)) return e.fuseauInconnu
  const saisis = creneauxSaisis(entree)
  if (saisis.length < LIMITES_VISITE.creneauxMin) return e.creneauxPeu(LIMITES_VISITE.creneauxMin)
  if (saisis.length > LIMITES_VISITE.creneauxMax) return e.creneauxTrop(LIMITES_VISITE.creneauxMax)
  const instants = saisis.map((c) => heureMuraleEnUtc(c, entree.fuseau))
  if (instants.some((d) => d === null)) return e.creneauIllisible
  const dates = instants as Date[]
  const limite = maintenant.getTime() + LIMITES_VISITE.horizonJours * 24 * 3_600_000
  if (dates.some((d) => d.getTime() <= maintenant.getTime())) return e.creneauPasse
  if (dates.some((d) => d.getTime() > limite)) return e.creneauLointain(LIMITES_VISITE.horizonJours)
  if (new Set(dates.map((d) => d.getTime())).size !== dates.length) return e.creneauxIdentiques
  return dates
}

/** Message d'erreur d'un champ, ou null s'il est correct. */
export function erreurChampVisite(champ: ChampVisite, entree: EntreeVisite, contexte: ContexteVisite): string | null {
  const e = fr.visite.erreurs
  switch (champ) {
    case 'type':
      if (entree.type === 'distance') return null
      if (entree.type === 'atelier') return contexte.atelierAccepte ? null : e.atelierIndisponible
      return e.typeVide
    case 'creneaux': {
      const lu = lireCreneaux(entree, contexte.maintenant)
      return typeof lu === 'string' ? lu : null
    }
    case 'email':
      return normaliserEmail(entree.email) === null ? e.emailInvalide : null
    case 'telephone':
      return lireTelephone(entree.telephone) === 'invalide' ? e.telephoneInvalide : null
  }
}

export type ResultatValidationVisite = { ok: true; valeur: ValeurVisite } | { ok: false; erreurs: ErreursVisite }

export function validerVisite(brut: unknown, contexte: ContexteVisite): ResultatValidationVisite {
  const entree = lireEntreeVisite(brut)
  const erreurs: ErreursVisite = {}
  for (const champ of CHAMPS_VISITE) {
    const message = erreurChampVisite(champ, entree, contexte)
    if (message) erreurs[champ] = message
  }
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs }
  const telephone = lireTelephone(entree.telephone)
  return {
    ok: true,
    valeur: {
      type: entree.type as TypeVisite,
      creneaux: lireCreneaux(entree, contexte.maintenant) as Date[],
      fuseau: entree.fuseau,
      email: normaliserEmail(entree.email) as string,
      telephone: telephone === 'invalide' ? null : telephone,
    },
  }
}
