- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-correctifs-de-securite-et-node-24.md`
  summary: Décider si `engines.node` reste `>=22.12` ou devient borné (`24.x` ou `22.x || 24.x`).
  evidence: Vercel utilise `engines.node` en priorité sur le réglage Node du projet ; une plage ouverte `>=` peut suivre la plus récente version majeure proposée par Vercel. Par ailleurs `eslint-visitor-keys@5` (lint) exige `^22.13` : avertissement `EBADENGINE` sous 22.12.x. Valeur actuelle fixée par la décision du porteur du 2026-10-27, donc question à lui poser.
  resolution: Résolu le 2026-10-27 par le porteur : `engines.node` `24.x`, appliqué dans la story 1.1 (PR #7).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-migrations-alignees-sur-la-base-reelle.md`
  summary: Supprimer l'index redondant `Order_stripeSessionId_idx` (doublon de l'index unique `Order_stripeSessionId_key`) par une migration ultérieure.
  evidence: La ligne de base doit refléter la production telle quelle ; `@@index([stripeSessionId])` dans `schema.prisma` duplique `@unique`. À traiter avec l'éclatement d'`Order` (AR-10).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-interrupteur-lot-2.md`
  summary: Quand le Lot 2 est fermé, masquer « Ajouter au panier » / « Voir le panier » sur la fiche œuvre et offrir dans le panier un moyen de joindre l'équipe.
  evidence: Après la story 1.7, un visiteur peut encore remplir un panier sans pouvoir payer (`src/app/galerie/[id]/ArtworkDetail.tsx`) ; le message du panier n'a ni lien ni contact. Relève de la barre d'actions du Lot 1 (story 4.7) et du conseil (stories 4.2 à 4.4).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-9-contacts-maintenance.md`
  summary: Décider avec le porteur la durée de conservation et la purge des inscrits, le moyen de se désinscrire, les mentions de confidentialité du formulaire et une éventuelle double confirmation par e-mail (double opt-in).
  evidence: La story 1.9 enregistre l'e-mail et la date du consentement, sans désinscription ni purge ni lien de confidentialité (NFR-6, AQ-6). Une adresse peut être inscrite par un tiers sans double confirmation ; l'e-mail d'ouverture est prévu en story 4.9 (module notifications), qui pourra porter le lien de désinscription.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-previews-isolees-de-la-base-de-production.md`
  summary: Après une inscription sur une préversion, le site renvoie vers `errancy.art` (production) au lieu de rester sur l'adresse de la préversion.
  evidence: Constaté le 2026-10-28 en vérifiant la story 1.8 : le compte est bien créé dans la base `preview`, mais la redirection qui suit part vers la production. Cause probable : une variable d'URL d'authentification (`AUTH_URL` ou `NEXTAUTH_URL`) fixée à `https://errancy.art` aussi pour « Preview » dans Vercel. À vérifier par le porteur ; sans conséquence sur les données.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-prix-et-dimensions-exacts.md`
  summary: Tester l'affichage du prix sur la confirmation et la liste admin, et la charge utile du formulaire `ArtworkForm` (prix envoyé tel que saisi).
  evidence: Revue de la story 2.1 : ces lectures et cette saisie ne sont couvertes par aucun test (pas de rendu de pages ni de tests de composants dans la suite) ; à couvrir quand ces écrans passent par leurs modules (2.5, 2.7).
- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-prix-et-dimensions-exacts.md`
  summary: Ajouter des contraintes `CHECK` en base (`prixCentimes` > 0, millimètres ≥ 1, devise sur trois lettres) une fois les anciennes colonnes retirées.
  evidence: Les règles ne vivent que dans `conversions.ts` et le SQL de recopie ; une écriture hors application pourrait stocker une valeur invalide. À faire avec la story 2.10.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-3-zones-de-livraison.md`
  summary: Ajouter à `OffreLivraison` des contraintes `CHECK` (frais ≥ 0, délais ≥ 0, transport min ≤ max, devise sur trois lettres) avec la story 2.6, qui écrit la table.
  evidence: Revue de la story 2.3 : la table est créée sans contrainte de valeur ; vide jusqu'à la story 2.6. Vérifier que `prisma migrate diff` de la CI tolère des `CHECK` écrits à la main.
  resolution: Résolu par la story 2.6 (migration `20261103100532_expedition_engagements`) : six contraintes `CHECK`, dont « valeurs présentes si livrée » et « vides si non livrée » ; `prisma migrate diff` les ignore (aucune différence), couvertes par `tests/livraison.test.ts`.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-invitation-artiste.md`
  summary: Archiver le texte de chaque version de la charte artiste acceptée et permettre à l'artiste de la relire depuis son espace.
  evidence: Revue de la story 2.4 : seule la version (`Invitation.charteVersion`) est enregistrée ; les textes antérieurs ne vivent que dans l'historique git. À faire avant que la charte ne soit définitive (relecture juridique).
- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-invitation-artiste.md`
  summary: Purger les jetons consommés, révoqués ou échus et ceux des invitations supprimées.
  evidence: Revue de la story 2.4 : `Jeton.cible` n'a pas de clé étrangère (table générique d'AD-14) ; aucune purge n'existe. À rattacher au balayage d'AD-11.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-deposer-une-oeuvre.md`
  summary: Nettoyer les fichiers Cloudinary orphelins (envoi non enregistré, onglet fermé, œuvre supprimée).
  evidence: seuls « Remplacer » et un format refusé suppriment le fichier ; la suppression d'une œuvre efface les lignes PhotoOeuvre mais pas les fichiers.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-deposer-une-oeuvre.md`
  summary: Faire refuser les brouillons par l'ancienne route PUT /api/artiste/oeuvres/[slug] (ou la retirer en 2.7/2.8).
  evidence: elle écrit titre, technique, prix et dimensions sans les règles du dépôt ; seul l'artiste propriétaire peut l'appeler.
  resolution: Résolu par la story 2.6 : la route répond 409 pour un brouillon ou une œuvre en curation (test dans `tests/depot.test.ts`).
- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-deposer-une-oeuvre.md`
  summary: Reprendre dans le formulaire de dépôt l'image (imageUrl) d'un brouillon créé avant la story 2.5.
  evidence: non vérifié (medium s'il en existe) ; à régler en comptant en production les œuvres `brouillon` avec imageUrl non vide et sans PhotoOeuvre.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-deposer-une-oeuvre.md`
  summary: Tester la file d'enregistrement du formulaire de dépôt (ordre, slug du premier envoi, échec).
  evidence: Vitest tourne sans DOM ; extraire la file dans une fonction pure ou ajouter jsdom.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-expedition-engagements-curation.md`
  summary: Interdire à la bascule admin `definirPublication` de publier ou dépublier une œuvre `en_curation` hors de la file de curation (story 2.7).
  evidence: un admin peut publier une œuvre en curation sans relecture, ou la renvoyer en brouillon sans prévenir l'artiste.
  resolution: Résolu par la story 2.7 : `definirPublication` répond `transition_interdite` pour une œuvre `en_curation` (et la route admin 409) ; la bascule est masquée dans la liste, la file de curation est le seul chemin (test dans `tests/curation.test.ts`).
- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-expedition-engagements-curation.md`
  summary: Mettre à jour la puce « Dépôt d'une œuvre (story 2.5) » d'AGENTS.md : en curation → récapitulatif en lecture seule, publiée → ancienne page.
  evidence: la puce 2.5 dit encore qu'une œuvre hors brouillon ouvre l'ancienne page d'édition.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-expedition-engagements-curation.md`
  summary: Tester la logique client des zones du formulaire de dépôt (saisie partielle, « Je ne livre pas », reprise).
  evidence: Vitest tourne sans DOM ; extraire la décision de `sortieZone` dans une fonction pure de depot-regles.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-expedition-engagements-curation.md`
  summary: Fixer la règle pour une œuvre envoyée ou publiée sans offre pour une zone créée ensuite (« pas d'offre = non livrée » ?).
  evidence: non vérifié ; à trancher avec l'affichage du prix livré (épopée 3).

- source_spec: `_bmad-output/implementation-artifacts/spec-2-7-curation-par-l-equipe.md`
  summary: Décider si la bascule admin historique `definirPublication` doit aussi exiger l'accord signé (ou refuser tout brouillon de dépôt) quand elle publie.
  evidence: la story 2.7 ne la ferme que pour `en_curation` (spec) ; un admin peut encore publier par la bascule un brouillon jamais envoyé, ou republier une œuvre dépubliée, sans accord signé (œuvres de démonstration comprises, retirées en 2.9). Question au porteur.
  resolution: Résolu dans la story 2.7 (relecture) : pour publier, `definirPublication` refuse `accord_absent` sans `Artist.accordSigneLe`, et `transition_interdite` pour une œuvre passée par le dépôt (`envoyeeEnCurationLe`, décision de curation ou photo de dépôt) dont la dernière décision n'est pas `valider` ; dépublier reste permis. La bascule est masquée dans l'administration là où elle serait refusée (`basculesPublication`). Conséquence : les œuvres de démonstration ne se republient plus sans accord signé de leur artiste. Tests dans `tests/curation.test.ts`.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-7-curation-par-l-equipe.md`
  summary: Tester la logique client de la page de curation (bouton « Valider » indisponible tant que la liste n'est pas cochée, erreur du commentaire avant envoi).
  evidence: Vitest tourne sans DOM ; le serveur revérifie tout (`controle_incomplet`, `commentaire_invalide`, couverts par `tests/curation.test.ts`). Vérification manuelle en préversion.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-7-curation-par-l-equipe.md`
  summary: Conserver l'historique des décisions de curation quand une œuvre est supprimée (`RESTRICT` ou suppression logique).
  evidence: `DecisionCuration` est supprimée en cascade avec l'œuvre.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-7-curation-par-l-equipe.md`
  summary: Signaler « Renvoyée — à corriger » dans les listes d'œuvres de l'artiste.
  evidence: le renvoi n'est visible que sur la fiche de dépôt ; aucun e-mail avant l'épopée 4.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-8-disponibilite-artiste.md`
  summary: Tester dans un navigateur la feuille de confirmation (Échap, voile, retour du focus) et le choix de disponibilité.
  evidence: Vitest tourne sans DOM ; vérification manuelle sur la préversion en attendant jsdom ou Playwright.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-8-disponibilite-artiste.md`
  summary: Vérifier la remise en vente d'une œuvre publiée par l'ancien chemin (sans photos ni engagements du dépôt).
  evidence: non vérifié ; la page de curation suppose les données du dépôt.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-9-catalogue-reel.md`
  summary: Tester par un rendu les règles d'affichage de la section `Hero` de l'accueil (chiffres nuls masqués, pas de carte de prix pour une œuvre vendue, motif sans œuvre).
  evidence: medium (non vérifié) ; les tests n'inspectent que les props passées à `Hero`, jamais son rendu ; un rendu sous Node demande de neutraliser `useScroll` de framer-motion. Vérification manuelle en préversion en attendant.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-10-suppression-anciennes-colonnes.md`
  summary: Ajouter les contraintes `CHECK` sur `Artwork` (`prixCentimes > 0`, millimètres ≥ 1, devise de trois lettres) dans une story à part.
  evidence: décision du porteur du 2026-11-04 (revue de la spec 2.10) : séparer pour qu'une donnée de démonstration non conforme ne fasse pas échouer la suppression des colonnes ; prévoir une requête de contrôle avant la migration.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-10-suppression-anciennes-colonnes.md`
  summary: Supprimer les œuvres et artistes de démonstration (et leurs images Cloudinary, après confirmation des droits) dans une story à part.
  evidence: décision du porteur du 2026-11-04 : hors 2.10, suppression irréversible touchant expositions, éventuelles commandes et Cloudinary (`docs/images-demonstration.md`).
- source_spec: `_bmad-output/implementation-artifacts/spec-2-10-suppression-anciennes-colonnes.md`
  summary: Après la migration B de la 2.10, supprimer dans une PR de suivi les scripts SQL de recopie, d'écarts et de correction des stories 2.1 et 2.2 et leurs sections de `docs/migrations.md`.
  evidence: ces scripts lisent les colonnes supprimées ; ils servent encore aux contrôles juste avant B.
  resolution: Résolu le 2026-11-05 (PR de suivi de la story 2.10) : scripts supprimés, sections 2.1 et 2.2 de `docs/migrations.md` marquées comme historiques ; `vendues-sans-commande.sql` gardé (nouvelles colonnes seulement).
- source_spec: `_bmad-output/implementation-artifacts/spec-2-10-suppression-anciennes-colonnes.md`
  summary: Décrire précisément dans AGENTS.md et dans `tests/anciennes-colonnes.test.ts` la portée du scan des anciennes colonnes (chaînes, constantes d'autres fichiers, objets des fonctions d'aide non suivis).
  evidence: revue 1 de la story 2.10 ; le scan est une heuristique, TypeScript refuse les clés après B.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-10-suppression-anciennes-colonnes.md`
  summary: Tester les requêtes de contrôle lancées avant la migration B (`dimensions-illisibles.sql`, `prix-non-recopies.sql`, requête « artistes avec accord » de la procédure).
  evidence: medium (non vérifié) ; contrôle manuel unique en lecture seule, scripts supprimés après B.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-10-suppression-anciennes-colonnes.md`
  summary: Compléter l'entrée précédente : `ecarts-prix-dimensions.sql` et `ecarts-publication-disponibilite.sql`, lancées avant B, n'ont plus de test non plus (relecture 2).
  evidence: tests des scripts 2.1/2.2 retirés avec les colonnes ; contrôle manuel unique avant B, scripts supprimés après.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-10-suppression-anciennes-colonnes.md`
  summary: Rendre `Artwork.publication` et `disponibilite` obligatoires (après vérification qu'aucune ligne n'est vide) et retirer les chemins `estRecopiee` / `non_recopiee`.
  evidence: après B, aucun code ne crée d'œuvre sans les deux axes ; les branches « non recopiée » ne servent plus qu'aux œuvres antérieures à la story 2.2.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-10-suppression-anciennes-colonnes.md`
  summary: Le lien « mot de passe oublié » de `/auth/connexion` mène à une page 404 : prévoir la réinitialisation du mot de passe (ou retirer le lien).
  evidence: constaté par le porteur le 2026-11-05 en production ; sans lien avec la story 2.10 (le compte admin du porteur se connecte par Google).
- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-interface-lisible-accessible.md`
  summary: Vérifier automatiquement les champs en 16 px et les cibles de 44 × 44 px (scan ou test de rendu).
  evidence: relecture de la story 3.1 ; ces règles d'AGENTS.md ne sont contrôlées qu'à la main en préversion.
- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-formats-textes-montants.md`
  summary: Contrôler aussi les textes d'attributs visibles ou annoncés (`aria-label`, `alt`, `placeholder`, `title`) sur les surfaces de l'epic 3.
  evidence: `react/jsx-no-literals` avec `ignoreProps` ne les voit pas ; `noAttributeStrings` viserait aussi `className`.
- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-formats-textes-montants.md`
  summary: Remplacer les coordonnées inventées du pied de page (adresse, téléphone, e-mail, nom « Galerie d'art contemporain », copyright) par celles d'Errancy, à fournir par le porteur avant l'ouverture.
  evidence: valeurs de démonstration antérieures à la story 3.2, déplacées telles quelles dans `src/lib/i18n/fr.ts` ; contraire à la règle « aucune valeur inventée ».

- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-pays-prix-total.md`
  summary: Le panier affiche le prix nu de l'œuvre et « Transport : Offert », en contradiction avec le prix livré de la fiche.
  evidence: `src/app/panier/CartContent.tsx:86` et `addItem({ price: artwork.price })` de `ArtworkDetail.tsx` ; à aligner quand OQ-3 (qui paie la livraison) sera tranchée et le panier refait (Lot 2).
- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-pays-prix-total.md`
  summary: L'accueil et le profil artiste montrent le prix de l'œuvre seule, sans pays ; la fiche a perdu « TVA non applicable ».
  evidence: `sections/Gallery.tsx`, `Hero.tsx`, `ArtistProfile.tsx` utilisent `formatPrice(price)` ; la mention de TVA est une question pour le porteur (statut fiscal), à reposer en 3.5/3.9.
- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-pays-prix-total.md`
  summary: Une œuvre non livrée vers le pays choisi reste ajoutable au panier.
  evidence: la fiche garde le bouton d'ajout ; sans conséquence tant que le Lot 2 est fermé, à traiter avec le panier (epic 6).
- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-pays-prix-total.md`
  summary: Le choix du pays dans `PaysLivraison` (envoi, erreur, rafraîchissement, annonce) n'a aucun test d'interaction.
  evidence: aucune bibliothèque DOM (testing-library, jsdom) dans le dépôt ; vérifié à la main en préversion.
- source_spec: `_bmad-output/implementation-artifacts/spec-3-4-journal-evenements.md`
  summary: Purge ou rétention des tables `Evenement` et `TraitementEvenement` (aucun nettoyage prévu).
  evidence: chaque changement de publication ou de disponibilité ajoute des lignes sans limite (relecture story 3.4).
- source_spec: `_bmad-output/implementation-artifacts/spec-3-4-journal-evenements.md`
  summary: Vérifier que la liste des œuvres en cache (`unstable_cache`) reste sous la limite de 2 Mo par entrée du cache de données Vercel.
  evidence: non vérifié (medium) ; à mesurer avec le catalogue réel au lancement.
- source_spec: `_bmad-output/implementation-artifacts/spec-3-4-journal-evenements.md`
  summary: Invalider le cache du catalogue lors des modifications sans événement (prix, titre, photos, accord ou activité d'un artiste), aujourd'hui visibles sous 60 s.
  evidence: accepté par le porteur le 2026-11-06 tant que le Lot 2 est fermé ; à revoir avant l'ouverture de l'achat (le prix affiché peut différer 60 s de celui relu au paiement).
- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-fiche-oeuvre-photos-rangee.md`
  summary: Tests d'interaction du carrousel et du plein écran (aucun harnais DOM dans le dépôt).
  evidence: `CarrouselPhotos` n'est testé qu'en rendu serveur ; vérification manuelle en préversion pour cette story, harnais (jsdom ou Playwright) à décider à part.
- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-fiche-oeuvre-photos-rangee.md`
  summary: Confirmer avec le porteur si le « plus grand côté » du format doit compter la profondeur des sculptures.
  evidence: `formatOeuvre` n'utilise que hauteur et largeur (non vérifié, medium si la profondeur dépasse les deux autres).
- source_spec: `_bmad-output/implementation-artifacts/spec-3-10-accueil-curatorial.md`
  summary: Le lien « À propos » de l'en-tête (`/#about`) ne mène à aucune section de l'accueil.
  evidence: l'ancre n'existait déjà plus avant la story 3.10 ; à traiter avec la page « À propos » (Epic 7 ou story dédiée).
- source_spec: `_bmad-output/implementation-artifacts/spec-3-10-accueil-curatorial.md`
  summary: Tests de rendu de `Artists`, `Exhibitions` (ordre, plafond de 4) et de la bascule « Sélection de l'accueil » de l'administration (seuls les types et le module sont vérifiés).
  evidence: logique de présentation sans risque pour l'instant (relecture story 3.10).

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-emails-transactionnels.md`
  summary: `InvitationArtiste.tsx` (états de l'invitation, alerte « L'e-mail n'est pas parti », bouton « Relancer ») n'a pas de test navigateur.
  evidence: l'état vient de `useFormState`, non pris en charge par le harnais (React 18 stable) ; la partie serveur (`envoi_echoue`, statuts) est testée. À isoler dans un composant sans `useFormState`, comme `PhotoArtiste`.
- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-emails-transactionnels.md`
  summary: Sur un délai dépassé ou une réponse ambiguë du prestataire, le jeton d'invitation est révoqué alors que l'e-mail est peut-être parti.
  evidence: le prestataire peut avoir accepté le message avant l'expiration des 8 s ; l'artiste recevrait alors un lien mort jusqu'à ce que l'équipe relance (la relance envoie un second e-mail). À traiter avec le balayage des échecs (AQ-2).
- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-emails-transactionnels.md`
  summary: Avant la mise en production des e-mails : enregistrement DMARC du domaine, accord de sous-traitance du prestataire et mise à jour de la politique de confidentialité.
  evidence: relevé en relecture ; hors code, à décider avec le porteur (pages de confiance, Epic 7).

- source_spec: `_bmad-output/implementation-artifacts/spec-4-2-demande-de-selection.md`
  summary: L'accusé de demande part à une adresse non vérifiée : un tiers peut recevoir des e-mails du site (3 par heure par adresse).
  evidence: relevé en relecture (abus possible comme relais de courrier, réputation du domaine d'envoi) ; à traiter par une confirmation d'adresse, un anti-robot ou un plafond quotidien, avec le porteur.
- source_spec: `_bmad-output/implementation-artifacts/spec-4-2-demande-de-selection.md`
  summary: Si l'alerte à l'équipe échoue (prestataire, adresse de l'équipe), seul le journal le montre ; aucune file des demandes avant la story 4.6.
  evidence: pas de nouvel essai (AQ-2 ouverte) ; avant le lancement, la file des demandes (4.6) ou une alerte relançable est nécessaire pour tenir la promesse « sous 48 heures ».
- source_spec: `_bmad-output/implementation-artifacts/spec-4-2-demande-de-selection.md`
  summary: Durée de conservation des demandes (e-mail, téléphone, texte libre) et lien vers une politique de confidentialité sur `/conseil` non décidés.
  evidence: décision du porteur et pages de confiance (Epic 7) ; aucun parcours de suppression ou d'export d'une demande n'existe.
- source_spec: `_bmad-output/implementation-artifacts/spec-4-2-demande-de-selection.md`
  summary: Le bouton « Contacter » de l'en-tête est un `<button>` dans un lien (`<a>`), comme « Connexion ».
  evidence: HTML invalide (deux arrêts de tabulation) ; à corriger avec la refonte de l'en-tête, sans lien avec cette story.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-4-conseil-whatsapp.md`
  summary: Ajouter le fuseau (« heure de Londres ») à la ligne hors horaires « Réponse demain à partir de 9 h », ou la convertir dans l'heure du visiteur.
  evidence: un visiteur de la diaspora lit 9 h comme son heure locale ; le texte exact figure dans la partie gelée de la spec (valeur du porteur) ; à décider avec lui.
- source_spec: `_bmad-output/implementation-artifacts/spec-4-4-conseil-whatsapp.md`
  summary: Mentionner dans les pages de confiance (Epic 7) que le Conseil WhatsApp envoie le titre et le lien de l'œuvre à un tiers (WhatsApp).
  evidence: le bouton ouvre une conversation chez un prestataire tiers ; aucune information au visiteur ni durée de conservation décidée.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-6-file-des-demandes.md`
  summary: Ajouter à la file des demandes de l'équipe la section des inscriptions « Me prévenir » par œuvre (nombre et ordre), avec la story 4.5.
  evidence: la story 4.6 la demande, mais la table des inscriptions n'existe pas avant la 4.5 ; le porteur a décidé de la laisser de côté (2026-11-10).

- source_spec: `_bmad-output/implementation-artifacts/spec-4-6-file-des-demandes.md`
  summary: Paginer ou limiter la file des demandes de l'équipe quand le volume grossit (vue « demandes traitées » surtout).
  evidence: `fileDesDemandes` lit toutes les demandes sans limite ; sans effet au volume actuel, mais la vue des demandes traitées ne fait que grandir.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-7-barre-d-actions.md`
  summary: Quand le Lot 2 s'ouvre, n'avoir qu'une action principale sur la fiche (l'achat) et passer le Conseil WhatsApp en secondaire.
  evidence: l'ancien bouton d'ajout au panier (décision « tel quel » du 2026-11-10) est principal à côté du Conseil principal ; à refaire avec l'Epic 7.
