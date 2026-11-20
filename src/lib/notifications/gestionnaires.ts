import { prisma } from '@/lib/prisma'
import { abandonnerConfirmationPrevenir, preparerConfirmationPrevenir, retirerInscriptionsPrevenirSiSortie } from '@/lib/demandes'
import { lireDonneesCourrielCommande, lireNumeroCommandeAvecPassage, lireReclamationPourCourriel } from '@/lib/commandes/courriels'
import { abandonnerLienSuivi, emettreLienSuiviDeCommande } from '@/lib/commandes/suivi'
import { abandonnerLienVenteAssistee, preparerLienVenteAssistee } from '@/lib/commandes/vente-assistee'
import { emettreLienInvitation, noterEnvoiInvitation } from '@/lib/acces/lien-invitation'
import type { EvenementLuA } from '@/lib/evenements/catalogue'
import { CONTACT_EQUIPE, urlAbsolue } from '@/lib/reglages'
import { nomPays } from '@/lib/livraison/pays'
import { envoiActif } from './choix'
import {
  contenuAccuseDemande,
  contenuAccuseVisite,
  contenuAlerteCommande,
  contenuCommandeAnnulee,
  contenuCommandeArtiste,
  contenuCommandeAnnuleeArtiste,
  contenuCommandeConfirmee,
  contenuCommandePriseEnCharge,
  contenuCommandeExpediee,
  contenuCommandeLivree,
  contenuAlerteDemande,
  contenuAlerteVisite,
  contenuAlerteReclamation,
  contenuReclamationAcceptee,
  contenuReclamationRefusee,
  contenuRetourAccepteArtiste,
  contenuConfirmationPrevenir,
  contenuInvitation,
  contenuOeuvreRenvoyee,
  contenuOeuvreValidee,
  contenuVenteAssistee,
} from './contenus'
import type { Courriel, ResultatEnvoi } from './port'
import type { Contenu } from './contenus'

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
  // La file des demandes de l'équipe (story 4.6).
  const contenu = contenuAlerteDemande({ numero: demandeId, lien: urlAbsolue('/dashboard/admin/demandes') })
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
  // La file des demandes de l'équipe (story 4.6).
  const contenu = contenuAlerteVisite({ numero: demandeId, lien: urlAbsolue('/dashboard/admin/demandes') })
  const resultat = await envoyer({ a: CONTACT_EQUIPE, ...contenu, cle: `${evenement.id}:alerterEquipeVisite` })
  if (!resultat.ok) {
    console.error('[notifications] alerte de visite non envoyée', { evenement: evenement.id, demande: demandeId, code: resultat.code })
  }
}

/**
 * Confirmation d'une inscription « Me prévenir » (story 4.5) : adresse et titre lus en base à l'envoi,
 * lien de désinscription émis à ce moment. Rien sur l'heure de fin d'une réservation, rien de plus.
 * Échec d'envoi : l'inscription reste, le lien émis est révoqué, journal d'ids (jamais d'adresse).
 */
export async function envoyerConfirmationPrevenir(evenement: EvenementLuA<'InscriptionPrevenirRecue'>): Promise<void> {
  const { inscriptionId } = evenement.charge
  const confirmation = await preparerConfirmationPrevenir(inscriptionId)
  if (!confirmation) {
    console.info('[notifications] inscription introuvable, aucune confirmation', { evenement: evenement.id, inscription: inscriptionId })
    return
  }
  let resultat: ResultatEnvoi = { ok: false, code: 'indisponible' }
  try {
    const contenu = contenuConfirmationPrevenir({
      titre: confirmation.titre,
      lienDesinscription: urlAbsolue(`/auth/desinscription-alerte/${confirmation.jeton}`),
    })
    resultat = await envoyer({ a: confirmation.email, ...contenu, cle: `${evenement.id}:envoyerConfirmationPrevenir` })
  } finally {
    // Même si la préparation ou l'envoi a échoué : le lien émis ne reste pas valable sans e-mail.
    if (!resultat.ok) {
      try {
        await abandonnerConfirmationPrevenir(inscriptionId)
      } catch {
        console.error('[notifications] lien de désinscription non révoqué', { evenement: evenement.id, inscription: inscriptionId })
      }
    }
  }
  if (!resultat.ok) {
    // Pas de nouvel essai (AQ-2 ouverte) : l'inscription reste enregistrée et confirmée à l'écran.
    console.error('[notifications] confirmation « Me prévenir » non envoyée', { evenement: evenement.id, inscription: inscriptionId, code: resultat.code })
  }
}

