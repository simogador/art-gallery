import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import type { Acteur } from '@/lib/acces'
import { ecrireEvenement, repartirApresValidation } from '@/lib/evenements'
import { champsPrix } from '@/lib/catalogue/conversions'
import {
  disponibiliteInitiale,
  estBrouillon,
  estEnCuration,
  type EtatOeuvre,
  type Publication,
} from '@/lib/disponibilite'
import {
  derniereOeuvreAvecOffres,
  enregistrerOffre as ecrireOffre,
  offresDeLOeuvre,
  recopierOffres,
  zonesOuvertes,
} from '@/lib/livraison'
import { dernierRenvoi } from './decisions'
import {
  ANNEE_NON_RENSEIGNEE,
  centimesEnSaisie,
  elementsManquants,
  validerChamp,
  validerOffre,
  type ChampDepot,
  type ChampOffre,
  type CodeRefusDepot,
  type DepotLu,
  type ValeurChamp,
  type ZoneDepot,
} from './depot-regles'

// Dépôt d'une œuvre par son artiste (story 2.5, FR-20). Le module curation est propriétaire du
// descriptif, des dimensions et des photos d'une œuvre. Seul l'artiste propriétaire lit et modifie
// son dépôt, et seulement tant que l'œuvre est en brouillon : une œuvre en curation ou publiée
// garde l'ancienne page d'édition (stories 2.7, 2.8).
// Story 2.6 : expédition par zone (offres écrites par le module livraison, appelé ici), visites en
// atelier, engagements, puis envoi en curation (`brouillon` → `en_curation`). Une œuvre en curation
// se relit en lecture seule (lireOeuvreEnCuration), jamais modifiable par l'artiste.

export type RefusDepot = {
  ok: false
  code: CodeRefusDepot
  erreur?: string
  /** Erreurs par champ d'une zone (`valeur_invalide` sur une offre). */
  erreursOffre?: Partial<Record<ChampOffre, string>>
}

export type { DepotLu, PhotoDepot } from './depot-regles'

export type ResultatDepot = { ok: true; depot: DepotLu } | RefusDepot

/** Publication d'une œuvre que l'artiste vient de créer : brouillon, absente du catalogue. */
export function publicationInitiale(): { publication: Publication } {
  return { publication: 'brouillon' }
}

const CHAMPS_DEPOT_LUS = {
  slug: true, title: true, medium: true, year: true, description: true, ambiance: true, couleurDominante: true,
  hauteurMm: true, largeurMm: true, profondeurMm: true, prixCentimes: true, devise: true, artistId: true,
  visitesAtelier: true, engagementCertificat: true, engagementEmballage: true, engagementReprise: true,
  envoyeeEnCurationLe: true,
  photos: { select: { type: true, url: true, largeur: true, hauteur: true } },
} as const

type LigneDepot = Prisma.ArtworkGetPayload<{ select: typeof CHAMPS_DEPOT_LUS }>

function versDepot(
  l: LigneDepot,
  offres: DepotLu['offres'],
  repriseDisponible: boolean,
  renvoi: DepotLu['renvoi'],
): DepotLu {
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
    devise: l.devise,
    photos: l.photos.map((p) => p.type),
    photosLues: Object.fromEntries(l.photos.map((p) => [p.type, { url: p.url, largeur: p.largeur, hauteur: p.hauteur }])),
    offres,
    visitesAtelier: l.visitesAtelier,
    engagementCertificat: l.engagementCertificat,
    engagementEmballage: l.engagementEmballage,
    engagementReprise: l.engagementReprise,
    repriseDisponible,
    renvoi,
  }
}

/** Artiste de l'acteur, seul à pouvoir déposer ; null pour tout autre acteur. */
export function artisteDeposant(acteur: Acteur): string | null {
  return acteur.type === 'artist' && acteur.artiste ? acteur.artiste.id : null
}

export type OeuvreVerrouillee = { id: string; slug: string }

