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
    /** Bouton « Menu » (petit écran) et retour « ‹ [écran précédent] » des écrans profonds (story 3.10). */
    readonly menu: string
    readonly retour: (ecran: string) => string
    readonly retourVers: (ecran: string) => string
  }
  readonly accueil: {
    readonly hero: {
      readonly titre: string
      readonly introduction: string
      readonly parcourir: string
      readonly artistes: string
      readonly expositionEnCours: string
      readonly descendre: string
      readonly statistiques: {
        readonly oeuvres: (n: number) => string
        readonly artistes: (n: number) => string
        readonly expositions: (n: number) => string
      }
      readonly legende: (titre: string, artiste: string, annee: number) => string
    }
    readonly selection: { readonly surtitre: string; readonly titre: string; readonly introduction: string }
    readonly nouveautes: { readonly surtitre: string; readonly titre: string; readonly introduction: string }
    readonly parcourirGalerie: string
    readonly vide: { readonly titre: string; readonly message: string }
    readonly artistes: {
      readonly surtitre: string
      readonly titre: string
      readonly introduction: string
      readonly voirTous: string
      readonly profil: (nom: string) => string
      readonly oeuvres: (n: number) => string
    }
    readonly expositions: {
      readonly surtitre: string
      readonly titre: string
      readonly voirToutes: string
      readonly decouvrir: string
      readonly alaUne: string
      readonly statut: { readonly 'en-cours': string; readonly 'a-venir': string; readonly passee: string }
      readonly oeuvres: (n: number) => string
      readonly lieu: (lieu: string) => string
      readonly periode: (debut: string, fin: string) => string
    }
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
  readonly fiche: {
    readonly coupDeCoeur: string
    readonly etat: { readonly disponible: string; readonly vendue: string }
    readonly vendue: {
      readonly proches: string
      readonly pourriezAimer: string
      readonly lienArtiste: (artiste: string) => string
    }
    readonly photos: {
      readonly carrousel: string
      readonly legendes: {
        readonly mise_en_situation: string
        readonly face_lumiere_du_jour: string
        readonly gros_plan: string
        readonly principale: string
      }
      readonly alt: (titre: string, artiste: string, priseDeVue: string) => string
      readonly compteur: (position: number, total: number) => string
      readonly precedente: string
      readonly suivante: string
      readonly agrandir: string
      readonly fermer: string
      readonly zoomer: string
      readonly dezoomer: string
      readonly plein: (titre: string) => string
    }
    readonly rangee: {
      readonly libelle: string
      readonly taille: string
      readonly delai: string
      readonly orientation: { readonly portrait: string; readonly paysage: string; readonly carre: string }
      readonly format: { readonly petit: string; readonly moyen: string; readonly grand: string }
      readonly delaiJours: (min: number, max: number) => string
      readonly livreeChezVous: string
      readonly pasDeLivraison: (pays: string) => string
      readonly neLivrePas: (artiste: string, pays: string) => string
    }
    // Story 3.6 : les quatre questions (FR-5, UX-DR16).
    readonly sections: {
      readonly libelle: string
      readonly chezMoi: { readonly titre: string; readonly orientationFormat: (orientation: string, format: string) => string }
      readonly total: { readonly titre: string; readonly phrase: (pays: string) => string }
      readonly quand: { readonly titre: string; readonly phrase: (pays: string) => string }
      readonly serieux: {
        readonly titre: string
        readonly histoire: string
        readonly selectionnee: string
        readonly certificat: string
        readonly retour: string
        readonly retourTitre: string
        readonly lienArtiste: (artiste: string) => string
      }
    }
  }
  readonly livraison: {
    readonly prixLivre: string
    readonly paysChoisi: (pays: string) => string
    readonly modifier: string
    readonly modifierPays: (pays: string) => string
    readonly libelleListe: string
    readonly valider: string
    readonly annuler: string
    readonly erreur: string
    readonly delai: (min: number, max: number) => string
    readonly pasDeLivraison: (pays: string) => string
    readonly droitsNonInclus: string
    readonly recalcules: (pays: string) => string
  }
  readonly artistes: {
    readonly titre: string
    readonly description: string
    readonly introduction: string
    readonly liste: string
    readonly vide: string
    readonly introuvable: string
    readonly selectionne: string
    readonly portrait: (nom: string) => string
    readonly atelier: (nom: string) => string
    readonly sections: {
      readonly biographie: string
      readonly demarche: string
      readonly formation: string
      readonly expositions: string
      readonly atelier: string
      readonly oeuvres: string
    }
    readonly oeuvres: string
    readonly fichier: { readonly type: string; readonly poids: string }
  }
  readonly galerie: {
    readonly titre: string
    readonly description: string
    readonly resultats: (n: number, pays: string) => string
    readonly modifierFiltres: string
    readonly filtresActifs: string
    readonly retirer: (filtre: string) => string
    readonly croix: string
    readonly champs: {
      readonly prixMax: string
      readonly format: string
      readonly orientation: string
      readonly couleur: string
      readonly ambiance: string
      readonly technique: string
      readonly artiste: string
      readonly paysArtiste: string
      readonly disponibles: string
      readonly tri: string
    }
    readonly tous: string
    readonly toutes: string
    readonly techniques: { readonly peinture: string; readonly sculpture: string; readonly photographie: string; readonly 'art-numerique': string }
    readonly tris: { readonly defaut: string; readonly 'prix-croissant': string; readonly 'prix-decroissant': string }
    readonly puces: {
      readonly prixMax: (montant: string) => string
      readonly artiste: (nom: string) => string
      readonly paysArtiste: (pays: string) => string
      readonly disponibles: string
    }
    readonly appliquer: string
    readonly liste: string
    readonly vendue: string
    readonly vide: string
    readonly retirerDernier: string
    readonly collectionVide: string
    readonly afficherPlus: string
    readonly erreur: string
    readonly erreurPage: string
    readonly reessayer: string
    readonly chargement: string
  }
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
    menu: 'Menu',
    retour: (ecran: string) => `‹ ${ecran}`,
    retourVers: (ecran: string) => `Retour vers ${ecran}`,
  },

  // Story 3.10 : accueil curatorial (FR-18) ; la sélection de l'équipe puis les dernières œuvres
  // publiées. Aucun texte ne promet certificat, assurance ni installation.
  accueil: {
    hero: {
      titre: 'L’art qui transcende le temps',
      introduction:
        'Des œuvres choisies par notre équipe, auprès d’artistes contemporains, avec leur prix livré chez vous.',
      parcourir: 'Parcourir la galerie',
      artistes: 'Rencontrer les artistes',
      expositionEnCours: 'Exposition en cours',
      descendre: 'Voir la sélection',
      statistiques: {
        oeuvres: (n: number) => (n > 1 ? 'Œuvres' : 'Œuvre'),
        artistes: (n: number) => (n > 1 ? 'Artistes' : 'Artiste'),
        expositions: (n: number) => (n > 1 ? 'Expositions' : 'Exposition'),
      },
      legende: (titre: string, artiste: string, annee: number) =>
        [titre, artiste, annee > 0 ? String(annee) : null].filter(Boolean).join(', '),
    },
    selection: {
      surtitre: 'Choisies par Errancy',
      titre: 'Sélection de l’équipe',
      introduction: 'Les œuvres que nous avons envie de vous montrer en premier.',
    },
    nouveautes: {
      surtitre: 'À découvrir',
      titre: 'Dernières œuvres publiées',
      introduction: 'Les œuvres les plus récemment déposées par les artistes.',
    },
    parcourirGalerie: 'Parcourir la galerie',
    vide: {
      titre: 'La collection arrive bientôt',
      message: 'Les premières œuvres sont en cours de sélection. Revenez nous voir très vite.',
    },
    artistes: {
      surtitre: 'Nos artistes',
      titre: 'Les artistes',
      introduction: 'Les artistes dont vous retrouvez les œuvres dans la galerie.',
      voirTous: 'Voir tous les artistes',
      profil: (nom: string) => `Voir le profil de ${nom}`,
      oeuvres: (n: number) => `${n} ${n > 1 ? 'œuvres' : 'œuvre'}`,
    },
    expositions: {
      surtitre: 'Programme',
      titre: 'Expositions',
      voirToutes: 'Voir toutes les expositions',
      decouvrir: 'Découvrir',
      alaUne: 'À la une',
      statut: { 'en-cours': 'En cours', 'a-venir': 'À venir', passee: 'Passée' },
      oeuvres: (n: number) => `${n} ${n > 1 ? 'œuvres' : 'œuvre'}`,
      lieu: (lieu: string) => `Lieu\u00a0: ${lieu}`,
      periode: (debut: string, fin: string) => `${debut} — ${fin}`,
    },
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

  // Story 3.5 : haut de la fiche œuvre (carrousel de photos, rangée Taille / Prix livré / Délai).
  fiche: {
    coupDeCoeur: 'Coup de cœur',
    etat: { disponible: 'Disponible', vendue: 'Vendue' },
    // Story 3.7 : section d'œuvres proches ; titre propre à une œuvre vendue et lien vers l'artiste.
    vendue: {
      proches: 'D’autres œuvres à découvrir',
      pourriezAimer: 'Vous pourriez aimer',
      lienArtiste: (artiste: string) => `Découvrir ${artiste}`,
    },
    photos: {
      carrousel: 'Photos de l’œuvre',
      legendes: {
        mise_en_situation: 'Mise en situation avec repère d’échelle',
        face_lumiere_du_jour: 'Œuvre de face, lumière du jour',
        gros_plan: 'Gros plan de la matière',
        principale: 'Photo de l’œuvre',
      },
      alt: (titre: string, artiste: string, priseDeVue: string) => `${titre}, ${artiste}\u00a0: ${priseDeVue}`,
      compteur: (position: number, total: number) => `${position}/${total}`,
      precedente: 'Photo précédente',
      suivante: 'Photo suivante',
      agrandir: 'Agrandir la photo',
      fermer: 'Fermer',
      zoomer: 'Zoomer',
      dezoomer: 'Revenir à la taille d’origine',
      plein: (titre: string) => `Photo en plein écran\u00a0: ${titre}`,
    },
    rangee: {
      libelle: 'Taille, prix livré et délai',
      taille: 'Taille',
      delai: 'Délai',
      orientation: { portrait: 'Portrait', paysage: 'Paysage', carre: 'Carré' },
      format: { petit: 'Petit format', moyen: 'Format moyen', grand: 'Grand format' },
      delaiJours: (min: number, max: number) => (min === max ? `${min} jour${min > 1 ? 's' : ''}` : `${min} à ${max} jours`),
      livreeChezVous: 'Livrée chez vous',
      pasDeLivraison: (pays: string) => `Pas de livraison vers ${pays}`,
      neLivrePas: (artiste: string, pays: string) => `${artiste} ne livre pas encore ${pays}.`,
    },
    sections: {
      libelle: 'Les quatre questions',
      chezMoi: {
        titre: 'Ira-t-elle chez moi ?',
        orientationFormat: (orientation: string, format: string) => `${orientation}\u00a0· ${format}`,
      },
      total: { titre: 'Combien au total ?', phrase: (pays: string) => `Prix total livré vers ${pays}`  },
      quand: { titre: 'Quand la recevrai-je ?', phrase: (pays: string) => `Délai de livraison vers ${pays}` },
      serieux: {
        titre: 'Est-ce sérieux ?',
        histoire: 'L’histoire de l’œuvre',
        selectionnee: 'Sélectionnée par Errancy',
        certificat: 'Un certificat d’authenticité signé par l’artiste accompagne l’œuvre.',
        retourTitre: 'Retour',
        retour: 'Les conditions de retour vous sont communiquées avant toute commande.',
        lienArtiste: (artiste: string) => `Découvrir ${artiste}`,
      },
    },
  },

  // Story 3.3 : prix livré et délai vers le pays choisi (cookie `pays`, France par défaut).
  livraison: {
    prixLivre: 'Prix livré',
    paysChoisi: (pays: string) => `Livraison\u00a0: ${pays}`,
    modifier: 'Modifier',
    modifierPays: (pays: string) => `Modifier le pays de livraison (${pays})`,
    libelleListe: 'Pays de livraison',
    valider: 'Valider',
    annuler: 'Annuler',
    erreur: 'Ce pays n’a pas pu être enregistré. Réessayez.',
    delai: (min: number, max: number) =>
      min === max ? `Livrée sous ${min} jour${min > 1 ? 's' : ''}` : `Livrée sous ${min} à ${max} jours`,
    pasDeLivraison: (pays: string) => `Pas de livraison vers ce pays (${pays})`,
    droitsNonInclus: 'Droits et taxes d’import éventuels non inclus',
    recalcules: (pays: string) => `Prix et délais recalculés\u00a0: ${pays}`,
  },
  // Story 3.9 : galerie filtrée pour un mur et un budget (décision du porteur du 2026-11-09 : le
  // texte d'introduction ne promet ni certificat, ni assurance, ni installation).
  // Story 3.11 : pages artistes (FR-19). Pages gérées par l'équipe (OQ-14) ; aucune valeur inventée,
  // aucune coordonnée (FR-8), aucune promesse de certificat, d'assurance ni d'installation.
  artistes: {
    titre: 'Les artistes',
    description: 'Les artistes dont Errancy présente les œuvres : leur parcours, leur démarche et leurs œuvres disponibles, avec leur prix livré chez vous.',
    introduction: 'Les artistes dont vous retrouvez les œuvres dans la galerie, présentés par l’équipe d’Errancy.',
    liste: 'Artistes de la galerie',
    vide: 'Les premiers artistes seront présentés très bientôt. Revenez nous voir.',
    introuvable: 'Artiste introuvable',
    selectionne: 'Sélectionné par Errancy',
    portrait: (nom: string) => `Portrait de ${nom}`,
    atelier: (nom: string) => `L’atelier de ${nom}`,
    sections: {
      biographie: 'Biographie',
      demarche: 'Démarche',
      formation: 'Formation',
      expositions: 'Expositions',
      atelier: 'L’atelier',
      oeuvres: 'Œuvres disponibles',
    },
    oeuvres: 'Œuvres disponibles de l’artiste',
    fichier: {
      type: 'Choisissez une photo (JPEG, PNG, HEIC…).',
      poids: 'Ce fichier dépasse 10 Mo : choisissez-en un plus léger.',
    },
  },

  galerie: {
    titre: 'La collection',
    description: 'La collection des œuvres choisies par Errancy : peintures, sculptures, photographies et art numérique, avec leur prix livré chez vous.',
    resultats: (n: number, pays: string) => `${n} ${n > 1 ? 'œuvres' : 'œuvre'}${SEPARATEUR}prix livré ${pays}`,
    modifierFiltres: 'Modifier les filtres',
    filtresActifs: 'Filtres actifs',
    retirer: (filtre: string) => `Retirer le filtre\u00a0: ${filtre}`,
    croix: '×',
    champs: {
      prixMax: 'Prix livré maximum (en euros)',
      format: 'Format',
      orientation: 'Orientation',
      couleur: 'Couleur dominante',
      ambiance: 'Ambiance',
      technique: 'Technique',
      artiste: 'Artiste',
      paysArtiste: 'Pays de l’artiste',
      disponibles: 'Disponibles seulement',
      tri: 'Trier par',
    },
    tous: 'Tous',
    toutes: 'Toutes',
    techniques: { peinture: 'Peinture', sculpture: 'Sculpture', photographie: 'Photographie', 'art-numerique': 'Art numérique' },
    tris: { defaut: 'Ordre de la galerie', 'prix-croissant': 'Prix livré croissant', 'prix-decroissant': 'Prix livré décroissant' },
    puces: {
      prixMax: (montant: string) => `Jusqu’à ${montant}`,
      artiste: (nom: string) => nom,
      paysArtiste: (pays: string) => `Artiste\u00a0: ${pays}`,
      disponibles: 'Disponibles seulement',
    },
    appliquer: 'Afficher les œuvres',
    liste: 'Œuvres de la collection',
    vendue: 'Vendue',
    vide: 'Aucune œuvre ne correspond à ces filtres.',
    retirerDernier: 'Retirer le dernier filtre',
    collectionVide: 'Les premières œuvres sont en cours de sélection. Revenez nous voir très vite.',
    afficherPlus: 'Afficher plus d’œuvres',
    erreur: 'La galerie ne s’est pas chargée.',
    erreurPage: 'Cette page ne s’est pas chargée.',
    reessayer: 'Réessayer',
    chargement: 'Chargement de la galerie',
  },
} as const satisfies Dictionnaire
