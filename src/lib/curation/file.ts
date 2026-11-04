import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import type { Acteur } from '@/lib/acces'
import {
  EN_CURATION,
  estEnCuration,
  estMarqueeDisponible,
  estPubliee,
  type EtatOeuvre,
  type Publication,
} from '@/lib/disponibilite'
import { zonesOuvertes } from '@/lib/livraison'
import {
  controleComplet,
  controlesCoches,
  refusPublicationManuelle,
  validerCommentaire,
  validerDateAccord,
  type CodeRefusCuration,
} from './curation-regles'
import { dernierRenvoiEquipe } from './decisions'
import { lireLigne, type RecapitulatifCuration } from './depot'
import type { RenvoiCuration } from './depot-regles'

// Curation par l'équipe (story 2.7, FR-25, FR-16). File des œuvres envoyées par les artistes, de la
// plus ancienne à la plus récente ; récapitulatif en lecture seule ; « Valider » (`en_curation` →
// `publiee`, exige l'accord écrit signé de l'artiste et la liste de contrôle complète) ou « Renvoyer
// à l'artiste » (`en_curation` → `brouillon`, commentaire obligatoire). Chaque décision est
// conservée (DecisionCuration). Accord signé : date enregistrée sur la fiche artiste. Admin seulement.
// Aucun e-mail (epic 4) : l'artiste voit le renvoi sur sa fiche de dépôt.

export type RefusCuration = { ok: false; code: CodeRefusCuration; erreur?: string }

export type OeuvreEnFile = {
  slug: string
  titre: string
  artiste: { id: string; nom: string }
  envoyeeLe: Date | null
  accordSigneLe: Date | null
}

export type ResultatFile = { ok: true; file: OeuvreEnFile[] } | RefusCuration

/** Œuvres en curation, de la plus anciennement envoyée à la plus récente. Admin seulement. */
export async function fileDeCuration(acteur: Acteur): Promise<ResultatFile> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  const lignes = await prisma.artwork.findMany({
    where: EN_CURATION,
    orderBy: [{ envoyeeEnCurationLe: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }],
    select: {
      slug: true,
      title: true,
      envoyeeEnCurationLe: true,
      artist: { select: { id: true, name: true, accordSigneLe: true } },
    },
  })
  return {
    ok: true,
    file: lignes.map((l) => ({
      slug: l.slug,
      titre: l.title,
      artiste: { id: l.artist.id, nom: l.artist.name },
      envoyeeLe: l.envoyeeEnCurationLe,
      accordSigneLe: l.artist.accordSigneLe,
    })),
  }
}

/** Œuvre en curation vue par l'équipe : récapitulatif complet, artiste et accord signé. */
export type OeuvreACurer = RecapitulatifCuration & {
  artiste: { id: string; nom: string; slug: string }
  accordSigneLe: Date | null
  /** Dernier renvoi de l'équipe, même si l'œuvre a été renvoyée en curation depuis : la correction se vérifie. */
  dernierRenvoiEquipe: RenvoiCuration | null
}

export type ResultatOeuvreACurer = { ok: true; oeuvre: OeuvreACurer } | RefusCuration

/** Récapitulatif d'une œuvre en curation pour l'équipe. Refus : `acces_refuse`, `introuvable`, `transition_interdite`. */
export async function oeuvreACurer(acteur: Acteur, slug: string): Promise<ResultatOeuvreACurer> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  return prisma.$transaction(async (tx): Promise<ResultatOeuvreACurer> => {
    const ligne = await tx.artwork.findUnique({
      where: { slug },
      select: {
        id: true,
        publication: true,
        disponibilite: true,
        artist: { select: { id: true, name: true, slug: true, accordSigneLe: true } },
      },
    })
    if (!ligne) return { ok: false, code: 'introuvable' }
    if (!estEnCuration(ligne)) return { ok: false, code: 'transition_interdite' }
    const { ligne: lue, depot } = await lireLigne(tx, ligne.id)
    return {
      ok: true,
      oeuvre: {
        ...depot,
        envoyeeLe: lue.envoyeeEnCurationLe,
        zones: await zonesOuvertes(tx),
        artiste: { id: ligne.artist.id, nom: ligne.artist.name, slug: ligne.artist.slug },
        accordSigneLe: ligne.artist.accordSigneLe,
        dernierRenvoiEquipe: await dernierRenvoiEquipe(tx, ligne.id),
      },
    }
  })
}

