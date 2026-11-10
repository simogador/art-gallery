import { prisma } from '@/lib/prisma'
import { emettreLienInvitation, noterEnvoiInvitation } from '@/lib/acces/lien-invitation'
import type { EvenementLuA } from '@/lib/evenements/catalogue'
import { CONTACT_EQUIPE, urlAbsolue } from '@/lib/reglages'
import { envoiActif } from './choix'
import {
  contenuAccuseDemande,
  contenuAccuseVisite,
  contenuAlerteDemande,
  contenuAlerteVisite,
  contenuInvitation,
  contenuOeuvreRenvoyee,
  contenuOeuvreValidee,
} from './contenus'
import type { Courriel, ResultatEnvoi } from './port'

// Gestionnaires d'e-mails (story 4.1), reliés aux événements dans `src/lib/abonnements.ts`. Chacun
// tourne après la réclamation atomique (événement, gestionnaire) : un même événement rejoué n'envoie
// rien. Les événements ne portent que des ids ; adresse, titre et commentaire sont lus en base au
// moment de l'envoi. Journaux : ids seulement, jamais d'adresse ni de lien.

async function envoyer(courriel: Courriel): Promise<ResultatEnvoi> {
  try {
    return await envoiActif().envoyer(courriel)
  } catch {
    // Un adaptateur qui lève ne doit ni faire échouer l'action ni masquer l'échec : il compte comme tel.
    return { ok: false, code: 'indisponible' }
  }
}

async function noterEchecSansPerdre(invitationId: string): Promise<void> {
  try {
    await noterEnvoiInvitation(invitationId, 'echec')
  } catch {
    console.error('[notifications] échec d’invitation non noté', { invitation: invitationId })
  }
}

/** Invitation émise : émet le lien, envoie l'e-mail, note le résultat (l'équipe le voit, AD-14). */
export async function envoyerInvitation(evenement: EvenementLuA<'InvitationEmise'>): Promise<void> {
  const { invitationId } = evenement.charge
  let lien: Awaited<ReturnType<typeof emettreLienInvitation>>
  try {
    lien = await emettreLienInvitation(invitationId)
  } catch (erreur) {
    // Réclamation déjà prise et pas de nouvel essai (AQ-2) : l'équipe doit voir l'échec et relancer.
    await noterEchecSansPerdre(invitationId)
    throw erreur
  }
  if (!lien) {
    console.info('[notifications] invitation sans objet, aucun e-mail', { evenement: evenement.id, invitation: invitationId })
    return
  }
  let resultat: ResultatEnvoi = { ok: false, code: 'indisponible' }
  try {
    const contenu = contenuInvitation({
      artiste: lien.artiste,
      lien: urlAbsolue(`/auth/invitation/${lien.jeton}`),
      echeance: lien.echeance,
    })
    resultat = await envoyer({ a: lien.email, ...contenu, cle: `${evenement.id}:envoyerInvitation` })
  } finally {
    // Même si la préparation ou l'envoi a échoué : le jeton émis ne reste pas valable sans e-mail.
    try {
      await noterEnvoiInvitation(invitationId, resultat.ok ? 'envoyee' : 'echec')
    } catch {
      // Une seconde tentative : sans trace, l'écran resterait sur « Envoi en cours ».
      await noterEnvoiInvitation(invitationId, resultat.ok ? 'envoyee' : 'echec')
    }
  }
  if (!resultat.ok) {
    console.error('[notifications] invitation non envoyée', { evenement: evenement.id, invitation: invitationId, code: resultat.code })
  }
}

/** Résultat de curation (« Valider » ou « Renvoyer ») : e-mail à l'adresse du compte de l'artiste. */
export async function envoyerResultatCuration(
  evenement: EvenementLuA<'OeuvreValidee'> | EvenementLuA<'OeuvreRenvoyee'>,
): Promise<void> {
  const { decisionId, artworkId } = evenement.charge
  const decision = await prisma.decisionCuration.findUnique({
    where: { id: decisionId },
    select: {
      artworkId: true,
      decision: true,
      commentaire: true,
      artwork: { select: { title: true, slug: true, artist: { select: { name: true, user: { select: { email: true } } } } } },
    },
  })
  const attendue = evenement.nom === 'OeuvreValidee' ? 'valider' : 'renvoyer'
  if (!decision || decision.artworkId !== artworkId || decision.decision !== attendue) {
    console.info('[notifications] décision introuvable ou différente, aucun e-mail', { evenement: evenement.id, decision: decisionId })
    return
  }
  const { title, slug, artist } = decision.artwork
  const adresse = artist.user?.email
  if (!adresse) {
    // Artiste sans compte : personne à prévenir (le renvoi reste lisible sur sa fiche à la connexion).
    console.info('[notifications] artiste sans compte, aucun e-mail', { evenement: evenement.id, decision: decisionId })
    return
  }
  const contenu =
    attendue === 'valider'
      ? contenuOeuvreValidee({ artiste: artist.name, titre: title, lien: urlAbsolue(`/galerie/${slug}`) })
      : contenuOeuvreRenvoyee({
          artiste: artist.name,
          titre: title,
          commentaire: decision.commentaire ?? '',
          lien: urlAbsolue(`/dashboard/artiste/oeuvres/${slug}`),
        })
  const resultat = await envoyer({ a: adresse, ...contenu, cle: `${evenement.id}:envoyerResultatCuration` })
  if (!resultat.ok) {
    // Pas de nouvel essai (AQ-2 ouverte) : l'équipe voit l'échec dans les journaux, l'artiste lit le renvoi sur sa fiche.
    console.error('[notifications] résultat de curation non envoyé', { evenement: evenement.id, decision: decisionId, code: resultat.code })
  }
}

