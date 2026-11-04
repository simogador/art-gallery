import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import type { Acteur } from '@/lib/acces'
import { DELAI_ANNULATION_DECLARATION_MINUTES } from '@/lib/reglages'
import {
  annulationAdmise,
  basculePossible,
  champAvailable,
  dansLeDelai,
  declarationsPossibles,
  DISPONIBLE,
  estRecopiee,
  estTypeDeclaration,
  PUBLIEE,
  VENDUE,
  type CodeRefusDisponibilite,
  type DeclarationLue,
  type Disponibilite,
  type EtatOeuvre,
  type Publication,
  type TypeDeclaration,
} from './etats'

// Module disponibilite (AD-6, AD-7, story 2.2) : seul module qui écrit l'axe disponibilité
// (`disponibilite`) ; seul à définir « visible » et « disponible » (./etats, pur).
// Double écriture jusqu'à la story 2.10 : chaque écriture tient aussi `available` égale à
// « disponible » (champAvailable), pour que le retour au commit précédent reste possible.

export * from './etats'

export type CodeRefus = 'acces_refuse' | 'introuvable' | 'non_recopiee' | 'transition_interdite'
export type ResultatEcriture = { ok: true } | { ok: false; code: CodeRefus }

/**
 * Lit les deux axes d'une œuvre en verrouillant sa ligne (SELECT … FOR UPDATE) jusqu'à la fin de
 * la transaction : deux écritures concurrentes (publication, paiement) ne calculent jamais
 * `available` sur un axe périmé. null si l'œuvre n'existe pas. Utilisé aussi par curation.
 */
export async function lireEtatVerrouille(tx: Prisma.TransactionClient, slug: string): Promise<EtatOeuvre | null> {
  const lignes = await tx.$queryRaw<EtatOeuvre[]>`
    SELECT "publication"::text AS publication, "disponibilite"::text AS disponibilite
    FROM "Artwork" WHERE "slug" = ${slug} FOR UPDATE`
  return lignes[0] ?? null
}

/**
 * Disponibilité d'une œuvre retirée que l'artiste remet en vente (story 2.8) : elle repasse en
 * curation (curation.remettreEnVente) et redevient `disponible`, pour que l'équipe la revalide.
 */
export function disponibiliteRemiseEnVente({ publication }: { publication: Publication }): {
  disponibilite: Disponibilite
  available: boolean
} {
  const disponibilite: Disponibilite = 'disponible'
  return { disponibilite, ...champAvailable({ publication, disponibilite }) }
}

/** Disponibilité d'une œuvre qui vient d'être créée, selon sa publication initiale (curation.publicationInitiale). */
export function disponibiliteInitiale({ publication }: { publication: Publication }): {
  disponibilite: Disponibilite
  available: boolean
} {
  const disponibilite: Disponibilite = 'disponible'
  return { disponibilite, ...champAvailable({ publication, disponibilite }) }
}

// État attendu d'une œuvre au moment du paiement : publiée, disponible ou réservée.
function etaitEnVente(e: EtatOeuvre): boolean {
  return e.publication === 'publiee' && (e.disponibilite === 'disponible' || e.disponibilite === 'reservee')
}

// Déclarée par l'artiste (story 2.8) : vendue ailleurs ou retirée. Un paiement ne l'efface jamais.
function estDeclaree(e: EtatOeuvre): boolean {
  return e.disponibilite === 'vendue_ailleurs' || e.disponibilite === 'retiree'
}

/**
 * Œuvres payées (webhook Stripe) : `vendue`, `available` = false, pour les seules œuvres `disponible`
 * ou `reservee` (le paiement est un fait). Idempotent. Une œuvre déclarée vendue ailleurs ou retirée
 * par l'artiste (session de paiement ouverte avant la déclaration, story 2.8) reste inchangée et est
 * signalée à l'équipe par console.error (slugs seulement : commande payée à traiter, remboursement).
 * Les autres œuvres qui n'étaient pas en vente sont journalisées (slugs seulement). Renvoie le nombre
 * d'œuvres trouvées.
 */
