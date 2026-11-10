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
  /** Page `/conseil` : demande de sélection personnalisée (story 4.2, FR-8). */
  readonly conseil: {
    readonly titre: string
    readonly introduction: string
    readonly champs: {
      readonly espace: { readonly libelle: string; readonly aide: string }
      readonly ambiances: { readonly libelle: string; readonly aide: string }
      readonly precision: { readonly libelle: string }
      readonly budget: { readonly libelle: string; readonly aide: string }
      readonly email: { readonly libelle: string }
      readonly telephone: { readonly libelle: string }
    }
    readonly erreurs: {
      readonly espaceVide: string
      readonly espaceLong: string
      readonly ambiancesVides: string
      readonly ambianceInconnue: string
      readonly precisionLongue: string
      readonly budgetInvalide: string
      readonly budgetTropGrand: string
      readonly emailInvalide: string
      readonly telephoneInvalide: string
    }
    readonly resume: (n: number) => string
    readonly envoyer: string
    readonly envoiEnCours: string
    readonly refus: string
    readonly indisponible: string
    readonly confirmation: (heures: number) => string
    readonly confidentialite: string
    readonly nouvelleDemande: string
  }
  /** Bouton « Conseil WhatsApp » et son repli vers `/conseil` (story 4.4, FR-7, UX-DR14). */
  readonly conseilWhatsApp: {
    readonly libelle: string
    readonly libelleSur: (titre: string) => string
    readonly repliLibelle: string
    readonly repliLibelleSur: (titre: string) => string
    readonly section: string
    readonly nouvelOnglet: string
    readonly horaires: (debut: number, fin: number) => string
    readonly fuseau: string
    readonly ouvert: (delaiHeures: number, horaires: string) => string
    readonly ferme: { readonly aujourdhui: (heure: number) => string; readonly demain: (heure: number) => string; readonly lundi: (heure: number) => string }
    readonly repli: (heures: number) => string
    readonly messages: {
      readonly general: string
      readonly oeuvre: (titre: string, reference: string, lien: string) => string
      readonly artiste: (nom: string) => string
    }
  }
  /** Page `/galerie/[id]/visite` : demande de visite à distance ou en atelier (story 4.3, FR-8). */
  readonly visite: {
    readonly titre: string
    readonly titrePage: (titre: string) => string
    readonly introduction: (titre: string, artiste: string) => string
    readonly retour: string
    readonly champs: {
      readonly type: { readonly libelle: string; readonly distance: string; readonly atelier: string }
      readonly creneaux: {
        readonly libelle: string
        readonly aide: (jours: number) => string
        readonly fuseau: (fuseau: string) => string
        readonly creneau: (n: number, facultatif: boolean) => string
      }
      readonly email: { readonly libelle: string }
      readonly telephone: { readonly libelle: string }
    }
    readonly erreurs: {
      readonly typeVide: string
      readonly atelierIndisponible: string
      readonly creneauxPeu: (min: number) => string
      readonly creneauxTrop: (max: number) => string
      readonly creneauIllisible: string
      readonly creneauPasse: string
      readonly creneauLointain: (jours: number) => string
      readonly creneauxIdentiques: string
      readonly fuseauInconnu: string
      readonly emailInvalide: string
      readonly telephoneInvalide: string
    }
    readonly resume: (n: number) => string
    readonly envoyer: string
    readonly envoiEnCours: string
    readonly refus: string
    readonly indisponible: string
    readonly oeuvreIndisponible: string
    readonly confirmation: (heures: number) => string
    readonly rappelCreneaux: (fuseau: string) => string
    readonly confidentialite: string
  }
  /** File des demandes de l'équipe, `/dashboard/admin/demandes` (story 4.6, FR-25, FR-8). */
  readonly demandes: {
    readonly titre: string
    readonly titrePage: string
    readonly introduction: string
    readonly vide: string
    readonly chargement: string
    readonly erreur: string
    readonly reessayer: string
    readonly voirTraitees: string
    readonly masquerTraitees: string
    readonly types: { readonly visite: string; readonly selection: string }
    readonly typesVisite: { readonly distance: string; readonly atelier: string }
    readonly etats: { readonly nouvelle: string; readonly planifiee: string; readonly faite: string; readonly sans_suite: string }
    readonly etatActuel: (etat: string) => string
    readonly recue: (date: string) => string
    readonly oeuvre: string
    readonly oeuvreSupprimee: string
    readonly creneaux: (fuseau: string) => string
    readonly espace: string
    readonly ambiances: string
    readonly precision: string
    readonly budget: string
    readonly email: string
    readonly telephone: string
    readonly dernierChangement: (par: string, quand: string) => string
    readonly auteurInconnu: string
    readonly changerEtat: string
    readonly marquer: (etat: string) => string
    readonly marquerPour: (etat: string, demande: string) => string
    readonly nomDemande: (type: string, date: string) => string
    readonly enCours: string
    readonly refus: { readonly acces_refuse: string; readonly introuvable: string; readonly invalide: string; readonly indisponible: string }
  }
  /** Textes des e-mails transactionnels (story 4.1) : vouvoiement, sans jargon, jamais de donnée inventée. */
  readonly courriels: {
    readonly salutation: (nom: string) => string
    readonly salutationSansNom: string
    readonly signature: string
    readonly pied: (contact: string) => string
    /** Ligne ajoutée avant le pied quand le numéro WhatsApp est réglé (story 4.4). */
    readonly conseilWhatsApp: string
    readonly invitation: {
      readonly sujet: string
      readonly intro: string
      readonly bouton: string
      readonly validite: (jours: number, echeance: string) => string
      readonly lienAlternatif: string
      readonly neConcernePas: string
    }
    readonly validee: {
      readonly sujet: (titre: string) => string
      readonly intro: (titre: string) => string
      readonly suite: string
      readonly bouton: string
    }
    readonly accuse: {
      readonly sujet: string
      readonly intro: string
      readonly delai: (heures: number) => string
      readonly suite: string
    }
    readonly alerteDemande: {
      readonly sujet: string
      readonly intro: (numero: string) => string
      readonly bouton: string
      readonly suite: string
    }
    readonly accuseVisite: {
      readonly sujet: string
      readonly intro: (titre: string) => string
      readonly type: { readonly distance: string; readonly atelier: string }
      readonly creneaux: (fuseau: string) => string
      readonly creneau: (date: string) => string
      readonly delai: (heures: number) => string
      readonly suite: string
    }
    readonly alerteVisite: {
      readonly sujet: string
      readonly intro: (numero: string) => string
      readonly bouton: string
      readonly suite: string
    }
    readonly renvoyee: {
      readonly sujet: (titre: string) => string
      readonly intro: (titre: string) => string
      readonly messageEquipe: string
      readonly suite: string
      readonly bouton: string
    }
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
          { libelle: 'Demander une sélection', ancre: '/conseil' },
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
  conseil: {
    titre: 'Une sélection faite pour vous',
    introduction: 'Décrivez-nous votre espace, vos goûts et votre budget. L’équipe vous répond avec une sélection d’œuvres choisies pour vous.',
    champs: {
      espace: { libelle: 'Votre espace', aide: 'La pièce, la taille du mur, la lumière…' },
      ambiances: { libelle: 'Vos goûts', aide: 'Choisissez une ou plusieurs ambiances.' },
      precision: { libelle: 'Autre chose à nous dire ? (facultatif)' },
      budget: { libelle: 'Votre budget maximum, en euros', aide: 'Un montant, par exemple 1500.' },
      email: { libelle: 'Votre e-mail' },
      telephone: { libelle: 'Votre téléphone (facultatif)' },
    },
    erreurs: {
      espaceVide: 'Décrivez votre espace en quelques mots.',
      espaceLong: 'Votre description de l’espace est trop longue (1 000 caractères au plus).',
      ambiancesVides: 'Choisissez au moins une ambiance.',
      ambianceInconnue: 'Choisissez les ambiances dans la liste.',
      precisionLongue: 'Votre message est trop long (1 000 caractères au plus).',
      budgetInvalide: 'Indiquez votre budget en euros, par exemple 1500.',
      budgetTropGrand: 'Ce budget est trop élevé : écrivez-nous à l’adresse du pied de page.',
      emailInvalide: 'Indiquez une adresse e-mail valide.',
      telephoneInvalide: 'Ce numéro de téléphone ne semble pas valide.',
    },
    resume: (n: number) => (n > 1 ? `${n} champs sont à corriger.` : '1 champ est à corriger.'),
    envoyer: 'Envoyer ma demande',
    envoiEnCours: 'Envoi…',
    refus: 'Nous ne pouvons pas enregistrer votre demande pour le moment. Réessayez un peu plus tard.',
    indisponible: 'Envoi momentanément impossible. Réessayez dans un instant.',
    confirmation: (heures: number) => `Demande reçue. Nous vous répondons sous ${heures} heures.`,
    confidentialite: 'Vos coordonnées ne servent qu’à vous répondre.',
    nouvelleDemande: 'Faire une autre demande',
  },
  conseilWhatsApp: {
    libelle: 'Conseil WhatsApp',
    libelleSur: (titre: string) => `Conseil WhatsApp sur ${titre}`,
    repliLibelle: 'Demander conseil',
    repliLibelleSur: (titre: string) => `Demander conseil sur ${titre}`,
    section: 'Besoin d’un conseil ?',
    nouvelOnglet: '(s’ouvre dans un nouvel onglet)',
    horaires: (debut: number, fin: number) => `lundi au vendredi, ${debut} h–${fin} h`,
    // À changer avec `CONSEIL_HORAIRES.fuseau` de `reglages` (Europe/London).
    fuseau: 'heure de Londres',
    ouvert: (delaiHeures: number, horaires: string) => `Réponse en moins de ${delaiHeures} heures${SEPARATEUR}${horaires}`,
    ferme: {
      aujourdhui: (heure: number) => `Réponse aujourd’hui à partir de ${heure} h`,
      demain: (heure: number) => `Réponse demain à partir de ${heure} h`,
      lundi: (heure: number) => `Réponse lundi à partir de ${heure} h`,
    },
    repli: (heures: number) => `Réponse sous ${heures} heures`,
    messages: {
      general: 'Bonjour, je souhaiterais un conseil pour choisir une œuvre sur Errancy.',
      oeuvre: (titre: string, reference: string, lien: string) =>
        `Bonjour, je souhaiterais un conseil sur l’œuvre « ${titre} » (référence ${reference}) : ${lien}`,
      artiste: (nom: string) => `Bonjour, je souhaiterais un conseil au sujet de l’artiste ${nom}.`,
    },
  },
  visite: {
    titre: 'Demander une visite',
    titrePage: (titre: string) => `Demander une visite — ${titre}`,
    introduction: (titre: string, artiste: string) =>
      `Vous souhaitez voir « ${titre} » de ${artiste} avant de vous décider ? Proposez-nous deux ou trois créneaux : l’équipe Errancy organise la visite et vous confirme le créneau retenu.`,
    retour: 'Revenir à l’œuvre',
    champs: {
      type: { libelle: 'Type de visite', distance: 'À distance', atelier: 'En atelier' },
      creneaux: {
        libelle: 'Vos créneaux',
        aide: (jours: number) => `Proposez deux ou trois dates et heures qui vous conviennent, dans les ${jours} prochains jours.`,
        fuseau: (fuseau: string) => `Heures de votre appareil (fuseau ${fuseau}).`,
        creneau: (n: number, facultatif: boolean) => (facultatif ? `Créneau ${n} (facultatif)` : `Créneau ${n}`),
      },
      email: { libelle: 'Votre e-mail' },
      telephone: { libelle: 'Votre téléphone (facultatif)' },
    },
    erreurs: {
      typeVide: 'Choisissez un type de visite.',
      atelierIndisponible: 'La visite en atelier n’est pas proposée pour cette œuvre.',
      creneauxPeu: (min: number) => `Proposez au moins ${min} créneaux.`,
      creneauxTrop: (max: number) => `Proposez ${max} créneaux au plus.`,
      creneauIllisible: 'Indiquez chaque créneau avec une date et une heure.',
      creneauPasse: 'Proposez des créneaux à venir.',
      creneauLointain: (jours: number) => `Proposez des créneaux dans les ${jours} prochains jours.`,
      creneauxIdentiques: 'Proposez des créneaux différents.',
      fuseauInconnu: 'Le fuseau horaire de votre appareil n’est pas reconnu. Réessayez depuis un autre navigateur.',
      emailInvalide: 'Indiquez une adresse e-mail valide.',
      telephoneInvalide: 'Ce numéro de téléphone ne semble pas valide.',
    },
    resume: (n: number) => (n > 1 ? `${n} champs sont à corriger.` : '1 champ est à corriger.'),
    envoyer: 'Envoyer ma demande',
    envoiEnCours: 'Envoi…',
    refus: 'Nous ne pouvons pas enregistrer votre demande pour le moment. Réessayez un peu plus tard.',
    indisponible: 'Envoi momentanément impossible. Réessayez dans un instant.',
    oeuvreIndisponible: 'Cette œuvre n’est plus disponible pour une visite.',
    confirmation: (heures: number) => `Demande reçue. Nous vous répondons sous ${heures} heures.`,
    rappelCreneaux: (fuseau: string) => `Les créneaux proposés (fuseau ${fuseau}) :`,
    confidentialite: 'Vos coordonnées ne servent qu’à organiser la visite.',
  },
  demandes: {
    titre: 'Demandes',
    titrePage: 'Demandes — Admin Errancy',
    introduction: 'Les demandes de visite et de sélection, de la plus ancienne à la plus récente.',
    vide: 'Aucune demande en attente.',
    chargement: 'Chargement des demandes…',
    erreur: 'Les demandes ne se sont pas chargées.',
    reessayer: 'Réessayer',
    voirTraitees: 'Voir les demandes traitées',
    masquerTraitees: 'Masquer les demandes traitées',
    types: { visite: 'Visite', selection: 'Sélection personnalisée' },
    typesVisite: { distance: 'À distance', atelier: 'En atelier' },
    etats: { nouvelle: 'Nouvelle', planifiee: 'Planifiée', faite: 'Faite', sans_suite: 'Sans suite' },
    etatActuel: (etat: string) => `État : ${etat}`,
    recue: (date: string) => `Reçue le ${date}`,
    oeuvre: 'Œuvre',
    oeuvreSupprimee: 'Œuvre supprimée',
    creneaux: (fuseau: string) => `Créneaux proposés (fuseau ${fuseau})`,
    espace: 'Espace',
    ambiances: 'Goûts',
    precision: 'Précision',
    budget: 'Budget maximum',
    email: 'E-mail',
    telephone: 'Téléphone',
    dernierChangement: (par: string, quand: string) => `Dernier changement par ${par}, le ${quand}`,
    auteurInconnu: 'un compte supprimé',
    changerEtat: 'Changer l’état',
    marquer: (etat: string) => `Marquer « ${etat} »`,
    marquerPour: (etat: string, demande: string) => `Marquer « ${etat} » : ${demande}`,
    nomDemande: (type: string, date: string) => `${type}, reçue le ${date}`,
    enCours: 'Enregistrement…',
    refus: {
      acces_refuse: 'Vous n’avez pas le droit de modifier cette demande.',
      introuvable: 'Cette demande n’existe plus.',
      invalide: 'Cet état n’est pas reconnu.',
      indisponible: 'Le changement n’a pas pu être enregistré. Réessayez.',
    },
  },
  courriels: {
    salutation: (nom: string) => `Bonjour ${nom},`,
    salutationSansNom: 'Bonjour,',
    signature: 'L’équipe Errancy',
    pied: (contact: string) => `Une question ? Écrivez-nous à ${contact}`,
    conseilWhatsApp: 'Un conseil rapide ? Écrivez-nous sur WhatsApp',
    invitation: {
      sujet: 'Votre invitation à rejoindre Errancy',
      intro: 'L’équipe d’Errancy vous invite à créer votre accès artiste : vous pourrez déposer vos œuvres et suivre leur sélection.',
      bouton: 'Créer mon accès',
      validite: (jours: number, echeance: string) => `Ce lien est personnel. Il est valable ${jours} jours, jusqu’au ${echeance}.`,
      lienAlternatif: 'Si le bouton ne s’ouvre pas, copiez ce lien dans votre navigateur :',
      neConcernePas: 'Cette invitation ne vous concerne pas ? Ignorez simplement ce message.',
    },
    validee: {
      sujet: (titre: string) => `Votre œuvre « ${titre} » est publiée`,
      intro: (titre: string) => `Bonne nouvelle : l’équipe a sélectionné votre œuvre « ${titre} ». Elle est maintenant publiée sur Errancy.`,
      suite: 'Vous pouvez la consulter sur le site à tout moment.',
      bouton: 'Voir l’œuvre',
    },
    accuse: {
      sujet: 'Nous avons bien reçu votre demande',
      intro: 'Merci : nous avons bien reçu votre demande de sélection. Nous préparons une proposition d’œuvres choisies pour votre espace.',
      delai: (heures: number) => `Nous vous répondons sous ${heures} heures.`,
      suite: 'Vous pouvez répondre à ce message pour nous envoyer des photos de votre espace.',
    },
    alerteDemande: {
      sujet: 'Nouvelle demande de sélection',
      intro: (numero: string) => `Une demande de sélection personnalisée vient d’arriver (numéro ${numero}).`,
      bouton: 'Ouvrir la file des demandes',
      suite: 'Les coordonnées du visiteur ne figurent pas dans ce message.',
    },
    accuseVisite: {
      sujet: 'Nous avons bien reçu votre demande de visite',
      intro: (titre: string) => `Merci : nous avons bien reçu votre demande de visite de l’œuvre « ${titre} ».`,
      type: { distance: 'Visite à distance', atelier: 'Visite en atelier' },
      creneaux: (fuseau: string) => `Les créneaux que vous proposez (fuseau ${fuseau}) :`,
      creneau: (date: string) => `– ${date}`,
      delai: (heures: number) => `Nous vous répondons sous ${heures} heures.`,
      suite: 'L’équipe Errancy organise la visite et vous écrit pour confirmer le créneau retenu.',
    },
    alerteVisite: {
      sujet: 'Nouvelle demande de visite',
      intro: (numero: string) => `Une demande de visite d’œuvre vient d’arriver (numéro ${numero}).`,
      bouton: 'Ouvrir la file des demandes',
      suite: 'Les coordonnées du visiteur ne figurent pas dans ce message.',
    },
    renvoyee: {
      sujet: (titre: string) => `Votre œuvre « ${titre} » : nos remarques`,
      intro: (titre: string) => `L’équipe a étudié votre œuvre « ${titre} » et vous la renvoie avant de la publier.`,
      messageEquipe: 'Le message de l’équipe :',
      suite: 'Vous pouvez corriger votre dépôt, puis envoyer à nouveau l’œuvre à l’équipe.',
      bouton: 'Reprendre mon dépôt',
    },
  },
} as const satisfies Dictionnaire