/**
 * Œuvre en dépôt de l'acteur, ligne verrouillée jusqu'à la fin de la transaction (une curation ou
 * une autre écriture concurrente ne peut pas la faire sortir du brouillon entre le contrôle et
 * l'écriture). Refus : `introuvable`, `acces_refuse` (œuvre d'un autre artiste), `transition_interdite`
 * (œuvre qui n'est plus en brouillon).
 */
export function verrouillerDepot(
  tx: Prisma.TransactionClient,
  acteur: Acteur,
  slug: string,
): Promise<{ ok: true; oeuvre: OeuvreVerrouillee } | RefusDepot> {
  return verrouillerOeuvre(tx, acteur, slug, estBrouillon)
}

/** Comme verrouillerDepot, pour une œuvre de l'acteur dont l'état satisfait `accepte`. */
export async function verrouillerOeuvre(
  tx: Prisma.TransactionClient,
  acteur: Acteur,
  slug: string,
  accepte: (e: EtatOeuvre) => boolean,
): Promise<{ ok: true; oeuvre: OeuvreVerrouillee } | RefusDepot> {
  const artisteId = artisteDeposant(acteur)
  if (!artisteId) return { ok: false, code: 'acces_refuse' }
  const lignes = await tx.$queryRaw<(OeuvreVerrouillee & EtatOeuvre & { artistId: string })[]>`
    SELECT "id", "slug", "artistId", "publication"::text AS publication, "disponibilite"::text AS disponibilite
    FROM "Artwork" WHERE "slug" = ${slug} FOR UPDATE`
  const l = lignes[0]
  if (!l) return { ok: false, code: 'introuvable' }
  if (l.artistId !== artisteId) return { ok: false, code: 'acces_refuse' }
  if (!accepte(l)) return { ok: false, code: 'transition_interdite' }
  return { ok: true, oeuvre: { id: l.id, slug: l.slug } }
}

const slugProvisoire = () => `brouillon-${randomBytes(4).toString('hex')}`

/**
 * Crée le brouillon d'une œuvre au premier enregistrement : `brouillon` + `disponible` (absente du
 * catalogue), champs obligatoires vides, ni prix ni dimensions, slug provisoire.
 */
export async function creerBrouillon(tx: Prisma.TransactionClient, artisteId: string): Promise<OeuvreVerrouillee> {
  return tx.artwork.create({
    data: {
      slug: slugProvisoire(),
      title: '',
      year: ANNEE_NON_RENSEIGNEE,
      medium: '',
      description: '',
      imageUrl: '',
      ...publicationInitiale(),
      ...disponibiliteInitiale(),
      featured: false,
      artistId: artisteId,
    },
    select: { id: true, slug: true },
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
  valeur: ValeurChamp,
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
      const prix = champsPrix(centimesEnSaisie(nombre))
      if (!prix.ok) throw new Error('prix validé refusé par champsPrix')
      return prix.champs
    }
    case 'visitesAtelier':
      return { visitesAtelier: typeof valeur === 'boolean' ? valeur : null }
    case 'engagementCertificat':
      return { engagementCertificat: valeur === true }
    case 'engagementEmballage':
      return { engagementEmballage: valeur === true }
    case 'engagementReprise':
      return { engagementReprise: valeur === true }
    case 'hauteur':
      return { hauteurMm: nombre }
    case 'largeur':
      return { largeurMm: nombre }
    case 'profondeur':
      return { profondeurMm: nombre }
  }
}

/** Dépôt de l'artiste propriétaire, s'il est encore en brouillon. */
export async function lireDepot(acteur: Acteur, slug: string): Promise<ResultatDepot> {
  return prisma.$transaction(async (tx): Promise<ResultatDepot> => {
    const verrou = await verrouillerDepot(tx, acteur, slug)
    if (!verrou.ok) return verrou
    return { ok: true, depot: await relireDepot(tx, verrou.oeuvre.id) }
  })
}

