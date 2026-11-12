import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import { DUREE_RESERVATION_PAIEMENT_MINUTES, PLAFONDS_RESERVATION } from '@/lib/reglages'
import { ecrireEvenement, repartirApresValidation } from '@/lib/evenements'
import { estDisponible, estVisible } from './etats'
import {
  echeanceApres,
  estEchue,
  normaliserEmailReservation,
  plafondDepasse,
  type CodeRefusReservation,
  type IssueReservation,
  type OrigineReservation,
} from './reservation-regles'

// Réservation en bloc (story 6.2, FR-12, AD-7, NFR-4) : seul écrivain de `Reservation` et de l'axe
// disponibilité pour `disponible` ↔ `reservee`. Aucun contrôle d'acteur : l'appelant (6.3 : admin) le
// fait. Fonctions avec `tx` facultatif (AD-3) : sans `tx`, transaction propre puis répartition des
// événements ; avec `tx`, les identifiants d'événements sont rendus (`evenements`) et l'appelant
// appelle `repartirApresValidation` après sa transaction.

export * from './reservation-regles'

export type EntreeReservation = {
  /** Passage en caisse (id d'un autre module, sans clé étrangère). */
  passageId: string
  /** Slugs des œuvres du passage. */
  slugs: string[]
  origine: OrigineReservation
  /** Obligatoire sauf pour `paiement` (durée de `reglages`). */
  echeance?: Date
  /** Adresse de l'acheteur : seule son empreinte salée est écrite. */
  email?: string
  /** Valeur opaque fournie par l'appelant ; absente, pas de contrôle par appareil. */
  appareil?: string
  maintenant?: Date
}

export type ReservationPosee = { slug: string; artworkId: string; echeance: Date; nouvelle: boolean }

export type ResultatReservation =
  | { ok: true; reservations: ReservationPosee[]; evenements: string[] }
  | { ok: false; code: 'oeuvre_indisponible'; slug: string }
  | { ok: false; code: Exclude<CodeRefusReservation, 'oeuvre_indisponible'> }

export type ResultatLiberation = { liberees: number; evenements: string[] }

type LigneOeuvre = {
  id: string
  artistId: string
  slug: string
  publication: string | null
  disponibilite: string | null
  accordSigneLe: Date | null
  active: boolean
}

function empreinte(type: 'reservation-email' | 'reservation-appareil', valeur: string): string {
  const sel = process.env.AUTH_SECRET ?? ''
  return `${type}:${createHash('sha256').update(`${sel}:${valeur}`).digest('hex')}`
}

/** Exécute `fn` dans `tx` s'il est fourni, sinon dans une transaction propre suivie de la répartition. */
async function dansTransaction<T extends { evenements: string[] }>(
  tx: Prisma.TransactionClient | undefined,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (tx) return fn(tx)
  const resultat = await prisma.$transaction(fn, { maxWait: 5000, timeout: 20000 })
  await repartirApresValidation(resultat.evenements)
  return resultat
}

