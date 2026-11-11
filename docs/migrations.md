# Migrations de la base (Prisma)

Règles (AD-20, story 1.4) :

- L'historique `prisma/migrations/` doit correspondre exactement à `prisma/schema.prisma`. La CI le vérifie à chaque PR : elle applique toutes les migrations sur une base PostgreSQL vide, puis `prisma migrate diff --exit-code` doit répondre « No difference detected ».
- Toute évolution du schéma passe par une nouvelle migration, commitée avec le changement de `schema.prisma`. Créez-la avec `npx prisma migrate dev --create-only --name <nom>` contre un **PostgreSQL local** : Prisma y crée une base fantôme temporaire, ce qu'un rôle Neon ne peut pas toujours faire.
- `prisma migrate deploy` sur la base de production ne s'exécute **qu'à un seul endroit : une commande lancée par le porteur** (ci-dessous). Jamais dans le build Vercel (`npm run build` ne lance que `next build`), jamais depuis une préversion, jamais depuis la CI.
- `prisma db push` est proscrit sur toute base partagée (production, branche `preview`). Sur votre propre base, utilisez `npm run db:migrate`.
- Les commandes `migrate deploy`, `migrate status` et `migrate resolve` utilisent la chaîne de connexion **directe** de Neon (hôte `ep-…` **sans** `-pooler`, onglet « Connection string », option « Connection pooling » désactivée) : à travers le pooler, le verrou de migration échoue.

## Base locale créée avant cette story

Si votre base a été créée par l'ancien `npm run db:push`, `npm run db:migrate` échoue (erreur P3005 : base non vide sans historique). Recréez-la (nouvelle branche Neon à vous, ou `DROP DATABASE` / `CREATE DATABASE` en local), puis `npm run db:migrate` et `npm run db:seed`.

## Marquer la migration de ligne de base comme appliquée (une seule fois par base partagée)

La migration `20261027150000_ligne_de_base` crée `Order`, `Artist.userId` et `Artist.active`, qui existent déjà en production sans avoir été enregistrés dans l'historique. Il ne faut **pas** l'exécuter en production : il faut seulement l'y déclarer comme appliquée.

