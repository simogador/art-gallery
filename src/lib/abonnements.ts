import { revalidateTag } from 'next/cache'
import type { EvenementLuA, NomEvenement } from '@/lib/evenements/catalogue'
import type * as Notifications from '@/lib/notifications'

// Racine de composition des événements (story 3.4) : qui réagit à quoi. Seul fichier qui relie un
// événement à ses gestionnaires ; il n'accède pas à la base (AD-1). Un gestionnaire ne reçoit jamais
// `tx`, ne lit que des ids, et ne fait rien si l'entité a déjà quitté l'état attendu (ici, une
// invalidation est idempotente et sans effet sur un état périmé).

export type Gestionnaire<N extends NomEvenement = NomEvenement> = (evenement: EvenementLuA<N>) => void | Promise<void>
export type Abonnement<N extends NomEvenement = NomEvenement> = { nom: string; gestionnaire: Gestionnaire<N> }

/** Étiquettes du cache du catalogue (src/lib/catalogue/cache.ts, mêmes valeurs). */
export const etiquetteOeuvre = (artworkId: string) => `oeuvre:${artworkId}`
export const etiquetteArtiste = (artistId: string) => `artiste:${artistId}`
export const ETIQUETTE_CATALOGUE = 'catalogue'

/** Invalide les lectures du catalogue qui portent l'œuvre, son artiste ou la liste. */
export const invaliderCatalogue: Gestionnaire<'PublicationChangee' | 'DisponibiliteChangee'> = (evenement) => {
  const { artworkId, artistId } = evenement.charge
  revalidateTag(etiquetteOeuvre(artworkId))
  revalidateTag(etiquetteArtiste(artistId))
  revalidateTag(ETIQUETTE_CATALOGUE)
}

type NomGestionnaire = Exclude<keyof typeof Notifications, 'annoncerOuverture' | 'envoyerEssaiOuverture' | 'choisirEnvoi' | 'envoiReel'>

/**
 * Gestionnaire de `notifications`, résolu au moment de la répartition : `notifications` importe
 * `demandes`, qui importe `evenements`, qui importe ce fichier. Un import statique ferait dépendre
 * `ABONNEMENTS` de l'ordre de chargement (gestionnaires `undefined`, aucun effet) ; l'import différé
 * ne dépend d'aucun ordre.
 */
/** Noms des gestionnaires de `notifications` reliés ci-dessous (un test vérifie qu'ils existent, quel que soit l'ordre de chargement). */
export const GESTIONNAIRES_DE_NOTIFICATIONS = new Set<NomGestionnaire>()

function via<N extends NomEvenement>(nom: NomGestionnaire): Gestionnaire<N> {
  GESTIONNAIRES_DE_NOTIFICATIONS.add(nom)
  return async (evenement) => {
    const notifications = await import('@/lib/notifications')
    await (notifications[nom] as unknown as Gestionnaire<N>)(evenement)
  }
}

export const ABONNEMENTS: { [N in NomEvenement]: Abonnement<N>[] } = {
  PublicationChangee: [{ nom: 'invaliderCatalogue', gestionnaire: invaliderCatalogue }],
  // Story 4.5 : une œuvre vendue, vendue ailleurs ou retirée n'a plus d'inscrits « Me prévenir » (état relu en base).
  DisponibiliteChangee: [
    { nom: 'invaliderCatalogue', gestionnaire: invaliderCatalogue },
    { nom: 'retirerInscriptionsPrevenir', gestionnaire: via('retirerInscriptionsPrevenir') },
  ],
  // Story 4.1 : un seul e-mail par événement (réclamation atomique avant l'envoi).
  InvitationEmise: [{ nom: 'envoyerInvitation', gestionnaire: via('envoyerInvitation') }],
  OeuvreValidee: [{ nom: 'envoyerResultatCuration', gestionnaire: via('envoyerResultatCuration') }],
  OeuvreRenvoyee: [{ nom: 'envoyerResultatCuration', gestionnaire: via('envoyerResultatCuration') }],
  // Story 4.2 : accusé au visiteur et alerte à l'équipe, deux e-mails distincts, chacun réclamé une fois.
  DemandeSelectionRecue: [
    { nom: 'envoyerAccuseDemande', gestionnaire: via('envoyerAccuseDemande') },
    { nom: 'alerterEquipeDemande', gestionnaire: via('alerterEquipeDemande') },
  ],
  // Story 4.3 : même paire pour une demande de visite.
  DemandeVisiteRecue: [
    { nom: 'envoyerAccuseVisite', gestionnaire: via('envoyerAccuseVisite') },
    { nom: 'alerterEquipeVisite', gestionnaire: via('alerterEquipeVisite') },
  ],
  // Story 4.5 : e-mail de confirmation avec lien de désinscription (rien d'autre n'est envoyé aux inscrits).
  InscriptionPrevenirRecue: [{ nom: 'envoyerConfirmationPrevenir', gestionnaire: via('envoyerConfirmationPrevenir') }],
  // Story 6.3 : le lien de la commande part par e-mail, émis à l'envoi (un seul e-mail par événement).
  VenteAssisteePosee: [{ nom: 'envoyerLienVenteAssistee', gestionnaire: via('envoyerLienVenteAssistee') }],
}
