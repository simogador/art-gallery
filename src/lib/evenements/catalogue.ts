// Catalogue typé unique des événements (story 3.4, AD-11, AR-9). Un événement est un fait passé
// (`NomAuPasseCompose`), versionné ; sa charge utile ne contient que des ids, jamais de donnée
// personnelle (ni e-mail, ni nom, ni IP). Tout nouvel événement se déclare ici (et nulle part ailleurs), puis ses gestionnaires dans
// `src/lib/abonnements.ts` (le typage l'impose) et un test.

/** Œuvre concernée et son artiste (ids seulement). */
export type ChargeOeuvre = { artworkId: string; artistId: string }

/** Invitation d'un artiste (story 4.1) : l'adresse est lue en base à l'envoi, jamais portée par l'événement. */
export type ChargeInvitation = { invitationId: string }

/** Décision de curation (story 4.1) : le commentaire de l'équipe est lu en base à l'envoi. */
export type ChargeDecision = { decisionId: string; artworkId: string; artistId: string }

/** Demande de sélection (story 4.2) : coordonnées et texte saisis lus en base à l'envoi, jamais portés ici. */
export type ChargeDemande = { demandeId: string }

/** Inscription « Me prévenir » (story 4.5) : adresse et titre lus en base à l'envoi, jamais portés ici. */
export type ChargeInscription = { inscriptionId: string }

/** Vente assistée (story 6.3) : adresse, nom et lien lus en base ou émis à l'envoi, jamais portés ici. */
export type ChargePassage = { passageId: string }

/** Nom → version courante. La clé fait foi à l'exécution comme au typage. */
export const VERSIONS_EVENEMENTS = {
  PublicationChangee: 1,
  DisponibiliteChangee: 1,
  InvitationEmise: 1,
  OeuvreValidee: 1,
  OeuvreRenvoyee: 1,
  DemandeSelectionRecue: 1,
  DemandeVisiteRecue: 1,
  InscriptionPrevenirRecue: 1,
  VenteAssisteePosee: 1,
} as const

export type NomEvenement = keyof typeof VERSIONS_EVENEMENTS

/** Nom → charge utile. */
export type ChargesEvenements = {
  PublicationChangee: ChargeOeuvre
  DisponibiliteChangee: ChargeOeuvre
  InvitationEmise: ChargeInvitation
  OeuvreValidee: ChargeDecision
  OeuvreRenvoyee: ChargeDecision
  DemandeSelectionRecue: ChargeDemande
  /** Demande de visite (story 4.3) : œuvre, créneaux et coordonnées lus en base à l'envoi. */
  DemandeVisiteRecue: ChargeDemande
  /** Inscription « Me prévenir » sur une œuvre réservée (story 4.5), enregistrée à la création seulement. */
  InscriptionPrevenirRecue: ChargeInscription
  /** Réservation d'une vente assistée posée par l'équipe (story 6.3) : déclenche l'e-mail du lien à l'acheteur. */
  VenteAssisteePosee: ChargePassage
}

export type EvenementA<N extends NomEvenement> = { nom: N; charge: ChargesEvenements[N] }

/** Événement à écrire : union discriminée sur le nom. */
export type NouvelEvenement = { [N in NomEvenement]: EvenementA<N> }[NomEvenement]

/** Événement relu du journal. */
export type EvenementLu = NouvelEvenement & { id: string; version: number }

/** Événement relu, d'un nom donné. */
export type EvenementLuA<N extends NomEvenement> = EvenementA<N> & { id: string; version: number }

export function estNomEvenement(nom: unknown): nom is NomEvenement {
  return typeof nom === 'string' && Object.prototype.hasOwnProperty.call(VERSIONS_EVENEMENTS, nom)
}

/** Clés exactes de la charge de chaque événement : des ids, rien d'autre. */
const CLES_CHARGES: { [N in NomEvenement]: readonly (keyof ChargesEvenements[N])[] } = {
  PublicationChangee: ['artworkId', 'artistId'],
  DisponibiliteChangee: ['artworkId', 'artistId'],
  InvitationEmise: ['invitationId'],
  OeuvreValidee: ['decisionId', 'artworkId', 'artistId'],
  OeuvreRenvoyee: ['decisionId', 'artworkId', 'artistId'],
  DemandeSelectionRecue: ['demandeId'],
  DemandeVisiteRecue: ['demandeId'],
  InscriptionPrevenirRecue: ['inscriptionId'],
  VenteAssisteePosee: ['passageId'],
}

function chargeConforme(nom: NomEvenement, charge: unknown): boolean {
  if (typeof charge !== 'object' || charge === null || Array.isArray(charge)) return false
  const c = charge as Record<string, unknown>
  const attendues: readonly string[] = CLES_CHARGES[nom]
  const cles = Object.keys(c)
  return (
    cles.length === attendues.length &&
    attendues.every((cle) => typeof c[cle] === 'string' && c[cle] !== '')
  )
}

/** Contrôle à l'exécution : nom connu et charge conforme (les ids attendus, rien d'autre). */
export function evenementValide(evenement: { nom: unknown; charge: unknown }): evenement is NouvelEvenement {
  return estNomEvenement(evenement.nom) && chargeConforme(evenement.nom, evenement.charge)
}
