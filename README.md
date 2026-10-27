# art-gallery
Premium art gallery platform

## Base de données en local

Ne travaillez jamais sur la base de production. Utilisez votre propre base PostgreSQL ou une branche Neon à vous :

1. Dans la console Neon, créez une branche à partir de `main` (par exemple `dev-<prénom>`) et copiez sa chaîne de connexion.
2. Dans `.env.local` (ignoré par git), renseignez :
   - `DATABASE_URL` : la chaîne de connexion de **votre** branche ou de votre base locale ;
   - `DATABASE_PRODUCTION_ID` : l'identifiant d'endpoint Neon de la production (`ep-…`, visible dans la console Neon ; ce n'est pas un secret).
3. `npm run db:push` crée les tables dans **votre** base, puis `npm run db:seed` la remplit avec les données de démonstration. Ces deux scripts refusent de s'exécuter si `DATABASE_URL` vise la production. N'utilisez pas `npx prisma db push` directement, et jamais sur une base partagée (l'historique des migrations n'est pas encore complet, voir story 1.4).

Hors production (`VERCEL_ENV` différent de `production`, donc aussi en local), si `DATABASE_URL` vise l'endpoint `DATABASE_PRODUCTION_ID`, le client Prisma refuse toute écriture ainsi que tout SQL brut (`$queryRaw`, `$executeRaw`), avec l'erreur `EcritureProductionInterdite`, et le seed s'arrête. Les lectures par le client restent possibles.

**Sans `DATABASE_PRODUCTION_ID`, la protection est inactive** : un simple avertissement est journalisé et les écritures passent. La variable doit donc être définie partout (local, « Preview » et « Production » dans Vercel).