/** Accusé de réception d'une demande de sélection, à l'adresse saisie par le visiteur (lue en base). */
export async function envoyerAccuseDemande(evenement: EvenementLuA<'DemandeSelectionRecue'>): Promise<void> {
  const { demandeId } = evenement.charge
  const demande = await prisma.demandeSelection.findUnique({ where: { id: demandeId }, select: { email: true } })
  if (!demande) {
    console.info('[notifications] demande introuvable, aucun accusé', { evenement: evenement.id, demande: demandeId })
    return
  }
  const resultat = await envoyer({ a: demande.email, ...contenuAccuseDemande(), cle: `${evenement.id}:envoyerAccuseDemande` })
  if (!resultat.ok) {
    // Pas de nouvel essai (AQ-2 ouverte) : la demande reste enregistrée et confirmée à l'écran.
    console.error('[notifications] accusé de demande non envoyé', { evenement: evenement.id, demande: demandeId, code: resultat.code })
  }
}

/** Alerte à l'équipe : numéro de la demande et lien vers l'administration, sans donnée personnelle. */
export async function alerterEquipeDemande(evenement: EvenementLuA<'DemandeSelectionRecue'>): Promise<void> {
  const { demandeId } = evenement.charge
  // La file des demandes (story 4.6) aura sa page ; d'ici là, le lien mène à l'administration.
  const contenu = contenuAlerteDemande({ numero: demandeId, lien: urlAbsolue('/dashboard/admin') })
  const resultat = await envoyer({ a: CONTACT_EQUIPE, ...contenu, cle: `${evenement.id}:alerterEquipeDemande` })
  if (!resultat.ok) {
    console.error('[notifications] alerte de demande non envoyée', { evenement: evenement.id, demande: demandeId, code: resultat.code })
  }
}

/** Accusé d'une demande de visite (story 4.3) : adresse, œuvre et créneaux lus en base à l'envoi. */
export async function envoyerAccuseVisite(evenement: EvenementLuA<'DemandeVisiteRecue'>): Promise<void> {
  const { demandeId } = evenement.charge
  const demande = await prisma.demandeVisite.findUnique({
    where: { id: demandeId },
    // Seulement le titre de l'œuvre : jamais rien de l'artiste (la visite est organisée par l'équipe).
    select: { email: true, type: true, creneaux: true, fuseau: true, artwork: { select: { title: true } } },
  })
  if (!demande) {
    console.info('[notifications] demande de visite introuvable, aucun accusé', { evenement: evenement.id, demande: demandeId })
    return
  }
  if (!demande.artwork) {
    // Œuvre supprimée entre-temps : la demande reste (sans lien), aucun accusé sans titre.
    console.info('[notifications] œuvre de la demande de visite supprimée, aucun accusé', { evenement: evenement.id, demande: demandeId })
    return
  }
  const contenu = contenuAccuseVisite({
    titre: demande.artwork.title,
    type: demande.type,
    creneaux: demande.creneaux,
    fuseau: demande.fuseau,
  })
  const resultat = await envoyer({ a: demande.email, ...contenu, cle: `${evenement.id}:envoyerAccuseVisite` })
  if (!resultat.ok) {
    // Pas de nouvel essai (AQ-2 ouverte) : la demande reste enregistrée et confirmée à l'écran.
    console.error('[notifications] accusé de visite non envoyé', { evenement: evenement.id, demande: demandeId, code: resultat.code })
  }
}

/** Alerte à l'équipe pour une demande de visite : numéro et lien vers l'administration seulement. */
export async function alerterEquipeVisite(evenement: EvenementLuA<'DemandeVisiteRecue'>): Promise<void> {
  const { demandeId } = evenement.charge
  // La file des demandes (story 4.6) aura sa page ; d'ici là, le lien mène à l'administration.
  const contenu = contenuAlerteVisite({ numero: demandeId, lien: urlAbsolue('/dashboard/admin') })
  const resultat = await envoyer({ a: CONTACT_EQUIPE, ...contenu, cle: `${evenement.id}:alerterEquipeVisite` })
  if (!resultat.ok) {
    console.error('[notifications] alerte de visite non envoyée', { evenement: evenement.id, demande: demandeId, code: resultat.code })
  }
}