/** Ligne et dépôt d'une œuvre, quel que soit son état (dépôt, récapitulatif, curation par l'équipe). */
export async function lireLigne(tx: Prisma.TransactionClient, id: string): Promise<{ ligne: LigneDepot; depot: DepotLu }> {
  const ligne = await tx.artwork.findUniqueOrThrow({ where: { id }, select: CHAMPS_DEPOT_LUS })
  const offres = await offresDeLOeuvre(tx, id)
  const reprise = (await derniereOeuvreAvecOffres(tx, ligne.artistId, id)) !== null
  // Story 2.7 : commentaire du dernier renvoi de l'équipe, jusqu'au prochain envoi en curation.
  const renvoi = await dernierRenvoi(tx, id)
  return { ligne, depot: versDepot(ligne, offres, reprise, renvoi) }
}

/** Relit le dépôt après une écriture, dans la même transaction (avec le dernier renvoi de l'équipe). */
export async function relireDepot(tx: Prisma.TransactionClient, id: string): Promise<DepotLu> {
  return (await lireLigne(tx, id)).depot
}

/** Brouillon existant (verrouillé) ou, sans slug, créé pour le premier enregistrement. */
async function brouillonPourEcrire(
  tx: Prisma.TransactionClient,
  acteur: Acteur,
  artisteId: string,
  slug: string | null,
): Promise<{ ok: true; oeuvre: OeuvreVerrouillee } | RefusDepot> {
  if (slug === null) return { ok: true, oeuvre: await creerBrouillon(tx, artisteId) }
  return verrouillerDepot(tx, acteur, slug)
}

/**
 * Enregistre la saisie d'une zone (story 2.6) : frais et délais, « je ne livre pas », ou quatre
 * champs vides (offre retirée). Sans slug, crée d'abord le brouillon. Une saisie refusée n'écrit
 * rien : `valeur_invalide` avec les erreurs par champ.
 */
export async function enregistrerOffreDepot(
  acteur: Acteur,
  slug: string | null,
  zoneId: unknown,
  saisie: unknown,
): Promise<ResultatDepot> {
  const artisteId = artisteDeposant(acteur)
  if (!artisteId) return { ok: false, code: 'acces_refuse' }
  if (typeof zoneId !== 'string' || !zoneId) return { ok: false, code: 'zone_introuvable' }
  const lue = validerOffre(saisie)
  if (!lue.ok) return { ok: false, code: 'valeur_invalide', erreursOffre: lue.erreurs }

  return prisma.$transaction(async (tx): Promise<ResultatDepot> => {
    if (!(await tx.zone.findUnique({ where: { id: zoneId }, select: { id: true } }))) {
      return { ok: false, code: 'zone_introuvable' }
    }
    const verrou = await brouillonPourEcrire(tx, acteur, artisteId, slug)
    if (!verrou.ok) return verrou
    await ecrireOffre(tx, verrou.oeuvre.id, zoneId, lue.offre)
    return { ok: true, depot: await relireDepot(tx, verrou.oeuvre.id) }
  })
}

/** Une autre œuvre de l'artiste a-t-elle des offres à reprendre ? (formulaire sans brouillon) */
export async function repriseZonesPossible(acteur: Acteur): Promise<boolean> {
  const artisteId = artisteDeposant(acteur)
  if (!artisteId) return false
  return (await derniereOeuvreAvecOffres(prisma, artisteId, '')) !== null
}

/**
 * « Reprendre les zones de ma dernière œuvre » : remplace les offres du brouillon par celles de la
 * dernière autre œuvre de l'artiste qui en a. Sans slug, crée d'abord le brouillon. Aucune œuvre
 * antérieure avec des offres : `introuvable`, rien n'est écrit.
 */
