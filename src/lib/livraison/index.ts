import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import type { Acteur } from '@/lib/acces'
import { VISIBLE } from '@/lib/disponibilite/etats'
import { EcritureProductionInterdite } from '@/lib/garde-production'
import { LONGUEUR_MAX_NOM, type RefusZone } from './messages'
import { estCodePays, trierParNom } from './pays'
import { calculerPrixLivre, type OeuvreAPrix, type PrixLivre, type RaisonNonLivree } from './prix'

// Module livraison (AD-12, story 2.3) : seul module qui lit et écrit les zones de livraison et
// leurs pays. Les zones sont des données gérées par l'équipe (OQ-5), jamais codées en dur.
// Story 2.6 : seul module qui lit et écrit les offres par œuvre et par zone (OffreLivraison), saisies
// par l'artiste. Ces fonctions reçoivent la transaction du module curation, qui a déjà verrouillé
// l'œuvre et vérifié l'acteur (artiste propriétaire, brouillon) : elles ne contrôlent aucun droit.

export { CODES_PAYS, estCodePays, nomPays, trierParNom } from './pays'
export { LONGUEUR_MAX_NOM, messageRefusZone, type RefusZone } from './messages'
export {
  COOKIE_PAYS,
  DUREE_COOKIE_PAYS_S,
  PAYS_PAR_DEFAUT,
  calculerPrixLivre,
  cookiePays,
  lirePays,
  type OeuvreAPrix,
  type OffreAPrix,
  type PrixLivre,
  type RaisonNonLivree,
} from './prix'

export type ZoneLue = { id: string; nom: string; pays: string[]; offres: number }

export type ResultatZone = { ok: true; id: string } | RefusZone

/** Zones dans leur ordre de création, pays triés par nom français, avec leur nombre d'offres. */
export async function listerZones(): Promise<ZoneLue[]> {
  const zones = await prisma.zone.findMany({
    orderBy: [{ createdAt: 'asc' }, { nom: 'asc' }],
    select: { id: true, nom: true, pays: { select: { codePays: true } }, _count: { select: { offres: true } } },
  })
  return zones.map((z) => ({
    id: z.id,
    nom: z.nom,
    pays: trierParNom(z.pays.map((p) => p.codePays)),
    offres: z._count.offres,
  }))
}

export async function lireZone(id: string): Promise<ZoneLue | null> {
  return (await listerZones()).find((z) => z.id === id) ?? null
}

/** Zone de chaque pays attribué : code pays → nom de la zone. */
export async function attributionsPays(): Promise<Record<string, { zoneId: string; zone: string }>> {
  const lignes = await prisma.zonePays.findMany({ select: { codePays: true, zoneId: true, zone: { select: { nom: true } } } })
  return Object.fromEntries(lignes.map((l) => [l.codePays, { zoneId: l.zoneId, zone: l.zone.nom }]))
}

type Saisie = { nom: string; pays: string[] }

function normaliserNom(nom: string): string {
  return nom.normalize('NFC').trim().replace(/\s+/g, ' ')
}

function valider(saisie: Saisie): { nom: string; pays: string[] } | RefusZone {
  const nom = normaliserNom(saisie.nom)
  if (!nom || nom.length > LONGUEUR_MAX_NOM) return { ok: false, code: 'nom_invalide' }
  const pays = [...new Set(saisie.pays.map((p) => p.trim().toUpperCase()).filter(Boolean))]
  const inconnus = pays.filter((p) => !estCodePays(p))
  if (inconnus.length) return { ok: false, code: 'pays_inconnu', pays: inconnus }
  return { nom, pays }
}

function codeErreur(erreur: unknown): string | undefined {
  return (erreur as { code?: string } | null)?.code
}

/**
 * Refus correspondant à une violation d'unicité (P2002) survenue malgré les vérifications : un autre
 * admin a pris le même nom ou le même pays entre-temps. Avec l'adaptateur pg (Prisma 7), la table en
 * cause est dans `meta.driverAdapterError.cause.table` (ou `meta.modelName`), sans `meta.target`.
 */
