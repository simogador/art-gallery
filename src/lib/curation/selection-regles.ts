// Sélection de l'accueil (story 3.10) : codes de refus et messages, purs (importables côté client).

export type CodeRefusSelection = 'acces_refuse' | 'introuvable' | 'non_publiee' | 'retiree'

export const MESSAGES_REFUS_SELECTION: Record<CodeRefusSelection, string> = {
  acces_refuse: 'Seule l’équipe peut choisir la sélection de l’accueil.',
  introuvable: 'Œuvre introuvable.',
  non_publiee: 'Seule une œuvre publiée peut entrer dans la sélection de l’accueil.',
  retiree: 'Une œuvre retirée ne peut pas entrer dans la sélection de l’accueil.',
}

/** Retour affiché sur la liste après la bascule (paramètre `selection` de l'adresse). */
export const MESSAGES_RETOUR_SELECTION: Record<string, string> = {
  marquee: 'Sélection de l’accueil mise à jour. L’œuvre y figure dès qu’elle est visible et disponible (au plus 60 secondes plus tard).',
  retiree_selection: 'Sélection de l’accueil mise à jour. L’œuvre n’y figure plus (au plus 60 secondes plus tard).',
  ...MESSAGES_REFUS_SELECTION,
}

export const LIBELLES_SELECTION = {
  dans: 'Dans la sélection de l’accueil · Retirer',
  ajouter: 'Ajouter à la sélection de l’accueil',
} as const
