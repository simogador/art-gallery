import { prisma } from '@/lib/prisma'
import type { Acteur } from '@/lib/acces'
import { ecrireEvenement, repartirApresValidation } from '@/lib/evenements'
import { nomPays } from '@/lib/livraison/pays'
import { SEUIL_ASSURANCE } from '@/lib/reglages'
import { transitionPermise } from './etats'
import { assuranceRequise } from './expedition-regles'
import { echeanceDepassee, prenom } from './prise-en-charge-regles'

// Prise en charge des commandes par l'artiste (story 8.1, FR-22, AD-9, AD-10, AD-15, AD-16, UJ-2). L'accès est
// décidé ici à partir de l'acteur relu en base (`acteurCourant`) : seul un artiste, pour les commandes de SES
// œuvres (`Commande.artistId`), et seulement `confirmee` ou `prise_en_charge` ; toute autre commande est
// `introuvable`, sans dire si elle existe. Données de l'acheteur filtrées à la source (AD-16) : prénom et pays
// toujours ; adresse et téléphone SEULEMENT pour une commande `prise_en_charge` ; e-mail jamais. Aucun montant
// lu ni additionné. Transition `confirmee` → `prise_en_charge` par la table de `etats.ts`, mise à jour
// conditionnelle sous le verrou du passage, auteur et date, événement `CommandePriseEnCharge` dans la
// transaction, répartition attendue après. Journaux : ids seulement.

export type EtatCommandeArtiste = 'confirmee' | 'prise_en_charge' | 'expediee'

const ETATS_ARTISTE: EtatCommandeArtiste[] = ['confirmee', 'prise_en_charge', 'expediee']
const LONGUEUR_NUMERO_MAX = 64

export type CommandeDeLArtiste = {
  numero: string
  etat: EtatCommandeArtiste
  /** Titres figés des œuvres de la commande. */
  oeuvres: string[]
  /** Premier mot du nom saisi par l'acheteur (« — » s'il est vide). */
  prenom: string
  /** Code ISO du pays de livraison et son nom français. */
  pays: { code: string; nom: string }
  /** Échéance de prise en charge (stockée à la confirmation) ; null pour une commande d'avant la story 8.1. */
  priseEnChargeAvant: Date | null
  /** Échéance passée et commande pas encore prise en charge (calculé à la lecture). */
  echeanceDepassee: boolean
  priseEnChargeLe: Date | null
  /** Date d'expédition (story 8.2) ; null avant. */
  expedieeLe: Date | null
}

/**
 * Détail d'une commande : `adresse` et `telephone` n'existent que pour une commande `prise_en_charge` ou
 * `expediee` (AD-16) ; transporteur, numéro de suivi et assurance seulement pour `expediee` (story 8.2).
 */
export type DetailCommandeArtiste = CommandeDeLArtiste &
  ({ adresse?: never; telephone?: never } | { adresse: string | null; telephone: string | null }) & {
    /** Commande `prise_en_charge` seulement (story 8.2) : le prix des œuvres dépasse le seuil d'assurance. */
    assuranceRequise?: boolean
    expedition?: { transporteur: string; numeroSuivi: string; envoiAssure: boolean; referenceAssurance: string | null }
  }

export type ResultatCommandesArtiste = { ok: true; commandes: CommandeDeLArtiste[] } | { ok: false; code: 'acces_refuse' }
export type ResultatNombre = { ok: true; nombre: number } | { ok: false; code: 'acces_refuse' }
export type ResultatCommandeArtiste = { ok: true; commande: DetailCommandeArtiste } | { ok: false; code: 'acces_refuse' | 'introuvable' }
export type ResultatPriseEnCharge =
  | { ok: true; dejaPriseEnCharge: boolean }
  | { ok: false; code: 'acces_refuse' | 'introuvable' | 'etat_invalide' }

type CommandeLue = {
  numero: string
  etat: string
  priseEnChargeAvant: Date | null
  priseEnChargeLe: Date | null
  expedieeLe: Date | null
  lignes: { titre: string }[]
  passage: { paysLivraison: string; coordonnees: { nom: string } | null } | null
}

function resume(c: CommandeLue, maintenant: Date): CommandeDeLArtiste {
  const etat = c.etat as EtatCommandeArtiste
  const code = c.passage?.paysLivraison ?? ''
  return {
    numero: c.numero,
    etat,
    oeuvres: c.lignes.map((l) => l.titre),
    prenom: prenom(c.passage?.coordonnees?.nom),
    pays: { code, nom: code === '' ? '' : nomPays(code) },
    priseEnChargeAvant: c.priseEnChargeAvant,
    echeanceDepassee: etat === 'confirmee' && echeanceDepassee(c.priseEnChargeAvant, maintenant),
    priseEnChargeLe: c.priseEnChargeLe,
    expedieeLe: c.expedieeLe,
  }
}

