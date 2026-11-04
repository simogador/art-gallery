import { longueur } from './depot-regles'

// Curation par l'équipe (story 2.7, FR-25, FR-16) : règles pures, sans accès à la base.
// Partagées par les écrans d'administration (composants client) et par le module curation
// (serveur), qui revalide toujours à la frontière.

/* ── Liste de contrôle ──────────────────────────────────────────────────── */

/** Les quatre points relus par l'équipe ; « Valider » exige les quatre (décision du porteur, 2026-11-04). */
export const CONTROLES_CURATION = [
  { code: 'photos', libelle: 'Photos requises : de face à la lumière du jour, gros plan, mise en situation avec repère d’échelle' },
  { code: 'couleurs', libelle: 'Fidélité des couleurs' },
  { code: 'champs', libelle: 'Champs complets' },
  { code: 'prix_zones', libelle: 'Cohérence du prix et des zones' },
] as const

export type CodeControle = (typeof CONTROLES_CURATION)[number]['code']

const CODES_CONTROLE: readonly string[] = CONTROLES_CURATION.map((c) => c.code)

/** Codes cochés reconnus, dédoublonnés, dans l'ordre de la liste ; toute autre valeur est ignorée. */
export function controlesCoches(saisie: unknown): CodeControle[] {
  const valeurs = Array.isArray(saisie) ? saisie.filter((v): v is string => typeof v === 'string') : []
  return CONTROLES_CURATION.map((c) => c.code).filter((code) => valeurs.includes(code))
}

export function controleComplet(coches: readonly string[]): boolean {
  return CODES_CONTROLE.every((code) => coches.includes(code))
}

/* ── Commentaire de renvoi ──────────────────────────────────────────────── */

export const LIMITES_COMMENTAIRE = { min: 10, max: 1000 } as const

export type CommentaireLu = { ok: true; commentaire: string } | { ok: false; erreur: string }

/** Commentaire obligatoire du renvoi à l'artiste : 10 à 1 000 caractères, espaces de bord retirés. */
export function validerCommentaire(saisie: unknown): CommentaireLu {
  // Normalisé (NFC) : la longueur comptée ici est celle que vérifie la contrainte CHECK en base.
  const texte = typeof saisie === 'string' ? saisie.normalize('NFC').trim() : ''
  const n = longueur(texte)
  if (n === 0) return { ok: false, erreur: 'Écrivez à l’artiste ce qu’il doit corriger.' }
  if (n < LIMITES_COMMENTAIRE.min) {
    return { ok: false, erreur: `Le commentaire doit faire au moins ${LIMITES_COMMENTAIRE.min} caractères.` }
  }
  if (n > LIMITES_COMMENTAIRE.max) {
    return { ok: false, erreur: `Le commentaire doit faire au plus 1 000 caractères (${n} actuellement).` }
  }
  return { ok: true, commentaire: texte }
}

/* ── Accord écrit signé ─────────────────────────────────────────────────── */

export type DateAccordLue = { ok: true; date: Date | null } | { ok: false; erreur: string }

const ANNEE_MIN_ACCORD = 2000

// « Aujourd'hui » le plus tardif de la planète (UTC+14) : une signature datée du jour, où que
// soit l'artiste, n'est jamais prise pour une date future.
function aujourdhuiLePlusTard(maintenant: Date): string {
  return new Date(maintenant.getTime() + 14 * 3_600_000).toISOString().slice(0, 10)
}

/**
 * Date de signature saisie (`AAAA-MM-JJ`, champ date du navigateur) : date à minuit UTC, ou null
 * pour effacer (saisie vide). Refus : date illisible, antérieure à 2000 ou future.
 */
