import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { DUREE_INVITATION_JOURS } from '@/lib/reglages'
import type { Acteur } from './acteur'
import { CHARTE_ARTISTE_VERSION } from './charte'
import { consommerJeton, emettreJeton, lireJetonValide, revoquerJetons } from './jetons'

// Invitation des artistes (FR-34, AD-14, story 2.4) : l'équipe invite un artiste existant ; le lien
// personnel (jeton `invitation`, cible = id de l'invitation) crée son compte `artist`, rattaché à
// sa fiche. Aucun e-mail n'est envoyé : le lien est montré une seule fois à l'admin.

export const LONGUEUR_MIN_MOT_DE_PASSE = 8
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type RefusInvitation = {
  ok: false
  code: 'acces_refuse' | 'introuvable' | 'email_invalide' | 'deja_relie' | 'email_utilise'
}

export type ResultatInvitation = { ok: true; jeton: string; echeance: Date } | RefusInvitation

export type RefusActivation = {
  ok: false
  code: 'invalide' | 'mot_de_passe_court' | 'mots_de_passe_differents' | 'charte_non_acceptee' | 'deja_relie' | 'email_utilise'
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
 * Invite un artiste sans compte (réservé aux admins) et renvoie le jeton en clair, à transmettre
 * une seule fois. Une nouvelle invitation révoque les liens précédents encore valables.
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

  const echeance = new Date(maintenant.getTime() + DUREE_INVITATION_JOURS * 24 * 60 * 60 * 1000)
  const jeton = await prisma.$transaction(async (tx) => {
    const precedentes = await tx.invitation.findMany({
      where: { artistId, accepteeLe: null },
      select: { id: true },
    })
    await revoquerJetons(tx, 'invitation', precedentes.map((i) => i.id), maintenant)
    const invitation = await tx.invitation.create({
      data: { artistId, email, creeParId: acteur.userId },
      select: { id: true },
    })
    return emettreJeton(tx, { usage: 'invitation', cible: invitation.id, echeance })
  })
  return { ok: true, jeton, echeance }
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

/** Dernière invitation en attente (non acceptée, lien encore valable) de chaque artiste. */
export async function invitationsEnAttente(
  artistIds: string[],
  maintenant = new Date(),
): Promise<Record<string, { email: string; echeance: Date }>> {
  const invitations = await prisma.invitation.findMany({
    where: { artistId: { in: artistIds }, accepteeLe: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, artistId: true, email: true },
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
  const resultat: Record<string, { email: string; echeance: Date }> = {}
  for (const invitation of invitations) {
    const jeton = jetons.find((j) => j.cible === invitation.id)
    if (jeton) resultat[invitation.artistId] = { email: invitation.email, echeance: jeton.echeance }
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
