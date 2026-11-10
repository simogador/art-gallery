import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import type { Acteur } from '@/lib/acces'
import {
  consommerJetonDesinscriptionAlerte,
  emettreJetonDesinscriptionAlerte,
  lienDesinscriptionAlerteBienForme,
  revoquerJetonDesinscriptionAlerte,
} from '@/lib/acces/desinscription-alerte'
import { RESERVEE, SORTIE_DE_VENTE, VISIBLE } from '@/lib/disponibilite'
import { ecrireEvenement, repartirApresValidation } from '@/lib/evenements'
import { LIMITES_INSCRIPTION_PREVENIR } from '@/lib/reglages'
import { rangParmi, validerPrevenir, type ErreursPrevenir } from './prevenir-regles'

// Inscription « Me prévenir » sur une œuvre réservée (story 4.5, FR-9). Même modèle que la demande de
// visite (4.3) : le module demandes est seul propriétaire de `InscriptionPrevenir` ; jamais d'adresse
// ni d'IP dans les journaux ni dans l'événement (id de l'inscription seulement) ; limites d'envoi sur
// des empreintes salées (clés `prevenir-ip:`/`prevenir-email:` de `TentativeInscription`). L'ordre
// d'arrivée se calcule d'après la date d'arrivée (aucun numéro stocké) : si un inscrit se retire,
// les suivants avancent. Rien n'est envoyé quand l'œuvre redevient disponible (Epic 6).

export type ResultatInscriptionPrevenir =
  | { ok: true }
  | { ok: false; code: 'invalide'; erreurs: ErreursPrevenir }
  | { ok: false; code: 'trop_de_demandes' | 'oeuvre_indisponible' }

function empreinte(type: 'prevenir-ip' | 'prevenir-email', valeur: string): string {
  const sel = process.env.AUTH_SECRET ?? ''
  return `${type}:${createHash('sha256').update(`${sel}:${valeur}`).digest('hex')}`
}

/** Œuvre pour laquelle on peut s'inscrire : visible et réservée (relue en base, hors cache). */
async function oeuvreReservee(slug: unknown): Promise<{ id: string } | null> {
  if (typeof slug !== 'string' || slug === '' || slug.length > 200) return null
  // `AND` : `VISIBLE` porte une clé `artist` qu'un étalement à côté d'une autre écraserait.
  return prisma.artwork.findFirst({ where: { slug, AND: [VISIBLE, RESERVEE] }, select: { id: true } })
}

/**
 * Inscrit l'e-mail sur une œuvre réservée et écrit l'événement `InscriptionPrevenirRecue` dans la même
 * transaction, puis le répartit (e-mail de confirmation) avant de rendre la main. Œuvre inconnue,
 * non visible ou non réservée : `oeuvre_indisponible`. E-mail invalide : `invalide`, rien d'enregistré
 * ni compté. Au-delà du seuil par IP ou par e-mail : `trop_de_demandes`. Un e-mail déjà inscrit sur
 * cette œuvre garde sa place, ne crée ni doublon ni événement, et reçoit le même résultat.
 */