export async function reprendreZones(acteur: Acteur, slug: string | null): Promise<ResultatDepot> {
  const artisteId = artisteDeposant(acteur)
  if (!artisteId) return { ok: false, code: 'acces_refuse' }
  return prisma.$transaction(async (tx): Promise<ResultatDepot> => {
    if (slug !== null) {
      const verrou = await verrouillerDepot(tx, acteur, slug)
      if (!verrou.ok) return verrou
      const source = await derniereOeuvreAvecOffres(tx, artisteId, verrou.oeuvre.id)
      if (!source) return { ok: false, code: 'introuvable' }
      await recopierOffres(tx, source, verrou.oeuvre.id)
      return { ok: true, depot: await relireDepot(tx, verrou.oeuvre.id) }
    }
    const source = await derniereOeuvreAvecOffres(tx, artisteId, '')
    if (!source) return { ok: false, code: 'introuvable' }
    const oeuvre = await creerBrouillon(tx, artisteId)
    await recopierOffres(tx, source, oeuvre.id)
    return { ok: true, depot: await relireDepot(tx, oeuvre.id) }
  })
}

export type ResultatEnvoiCuration = { ok: true; slug: string } | RefusDepot

/**
 * Envoie le brouillon en curation (story 2.6) : revérifie la complétude sur la ligne verrouillée,
 * passe la publication de `brouillon` à `en_curation` et retient la date d'envoi (ordre de la file,
 * story 2.7). Incomplet : `depot_incomplet`, l'œuvre reste en brouillon ; déjà envoyée :
 * `transition_interdite`.
 */
export async function envoyerEnCuration(acteur: Acteur, slug: unknown): Promise<ResultatEnvoiCuration> {
  if (!artisteDeposant(acteur)) return { ok: false, code: 'acces_refuse' }
  if (typeof slug !== 'string' || !slug) return { ok: false, code: 'introuvable' }
  const evenements: string[] = []
  const resultat = await prisma.$transaction(async (tx): Promise<ResultatEnvoiCuration> => {
    const verrou = await verrouillerDepot(tx, acteur, slug)
    if (!verrou.ok) return verrou
    const depot = await relireDepot(tx, verrou.oeuvre.id)
    if (elementsManquants(depot, await zonesOuvertes(tx)).length > 0) return { ok: false, code: 'depot_incomplet' }
    const publication: Publication = 'en_curation'
    await tx.artwork.update({
      where: { id: verrou.oeuvre.id },
      data: { publication, envoyeeEnCurationLe: new Date() },
    })
    evenements.push(await ecrireEvenement(tx, { nom: 'PublicationChangee', charge: { artworkId: verrou.oeuvre.id, artistId: artisteDeposant(acteur) as string } }))
    return { ok: true, slug: verrou.oeuvre.slug }
  })
  if (resultat.ok) await repartirApresValidation(evenements)
  return resultat
}

/** Récapitulatif en lecture seule d'une œuvre en curation. */
export type RecapitulatifCuration = DepotLu & { envoyeeLe: Date | null; zones: ZoneDepot[] }

export type ResultatRecapitulatif = { ok: true; recap: RecapitulatifCuration } | RefusDepot

/**
 * Œuvre en curation de l'artiste propriétaire, en lecture seule. Refus : `introuvable`,
 * `acces_refuse`, `transition_interdite` (œuvre qui n'est pas en curation).
 */
export async function lireOeuvreEnCuration(acteur: Acteur, slug: string): Promise<ResultatRecapitulatif> {
  return prisma.$transaction(async (tx): Promise<ResultatRecapitulatif> => {
    const verrou = await verrouillerOeuvre(tx, acteur, slug, estEnCuration)
    if (!verrou.ok) return verrou
    const { ligne, depot } = await lireLigne(tx, verrou.oeuvre.id)
    return { ok: true, recap: { ...depot, envoyeeLe: ligne.envoyeeEnCurationLe, zones: await zonesOuvertes(tx) } }
  })
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
    const verrou = await brouillonPourEcrire(tx, acteur, artisteId, slug)
    if (!verrou.ok) return verrou
    const oeuvre = verrou.oeuvre
    await tx.artwork.update({ where: { id: oeuvre.id }, data: await donneesDuChamp(tx, oeuvre, champ, lu.valeur) })
    return { ok: true, depot: await relireDepot(tx, oeuvre.id) }
  })
}
