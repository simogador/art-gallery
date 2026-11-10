import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { DISPONIBLE, VISIBLE } from '@/lib/disponibilite'
import { ecrireEvenement, repartirApresValidation } from '@/lib/evenements'
import { DOUBLON_DEMANDE_MINUTES, LIMITES_DEMANDE_VISITE } from '@/lib/reglages'
import { validerVisite, type ErreursVisite } from './visite-regles'

// Demande de visite d'une œuvre, à distance ou en atelier (story 4.3, FR-8, UJ-4). Même modèle que la
// demande de sélection (story 4.2) : le module demandes est seul propriétaire de ces données et des
// coordonnées du visiteur ; jamais d'adresse, de téléphone ni de créneau dans les journaux ni dans
// l'événement (id de la demande seulement) ; limites d'envoi sur des empreintes salées (clés
// `visite-ip:`/`visite-email:` de `TentativeInscription`). La visite est organisée par l'équipe : les
// coordonnées de l'artiste ne sont jamais lues ici.

export type ResultatDemandeVisite =
  | { ok: true }
  | { ok: false; code: 'invalide'; erreurs: ErreursVisite }
  | { ok: false; code: 'trop_de_demandes' | 'oeuvre_indisponible' }

function empreinte(type: 'visite-ip' | 'visite-email', valeur: string): string {
  const sel = process.env.AUTH_SECRET ?? ''
  return `${type}:${createHash('sha256').update(`${sel}:${valeur}`).digest('hex')}`
}

/** Œuvre qu'on peut demander à visiter : visible et disponible (relue en base, hors cache). */
async function oeuvreVisitable(slug: unknown): Promise<{ id: string; atelierAccepte: boolean } | null> {
  if (typeof slug !== 'string' || slug === '' || slug.length > 200) return null
  // `AND` : `VISIBLE` porte une clé `artist` qu'un étalement à côté d'une autre écraserait.
  const oeuvre = await prisma.artwork.findFirst({
    where: { slug, AND: [VISIBLE, DISPONIBLE] },
    select: { id: true, visitesAtelier: true },
  })
  return oeuvre ? { id: oeuvre.id, atelierAccepte: oeuvre.visitesAtelier === true } : null
}

/**
 * Enregistre une demande de visite valide, rattachée à l'œuvre, à l'état `nouvelle`, et écrit
 * l'événement `DemandeVisiteRecue` dans la même transaction, puis le répartit (accusé au visiteur,
 * alerte à l'équipe) avant de rendre la main. Œuvre inconnue, non visible ou non disponible :
 * `oeuvre_indisponible`. « En atelier » pour une œuvre dont l'artiste ne l'accepte pas, créneaux ou
 * coordonnées fautifs : `invalide`, rien d'enregistré ni compté. Au-delà du seuil par IP ou par
 * e-mail : `trop_de_demandes`. Un envoi identique répété dans `DOUBLON_DEMANDE_MINUTES` ne crée pas
 * de seconde demande.
 */
export async function enregistrerDemandeVisite(
  slug: unknown,
  brut: unknown,
  ip: string | null,
  maintenant = new Date(),
): Promise<ResultatDemandeVisite> {
  const oeuvre = await oeuvreVisitable(slug)
  if (!oeuvre) return { ok: false, code: 'oeuvre_indisponible' }
  const lu = validerVisite(brut, { atelierAccepte: oeuvre.atelierAccepte, maintenant })
  if (!lu.ok) return { ok: false, code: 'invalide', erreurs: lu.erreurs }
  const { valeur } = lu

  // Limites souples (comme la sélection) ; IP absente : une clé commune.
  const { fenetreMinutes, parIp, parEmail } = LIMITES_DEMANDE_VISITE
  const depuis = new Date(maintenant.getTime() - fenetreMinutes * 60_000)
  const cles = [
    { cle: empreinte('visite-ip', ip ?? 'inconnue'), seuil: parIp },
    { cle: empreinte('visite-email', valeur.email), seuil: parEmail },
  ]
  for (const { cle, seuil } of cles) {
    if ((await prisma.tentativeInscription.count({ where: { cle, createdAt: { gte: depuis } } })) >= seuil) {
      return { ok: false, code: 'trop_de_demandes' }
    }
  }
  await prisma.$transaction([
    // Seulement les traces de ce formulaire : les autres ont leur propre fenêtre.
    prisma.tentativeInscription.deleteMany({ where: { cle: { startsWith: 'visite-' }, createdAt: { lt: depuis } } }),
    prisma.tentativeInscription.createMany({ data: cles.map(({ cle }) => ({ cle })) }),
  ])

  const evenementId = await prisma.$transaction(async (tx): Promise<string | null> => {
    // Deux envois simultanés du même e-mail se suivent : le second voit le premier.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`demande-visite:${valeur.email}`}))`
    const doublon = await tx.demandeVisite.findFirst({
      where: {
        artworkId: oeuvre.id,
        email: valeur.email,
        type: valeur.type,
        // Tout ce qui est enregistré : une demande corrigée n'est pas absorbée comme un doublon.
        creneaux: { equals: valeur.creneaux },
        fuseau: valeur.fuseau,
        telephone: valeur.telephone,
        createdAt: { gte: new Date(maintenant.getTime() - DOUBLON_DEMANDE_MINUTES * 60_000) },
      },
      select: { id: true },
    })
    if (doublon) return null
    const demande = await tx.demandeVisite.create({
      data: {
        artworkId: oeuvre.id,
        type: valeur.type,
        creneaux: valeur.creneaux,
        fuseau: valeur.fuseau,
        email: valeur.email,
        telephone: valeur.telephone,
      },
      select: { id: true },
    })
    return ecrireEvenement(tx, { nom: 'DemandeVisiteRecue', charge: { demandeId: demande.id } })
  })
  if (evenementId) await repartirApresValidation([evenementId])
  return { ok: true }
}