export function validerDateAccord(saisie: unknown, maintenant: Date = new Date()): DateAccordLue {
  const illisible = { ok: false, erreur: 'Date illisible : choisissez une date (jour, mois, année).' } as const
  if (saisie == null) return { ok: true, date: null }
  if (typeof saisie !== 'string') return illisible
  const texte = saisie.trim()
  if (texte === '') return { ok: true, date: null }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texte)
  if (!m) return illisible
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(annee, mois - 1, jour))
  if (date.getUTCFullYear() !== annee || date.getUTCMonth() !== mois - 1 || date.getUTCDate() !== jour) return illisible
  if (annee < ANNEE_MIN_ACCORD) return { ok: false, erreur: `Date illisible : choisissez une date à partir de ${ANNEE_MIN_ACCORD}.` }
  if (texte > aujourdhuiLePlusTard(maintenant)) return { ok: false, erreur: 'La date de signature ne peut pas être dans le futur.' }
  return { ok: true, date }
}

/** « 4 novembre 2026 » : date de signature (colonne DATE, lue à minuit UTC, même jour à Paris). */
export function dateAccordLisible(date: Date | string): string {
  return dateLisible(date)
}

/** Valeur du champ date (`AAAA-MM-JJ`) pour une date enregistrée. */
export function dateAccordEnSaisie(date: Date | string | null): string {
  return date ? new Date(date).toISOString().slice(0, 10) : ''
}

export function mentionAccord(date: Date | string | null): string {
  return date ? `Accord signé le ${dateAccordLisible(date)}` : 'Accord non signé'
}

/* ── Bascule admin historique « Publiée / Brouillon » ──────────────────── */

/** Ce que la bascule admin doit savoir d'une œuvre avant de la publier (story 2.7). */
export type EtatPublicationManuelle = {
  enCuration: boolean
  accordSigne: boolean
  /** L'œuvre est passée par le dépôt : envoyée en curation, décision de l'équipe ou photo de dépôt. */
  parcoursDepot: boolean
  derniereDecision: 'valider' | 'renvoyer' | null
}

/**
 * Refus de publier par la bascule admin, ou null si elle le peut. Une œuvre en curation, ou passée
 * par le dépôt sans avoir été validée en dernier lieu, ne se publie que par la file de curation
 * (`transition_interdite`) ; sans accord signé de l'artiste, rien ne se publie (`accord_absent`).
 * Dépublier reste toujours possible (hors curation).
 */
export function refusPublicationManuelle(e: EtatPublicationManuelle): 'transition_interdite' | 'accord_absent' | null {
  if (e.enCuration) return 'transition_interdite'
  if (e.parcoursDepot && e.derniereDecision !== 'valider') return 'transition_interdite'
  if (!e.accordSigne) return 'accord_absent'
  return null
}

/* ── Dates des écrans de curation ───────────────────────────────────────── */

/** « 4 novembre 2026 », à l'heure de Paris : seule mise en forme des dates des écrans de curation et de dépôt. */
export function dateLisible(date: Date | string): string {
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
}

/* ── Refus ──────────────────────────────────────────────────────────────── */

export type CodeRefusCuration =
  | 'acces_refuse'
  | 'introuvable'
  | 'transition_interdite'
  | 'accord_absent'
  | 'controle_incomplet'
  | 'commentaire_invalide'
  | 'date_invalide'
  | 'indisponible'

export function messageRefusCuration(code: CodeRefusCuration): string {
  switch (code) {
    case 'acces_refuse':
      return 'Réservé à l’équipe Errancy.'
    case 'introuvable':
      return 'Cette œuvre ou cet artiste n’existe plus. Rechargez la page.'
    case 'transition_interdite':
      return 'Cette œuvre n’est plus en curation : une décision a déjà été prise. Rechargez la page.'
    case 'accord_absent':
      return 'L’artiste n’a pas d’accord écrit signé enregistré : enregistrez la date de signature sur la page Artistes avant de valider.'
    case 'controle_incomplet':
      return 'Cochez les quatre points de la liste de contrôle avant de valider.'
    case 'commentaire_invalide':
      return 'Commentaire refusé : vérifiez votre saisie.'
    case 'date_invalide':
      return 'Date refusée : vérifiez votre saisie.'
    case 'indisponible':
      return 'Cette œuvre n’est plus disponible à la vente (réservée, vendue ou retirée) : elle ne peut pas être publiée. Écrivez à l’artiste.'
  }
}
