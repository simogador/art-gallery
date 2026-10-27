---
title: 'Story 1.3 — Intégration continue : lint et build à chaque PR'
type: 'chore'
created: '2026-10-27'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Rien ne vérifie une PR avant sa fusion : une erreur ESLint n'est découverte qu'au build Vercel, trop tard (AR-3).

**Approach:** Un workflow GitHub Actions déclenché par chaque PR vers `main` installe les dépendances sous Node 24 (`npm ci`), lance `npx eslint .` puis `npm run build`, et échoue si l'une échoue ; aucun secret (le build passe sans base, `DatabaseNotReachable` attendus). La section « Running and verifying » d'AGENTS.md mentionne la CI. La règle de protection de `main` (check obligatoire) est un réglage GitHub décrit au porteur dans la PR, pas modifié. Ne touche ni `MAINTENANCE_MODE`, ni `robots.txt`, ni `src/generated/prisma/`, ni aucun secret.

</frozen-after-approval>

## Implementation Notes

- `.github/workflows/ci.yml` : job « Lint et build », `actions/checkout@v6`, `actions/setup-node@v6` (version de Node lue dans `engines.node` de `package.json`, une seule source ; cache npm), `permissions: contents: read`, annulation des runs obsolètes par branche.
- `npx eslint .` passe en local sur tout le dépôt (0 erreur, 4 avertissements existants), y compris avec `src/generated/prisma/` présent.
- `AGENTS.md` : la ligne « ni tests ni CI » devient la description de la CI ; les tests restent à venir (story 1.5).
- La story 1.2 reste en `review` : son passage à `done` attend les vérifications du porteur dans Vercel.
- `AGENTS.md` : la commande de lint locale devient `npx eslint .`, comme la CI (`next lint` ne couvre pas `scripts/` ni `prisma/`).
- Vérifié en local, sans aucune variable : `npm ci` (avec `postinstall` → `prisma generate`), `npx eslint .` et `npm run build` sortent en 0. La preuve sur GitHub est le premier run de la PR.
- Réglage du porteur (GitHub → Settings → Branches ou Rules → règle sur `main`) : exiger le check « Lint et build » (« Require status checks to pass »), et de préférence « Require branches to be up to date ». Tant qu'il n'est pas fait, une PR rouge reste fusionnable.

## Review Triage Log

- AGENTS.md affirmait qu'une PR rouge ne se fusionne pas — low : vrai tant que la règle GitHub n'existe pas ; formulation corrigée.
- Procédure de protection de `main` absente — low : ajoutée aux notes et à la PR.
- `npm run lint` local ≠ `npx eslint .` en CI — medium : vrai ; AGENTS.md aligné sur la CI.
- Version de Node dupliquée — low : `node-version-file: package.json`.
- Actions en v4 (runtime Node 20) — low : passées en v6 ; épinglage par SHA rejeté (gain faible, `contents: read`).
- Pas de `workflow_dispatch` ni de run sur `main` — low : hors critères de la story ; rejeté.
- Pas de preuve d'un run réel — low : le run de la PR la fournit.
- ESLint lancé deux fois (`next build` lint aussi) — low : voulu, les périmètres diffèrent ; rejeté.
- Pas de cache `.next/cache` — low : optimisation ; rejeté.
- Tests et migrations absents du workflow — false : prévus explicitement par les stories 1.4 et 1.5.
- Statuts désalignés — low : spec `done`, story en `review` à la fin.