/** Œuvre vendue, vendue ailleurs ou retirée : ses inscriptions « Me prévenir » sont supprimées, sans e-mail (état relu en base). */
export async function retirerInscriptionsPrevenir(evenement: EvenementLuA<'DisponibiliteChangee'>): Promise<void> {
  const { artworkId } = evenement.charge
  const supprimees = await retirerInscriptionsPrevenirSiSortie(artworkId)
  if (supprimees > 0) {
    console.info('[notifications] inscriptions « Me prévenir » supprimées', { evenement: evenement.id, artwork: artworkId, nombre: supprimees })
  }
}

/**
 * Vente assistée posée (story 6.3, AD-14) : émet le lien de la commande à l'envoi, envoie l'e-mail à
 * l'acheteur (adresse lue en base). Un échec d'envoi révoque le lien (un échec de préparation annule sa
 * transaction : aucun jeton n'existe, la répartition le journalise, ids seulement) :
 * la réservation reste posée, l'équipe voit « L'e-mail n'est pas parti » et relance autrement.
 */
export async function envoyerLienVenteAssistee(evenement: EvenementLuA<'VenteAssisteePosee'>): Promise<void> {
  const { passageId } = evenement.charge
  const lien = await preparerLienVenteAssistee(passageId)
  if (!lien) {
    console.info('[notifications] vente assistée sans objet, aucun e-mail', { evenement: evenement.id, passage: passageId })
    return
  }
  let resultat: ResultatEnvoi = { ok: false, code: 'indisponible' }
  try {
    const contenu = contenuVenteAssistee({ nom: lien.nom, lien: urlAbsolue(`/commande/${lien.jeton}`), echeance: lien.echeance })
    resultat = await envoyer({ a: lien.email, ...contenu, cle: `${evenement.id}:envoyerLienVenteAssistee` })
  } finally {
    // Même si la construction ou l'envoi a échoué : le lien émis ne reste pas valable sans e-mail.
    if (!resultat.ok) {
      try {
        await abandonnerLienVenteAssistee(passageId)
      } catch {
        console.error('[notifications] lien de vente assistée non révoqué', { evenement: evenement.id, passage: passageId })
      }
    }
  }
  if (!resultat.ok) {
    console.error('[notifications] lien de vente assistée non envoyé', { evenement: evenement.id, passage: passageId, code: resultat.code })
  }
}

type EvenementCommande = { id: string; charge: { commandeId: string } }
/** Une commande confirmée reste « confirmée » pour ses e-mails si l'artiste l'a déjà prise en charge (8.1). */
const CONFIRMEE_OU_PRISE = ['confirmee', 'prise_en_charge', 'expediee', 'livree', 'retournee'] as const

type DonneesCommande = NonNullable<Awaited<ReturnType<typeof lireDonneesCourrielCommande>>>

/**
 * E-mails de commande (FR-34, FR-25, FR-31) : l'état de la commande est relu en base (un événement
 * périmé n'envoie rien), l'adresse aussi ; une commande sans passage ou sans adresse n'envoie rien. Un
 * e-mail par événement et par destinataire (réclamation atomique, clé d'idempotence). Pas de nouvel
 * essai (AQ-2 ouverte) ; journaux : ids seulement.
 */
