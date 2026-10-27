---
title: 'Story 1.1 — Correctifs de sécurité et Node 24'
type: 'chore'
created: '2026-10-27'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le site tourne sur Next.js 14.2.5 (failles connues corrigées depuis), sans version de Node déclarée (Vercel déprécie Node 20), avec `@types/node` 20 et Prisma en `^7.8.0`, une plage qui laisse dériver la version.

**Approach:** Passer `next` et `eslint-config-next` en 14.2.35, déclarer `engines.node` `>=22.12` (cible 24 LTS), passer `@types/node` en 24 et épingler `prisma`, `@prisma/client` et `@prisma/adapter-pg` en `~7.10` (jamais `@latest`), lockfile régénéré par npm. Rien d'autre : ni Next 16 (epic 5), ni CI (story 1.3), ni `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/` ou secret ; le réglage Node du projet Vercel (24.x) est décrit au porteur dans la PR, pas modifié.

</frozen-after-approval>

## Implementation Notes

- `package.json` : `next` 14.2.5 → 14.2.35, `eslint-config-next` 14.2.5 → 14.2.35 (versions exactes, comme avant) ; `@types/node` `^20.14.0` → `^24.19.2` ; `prisma`, `@prisma/client`, `@prisma/adapter-pg` `^7.8.0` → `~7.10.0` (résout 7.10.1, le tag `latest` de Prisma pointant sur 8.0.0-rc) ; ajout de `"engines": { "node": ">=22.12" }`.
- `package-lock.json` régénéré par `npm install` (pas d'édition manuelle).
- `src/generated/prisma/` est ignoré par git et régénéré au `postinstall` : aucun fichier suivi n'en dépend.
- `docs/analyse-projet.md` mentionne 14.2.5 : c'est un état des lieux daté, laissé tel quel.
- Effets transitifs attendus : `eslint-config-next` 14.2.35 tire `@typescript-eslint/*` 8.x (au lieu de 7.2) ; `prisma` 7.10 tire `@prisma/studio-core` 0.33 et ses dépendances (d3, visx, elkjs). Les binaires `@next/swc-*` restent en 14.2.33 : c'est la version fixée par Next 14.2.35 lui-même, ne pas « corriger » le lockfile à la main.
- Vérifié sous Node 22.22.0 : `npm run lint` passe (4 avertissements déjà présents : `no-img-element`, `exhaustive-deps`) ; `npm run build` réussit avec 6 `DatabaseNotReachable` attendus sans `DATABASE_URL` ; `next start` : `/` et `/auth/connexion` en 200, `/dashboard`, `/dashboard/admin`, `/dashboard/artiste` redirigés vers la connexion (307), `/galerie` en 500 faute de base locale uniquement.
- Retour arrière : revert du commit (ou redéploiement de la version Vercel précédente) ; aucune migration ni donnée touchée.

## Review Triage Log

- Plancher `engines` 22.12 vs `eslint-visitor-keys` (`^22.13`) — low : vrai, mais dépendance de lint seulement, simple avertissement `EBADENGINE` sur 22.12.x exactement ; rejeté (valeur fixée par la décision du porteur).
- `>=22.12` sans borne haute, Vercel préfère `engines` au réglage du projet — medium : vrai ; changer la plage contredit la décision du porteur → différé (deferred-work) et signalé dans la PR.
- Pas de `.nvmrc` — low : hors périmètre (story 1.3 fixera Node 24 en CI) ; rejeté.
- Montée de `@typescript-eslint` 7 → 8 — low : effet transitif, lint repassé ; consigné dans les notes.
- Churn du lockfile via `prisma` (studio-core) / `prisma` en `dependencies` — low : transitif et préexistant ; rejeté.
- `@next/swc-*` en 14.2.33 — false : version fixée par `next@14.2.35` ; consigné dans les notes.
- Pas de trace de vérification ni de retour arrière — low : ajoutés aux notes et à la PR.
- Texte pour le porteur absent — false : il va dans la PR, créée après le commit.
- Écart `@types/node` spec/code — low : spec corrigée. Autres remarques de tenue (`context`, `generated`, `analyse-projet.md`) — rejetées, cosmétiques.
- Décisions non sourcées dans `epic-1-context.md` — false : toutes viennent d'`ARCHITECTURE-SPINE.md`, document BMAD validé (AR-1 à AR-7).
