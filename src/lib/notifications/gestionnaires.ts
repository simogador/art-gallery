import { prisma } from '@/lib/prisma'
import { emettreLienInvitation, noterEnvoiInvitation } from '@/lib/acces/lien-invitation'
import type { EvenementLuA } from '@/lib/evenements/catalogue'
import { urlAbsolue } from '@/lib/reglages'
import { envoiActif } from './choix'
import { contenuInvitation, contenuOeuvreRenvoyee, contenuOeuvreValidee } from './contenus'
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
