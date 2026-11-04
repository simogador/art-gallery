import type { Prisma } from '@/generated/prisma/client'

// Module disponibilite (AD-6, AD-7, story 2.2) : partie pure, sans accès à la base.
// Seule définition de « visible » et de « disponible », en prédicat (objet déjà lu) et en
// fragment de requête Prisma (filtre en base). Importable par un composant client
// (via catalogue/mappers) : n'importer ici que des types depuis Prisma.

export type Publication = 'brouillon' | 'en_curation' | 'publiee'
export type Disponibilite = 'disponible' | 'reservee' | 'vendue' | 'vendue_ailleurs' | 'retiree'

/** Les deux axes d'une œuvre. Colonnes vides (œuvre pas encore recopiée) : ni visible ni disponible. */
export type EtatOeuvre = { publication: Publication | null; disponibilite: Disponibilite | null }

/** Fragment de `select` : les colonnes nécessaires aux prédicats ci-dessous. */
export const CHAMPS_ETAT = { publication: true, disponibilite: true } as const

/**
 * Artiste dont les œuvres peuvent être visibles (FR-16, story 2.9) : accord écrit signé enregistré
 * (`accordSigneLe`) et fiche active. Sans accord (catalogue de démonstration, accord effacé), aucune
 * de ses œuvres n'est visible, quel que soit leur état.
 */
export type ArtisteAccord = { accordSigneLe: Date | null; active: boolean }

/** Fragment de `select` de l'artiste : les colonnes nécessaires à estVisible. */
export const CHAMPS_ARTISTE_ACCORD = { accordSigneLe: true, active: true } as const

/** Fragment de requête sur l'artiste : accord signé et fiche active. */
export const ARTISTE_ACCORD = {
  accordSigneLe: { not: null },
  active: true,
} satisfies Prisma.ArtistWhereInput

/**
 * Visible : publiée, non retirée, et son artiste a un accord signé et est actif (story 2.9).
 * Les colonnes vides ne sont jamais visibles.
 */
export const VISIBLE = {
  publication: 'publiee',
  disponibilite: { in: ['disponible', 'reservee', 'vendue', 'vendue_ailleurs'] },
  artist: ARTISTE_ACCORD,
} satisfies Prisma.ArtworkWhereInput

/** Artiste visible publiquement (liste, page, accueil) : accord signé, actif, au moins une œuvre visible. */
export const ARTISTE_VISIBLE = {
  ...ARTISTE_ACCORD,
  artworks: { some: VISIBLE },
} satisfies Prisma.ArtistWhereInput

/** Exposition visible publiquement : au moins une œuvre visible. */
export const EXPOSITION_VISIBLE = {
  artworks: { some: { artwork: VISIBLE } },
} satisfies Prisma.ExhibitionWhereInput

/** Disponible : publiée et disponible à la vente. */
export const DISPONIBLE = {
  publication: 'publiee',
  disponibilite: 'disponible',
} satisfies Prisma.ArtworkWhereInput

/** Retirée de la vente après publication : sa fiche redirige vers la page de l'artiste. */
export const RETIREE = {
  publication: 'publiee',
  disponibilite: 'retiree',
} satisfies Prisma.ArtworkWhereInput

/** Vendue (par Errancy ou marquée vendue par l'équipe) : chiffre d'affaires et comptages. */
export const VENDUE = { disponibilite: 'vendue' } satisfies Prisma.ArtworkWhereInput

/** En curation (axe publication seul) : file de l'équipe (story 2.7). */
export const EN_CURATION = { publication: 'en_curation' } satisfies Prisma.ArtworkWhereInput

/** Publiée (axe publication seul) : comptages de l'administration. */
export const PUBLIEE = { publication: 'publiee' } satisfies Prisma.ArtworkWhereInput

/** Accord signé enregistré et fiche active : condition d'artiste de « visible » (story 2.9). */
export function aUnAccord(a: ArtisteAccord): boolean {
  return a.accordSigneLe !== null && a.active
}

