// Dictionnaire français de l'interface (story 3.2, AD-18) : un objet typé, des clés par surface.
// Seule langue au lancement (OQ-6, aucun sélecteur) ; une autre langue reprendrait le même type
// (`Dictionnaire`, types élargis) ; `fr` est vérifié par `satisfies` et garde ses clés littérales.
// Les textes à variable sont des fonctions pures. Les surfaces de l'epic 3 n'ont aucun texte visible
// en dur (règle ESLint react/jsx-no-literals, .eslintrc.js).

import { SEPARATEUR } from './formats'

/** Lien d'une colonne du pied de page : libellé et ancre ensemble. */
export type LienTexte = { readonly libelle: string; readonly ancre: string }
type Colonne = { readonly titre: string; readonly liens: readonly LienTexte[] }

export type Dictionnaire = {
  readonly commun: { readonly marque: string; readonly sousTitreMarque: string; readonly separateur: string }
  readonly entete: {
    readonly navigationPrincipale: string
    readonly navigationMobile: string
    readonly menuNavigation: string
    readonly liens: { readonly galerie: string; readonly artistes: string; readonly expositions: string; readonly aPropos: string }
    readonly connexion: string
    readonly deconnexion: string
    readonly contacter: string
    readonly panier: string
    readonly panierArticles: (n: number) => string
    readonly ouvrirMenu: string
    readonly fermerMenu: string
    readonly menuUtilisateur: string
    readonly avatar: string
  }
  readonly piedDePage: {
    readonly presentation: string
    readonly colonnes: { readonly collection: Colonne; readonly galerie: Colonne; readonly services: Colonne }
    readonly reseaux: { readonly instagram: string; readonly linkedin: string; readonly pinterest: string; readonly facebook: string }
    readonly mentions: { readonly mentionsLegales: string; readonly confidentialite: string; readonly cgv: string; readonly cookies: string }
    readonly lettre: {
      readonly titre: string
      readonly exemple: string
      readonly libelleChamp: string
      readonly inscrire: string
      readonly confirmee: string
    }
    readonly adresse: { readonly libelle: string; readonly valeur: string }
    readonly horaires: { readonly libelle: string; readonly valeur: string }
    readonly contact: { readonly libelle: string; readonly email: string; readonly telephone: string; readonly telephoneLien: string }
    readonly droits: (annee: number) => string
  }
  readonly unite: {
    readonly libelle: string
    readonly cm: string
    readonly in: string
    readonly nomComplet: { readonly cm: string; readonly in: string }
  }
  readonly fiche: { readonly format: string }
}

export const fr = {
  commun: {
    marque: 'Galerie',
    sousTitreMarque: 'D’Art Contemporain',
    separateur: SEPARATEUR,
  },

  entete: {
    navigationPrincipale: 'Navigation principale',
    navigationMobile: 'Navigation mobile',
    menuNavigation: 'Menu de navigation',
    liens: {
      galerie: 'Galerie',
      artistes: 'Artistes',
      expositions: 'Expositions',
      aPropos: 'À propos',
    },
    connexion: 'Connexion',
    deconnexion: 'Se déconnecter',
    contacter: 'Contacter',
    panier: 'Panier',
    panierArticles: (n: number) => (n > 0 ? `Panier (${n} article${n > 1 ? 's' : ''})` : 'Panier'),
    ouvrirMenu: 'Ouvrir le menu',
    fermerMenu: 'Fermer le menu',
    menuUtilisateur: 'Menu utilisateur',
    avatar: 'Avatar',
  },

  piedDePage: {
    presentation:
      'Une galerie d’exception au cœur de Paris, dédiée à la promotion des artistes contemporains les plus singuliers.',
    colonnes: {
      collection: {
        titre: 'Collection',
        liens: [
          { libelle: 'Toutes les œuvres', ancre: '#galerie' },
          { libelle: 'Peintures', ancre: '#galerie' },
          { libelle: 'Sculptures', ancre: '#galerie' },
          { libelle: 'Photographies', ancre: '#galerie' },
          { libelle: 'Art numérique', ancre: '#galerie' },
        ],
      },
      galerie: {
        titre: 'La galerie',
        liens: [
          { libelle: 'Nos artistes', ancre: '#artistes' },
          { libelle: 'Expositions', ancre: '#expositions' },
          { libelle: 'À propos', ancre: '#about' },
          { libelle: 'Notre histoire', ancre: '#about' },
          { libelle: 'Presse & média', ancre: '#about' },
        ],
      },
      services: {
        titre: 'Services',
        liens: [
          { libelle: 'Conseil en acquisition', ancre: '#contact' },
          { libelle: 'Art sur commande', ancre: '#contact' },
          { libelle: 'Prêt & location', ancre: '#contact' },
          { libelle: 'Estimation d\u2019œuvres', ancre: '#contact' },
          { libelle: 'Transport & assurance', ancre: '#contact' },
        ],
      },
    },
    reseaux: { instagram: 'Instagram', linkedin: 'LinkedIn', pinterest: 'Pinterest', facebook: 'Facebook' },
    mentions: {
      mentionsLegales: 'Mentions légales',
      confidentialite: 'Politique de confidentialité',
      cgv: 'CGV',
      cookies: 'Cookies',
    },
    lettre: {
      titre: 'Lettre de la galerie',
      exemple: 'votre@email.fr',
      libelleChamp: 'Adresse email pour la newsletter',
      inscrire: 'S’inscrire',
      confirmee: 'Inscription confirmée — à bientôt.',
    },
    adresse: { libelle: 'Adresse', valeur: '12 Rue de l’Art, 75008 Paris' },
    horaires: { libelle: 'Horaires', valeur: 'Mardi — Dimanche · 10 h – 19 h' },
    contact: {
      libelle: 'Contact',
      email: 'contact@galerie-art.fr',
      telephone: '+33 1 23 45 67 89',
      telephoneLien: '+33123456789',
    },
    droits: (annee: number) => `© ${annee} Galerie d’Art Contemporain. Tous droits réservés.`,
  },

  unite: {
    libelle: 'Unité des dimensions',
    cm: 'cm',
    in: 'in',
    nomComplet: { cm: 'centimètres', in: 'pouces' },
  },

  fiche: {
    format: 'Format',
  },
} as const satisfies Dictionnaire
