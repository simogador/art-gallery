import { fr } from '@/lib/i18n'

// Règles pures de la file des demandes (story 4.6, FR-25) : états, types et libellés, partagés par la
// page, la commande d'état (composant client) et le serveur. Aucun accès à la base. Les transitions
// sont libres entre les quatre états (l'équipe se corrige) ; seul un état inconnu est refusé.

export const ETATS_DEMANDE = ['nouvelle', 'planifiee', 'faite', 'sans_suite'] as const
export type EtatDemande = (typeof ETATS_DEMANDE)[number]

/** Demandes montrées par défaut ; les deux autres sont les « traitées ». */
export const ETATS_A_TRAITER: readonly EtatDemande[] = ['nouvelle', 'planifiee']
export const ETATS_TRAITES: readonly EtatDemande[] = ['faite', 'sans_suite']

export const TYPES_DEMANDE = ['visite', 'selection'] as const
export type TypeDemande = (typeof TYPES_DEMANDE)[number]

export function etatDemandeValide(etat: unknown): etat is EtatDemande {
  return typeof etat === 'string' && (ETATS_DEMANDE as readonly string[]).includes(etat)
}

export function typeDemandeValide(type: unknown): type is TypeDemande {
  return typeof type === 'string' && (TYPES_DEMANDE as readonly string[]).includes(type)
}

export function libelleEtatDemande(etat: EtatDemande): string {
  return fr.demandes.etats[etat]
}

export type CodeRefusEtatDemande = 'acces_refuse' | 'introuvable' | 'invalide' | 'indisponible'

export function messageRefusEtatDemande(code: CodeRefusEtatDemande): string {
  return fr.demandes.refus[code]
}
