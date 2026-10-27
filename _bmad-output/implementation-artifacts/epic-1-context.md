# Epic 1 Context: Un site sûr, vérifié et prêt à recevoir des contacts

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Donner au porteur un socle sûr avant tout travail fonctionnel : une pile corrigée (Next.js 14.2.35, Node 24 LTS), des préversions qui n'écrivent jamais en production, une PR qui ne peut être fusionnée sans lint, build et tests sur un vrai PostgreSQL, un historique de migrations aligné sur la base réelle, un accès à Prisma limité aux modules métier, un chemin d'achat actuel fermé derrière l'interrupteur du Lot 2, un rôle relu en base sans reconnexion, et une page de maintenance qui enregistre réellement les contacts. Chaque changement reste vérifiable en préversion et réversible.

## Stories

- Story 1.1: Correctifs de sécurité et Node 24
- Story 1.2: Préversions isolées de la base de production
- Story 1.3: Intégration continue : lint et build à chaque PR
- Story 1.4: Historique des migrations aligné sur la base réelle
- Story 1.5: Tests automatisés sur un vrai PostgreSQL
- Story 1.6: Accès à la base réservé aux modules métier
- Story 1.7: Interrupteur du Lot 2 et fermeture du chemin d'achat actuel
- Story 1.8: Rôle toujours à jour, sans reconnexion
- Story 1.9: Contacts de la page de maintenance enregistrés

## Requirements & Constraints

- Sécurité : Next.js à jour, contrôle d'accès par rôle côté serveur sur toutes les actions, secrets hors du dépôt (`.env.local` et variables Vercel uniquement).
- Migration progressive : pas de changement de pile, chaque étape réversible, fonctions critiques opérationnelles à chaque déploiement.
- Fiabilité de la vente : l'outillage (tests sur vraie base, transactions concurrentes réelles) doit permettre de prouver plus tard l'absence de double vente.
- Données personnelles : collecte minimale, consentement explicite, aucun e-mail ni jeton dans les journaux ; limitation des envois de formulaires publics par IP et par e-mail.
- La maintenance (`MAINTENANCE_MODE`) et `public/robots.txt` sont pilotés par le porteur uniquement ; les réglages Vercel et Neon sont décrits au porteur, jamais modifiés par le code ou l'agent.
- Vérification : `npm run lint` puis `npm run build` avant chaque push ; sans `DATABASE_URL`, les `DatabaseNotReachable` au build ne sont pas un échec.

## Technical Decisions

- Pile conservée : Next.js 14 App Router (14.2.5 → 14.2.35 maintenant ; 16.x seulement dans l'epic 5), React 18.3, ESLint 8 via `next lint`, TypeScript 5 strict, NextAuth 5 beta, Prisma + `@prisma/adapter-pg` sur Neon.
- Node 24 LTS (minimum 22.12) déclaré dans `engines.node` et dans le réglage Node du projet Vercel ; `@types/node` 24.
- Dépendances épinglées, jamais `@latest` (le tag `latest` de Prisma peut pointer sur une version candidate) ; Prisma en `~7.10`.
- Modules métier `src/lib/<module>/` avec API publique dans `index.ts` ; seuls ces modules et `src/auth.ts` importent Prisma (règle ESLint `no-restricted-imports`, liste d'exceptions qui ne fait que diminuer).
- Migrations : une ligne de base d'abord (`Order`, `Artist.userId`), `prisma migrate deploy` à un seul endroit explicite, jamais dans le build Vercel ni par `db push` sur une base partagée.
- Tests : Vitest 5 sur base PostgreSQL jetable migrée par les migrations du dépôt ; GitHub Actions lance `eslint .`, `npm run build` et les tests sous Node 24.
- Réglages métier lus par une seule fonction du module `reglages` (interrupteur du Lot 2 via variable Vercel, fermé par défaut).
- Rôle relu en base par le module `acces` ; le middleware ne vérifie plus que la session sur `/dashboard/**`.
- Fonctions de module : résultats `{ ok, code }` pour les refus attendus.

## Cross-Story Dependencies

- 1.1 précède tout : la CI (1.3) installe sous Node 24 et la pile corrigée sert de base aux autres stories.
- 1.3 (CI) est prérequis de 1.4 (job de diff des migrations) et 1.5 (tests en CI) ; 1.5 est prérequis des tests de 1.7 et 1.8.
- 1.2 doit être faite avant la première story qui écrit en base depuis une préversion.
- L'epic 5 (Next.js 16) suppose 1.1 livrée ; l'e-mail d'ouverture aux inscrits de 1.9 est envoyé en epic 4.