À faire sur la **production**, puis sur la branche Neon **`preview`** si elle a été créée avant cette déclaration (une branche créée après hérite de l'historique). Depuis votre poste, dans un terminal où `DATABASE_URL` vaut la chaîne de connexion **directe** de la base concernée (ne la collez dans aucun fichier commité) :

1. **Point de restauration** : dans Neon, créez une branche `avant-ligne-de-base` à partir de `main`.
2. **Contrôle en lecture seule** : `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`
   - « No difference detected » : la production correspond au schéma, continuez.
   - Sinon : arrêtez-vous et transmettez la liste des différences (sans l'URL) ; la ligne de base devra être adaptée.
3. **État de l'historique** : `npx prisma migrate status`
   - Attendu : `20260519111355_init` et `20260519141423_add_auth_models` appliquées, `20261027150000_ligne_de_base` en attente.
   - Si la table `_prisma_migrations` n'existe pas (base créée par `db push`), les trois migrations apparaissent en attente : déclarez-les toutes à l'étape 4, dans l'ordre.
4. **Déclaration** :
   - cas attendu : `npx prisma migrate resolve --applied 20261027150000_ligne_de_base` ;
   - sans `_prisma_migrations` : `npx prisma migrate resolve --applied 20260519111355_init`, puis `… 20260519141423_add_auth_models`, puis `… 20261027150000_ligne_de_base`.
5. **Vérification** : `npx prisma migrate status` doit répondre « Database schema is up to date ».

Cette déclaration n'écrit qu'une ligne par migration dans `_prisma_migrations` et ne modifie aucune table métier. Retour arrière, dans l'éditeur SQL de Neon : `DELETE FROM "_prisma_migrations" WHERE migration_name = '20261027150000_ligne_de_base';`. Ne restaurez pas la branche `avant-ligne-de-base` sur la production : vous perdriez toutes les écritures faites depuis (commandes, comptes).

## Appliquer une future migration en production

1. **Préversion d'abord** : avant de vérifier la préversion de la PR, lancez `npx prisma migrate deploy` avec la chaîne directe de la branche `preview` (le build Vercel ne migre jamais).
2. Après la fusion : point de restauration Neon (branche datée à partir de `main`).
3. `npx prisma migrate deploy` avec la chaîne directe de la production, depuis votre poste.
4. `npx prisma migrate status` : « Database schema is up to date ».

## Migrations de données (AQ-4, décision du 2026-10-29)

Une migration de données (recopie de valeurs, AD-20) se fait en quatre temps : ajouter les colonnes, recopier, basculer les lectures, puis supprimer l'ancien après la période de vérification (story 2.10). Plan gratuit de Neon : la sauvegarde est une branche, la répétition se fait sur `preview`. L'agent ne l'applique jamais ; la PR consigne la répétition.

1. **Branche de sauvegarde datée** : dans Neon, créez à partir de `main` une branche `avant-<sujet>-<JJ-MM>` (ex. `avant-prix-dimensions-29-10`) et notez sa date d'expiration.
2. **Empreinte de la migration** : sur votre poste, `sha256sum prisma/migrations/<nom>/migration.sql` (sous Windows : `certutil -hashfile <fichier> SHA256`). C'est la valeur que Prisma enregistre dans `_prisma_migrations.checksum` : avec la même empreinte, `prisma migrate status` reconnaît la migration comme appliquée.
3. **Répétition sur `preview` d'abord**, dans l'éditeur SQL de Neon (branche `preview`), en une transaction :
   ```sql
   BEGIN;
   -- contenu exact de prisma/migrations/<nom>/migration.sql
   INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
   VALUES (gen_random_uuid()::text, '<empreinte SHA-256>', '<nom>', now(), now(), 1);
   COMMIT;
   ```
   puis le script de recopie (`scripts/sql/…`, idempotent, il porte son propre `BEGIN`/`COMMIT`), puis les requêtes de contrôle en lecture seule.
4. **Vérification de la préversion** : la préversion de la PR fonctionne ; puis **retour arrière** : redéployez dans Vercel la préversion du commit précédent (sur la même branche `preview`) et vérifiez qu'elle fonctionne aussi, l'ancien code ignorant les colonnes ajoutées. Consignez les deux dans la PR.
5. **Production, avant la fusion** : le nouveau code lit les nouvelles colonnes et échouerait sans elles, alors que l'ancien code fonctionne avec. Nouvelle branche de sauvegarde datée si la première est trop ancienne, puis les mêmes SQL qu'à l'étape 3 (mêmes fichiers, même empreinte), puis les contrôles ; fusionnez ensuite.
6. `npx prisma migrate status` (chaîne directe) : « Database schema is up to date ».
7. **Juste après la fusion** (déploiement de production terminé) : relancez la requête d'écarts de la migration (story 2.1 : `scripts/sql/ecarts-prix-dimensions.sql` ; story 2.2 : `scripts/sql/ecarts-publication-disponibilite.sql`, voir sa section). Entre l'étape 5 et la fusion, l'ancien code a pu modifier un prix ou des dimensions sans les nouvelles colonnes, et la recopie n'écrase jamais : ces œuvres garderaient une valeur périmée (le paiement facturerait l'ancien prix). Si la requête liste des œuvres, les anciennes colonnes font foi : dans l'éditeur SQL de Neon, en une transaction, videz leurs nouvelles colonnes puis relancez la recopie, et vérifiez que la requête ne liste plus rien :
   ```sql
   BEGIN;
   UPDATE "Artwork"
   SET "prixCentimes" = NULL, "hauteurMm" = NULL, "largeurMm" = NULL, "profondeurMm" = NULL
   WHERE "slug" IN ('<slug listé>', '<slug listé>');
   COMMIT;
   -- puis scripts/sql/recopie-prix-dimensions.sql, puis de nouveau la requête d'écarts
   ```
   Les œuvres que la recopie laisse vides apparaissent alors dans les requêtes de contrôle (dimensions illisibles, prix non recopiés), à compléter à la main.

Retour arrière : le code précédent fonctionne sur la base migrée (colonnes ajoutées facultatives). Ne restaurez la branche de sauvegarde qu'en dernier recours : vous perdriez les écritures faites depuis. Si l'ancien code a tourné un moment après la migration, il a modifié `price` ou `dimensions` sans les nouvelles colonnes : traitez les œuvres listées par la requête d'écarts comme à l'étape 7.

### Story 2.1 : prix et dimensions exacts

> Historique : les colonnes `price` et `dimensions` ont été supprimées par la story 2.10 (2026-11-05) ; les scripts cités ci-dessous ont été retirés du dépôt (voir l'historique git).

- Migration : `20261029084432_prix_dimensions_exacts` (ajoute `prixCentimes`, `devise`, `hauteurMm`, `largeurMm`, `profondeurMm` à `Artwork`, toutes facultatives ou avec valeur par défaut).
- Recopie : `scripts/sql/recopie-prix-dimensions.sql`. Prix en euros → centimes ; dimensions « hauteur × largeur (× profondeur) cm|mm » → millimètres. Rien n'est deviné.
- Écarts après la fusion (étape 7) : `scripts/sql/ecarts-prix-dimensions.sql`, en lecture seule.
- Contrôles : `scripts/sql/dimensions-illisibles.sql` (œuvres à compléter depuis le formulaire d'édition ; depuis la story 2.10, le formulaire ne préremplit plus l'ancien texte, que seule cette requête affiche) et `scripts/sql/prix-non-recopies.sql` (prix nul, négatif, à plus de deux décimales ou au-delà de 21 474 836,47 €, limite d'une colonne `INTEGER`).

### Story 2.2 : publication et disponibilité

> Historique : la colonne `available` a été supprimée par la story 2.10 (2026-11-05) ; les scripts de recopie, d'écarts et de correction cités ci-dessous ont été retirés du dépôt (voir l'historique git). `vendues-sans-commande.sql` reste (il ne lit que les nouvelles colonnes).

- Migration : `20261030090000_publication_disponibilite` (énumérations `Publication` et `Disponibilite`, colonnes facultatives `publication` et `disponibilite` de `Artwork`, sans valeur par défaut, index sur les deux).
- Recopie : `scripts/sql/recopie-publication-disponibilite.sql`. `available = true` → `publiee` + `disponible` ; `false` → `publiee` + `vendue`. Ne remplit que des colonnes vides ; `available` n'est pas modifiée.
- Double écriture : le nouveau code tient `available` égale à « disponible » (publiée et disponible). Une œuvre créée par un artiste naît `brouillon` + `disponible`, donc avec `available = false` : en cas de retour au commit précédent, elle apparaît comme vendue, jamais achetable.
- Contrôle après la recopie : `scripts/sql/vendues-sans-commande.sql`, en lecture seule. La recopie traduit tout `available = false` en `vendue`, alors que l'ancienne bascule a pu servir à masquer une œuvre non vendue : la requête liste les œuvres publiées et vendues qu'aucune commande ne contient. Revoyez-les une à une depuis l'administration (dépublier, ou repasser en disponible).
- Écarts après la fusion (étape 7), et après tout retour arrière : `scripts/sql/ecarts-publication-disponibilite.sql`, en lecture seule. Elle liste les œuvres dont une colonne est vide (créées par l'ancien code) ou dont `available` diffère de « disponible » (bascule de l'administration ou paiement passés par l'ancien code).
- Correction ciblée : `scripts/sql/corriger-ecarts-publication-disponibilite.sql`, depuis l'éditeur SQL de Neon (il porte son propre `BEGIN`/`COMMIT`, idempotent), puis de nouveau la requête d'écarts. Il ne corrige que ce qui est en désaccord : axe vide rempli d'après `available` (publication `publiee`, disponibilité `disponible` ou `vendue`) ; œuvre publiée, `disponible` ou `vendue`, en désaccord avec `available` : disponibilité d'après `available`. Il ne touche jamais un brouillon, une œuvre en curation, réservée, vendue ailleurs ou retirée : ce qui reste listé ensuite (par ex. un brouillon que l'ancien code a remis à `available = true`) se traite à la main depuis l'administration. Ne videz jamais les deux colonnes pour relancer la recopie : ces états seraient perdus.

### Story 2.3 : zones de livraison

- Migration : `20261031004437_zones_livraison` (tables `Zone`, `ZonePays`, `OffreLivraison`). Ajout de tables seulement, aucune recopie : ce n'est pas une migration de données, mais le nouveau code lit `Zone` (administration, dépôt) et échouerait sans elle. Elle s'applique donc comme les précédentes : branche de sauvegarde datée, `preview`, puis production **avant la fusion**, avec sa ligne `_prisma_migrations` et son empreinte SHA-256.
- Zones de départ (OQ-5, décision du 2026-10-31) : `scripts/sql/zones-depart.sql`, à lancer après la migration, sur `preview` puis en production. Il n'agit que si aucune zone n'existe : relancé (ou après des zones créées dans l'administration), il ne fait rien et l'indique, sans jamais défaire une modification faite depuis l'écran. Sa dernière requête (lecture seule) compte les pays par zone : Maroc 1, Union européenne 27, Europe hors UE 23, Amérique du Nord 2, Reste du monde 195 ; Russie et Biélorussie sans zone.
- Ensuite, les zones se modifient depuis `/dashboard/admin/zones`, jamais en SQL.
- Retour arrière : l'ancien code ignore les trois tables. Pour les retirer (dernier recours, tant qu'aucune offre n'existe) : `DROP TABLE "OffreLivraison", "ZonePays", "Zone";` puis `DELETE FROM "_prisma_migrations" WHERE migration_name = '20261031004437_zones_livraison';`.

### Story 2.4 : invitation des artistes

- Migration : `20261102013809_invitations_artistes` (énumération `UsageJeton`, tables `Jeton` et `Invitation`). Ajout de tables seulement ; le nouveau code les lit (administration des artistes, `/auth/invitation`) et échouerait sans elles : même procédure que les précédentes, `preview` puis production **avant la fusion**, avec la ligne `_prisma_migrations` et l'empreinte SHA-256.
- Retour arrière : l'ancien code ignore les deux tables. Pour les retirer (dernier recours) : `DROP TABLE "Invitation", "Jeton"; DROP TYPE "UsageJeton";` puis `DELETE FROM "_prisma_migrations" WHERE migration_name = '20261102013809_invitations_artistes';`. Les comptes artistes déjà créés restent (table `User`).
- Fiche artiste du porteur : `scripts/sql/fiche-artiste-porteur.sql` (valeurs à compléter), puis invitation depuis l'écran.

### Story 2.5 : dépôt d'une œuvre

- Migration : `20261102212219_depot_oeuvre` (colonnes facultatives `ambiance` et `couleurDominante` de `Artwork`, énumération `TypePhoto`, table `PhotoOeuvre` avec une photo au plus par œuvre et par case, `CASCADE` à la suppression de l'œuvre). Ajout seulement, aucune recopie ; le nouveau code lit `PhotoOeuvre` (formulaire de dépôt) et échouerait sans elle : même procédure que les précédentes, `preview` puis production **avant la fusion**, avec la ligne `_prisma_migrations` et l'empreinte SHA-256.
- Cloudinary : le formulaire envoie les photos directement à Cloudinary avec une signature du serveur ; il lui faut `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` et `CLOUDINARY_API_SECRET` dans Vercel (Preview et Production). Sans elles, l'envoi de photos affiche « momentanément indisponible », le reste du formulaire fonctionne. Réglage du 2026-11-03 : compte `djiu4tirq` (plan gratuit, images de 10 Mo au plus), clé dédiée `errancy-vercel` (les clés de mai étaient désactivées) ; `CLOUDINARY_API_KEY` et `CLOUDINARY_API_SECRET` en Production et Preview, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` en deux variables (secret en Production, configuration en Preview).
- Retour arrière : l'ancien code ignore la table et les deux colonnes ; les brouillons créés par le nouveau formulaire apparaissent dans « Mes œuvres » (année 0 tant qu'elle n'est pas saisie), jamais en galerie. Pour retirer la migration (dernier recours) : `DROP TABLE "PhotoOeuvre"; DROP TYPE "TypePhoto"; ALTER TABLE "Artwork" DROP COLUMN "ambiance", DROP COLUMN "couleurDominante";` puis `DELETE FROM "_prisma_migrations" WHERE migration_name = '20261102212219_depot_oeuvre';`.

### Story 2.6 : expédition, engagements et envoi en curation

- Migration : `20261103100532_expedition_engagements`. Sur `Artwork` : `visitesAtelier` (facultative), `engagementCertificat`, `engagementEmballage`, `engagementReprise` (booléens à `false` par défaut) et `envoyeeEnCurationLe` (facultative). Sur `OffreLivraison` : `livree` (vrai par défaut), frais et délais devenus facultatifs (vides pour une zone non livrée), et six contraintes `CHECK` écrites à la main (frais et délais positifs, transport min ≤ max, devise sur trois lettres, quatre valeurs présentes si la zone est livrée, toutes vides sinon). Prisma ne décrit pas les `CHECK` : `prisma migrate diff` (job « Migrations ») les ignore et répond « No difference detected ».
- Ajout seulement, aucune recopie (la table des offres est vide avant cette story) ; le nouveau code lit les nouvelles colonnes (formulaire de dépôt) et échouerait sans elles : même procédure que les précédentes, `preview` puis production **avant la fusion**, avec la ligne `_prisma_migrations` et l'empreinte SHA-256.
- Retour arrière : l'ancien code ignore les colonnes ajoutées. Une œuvre déjà envoyée (`en_curation`) s'ouvre alors dans l'ancienne page d'édition, et une offre non livrée (frais vides) n'est lue par aucun ancien écran. Pour retirer la migration (dernier recours, après avoir supprimé les offres non livrées : `DELETE FROM "OffreLivraison" WHERE NOT "livree";`) :
  ```sql
  ALTER TABLE "OffreLivraison"
    DROP CONSTRAINT "OffreLivraison_frais_positifs", DROP CONSTRAINT "OffreLivraison_delais_positifs",
    DROP CONSTRAINT "OffreLivraison_transport_ordonne", DROP CONSTRAINT "OffreLivraison_devise_iso",
    DROP CONSTRAINT "OffreLivraison_livree_complete", DROP CONSTRAINT "OffreLivraison_non_livree_vide",
    DROP COLUMN "livree",
    ALTER COLUMN "fraisCentimes" SET NOT NULL, ALTER COLUMN "preparationJours" SET NOT NULL,
    ALTER COLUMN "transportMinJours" SET NOT NULL, ALTER COLUMN "transportMaxJours" SET NOT NULL;
  ALTER TABLE "Artwork" DROP COLUMN "visitesAtelier", DROP COLUMN "engagementCertificat",
    DROP COLUMN "engagementEmballage", DROP COLUMN "engagementReprise", DROP COLUMN "envoyeeEnCurationLe";
  DELETE FROM "_prisma_migrations" WHERE migration_name = '20261103100532_expedition_engagements';
  ```

### Story 2.7 : curation par l'équipe

- Migration : `20261104060111_curation`. Sur `Artist` : `accordSigneLe` (`DATE` facultative, date de signature de l'accord écrit, FR-16). Nouvelle énumération `TypeDecisionCuration` (`valider`, `renvoyer`) et table `DecisionCuration` (œuvre en `CASCADE`, décision, commentaire facultatif, codes cochés de la liste de contrôle `controle` — `TEXT[]` non nul, vide par défaut —, `adminId` facultatif sans clé étrangère, date ; index `(artworkId, createdAt)`). Contrainte `CHECK` écrite à la main, `DecisionCuration_renvoi_commente` : un renvoi porte un commentaire de 10 à 1 000 caractères ; `prisma migrate diff` l'ignore (« No difference detected »).
- Ajout seulement, aucune recopie : tous les artistes commencent « Accord non signé », donc aucune œuvre en curation ne peut être validée avant que l'équipe enregistre la date de signature sur `/dashboard/admin/artistes`. Le nouveau code lit la colonne et la table (file de curation, fiche de dépôt) et échouerait sans elles : même procédure que les précédentes, `preview` puis production **avant la fusion**, avec la ligne `_prisma_migrations` et l'empreinte SHA-256.
- Retour arrière : l'ancien code ignore la colonne et la table. Une œuvre renvoyée (`brouillon`) s'ouvre alors dans le formulaire de dépôt sans le bandeau du commentaire ; une œuvre validée reste publiée ; une œuvre en curation peut de nouveau être publiée par l'ancienne bascule. Pour retirer la migration (dernier recours, les décisions sont perdues) :
  ```sql
  DROP TABLE "DecisionCuration"; -- emporte la contrainte CHECK
  DROP TYPE "TypeDecisionCuration";
  ALTER TABLE "Artist" DROP COLUMN "accordSigneLe";
  DELETE FROM "_prisma_migrations" WHERE migration_name = '20261104060111_curation';
  ```

### Story 2.8 : disponibilité tenue par l'artiste

- Migration : `20261104064428_declarations_disponibilite` (empreinte SHA-256 : `def27bf932044d0bb35ff828f7d822939efec5d0e2307907d61b57d1b47ddf61`). Nouvelle énumération `TypeDeclarationDisponibilite` (`vendue_ailleurs`, `retiree`) et table `DeclarationDisponibilite` (œuvre en `CASCADE`, type, `userId` de l'artiste sans clé étrangère, `reservationInterrompue` faux par défaut, `annuleeLe` facultative, date ; index `(artworkId, createdAt)`).
- Ajout seulement, aucune recopie. Le nouveau code lit la table (« Mes œuvres », fiche de l'œuvre de l'artiste) et échouerait sans elle : même procédure que les précédentes, `preview` puis production **avant la fusion**, avec la ligne `_prisma_migrations` et l'empreinte SHA-256.
- Retour arrière : l'ancien code ignore la table. Une œuvre vendue ailleurs reste affichée « Vendue » et non achetable (`available` fausse) ; une œuvre retirée redirige toujours vers son artiste ; l'artiste ne peut plus annuler ni remettre en vente, et la bascule de l'administration refuse ces deux états : pour remettre une œuvre en vente, seule voie, l'éditeur SQL de Neon, en une transaction : `UPDATE "Artwork" SET "disponibilite" = 'disponible', "available" = ("publication" = 'publiee') WHERE "slug" = '<slug>' AND "disponibilite" IN ('vendue_ailleurs', 'retiree');`. Pour retirer la migration (dernier recours, les déclarations sont perdues) :
  ```sql
  DROP TABLE "DeclarationDisponibilite";
  DROP TYPE "TypeDeclarationDisponibilite";
  DELETE FROM "_prisma_migrations" WHERE migration_name = '20261104064428_declarations_disponibilite';
  ```

### Story 2.10 : suppression des anciennes colonnes

Quatrième temps de AD-20 pour les stories 2.1 et 2.2 : `Artwork.available`, `Artwork.price` et `Artwork.dimensions` ne sont plus ni lues ni écrites par le code, puis disparaissent. Décisions du porteur du 2026-11-04 (`docs/decisions-porteur.md`). **Ordre inversé** par rapport aux migrations précédentes : deux migrations, la première avant la fusion, la seconde **après** le déploiement de production.

- **A** — `20261104202353_dimensions_par_defaut` (empreinte SHA-256 : `6a0d6963b84f29f5df54450034c89fb3090d1c6eb97afe12eddaffcd8e1aaf6f`). `dimensions` reçoit la valeur par défaut `''` et reste `NOT NULL`. Sans effet sur l'ancien code, qui l'écrit toujours et lit `''` (texte vide, comme une œuvre sans dimensions) pour les œuvres créées par le nouveau code ; le nouveau code crée une œuvre sans elle et échouerait sans A (colonne `NOT NULL` sans valeur par défaut). `price` (facultative) et `available` (valeur par défaut `true`) n'en ont pas besoin.
  ```sql
  BEGIN;
  -- AlterTable
  ALTER TABLE "Artwork" ALTER COLUMN "dimensions" SET DEFAULT '';
  INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
  VALUES (gen_random_uuid()::text, '6a0d6963b84f29f5df54450034c89fb3090d1c6eb97afe12eddaffcd8e1aaf6f',
          '20261104202353_dimensions_par_defaut', now(), now(), 1);
  COMMIT;
  ```
- **B** — `20261104202403_suppression_anciennes_colonnes` (empreinte SHA-256 : `ecf964b04377f1adbb01b83db980d5c948763d27f0fe0ec2528e5e748faa66a4`). Supprime les trois colonnes et leurs valeurs. **Irréversible** : au-delà, seul le retour à la branche de sauvegarde ramène les colonnes et leurs valeurs.
  ```sql
  BEGIN;
  -- AlterTable
  ALTER TABLE "Artwork" DROP COLUMN "available",
  DROP COLUMN "dimensions",
  DROP COLUMN "price";
  INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
  VALUES (gen_random_uuid()::text, 'ecf964b04377f1adbb01b83db980d5c948763d27f0fe0ec2528e5e748faa66a4',
          '20261104202403_suppression_anciennes_colonnes', now(), now(), 1);
  COMMIT;
  ```
  L'empreinte porte sur le fichier `migration.sql` entier, avertissements de Prisma en commentaire compris : vérifiez-la avec `sha256sum` (étape 2 ci-dessus) avant de l'enregistrer.

Procédure :

1. **`preview`, avant la fusion** : branche de sauvegarde datée de `preview` si besoin, puis A (ci-dessus) depuis l'éditeur SQL de Neon. Vérifiez la préversion de la PR (dépôt d'une œuvre par le compte artiste de test Kara Walker, édition, curation, bascules de l'administration), puis le **retour arrière** : redéployez la préversion du commit précédent sur la même base, elle fonctionne (l'ancien code écrit encore les trois colonnes, et lit `''` pour l'œuvre déposée par le nouveau code). Consignez les deux dans la PR.
2. **Production, avant la fusion** : branche de sauvegarde datée `avant-anciennes-colonnes-<JJ-MM>` à partir de `main`, puis A. Fusionnez ensuite et **notez l'heure de fin du déploiement de production** : c'est la référence de l'étape 3.
3. **Après le déploiement de production** (le code en ligne ne lit plus les colonnes), contrôles en **lecture seule** depuis l'éditeur SQL de Neon :
   - `scripts/sql/dimensions-illisibles.sql` : œuvres sans hauteur ou sans largeur en millimètres. Décision du porteur : si elle liste des œuvres d'artistes **avec accord signé**, l'équipe complète leurs millimètres à la main avant B, depuis `/dashboard/admin/oeuvres/<slug>` (le formulaire ne préremplit plus l'ancien texte : il s'affiche dans la colonne `dimensions` de la requête) ; la perte du texte est acceptée pour les œuvres de démonstration. Les brouillons du formulaire de dépôt sans dimensions y apparaissent aussi, avec un texte vide : rien à reprendre. Pour ne voir que les œuvres d'artistes avec accord :
     ```sql
     SELECT a."slug", a."title", a."dimensions", a."publication"::text AS publication
     FROM "Artwork" AS a JOIN "Artist" AS r ON r."id" = a."artistId"
     WHERE (a."hauteurMm" IS NULL OR a."largeurMm" IS NULL)
       AND r."accordSigneLe" IS NOT NULL
       AND btrim(a."dimensions") <> ''
     ORDER BY a."slug";
     ```
   - `scripts/sql/prix-non-recopies.sql` : prix de l'ancienne colonne jamais recopiés en centimes. Une œuvre listée d'un artiste avec accord : saisissez son prix depuis l'administration avant B.
   - `scripts/sql/ecarts-prix-dimensions.sql` et `scripts/sql/ecarts-publication-disponibilite.sql` : œuvres dont anciennes et nouvelles colonnes divergent. Le code précédent (stories 2.1 à 2.9) écrivait les deux, cohérentes ; le nouveau code n'écrit plus que les nouvelles, qui font foi. Une œuvre listée modifiée **depuis le déploiement de production** (heure notée à l'étape 2 : prix ou dimensions changés, bascule, paiement, brouillon créé) est donc attendue : rien à corriger. **Ne lancez ni les recopies ni `corriger-ecarts-publication-disponibilite.sql`, ni la correction de l'étape 7** : ils remettraient les anciennes valeurs par-dessus les nouvelles. Une œuvre listée qui n'a pas été modifiée depuis ce déploiement est inattendue : examinez-la à la main avant B et reportez la bonne valeur depuis l'administration. `updatedAt` n'est qu'un indice (il change à toute écriture, pas seulement du prix ou de l'état) : en cas de doute, comparez avec la branche de sauvegarde de l'étape 2.
4. **Juste avant B** : nouvelle branche de sauvegarde datée à partir de `main`, et vérification qu'elle est restaurable (AQ-4) : ouvrez-la dans Neon et lancez `SELECT count(*), count("price"), count(NULLIF(btrim("dimensions"), '')) FROM "Artwork";`, les valeurs doivent être celles de `main`. Notez sa date d'expiration.
5. **B** (ci-dessus) sur la production depuis l'éditeur SQL de Neon, puis sur `preview`. Sur `preview`, B casse les préversions des PR ouvertes qui ne contiennent pas cette story (leur client Prisma lit encore les colonnes) : rebasez-les sur `main`.
6. `npx prisma migrate status` (chaîne directe) : « Database schema is up to date » ; accueil, galerie et espace artiste sans erreur.

Retour arrière :

- **Avant B** : redéployez le commit précédent dans Vercel ; il fonctionne sur la base après A. Les œuvres créées entre-temps par le nouveau code ont `dimensions` vide (valeur par défaut `''`), `price` nul et `available` vraie (valeur par défaut, que l'ancien code ne lit plus depuis la story 2.2) : l'ancien formulaire d'édition affiche des dimensions vides. Une œuvre **modifiée** par le nouveau code garde dans les anciennes colonnes ses anciens prix et dimensions, plus tenus à jour : l'ancien formulaire d'édition préremplit les colonnes exactes, mais se rabat sur les anciennes quand elles sont vides, et montre donc l'ancien prix ou l'ancien texte d'une œuvre dont le nouveau code a effacé le prix ou les dimensions ; l'enregistrer réécrirait cette ancienne valeur. Relancez les deux requêtes d'écarts (étape 7) et corrigez ces œuvres à la main depuis l'administration ; les colonnes exactes font foi. Retirer A n'est pas nécessaire ; si vous y tenez (sans risque, l'ancien code écrit toujours la colonne) : `ALTER TABLE "Artwork" ALTER COLUMN "dimensions" DROP DEFAULT;` puis `DELETE FROM "_prisma_migrations" WHERE migration_name = '20261104202353_dimensions_par_defaut';`.
- **Après B** : ne redéployez **jamais** un commit antérieur à cette story, ni par un redéploiement ni par l'« Instant Rollback » de Vercel : son client Prisma lit les colonnes supprimées et chaque page du catalogue serait en erreur. Seul recours : restaurer la branche de sauvegarde de l'étape 4, en perdant toutes les écritures faites depuis.
- Les scripts SQL de recopie, d'écarts et de correction des stories 2.1 et 2.2 ont été supprimés du dépôt après B (PR de suivi du 2026-11-05) ; ils restent dans l'historique git.

## Journal des bases partagées

- 2026-10-28 : sur `production` puis sur la branche `preview`, la ligne de base `20261027150000_ligne_de_base` a été déclarée (sans exécution) et `20261027230000_inscriptions_ouverture` appliquée, en une transaction depuis l'éditeur SQL de Neon (SQL de la migration et empreintes SHA-256 identiques à celles de Prisma). Point de restauration : branche `avant-migrations-28-10` (expire le 2026-11-04).
- 2026-10-29 : sur `preview` puis sur `production`, migration `20261029084432_prix_dimensions_exacts` appliquée (avec son empreinte SHA-256) et `scripts/sql/recopie-prix-dimensions.sql` lancée depuis l'éditeur SQL de Neon : 8 prix et 7 dimensions recopiés ; seule « A Subtlety » (« 11 × 7.9 × 23 m », démonstration) reste illisible. Retour arrière vérifié sur `preview` (ancien code fonctionnel). Point de restauration : branche `avant-prix-dimensions-29-10` (expire le 2026-11-05).
- 2026-10-30 : sur `preview` puis sur `production`, migration `20261030090000_publication_disponibilite` appliquée (avec son empreinte SHA-256) et recopie lancée depuis l'éditeur SQL de Neon : les 8 œuvres passent en `publiee` + `disponible` (`available` vrai partout), aucune œuvre vendue sans commande. Sur `preview`, brouillon (404), retrait (redirection vers l'artiste) et retour arrière vérifiés, puis état remis. Point de restauration : branche `avant-publication-30-10` (expire le 2026-11-06).
- 2026-10-31 (`preview`) puis 2026-11-01 (`production`) : migration `20261031004437_zones_livraison` appliquée (avec son empreinte SHA-256) puis `scripts/sql/zones-depart.sql` lancé depuis l'éditeur SQL de Neon : Maroc 1, Union européenne 27, Europe hors UE 23, Amérique du Nord 2, Reste du monde 195 ; Russie et Biélorussie sans zone. Sur `preview`, écran des zones vérifié (liste, pays grisés, enregistrement) avec un compte de test « Admin préversion » créé sur `preview` seulement (le compte admin du porteur se connecte par Google, inutilisable sur les préversions tant que l'adresse d'authentification y vise la production) ; retour arrière vérifié en local (code du commit précédent sur une base migrée et remplie : galerie, fiche, administration). Point de restauration : branche `avant-zones-31-10`.
- 2026-11-02 : migration `20261102013809_invitations_artistes` (avec son empreinte SHA-256) appliquée depuis l'éditeur SQL de Neon, d'abord sur `production` puis sur `preview`. La PR #25 a été fusionnée avant l'application : pendant quelques minutes, `/dashboard/admin/artistes` et `/auth/invitation` étaient en erreur en production (site public en maintenance, sans effet visible) ; la migration a été appliquée aussitôt, puis la page des artistes vérifiée. Sur `preview`, invitation testée de bout en bout (artiste de démonstration Kara Walker, compte de test). Point de restauration : branche `avant-invitations-02-11` (expire le 2026-11-03).
- 2026-11-03 : migration `20261102212219_depot_oeuvre` (avec son empreinte SHA-256) appliquée depuis l'éditeur SQL de Neon, d'abord sur `preview` puis sur `production`, avant la fusion de la PR #27. Sur `preview`, dépôt testé de bout en bout avec le compte artiste de test (Kara Walker, mot de passe de test redéfini sur `preview` seulement) : brouillon créé au premier champ, photo envoyée à Cloudinary, valeurs retrouvées après rechargement. Cloudinary : clé dédiée `errancy-vercel` (compte `djiu4tirq`), variables en Production et Preview. Point de restauration : branche `avant-depot-03-11` (expire le 2026-11-04).
- 2026-11-03 : migration `20261103100532_expedition_engagements` (avec son empreinte SHA-256, contraintes `CHECK` comprises) appliquée depuis l'éditeur SQL de Neon sur `preview`, puis sur `production`. La PR #29 a été fusionnée avant l'application en production : la migration a été appliquée aussitôt après (site public en maintenance). Le test de bout en bout sur la préversion (zones, engagements, envoi en curation) reste à faire. Point de restauration : branche `avant-expedition-03-11` (expire le 2026-11-04).
- 2026-11-04 : migration `20261104060111_curation` (avec son empreinte SHA-256, contrainte `CHECK` comprise) appliquée depuis l'éditeur SQL de Neon sur `production`, puis sur `preview`. La PR #32 a été fusionnée avant l'application : la migration a été appliquée en production aussitôt après (site public en maintenance ; administration des œuvres et des artistes en erreur quelques minutes). Le test de bout en bout sur la préversion (accord, validation, renvoi, bandeau) reste à faire.
- 2026-11-04 : migration `20261104064428_declarations_disponibilite` (avec son empreinte SHA-256) appliquée depuis l'éditeur SQL de Neon sur `preview`, puis sur `production`, avant la fusion de la PR #34. Point de restauration : branche `avant-declarations-04-11`.
- 2026-11-04 et 2026-11-05 (story 2.10) : migration A `20261104202353_dimensions_par_defaut` (avec son empreinte SHA-256) appliquée depuis l'éditeur SQL de Neon sur `preview` puis sur `production`, avant la fusion de la PR #36 (2026-11-04, déploiement de production terminé vers 21 h 35 UTC). Sur `preview`, dépôt « Test 2.10 » par Kara Walker et retour arrière (commit `89515a0`) vérifiés. Points de restauration : branches `avant-anciennes-colonnes-preview-04-11` et `avant-anciennes-colonnes-04-11`. Le 2026-11-05, contrôles en lecture seule sur `production` tous vides (dimensions à compléter, prix à saisir, écarts d'état, œuvres modifiées depuis la mise en ligne), nouvelle sauvegarde `avant-suppression-colonnes-05-11` vérifiée identique à `production` (nombre d'œuvres, prix et dimensions en texte), puis migration B `20261104202403_suppression_anciennes_colonnes` (avec son empreinte SHA-256) appliquée sur `production` (accueil, galerie et administration des œuvres vérifiés sans erreur), puis sur `preview`.

### Story 3.11 : pages artistes

- Migration : `20261110090000_pages_artistes` (empreinte SHA-256 : `d5a49b22163e2fff5ec1252296c4f48c0b25f28864f3a38310f2720a2c546c1c`). Ajoute à `Artist` trois colonnes facultatives : `formation` et `expositions` (`TEXT`), `atelierUrl` (`TEXT`). Ajout seulement, aucune recopie.
- Le nouveau code lit ces colonnes (pages artistes, administration) et échouerait sans elles : même procédure que les précédentes, `preview` puis production **avant la fusion**, avec la ligne `_prisma_migrations` et l'empreinte SHA-256.
  ```sql
  BEGIN;
  -- AlterTable
  ALTER TABLE "Artist" ADD COLUMN     "atelierUrl" TEXT,
  ADD COLUMN     "expositions" TEXT,
  ADD COLUMN     "formation" TEXT;
  INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
  VALUES (gen_random_uuid()::text, 'd5a49b22163e2fff5ec1252296c4f48c0b25f28864f3a38310f2720a2c546c1c',
          '20261110090000_pages_artistes', now(), now(), 1);
  COMMIT;
  ```
  Vérifiez l'empreinte avec `sha256sum` avant de l'enregistrer.
- Cloudinary : les photos d'artiste utilisent les mêmes variables que le dépôt d'œuvre (story 2.5), dossier `errancy/artistes/<id>/`.
- 2026-11-10 (story 3.11) : migration `20261110090000_pages_artistes` (avec son empreinte SHA-256) appliquée depuis l'éditeur SQL de Neon sur `preview`, puis sur `production` avant la fusion de la PR #48. Point de restauration production : branche `sauvegarde-avant-3-11-2026-11-10`. Préversion vérifiée avec un artiste de test renseigné par SQL.
- Retour arrière : l'ancien code ignore les colonnes ajoutées (les pages artistes reprennent leur ancien aspect). Pour retirer la migration (dernier recours, les textes et la photo d'atelier sont perdus) : `ALTER TABLE "Artist" DROP COLUMN "formation", DROP COLUMN "expositions", DROP COLUMN "atelierUrl";` puis `DELETE FROM "_prisma_migrations" WHERE migration_name = '20261110090000_pages_artistes';`. Un portrait remplacé depuis l'administration reste dans `imageUrl`.

### Story 4.3 : demande de visite à distance ou en atelier

- Migration : `20261110210000_demandes_visite` (empreinte SHA-256 : `c195799eee8447a0887f1f964f8942d7dca1f1419c208bbb91503aeccd52d47b`). Ajoute le type `TypeVisite` et la table `DemandeVisite` (trois index, clé étrangère facultative vers `Artwork` en `ON DELETE SET NULL` : une œuvre supprimée laisse la demande, sans lien, décision du porteur du 2026-11-10). Ajout seulement, aucune table existante modifiée (la relation `Artwork.demandesVisite` n'existe que dans Prisma). Réutilise le type `EtatDemande` de la story 4.2.
- Le nouveau code écrit dans cette table à chaque demande de visite et échouerait sans elle : même procédure que les précédentes, branche de sauvegarde datée, `preview` puis production **avant la fusion**, avec la ligne `_prisma_migrations` et l'empreinte SHA-256.
  ```sql
  BEGIN;
  -- CreateEnum
  CREATE TYPE "TypeVisite" AS ENUM ('distance', 'atelier');

  -- CreateTable
  CREATE TABLE "DemandeVisite" (
      "id" TEXT NOT NULL,
      "artworkId" TEXT,
      "type" "TypeVisite" NOT NULL,
      "creneaux" TIMESTAMPTZ(3)[],
      "fuseau" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "telephone" TEXT,
      "etat" "EtatDemande" NOT NULL DEFAULT 'nouvelle',
      "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ(3) NOT NULL,

      CONSTRAINT "DemandeVisite_pkey" PRIMARY KEY ("id")
  );

  -- CreateIndex
  CREATE INDEX "DemandeVisite_etat_createdAt_idx" ON "DemandeVisite"("etat", "createdAt");

  -- CreateIndex
  CREATE INDEX "DemandeVisite_email_createdAt_idx" ON "DemandeVisite"("email", "createdAt");

  -- CreateIndex
  CREATE INDEX "DemandeVisite_artworkId_idx" ON "DemandeVisite"("artworkId");

  -- AddForeignKey
  ALTER TABLE "DemandeVisite" ADD CONSTRAINT "DemandeVisite_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
  VALUES (gen_random_uuid()::text, 'c195799eee8447a0887f1f964f8942d7dca1f1419c208bbb91503aeccd52d47b',
          '20261110210000_demandes_visite', now(), now(), 1);
  COMMIT;
  ```
  Vérifiez l'empreinte avec `sha256sum` avant de l'enregistrer.
- Contrôle (lecture seule) après un essai sur la préversion : `SELECT id, "artworkId", type, etat, fuseau, "createdAt" FROM "DemandeVisite" ORDER BY "createdAt" DESC LIMIT 5;` (les coordonnées s'y trouvent : ne les copiez nulle part).
- Retour arrière : le code précédent ignore cette table. Pour la retirer (dernier recours, les demandes de visite sont perdues) : `DROP TABLE "DemandeVisite"; DROP TYPE "TypeVisite";` puis `DELETE FROM "_prisma_migrations" WHERE migration_name = '20261110210000_demandes_visite';`.

### Story 4.2 : demande de sélection personnalisée

- Migration : `20261110180000_demandes_selection` (empreinte SHA-256 : `d3f37d261386e95195564a31cc1087827de688375df86a5b5742a6cd737e6cb8`). Ajoute le type `EtatDemande` et la table `DemandeSelection` (deux index). Ajout seulement, aucune table existante modifiée.
- Le nouveau code écrit dans cette table à chaque demande et échouerait sans elle : même procédure que les précédentes, branche de sauvegarde datée, `preview` puis production **avant la fusion**, avec la ligne `_prisma_migrations` et l'empreinte SHA-256.
  ```sql
  BEGIN;
  -- CreateEnum
  CREATE TYPE "EtatDemande" AS ENUM ('nouvelle', 'planifiee', 'faite', 'sans_suite');

  -- CreateTable
  CREATE TABLE "DemandeSelection" (
      "id" TEXT NOT NULL,
      "espace" TEXT NOT NULL,
      "ambiances" TEXT[] DEFAULT ARRAY[]::TEXT[],
      "precision" TEXT,
      "budgetCentimes" INTEGER NOT NULL,
      "email" TEXT NOT NULL,
      "telephone" TEXT,
      "etat" "EtatDemande" NOT NULL DEFAULT 'nouvelle',
      "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ(3) NOT NULL,

      CONSTRAINT "DemandeSelection_pkey" PRIMARY KEY ("id")
  );

  -- CreateIndex
  CREATE INDEX "DemandeSelection_etat_createdAt_idx" ON "DemandeSelection"("etat", "createdAt");

  -- CreateIndex
  CREATE INDEX "DemandeSelection_email_createdAt_idx" ON "DemandeSelection"("email", "createdAt");
  INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
  VALUES (gen_random_uuid()::text, 'd3f37d261386e95195564a31cc1087827de688375df86a5b5742a6cd737e6cb8',
          '20261110180000_demandes_selection', now(), now(), 1);
  COMMIT;
  ```
  Vérifiez l'empreinte avec `sha256sum` avant de l'enregistrer.
- Contrôle (lecture seule) après un essai sur la préversion : `SELECT id, etat, "createdAt" FROM "DemandeSelection" ORDER BY "createdAt" DESC LIMIT 5;` (les coordonnées s'y trouvent : ne les copiez nulle part).
- Retour arrière : le code précédent ignore cette table. Pour la retirer (dernier recours, les demandes sont perdues) : `DROP TABLE "DemandeSelection"; DROP TYPE "EtatDemande";` puis `DELETE FROM "_prisma_migrations" WHERE migration_name = '20261110180000_demandes_selection';`.

### Story 4.1 : e-mails transactionnels

- Migration : `20261110120000_envoi_invitations` (empreinte SHA-256 : `23ff62d47282e14a709e68935db23f126934734ba65fa1283119ef8711b1f9bd`). Ajoute à `Invitation` deux colonnes facultatives : `envoyeeLe` et `echecEnvoiLe` (`TIMESTAMP(3)`). Ajout seulement, aucune recopie.
- Le nouveau code lit ces colonnes (écran des artistes, envoi de l'invitation) et échouerait sans elles : même procédure que les précédentes, branche de sauvegarde datée, `preview` puis production **avant la fusion**, avec la ligne `_prisma_migrations` et l'empreinte SHA-256.
  ```sql
  BEGIN;
  -- AlterTable
  ALTER TABLE "Invitation" ADD COLUMN     "echecEnvoiLe" TIMESTAMP(3),
  ADD COLUMN     "envoyeeLe" TIMESTAMP(3);
  INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
  VALUES (gen_random_uuid()::text, '23ff62d47282e14a709e68935db23f126934734ba65fa1283119ef8711b1f9bd',
          '20261110120000_envoi_invitations', now(), now(), 1);
  COMMIT;
  ```
  Vérifiez l'empreinte avec `sha256sum` avant de l'enregistrer.
- Resend (avant la mise en production, actes du porteur, hors code) : créer le compte, ajouter le domaine `errancy.art` en région UE (Irlande), publier chez l'hébergeur du domaine les enregistrements SPF et DKIM que Resend indique, puis créer la variable Vercel `RESEND_API_KEY` (Production seulement : en préversion, l'adaptateur « journal » n'envoie rien). Sans clé en production, l'invitation dit « L'e-mail n'est pas parti ».
- Retour arrière : l'ancien code ignore les colonnes ajoutées. Pour les retirer (dernier recours) : `ALTER TABLE "Invitation" DROP COLUMN "envoyeeLe", DROP COLUMN "echecEnvoiLe";` puis `DELETE FROM "_prisma_migrations" WHERE migration_name = '20261110120000_envoi_invitations';`. L'ancien code montrait le lien d'invitation à l'écran : après un retour arrière, les invitations déjà envoyées par e-mail restent valables.

### Story 4.6 : file des demandes de l'équipe

- Migration : `20261111090000_file_des_demandes` (empreinte SHA-256 : `323fe69133b86feafd05e7d1ad8d53b0f473bfd71404eda0bedac80400384bda`). Ajoute deux colonnes facultatives, `etatChangePar` (identifiant de l'utilisateur, sans clé étrangère) et `etatChangeLe`, à `DemandeSelection` et à `DemandeVisite` : dernier changement d'état seulement (décision du porteur du 2026-11-10). Additive.
- Le nouveau code lit ces colonnes (page `/dashboard/admin/demandes`) et échouerait sans elles : même procédure que les précédentes, branche de sauvegarde datée, `preview` puis production **avant la fusion**, avec sa ligne `_prisma_migrations`.
  ```sql
  BEGIN;
  -- AlterTable
  ALTER TABLE "DemandeSelection" ADD COLUMN     "etatChangeLe" TIMESTAMPTZ(3),
  ADD COLUMN     "etatChangePar" TEXT;
  -- AlterTable
  ALTER TABLE "DemandeVisite" ADD COLUMN     "etatChangeLe" TIMESTAMPTZ(3),
  ADD COLUMN     "etatChangePar" TEXT;
  INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
  VALUES (gen_random_uuid()::text, '323fe69133b86feafd05e7d1ad8d53b0f473bfd71404eda0bedac80400384bda',
          '20261111090000_file_des_demandes', now(), now(), 1);
  COMMIT;
  ```
  Vérifiez l'empreinte avec `sha256sum` avant de l'enregistrer.
- Contrôle après un changement d'état dans la préversion (SQL, les comptes admin ne s'y connectent pas) : `SELECT id, etat, "etatChangePar", "etatChangeLe" FROM "DemandeVisite" WHERE "etatChangeLe" IS NOT NULL;`.
- Retour arrière : l'ancien code ignore les colonnes. Pour les retirer (dernier recours) : `ALTER TABLE "DemandeSelection" DROP COLUMN "etatChangePar", DROP COLUMN "etatChangeLe"; ALTER TABLE "DemandeVisite" DROP COLUMN "etatChangePar", DROP COLUMN "etatChangeLe";` puis `DELETE FROM "_prisma_migrations" WHERE migration_name = '20261111090000_file_des_demandes';`.

### Story 3.4 : journal d'événements

- Migration : `20261106090000_journal_evenements` (ajout seulement : tables `Evenement` et `TraitementEvenement`, aucune table existante modifiée).
- Procédure : même procédure que les précédentes, depuis l'éditeur SQL de Neon (branche de sauvegarde datée, `preview` puis production **avant la fusion**), avec la ligne `_prisma_migrations` et l'empreinte SHA-256 `4ca34628666920977e7e3f805ec6b78afbf57fad0c3279f1bf3692ebc8a0197f`. Le nouveau code écrit dans ces tables à chaque publication ou changement de disponibilité et échouerait sans elles.
- Contrôle (lecture seule) : `SELECT count(*) FROM "Evenement"; SELECT count(*) FROM "TraitementEvenement";` répondent 0 juste après la migration, puis augmentent à chaque déclaration (« vendue ailleurs », « retirée ») ou décision de curation.
- Retour arrière : le code précédent ignore ces tables, il fonctionne sur la base migrée. Pour les retirer après un retour arrière définitif : `DROP TABLE "TraitementEvenement"; DROP TABLE "Evenement";` puis `DELETE FROM "_prisma_migrations" WHERE migration_name = '20261106090000_journal_evenements';`.
- 2026-11-06 (story 3.4) : migration `20261106090000_journal_evenements` (avec son empreinte SHA-256) appliquée depuis l'éditeur SQL de Neon sur `preview`, puis sur `production` avant la fusion de la PR #41. Point de restauration production : branche `avant-journal-prod-06-11`. Sur la préversion, « A Subtlety » déclarée « vendue ailleurs » par le compte artiste de test s'affiche vendue sur la fiche publique après rechargement.
- 2026-11-10 (story 4.1) : migration `20261110120000_envoi_invitations` (avec son empreinte SHA-256) appliquée depuis l'éditeur SQL de Neon sur `preview`, puis sur `production` avant la fusion de la PR #51 ; colonnes `envoyeeLe` et `echecEnvoiLe` vérifiées sur la production. Point de restauration production : branche `sauvegarde-avant-4-1-2026-11-10`. Resend : domaine `errancy.art` vérifié (région UE, enregistrements DKIM et deux CNAME chez Hostinger), clé `RESEND_API_KEY` en Production seulement. Invitation de test envoyée en production : e-mail « Delivered » dans Resend.
- 2026-11-10 (story 4.2) : migration `20261110180000_demandes_selection` (avec son empreinte SHA-256) appliquée depuis l'éditeur SQL de Neon sur `preview`, puis sur `production` avant la fusion de la PR #53. Point de restauration production : branche `sauvegarde-avant-4-2-2026-11-10`. Table `DemandeSelection` vérifiée vide sur la production ; sur la préversion, une demande de test enregistrée à l'état `nouvelle`. `/conseil` vérifié en production (affichage seulement, aucun envoi réel).
- 2026-11-10 (story 4.3) : migration `20261110210000_demandes_visite` (avec son empreinte SHA-256) appliquée depuis l'éditeur SQL de Neon sur `preview`, puis sur `production` avant la fusion de la PR #55. Point de restauration production : branche `sauvegarde-avant-4-3-2026-11-10`. Ligne `_prisma_migrations` vérifiée sur la production ; sur la préversion, une demande de test enregistrée à l'état `nouvelle` (fuseau de l'appareil). Déploiement de production « Ready » ; aucune demande de test créée en production.
- 2026-11-10 (story 4.6) : migration `20261111090000_file_des_demandes` (avec son empreinte SHA-256) appliquée depuis l'éditeur SQL de Neon sur `preview`, puis sur `production` avant la fusion de la PR #59. Point de restauration production : branche `sauvegarde-avant-4-6-2026-11-10`. Ligne `_prisma_migrations` vérifiée sur preview et production. `/dashboard/admin/demandes` vérifiée en production avec un compte administrateur (« Aucune demande en attente. », aucune demande réelle modifiée).
- 2026-11-10 (story 4.8) : migration `20261111120000_mesure_choix` (avec son empreinte SHA-256) appliquée depuis l'éditeur SQL de Neon sur `preview`, puis sur `production` avant la fusion de la PR #63. Point de restauration production : branche `sauvegarde-avant-4-8-2026-11-10`. Ligne `_prisma_migrations` vérifiée sur la production ; sur la préversion, un refus puis une acceptation comptés (une ligne `refuse` et une ligne `accepte`). Bannière vérifiée en production (affichage seulement, aucun choix enregistré). `MESURE_CLE` et `MESURE_ADRESSE` pas encore saisies : rien n'est envoyé à PostHog.
- 2026-11-10 (story 4.9) : migration `20261111150000_usage_jeton_desinscription` (empreinte SHA-256 `8846bca96b44e5d22851d513889d4e46141b38fd9dd272f781fb9ade265c3da2`, ajout seulement de la valeur `desinscription` à `UsageJeton`) appliquée depuis l'éditeur SQL de Neon sur `preview`, puis sur `production` avant la fusion de la PR #65. Point de restauration production : branche `sauvegarde-avant-4-9-2026-11-10`. Ligne `_prisma_migrations` et valeur d'enum vérifiées sur preview et production. `/dashboard/admin/ouverture` vérifiée en production avec un compte administrateur (3 contacts à prévenir, aucun envoi). L'envoi réel reste le geste du porteur le jour de l'ouverture, après relecture de l'e-mail d'essai.
- 2026-11-10 (story 4.5) : migration `20261112090000_me_prevenir` (empreinte SHA-256 `55298f5038bc0d71f5ea6565e24083f4eb32b57aa49e6a0cb5927fc97830a745` : valeur `desinscription_alerte` de `UsageJeton` et table `InscriptionPrevenir`, additive) appliquée depuis l'éditeur SQL de Neon sur `preview`, puis sur `production` avant la fusion de la PR #67. Point de restauration production : branche `sauvegarde-avant-4-5-2026-11-10` (la branche `sauvegarde-avant-3-11-2026-11-10` a été supprimée pour rester sous la limite de 10 branches de Neon). Valeur d'enum, table vide et ligne `_prisma_migrations` vérifiées sur preview et production. Section « Me prévenir » de `/dashboard/admin/demandes` vérifiée en production (vide). Le formulaire n'est atteignable qu'avec une œuvre réservée (Epic 6).

### Story 4.8 : mesure du tunnel

- Migration : `20261111120000_mesure_choix` (empreinte SHA-256 : `ac9caff7044dddd83fb5ef934616e82b472d2b8fc0eca16c8c3f0026b5275a8b`). Ajoute le type `ChoixMesure` (`accepte`, `refuse`) et la table `CompteurChoixMesure` (jour, choix, nombre ; clé primaire jour + choix, aucun identifiant). Additive : aucune table existante modifiée.
- Le nouveau code écrit dans cette table à chaque choix de consentement (la bannière est proposée à tous les visiteurs) ; sans elle, le choix reste appliqué (cookie) mais le compteur échoue et un message est journalisé. Même procédure que les précédentes : branche de sauvegarde datée, `preview` puis production **avant la fusion**, avec sa ligne `_prisma_migrations`.
  ```sql
  BEGIN;
  -- CreateEnum
  CREATE TYPE "ChoixMesure" AS ENUM ('accepte', 'refuse');
  -- CreateTable
  CREATE TABLE "CompteurChoixMesure" (
      "jour" DATE NOT NULL,
      "choix" "ChoixMesure" NOT NULL,
      "nombre" INTEGER NOT NULL DEFAULT 0,

      CONSTRAINT "CompteurChoixMesure_pkey" PRIMARY KEY ("jour","choix")
  );
  INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
  VALUES (gen_random_uuid()::text, 'ac9caff7044dddd83fb5ef934616e82b472d2b8fc0eca16c8c3f0026b5275a8b',
          '20261111120000_mesure_choix', now(), now(), 1);
  COMMIT;
  ```
  Vérifiez l'empreinte avec `sha256sum` avant de l'enregistrer.
- Contrôle (lecture seule) : `SELECT jour, choix, nombre FROM "CompteurChoixMesure" ORDER BY jour DESC;` après un choix dans la préversion.
- Retour arrière : l'ancien code ignore la table. Pour la retirer (dernier recours) : `DROP TABLE "CompteurChoixMesure"; DROP TYPE "ChoixMesure";` puis `DELETE FROM "_prisma_migrations" WHERE migration_name = '20261111120000_mesure_choix';`.
- Variables Vercel (acte du porteur, jamais dans le code) : `MESURE_CLE` (clé du projet PostHog UE) et `MESURE_ADRESSE` (adresse d'hébergement UE, en https), en Production seulement ; sans elles, rien n'est envoyé.

### Story 6.1 : passage en caisse et commandes par artiste

- Migration : `20261113090000_commandes` (empreinte SHA-256 : `b32c8442320ddb4b29601d8229c61e837655f4434fdd05223612f0fb99a4eacd`). Additive : types `EtatCommande` et `EtatPaiement`, tables `PassageEnCaisse`, `CoordonneesAcheteur`, `Commande`, `LigneCommande` et `Paiement` (minimale, la 6.4 y ajoute le constat), avec leurs contraintes `CHECK` écrites à la main. La table `"Order"` n'est pas touchée et reste lue et écrite par le code actuel (`/api/checkout`, webhook Stripe, pages d'administration).
- Aucun appelant avant 6.2 à 6.4 : le nouveau code n'écrit dans ces tables que lorsqu'une story suivante appelle `creerPassageEnCaisse`. Même procédure que les précédentes : branche de sauvegarde datée (`sauvegarde-avant-6-1-…`), `preview` puis production **avant la fusion**, avec la ligne `_prisma_migrations` (vérifiez l'empreinte avec `sha256sum`).
- Recopie des anciennes commandes (AD-20, temps 1 et 2) : `scripts/sql/recopier-anciennes-commandes.sql`, lancé par le porteur après la migration, depuis l'éditeur SQL de Neon (`preview`, puis production). Chaque ancien `"Order"` devient une commande `historique` (total en centimes, devise, slugs, e-mail, identifiants Stripe), sans ligne figée et hors des sommes dues. Idempotent : le relancer ne duplique rien. Le script renvoie deux lignes de contrôle, `avant` (nombre d'`"Order"` et somme de leurs montants en centimes) et `apres` (commandes historiques et somme) : elles doivent être identiques. Relever le nombre d'`"Order"` en production **avant** la recopie.
- Contrôle (lecture seule) : `SELECT count(*) FROM "Order"; SELECT count(*) FROM "Commande" WHERE etat = 'historique';` donnent le même nombre après la recopie.
- Retour arrière : l'ancien code ignore les nouvelles tables. Annuler la seule recopie : `DELETE FROM "Commande" WHERE etat = 'historique';`. Retirer le modèle (dernier recours) : `DROP TABLE "Paiement", "LigneCommande", "Commande", "CoordonneesAcheteur", "PassageEnCaisse"; DROP TYPE "EtatPaiement"; DROP TYPE "EtatCommande";` puis `DELETE FROM "_prisma_migrations" WHERE migration_name = '20261113090000_commandes';`. La suppression d'`"Order"` est la story 7.9.
- 2026-11-11 (story 6.1) : migration `20261113090000_commandes` (empreinte SHA-256 `b32c8442320ddb4b29601d8229c61e837655f4434fdd05223612f0fb99a4eacd`) appliquée depuis l'éditeur SQL de Neon sur `preview`, puis sur `production` avant la fusion de la PR #69. Point de restauration production : branche `sauvegarde-avant-6-1-2026-11-11`. Cinq tables et ligne `_prisma_migrations` vérifiées sur preview et production. `"Order"` vide sur preview et sur production (0 ligne) : le script `recopier-anciennes-commandes.sql` a été lancé sur preview (0 commande recopiée, contrôle 0 / 0) et non lancé en production, faute d'ancienne commande à recopier ; il reste disponible si `"Order"` se remplit avant la 7.9.
