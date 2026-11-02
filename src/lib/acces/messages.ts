import type { RefusActivation, RefusInvitation } from './invitations'

// Textes des refus d'invitation et d'activation (sans accès à la base).

export function messageRefusInvitation(code: RefusInvitation['code']): string {
  switch (code) {
    case 'acces_refuse':
      return 'Seule l’équipe Errancy peut inviter un artiste.'
    case 'introuvable':
      return 'Cette fiche artiste n’existe plus.'
    case 'email_invalide':
      return 'Indiquez une adresse e-mail valide.'
    case 'deja_relie':
      return 'Cet artiste a déjà un accès.'
    case 'email_utilise':
      return 'Un compte existe déjà avec cette adresse : utilisez une autre adresse pour l’artiste.'
  }
}

export function messageRefusActivation(code: RefusActivation['code']): string {
  switch (code) {
    case 'invalide':
      return 'Ce lien d’invitation a expiré.'
    case 'mot_de_passe_court':
      return 'Choisissez un mot de passe d’au moins 8 caractères.'
    case 'mots_de_passe_differents':
      return 'Les deux mots de passe ne sont pas identiques.'
    case 'charte_non_acceptee':
      return 'Acceptez la charte artiste pour créer votre accès.'
    case 'deja_relie':
      return 'Cette fiche artiste a déjà un accès. Écrivez à l’équipe.'
    case 'email_utilise':
      return 'Un compte existe déjà avec cette adresse. Écrivez à l’équipe.'
  }
}
