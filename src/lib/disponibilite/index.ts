import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import type { Acteur } from '@/lib/acces'
import {
  basculePossible,
  champAvailable,
  DISPONIBLE,
  estRecopiee,
  PUBLIEE,
  VENDUE,
  type Disponibilite,
  type EtatOeuvre,
  type Publication,
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

/**
 * Œuvres payées (webhook Stripe) : `vendue`, `available` = false, quel que soit l'état précédent
 * (le paiement est un fait). Idempotent. Les œuvres qui n'étaient pas en vente sont journalisées
 * (slugs seulement). Renvoie le nombre d'œuvres trouvées.
 */
export async function marquerVendues(slugs: string[]): Promise<number> {
  if (slugs.length === 0) return 0
  return prisma.$transaction(async (tx) => {
    const lignes = await tx.$queryRaw<(EtatOeuvre & { slug: string })[]>`
      SELECT "slug", "publication"::text AS publication, "disponibilite"::text AS disponibilite
      FROM "Artwork" WHERE "slug" = ANY(${slugs}) ORDER BY "slug" FOR UPDATE`
    const inattendues = lignes.filter((l) => !etaitEnVente(l)).map((l) => l.slug)
    if (inattendues.length > 0) {
      console.warn('[disponibilite] œuvres payées qui n’étaient pas en vente :', inattendues)
    }
    await tx.artwork.updateMany({
      where: { slug: { in: slugs } },
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
