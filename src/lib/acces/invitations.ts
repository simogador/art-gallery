import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { ecrireEvenement, repartirApresValidation } from '@/lib/evenements'
import type { Acteur } from './acteur'
import { CHARTE_ARTISTE_VERSION } from './charte'
import { consommerJeton, lireJetonValide, revoquerJetons } from './jetons'
import { LONGUEUR_MIN_MOT_DE_PASSE, OCTETS_MAX_MOT_DE_PASSE } from './regles'

// Invitation des artistes (FR-34, AD-14, story 2.4) : l'équipe invite un artiste existant ; le lien
// personnel (jeton `invitation`, cible = id de l'invitation) crée son compte `artist`, rattaché à
// sa fiche. L'invitation écrit l'événement `InvitationEmise` ; le gestionnaire de `notifications`
// émet le jeton à l'envoi de l'e-mail (story 4.1) : le lien n'existe en clair que dans l'e-mail, il
// n'est jamais montré à l'écran. Un envoi refusé se voit et se relance (nouvelle invitation).

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type RefusInvitation = {
  ok: false
  code:
    | 'acces_refuse'
    | 'introuvable'
    | 'email_invalide'
    | 'deja_relie'
    | 'email_utilise'
    | 'email_invite_ailleurs'
    /** L'invitation est créée mais l'e-mail n'est pas parti : à relancer. */
    | 'envoi_echoue'
}

export type ResultatInvitation = { ok: true; email: string; echeance: Date } | RefusInvitation

export type RefusActivation = {
  ok: false
  code:
    | 'invalide'
    | 'mot_de_passe_court'
    | 'mot_de_passe_long'
    | 'mots_de_passe_differents'
    | 'charte_non_acceptee'
    | 'deja_relie'
    | 'email_utilise'
}

export type ResultatActivation = { ok: true; email: string } | RefusActivation

function normaliserEmail(email: string): string {
  return email.trim().toLowerCase()
}

function codeErreur(erreur: unknown): string | undefined {
  return (erreur as { code?: string } | null)?.code
}

// Interrompt la transaction (annule la consommation du jeton) avec un code de refus.
class Refus extends Error {
  constructor(readonly code: RefusActivation['code']) {
    super(code)
  }
}

/**
 * Invite un artiste sans compte (réservé aux admins) : crée l'invitation, révoque les liens
 * précédents encore valables et écrit l'événement `InvitationEmise` ; l'e-mail part à la
 * répartition, avant de répondre. Le lien n'est jamais renvoyé ici. Refus `envoi_echoue` si
 * l'e-mail n'est pas parti (l'invitation reste, relançable depuis l'écran de l'équipe).
 */
export async function inviterArtiste(
  acteur: Acteur,
  artistId: string,
  emailSaisi: string,
  maintenant = new Date(),
): Promise<ResultatInvitation> {
  if (acteur.type !== 'admin') return { ok: false, code: 'acces_refuse' }
  const email = normaliserEmail(emailSaisi)
  if (!EMAIL.test(email) || email.length > 254) return { ok: false, code: 'email_invalide' }

  const artiste = await prisma.artist.findUnique({ where: { id: artistId }, select: { userId: true } })
  if (!artiste) return { ok: false, code: 'introuvable' }
  if (artiste.userId) return { ok: false, code: 'deja_relie' }
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { ok: false, code: 'email_utilise' }
  }

  // Une même adresse ne peut viser qu'un artiste à la fois : la seconde activation échouerait.
  const ailleurs = await invitationsEnAttenteParEmail(email, maintenant)
  if (ailleurs.some((artiste) => artiste !== artistId)) return { ok: false, code: 'email_invite_ailleurs' }

  const { invitationId, evenementId } = await prisma.$transaction(async (tx) => {
    // Verrou sur la fiche : deux invitations simultanées du même artiste se suivent, et la seconde
    // révoque bien le lien de la première.
    await tx.$queryRaw`SELECT 1 FROM "Artist" WHERE "id" = ${artistId} FOR UPDATE`
    const precedentes = await tx.invitation.findMany({
      where: { artistId, accepteeLe: null },
      select: { id: true },
    })
    await revoquerJetons(tx, 'invitation', precedentes.map((i) => i.id), maintenant)
    // Date posée sous le verrou : « la plus récente » suit l'ordre réel des invitations.
    const invitation = await tx.invitation.create({
      data: { artistId, email, creeParId: acteur.userId, createdAt: new Date() },
      select: { id: true },
    })
    const evenementId = await ecrireEvenement(tx, { nom: 'InvitationEmise', charge: { invitationId: invitation.id } })
    return { invitationId: invitation.id, evenementId }
  })
  await repartirApresValidation([evenementId])
  const envoi = await prisma.invitation.findUnique({ where: { id: invitationId }, select: { envoyeeLe: true } })
  if (!envoi?.envoyeeLe) return { ok: false, code: 'envoi_echoue' }
  const jeton = await prisma.jeton.findFirst({
    where: { usage: 'invitation', cible: invitationId, consommeLe: null, revoqueLe: null },
    select: { echeance: true },
  })
  return jeton ? { ok: true, email, echeance: jeton.echeance } : { ok: false, code: 'envoi_echoue' }
}

// Artistes visés par une invitation encore valable à cette adresse.
async function invitationsEnAttenteParEmail(email: string, maintenant: Date): Promise<string[]> {
  const invitations = await prisma.invitation.findMany({
    where: { email, accepteeLe: null },
    select: { id: true, artistId: true },
  })
  if (invitations.length === 0) return []
  const valables = await prisma.jeton.findMany({
    where: {
      usage: 'invitation',
      cible: { in: invitations.map((i) => i.id) },
      consommeLe: null,
      revoqueLe: null,
      echeance: { gt: maintenant },
    },
    select: { cible: true },
  })
  return invitations.filter((i) => valables.some((j) => j.cible === i.id)).map((i) => i.artistId)
}

