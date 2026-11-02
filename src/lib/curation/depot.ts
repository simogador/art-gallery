import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import type { Acteur } from '@/lib/acces'
import { champsDimensionsExactes, champsPrix } from '@/lib/catalogue/conversions'
import { disponibiliteInitiale, estBrouillon, type EtatOeuvre, type Publication } from '@/lib/disponibilite'
import {
  ANNEE_NON_RENSEIGNEE,
  centimesEnSaisie,
  validerChamp,
  type ChampDepot,
  type CodeRefusDepot,
  type DepotLu,
} from './depot-regles'

// Dépôt d'une œuvre par son artiste (story 2.5, FR-20). Le module curation est propriétaire du
// descriptif, des dimensions et des photos d'une œuvre. Seul l'artiste propriétaire lit et modifie
// son dépôt, et seulement tant que l'œuvre est en brouillon : une œuvre en curation ou publiée
// garde l'ancienne page d'édition (stories 2.7, 2.8).

export type RefusDepot = { ok: false; code: CodeRefusDepot; erreur?: string }

export type { DepotLu, PhotoDepot } from './depot-regles'

export type ResultatDepot = { ok: true; depot: DepotLu } | RefusDepot

/** Publication d'une œuvre que l'artiste vient de créer : brouillon, absente du catalogue. */
export function publicationInitiale(): { publication: Publication } {
  return { publication: 'brouillon' }
}

const CHAMPS_DEPOT_LUS = {
  slug: true, title: true, medium: true, year: true, description: true, ambiance: true, couleurDominante: true,
  hauteurMm: true, largeurMm: true, profondeurMm: true, prixCentimes: true,
  photos: { select: { type: true, url: true, largeur: true, hauteur: true } },
} as const

type LigneDepot = Prisma.ArtworkGetPayload<{ select: typeof CHAMPS_DEPOT_LUS }>

function versDepot(l: LigneDepot): DepotLu {
  return {
    slug: l.slug,
    titre: l.title,
    technique: l.medium,
    annee: l.year === ANNEE_NON_RENSEIGNEE ? null : l.year,
    histoire: l.description,
    ambiance: l.ambiance,
    couleurDominante: l.couleurDominante,
    hauteurMm: l.hauteurMm,
    largeurMm: l.largeurMm,
    profondeurMm: l.profondeurMm,
    prixCentimes: l.prixCentimes,
    photos: l.photos.map((p) => p.type),
    photosLues: Object.fromEntries(l.photos.map((p) => [p.type, { url: p.url, largeur: p.largeur, hauteur: p.hauteur }])),
  }
}

/** Artiste de l'acteur, seul à pouvoir déposer ; null pour tout autre acteur. */
export function artisteDeposant(acteur: Acteur): string | null {
  return acteur.type === 'artist' && acteur.artiste ? acteur.artiste.id : null
}

export type OeuvreVerrouillee = { id: string; slug: string; hauteurMm: number | null; largeurMm: number | null; profondeurMm: number | null }

/**
 * Œuvre en dépôt de l'acteur, ligne verrouillée jusqu'à la fin de la transaction (une curation ou
 * une autre écriture concurrente ne peut pas la faire sortir du brouillon entre le contrôle et
 * l'écriture). Refus : `introuvable`, `acces_refuse` (œuvre d'un autre artiste), `transition_interdite`
 * (œuvre qui n'est plus en brouillon).
 */
export async function verrouillerDepot(
  tx: Prisma.TransactionClient,
  acteur: Acteur,
  slug: string,
): Promise<{ ok: true; oeuvre: OeuvreVerrouillee } | RefusDepot> {
  const artisteId = artisteDeposant(acteur)
  if (!artisteId) return { ok: false, code: 'acces_refuse' }
  const lignes = await tx.$queryRaw<(OeuvreVerrouillee & EtatOeuvre & { artistId: string })[]>`
    SELECT "id", "slug", "artistId", "hauteurMm", "largeurMm", "profondeurMm",
           "publication"::text AS publication, "disponibilite"::text AS disponibilite
    FROM "Artwork" WHERE "slug" = ${slug} FOR UPDATE`
  const l = lignes[0]
  if (!l) return { ok: false, code: 'introuvable' }
  if (l.artistId !== artisteId) return { ok: false, code: 'acces_refuse' }
  if (!estBrouillon(l)) return { ok: false, code: 'transition_interdite' }
  return { ok: true, oeuvre: { id: l.id, slug: l.slug, hauteurMm: l.hauteurMm, largeurMm: l.largeurMm, profondeurMm: l.profondeurMm } }
}

const slugProvisoire = () => `brouillon-${randomBytes(4).toString('hex')}`

/**
 * Crée le brouillon d'une œuvre au premier enregistrement : `brouillon` + `disponible` (absente du
 * catalogue), champs obligatoires de l'ancien schéma vides, slug provisoire.
 */
export async function creerBrouillon(tx: Prisma.TransactionClient, artisteId: string): Promise<OeuvreVerrouillee> {
  const initiale = publicationInitiale()
  const prix = champsPrix(null)
  if (!prix.ok) throw new Error('champsPrix(null) refusé')
  return tx.artwork.create({
    data: {
      slug: slugProvisoire(),
      title: '',
      year: ANNEE_NON_RENSEIGNEE,
      medium: '',
      description: '',
      imageUrl: '',
      ...prix.champs,
      ...champsDimensionsExactes({ hauteurMm: null, largeurMm: null, profondeurMm: null }),
      ...initiale,
      ...disponibiliteInitiale(initiale),
      featured: false,
      artistId: artisteId,
    },
    select: { id: true, slug: true, hauteurMm: true, largeurMm: true, profondeurMm: true },
  })
}