// Sélection commune : jamais l'e-mail de l'acheteur ; l'adresse et le téléphone sont lus à part (détail seulement).
const SELECTION = {
  numero: true,
  etat: true,
  priseEnChargeAvant: true,
  priseEnChargeLe: true,
  expedieeLe: true,
  lignes: { orderBy: { createdAt: 'asc' as const }, select: { titre: true } },
  passage: { select: { paysLivraison: true, coordonnees: { select: { nom: true } } } },
}

/** Id de l'artiste de l'acteur, ou null (pas artiste, ou compte sans profil d'artiste lié). */
function artisteDe(acteur: Acteur): { refuse: true } | { refuse: false; artistId: string | null } {
  if (acteur.type !== 'artist') return { refuse: true }
  return { refuse: false, artistId: acteur.artiste?.id ?? null }
}

/**
 * Commandes `confirmee`, `prise_en_charge` et `expediee` des œuvres de l'artiste : à prendre en charge d'abord
 * (échéance la plus proche en tête), puis les prises en charge, puis les expédiées (les plus récentes en tête). Non artiste : `acces_refuse`.
 */
export async function commandesDeLArtiste(acteur: Acteur, maintenant: Date = new Date()): Promise<ResultatCommandesArtiste> {
  const lu = artisteDe(acteur)
  if (lu.refuse) return { ok: false, code: 'acces_refuse' }
  if (!lu.artistId) return { ok: true, commandes: [] }
  const [aPrendre, prises, expediees] = await Promise.all([
    prisma.commande.findMany({
      where: { artistId: lu.artistId, etat: 'confirmee', passageId: { not: null } },
      orderBy: [{ priseEnChargeAvant: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }],
      select: SELECTION,
    }),
    prisma.commande.findMany({
      where: { artistId: lu.artistId, etat: 'prise_en_charge', passageId: { not: null } },
      orderBy: [{ priseEnChargeLe: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
      select: SELECTION,
    }),
    prisma.commande.findMany({
      where: { artistId: lu.artistId, etat: 'expediee', passageId: { not: null } },
      orderBy: [{ expedieeLe: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
      select: SELECTION,
    }),
  ])
  return { ok: true, commandes: [...aPrendre, ...prises, ...expediees].map((c) => resume(c, maintenant)) }
}

/** Nombre de commandes `confirmee` de l'artiste, à prendre en charge. Non artiste : `acces_refuse`. */
export async function nombreAPrendreEnCharge(acteur: Acteur): Promise<ResultatNombre> {
  const lu = artisteDe(acteur)
  if (lu.refuse) return { ok: false, code: 'acces_refuse' }
  if (!lu.artistId) return { ok: true, nombre: 0 }
  const nombre = await prisma.commande.count({ where: { artistId: lu.artistId, etat: 'confirmee', passageId: { not: null } } })
  return { ok: true, nombre }
}

function numeroLisible(numero: unknown): numero is string {
  return typeof numero === 'string' && numero.trim() !== '' && numero.length <= LONGUEUR_NUMERO_MAX
}

/**
 * Une commande de l'artiste par son numéro. Commande d'un autre artiste, inconnue, ou dans un autre état
 * (`en_attente_paiement`, `annulee`, `historique`) : `introuvable`. Adresse et téléphone seulement pour
 * `prise_en_charge` (AD-16) : avant, les clés n'existent pas dans le résultat.
 */
export async function commandeDeLArtiste(acteur: Acteur, numero: string, maintenant: Date = new Date()): Promise<ResultatCommandeArtiste> {
  const lu = artisteDe(acteur)
  if (lu.refuse) return { ok: false, code: 'acces_refuse' }
  if (!lu.artistId || !numeroLisible(numero)) return { ok: false, code: 'introuvable' }
  const commande = await prisma.commande.findFirst({
    where: { numero: numero.trim(), artistId: lu.artistId, etat: { in: ETATS_ARTISTE }, passageId: { not: null } },
    select: { id: true, passageId: true, devise: true, transporteur: true, numeroSuivi: true, envoiAssure: true, referenceAssurance: true, ...SELECTION },
  })
  if (!commande) return { ok: false, code: 'introuvable' }
  const base = resume(commande, maintenant)
  if (commande.etat !== 'prise_en_charge' && commande.etat !== 'expediee') return { ok: true, commande: base }
  // Prise en charge et expédition : seules l'adresse et le téléphone de l'acheteur sont lus en plus, jamais son e-mail.
  const coordonnees = await prisma.coordonneesAcheteur.findUnique({
    where: { passageId: commande.passageId as string },
    select: { adresse: true, telephone: true },
  })
  // Une vente assistée enregistre '' pour un champ non saisi : vide ou blanc = non renseigné (null).
  const renseigne = (v: string | null | undefined) => (typeof v === 'string' && v.trim() !== '' ? v : null)
  const avecCoordonnees = { ...base, adresse: renseigne(coordonnees?.adresse), telephone: renseigne(coordonnees?.telephone) }
  if (commande.etat !== 'expediee') {
    // Prix des œuvres par agrégat de la base (jamais additionné ici) : décide si l'assurance est exigée.
    const somme = await prisma.ligneCommande.aggregate({ where: { commandeId: commande.id }, _sum: { prixCentimes: true } })
    return { ok: true, commande: { ...avecCoordonnees, assuranceRequise: assuranceRequise(somme._sum.prixCentimes, commande.devise, SEUIL_ASSURANCE) } }
  }
  return {
    ok: true,
    commande: {
      ...avecCoordonnees,
      expedition: {
        transporteur: commande.transporteur ?? '',
        numeroSuivi: commande.numeroSuivi ?? '',
        envoiAssure: commande.envoiAssure,
        referenceAssurance: commande.referenceAssurance,
      },
    },
  }
}

/**
 * « Je prends en charge » : `confirmee` → `prise_en_charge` (auteur, date) et événement `CommandePriseEnCharge`.
 * Rejouée (double appui, deux onglets) : succès sans effet (`dejaPriseEnCharge`), aucun second événement : les
 * deux appuis se suivent sous le verrou de la ligne du passage et la mise à jour est conditionnelle. Commande
 * d'un autre artiste ou inconnue : `introuvable` ; de l'artiste mais dans un autre état : `etat_invalide`.
 * L'échéance dépassée n'empêche jamais la prise en charge.
 */
export async function prendreEnCharge(acteur: Acteur, numero: string, maintenant: Date = new Date()): Promise<ResultatPriseEnCharge> {
  const lu = artisteDe(acteur)
  if (lu.refuse || acteur.type !== 'artist') return { ok: false, code: 'acces_refuse' }
  const artistId = lu.artistId
  if (!artistId || !numeroLisible(numero)) return { ok: false, code: 'introuvable' }
  if (!transitionPermise('confirmee', 'prise_en_charge')) throw new Error('transition_interdite')

  const interne = await prisma.$transaction(
    async (tx): Promise<{ resultat: ResultatPriseEnCharge; evenements: string[] }> => {
      const fin = (resultat: ResultatPriseEnCharge, evenements: string[] = []) => ({ resultat, evenements })
      const trouvee = await tx.commande.findUnique({ where: { numero: numero.trim() }, select: { id: true, artistId: true, passageId: true } })
      if (!trouvee || trouvee.artistId !== artistId) return fin({ ok: false, code: 'introuvable' })
      // Même verrou que le constat et l'annulation : les gestes sur un passage se suivent.
      if (trouvee.passageId) await tx.$queryRaw`SELECT "id" FROM "PassageEnCaisse" WHERE "id" = ${trouvee.passageId} FOR UPDATE`
      const commande = await tx.commande.findUnique({ where: { id: trouvee.id }, select: { etat: true, passageId: true } })
      if (!commande) return fin({ ok: false, code: 'introuvable' })
      if (commande.etat === 'prise_en_charge') return fin({ ok: true, dejaPriseEnCharge: true })
      if (commande.etat !== 'confirmee' || !commande.passageId) return fin({ ok: false, code: 'etat_invalide' })
      const maj = await tx.commande.updateMany({
        where: { id: trouvee.id, etat: 'confirmee', artistId },
        data: { etat: 'prise_en_charge', priseEnChargeLe: maintenant, priseEnChargePar: acteur.userId },
      })
      // Filet : jamais atteint sous le verrou du passage.
      if (maj.count !== 1) return fin({ ok: true, dejaPriseEnCharge: true })
      const evenement = await ecrireEvenement(tx, { nom: 'CommandePriseEnCharge', charge: { commandeId: trouvee.id } })
      return fin({ ok: true, dejaPriseEnCharge: false }, [evenement])
    },
    { maxWait: 5000, timeout: 20000 },
  )
  await repartirApresValidation(interne.evenements)
  return interne.resultat
}