export function refusSurConflit(erreur: unknown): RefusZone | null {
  if (codeErreur(erreur) !== 'P2002') return null
  const meta = (erreur as { meta?: { modelName?: string; driverAdapterError?: { cause?: { table?: string } } } }).meta
  const table = meta?.driverAdapterError?.cause?.table ?? meta?.modelName
  return table === 'Zone' ? { ok: false, code: 'nom_pris' } : { ok: false, code: 'pays_deja_pris', pays: [] }
}

/** Crée une zone (réservé aux admins). Un pays déjà dans une autre zone est refusé. */
export function creerZone(acteur: Acteur, saisie: Saisie): Promise<ResultatZone> {
  return enregistrer(acteur, null, saisie)
}

/** Renomme une zone et remplace sa liste de pays (réservé aux admins), en une transaction. */
export function modifierZone(acteur: Acteur, id: string, saisie: Saisie): Promise<ResultatZone> {
  return enregistrer(acteur, id, saisie)
}

async function enregistrer(acteur: Acteur, id: string | null, saisie: Saisie): Promise<ResultatZone> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  const valide = valider(saisie)
  if ('ok' in valide) return valide
  const { nom, pays } = valide

  try {
    return await prisma.$transaction(async (tx): Promise<ResultatZone> => {
      if (id && !(await tx.zone.findUnique({ where: { id }, select: { id: true } }))) {
        return { ok: false, code: 'introuvable' }
      }
      const homonyme = await tx.zone.findFirst({
        where: { nom: { equals: nom, mode: 'insensitive' }, ...(id ? { NOT: { id } } : {}) },
        select: { id: true },
      })
      if (homonyme) return { ok: false, code: 'nom_pris' }

      const pris = await tx.zonePays.findMany({
        where: { codePays: { in: pays }, ...(id ? { NOT: { zoneId: id } } : {}) },
        select: { codePays: true, zone: { select: { nom: true } } },
      })
      if (pris.length) {
        return {
          ok: false,
          code: 'pays_deja_pris',
          pays: trierParNom(pris.map((p) => p.codePays)).map((code) => ({
            code,
            zone: pris.find((p) => p.codePays === code)!.zone.nom,
          })),
        }
      }

      const zone = id
        ? await tx.zone.update({ where: { id }, data: { nom }, select: { id: true } })
        : await tx.zone.create({ data: { nom }, select: { id: true } })
      await tx.zonePays.deleteMany({ where: { zoneId: zone.id, codePays: { notIn: pays } } })
      // Sans skipDuplicates : un pays pris entre-temps par une autre zone fait échouer la transaction
      // (P2002) au lieu d'être ignoré en silence.
      const deja = new Set(
        (await tx.zonePays.findMany({ where: { zoneId: zone.id }, select: { codePays: true } })).map((p) => p.codePays),
      )
      await tx.zonePays.createMany({ data: pays.filter((c) => !deja.has(c)).map((codePays) => ({ codePays, zoneId: zone.id })) })
      return { ok: true, id: zone.id }
    })
  } catch (erreur) {
    const conflit = refusSurConflit(erreur)
    if (conflit) return conflit
    // Zone supprimée par un autre admin pendant la modification.
    if (codeErreur(erreur) === 'P2025' || codeErreur(erreur) === 'P2003') return { ok: false, code: 'introuvable' }
    throw erreur
  }
}

/** Supprime une zone et ses pays (réservé aux admins) ; refusé si une offre l'utilise. */
export async function supprimerZone(acteur: Acteur, id: string): Promise<ResultatZone> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  const zone = await prisma.zone.findUnique({ where: { id }, select: { _count: { select: { offres: true } } } })
  if (!zone) return { ok: false, code: 'introuvable' }
  if (zone._count.offres > 0) return { ok: false, code: 'zone_utilisee', offres: zone._count.offres }
  try {
    await prisma.zone.delete({ where: { id } })
    return { ok: true, id }
  } catch (erreur) {
    // Offre créée entre la vérification et la suppression : la clé étrangère (RESTRICT) refuse.
    if (codeErreur(erreur) === 'P2003') {
      const offres = await prisma.offreLivraison.count({ where: { zoneId: id } })
      return { ok: false, code: 'zone_utilisee', offres }
    }
    if (codeErreur(erreur) === 'P2025') return { ok: false, code: 'introuvable' }
    throw erreur
  }
}