export type InvitationLue = { email: string; artiste: string; echeance: Date }

/** Invitation portée par un jeton encore utilisable, sinon null. */
export async function lireInvitation(jeton: string, maintenant = new Date()): Promise<InvitationLue | null> {
  const valide = await lireJetonValide(prisma, jeton, 'invitation', maintenant)
  if (!valide) return null
  const invitation = await prisma.invitation.findUnique({
    where: { id: valide.cible },
    select: { email: true, accepteeLe: true, artist: { select: { name: true, userId: true } } },
  })
  if (!invitation || invitation.accepteeLe || invitation.artist.userId) return null
  return { email: invitation.email, artiste: invitation.artist.name, echeance: valide.echeance }
}

/**
 * État de la dernière invitation non acceptée d'un artiste, pour l'écran de l'équipe :
 * `envoyee` (e-mail parti, lien valable), `echec` (« L'e-mail n'est pas parti », à relancer),
 * `en_cours` (envoi pas encore terminé), `lien_manuel` (invitation d'avant l'envoi automatique :
 * lien valable, transmis à la main). Une invitation envoyée dont le lien a expiré n'apparaît plus.
 */
export type InvitationEnAttente = {
  email: string
  statut: 'envoyee' | 'echec' | 'en_cours' | 'lien_manuel'
  echeance: Date | null
}

export async function invitationsEnAttente(
  artistIds: string[],
  maintenant = new Date(),
): Promise<Record<string, InvitationEnAttente>> {
  const invitations = await prisma.invitation.findMany({
    where: { artistId: { in: artistIds }, accepteeLe: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, artistId: true, email: true, envoyeeLe: true, echecEnvoiLe: true },
  })
  const jetons = await prisma.jeton.findMany({
    where: {
      usage: 'invitation',
      cible: { in: invitations.map((i) => i.id) },
      consommeLe: null,
      revoqueLe: null,
      echeance: { gt: maintenant },
    },
    select: { cible: true, echeance: true },
  })
  const resultat: Record<string, InvitationEnAttente> = {}
  // Ordre croissant : la dernière invitation de chaque artiste l'emporte.
  for (const invitation of invitations) {
    const jeton = jetons.find((j) => j.cible === invitation.id)
    const { email } = invitation
    if (invitation.envoyeeLe) {
      if (jeton) resultat[invitation.artistId] = { email, statut: 'envoyee', echeance: jeton.echeance }
      else delete resultat[invitation.artistId]
    } else if (invitation.echecEnvoiLe) {
      resultat[invitation.artistId] = { email, statut: 'echec', echeance: null }
    } else if (jeton) {
      resultat[invitation.artistId] = { email, statut: 'lien_manuel', echeance: jeton.echeance }
    } else {
      resultat[invitation.artistId] = { email, statut: 'en_cours', echeance: null }
    }
  }
  return resultat
}

/**
 * Active une invitation : crée le compte `artist`, le rattache à la fiche, enregistre la charte
 * acceptée et consomme le jeton, en une transaction (tout ou rien).
 */
export async function activerInvitation(
  jeton: string,
  saisie: { motDePasse: string; confirmation: string; charteAcceptee: boolean },
  maintenant = new Date(),
): Promise<ResultatActivation> {
  if (saisie.motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) return { ok: false, code: 'mot_de_passe_court' }
  if (Buffer.byteLength(saisie.motDePasse, 'utf8') > OCTETS_MAX_MOT_DE_PASSE) return { ok: false, code: 'mot_de_passe_long' }
  if (saisie.motDePasse !== saisie.confirmation) return { ok: false, code: 'mots_de_passe_differents' }
  if (!saisie.charteAcceptee) return { ok: false, code: 'charte_non_acceptee' }
  if (!(await lireInvitation(jeton, maintenant))) return { ok: false, code: 'invalide' }

  const motDePasse = await bcrypt.hash(saisie.motDePasse, 12)
  try {
    return await prisma.$transaction(async (tx): Promise<ResultatActivation> => {
      const consomme = await consommerJeton(tx, jeton, 'invitation', maintenant)
      if (!consomme) throw new Refus('invalide')
      const invitation = await tx.invitation.findUnique({
        where: { id: consomme.cible },
        select: { id: true, email: true, accepteeLe: true, artistId: true, artist: { select: { name: true } } },
      })
      if (!invitation || invitation.accepteeLe) throw new Refus('invalide')

      const utilisateur = await tx.user.create({
        data: { email: invitation.email, name: invitation.artist.name, password: motDePasse, role: 'artist' },
        select: { id: true },
      })
      // Rattachement conditionnel : une fiche déjà reliée entre-temps n'est jamais écrasée.
      const { count } = await tx.artist.updateMany({
        where: { id: invitation.artistId, userId: null },
        data: { userId: utilisateur.id },
      })
      if (count !== 1) throw new Refus('deja_relie')
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { accepteeLe: maintenant, charteVersion: CHARTE_ARTISTE_VERSION },
      })
      return { ok: true, email: invitation.email }
    })
  } catch (erreur) {
    if (erreur instanceof Refus) return { ok: false, code: erreur.code }
    // Un compte a pris cet e-mail entre l'invitation et l'activation.
    if (codeErreur(erreur) === 'P2002') return { ok: false, code: 'email_utilise' }
    throw erreur
  }
}