export async function enregistrerInscriptionPrevenir(
  brut: unknown,
  contexte: { ip: string | null; slug: unknown },
  maintenant = new Date(),
): Promise<ResultatInscriptionPrevenir> {
  const oeuvre = await oeuvreReservee(contexte.slug)
  if (!oeuvre) return { ok: false, code: 'oeuvre_indisponible' }
  const lu = validerPrevenir(brut)
  if (!lu.ok) return { ok: false, code: 'invalide', erreurs: lu.erreurs }
  const { email } = lu.valeur

  // Limites souples ; IP absente : une clé commune.
  const { fenetreMinutes, parIp, parEmail } = LIMITES_INSCRIPTION_PREVENIR
  const depuis = new Date(maintenant.getTime() - fenetreMinutes * 60_000)
  const cles = [
    { cle: empreinte('prevenir-ip', contexte.ip ?? 'inconnue'), seuil: parIp },
    { cle: empreinte('prevenir-email', email), seuil: parEmail },
  ]
  for (const { cle, seuil } of cles) {
    if ((await prisma.tentativeInscription.count({ where: { cle, createdAt: { gte: depuis } } })) >= seuil) {
      return { ok: false, code: 'trop_de_demandes' }
    }
  }
  await prisma.$transaction([
    // Seulement les traces de ce formulaire : les autres ont leur propre fenêtre.
    prisma.tentativeInscription.deleteMany({ where: { cle: { startsWith: 'prevenir-' }, createdAt: { lt: depuis } } }),
    prisma.tentativeInscription.createMany({ data: cles.map(({ cle }) => ({ cle })) }),
  ])

  const resultat = await prisma.$transaction(async (tx): Promise<{ indisponible: true } | { evenementId: string | null }> => {
    // Verrou partagé sur la ligne de l'œuvre jusqu'à la fin de la transaction : une vente concurrente
    // attend l'inscription, puis son gestionnaire la supprime ; une vente déjà validée est vue par la relecture.
    await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Artwork" WHERE "id" = ${oeuvre.id} FOR SHARE`
    // L'œuvre est relue dans la transaction : elle a pu quitter l'état réservé depuis le premier contrôle.
    if (!(await tx.artwork.findFirst({ where: { id: oeuvre.id, AND: [VISIBLE, RESERVEE] }, select: { id: true } }))) return { indisponible: true }
    // ON CONFLICT DO NOTHING : deux envois simultanés du même e-mail ne créent qu'une inscription.
    const { count } = await tx.inscriptionPrevenir.createMany({ data: [{ artworkId: oeuvre.id, email }], skipDuplicates: true })
    if (count !== 1) return { evenementId: null }
    const inscription = await tx.inscriptionPrevenir.findUniqueOrThrow({
      where: { artworkId_email: { artworkId: oeuvre.id, email } },
      select: { id: true },
    })
    return { evenementId: await ecrireEvenement(tx, { nom: 'InscriptionPrevenirRecue', charge: { inscriptionId: inscription.id } }) }
  })
  if ('indisponible' in resultat) return { ok: false, code: 'oeuvre_indisponible' }
  if (resultat.evenementId) await repartirApresValidation([resultat.evenementId])
  return { ok: true }
}

/** Rang d'une inscription (à partir de 1, le plus ancien d'abord) ; null si elle n'existe pas. */
export async function rangInscriptionPrevenir(inscriptionId: string): Promise<number | null> {
  const inscription = await prisma.inscriptionPrevenir.findUnique({ where: { id: inscriptionId }, select: { artworkId: true } })
  if (!inscription) return null
  const toutes = await prisma.inscriptionPrevenir.findMany({ where: { artworkId: inscription.artworkId }, select: { id: true, createdAt: true } })
  return rangParmi(inscriptionId, toutes)
}

export type OeuvreAvecInscriptions = {
  artworkId: string
  titre: string
  slug: string
  nombre: number
  /** Du plus ancien au plus récent ; `rang` à partir de 1. */
  inscrits: { rang: number; email: string; recueLe: Date }[]
}
export type ResultatInscriptionsParOeuvre =
  | { ok: true; oeuvres: OeuvreAvecInscriptions[] }
  | { ok: false; code: 'acces_refuse' | 'inscriptions_indisponibles' }

/**
 * Les inscriptions « Me prévenir » par œuvre (nombre et ordre d'arrivée, adresses comprises), pour
 * l'équipe : admin seulement (acteur relu en base, AD-15). Les œuvres sont classées par première
 * inscription. Les adresses ne sont jamais journalisées.
 */