- source_spec: `_bmad-output/implementation-artifacts/spec-4-7-barre-d-actions.md`
  summary: Afficher « Réservée » (et non « Vendue ») pour une œuvre réservée, avec les réservations.
  evidence: `fr.fiche.etat` n'a que « disponible » et « vendue » ; la barre distingue déjà `reservee`, mais aucune œuvre ne peut être réservée avant l'Epic 6.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-8-mesure-du-tunnel.md`
  summary: Limiter le débit de `POST /api/mesure` (consentement et événements) pour que les compteurs et les événements ne soient pas gonflables.
  evidence: la route vérifie l'origine mais n'a pas de limite par adresse (les formulaires de demande en ont) ; sans effet sur l'achat, mais fausse les taux.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-9-annonce-ouverture.md`
  summary: Rendre stable l'e-mail d'annonce pour qu'une réponse perdue du prestataire n'entraîne pas un second envoi à la relance.
  evidence: la clé d'idempotence (`ouverture:<contact>:<empreinte du lien>`) change avec chaque lien émis, et l'émission révoque l'ancien ; un lien stable demande un autre schéma de jeton (AD-14). Rare (délai de 8 s du prestataire) ; limite connue dans AGENTS.md.
- source_spec: `_bmad-output/implementation-artifacts/spec-4-9-annonce-ouverture.md`
  summary: Ajouter l'en-tête `List-Unsubscribe` aux e-mails d'annonce (désinscription en un clic des messageries).
  evidence: le port `Courriel` de la story 4.1 n'a pas de champ d'en-têtes ; à ajouter au port et à l'adaptateur.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-5-me-prevenir.md`
  summary: Ne pas perdre les inscriptions « Me prévenir » quand l'artiste annule sa déclaration « vendue ailleurs » ou « retirée » dans le délai d'annulation.
  evidence: `retirerInscriptionsPrevenir` supprime à `DisponibiliteChangee` ; « Annuler » remet `disponible` sans rétablir les inscriptions ; attendre la fin du délai ou limiter à `vendue` (à décider avec le porteur).