async function envoyerCommande(
  evenement: EvenementCommande,
  nom: string,
  // États acceptés : une commande confirmée peut déjà être prise en charge par l'artiste à l'envoi (story 8.1).
  etatsAcceptes: readonly ('confirmee' | 'annulee' | 'prise_en_charge' | 'expediee' | 'livree' | 'retournee')[],
  composer: (d: DonneesCommande, lienSuivi: string | null) => { a: string; contenu: Contenu } | null,
  // `suivi` : e-mail à l'acheteur, qui porte un lien de suivi émis à l'envoi (story 7.7, AD-14).
  options: { suivi?: boolean; lienSeulementSiCommandeVivante?: boolean } = {},
): Promise<void> {
  const { commandeId } = evenement.charge
  const donnees = await lireDonneesCourrielCommande(commandeId)
  if (!donnees || !(etatsAcceptes as readonly string[]).includes(donnees.etat)) {
    console.info('[notifications] commande sans objet, aucun e-mail', { evenement: evenement.id, commande: commandeId, gestionnaire: nom })
    return
  }
  // Le lien de suivi est émis ici, au moment de l'envoi : sa valeur en clair n'existe que dans l'e-mail. Une
  // panne d'émission n'empêche pas l'e-mail (la confirmation prime) : il part sans lien, journal d'ids.
  let jetonSuivi: string | null = null
  if (options.suivi) {
    try {
      jetonSuivi = await emettreLienSuiviDeCommande(commandeId, { exigerCommandeVivante: options.lienSeulementSiCommandeVivante })
    } catch {
      console.error('[notifications] lien de suivi non émis', { evenement: evenement.id, commande: commandeId, gestionnaire: nom })
    }
  }
  let resultat: ResultatEnvoi = { ok: false, code: 'indisponible' }
  try {
    const message = composer(donnees, jetonSuivi ? urlAbsolue(`/suivi/${jetonSuivi}`) : null)
    if (!message) {
      console.info('[notifications] aucun destinataire, aucun e-mail', { evenement: evenement.id, commande: commandeId, gestionnaire: nom })
      return
    }
    resultat = await envoyer({ a: message.a, ...message.contenu, cle: `${evenement.id}:${nom}` })
  } finally {
    // Pas d'e-mail parti (échec, ou rien à envoyer) : le lien émis ne reste pas valable sans e-mail. Pas de
    // nouvel essai (AQ-2 ouverte).
    if (jetonSuivi && !resultat.ok) {
      try {
        await abandonnerLienSuivi(jetonSuivi)
      } catch {
        console.error('[notifications] lien de suivi non révoqué', { evenement: evenement.id, commande: commandeId })
      }
    }
  }
  if (!resultat.ok) {
    console.error('[notifications] e-mail de commande non envoyé', { evenement: evenement.id, commande: commandeId, gestionnaire: nom, code: resultat.code })
  }
}

/** Commande confirmée : e-mail à l'acheteur (lignes figées de la commande). */
export async function envoyerConfirmationCommande(evenement: EvenementLuA<'CommandeConfirmee'>): Promise<void> {
  await envoyerCommande(
    evenement,
    'envoyerConfirmationCommande',
    CONFIRMEE_OU_PRISE,
    (d, lienSuivi) => ({
      a: d.acheteur.email,
      contenu: contenuCommandeConfirmee({ nom: d.acheteur.nom, numero: d.numero, lignes: d.lignes, lienSuivi }),
    }),
    { suivi: true },
  )
}

/**
 * Commande confirmée : avis à l'artiste (numéro, titres, échéance de prise en charge en heure de Paris et
 * bouton vers sa commande, décision 3A de la story 8.1 ; aucune coordonnée de l'acheteur). Sans compte : rien.
 */
export async function envoyerAvisCommandeArtiste(evenement: EvenementLuA<'CommandeConfirmee'>): Promise<void> {
  await envoyerCommande(evenement, 'envoyerAvisCommandeArtiste', CONFIRMEE_OU_PRISE, (d) =>
    d.artiste?.email
      ? {
          a: d.artiste.email,
          contenu: contenuCommandeArtiste({
            artiste: d.artiste.nom,
            numero: d.numero,
            titres: d.lignes.map((l) => l.titre),
            priseEnChargeAvant: d.priseEnChargeAvant,
            pays: d.pays ? nomPays(d.pays) : null,
            lien: urlAbsolue(`/dashboard/artiste/commandes/${encodeURIComponent(d.numero)}`),
          }),
        }
      : null,
  )
}

/** Commande prise en charge par l'artiste (story 8.1) : e-mail à l'acheteur (délai rappelé, lien de suivi émis à l'envoi). */
export async function envoyerPriseEnChargeCommande(evenement: EvenementLuA<'CommandePriseEnCharge'>): Promise<void> {
  await envoyerCommande(
    evenement,
    'envoyerPriseEnChargeCommande',
    ['prise_en_charge', 'expediee', 'livree', 'retournee'],
    (d, lienSuivi) => ({
      a: d.acheteur.email,
      contenu: contenuCommandePriseEnCharge({ nom: d.acheteur.nom, numero: d.numero, artiste: d.artiste?.nom ?? null, lignes: d.lignes, lienSuivi }),
    }),
    { suivi: true },
  )
}

