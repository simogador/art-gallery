---
title: 'Story 1.4 — Historique des migrations aligné sur la base réelle'
type: 'chore'
created: '2026-10-27'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `Order` et `Artist.userId` existent dans `schema.prisma` (et en production) mais dans aucune migration : appliquer l'historique à une base vide ne redonne pas le schéma, et aucune future migration de données ne peut être appliquée ni annulée sans surprise (AR-2, AD-20).

**Approach:** Une migration de ligne de base, générée par `prisma migrate diff` entre les migrations existantes et le schéma, crée ce qui manque ; la procédure pour la déclarer appliquée en production (`prisma migrate resolve --applied`, avec contrôle préalable en lecture seule) est décrite pour le porteur. Un job CI applique toutes les migrations sur un PostgreSQL vide puis échoue si `prisma migrate diff` trouve un écart. `prisma migrate deploy` en production n'a qu'un seul point documenté (commande du porteur), jamais le build Vercel ; `db push` est proscrit sur une base partagée (AGENTS.md mis à jour). Le porteur exécute lui-même toute commande sur la production.

</frozen-after-approval>

## Implementation Notes

- `prisma/migrations/20261027150000_ligne_de_base/migration.sql` : généré par `prisma migrate diff --from-config-datasource --to-schema` sur une base où seules les deux migrations existantes étaient appliquées. Il crée aussi `Artist.active`, absent de l'historique (non cité par la story, même cause).
- Vérifié sur PostgreSQL 16 local : base vide + 3 migrations → `migrate diff --exit-code` = 0 (« No difference detected ») ; sans la ligne de base → code 2. C'est ce que fait le job CI « Migrations » (service `postgres:16`, identifiants jetables, aucun secret).
- `docs/migrations.md` : règles, procédure de déclaration en production (point de restauration Neon, contrôle en lecture seule, `migrate status`, `migrate resolve --applied`), procédure des futures migrations.
- `package.json` : `db:push` remplacé par `db:migrate` (vérification anti-production puis `migrate deploy` sur sa propre base) ; README et AGENTS.md alignés.
- Les stories 1.2 et 1.3 restent en `review` : leur passage à `done` attend les réglages du porteur (Neon/Vercel, protection de `main`).
- En attente du porteur avant `done` : déclarer la ligne de base appliquée en production (et sur la branche `preview` si elle existe déjà), selon `docs/migrations.md`.

## Review Triage Log

- Bases locales créées par `db push` (P3005) — low : vrai ; procédure de recréation ajoutée.
- Branche `preview` jamais migrée — medium : vrai ; déclaration de la ligne de base et `migrate deploy` sur `preview` ajoutés à la procédure.
- Chaîne directe Neon (sans pooler) non demandée — medium : vrai ; précisé.
- `migrate dev --create-only` sans base fantôme — low : vrai ; création contre un PostgreSQL local.
- Retour arrière vague et restauration risquée — medium : vrai ; SQL exact, restauration de branche déconseillée.
- Cas sans `_prisma_migrations` sous-spécifié — low : vrai ; commandes et ordre donnés.
- Index redondant `Order_stripeSessionId_idx` — low : vrai mais doit rester pour coller à la production ; différé (deferred-work).
- Pas de vérification ni de statut à jour — low : notes de vérification présentes ; story passée en `review`.
- En-tête de `ci.yml` obsolète — low : corrigé.
- Apostrophe typographique dans AGENTS.md — low : corrigée.
