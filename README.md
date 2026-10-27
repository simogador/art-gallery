# art-gallery
Premium art gallery platform

## Base de données en local

Ne travaillez jamais sur la base de production. Utilisez votre propre base PostgreSQL ou une branche Neon à vous :

1. Dans la console Neon, créez une branche à partir de `main` (par exemple `dev-<prénom>`) et copiez sa chaîne de connexion.
2. Dans `.env.local` (ignoré par git), renseignez :
   - `DATABASE_URL` : la chaîne de connexion de **votre** branche ou de votre base locale ;
   - `DATABASE_PRODUCTION_ID` : l'identifiant d'endpoint Neon de la production (`ep-…`, visible dans la console Neon ; ce n'est pas un secret).
3. `npm run db:migrate` applique toutes les migrations à **votre** base, puis `npm run db:seed` la remplit avec les données de démonstration. Ces deux scripts refusent de s'exécuter si `DATABASE_URL` vise la production. N'utilisez jamais `prisma db push` sur une base partagée ; les règles de migration sont dans `docs/migrations.md`.

Hors production (`VERCEL_ENV` différent de `production`, donc aussi en local), si `DATABASE_URL` vise l'endpoint `DATABASE_PRODUCTION_ID`, le client Prisma refuse toute écriture ainsi que tout SQL brut (`$queryRaw`, `$executeRaw`), avec l'erreur `EcritureProductionInterdite`, et le seed s'arrête. Les lectures par le client restent possibles.

**Sans `DATABASE_PRODUCTION_ID`, la protection est inactive** : un simple avertissement est journalisé et les écritures passent. La variable doit donc être définie partout (local, « Preview » et « Production » dans Vercel).

## Tests

Les tests (Vitest) tournent sur un vrai PostgreSQL : chaque fichier de test crée sa propre base jetable, y applique les migrations du dépôt, puis la supprime.

1. Il vous faut un serveur PostgreSQL **à vous** où votre rôle peut créer des bases (PostgreSQL local, par exemple `docker run -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16`).
2. Dans `.env.local` ou dans votre terminal : `TEST_DATABASE_URL=postgresql://postgres:dev@localhost:5432/postgres`.
3. `npm test`.

Sans `TEST_DATABASE_URL`, les tests s'arrêtent avec un message explicite. Si `DATABASE_PRODUCTION_ID` est définie, ils refusent de s'exécuter quand cette URL vise la base de production ; sans elle, un avertissement rappelle que cette protection est inactive. N'utilisez jamais un serveur partagé : les tests y créent et suppriment des bases. Une base `test_…` peut rester après un arrêt brutal ; supprimez-la à la main. La CI lance les mêmes tests à chaque PR.
