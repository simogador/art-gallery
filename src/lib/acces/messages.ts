import { CONTACT_EQUIPE } from '@/lib/reglages'
import type { RefusActivation, RefusInvitation } from './invitations'
import { LONGUEUR_MIN_MOT_DE_PASSE } from './regles'

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
    case 'email_invite_ailleurs':
      return 'Cette adresse a déjà une invitation en cours pour un autre artiste.'
  }
}

export function messageRefusActivation(code: RefusActivation['code']): string {
  switch (code) {
    case 'invalide':
      return 'Ce lien d’invitation a expiré.'
    case 'mot_de_passe_court':
      return `Choisissez un mot de passe d’au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`
    case 'mot_de_passe_long':
      return 'Choisissez un mot de passe plus court (72 caractères au plus, moins avec des accents).'
    case 'mots_de_passe_differents':
      return 'Les deux mots de passe ne sont pas identiques.'
    case 'charte_non_acceptee':
      return 'Acceptez la charte artiste pour créer votre accès.'
    case 'deja_relie':
      return `Cette fiche artiste a déjà un accès. Écrivez à l’équipe : ${CONTACT_EQUIPE}.`
    case 'email_utilise':
      return `Un compte existe déjà avec cette adresse. Écrivez à l’équipe : ${CONTACT_EQUIPE}.`
  }
}