- source_spec: `_bmad-output/implementation-artifacts/spec-4-5-me-prevenir.md`
  summary: Double confirmation (double opt-in) de l'adresse « Me prévenir » pour qu'un tiers ne reçoive pas un e-mail qu'il n'a pas demandé.
  evidence: l'inscription est active avant toute confirmation ; limites par IP et par e-mail seulement ; décision de produit à prendre avec les pages de confiance (Epic 7).
- source_spec: `_bmad-output/implementation-artifacts/spec-4-5-me-prevenir.md`
  summary: Relancer la suppression des inscriptions d'une œuvre vendue quand le gestionnaire a échoué.
  evidence: pas de balayage des échecs (AQ-2 ouverte) ; la fonction est idempotente mais rien ne la rejoue.
- source_spec: `_bmad-output/implementation-artifacts/spec-6-1-passage-en-caisse-et-commandes.md`
  summary: Contrôler la disponibilité et verrouiller la ligne des œuvres à la création d'un passage en caisse.
  evidence: `creerPassageEnCaisse` filtre sur `VISIBLE` seulement : une œuvre vendue ou réservée peut entrer dans une commande, et deux passages simultanés réussissent ; la spec 6.1 renvoie cela à la 6.2.
- source_spec: `_bmad-output/implementation-artifacts/spec-6-1-passage-en-caisse-et-commandes.md`
  summary: Tester le nouvel essai sur collision de numéro (`P2002`) à l'écriture.
  evidence: la boucle de nouvel essai de `passage.ts` n'est exercée par aucun test ; course improbable mais non prouvée.