/** Visible : publiée, non retirée, artiste avec accord signé et actif (même règle que VISIBLE). */
export function estVisible(e: EtatOeuvre & { artist: ArtisteAccord }): boolean {
  return e.publication === 'publiee' && e.disponibilite !== null && e.disponibilite !== 'retiree' && aUnAccord(e.artist)
}

export function estDisponible(e: EtatOeuvre): boolean {
  return e.publication === 'publiee' && e.disponibilite === 'disponible'
}

export function estVendue(e: EtatOeuvre): boolean {
  return e.disponibilite === 'vendue'
}

/** Axe publication seul (bascule « Publiée / Brouillon » de l'administration). */
export function estPubliee(e: EtatOeuvre): boolean {
  return e.publication === 'publiee'
}

/** Brouillon (axe publication seul) : seul état où l'artiste modifie son dépôt (story 2.5). */
export function estBrouillon(e: EtatOeuvre): boolean {
  return e.publication === 'brouillon'
}

/** En curation (axe publication seul) : envoyée par l'artiste, en attente de l'équipe (story 2.6). */
export function estEnCuration(e: EtatOeuvre): boolean {
  return e.publication === 'en_curation'
}

/** Axe disponibilité seul (bascule « Disponible / Vendue » de l'administration), quelle que soit la publication. */
export function estMarqueeDisponible(e: EtatOeuvre): boolean {
  return e.disponibilite === 'disponible'
}

/** Œuvre dont un des axes est encore vide (pas encore recopiée) : aucune écriture d'un seul axe. */
export function estRecopiee(e: EtatOeuvre): boolean {
  return e.publication !== null && e.disponibilite !== null
}

/** Bascule admin « Disponible / Vendue » possible seulement entre ces deux états ; les autres
 * (réservée, vendue ailleurs, retirée) ont leur propre parcours et s'affichent en lecture seule. */
export function basculePossible(e: EtatOeuvre): boolean {
  return e.disponibilite === 'disponible' || e.disponibilite === 'vendue'
}

/** Les sept états, calculés à partir des deux axes (administration comprise). */
export type CodeEtat = 'brouillon' | 'en_curation' | Disponibilite

export const LIBELLES_ETAT: Record<CodeEtat, string> = {
  brouillon: 'Brouillon',
  en_curation: 'En curation',
  disponible: 'Disponible',
  reservee: 'Réservée',
  vendue: 'Vendue',
  vendue_ailleurs: 'Vendue ailleurs',
  retiree: 'Retirée',
}

// Colonnes vides (œuvre pas encore recopiée) : « Brouillon », puisqu'elle n'est pas visible.
export function codeEtat(e: EtatOeuvre): CodeEtat {
  if (e.publication === 'en_curation') return 'en_curation'
  if (e.publication !== 'publiee' || e.disponibilite === null) return 'brouillon'
  return e.disponibilite
}

export function libelleEtat(e: EtatOeuvre): string {
  return LIBELLES_ETAT[codeEtat(e)]
}

/** Badge de l'espace artiste (story 2.8) : une œuvre publiée et disponible s'y affiche « Publiée ». */
export function libelleEtatArtiste(e: EtatOeuvre): string {
  const code = codeEtat(e)
  return code === 'disponible' ? 'Publiée' : LIBELLES_ETAT[code]
}

// ── Story 2.8 (FR-21) : l'artiste tient la disponibilité de ses œuvres publiées ──────────────

/** Déclarations de l'artiste sur une œuvre publiée (table DeclarationDisponibilite). */
export type TypeDeclaration = 'vendue_ailleurs' | 'retiree'

export const TYPES_DECLARATION: readonly TypeDeclaration[] = ['vendue_ailleurs', 'retiree']

export function estTypeDeclaration(x: unknown): x is TypeDeclaration {
  return typeof x === 'string' && (TYPES_DECLARATION as readonly string[]).includes(x)
}

/** Libellés du choix « Changer la disponibilité ». */
export const LIBELLES_DECLARATION: Record<TypeDeclaration, string> = {
  vendue_ailleurs: 'Vendue ailleurs',
  retiree: 'Retirer de la vente',
}

