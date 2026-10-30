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

- Migration : `20261029084432_prix_dimensions_exacts` (ajoute `prixCentimes`, `devise`, `hauteurMm`, `largeurMm`, `profondeurMm` à `Artwork`, toutes facultatives ou avec valeur par défaut).
- Recopie : `scripts/sql/recopie-prix-dimensions.sql`. Prix en euros → centimes ; dimensions « hauteur × largeur (× profondeur) cm|mm » → millimètres. Rien n'est deviné.
- Écarts après la fusion (étape 7) : `scripts/sql/ecarts-prix-dimensions.sql`, en lecture seule.
- Contrôles : `scripts/sql/dimensions-illisibles.sql` (œuvres à compléter depuis le formulaire d'édition, qui préremplit l'ancien texte) et `scripts/sql/prix-non-recopies.sql` (prix nul, négatif, à plus de deux décimales ou au-delà de 21 474 836,47 €, limite d'une colonne `INTEGER`).

### Story 2.2 : publication et disponibilité

- Migration : `20261030090000_publication_disponibilite` (énumérations `Publication` et `Disponibilite`, colonnes facultatives `publication` et `disponibilite` de `Artwork`, sans valeur par défaut, index sur les deux).
- Recopie : `scripts/sql/recopie-publication-disponibilite.sql`. `available = true` → `publiee` + `disponible` ; `false` → `publiee` + `vendue`. Ne remplit que des colonnes vides ; `available` n'est pas modifiée.
- Double écriture : le nouveau code tient `available` égale à « disponible » (publiée et disponible). Une œuvre créée par un artiste naît `brouillon` + `disponible`, donc avec `available = false` : en cas de retour au commit précédent, elle apparaît comme vendue, jamais achetable.
- Contrôle après la recopie : `scripts/sql/vendues-sans-commande.sql`, en lecture seule. La recopie traduit tout `available = false` en `vendue`, alors que l'ancienne bascule a pu servir à masquer une œuvre non vendue : la requête liste les œuvres publiées et vendues qu'aucune commande ne contient. Revoyez-les une à une depuis l'administration (dépublier, ou repasser en disponible).
- Écarts après la fusion (étape 7), et après tout retour arrière : `scripts/sql/ecarts-publication-disponibilite.sql`, en lecture seule. Elle liste les œuvres dont une colonne est vide (créées par l'ancien code) ou dont `available` diffère de « disponible » (bascule de l'administration ou paiement passés par l'ancien code).
- Correction ciblée : `scripts/sql/corriger-ecarts-publication-disponibilite.sql`, depuis l'éditeur SQL de Neon (il porte son propre `BEGIN`/`COMMIT`, idempotent), puis de nouveau la requête d'écarts. Il ne corrige que ce qui est en désaccord : axe vide rempli d'après `available` (publication `publiee`, disponibilité `disponible` ou `vendue`) ; œuvre publiée, `disponible` ou `vendue`, en désaccord avec `available` : disponibilité d'après `available`. Il ne touche jamais un brouillon, une œuvre en curation, réservée, vendue ailleurs ou retirée : ce qui reste listé ensuite (par ex. un brouillon que l'ancien code a remis à `available = true`) se traite à la main depuis l'administration. Ne videz jamais les deux colonnes pour relancer la recopie : ces états seraient perdus.

## Journal des bases partagées

- 2026-10-28 : sur `production` puis sur la branche `preview`, la ligne de base `20261027150000_ligne_de_base` a été déclarée (sans exécution) et `20261027230000_inscriptions_ouverture` appliquée, en une transaction depuis l'éditeur SQL de Neon (SQL de la migration et empreintes SHA-256 identiques à celles de Prisma). Point de restauration : branche `avant-migrations-28-10` (expire le 2026-11-04).
- 2026-10-29 : sur `preview` puis sur `production`, migration `20261029084432_prix_dimensions_exacts` appliquée (avec son empreinte SHA-256) et `scripts/sql/recopie-prix-dimensions.sql` lancée depuis l'éditeur SQL de Neon : 8 prix et 7 dimensions recopiés ; seule « A Subtlety » (« 11 × 7.9 × 23 m », démonstration) reste illisible. Retour arrière vérifié sur `preview` (ancien code fonctionnel). Point de restauration : branche `avant-prix-dimensions-29-10` (expire le 2026-11-05).