export async function marquerVendues(slugs: string[]): Promise<number> {
  if (slugs.length === 0) return 0
  return prisma.$transaction(async (tx) => {
    const lignes = await tx.$queryRaw<(EtatOeuvre & { slug: string })[]>`
      SELECT "slug", "publication"::text AS publication, "disponibilite"::text AS disponibilite
      FROM "Artwork" WHERE "slug" = ANY(${slugs}) ORDER BY "slug" FOR UPDATE`
    const declarees = lignes.filter(estDeclaree).map((l) => l.slug)
    if (declarees.length > 0) {
      console.error(
        '[disponibilite] œuvres payées alors que l’artiste les a déclarées vendues ailleurs ou retirées, laissées inchangées (commande à traiter par l’équipe) :',
        declarees,
      )
    }
    const inattendues = lignes.filter((l) => !etaitEnVente(l) && !estDeclaree(l)).map((l) => l.slug)
    if (inattendues.length > 0) {
      console.warn('[disponibilite] œuvres payées qui n’étaient pas en vente :', inattendues)
    }
    await tx.artwork.updateMany({
      where: { slug: { in: slugs }, disponibilite: { in: ['disponible', 'reservee'] } },
      data: { disponibilite: 'vendue', available: false },
    })
    return lignes.length
  })
}

/**
 * Bascule « Disponible / Vendue » de l'administration ; réservée aux admins, refusée pour une
 * œuvre réservée, vendue ailleurs ou retirée (transition_interdite) ou non recopiée.
 */
export async function definirDisponibilite(
  acteur: Acteur,
  slug: string,
  disponible: boolean,
): Promise<ResultatEcriture> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  const disponibilite: Disponibilite = disponible ? 'disponible' : 'vendue'
  return prisma.$transaction(async (tx): Promise<ResultatEcriture> => {
    const actuel = await lireEtatVerrouille(tx, slug)
    if (!actuel) return { ok: false, code: 'introuvable' }
    if (!estRecopiee(actuel)) return { ok: false, code: 'non_recopiee' }
    if (!basculePossible(actuel)) return { ok: false, code: 'transition_interdite' }
    await tx.artwork.update({
      where: { slug },
      data: { disponibilite, ...champAvailable({ publication: actuel.publication, disponibilite }) },
    })
    return { ok: true }
  })
}

export type ComptesOeuvres = { total: number; disponibles: number; vendues: number; nonPubliees: number }

/** Comptages de l'administration. */
export async function compterOeuvres(): Promise<ComptesOeuvres> {
  const [total, disponibles, vendues, publiees] = await Promise.all([
    prisma.artwork.count(),
    prisma.artwork.count({ where: DISPONIBLE }),
    prisma.artwork.count({ where: VENDUE }),
    prisma.artwork.count({ where: PUBLIEE }),
  ])
  return { total, disponibles, vendues, nonPubliees: total - publiees }
}

// ── Story 2.8 (FR-21) : déclarations de l'artiste (vendue ailleurs, retirée) ──────────────────

export type ResultatDeclaration =
  | { ok: true; declaration: DeclarationLue }
  | { ok: false; code: CodeRefusDisponibilite }

type LigneProprietaire = EtatOeuvre & { id: string; artistId: string }

/**
 * Œuvre de l'artiste, ligne verrouillée jusqu'à la fin de la transaction (une décision de
 * curation, un paiement ou une autre déclaration concurrente attend). Refus : `acces_refuse`
 * (pas un artiste lié, ou œuvre d'un autre artiste), `introuvable`, `non_recopiee`.
 */
