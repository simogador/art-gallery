---
title: 'Story 1.6 — Accès à la base réservé aux modules métier'
type: 'chore'
created: '2026-10-27'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** N'importe quel fichier peut importer Prisma : un agent peut réécrire une règle de vente dans une page ou une route au lieu de passer par un module métier (AR-4, AD-1).

**Approach:** Une règle ESLint `no-restricted-imports` interdit `@/lib/prisma`, `@/generated/prisma*` et leurs équivalents relatifs hors de `src/lib/<module>/**` et `src/auth.ts`, avec un message qui renvoie à AD-1. Les fichiers existants qui importent Prisma figurent sur une liste d'exceptions nommée, commentée « ne fait que diminuer », et le lint passe. Un contrôle CI compare cette liste à celle de `main` et échoue sur tout ajout. Ne touche ni au code applicatif, ni à `MAINTENANCE_MODE`, `robots.txt`, `src/generated/prisma/` ou aux secrets.

</frozen-after-approval>

## Implementation Notes

- `.eslintrc.json` → `.eslintrc.js` (commentaires et liste importée). Motifs : `@/lib/prisma`, `**/prisma` (`./prisma`, `../prisma`…), `@/generated/prisma*`, `**/generated/prisma*`, et aussi `@prisma/client`, `@prisma/adapter-pg`, `pg` (sinon on recrée un client à côté). Autorisés : les modules métier explicitement listés (`MODULES_METIER` : `db` et les modules d'AD-8), `src/auth.ts`, et l'infrastructure (`src/lib/prisma.ts`, `src/lib/garde-production.ts`, `prisma.config.ts`, `tests/**`).
- `eslint/exceptions-prisma.cjs` : **23** fichiers, et non 22 comme l'annonçait la story — 21 dans `src/app/`, plus `prisma/seed.ts` et `scripts/upload-images.ts`, tous deux lintés par `npx eslint .`.
- Les crochets des chemins Next.js (`[id]`, `[slug]`) sont échappés pour les globs d'ESLint ; la liste garde les chemins réels.
- `scripts/verifier-exceptions-prisma.cjs` : charge les deux versions de la liste comme ESLint (`require`), compare à `origin/main`, code 1 si ajout, 2 si la référence manque, 0 si la liste est absente de `main` (première PR) ou supprimée localement. Étape CI dans « Lint et build », après `git fetch --depth=1 origin main`.
- `tests/acces-base.test.ts` : 11 tests automatisés (formes d'import refusées dans une page, route `[id]` nouvelle, dossiers de `src/lib` non métier ; modules, `src/auth.ts` et exceptions acceptés ; liste raccourcie, supprimée ou agrandie dans un dépôt git temporaire).
- Vérifié : 18 tests verts, `tsc --noEmit`, `npx eslint .`, contrôle de la liste et `npm run build` OK.
- AGENTS.md (« Where things are ») décrit la règle et la liste.
- Les stories 1.2 à 1.5 restent en `review` (réglages du porteur non confirmés).

## Review Triage Log

- Paquets `@prisma/client`, `@prisma/adapter-pg`, `pg` non bloqués — medium : vrai ; ajoutés (tests et config CLI en infrastructure).
- `src/lib/*/**` exempte `store`, `utils`, `types` ; `./prisma` non détecté — medium : vrai ; liste explicite des modules d'AD-8 et motif `**/prisma`.
- `require`, import dynamique, `eslint-disable` — low : contournements volontaires, visibles en revue ; aucun usage actuel hors `src/generated/` ; rejeté.
- Le contrôle ne protège que la liste, pas `.eslintrc.js` ; lecture par expression régulière — low : la liste est maintenant chargée par `require` (toute mise en forme) ; un élargissement de `.eslintrc.js` reste visible dans le diff ; rejeté pour le reste.
- Pas de tests automatisés de la règle — low : 11 tests ajoutés.
- Fichier de liste supprimé → plantage — low : vrai ; liste vide.
- AGENTS.md et en-tête de `ci.yml` incomplets — low : complétés.
- Comparaison avec la pointe de `main` plutôt que la base de la PR — low : message d'erreur explicite (fusionner `main`) ; rejeté pour le reste.
- Arbre à moitié indexé — false : un seul commit contient tout.
- `.cts` absent, statut de la spec — low : `.cts` ajouté ; story passée en `review`.