/**
 * Déclarations proposées à l'artiste : seulement sur une œuvre publiée, disponible ou réservée.
 * Une œuvre vendue (par Errancy) n'en a aucune : « Écrire à l'équipe » la remplace.
 */
export function declarationsPossibles(e: EtatOeuvre): TypeDeclaration[] {
  if (e.publication !== 'publiee') return []
  if (e.disponibilite === 'disponible' || e.disponibilite === 'reservee') return [...TYPES_DECLARATION]
  return []
}

/** Œuvre vendue par Errancy : l'artiste ne la modifie pas, il écrit à l'équipe. */
export function contactEquipeSeulement(e: EtatOeuvre): boolean {
  return e.publication === 'publiee' && e.disponibilite === 'vendue'
}

/**
 * « Écrire à l'équipe » proposé à l'artiste : œuvre vendue par Errancy, ou vendue ailleurs dont la
 * déclaration ne s'annule plus (délai dépassé, réservation interrompue) — seule l'équipe la rouvre.
 */
export function ecrireAEquipe(etat: CodeEtat, annulable: boolean): boolean {
  return etat === 'vendue' || (etat === 'vendue_ailleurs' && !annulable)
}

/** « Remettre en vente » : seulement une œuvre publiée puis retirée (elle repasse en curation). */
export function remiseEnVentePossible(e: EtatOeuvre): boolean {
  return e.publication === 'publiee' && e.disponibilite === 'retiree'
}

export type DeclarationLue = {
  type: TypeDeclaration
  le: Date
  reservationInterrompue: boolean
  annuleeLe: Date | null
}

/**
 * « Annuler » une déclaration possible (refus `transition_interdite`) : non annulée, sans
 * réservation interrompue, et l'œuvre est toujours publiée dans l'état déclaré.
 */
export function annulationAdmise(d: DeclarationLue, e: EtatOeuvre): boolean {
  return d.annuleeLe === null && !d.reservationInterrompue && e.publication === 'publiee' && e.disponibilite === d.type
}

/** Dans le délai d'annulation (décision du porteur du 2026-11-04), sinon `delai_depasse`. */
export function dansLeDelai(d: Pick<DeclarationLue, 'le'>, maintenant: Date, delaiMinutes: number): boolean {
  return maintenant.getTime() - d.le.getTime() <= delaiMinutes * 60_000
}

/** « 10 h 12 », heure de Paris. */
export function heureLisible(date: Date): string {
  const parties = new Intl.DateTimeFormat('fr-FR', {
    hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris',
  }).formatToParts(date)
  const h = parties.find((p) => p.type === 'hour')?.value ?? ''
  const m = parties.find((p) => p.type === 'minute')?.value ?? ''
  return `${Number(h)} h ${m}`
}

/** Texte du bandeau après une déclaration : « Vendue ailleurs à 10 h 12. » */
export function messageDeclaration(type: TypeDeclaration, le: Date): string {
  const quoi = type === 'vendue_ailleurs' ? 'Vendue ailleurs' : 'Retirée de la vente'
  return `${quoi} à ${heureLisible(le)}.`
}

export type CodeRefusDisponibilite = 'acces_refuse' | 'introuvable' | 'non_recopiee' | 'transition_interdite' | 'delai_depasse'

export function messageRefusDisponibilite(code: CodeRefusDisponibilite): string {
  switch (code) {
    case 'acces_refuse':
      return 'Cette œuvre n’est pas accessible depuis votre compte.'
    case 'introuvable':
      return 'Cette œuvre n’existe plus. Rechargez la page.'
    case 'non_recopiee':
    case 'transition_interdite':
      return 'L’état de cette œuvre a changé entre-temps : rien n’a été modifié. Rechargez la page.'
    case 'delai_depasse':
      return 'Le délai d’annulation est dépassé : rien n’a été modifié. Écrivez à l’équipe, ou remettez l’œuvre en vente si elle est retirée.'
  }
}