async function verrouillerOeuvreDeLArtiste(
  tx: Prisma.TransactionClient,
  acteur: Acteur,
  slug: string,
): Promise<{ ok: true; ligne: LigneProprietaire } | { ok: false; code: CodeRefusDisponibilite }> {
  if (acteur.type !== 'artist' || !acteur.artiste) return { ok: false, code: 'acces_refuse' }
  const lignes = await tx.$queryRaw<LigneProprietaire[]>`
    SELECT "id", "artistId", "publication"::text AS publication, "disponibilite"::text AS disponibilite
    FROM "Artwork" WHERE "slug" = ${slug} FOR UPDATE`
  const l = lignes[0]
  if (!l) return { ok: false, code: 'introuvable' }
  if (l.artistId !== acteur.artiste.id) return { ok: false, code: 'acces_refuse' }
  if (!estRecopiee(l)) return { ok: false, code: 'non_recopiee' }
  return { ok: true, ligne: l }
}

const CHAMPS_DECLARATION = {
  id: true, type: true, createdAt: true, reservationInterrompue: true, annuleeLe: true,
} satisfies Prisma.DeclarationDisponibiliteSelect

function versDeclaration(d: Prisma.DeclarationDisponibiliteGetPayload<{ select: typeof CHAMPS_DECLARATION }>): DeclarationLue {
  return { type: d.type, le: d.createdAt, reservationInterrompue: d.reservationInterrompue, annuleeLe: d.annuleeLe }
}