/* ── Offres d'une œuvre (story 2.6) ─────────────────────────────────────── */

/** Offre d'une œuvre pour une zone : livrée (frais en centimes, délais en jours) ou non livrée (valeurs vides). */
export type OffreLue = {
  zoneId: string
  livree: boolean
  fraisCentimes: number | null
  preparationJours: number | null
  transportMinJours: number | null
  transportMaxJours: number | null
}

export type ValeursOffre = Omit<OffreLue, 'zoneId'>

const CHAMPS_OFFRE_LUS = {
  zoneId: true, livree: true, fraisCentimes: true, preparationJours: true, transportMinJours: true, transportMaxJours: true,
} as const

/** Zones ouvertes par l'équipe (id et nom), dans leur ordre de création. */
export async function zonesOuvertes(tx: Prisma.TransactionClient = prisma): Promise<{ id: string; nom: string }[]> {
  return tx.zone.findMany({ orderBy: [{ createdAt: 'asc' }, { nom: 'asc' }], select: { id: true, nom: true } })
}

/** Offres enregistrées d'une œuvre, dans l'ordre des zones. */
export async function offresDeLOeuvre(tx: Prisma.TransactionClient, artworkId: string): Promise<OffreLue[]> {
  return tx.offreLivraison.findMany({
    where: { artworkId },
    orderBy: [{ zone: { createdAt: 'asc' } }, { zone: { nom: 'asc' } }],
    select: CHAMPS_OFFRE_LUS,
  })
}

/**
 * Enregistre l'offre d'une œuvre pour une zone (création ou remplacement) ; null la retire (la zone
 * redevient à renseigner). Valeurs déjà validées par l'appelant ; une zone livrée porte toujours ses
 * quatre valeurs, une zone non livrée aucune (contraintes CHECK en base). false si la zone n'existe plus.
 */
export async function enregistrerOffre(
  tx: Prisma.TransactionClient,
  artworkId: string,
  zoneId: string,
  valeurs: ValeursOffre | null,
): Promise<boolean> {
  if (!(await tx.zone.findUnique({ where: { id: zoneId }, select: { id: true } }))) return false
  if (valeurs === null) {
    await tx.offreLivraison.deleteMany({ where: { artworkId, zoneId } })
    return true
  }
  const donnees = valeurs.livree
    ? valeurs
    : { livree: false, fraisCentimes: null, preparationJours: null, transportMinJours: null, transportMaxJours: null }
  await tx.offreLivraison.upsert({
    where: { artworkId_zoneId: { artworkId, zoneId } },
    create: { artworkId, zoneId, ...donnees },
    update: donnees,
  })
  return true
}

/** Remplace les offres de l'œuvre `versId` par une copie de celles de l'œuvre `deId`. */
export async function recopierOffres(tx: Prisma.TransactionClient, deId: string, versId: string): Promise<number> {
  const source = await offresDeLOeuvre(tx, deId)
  await tx.offreLivraison.deleteMany({ where: { artworkId: versId } })
  await tx.offreLivraison.createMany({ data: source.map((o) => ({ ...o, artworkId: versId })) })
  return source.length
}