// Segments réservés sous /dashboard/artiste/oeuvres/ : un slug ne doit jamais les masquer.
const SLUGS_RESERVES = new Set(['nouvelle'])
const LONGUEUR_MAX_SLUG = 80

export function slugifier(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, LONGUEUR_MAX_SLUG)
    .replace(/^-+|-+$/g, '')
}

/** Slug recalculé depuis le titre tant que l'œuvre est en brouillon ; inchangé sans titre exploitable. */
async function slugDepuisTitre(tx: Prisma.TransactionClient, oeuvre: OeuvreVerrouillee, titre: string): Promise<string> {
  const base = slugifier(titre)
  if (!base) return oeuvre.slug
  if (oeuvre.slug === base) return oeuvre.slug
  const pris = async (candidat: string) =>
    SLUGS_RESERVES.has(candidat) ||
    (await tx.artwork.findFirst({ where: { slug: candidat, NOT: { id: oeuvre.id } }, select: { id: true } })) !== null
  // Slug suffixé (« nuit-2 ») gardé seulement si la base reste prise par une autre œuvre.
  if (new RegExp(`^${base}-\\d+$`).test(oeuvre.slug) && (await pris(base))) return oeuvre.slug
  for (let n = 1; ; n++) {
    const candidat = n === 1 ? base : `${base}-${n}`
    if (!(await pris(candidat))) return candidat
  }
}

async function donneesDuChamp(
  tx: Prisma.TransactionClient,
  oeuvre: OeuvreVerrouillee,
  champ: ChampDepot,
  valeur: string | number | null,
): Promise<Prisma.ArtworkUpdateInput> {
  const texte = typeof valeur === 'string' ? valeur : ''
  const nombre = typeof valeur === 'number' ? valeur : null
  switch (champ) {
    case 'titre':
      return { title: texte, slug: await slugDepuisTitre(tx, oeuvre, texte) }
    case 'technique':
      return { medium: texte }
    case 'histoire':
      return { description: texte }
    case 'annee':
      return { year: nombre ?? ANNEE_NON_RENSEIGNEE }
    case 'ambiance':
      return { ambiance: typeof valeur === 'string' ? valeur : null }
    case 'couleurDominante':
      return { couleurDominante: typeof valeur === 'string' ? valeur : null }
    case 'prix': {
      // Double écriture (AD-20) : prixCentimes et l'ancienne colonne price, par champsPrix.
      const prix = champsPrix(centimesEnSaisie(nombre))
      if (!prix.ok) throw new Error('prix validé refusé par champsPrix')
      return prix.champs
    }
    case 'hauteur':
    case 'largeur':
    case 'profondeur': {
      const cle = ({ hauteur: 'hauteurMm', largeur: 'largeurMm', profondeur: 'profondeurMm' } as const)[champ]
      const d = { hauteurMm: oeuvre.hauteurMm, largeurMm: oeuvre.largeurMm, profondeurMm: oeuvre.profondeurMm, [cle]: nombre }
      // Double écriture (AD-20) : millimètres et ancien texte « h × l (× p) cm ».
      return champsDimensionsExactes(d)
    }
  }
}

/** Dépôt de l'artiste propriétaire, s'il est encore en brouillon. */
export async function lireDepot(acteur: Acteur, slug: string): Promise<ResultatDepot> {
  return prisma.$transaction(async (tx): Promise<ResultatDepot> => {
    const verrou = await verrouillerDepot(tx, acteur, slug)
    if (!verrou.ok) return verrou
    const ligne = await tx.artwork.findUniqueOrThrow({ where: { id: verrou.oeuvre.id }, select: CHAMPS_DEPOT_LUS })
    return { ok: true, depot: versDepot(ligne) }
  })
}

/** Relit le dépôt après une écriture, dans la même transaction. */
export async function relireDepot(tx: Prisma.TransactionClient, id: string): Promise<DepotLu> {
  return versDepot(await tx.artwork.findUniqueOrThrow({ where: { id }, select: CHAMPS_DEPOT_LUS }))
}

/**
 * Enregistre un champ du dépôt, à sa sortie. Sans slug, crée d'abord le brouillon (premier
 * enregistrement). Une valeur refusée n'écrit rien, pas même le brouillon : `valeur_invalide` avec
 * le message à afficher sous le champ.
 */
export async function enregistrerChamp(
  acteur: Acteur,
  slug: string | null,
  champ: ChampDepot,
  saisie: unknown,
): Promise<ResultatDepot> {
  const artisteId = artisteDeposant(acteur)
  if (!artisteId) return { ok: false, code: 'acces_refuse' }
  const lu = validerChamp(champ, saisie)
  if (!lu.ok) return { ok: false, code: 'valeur_invalide', erreur: lu.erreur }

  return prisma.$transaction(async (tx): Promise<ResultatDepot> => {
    let oeuvre: OeuvreVerrouillee
    if (slug === null) {
      oeuvre = await creerBrouillon(tx, artisteId)
    } else {
      const verrou = await verrouillerDepot(tx, acteur, slug)
      if (!verrou.ok) return verrou
      oeuvre = verrou.oeuvre
    }
    await tx.artwork.update({ where: { id: oeuvre.id }, data: await donneesDuChamp(tx, oeuvre, champ, lu.valeur) })
    return { ok: true, depot: await relireDepot(tx, oeuvre.id) }
  })
}
