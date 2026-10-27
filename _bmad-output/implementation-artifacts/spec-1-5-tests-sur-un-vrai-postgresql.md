---
title: 'Story 1.5 — Tests automatisés sur un vrai PostgreSQL'
type: 'feature'
created: '2026-10-27'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le projet n'a aucun test : la future protection contre la double vente (NFR-4) ne pourrait être que supposée, pas prouvée (AR-3).

**Approach:** Installer Vitest 5 avec un script `npm test` ; un utilitaire de test crée une base PostgreSQL jetable sur un serveur désigné par une variable dédiée, la migre avec les migrations du dépôt puis la supprime (refus si elle vise la production). Un job CI « Tests » lance `npm test` contre un service PostgreSQL de GitHub Actions et échoue si un test échoue. Un premier test prouve que deux transactions sur deux connexions distinctes sont réellement concurrentes. AGENTS.md ne dit plus « il n'existe ni tests ni CI ». Ne touche ni `MAINTENANCE_MODE`, ni `robots.txt`, ni `src/generated/prisma/`, ni aucun secret.

</frozen-after-approval>

## Implementation Notes

- `vitest` `~5.0.5` (5.0.5, version du spine) en devDependency ; `vite` 8 installé comme dépendance paire. Script `npm test` = `vitest run`.
- `vitest.config.mts` (`.mts` pour éviter l'avertissement de chargement ESM de Vite) : alias `@` → `src`, fichiers `tests/**/*.test.ts`, `.env.local` chargé comme pour la CLI Prisma.
- `tests/utils/base-jetable.ts` : `creerBaseJetable()` crée `test_<horodatage>_<aléa>` sur le serveur de `TEST_DATABASE_URL`, lance `prisma migrate deploy` dessus (base jetable, pas un déploiement), et renvoie `supprimer()` (`DROP DATABASE … WITH (FORCE)`). Base supprimée si la migration échoue. Refus explicite si `TEST_DATABASE_URL` est absente ou vise `DATABASE_PRODUCTION_ID` (réutilise `ecritureInterdite`, dont le type de paramètre est élargi à `Record<string, string | undefined>`).
- `tests/base-de-test.test.ts` : toutes les migrations du dépôt appliquées ; `pg_backend_pid()` différents ; sur une table propre au test, la transaction B est déclarée bloquée par A (`pg_blocking_pids`) sur `SELECT … FOR UPDATE`, puis débloquée au `COMMIT` de A.
- `tests/garde-production.test.ts` : tests unitaires (sans base) du garde de la story 1.2.
- CI : job « Tests » (service `postgres:16`, `TEST_DATABASE_URL` jetable, aucun secret). AGENTS.md et README décrivent les tests.
- Vérifié en local (PostgreSQL 16, Node 22 ; la CI tourne en Node 24) : 7 tests verts, aucun `ROLLBACK` superflu, base supprimée ensuite ; sans variable → échec explicite ; variable visant la production → refus ; `tsc --noEmit`, `npx eslint .`, `npm run build` OK.
- Les stories 1.2 à 1.4 restent en `review` (réglages du porteur non confirmés).

## Review Triage Log

- Refus de la production ignoré sans `DATABASE_PRODUCTION_ID` — medium : vrai ; `ecritureInterdite` toujours appelée (avertissement si la variable manque), README précisé.
- `TEST_DATABASE_URL` sur un serveur partagé — low : non vérifiable de façon fiable (local et `DATABASE_URL` partagent souvent `localhost`) ; avertissement dans le README ; rejeté.
- Migration sans délai maximal — low : vrai ; `timeout: 90_000`.
- `npx` pouvant télécharger Prisma — low : vrai ; `--no-install`.
- Bases orphelines après un arrêt brutal — low : CI éphémère ; mention dans le README ; rejeté.
- Test de concurrence fondé sur une attente de 300 ms — medium : vrai ; remplacé par `pg_blocking_pids`, rejet non géré évité.
- `ROLLBACK` superflus — low : vrai ; suivis par indicateurs (0 avertissement PostgreSQL).
- Colonnes d'`Artist` codées en dur — low : vrai ; table propre au test.
- Garde sans tests unitaires — low : ajoutés.
- Node 22 en local, parallélisme, AGENTS.md « Where things are » — low : CI en Node 24 ; un fichier = une base, parallélisme sûr ; tests décrits dans « Running and verifying » ; rejetés.
