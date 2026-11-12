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
    readonly barre: { readonly nom: string; readonly visite: string; readonly prevenir: string }
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
  /** Choix de mesure de la fréquentation, bannière non bloquante et lien du pied de page (story 4.8, NFR-6). */
  readonly mesure: {
    readonly titre: string
    readonly texte: string
    readonly accepter: string
    readonly refuser: string
    readonly gerer: string
    readonly enregistreAccepte: string
    readonly enregistreRefuse: string
    readonly echec: string
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
    /** Section « Me prévenir » de la file (story 4.5). */
    readonly prevenir: {
      readonly titre: string
      readonly introduction: string
      readonly vide: string
      readonly nombre: (n: number) => string
      readonly rang: (rang: number) => string
      readonly arrivee: (date: string) => string
      readonly indisponible: string
    }
  }
  /** Paiement constaté par l'équipe, `/dashboard/admin/commandes` (story 6.4, FR-13). */
  readonly paiement: {
    readonly titre: string
    readonly introduction: string
    readonly vide: string
    readonly acheteur: string
    readonly oeuvres: string
    readonly commande: string
    readonly totalARecevoir: string
    readonly totalAvecAnnulees: string
    readonly champs: { readonly reference: string; readonly referenceAide: string; readonly montant: (monnaie: string) => string; readonly montantAide: string }
    readonly bouton: string
    readonly confirmer: (montant: string, commandes: number) => string
    readonly oui: string
    readonly annuler: string
    readonly enCours: string
    readonly erreurs: { readonly reference: string; readonly montant: string }
    readonly resume: (n: number) => string
    readonly succes: (commandes: number) => string
    /** Constat tardif (story 6.5) : certaines commandes confirmées, d'autres annulées avec remboursement demandé. */
    readonly succesTardif: (confirmees: number, annulees: number) => string
    readonly dejaConstate: string
    readonly refus: {
      readonly acces_refuse: string
      readonly invalide: string
      readonly introuvable: string
      readonly montant_different: string
      readonly monnaie_differente: string
      readonly indisponible: string
    }
    readonly incidents: {
      readonly titre: string
      readonly vide: string
      readonly panne: string
      readonly causes: {
        readonly montant_different: string
        readonly monnaie_differente: string
        readonly oeuvre_indisponible: string
        readonly commande_annulee: string
      }
      readonly commande: string
      readonly aRembourser: string
      readonly attendu: string
      readonly recu: string
      readonly le: string
      readonly suite: string
    }
    /** « Annuler la commande » (story 6.5). */
    readonly annulation: {
      readonly bouton: string
      readonly confirmer: (numero: string) => string
      readonly oui: string
      readonly non: string
      readonly enCours: string
      readonly succes: string
      readonly dejaAnnulee: string
      readonly refus: {
        readonly acces_refuse: string
        readonly invalide: string
        readonly introuvable: string
        readonly etat_invalide: string
        readonly indisponible: string
      }
    }
    /** Remboursements à traiter (story 6.5, exécutés à la main, OQ-1 ouverte). */
    readonly remboursements: {
      readonly titre: string
      readonly introduction: string
      readonly vide: string
      readonly panne: string
      readonly commande: string
      readonly acheteur: string
      readonly montant: string
      readonly demandeLe: string
      readonly bouton: string
      readonly enCours: string
      readonly succes: string
      readonly dejaEffectue: string
      readonly refus: {
        readonly acces_refuse: string
        readonly invalide: string
        readonly introuvable: string
        readonly indisponible: string
      }
    }
  }
  /** Vente assistée de l'équipe, `/dashboard/admin/commandes` (story 6.3, FR-12). */
  readonly venteAssistee: {
    readonly titre: string
    readonly titrePage: string
    readonly introduction: string
    readonly champs: {
      readonly email: string
      readonly nom: string
      readonly pays: string
      readonly oeuvres: string
      readonly oeuvresAide: string
      readonly heures: string
      readonly heuresAide: (defaut: number) => string
    }
    readonly erreurs: { readonly oeuvresManquantes: string; readonly heuresInvalides: string }
    readonly resume: (n: number) => string
    readonly envoyer: string
    readonly envoiEnCours: string
    readonly succes: (email: string, echeance: string) => string
    readonly emailNonParti: string
    /** Réservations en cours et journal (story 6.3 bis). */
    readonly suivi: {
      readonly titreEnCours: string
      readonly vide: string
      readonly titreJournal: string
      readonly videJournal: string
      readonly beneficiaire: string
      readonly beneficiaireInconnu: string
      readonly oeuvres: string
      readonly origine: string
      readonly origines: { readonly paiement: string; readonly vente_assistee: string; readonly priorite: string }
      readonly echeance: string
      readonly echue: string
      readonly lienEnvoye: string
      readonly lienNonEnvoye: string
      readonly liberer: string
      readonly confirmerLiberer: (titre: string) => string
      readonly confirmer: string
      readonly annuler: string
      readonly renvoyer: string
      readonly enCours: string
      readonly issue: string
      readonly issues: { readonly expiree: string; readonly liberee: string; readonly confirmee: string; readonly interrompue: string }
      readonly par: string
      readonly parAutomatique: string
      readonly le: string
      readonly liberee: string
      readonly renvoyee: string
      readonly dejaTerminee: string
      readonly refus: {
        readonly acces_refuse: string
        readonly invalide: string
        readonly reservation_terminee: string
        readonly lien_actif: string
        readonly indisponible: string
      }
      readonly panne: string
    }
    readonly refus: {
      readonly acces_refuse: string
      readonly liste_vide: string
      readonly monnaies_differentes: string
      readonly plafond_atteint: string
      readonly invalide: string
      readonly coordonnees_invalides: string
      readonly oeuvre_indisponible: (slug: string) => string
      readonly non_livree: (slug: string) => string
      readonly indisponible: string
    }
  }
  /** Page publique de la commande d'une vente assistée, `/commande` (story 6.3). */
  readonly commande: {
    readonly titrePage: string
    readonly titre: string
    readonly reserveJusqua: (echeance: string) => string
    readonly numero: (numero: string) => string
    readonly livraison: (pays: string) => string
    readonly prix: string
    readonly frais: string
    readonly total: string
    readonly delai: (min: number, max: number) => string
    readonly droitsNonInclus: string
    readonly paiement: string
    readonly panne: string
    readonly inactif: { readonly titre: string; readonly texte: string }
  }
  /** Annonce de l'ouverture, `/dashboard/admin/ouverture` (story 4.9, FR-35). */
  readonly ouverture: {
    readonly titre: string
    readonly titrePage: string
    readonly introduction: string
    readonly nonLevee: string
    readonly nombre: (n: number) => string
    readonly vide: string
    readonly essai: {
      readonly titre: string
      readonly texte: string
      readonly bouton: string
      readonly enCours: string
      readonly envoye: string
      readonly horsProduction: string
    }
    readonly envoi: {
      readonly titre: string
      readonly bouton: string
      readonly confirmation: (n: number) => string
      readonly confirmer: (n: number) => string
      readonly annuler: string
      readonly enCours: string
    }
    readonly bilan: {
      readonly titre: string
      readonly prevenus: (n: number) => string
      readonly echecs: (n: number) => string
      readonly restants: (n: number) => string
      readonly relancer: string
      readonly aSupprimer: (n: number) => string
      readonly arret: string
    }
    readonly refus: {
      readonly hors_production: string
      readonly nombre_invalide: string
      readonly acces_refuse: string
      readonly adresse_absente: string
      readonly envoi_echoue: string
      readonly indisponible: string
    }
    readonly chargement: string
    readonly erreur: string
    readonly reessayer: string
  }
  /** Coordonnées de l'acheteur d'un passage en caisse (story 6.1) : messages par champ. */
  readonly commandes: {
    readonly erreurs: {
      readonly emailInvalide: string
      readonly nomManquant: string
      readonly nomTropLong: (max: number) => string
      readonly adresseTropLongue: (max: number) => string
      readonly telephoneInvalide: string
    }
  }
  /** Page `/galerie/[id]/prevenir` : « Me prévenir » sur une œuvre réservée (story 4.5, FR-9). */
  readonly prevenir: {
    readonly titre: string
    readonly titrePage: (titre: string) => string
    readonly introduction: (titre: string, artiste: string) => string
    readonly retour: string
    readonly champs: { readonly email: { readonly libelle: string } }
    readonly erreurs: { readonly emailInvalide: string }
    readonly resume: (n: number) => string
    readonly envoyer: string
    readonly envoiEnCours: string
    readonly refus: string
    readonly indisponible: string
    readonly oeuvreIndisponible: string
    readonly confirmation: string
    readonly confidentialite: (contact: string) => string
  }
  /** Page publique de désinscription d'une alerte, `/auth/desinscription-alerte/[jeton]` (story 4.5). */
  readonly desinscriptionAlerte: {
    readonly titrePage: string
    readonly titre: string
    readonly confirmee: string
    readonly indisponible: string
    readonly invalide: (contact: string) => string
    readonly accueil: string
  }
  /** Page publique de désinscription, `/auth/desinscription/[jeton]` (story 4.9). */
  readonly desinscription: {
    readonly titrePage: string
    readonly titre: string
    readonly confirmee: string
    readonly indisponible: string
    readonly invalide: (contact: string) => string
    readonly accueil: string
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
    readonly ouverture: {
      readonly sujet: string
      readonly intro: string
      readonly bouton: string
      readonly suite: string
      readonly desinscription: string
    }
    readonly venteAssistee: {
      readonly sujet: string
      readonly intro: string
      readonly reserveJusqua: (echeance: string) => string
      readonly bouton: string
      readonly paiement: string
      readonly lienPersonnel: string
    }
    readonly confirmationPrevenir: {
      readonly sujet: (titre: string) => string
      readonly intro: (titre: string) => string
      readonly suite: string
      readonly desinscription: string
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
    // Story 4.7 : barre d'actions de la fiche.
    barre: { nom: 'Actions sur cette œuvre', visite: 'Réserver une visite', prevenir: 'Me prévenir' },
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
  mesure: {
    titre: 'Votre choix sur la mesure de la fréquentation',
    texte:
      'Avec votre accord, nous comptons quelques gestes (fiche consultée, pays choisi, clic sur Conseil WhatsApp, demande envoyée). Un identifiant aléatoire est gardé un an sur votre appareil pour relier les gestes d’une même visite ; rien qui vous identifie (e-mail, nom, saisie) n’est transmis. Données hébergées dans l’UE. Vous pouvez changer d’avis avec « Gérer la mesure », en bas de page.',
    accepter: 'Accepter',
    refuser: 'Refuser',
    gerer: 'Gérer la mesure',
    enregistreAccepte: 'Mesure acceptée. Vous pouvez changer d’avis avec « Gérer la mesure » en bas de page.',
    enregistreRefuse: 'Mesure refusée. Vous pouvez changer d’avis avec « Gérer la mesure » en bas de page.',
    echec: 'Votre choix n’a pas pu être enregistré. Réessayez dans un instant.',
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
  // Story 6.1 : coordonnées de l'acheteur d'un passage en caisse.
  commandes: {
    erreurs: {
      emailInvalide: 'Indiquez une adresse e-mail valide.',
      nomManquant: 'Indiquez le nom de l’acheteur.',
      nomTropLong: (max: number) => `Le nom ne peut pas dépasser ${max} caractères.`,
      adresseTropLongue: (max: number) => `L’adresse ne peut pas dépasser ${max} caractères.`,
      telephoneInvalide: 'Indiquez un numéro de téléphone valide, ou laissez le champ vide.',
    },
  },
  // Story 4.5 : « Me prévenir » sur une œuvre réservée (FR-9). Jamais d'heure de fin de réservation.
  prevenir: {
    titre: 'Me prévenir',
    titrePage: (titre: string) => `Me prévenir — ${titre}`,
    introduction: (titre: string, artiste: string) =>
      `« ${titre} » de ${artiste} est actuellement réservée. Laissez-nous votre e-mail : nous vous écrirons si elle redevient disponible.`,
    retour: 'Revenir à l’œuvre',
    champs: { email: { libelle: 'Votre e-mail' } },
    erreurs: { emailInvalide: 'Indiquez une adresse e-mail valide.' },
    resume: (n: number) => (n > 1 ? `${n} champs sont à corriger.` : '1 champ est à corriger.'),
    envoyer: 'Me prévenir',
    envoiEnCours: 'Envoi…',
    refus: 'Nous ne pouvons pas enregistrer votre demande pour le moment. Réessayez un peu plus tard.',
    indisponible: 'Envoi momentanément impossible. Réessayez dans un instant.',
    oeuvreIndisponible: 'Cette œuvre n’est plus réservée : l’alerte n’est plus possible.',
    confirmation: 'Nous vous écrirons si elle redevient disponible.',
    confidentialite: (contact: string) =>
      `Vous pouvez vous désinscrire à tout moment avec le lien de l’e-mail de confirmation, ou en écrivant à ${contact}.`,
  },
  desinscriptionAlerte: {
    titrePage: 'Désinscription — Errancy',
    titre: 'Désinscription',
    indisponible: 'Nous n’avons pas pu traiter votre demande. Réessayez dans quelques minutes.',
    confirmee: 'C’est fait : nous ne vous écrirons plus au sujet de cette œuvre et nous ne conservons plus votre adresse pour elle.',
    invalide: (contact: string) =>
      `Ce lien a déjà été utilisé ou n’est plus valable. Une question ? Écrivez-nous à ${contact}.`,
    accueil: 'Retour à l’accueil',
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
    prevenir: {
      titre: 'Me prévenir',
      introduction: 'Les personnes qui attendent qu’une œuvre réservée redevienne disponible, par œuvre, de la plus ancienne inscription à la plus récente.',
      vide: 'Aucune inscription « Me prévenir ».',
      nombre: (n: number) => (n === 1 ? '1 inscrit' : `${n} inscrits`),
      rang: (rang: number) => `N° ${rang}`,
      arrivee: (date: string) => `inscrit le ${date}`,
      indisponible: 'Les inscriptions « Me prévenir » ne se sont pas chargées. Rechargez la page dans un instant.',
    },
  },
  paiement: {
    titre: 'Paiements à constater',
    introduction:
      'Quand vous avez reçu le paiement d’un acheteur (virement ou lien de paiement), constatez-le ici : les œuvres passent en vendues et les commandes du passage sont confirmées ensemble. Le montant doit être exactement le total à recevoir.',
    vide: 'Aucune commande n’attend son paiement.',
    acheteur: 'Acheteur',
    oeuvres: 'Œuvres',
    commande: 'Commande',
    totalARecevoir: 'Total à recevoir',
    totalAvecAnnulees: 'Ou, avec les commandes annulées (qui seront alors remboursées)',
    champs: {
      reference: 'Référence du paiement',
      referenceAide: 'La référence du virement ou du lien de paiement ; elle ne sert qu’une fois.',
      montant: (monnaie: string) => `Montant reçu (${monnaie})`,
      montantAide: 'Par exemple 1 450 ou 1 450,50.',
    },
    bouton: 'Constater un paiement',
    confirmer: (montant: string, commandes: number) =>
      `Confirmer ${montant} pour ${commandes} ${commandes > 1 ? 'commandes' : 'commande'} ? Les œuvres seront vendues et cela ne s’annule pas ici.`,
    oui: 'Oui, constater',
    annuler: 'Annuler',
    enCours: 'Enregistrement…',
    erreurs: {
      reference: 'Indiquez la référence du paiement (120 caractères au plus).',
      montant: 'Indiquez un montant en euros, par exemple 1 450,50.',
    },
    resume: (n: number) => (n > 1 ? `${n} champs sont à corriger.` : '1 champ est à corriger.'),
    succes: (commandes: number) =>
      commandes > 1 ? `Paiement constaté : ${commandes} commandes sont confirmées et les œuvres sont vendues.` : 'Paiement constaté : la commande est confirmée et les œuvres sont vendues.',
    succesTardif: (confirmees: number, annulees: number) =>
      `Paiement constaté : ${confirmees} ${confirmees > 1 ? 'commandes confirmées' : 'commande confirmée'}, ${annulees} ${annulees > 1 ? 'commandes annulées' : 'commande annulée'}. Un remboursement est à traiter pour chaque commande annulée : prévenez l’acheteur vous-même.`,
    dejaConstate: 'Ce paiement était déjà constaté : rien n’a changé.',
    refus: {
      acces_refuse: 'Seule l’équipe peut constater un paiement.',
      invalide: 'Ce constat n’est pas possible : aucune commande n’attend ce paiement, ou la référence sert déjà ailleurs.',
      introuvable: 'Ce passage n’existe pas.',
      montant_different: 'Le montant ne correspond pas au total à recevoir. Rien n’est confirmé ; un incident est enregistré.',
      monnaie_differente: 'La monnaie ne correspond pas à celle de la commande. Rien n’est confirmé ; un incident est enregistré.',
      indisponible: 'Le constat n’a pas pu être enregistré. Réessayez dans un instant.',
    },
    incidents: {
      titre: 'Incidents de paiement',
      vide: 'Aucun incident.',
      panne: 'Les paiements ne se sont pas chargés. Rechargez la page dans un instant.',
      causes: {
        montant_different: 'Montant différent du total à recevoir',
        monnaie_differente: 'Monnaie différente',
        oeuvre_indisponible: 'Œuvre prise par un autre acheteur : commande annulée, remboursement demandé',
        commande_annulee: 'Paiement reçu pour une commande annulée ou abandonnée : remboursement demandé',
      },
      commande: 'Commande',
      aRembourser: 'Montant à rembourser',
      attendu: 'Attendu',
      recu: 'Reçu',
      le: 'Le',
      suite: 'Aucun e-mail ne part : prévenez l’acheteur vous-même. Les remboursements demandés sont à traiter ci-dessous.',
    },
    annulation: {
      bouton: 'Annuler la commande',
      confirmer: (numero: string) => `Annuler la commande ${numero} ? Ses œuvres seront libérées et rien n’est remboursé, puisque rien n’a été reçu.`,
      oui: 'Oui, annuler la commande',
      non: 'Garder la commande',
      enCours: 'Annulation…',
      succes: 'La commande est annulée et ses œuvres sont libérées.',
      dejaAnnulee: 'Cette commande était déjà annulée : rien n’a changé.',
      refus: {
        acces_refuse: 'Seule l’équipe peut annuler une commande.',
        invalide: 'Cette commande n’est pas reconnue.',
        introuvable: 'Cette commande n’existe pas.',
        etat_invalide: 'Cette commande n’attend plus son paiement : elle ne peut pas être annulée ici.',
        indisponible: 'L’annulation n’a pas pu être enregistrée. Réessayez dans un instant.',
      },
    },
    remboursements: {
      titre: 'Remboursements à traiter',
      introduction:
        'Quand une commande est annulée alors que son paiement est arrivé, le montant de la commande est à rembourser à la main. Une fois le remboursement fait, marquez-le comme effectué.',
      vide: 'Aucun remboursement à traiter.',
      panne: 'Les remboursements ne se sont pas chargés. Rechargez la page dans un instant.',
      commande: 'Commande',
      acheteur: 'Acheteur',
      montant: 'À rembourser',
      demandeLe: 'Demandé le',
      bouton: 'Marquer comme effectué',
      enCours: 'Enregistrement…',
      succes: 'Le remboursement est marqué comme effectué.',
      dejaEffectue: 'Ce remboursement était déjà marqué comme effectué : rien n’a changé.',
      refus: {
        acces_refuse: 'Seule l’équipe peut marquer un remboursement.',
        invalide: 'Ce remboursement n’est pas reconnu.',
        introuvable: 'Ce remboursement n’existe pas.',
        indisponible: 'Le remboursement n’a pas pu être enregistré. Réessayez dans un instant.',
      },
    },
  },
  venteAssistee: {
    titre: 'Vente assistée',
    titrePage: 'Vente assistée — Admin Errancy',
    introduction:
      'Réservez des œuvres pour un acheteur après un conseil ou une visite. Il reçoit par e-mail le lien de sa commande ; vous lui transmettez le moyen de paiement.',
    champs: {
      email: 'E-mail de l’acheteur',
      nom: 'Nom de l’acheteur',
      pays: 'Pays de livraison',
      oeuvres: 'Œuvres (un identifiant par ligne)',
      oeuvresAide: 'L’identifiant est la fin de l’adresse de la fiche : pour /galerie/mon-oeuvre, saisissez mon-oeuvre.',
      heures: 'Durée de la réservation (heures)',
      heuresAide: (defaut: number) => `${defaut} heures si vous laissez la valeur proposée.`,
    },
    erreurs: {
      oeuvresManquantes: 'Indiquez au moins une œuvre.',
      heuresInvalides: 'Indiquez un nombre entier d’heures.',
    },
    resume: (n: number) => (n > 1 ? `${n} champs sont à corriger.` : '1 champ est à corriger.'),
    envoyer: 'Réserver et envoyer le lien',
    envoiEnCours: 'Réservation…',
    succes: (email: string, echeance: string) => `Les œuvres sont réservées jusqu’au ${echeance}. Le lien est parti à ${email}.`,
    emailNonParti:
      'Les œuvres sont réservées, mais l’e-mail n’est pas parti : l’acheteur n’a pas de lien. Prévenez-le autrement.',
    suivi: {
      titreEnCours: 'Réservations en cours',
      vide: 'Aucune réservation en cours.',
      titreJournal: 'Réservations terminées (les 50 dernières)',
      videJournal: 'Aucune réservation terminée.',
      beneficiaire: 'Bénéficiaire',
      beneficiaireInconnu: 'Non renseigné',
      oeuvres: 'Œuvres',
      origine: 'Origine',
      origines: { paiement: 'Paiement', vente_assistee: 'Vente assistée', priorite: 'Priorité' },
      echeance: 'Jusqu’au',
      echue: 'échue, à libérer',
      lienEnvoye: 'Lien envoyé',
      lienNonEnvoye: 'L’e-mail n’est pas parti',
      liberer: 'Libérer',
      confirmerLiberer: (titre: string) => `Libérer la réservation (${titre}) ? Les œuvres redeviennent disponibles et le lien cesse de fonctionner. La commande reste en attente de paiement.`,
      confirmer: 'Oui, libérer',
      annuler: 'Annuler',
      renvoyer: 'Renvoyer le lien',
      enCours: 'En cours…',
      issue: 'Issue',
      issues: { expiree: 'Expirée', liberee: 'Libérée', confirmee: 'Confirmée', interrompue: 'Interrompue' },
      par: 'Par',
      parAutomatique: 'Automatique',
      le: 'Le',
      liberee: 'La réservation est libérée : les œuvres sont de nouveau disponibles.',
      renvoyee: 'Le lien est reparti à l’acheteur.',
      dejaTerminee: 'Cette réservation était déjà terminée.',
      refus: {
        acces_refuse: 'Seule l’équipe peut libérer ou renvoyer.',
        invalide: 'Cette réservation ne peut pas être libérée ici.',
        reservation_terminee: 'La réservation est terminée ou échue : le lien ne peut pas être renvoyé.',
        lien_actif: 'Un lien actif existe déjà : l’e-mail est parti.',
        indisponible: 'L’action n’a pas pu être faite. Réessayez dans un instant.',
      },
      panne: 'Les réservations ne se sont pas chargées. Rechargez la page dans un instant.',
    },
    refus: {
      acces_refuse: 'Seule l’équipe peut réserver pour un acheteur.',
      liste_vide: 'Indiquez au moins une œuvre.',
      monnaies_differentes: 'Ces œuvres sont vendues dans des monnaies différentes : faites une réservation par monnaie.',
      plafond_atteint: 'Le plafond de réservations est atteint.',
      invalide: 'La saisie n’est pas valide. Vérifiez la durée de la réservation.',
      coordonnees_invalides: 'Les coordonnées de l’acheteur sont à corriger.',
      oeuvre_indisponible: (slug: string) => `L’œuvre « ${slug} » n’est pas disponible : rien n’a été réservé.`,
      non_livree: (slug: string) => `L’œuvre « ${slug} » n’est pas livrée vers ce pays : rien n’a été réservé.`,
      indisponible: 'La réservation n’a pas pu être faite. Réessayez dans un instant.',
    },
  },
  commande: {
    titrePage: 'Votre commande — Errancy',
    titre: 'Votre commande',
    reserveJusqua: (echeance: string) => `Vos œuvres sont réservées jusqu’au ${echeance} (heure de Paris).`,
    numero: (numero: string) => `Commande ${numero}`,
    livraison: (pays: string) => `Livraison vers ${pays}`,
    prix: 'Œuvre',
    frais: 'Livraison',
    total: 'Total',
    delai: (min: number, max: number) =>
      min === max ? `Livrée sous ${min} jour${min > 1 ? 's' : ''}` : `Livrée sous ${min} à ${max} jours`,
    droitsNonInclus: 'Droits et taxes d’import éventuels non inclus',
    paiement: 'L’équipe Errancy vous transmet le moyen de paiement. Rien n’est à régler depuis cette page.',
    panne: 'Nous n’avons pas pu charger votre commande. Réessayez dans un instant.',
    inactif: {
      titre: 'Ce lien n’est plus actif',
      texte: 'La réservation est terminée ou ce lien n’est plus valable. Écrivez-nous : nous vous aidons à retrouver votre sélection.',
    },
  },
  ouverture: {
    titre: 'Annoncer l’ouverture',
    titrePage: 'Annoncer l’ouverture — Admin Errancy',
    introduction:
      'Prévenez par e-mail les personnes qui ont laissé leur adresse sur la page de maintenance. Chacune reçoit un seul message, et son adresse est supprimée dès que le message est parti.',
    nonLevee: 'Cet envoi ne lève pas la maintenance : elle se lève dans Vercel, par le porteur du site.',
    nombre: (n: number) => (n === 1 ? '1 contact à prévenir' : `${n} contacts à prévenir`),
    vide: 'Aucun contact à prévenir.',
    essai: {
      titre: 'Envoi d’essai',
      texte: 'Recevez l’e-mail à votre propre adresse, sans prévenir personne. Le lien de désinscription de l’essai ne fonctionne pas.',
      bouton: 'M’envoyer un e-mail d’essai',
      enCours: 'Envoi de l’essai…',
      envoye: 'L’e-mail d’essai est parti vers votre adresse.',
      horsProduction: 'Essai non envoyé : hors production, rien ne part (le contenu est dans le journal).',
    },
    envoi: {
      titre: 'Envoi aux contacts',
      bouton: 'Annoncer l’ouverture',
      confirmation: (n: number) =>
        `Vous allez envoyer l’e-mail d’ouverture à ${n === 1 ? '1 personne' : `${n} personnes`}. Cet envoi ne peut pas être annulé.`,
      confirmer: (n: number) => (n === 1 ? 'Envoyer à 1 personne' : `Envoyer à ${n} personnes`),
      annuler: 'Annuler',
      enCours: 'Envoi en cours, ne fermez pas la page…',
    },
    bilan: {
      titre: 'Bilan de l’envoi',
      prevenus: (n: number) => (n <= 1 ? `${n} personne prévenue` : `${n} personnes prévenues`),
      echecs: (n: number) => (n <= 1 ? `${n} envoi échoué` : `${n} envois échoués`),
      restants: (n: number) => (n <= 1 ? `${n} contact restant` : `${n} contacts restants`),
      relancer: 'Un nouvel envoi n’écrira qu’aux contacts restants, jamais à ceux déjà prévenus.',
      aSupprimer: (n: number) =>
        n === 1
          ? '1 adresse n’a pas pu être supprimée : ne relancez pas l’envoi avant de l’avoir retirée.'
          : `${n} adresses n’ont pas pu être supprimées : ne relancez pas l’envoi avant de les avoir retirées.`,
      arret: 'L’envoi s’est arrêté après plusieurs échecs de suite.',
    },
    refus: {
      hors_production: 'L’annonce ne part que depuis la production : ici, aucun e-mail ne serait envoyé et aucune adresse n’est touchée.',
      nombre_invalide: 'Le nombre de contacts à prévenir n’est pas valide. Rechargez la page.',
      acces_refuse: 'Vous n’avez pas le droit d’envoyer cette annonce.',
      adresse_absente: 'Votre compte n’a pas d’adresse e-mail.',
      envoi_echoue: 'L’e-mail n’est pas parti. Réessayez.',
      indisponible: 'L’opération n’a pas abouti. Réessayez.',
    },
    chargement: 'Chargement de la page…',
    erreur: 'La page ne s’est pas chargée.',
    reessayer: 'Réessayer',
  },
  desinscription: {
    titrePage: 'Désinscription — Errancy',
    titre: 'Désinscription',
    indisponible: 'Nous n’avons pas pu traiter votre demande. Réessayez dans quelques minutes.',
    confirmee: 'C’est fait : Errancy ne conserve plus votre adresse e-mail et ne vous écrira plus à ce sujet.',
    invalide: (contact: string) =>
      `Ce lien a déjà été utilisé ou n’est plus valable. Une question ? Écrivez-nous à ${contact}.`,
    accueil: 'Retour à l’accueil',
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
    ouverture: {
      sujet: 'Errancy ouvre ses portes',
      intro: 'Vous avez laissé votre adresse sur notre page d’attente : le site d’Errancy est maintenant ouvert.',
      bouton: 'Découvrir Errancy',
      suite: 'Nous supprimons votre adresse de notre liste : vous ne recevrez pas d’autre message de ce type.',
      desinscription: 'Pour confirmer que votre adresse n’est plus conservée, ouvrez ce lien :',
    },
    venteAssistee: {
      sujet: 'Votre sélection est réservée',
      intro: 'Comme convenu, l’équipe d’Errancy a réservé pour vous les œuvres de votre sélection.',
      reserveJusqua: (echeance: string) => `Elles vous sont réservées jusqu’au ${echeance} (heure de Paris).`,
      bouton: 'Voir ma commande',
      paiement: 'L’équipe vous transmet par ailleurs le moyen de paiement.',
      lienPersonnel: 'Ce lien est personnel : il donne accès au récapitulatif de votre commande jusqu’à la fin de la réservation.',
    },
    confirmationPrevenir: {
      sujet: (titre: string) => `Nous vous prévenons pour « ${titre} »`,
      intro: (titre: string) => `Merci : votre adresse est bien enregistrée pour l’œuvre « ${titre} », actuellement réservée.`,
      suite: 'Nous vous écrirons si elle redevient disponible.',
      desinscription: 'Pour ne plus être prévenu et supprimer votre adresse, ouvrez ce lien :',
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
