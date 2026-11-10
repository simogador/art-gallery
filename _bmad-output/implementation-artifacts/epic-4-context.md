# Epic 4 Context: Le visiteur hésitant parle à une personne, et l'équipe mesure ce qui fait vendre

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Permettre au visiteur qui hésite (souvent de la diaspora, sur mobile) de parler à une personne d'Errancy : Conseil WhatsApp contextualisé (avec repli vers un formulaire), demande de visite ou de sélection avec accusé et délai annoncé, inscription « Me prévenir » sur une œuvre réservée. La fiche reçoit sa barre d'actions du Lot 1 (sans « Acheter »). L'équipe traite une file unique des demandes, et le porteur mesure le tunnel avec le consentement du visiteur. L'epic apporte aussi l'envoi fiable des e-mails (invitation et résultat de curation de l'Epic 2 cessent d'être manuels) et l'annonce d'ouverture aux contacts de la maintenance. Préalable : le porteur choisit le prestataire d'e-mails (AQ-1) avant la story 4.1.

## Stories

- Story 4.1: E-mails transactionnels fiables
- Story 4.2: Demande de sélection personnalisée
- Story 4.3: Demande de visite à distance ou en atelier
- Story 4.4: Conseil WhatsApp contextualisé, avec repli
- Story 4.5: « Me prévenir » sur une œuvre réservée
- Story 4.6: File des demandes de l'équipe
- Story 4.7: Barre d'actions de la fiche (Lot 1)
- Story 4.8: Mesure du tunnel avec consentement
- Story 4.9: Annonce de l'ouverture aux contacts de la maintenance

## Requirements & Constraints