type LigneVerrouillee = EtatOeuvre & { id: string; accordSigneLe: Date | null }

/**
 * Œuvre en curation, ligne verrouillée avec celle de son artiste jusqu'à la fin de la transaction
 * (une autre décision, ou l'effacement de l'accord, attend). Refus : `introuvable`, `transition_interdite`.
 */
async function verrouillerEnCuration(
  tx: Prisma.TransactionClient,
  slug: string,
): Promise<{ ok: true; ligne: LigneVerrouillee } | RefusCuration> {
  const lignes = await tx.$queryRaw<LigneVerrouillee[]>`
    SELECT a."id", a."publication"::text AS publication, a."disponibilite"::text AS disponibilite, ar."accordSigneLe"
    FROM "Artwork" a JOIN "Artist" ar ON ar."id" = a."artistId"
    WHERE a."slug" = ${slug} FOR UPDATE`
  const l = lignes[0]
  if (!l) return { ok: false, code: 'introuvable' }
  if (!estEnCuration(l)) return { ok: false, code: 'transition_interdite' }
  return { ok: true, ligne: l }
}

export type ResultatDecision = { ok: true; slug: string } | RefusCuration

/**
 * « Valider » : `en_curation` → `publiee`, l'œuvre reste `disponible` (posée au dépôt) et devient
 * visible sur le site. Refus, sans rien écrire :
 * `controle_incomplet` (les quatre points non cochés), `transition_interdite` (déjà décidée),
 * `indisponible` (disponibilité autre que `disponible`), `accord_absent` (artiste sans accord signé).
 */
export async function validerOeuvre(acteur: Acteur, slug: unknown, controle: unknown): Promise<ResultatDecision> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  if (typeof slug !== 'string' || !slug) return { ok: false, code: 'introuvable' }
  const coches = controlesCoches(controle)
  if (!controleComplet(coches)) return { ok: false, code: 'controle_incomplet' }
  return prisma.$transaction(async (tx): Promise<ResultatDecision> => {
    const verrou = await verrouillerEnCuration(tx, slug)
    if (!verrou.ok) return verrou
    const { ligne } = verrou
    // L'axe disponibilité n'est pas écrit ici (module disponibilite) : il doit déjà être `disponible`.
    if (!estMarqueeDisponible(ligne)) return { ok: false, code: 'indisponible' }
    if (!ligne.accordSigneLe) return { ok: false, code: 'accord_absent' }
    const publication: Publication = 'publiee'
    await tx.artwork.update({
      where: { id: ligne.id },
      data: { publication },
    })
    await tx.decisionCuration.create({
      data: { artworkId: ligne.id, decision: 'valider', controle: coches, adminId: acteur.userId },
    })
    return { ok: true, slug }
  })
}

/**
 * « Renvoyer à l'artiste » : `en_curation` → `brouillon`, avec un commentaire obligatoire (10 à
 * 1 000 caractères) que l'artiste lit sur sa fiche de dépôt jusqu'au prochain envoi. Les points
 * cochés de la liste de contrôle sont conservés avec la décision. Refus : `commentaire_invalide`
 * (avec le message du champ), `transition_interdite`.
 */