/** Dernière œuvre de l'artiste (la plus récemment créée), autre que `saufId`, qui a au moins une offre. */
export async function derniereOeuvreAvecOffres(
  tx: Prisma.TransactionClient,
  artisteId: string,
  saufId: string,
): Promise<string | null> {
  const oeuvre = await tx.artwork.findFirst({
    where: { artistId: artisteId, NOT: { id: saufId }, offresLivraison: { some: {} } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  })
  return oeuvre?.id ?? null
}

/* ── Prix livré (story 3.3, FR-3, FR-4) ─────────────────────────────────── */

// Seul endroit du calcul du prix total : prix de l'œuvre + frais de l'offre de la zone du pays, délai
// = préparation + transport. Deux formes de la même règle (./prix.ts, `calculerPrixLivre`) : une par
// œuvre (`prixLivre`, fiche) et une en SQL (`TOTAL_LIVRE_SQL`, `prixLivresPourPays`) pour filtrer et
// trier la galerie ; un test sur base prouve qu'elles donnent le même résultat pour chaque œuvre.
// Le pays est toujours passé par l'appelant (cookie `pays` lu par la page, `lirePays`).

/** Prix livré d'une œuvre vers un pays (code ISO) ; pays inconnu ou sans zone : non livrée. */
export async function prixLivre(
  oeuvre: OeuvreAPrix & { id: string },
  codePays: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<PrixLivre> {
  return (await prixLivreAvecZone(oeuvre, codePays, tx)).prix
}

/**
 * Valeurs à figer dans une commande (story 6.1) : prix livré, avec le prix de l'œuvre seul, les frais, la
 * zone (id et nom) et le délai (préparation + transport). Même règle que `prixLivre`, lue dans la
 * transaction de l'appelant ; l'appelant ne calcule rien.
 */
export type PrixLivreFige =
  | {
      livree: true
      prixCentimes: number
      fraisCentimes: number
      totalCentimes: number
      devise: string
      zoneId: string
      zoneNom: string
      delaiMinJours: number
      delaiMaxJours: number
    }
  | { livree: false; raison: RaisonNonLivree }

export async function prixLivreFige(
  tx: Prisma.TransactionClient,
  oeuvre: OeuvreAPrix & { id: string },
  codePays: string,
): Promise<PrixLivreFige> {
  const { prix, zone } = await prixLivreAvecZone(oeuvre, codePays, tx)
  if (!prix.livree || !zone || oeuvre.prixCentimes === null) {
    return { livree: false, raison: prix.livree ? 'pas_de_zone' : prix.raison }
  }
  return {
    livree: true,
    prixCentimes: oeuvre.prixCentimes,
    fraisCentimes: prix.fraisCentimes,
    totalCentimes: prix.totalCentimes,
    devise: prix.devise,
    zoneId: zone.id,
    zoneNom: zone.nom,
    delaiMinJours: prix.delaiMinJours,
    delaiMaxJours: prix.delaiMaxJours,
  }
}

async function prixLivreAvecZone(
  oeuvre: OeuvreAPrix & { id: string },
  codePays: string,
  tx: Prisma.TransactionClient,
): Promise<{ prix: PrixLivre; zone: { id: string; nom: string } | null }> {
  if (oeuvre.prixCentimes === null) return { prix: calculerPrixLivre(oeuvre, false, null), zone: null }
  const lien = await tx.zonePays.findUnique({
    where: { codePays },
    select: { zoneId: true, zone: { select: { nom: true } } },
  })
  if (!lien) return { prix: calculerPrixLivre(oeuvre, false, null), zone: null }
  const offre = await tx.offreLivraison.findUnique({
    where: { artworkId_zoneId: { artworkId: oeuvre.id, zoneId: lien.zoneId } },
    select: {
      livree: true, fraisCentimes: true, devise: true, preparationJours: true, transportMinJours: true, transportMaxJours: true,
    },
  })
  return { prix: calculerPrixLivre(oeuvre, true, offre), zone: { id: lien.zoneId, nom: lien.zone.nom } }
}

/**
 * Jointures du prix livré vers `codePays` pour une requête sur `"Artwork" a` : zone du pays (`zp`,
 * un pays dans au plus une zone) puis offre de l'œuvre pour cette zone (`o`). À placer après
 * `FROM "Artwork" a` ; `TOTAL_LIVRE_SQL` et `RAISON_NON_LIVREE_SQL` s'en servent.
 */
export function jointuresPrixLivre(codePays: string): Prisma.Sql {
  return Prisma.sql`
    LEFT JOIN "ZonePays" zp ON zp."codePays" = ${codePays}
    LEFT JOIN "OffreLivraison" o ON o."artworkId" = a.id AND o."zoneId" = zp."zoneId"`
}

const OFFRE_COMPLETE_SQL = Prisma.sql`(o.livree AND o."fraisCentimes" IS NOT NULL AND o."preparationJours" IS NOT NULL
  AND o."transportMinJours" IS NOT NULL AND o."transportMaxJours" IS NOT NULL)`

/** Total livré en centimes (NULL si non livrée) : même règle que `calculerPrixLivre`. En bigint : int4 + int4 déborderait. */
export const TOTAL_LIVRE_SQL = Prisma.sql`(CASE
  WHEN a."prixCentimes" IS NOT NULL AND zp."zoneId" IS NOT NULL AND ${OFFRE_COMPLETE_SQL}
    AND upper(o.devise) = upper(a.devise)
  THEN a."prixCentimes"::bigint + o."fraisCentimes" END)`

/** Raison de non-livraison (NULL si livrée), dans l'ordre de `calculerPrixLivre`. */
export const RAISON_NON_LIVREE_SQL = Prisma.sql`(CASE
  WHEN a."prixCentimes" IS NULL THEN 'sans_prix'
  WHEN zp."zoneId" IS NULL THEN 'pas_de_zone'
  WHEN o.id IS NULL OR NOT ${OFFRE_COMPLETE_SQL} THEN 'non_livree'
  WHEN upper(o.devise) <> upper(a.devise) THEN 'devise_differente' END)`

type LignePrixLivre = {
  id: string
  /** bigint en SQL : rendu en bigint (ou chaîne) par le pilote, converti en Number. */
  totalCentimes: number | bigint | string | null
  raison: RaisonNonLivree | null
  devise: string
  fraisCentimes: number | null
  delaiMinJours: number | null
  delaiMaxJours: number | null
}

/**
 * Prix livré vers `codePays` de chaque œuvre visible (ou des œuvres `ids`, sans filtre de
 * visibilité), calculé en SQL : id de l'œuvre → prix livré.
 */
export async function prixLivresPourPays(codePays: string, ids?: readonly string[]): Promise<Map<string, PrixLivre>> {
  const cibles = ids ?? (await prisma.artwork.findMany({ where: VISIBLE, select: { id: true } })).map((o) => o.id)
  if (cibles.length === 0) return new Map()
  let lignes: LignePrixLivre[]
  try {
    lignes = await prisma.$queryRaw<LignePrixLivre[]>`
      SELECT a.id,
             ${TOTAL_LIVRE_SQL} AS "totalCentimes",
             ${RAISON_NON_LIVREE_SQL} AS raison,
             upper(a.devise) AS devise,
             o."fraisCentimes" AS "fraisCentimes",
             o."preparationJours" + o."transportMinJours" AS "delaiMinJours",
             o."preparationJours" + o."transportMaxJours" AS "delaiMaxJours"
      FROM "Artwork" a ${jointuresPrixLivre(codePays)}
      WHERE a.id IN (${Prisma.join(cibles)})`
  } catch (erreur) {
    // Préversion ou poste local branché sur la base de production : le client en lecture seule
    // refuse tout SQL brut (garde-production). Même règle (calculerPrixLivre), en trois lectures.
    if (!(erreur instanceof EcritureProductionInterdite)) throw erreur
    return prixLivresSansSql(codePays, cibles)
  }
  return new Map(
    lignes.map((l): [string, PrixLivre] => [
      l.id,
      l.totalCentimes === null
        ? { livree: false, raison: l.raison ?? 'non_livree' }
        : {
            livree: true,
            totalCentimes: Number(l.totalCentimes),
            devise: l.devise,
            fraisCentimes: Number(l.fraisCentimes),
            delaiMinJours: Number(l.delaiMinJours),
            delaiMaxJours: Number(l.delaiMaxJours),
          },
    ]),
  )
}

/** Forme Prisma de `prixLivresPourPays` (repli) : zone du pays lue une fois, offres en une requête. */
async function prixLivresSansSql(codePays: string, ids: readonly string[]): Promise<Map<string, PrixLivre>> {
  const oeuvres = await prisma.artwork.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, prixCentimes: true, devise: true },
  })
  const zone = await prisma.zonePays.findUnique({ where: { codePays }, select: { zoneId: true } })
  const offres = zone
    ? await prisma.offreLivraison.findMany({
        where: { zoneId: zone.zoneId, artworkId: { in: [...ids] } },
        select: {
          artworkId: true, livree: true, fraisCentimes: true, devise: true, preparationJours: true, transportMinJours: true, transportMaxJours: true,
        },
      })
    : []
  const parOeuvre = new Map(offres.map((o) => [o.artworkId, o]))
  return new Map(oeuvres.map((o) => [o.id, calculerPrixLivre(o, zone !== null, parOeuvre.get(o.id) ?? null)]))
}