- **Conseil WhatsApp** : présent sur fiche, page artiste, accueil, galerie et pied de page, message prérempli (slug et lien de l'œuvre, ou nom de l'artiste), délai de réponse et horaires affichés en sous-ligne (« Réponse en moins de [délai] · [horaires] » ; hors horaires « Réponse demain à partir de [HH] h »). Ordinateur : WhatsApp Web ou QR code. Numéro, horaires et délai sont des valeurs d'OQ-7 saisies par l'équipe (ouverte) : réglages absents = même emplacement et même libellé de délai, mais le bouton ouvre la demande de conseil. Ni vert ni logo en couleur ; bouton nommé par son action.
- **Demandes** : sélection (espace, goût, budget, e-mail obligatoire, téléphone facultatif) sur `/conseil` ; visite (à distance, ou en atelier seulement si l'artiste l'accepte, deux ou trois créneaux dans le fuseau de l'appareil) sur `/galerie/[id]/visite`. États `nouvelle`, `planifiée`, `faite`, `sans suite`, avec qui et quand. Accusé à l'écran et par e-mail avec le délai. Les coordonnées de l'artiste n'apparaissent jamais ; la visite est organisée par l'équipe (OQ-8 ouverte : qui la mène, délais exacts).
- **Anti-abus** : les envois répétés par IP ou par e-mail au-delà d'un seuil sont refusés sans message technique.
- **Me prévenir** : œuvre `reservee` seulement, rang d'arrivée conservé, aucun doublon, désinscription par lien sans connexion. La notification à l'expiration viendra avec les réservations (Epic 6).
- **Barre d'actions** : disponible = Conseil WhatsApp principal + « Réserver une visite » ; réservée = « Me prévenir » + Conseil WhatsApp, jamais d'heure de fin ; vendue = Conseil WhatsApp + lien artiste ; pays non livré = Conseil WhatsApp principal, visite conservée. « Acheter » absent (pas grisé) tant que `lot2Ouvert()` est faux. Jamais plus d'une action principale ; masquée clavier ouvert ; à partir de `lg`, bloc collant en haut de la colonne d'informations.
- **Mesure (NFR-6)** : événements typés (vue de fiche, choix du pays, clic Conseil WhatsApp, envoi d'une demande, ajout au panier, début de commande, commande confirmée), chacun avec slug de l'œuvre et source d'arrivée. Consentement proposé là où la loi l'exige, sans fenêtre bloquante, modifiable depuis la politique de cookies. Refus = aucun événement (test), seuls les taux de consentement et de refus sont comptés ; aucune URL portant un jeton n'est mesurée.
- **E-mails** : vouvoiement, textes du dictionnaire, sans jargon, tous avec lien Conseil WhatsApp (ou repli vers la demande de conseil). Invitation (« Créer mon accès », durée de validité), résultat de curation (publication ou commentaire de l'équipe), accusé de demande, confirmation d'inscription « Me prévenir », « Ouverture du site ». Un seul e-mail par événement même traité deux fois.
- **Annonce d'ouverture** : déclenchée par le porteur depuis l'administration, une seule fois par contact consentant, lien de désinscription ; ne lève pas la maintenance et ne touche pas `robots.txt`.
- Journaux et charges utiles : identifiants seulement, jamais d'adresse ni de téléphone.

## Technical Decisions

- **Modules** : `notifications` (port d'envoi d'e-mail, contenus, alertes de l'équipe), `demandes` (demandes, inscriptions « Me prévenir », contacts de maintenance, seul propriétaire de ces données et des coordonnées de visiteurs), `mesure` (port Mesure, consentement). Chacun expose son API par `index.ts` ; tout nouveau module s'ajoute à `MODULES_METIER` de `.eslintrc.js` s'il touche Prisma.
- **Ports et adaptateurs** : e-mail = adaptateur du prestataire choisi (AQ-1, garanties de transfert UE) + adaptateur « journal » hors production ; mesure = PostHog hébergé dans l'UE + adaptateur « journal » hors production. Aucun nom de prestataire ni SDK hors adaptateur et variables d'environnement ; aucun composant n'importe le SDK de mesure.
- **Événements** : tout e-mail naît d'un événement du catalogue typé (`src/lib/evenements/catalogue.ts`, nom `NomAuPasseCompose`, charge = ids), relié dans `src/lib/abonnements.ts` ; réclamation atomique (événement, gestionnaire) avant tout effet, répartition par `repartirApresValidation` après la transaction. Pas de balayage des échecs tant qu'AQ-2 (plan Vercel) reste ouverte ; le balayage (`api/balayage`) et `after()` viennent avec l'Epic 5/6. Un nouvel événement s'ajoute au catalogue, à `abonnements.ts` et à un test.
- **Jetons** : via `src/lib/acces/jetons.ts` seulement ; le jeton d'invitation est émis à l'envoi de l'e-mail par le gestionnaire de `notifications` (valeur en clair seulement dans l'e-mail) ; usage `desinscription` pour « Me prévenir » et l'annonce d'ouverture ; pages à jeton en `Referrer-Policy: no-referrer`, échange contre cookie `httpOnly`.
- **Contacts de maintenance** : tables `InscriptionOuverture` et `TentativeInscription` (story 1.9), export CSV admin existant.
- **Accès** : file des demandes sur `/dashboard/admin/demandes`, acteur `admin` via `acteurCourant()`, vérifié par test ; résultats `{ ok, code }`, mutations par actions serveur, formulaires publics limités en débit.
- **Réglages** : numéro, horaires et délais WhatsApp, délai de réponse annoncé, vivent dans `reglages` (valeurs saisies par l'équipe, rien d'inventé) ; la disponibilité de l'œuvre se lit par `disponibilite`, jamais en lisant les colonnes.
- Migration Prisma commitée pour tout changement de schéma ; textes dans `fr` (règle `react/jsx-no-literals`, mise à jour de `eslint/exceptions-textes.cjs` à la baisse seulement).

## UX & Interaction Patterns

- Formulaires : libellé visible, `type` et `autocomplete` adaptés, validation à la sortie du champ et à l'envoi (jamais à la frappe), saisie conservée après erreur, message sous le champ et résumé en tête s'il y en a plusieurs ; bouton « Envoi… » qui ignore les doubles appuis ; champ manquant en bordure tiretée « À compléter · ».
- Confirmations : « Demande reçue. Nous vous répondons sous [délai]. » ; « Nous vous écrirons si elle redevient disponible. »
- Une seule action principale par écran ; un bouton indisponible indique sa raison. Actions nommées (« Conseil WhatsApp sur [titre] »).
- File d'administration : de la plus ancienne à la plus récente, états vide (« Aucune demande en attente. »), chargement (squelettes) et erreur (« Réessayer »).
- Tous les socles de l'Epic 3 s'appliquent : cibles 44 px, focus noir, propriétés logiques, or décoratif seulement, ton sans promotion ni jargon, au vouvoiement.

## Cross-Story Dependencies

- 4.1 précède toute story qui envoie un e-mail (4.2, 4.3, 4.5, 4.9) ; il dépend de 3.4 (événements, réclamation atomique), 2.4 (invitations) et 2.7 (curation), et de la décision AQ-1.
- 4.4 fournit le repli vers 4.2 ; 4.7 assemble 4.3, 4.4 et 4.5 sur la fiche (3.5 à 3.7) ; 4.6 lit les demandes de 4.2, 4.3 et les inscriptions de 4.5.
- 4.5 n'a d'effet visible qu'avec l'état `reservee`, atteint seulement en Epic 6 ; la notification à l'expiration et la priorité y sont renvoyées.
- 4.8 mesure aussi des événements d'achat (panier, commande) qui n'existent qu'en Epics 6 et 7 ; la mesure du clic WhatsApp et de l'envoi de demande dépend de 4.2 à 4.4.
- 4.9 dépend des contacts de la story 1.9 et du désabonnement de 4.1 ; la levée de la maintenance reste un acte du porteur dans Vercel.
- Ouvertes : OQ-7 (WhatsApp), OQ-8 (visite), AQ-1 (e-mails), AQ-2 (balayage). Epic 5 remplacera la répartition par `after()` ; Epic 7 publiera les pages de confiance liées depuis les e-mails.