export async function renvoyerOeuvre(
  acteur: Acteur,
  slug: unknown,
  commentaire: unknown,
  controle: unknown = [],
): Promise<ResultatDecision> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  if (typeof slug !== 'string' || !slug) return { ok: false, code: 'introuvable' }
  const lu = validerCommentaire(commentaire)
  if (!lu.ok) return { ok: false, code: 'commentaire_invalide', erreur: lu.erreur }
  return prisma.$transaction(async (tx): Promise<ResultatDecision> => {
    const verrou = await verrouillerEnCuration(tx, slug)
    if (!verrou.ok) return verrou
    const { ligne } = verrou
    const publication: Publication = 'brouillon'
    await tx.artwork.update({
      where: { id: ligne.id },
      data: { publication },
    })
    await tx.decisionCuration.create({
      data: {
        artworkId: ligne.id,
        decision: 'renvoyer',
        commentaire: lu.commentaire,
        controle: controlesCoches(controle),
        adminId: acteur.userId,
      },
    })
    return { ok: true, slug }
  })
}

export type ResultatAccord = { ok: true; accordSigneLe: Date | null } | RefusCuration

/**
 * Enregistre (`AAAA-MM-JJ`) ou efface (saisie vide) la date de signature de l'accord écrit d'un
 * artiste (FR-16). Refus : `date_invalide` (illisible ou future, avec le message du champ),
 * `introuvable`. N'agit pas sur les œuvres déjà publiées.
 */
export async function enregistrerAccord(acteur: Acteur, artistId: unknown, saisie: unknown): Promise<ResultatAccord> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  if (typeof artistId !== 'string' || !artistId) return { ok: false, code: 'introuvable' }
  const lue = validerDateAccord(saisie)
  if (!lue.ok) return { ok: false, code: 'date_invalide', erreur: lue.erreur }
  const { count } = await prisma.artist.updateMany({ where: { id: artistId }, data: { accordSigneLe: lue.date } })
  if (count === 0) return { ok: false, code: 'introuvable' }
  return { ok: true, accordSigneLe: lue.date }
}

const CHAMPS_PUBLICATION = {
  slug: true,
  publication: true,
  disponibilite: true,
  envoyeeEnCurationLe: true,
  artist: { select: { accordSigneLe: true } },
  _count: { select: { photos: true, decisionsCuration: true } },
  decisionsCuration: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { decision: true } },
} satisfies Prisma.ArtworkSelect

type LignePublication = Prisma.ArtworkGetPayload<{ select: typeof CHAMPS_PUBLICATION }>

function refusDeLaLigne(l: LignePublication) {
  return refusPublicationManuelle({
    enCuration: estEnCuration(l),
    accordSigne: l.artist.accordSigneLe !== null,
    parcoursDepot: l.envoyeeEnCurationLe !== null || l._count.decisionsCuration > 0 || l._count.photos > 0,
    derniereDecision: l.decisionsCuration[0]?.decision ?? null,
  })
}

/**
 * Refus de publier une œuvre par la bascule admin historique (definirPublication), dans la
 * transaction de l'appelant ; null si elle le peut. Voir refusPublicationManuelle.
 */
export async function refusPublication(
  tx: Prisma.TransactionClient,
  slug: string,
): Promise<'transition_interdite' | 'accord_absent' | null> {
  const l = await tx.artwork.findUnique({ where: { slug }, select: CHAMPS_PUBLICATION })
  return l ? refusDeLaLigne(l) : null
}

/**
 * Œuvres dont la bascule « Publiée / Brouillon » est proposée dans l'administration : publiées
 * (dépublier) ou publiables par la bascule ; jamais une œuvre en curation. Admin seulement.
 */
export async function basculesPublication(acteur: Acteur, slugs: string[]): Promise<Set<string>> {
  if (acteur.type !== 'admin' || slugs.length === 0) return new Set()
  const lignes = await prisma.artwork.findMany({ where: { slug: { in: slugs } }, select: CHAMPS_PUBLICATION })
  return new Set(
    lignes.filter((l) => !estEnCuration(l) && (estPubliee(l) || refusDeLaLigne(l) === null)).map((l) => l.slug),
  )
}