// Verrou consultatif de transaction : deux réservations simultanées du même e-mail ou appareil se
// suivent, le plafond ne se contourne pas par concurrence. `$executeRaw` : `$queryRaw` ne lit pas `void`.
async function verrouillerCle(tx: Prisma.TransactionClient, cle: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${cle}, 0))`
}

async function lireEtVerrouiller(tx: Prisma.TransactionClient, ids: string[]): Promise<LigneOeuvre[]> {
  if (ids.length === 0) return []
  // Ordre fixe (id) : deux transactions qui se croisent ne se bloquent jamais mutuellement.
  return tx.$queryRaw<LigneOeuvre[]>`
    SELECT a."id", a."artistId", a."slug", a."publication"::text AS publication,
           a."disponibilite"::text AS disponibilite, r."accordSigneLe", r."active"
    FROM "Artwork" a JOIN "Artist" r ON r."id" = a."artistId"
    WHERE a."id" = ANY(${ids}) ORDER BY a."id" FOR UPDATE OF a`
}

/**
 * Libère des réservations actives (issue donnée) dans `tx`, œuvres verrouillées dans l'ordre des id.
 * Chaque réservation n'est fermée que si elle est encore active, et l'œuvre ne repasse à `disponible`
 * que si elle est encore `reservee` (une déclaration « vendue ailleurs » ou « retirée » entre-temps
 * n'est jamais écrasée). Un événement par œuvre dont l'axe a changé.
 */
async function libererLignes(
  tx: Prisma.TransactionClient,
  reservations: { id: string; artworkId: string }[],
  issue: IssueReservation,
  maintenant: Date,
  par: string | null = null,
): Promise<ResultatLiberation> {
  const ids = [...new Set(reservations.map((r) => r.artworkId))].sort()
  const oeuvres = await lireEtVerrouiller(tx, ids)
  const evenements: string[] = []
  let liberees = 0
  for (const o of oeuvres) {
    const fermees = await tx.reservation.updateMany({
      where: { id: { in: reservations.filter((r) => r.artworkId === o.id).map((r) => r.id) }, issue: null },
      data: { issue, issueLe: maintenant, issuePar: par },
    })
    if (fermees.count === 0) continue
    liberees += fermees.count
    const remise = await tx.artwork.updateMany({ where: { id: o.id, disponibilite: 'reservee' }, data: { disponibilite: 'disponible' } })
    if (remise.count === 1) {
      evenements.push(await ecrireEvenement(tx, { nom: 'DisponibiliteChangee', charge: { artworkId: o.id, artistId: o.artistId } }))
    }
  }
  return { liberees, evenements }
}

/**
 * Réserve en bloc les œuvres d'un passage en caisse : toutes ou aucune. Une œuvre non visible, non
 * disponible ou réservée par un autre passage refuse tout (`oeuvre_indisponible`, slug nommé) ; une
 * réservation d'un autre passage échue est libérée (issue `expiree`) dans cette même transaction ; une
 * réservation active du même passage compte comme faite (appel répété, aucune ligne en plus). Pour
 * l'origine `paiement`, plafond par e-mail et par appareil (`plafond_atteint`). Rien n'est écrit en
 * cas de refus : les décisions sont prises avant la première écriture.
 */
export async function reserverOeuvres(entree: EntreeReservation, tx?: Prisma.TransactionClient): Promise<ResultatReservation> {
  const slugs = [...new Set((Array.isArray(entree.slugs) ? entree.slugs : []).filter((s): s is string => typeof s === 'string' && s !== ''))]
  if (slugs.length === 0) return { ok: false, code: 'liste_vide' }
  if (typeof entree.passageId !== 'string' || entree.passageId === '') return { ok: false, code: 'invalide' }
  const maintenant = entree.maintenant ?? new Date()
  const echeance = entree.echeance ?? (entree.origine === 'paiement' ? echeanceApres(maintenant, DUREE_RESERVATION_PAIEMENT_MINUTES) : null)
  if (!echeance || echeance.getTime() <= maintenant.getTime()) return { ok: false, code: 'invalide' }
  const emailNormalise = typeof entree.email === 'string' ? normaliserEmailReservation(entree.email) : ''
  const appareilNormalise = typeof entree.appareil === 'string' ? entree.appareil.trim() : ''
  const empreinteEmail = emailNormalise ? empreinte('reservation-email', emailNormalise) : null
  const empreinteAppareil = appareilNormalise ? empreinte('reservation-appareil', appareilNormalise) : null

  const interne = await dansTransaction(tx, async (t): Promise<{ resultat: ResultatReservation; evenements: string[] }> => {
    const refus = (code: Exclude<CodeRefusReservation, 'oeuvre_indisponible'>) => ({ resultat: { ok: false as const, code }, evenements: [] })
    const indisponible = (slug: string) => ({ resultat: { ok: false as const, code: 'oeuvre_indisponible' as const, slug }, evenements: [] })

    if (entree.origine === 'paiement') {
      for (const cle of [empreinteEmail, empreinteAppareil].filter((c): c is string => c !== null).sort()) await verrouillerCle(t, cle)
    }

    // Œuvres verrouillées (id lus sans verrou, puis lignes verrouillées dans l'ordre des id).
    const trouvees = await t.artwork.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } })
    const parSlug = new Map(trouvees.map((o) => [o.slug, o.id]))
    for (const slug of slugs) if (!parSlug.has(slug)) return indisponible(slug)
    const oeuvres = await lireEtVerrouiller(t, trouvees.map((o) => o.id))
    const ligneDe = new Map(oeuvres.map((o) => [o.slug, o]))

    const actives = await t.reservation.findMany({
      where: { artworkId: { in: oeuvres.map((o) => o.id) }, issue: null },
      select: { id: true, artworkId: true, passageId: true, echeance: true },
    })
    const activeDe = new Map(actives.map((r) => [r.artworkId, r]))

    const aReserver: LigneOeuvre[] = []
    const aLiberer: { id: string; artworkId: string }[] = []
    const dejaFaites: { slug: string; artworkId: string; echeance: Date }[] = []
    for (const slug of slugs) {
      const o = ligneDe.get(slug)
      if (!o) return indisponible(slug)
      const active = activeDe.get(o.id)
      if (active?.passageId === entree.passageId && !estEchue(active.echeance, maintenant)) {
        // Le passage tient déjà cette œuvre (non échue) : succès, sans seconde ligne, si elle est encore réservée.
        if (o.disponibilite !== 'reservee') return indisponible(slug)
        dejaFaites.push({ slug, artworkId: o.id, echeance: active.echeance })
        continue
      }
      let dispo = o.disponibilite
      if (active) {
        if (active.passageId !== entree.passageId && !estEchue(active.echeance, maintenant)) return indisponible(slug)
        aLiberer.push({ id: active.id, artworkId: o.id })
        // Après libération, l'œuvre redevient disponible seulement si elle était encore réservée.
        if (dispo === 'reservee') dispo = 'disponible'
      }
      const etat = { publication: o.publication as 'publiee' | null, disponibilite: dispo as 'disponible' | null }
      if (!estVisible({ ...etat, artist: { accordSigneLe: o.accordSigneLe, active: o.active } }) || !estDisponible(etat)) {
        return indisponible(slug)
      }
      aReserver.push(o)
    }

    // Plafond (origine paiement) : réservations actives d'autres passages, échéance comprise.
    if (entree.origine === 'paiement' && aReserver.length > 0) {
      const compter = (champ: 'empreinteEmail' | 'empreinteAppareil', valeur: string) =>
        t.reservation.count({
          where: { [champ]: valeur, origine: 'paiement', issue: null, echeance: { gt: maintenant } },
        })
      if (empreinteEmail && plafondDepasse(await compter('empreinteEmail', empreinteEmail), aReserver.length, PLAFONDS_RESERVATION.parEmail)) {
        return refus('plafond_atteint')
      }
      if (empreinteAppareil && plafondDepasse(await compter('empreinteAppareil', empreinteAppareil), aReserver.length, PLAFONDS_RESERVATION.parAppareil)) {
        return refus('plafond_atteint')
      }
    }

    // Écritures : libération des échues, puis réservation conditionnelle `disponible` → `reservee`.
    const evenements: string[] = []
    if (aLiberer.length > 0) {
      // Libération de l'échue puis nouvelle réservation, dans la même transaction (événements des deux étapes).
      evenements.push(...(await libererLignes(t, aLiberer, 'expiree', maintenant)).evenements)
    }
    const posees: ReservationPosee[] = []
    for (const o of aReserver) {
      const changement = await t.artwork.updateMany({ where: { id: o.id, disponibilite: 'disponible' }, data: { disponibilite: 'reservee' } })
      if (changement.count !== 1) {
        // Filet : jamais atteint sous le verrou de ligne ; annule la transaction entière.
        throw new Error('reservation_conflit')
      }
      await t.reservation.create({
        data: { artworkId: o.id, passageId: entree.passageId, origine: entree.origine, echeance, empreinteEmail, empreinteAppareil },
      })
      evenements.push(await ecrireEvenement(t, { nom: 'DisponibiliteChangee', charge: { artworkId: o.id, artistId: o.artistId } }))
      posees.push({ slug: o.slug, artworkId: o.id, echeance, nouvelle: true })
    }
    return { resultat: { ok: true, reservations: [...dejaFaites.map((d) => ({ ...d, nouvelle: false })), ...posees], evenements }, evenements }
  })
  return interne.resultat
}

/**
 * Libère les réservations actives d'un passage (issue `liberee` par défaut) : les œuvres encore
 * `reservee` redeviennent `disponible`, une œuvre déclarée vendue ailleurs ou retirée n'est pas touchée.
 * Idempotent : sans réservation active, rien ne change.
 */
export async function libererReservation(
  passageId: string,
  options: { issue?: Extract<IssueReservation, 'liberee' | 'expiree'>; maintenant?: Date; /** Utilisateur qui libère (journal). */ par?: string; /** Story 6.5 : ne libère que ces œuvres du passage (annulation d'une commande). */ artworkIds?: readonly string[] } = {},
  tx?: Prisma.TransactionClient,
): Promise<ResultatLiberation> {
  const maintenant = options.maintenant ?? new Date()
  return dansTransaction(tx, async (t) => {
    const actives = await t.reservation.findMany({
      where: { passageId, issue: null, ...(options.artworkIds ? { artworkId: { in: [...options.artworkIds] } } : {}) },
      select: { id: true, artworkId: true },
    })
    return libererLignes(t, actives, options.issue ?? 'liberee', maintenant, options.par ?? null)
  })
}

/** Libère les réservations échues (issue `expiree`). Le balayage planifié de la story 6.7 l'appellera. */
export async function libererReservationsEchues(maintenant: Date = new Date(), tx?: Prisma.TransactionClient): Promise<ResultatLiberation> {
  return dansTransaction(tx, async (t) => {
    const echues = await t.reservation.findMany({ where: { issue: null, echeance: { lte: maintenant } }, select: { id: true, artworkId: true } })
    return libererLignes(t, echues, 'expiree', maintenant)
  })
}

/**
 * Réservations encore actives d'un passage (issue vide), échues ou non : lecture seule, sans contrôle
 * d'acteur (l'appelant le fait). Story 6.3 : le lien de la vente assistée et sa page en dépendent.
 */
export async function reservationsActivesDuPassage(
  passageId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<{ artworkId: string; origine: OrigineReservation; echeance: Date }[]> {
  if (typeof passageId !== 'string' || passageId === '') return []
  return tx.reservation.findMany({
    where: { passageId, issue: null },
    select: { artworkId: true, origine: true, echeance: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
}

export type ReservationLue = {
  id: string
  passageId: string
  artworkId: string
  slug: string
  titre: string
  origine: OrigineReservation
  echeance: Date
  issue: IssueReservation | null
  issueLe: Date | null
  /** Identifiant de l'utilisateur qui a libéré ; vide si l'issue est automatique. */
  issuePar: string | null
}

export const NOMBRE_TERMINEES_ADMIN = 50

/**
 * Réservations pour l'équipe (story 6.3 bis) : toutes les actives (échues comprises, tant qu'elles ne sont
 * pas fermées) et les 50 dernières terminées. Admin seulement, vérifié ici à partir de l'acteur ; sinon null.
 */
export async function reservationsPourAdmin(
  acteur: { type: string },
): Promise<{ enCours: ReservationLue[]; terminees: ReservationLue[] } | null> {
  if (acteur.type !== 'admin') return null
  const select = {
    id: true, passageId: true, artworkId: true, origine: true, echeance: true, issue: true, issueLe: true, issuePar: true,
    artwork: { select: { slug: true, title: true } },
  } as const
  const [actives, terminees] = await Promise.all([
    prisma.reservation.findMany({ where: { issue: null }, select, orderBy: [{ echeance: 'asc' }, { id: 'asc' }] }),
    prisma.reservation.findMany({ where: { issue: { not: null } }, select, orderBy: [{ issueLe: 'desc' }, { id: 'desc' }], take: NOMBRE_TERMINEES_ADMIN }),
  ])
  const lire = ({ artwork, ...r }: (typeof actives)[number]): ReservationLue => ({ ...r, slug: artwork.slug, titre: artwork.title })
  return { enCours: actives.map(lire), terminees: terminees.map(lire) }
}

export type ResultatVente =
  | { ok: true; evenements: string[] }
  | { ok: false; code: 'oeuvre_indisponible'; artworkId: string }

/**
 * Vend les œuvres d'un passage payé (story 6.4, FR-13), dans la transaction de l'appelant : œuvres
 * verrouillées dans l'ordre des id, toutes décidées avant la première écriture, puis mise à jour
 * conditionnelle vers `vendue` et fermeture `confirmee` de la réservation du passage. Une œuvre n'est
 * vendable que si elle est `reservee` par ce passage ou `disponible` ; une œuvre vendue, vendue ailleurs
 * ou retirée, ou réservée par un autre passage non échu, refuse tout (`oeuvre_indisponible`, id nommé,
 * rien d'écrit). Une réservation échue d'un autre passage est fermée (`expiree`). Aucun contrôle
 * d'acteur : l'appelant (`commandes`) le fait. L'appelant répartit les événements après sa transaction.
 */
export async function vendreOeuvresDuPassage(
  passageId: string,
  artworkIds: readonly string[],
  tx: Prisma.TransactionClient,
  maintenant: Date = new Date(),
): Promise<ResultatVente> {
  const ids = [...new Set(artworkIds)].sort()
  if (ids.length === 0) return { ok: true, evenements: [] }
  const oeuvres = await lireEtVerrouiller(tx, ids)
  const parId = new Map(oeuvres.map((o) => [o.id, o]))
  const actives = await tx.reservation.findMany({
    where: { artworkId: { in: ids }, issue: null },
    select: { id: true, artworkId: true, passageId: true, echeance: true },
  })
  const activeDe = new Map(actives.map((r) => [r.artworkId, r]))

  const aVendre: { o: LigneOeuvre; reservationId: string | null; autreEchue: string | null }[] = []
  for (const id of ids) {
    const o = parId.get(id)
    if (!o) return { ok: false, code: 'oeuvre_indisponible', artworkId: id }
    const active = activeDe.get(id)
    const autre = active && active.passageId !== passageId ? active : null
    if (autre && !estEchue(autre.echeance, maintenant)) return { ok: false, code: 'oeuvre_indisponible', artworkId: id }
    const propre = active && active.passageId === passageId ? active : null
    const vendable = propre ? o.disponibilite === 'reservee' : o.disponibilite === 'disponible' || (autre !== null && o.disponibilite === 'reservee')
    if (!vendable) return { ok: false, code: 'oeuvre_indisponible', artworkId: id }
    // Visibilité relue sous le verrou (publiée, non retirée, artiste actif avec accord signé).
    const visible = estVisible({
      publication: o.publication as 'publiee' | null,
      disponibilite: o.disponibilite as 'disponible' | null,
      artist: { accordSigneLe: o.accordSigneLe, active: o.active },
    })
    if (!visible) return { ok: false, code: 'oeuvre_indisponible', artworkId: id }
    aVendre.push({ o, reservationId: propre?.id ?? null, autreEchue: autre?.id ?? null })
  }

  const evenements: string[] = []
  for (const { o, reservationId, autreEchue } of aVendre) {
    if (autreEchue) await tx.reservation.updateMany({ where: { id: autreEchue, issue: null }, data: { issue: 'expiree', issueLe: maintenant } })
    const changement = await tx.artwork.updateMany({
      where: { id: o.id, disponibilite: { in: ['reservee', 'disponible'] } },
      data: { disponibilite: 'vendue' },
    })
    // Filet : jamais atteint sous le verrou de ligne ; annule la transaction entière.
    if (changement.count !== 1) throw new Error('vente_conflit')
    if (reservationId) {
      await tx.reservation.updateMany({ where: { id: reservationId, issue: null }, data: { issue: 'confirmee', issueLe: maintenant } })
    }
    evenements.push(await ecrireEvenement(tx, { nom: 'DisponibiliteChangee', charge: { artworkId: o.id, artistId: o.artistId } }))
  }
  return { ok: true, evenements }
}