async function derniere(tx: Prisma.TransactionClient, artworkId: string) {
  return tx.declarationDisponibilite.findFirst({
    where: { artworkId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: CHAMPS_DECLARATION,
  })
}

/**
 * L'artiste propriétaire déclare une œuvre publiée, disponible ou réservée, « vendue ailleurs » ou
 * « retirée » : l'axe disponibilité change sur la ligne verrouillée (`available` devient fausse),
 * et la déclaration est enregistrée (œuvre, type, artiste, date, réservation interrompue). Dès la
 * validation de la transaction, le checkout refuse l'œuvre (estDisponible). Refus, sans rien écrire :
 * `acces_refuse`, `introuvable`, `non_recopiee`, `transition_interdite` (brouillon, en curation,
 * vendue, déjà vendue ailleurs ou retirée, ou type inconnu).
 */
export async function declarerDisponibilite(acteur: Acteur, slug: unknown, type: unknown): Promise<ResultatDeclaration> {
  if (acteur.type !== 'artist' || !acteur.artiste) return { ok: false, code: 'acces_refuse' }
  if (typeof slug !== 'string' || !slug) return { ok: false, code: 'introuvable' }
  return prisma.$transaction(async (tx): Promise<ResultatDeclaration> => {
    const verrou = await verrouillerOeuvreDeLArtiste(tx, acteur, slug)
    if (!verrou.ok) return verrou
    const { ligne } = verrou
    if (!estTypeDeclaration(type) || !declarationsPossibles(ligne).includes(type)) {
      return { ok: false, code: 'transition_interdite' }
    }
    const disponibilite: Disponibilite = type
    await tx.artwork.update({
      where: { id: ligne.id },
      data: { disponibilite, ...champAvailable({ publication: ligne.publication, disponibilite }) },
    })
    const d = await tx.declarationDisponibilite.create({
      data: {
        artworkId: ligne.id,
        type,
        userId: acteur.userId,
        // Aucune réservation n'existe avant l'epic 6 : toujours faux en pratique.
        reservationInterrompue: ligne.disponibilite === 'reservee',
        createdAt: new Date(),
      },
      select: CHAMPS_DECLARATION,
    })
    return { ok: true, declaration: versDeclaration(d) }
  })
}

export type ResultatAnnulation = { ok: true } | { ok: false; code: CodeRefusDisponibilite }

/**
 * « Annuler » la dernière déclaration de l'œuvre, dans le délai (DELAI_ANNULATION_DECLARATION_MINUTES) :
 * l'œuvre redevient `disponible` et la déclaration est marquée annulée. Refus, sans rien écrire :
 * `transition_interdite` (aucune déclaration, déjà annulée, réservation interrompue, ou état changé
 * depuis), `delai_depasse` (au-delà du délai : remettre en vente, ou écrire à l'équipe).
 */
export async function annulerDeclaration(
  acteur: Acteur,
  slug: unknown,
  maintenant: Date = new Date(),
): Promise<ResultatAnnulation> {
  if (acteur.type !== 'artist' || !acteur.artiste) return { ok: false, code: 'acces_refuse' }
  if (typeof slug !== 'string' || !slug) return { ok: false, code: 'introuvable' }
  return prisma.$transaction(async (tx): Promise<ResultatAnnulation> => {
    const verrou = await verrouillerOeuvreDeLArtiste(tx, acteur, slug)
    if (!verrou.ok) return verrou
    const { ligne } = verrou
    const d = await derniere(tx, ligne.id)
    if (!d || !annulationAdmise(versDeclaration(d), ligne)) return { ok: false, code: 'transition_interdite' }
    if (!dansLeDelai(versDeclaration(d), maintenant, DELAI_ANNULATION_DECLARATION_MINUTES)) {
      return { ok: false, code: 'delai_depasse' }
    }
    const disponibilite: Disponibilite = 'disponible'
    await tx.artwork.update({
      where: { id: ligne.id },
      data: { disponibilite, ...champAvailable({ publication: ligne.publication, disponibilite }) },
    })
    await tx.declarationDisponibilite.update({ where: { id: d.id }, data: { annuleeLe: maintenant } })
    return { ok: true }
  })
}

export type DeclarationEnCours = DeclarationLue & {
  /** « Annuler » encore accepté (dans le délai, état inchangé). */
  annulable: boolean
  /** Fin du délai d'annulation. */
  annulableJusquA: Date
}

/**
 * Dernière déclaration de chacune des œuvres de l'artiste (par slug), si elle est toujours en
 * vigueur (non annulée, œuvre toujours dans l'état déclaré). Lecture seule, pour le bandeau et le
 * lien « Annuler ». Œuvres d'un autre artiste ignorées.
 */
export async function dernieresDeclarations(
  acteur: Acteur,
  slugs: string[],
  maintenant: Date = new Date(),
): Promise<Map<string, DeclarationEnCours>> {
  const resultat = new Map<string, DeclarationEnCours>()
  if (acteur.type !== 'artist' || !acteur.artiste || slugs.length === 0) return resultat
  const oeuvres = await prisma.artwork.findMany({
    where: { slug: { in: slugs }, artistId: acteur.artiste.id },
    select: {
      slug: true, publication: true, disponibilite: true,
      declarationsDisponibilite: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: CHAMPS_DECLARATION },
    },
  })
  for (const o of oeuvres) {
    const brute = o.declarationsDisponibilite[0]
    if (!brute) continue
    const d = versDeclaration(brute)
    if (d.annuleeLe !== null || o.publication !== 'publiee' || o.disponibilite !== d.type) continue
    resultat.set(o.slug, {
      ...d,
      annulable: annulationAdmise(d, o) && dansLeDelai(d, maintenant, DELAI_ANNULATION_DECLARATION_MINUTES),
      annulableJusquA: new Date(d.le.getTime() + DELAI_ANNULATION_DECLARATION_MINUTES * 60_000),
    })
  }
  return resultat
}

/**
 * Œuvre retirée remise en vente (curation.remettreEnVente, story 2.8), dans la transaction de
 * l'appelant : sa déclaration « retirée » encore ouverte est close (annuleeLe), elle n'est plus en vigueur.
 */
export async function cloreDeclarationRetrait(
  tx: Prisma.TransactionClient,
  artworkId: string,
  maintenant: Date = new Date(),
): Promise<void> {
  await tx.declarationDisponibilite.updateMany({
    where: { artworkId, type: 'retiree', annuleeLe: null },
    data: { annuleeLe: maintenant },
  })
}

/** Dernière déclaration en vigueur d'une œuvre de l'artiste (voir dernieresDeclarations). */
export async function derniereDeclaration(
  acteur: Acteur,
  slug: string,
  maintenant: Date = new Date(),
): Promise<DeclarationEnCours | null> {
  return (await dernieresDeclarations(acteur, [slug], maintenant)).get(slug) ?? null
}

