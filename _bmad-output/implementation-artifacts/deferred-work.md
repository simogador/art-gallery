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