/** Commande expédiée par l'artiste (story 8.2) : e-mail à l'acheteur (transporteur, numéro de suivi, lien de suivi émis à l'envoi). */
export async function envoyerExpeditionCommande(evenement: EvenementLuA<'CommandeExpediee'>): Promise<void> {
  await envoyerCommande(
    evenement,
    'envoyerExpeditionCommande',
    ['expediee', 'livree', 'retournee'],
    (d, lienSuivi) => ({
      a: d.acheteur.email,
      contenu: contenuCommandeExpediee({ nom: d.acheteur.nom, numero: d.numero, artiste: d.artiste?.nom ?? null, titres: d.lignes.map((l) => l.titre), expedition: d.expedition, lienSuivi }),
    }),
    { suivi: true },
  )
}

/** Livraison constatée (story 8.4) : e-mail à l'acheteur (lien de suivi émis à l'envoi, aucune durée de retour). */
export async function envoyerLivraisonCommande(evenement: EvenementLuA<'CommandeLivree'>): Promise<void> {
  await envoyerCommande(
    evenement,
    'envoyerLivraisonCommande',
    ['livree', 'retournee'],
    (d, lienSuivi) => ({
      a: d.acheteur.email,
      contenu: contenuCommandeLivree({ nom: d.acheteur.nom, numero: d.numero, artiste: d.artiste?.nom ?? null, titres: d.lignes.map((l) => l.titre), lienSuivi }),
    }),
    { suivi: true },
  )
}

/** Commande annulée : e-mail à l'acheteur, avec l'état du remboursement s'il existe. */
export async function envoyerAnnulationCommande(evenement: EvenementLuA<'CommandeAnnulee'>): Promise<void> {
  await envoyerCommande(
    evenement,
    'envoyerAnnulationCommande',
    ['annulee'],
    (d, lienSuivi) => ({
      a: d.acheteur.email,
      contenu: contenuCommandeAnnulee({ nom: d.acheteur.nom, numero: d.numero, titres: d.lignes.map((l) => l.titre), remboursement: d.remboursement, paiementRecu: d.paiementConstate, lienSuivi }),
    }),
    // Passage clos (toutes les commandes annulées) : le lien n'ouvrirait que la page « close », il n'est ni émis ni écrit.
    { suivi: true, lienSeulementSiCommandeVivante: true },
  )
}

/**
 * Commande payée annulée par l'équipe (story 8.3, décision 3A) : e-mail à l'artiste avec numéro, titres et motif.
 * Seulement si le motif existe (une annulation d'une commande en attente ou par vente ailleurs n'a jamais été vue
 * par l'artiste) ; sans compte artiste : rien. Aucune coordonnée de l'acheteur.
 */
export async function envoyerAnnulationCommandeArtiste(evenement: EvenementLuA<'CommandeAnnulee'>): Promise<void> {
  await envoyerCommande(evenement, 'envoyerAnnulationCommandeArtiste', ['annulee'], (d) =>
    d.artiste?.email && d.motifAnnulation
      ? {
          a: d.artiste.email,
          contenu: contenuCommandeAnnuleeArtiste({ artiste: d.artiste.nom, numero: d.numero, titres: d.lignes.map((l) => l.titre), motif: d.motifAnnulation }),
        }
      : null,
  )
}

/** Commande confirmée ou annulée : alerte à l'équipe, numéro et lien seulement. */
export async function alerterEquipeCommande(evenement: EvenementLuA<'CommandeConfirmee'> | EvenementLuA<'CommandeAnnulee'>): Promise<void> {
  const { commandeId } = evenement.charge
  const annulee = evenement.nom === 'CommandeAnnulee'
  const commande = await lireNumeroCommandeAvecPassage(commandeId)
  const acceptes: readonly string[] = annulee ? ['annulee'] : CONFIRMEE_OU_PRISE
  if (!commande || !acceptes.includes(commande.etat)) {
    console.info('[notifications] commande sans objet, aucune alerte', { evenement: evenement.id, commande: commandeId })
    return
  }
  const contenu = contenuAlerteCommande({ numero: commande.numero, lien: urlAbsolue('/dashboard/admin/commandes'), annulee })
  const resultat = await envoyer({ a: CONTACT_EQUIPE, ...contenu, cle: `${evenement.id}:alerterEquipeCommande` })
  if (!resultat.ok) {
    console.error('[notifications] alerte de commande non envoyée', { evenement: evenement.id, commande: commandeId, code: resultat.code })
  }
}