- source_spec: `_bmad-output/implementation-artifacts/spec-6-1-passage-en-caisse-et-commandes.md`
  summary: Confirmer avec le porteur si l'adresse postale de l'acheteur est obligatoire pour une commande à expédier.
  evidence: `adresse` est facultative dans `CoordonneesAcheteur` (la matrice ne l'exige pas) ; à trancher avec le premier écran de la 6.3.
- source_spec: `_bmad-output/implementation-artifacts/spec-6-1-passage-en-caisse-et-commandes.md`
  summary: Gérer la suppression d'un artiste qui a des commandes (réponse 409 au lieu de 500).
  evidence: `DELETE /api/admin/artistes/[id]` ne rattrape pas l'erreur de clé étrangère `Restrict` de `Commande.artistId`.
- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-reservation-en-bloc-sans-double-vente.md`
  summary: Tester la concurrence du plafond de réservations par appareil.
  evidence: seule la concurrence par e-mail est testée ; le verrou consultatif par appareil est le même code, sans consommateur avant la 6.3.
- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-reservation-en-bloc-sans-double-vente.md`
  summary: Convertir une erreur `P2002` de l'index unique partiel des réservations en refus typé.
  evidence: le filet n'est jamais atteint sous le verrou de ligne ; il lèverait l'erreur brute s'il l'était.
- source_spec: `_bmad-output/implementation-artifacts/spec-6-3-vente-assistee-reserver-et-envoyer-le-lien.md`
  summary: Libérer une réservation de vente assistée (issue `liberee`, qui, quand, lien inactif) et afficher la vue des réservations en cours et le journal des terminées.
  evidence: découpage décidé par le porteur le 2026-11-11 (1B) : la 6.3 ne pose que la réservation, l'e-mail et la page de l'acheteur.
- source_spec: `_bmad-output/implementation-artifacts/spec-6-3-vente-assistee-reserver-et-envoyer-le-lien.md`
  summary: Rattacher la commande à la demande de visite ou de sélection d'origine (FR-28), automatiquement quand la réservation est posée depuis la demande ; choisir le propriétaire de la table de rattachement (`demandes` ou colonne de `Reservation`).
  evidence: même découpage ; décision structurante de modèle de données, à poser au porteur avant d'écrire.
- source_spec: `_bmad-output/implementation-artifacts/spec-6-3-vente-assistee-reserver-et-envoyer-le-lien.md`
  summary: Renvoyer le lien quand l'e-mail de la vente assistée n'est pas parti.
  evidence: sans libération (story suivante), une réservation posée dont l'e-mail a échoué ne peut être relancée que par l'équipe hors de l'application.
- source_spec: `_bmad-output/implementation-artifacts/spec-6-3-vente-assistee-reserver-et-envoyer-le-lien.md`
  summary: Basculer les pages d'administration des commandes de `Order` vers `Commande` ; traiter la suppression d'un artiste ayant une commande (clé `Restrict`).
  evidence: décision du porteur du 2026-11-11 (4A) : la lecture des commandes arrive avec le constat de paiement (6.4).
- source_spec: `_bmad-output/implementation-artifacts/spec-6-3-vente-assistee-reserver-et-envoyer-le-lien.md`
  summary: Permettre à l'équipe de révoquer le lien d'une commande déjà envoyé (mauvaise adresse) et retirer de la page de l'acheteur une œuvre libérée ensuite.
  evidence: revue 6.3 : la révocation ne se fait aujourd'hui que sur échec d'envoi ; à traiter avec la libération.
- source_spec: `_bmad-output/implementation-artifacts/spec-6-3-vente-assistee-reserver-et-envoyer-le-lien.md`
  summary: Tester que `/dashboard/admin/commandes` redirige un non-admin.
  evidence: seule l'écriture est testée (`acces_refuse`) ; la visibilité de la page ne l'est pas.
- source_spec: `_bmad-output/implementation-artifacts/spec-6-3-vente-assistee-reserver-et-envoyer-le-lien.md`
  summary: Laisser passer `/commande` (page et échange du lien) pendant la maintenance : modifier `passeLaMaintenance` de `src/lib/reglages` et le middleware, sans lever la maintenance ; première tâche de la story suivante.
  evidence: décision du porteur du 2026-11-11 (« B, dans la story suivante ») : sans cela le lien de l'acheteur mène à la page de maintenance tant que `MAINTENANCE_MODE` est actif.
- source_spec: none
  summary: Rattacher la commande à la demande de visite ou de sélection d'origine (FR-28), automatiquement quand la réservation est posée depuis la demande ; choisir le propriétaire de la table de rattachement.
  evidence: découpage décidé par le porteur le 2026-11-12 : la story suivante ne fait que la maintenance, la libération, la vue des réservations et le renvoi ou la révocation du lien ; le rattachement contient une décision de modèle de données à poser avant d'écrire.
- source_spec: `_bmad-output/implementation-artifacts/spec-6-3b-liberer-voir-et-renvoyer-les-reservations.md`
  summary: Gérer le focus de `ReservationsEquipe` (retour du focus après « Libérer » et « Annuler », après la disparition d'une ligne) et tester le rendu de `/dashboard/admin/commandes`.
  evidence: revue 6.3 bis : le bouton qui avait le focus disparaît, le focus tombe sur `<body>` ; la page n'est couverte que par les tests du module.
- source_spec: none
  summary: E-mails de la confirmation d'une commande (story 6.4) : confirmation à l'acheteur (récapitulatif par commande, délai), « Nouvelle commande » à l'artiste avec l'échéance de prise en charge en heure fixe, alerte « nouvelle commande » à l'équipe, un seul e-mail par événement même rejoué.
  evidence: découpage décidé par le porteur le 2026-11-12 : la story du paiement constaté ne livre que le module paiement, la confirmation atomique et idempotente et l'écran de l'équipe ; les e-mails s'abonnent ensuite à l'événement de confirmation.
- source_spec: `_bmad-output/implementation-artifacts/spec-6-4-paiement-constate-et-confirmation.md`
  summary: Enrichir les incidents (œuvres et références concernées, numéros de commande, lien vers le passage), paginer la liste, gérer le focus clavier du formulaire de constat et tester le rendu de la page.
  evidence: revue 6.4 : l'incident ne retient que cause, montants et date ; la liste est limitée à 100 sans pagination ; à traiter avec la vue des incidents de la 6.5.
