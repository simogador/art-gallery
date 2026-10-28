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

## Journal des bases partagées

- 2026-10-28 : sur `production` puis sur la branche `preview`, la ligne de base `20261027150000_ligne_de_base` a été déclarée (sans exécution) et `20261027230000_inscriptions_ouverture` appliquée, en une transaction depuis l'éditeur SQL de Neon (SQL de la migration et empreintes SHA-256 identiques à celles de Prisma). Point de restauration : branche `avant-migrations-28-10` (expire le 2026-11-04).