/** Réclamation déposée (story 8.5) : alerte à l'équipe, numéro et lien seulement (ni nom, ni description, ni photo). */
export async function alerterEquipeReclamation(evenement: EvenementLuA<'ReclamationOuverte'>): Promise<void> {
  const reclamation = await lireReclamationPourCourriel(evenement.charge.reclamationId)
  if (!reclamation) {
    console.info('[notifications] réclamation sans objet, aucune alerte', { evenement: evenement.id, reclamation: evenement.charge.reclamationId })
    return
  }
  const contenu = contenuAlerteReclamation({ numero: reclamation.numero, lien: urlAbsolue('/dashboard/admin/commandes') })
  const resultat = await envoyer({ a: CONTACT_EQUIPE, ...contenu, cle: `${evenement.id}:alerterEquipeReclamation` })
  if (!resultat.ok) {
    console.error('[notifications] alerte de réclamation non envoyée', { evenement: evenement.id, reclamation: evenement.charge.reclamationId, code: resultat.code })
  }
}

/**
 * Réclamation décidée (story 8.5) : e-mail à l'acheteur, état relu en base à l'envoi (une réclamation encore ouverte
 * n'envoie rien). Acceptée : l'équipe écrira pour la suite, sans remboursement, délai ni frais promis (OQ-2, OQ-4).
 * Refusée : le motif de l'équipe, qu'il lit aussi sur `/suivi`. Lien de suivi émis à l'envoi.
 */
export async function envoyerDecisionReclamation(evenement: EvenementLuA<'ReclamationTraitee'>): Promise<void> {
  const reclamation = await lireReclamationPourCourriel(evenement.charge.reclamationId)
  if (!reclamation || reclamation.etat === 'ouverte') {
    console.info('[notifications] réclamation sans objet, aucun e-mail', { evenement: evenement.id, reclamation: evenement.charge.reclamationId })
    return
  }
  await envoyerCommande(
    { id: evenement.id, charge: { commandeId: reclamation.commandeId } },
    'envoyerDecisionReclamation',
    ['livree', 'retournee'],
    (d, lienSuivi) => ({
      a: d.acheteur.email,
      contenu:
        reclamation.etat === 'acceptee'
          ? contenuReclamationAcceptee({ nom: d.acheteur.nom, numero: d.numero, titres: d.lignes.map((l) => l.titre), lienSuivi })
          : contenuReclamationRefusee({ nom: d.acheteur.nom, numero: d.numero, titres: d.lignes.map((l) => l.titre), motif: reclamation.motifRefus ?? '', lienSuivi }),
    }),
    { suivi: true },
  )
}

/** Retour accepté (story 8.5, décision 5A) : e-mail à l'artiste, numéro et titres seulement (ni coordonnées ni photos de l'acheteur). */
export async function envoyerRetourAccepteArtiste(evenement: EvenementLuA<'ReclamationTraitee'>): Promise<void> {
  const reclamation = await lireReclamationPourCourriel(evenement.charge.reclamationId)
  if (!reclamation || reclamation.etat !== 'acceptee') {
    console.info('[notifications] aucun retour accepté, aucun e-mail à l\'artiste', { evenement: evenement.id, reclamation: evenement.charge.reclamationId })
    return
  }
  await envoyerCommande(
    { id: evenement.id, charge: { commandeId: reclamation.commandeId } },
    'envoyerRetourAccepteArtiste',
    ['livree', 'retournee'],
    (d) => (d.artiste?.email ? { a: d.artiste.email, contenu: contenuRetourAccepteArtiste({ artiste: d.artiste.nom, numero: d.numero, titres: d.lignes.map((l) => l.titre) }) } : null),
  )
}