export async function inscriptionsParOeuvre(acteur: Acteur): Promise<ResultatInscriptionsParOeuvre> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  try {
    // Déjà du plus ancien au plus récent (départage par id) : l'ordre vient de la base.
    const lignes = await prisma.inscriptionPrevenir.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, email: true, createdAt: true, artwork: { select: { id: true, title: true, slug: true } } },
    })
    const parOeuvre = new Map<string, OeuvreAvecInscriptions>()
    for (const l of lignes) {
      let o = parOeuvre.get(l.artwork.id)
      if (!o) {
        o = { artworkId: l.artwork.id, titre: l.artwork.title, slug: l.artwork.slug, nombre: 0, inscrits: [] }
        parOeuvre.set(l.artwork.id, o)
      }
      o.nombre += 1
      o.inscrits.push({ rang: o.nombre, email: l.email, recueLe: l.createdAt })
    }
    return { ok: true, oeuvres: [...parOeuvre.values()] }
  } catch (erreur) {
    // Nom et code seulement : jamais d'adresse. La file des demandes, elle, reste affichée.
    console.error('[prevenir] inscriptions_indisponibles', erreur instanceof Error ? erreur.name : 'inconnue', (erreur as { code?: string } | null)?.code ?? '')
    return { ok: false, code: 'inscriptions_indisponibles' }
  }
}

/** L'inscription à confirmer (adresse et titre lus en base à l'envoi) avec son lien de désinscription émis maintenant. */
export type ConfirmationAEnvoyer = { jeton: string; email: string; titre: string }

/**
 * Prépare l'e-mail de confirmation (réservé au gestionnaire de l'événement, qui ne reçoit que des ids) :
 * lit l'adresse et le titre en base et émet le lien de désinscription au moment de l'envoi. null si
 * l'inscription n'existe plus (désinscrite ou œuvre sortie de la vente entre-temps).
 */
export async function preparerConfirmationPrevenir(inscriptionId: string): Promise<ConfirmationAEnvoyer | null> {
  return prisma.$transaction(async (tx) => {
    const inscription = await tx.inscriptionPrevenir.findUnique({
      where: { id: inscriptionId },
      select: { email: true, artwork: { select: { title: true } } },
    })
    if (!inscription) return null
    const jeton = await emettreJetonDesinscriptionAlerte(tx, inscriptionId)
    return { jeton, email: inscription.email, titre: inscription.artwork.title }
  })
}

/** L'e-mail n'est pas parti : le lien émis est révoqué (l'inscription reste). */
export async function abandonnerConfirmationPrevenir(inscriptionId: string): Promise<void> {
  await prisma.$transaction((tx) => revoquerJetonDesinscriptionAlerte(tx, inscriptionId))
}

/**
 * Désinscription par le lien de l'e-mail (page publique) : le jeton est consommé une seule fois et
 * l'inscription, si elle est encore là, est supprimée. `true` seulement si le lien était utilisable.
 */
export async function desinscrirePrevenir(jeton: string): Promise<boolean> {
  if (!lienDesinscriptionAlerteBienForme(jeton)) return false
  return prisma.$transaction(async (tx) => {
    const inscriptionId = await consommerJetonDesinscriptionAlerte(tx, jeton)
    if (!inscriptionId) return false
    await tx.inscriptionPrevenir.deleteMany({ where: { id: inscriptionId } })
    return true
  })
}

/**
 * Supprime les inscriptions d'une œuvre sortie de la vente (vendue, vendue ailleurs, retirée) : l'état
 * est relu en base (une œuvre disponible ou réservée ne perd rien). Renvoie le nombre supprimé.
 * Idempotent, rejouable.
 */
export async function retirerInscriptionsPrevenirSiSortie(artworkId: string): Promise<number> {
  const sortie = await prisma.artwork.findFirst({ where: { id: artworkId, AND: [SORTIE_DE_VENTE] }, select: { id: true } })
  if (!sortie) return 0
  const { count } = await prisma.inscriptionPrevenir.deleteMany({ where: { artworkId } })
  return count
}
