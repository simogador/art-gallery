---
title: 'Story 1.2 — Préversions isolées de la base de production'
type: 'feature'
created: '2026-10-27'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Rien n'empêche une préversion Vercel ou un poste local d'écrire dans la base Neon de production (AD-22, AQ-3) : un test en préversion peut modifier ou bloquer une vraie œuvre ou une vraie commande.

**Approach:** Une vérification au démarrage du client Prisma compare l'identifiant de la base visée (endpoint Neon tiré de l'hôte de `DATABASE_URL`) à une variable d'identification de la base de production ; hors production (`VERCEL_ENV` ≠ `production`), si elles correspondent, toute écriture est refusée par le client (lectures inchangées), sans jamais journaliser l'URL. Le seed applique la même règle. La PR décrit au porteur : le constat à faire sur la base des préversions, la création d'une branche Neon dédiée, le réglage de `DATABASE_URL` pour « Preview » et de la variable d'identification ; le README décrit le travail local sur sa propre base ou branche. Inclut le passage de la story 1.1 à `done` dans `sprint-status.yaml` (décision du porteur). Ne touche ni `MAINTENANCE_MODE`, ni `robots.txt`, ni `src/generated/prisma/`, ni aucun secret, ni les réglages Vercel/Neon.

</frozen-after-approval>

## Implementation Notes

- Variable d'identification : `DATABASE_PRODUCTION_ID` = identifiant d'endpoint Neon de la production (`ep-…`, visible dans la console Neon, ce n'est pas un secret). L'identifiant courant est le premier segment de l'hôte de `DATABASE_URL`, sans le suffixe `-pooler`.
- Variable absente : avertissement unique sans URL, écritures autorisées (le garde s'active quand le porteur pose la variable, pour ne pas casser les préversions avant le réglage). Choix noté dans la PR.
- Fichiers : `src/lib/garde-production.ts` (nouveau : `identifiantBase`, `ecritureInterdite`, `interdireEcritures`, `EcritureProductionInterdite`), `src/lib/prisma.ts` (client restreint si interdit), `prisma/seed.ts` (arrêt si interdit), `scripts/verifier-base.ts` + scripts npm `db:push` et `db:seed` (le CLI Prisma n'utilise pas le client applicatif), `README.md` (section « Base de données en local »).
- Le SQL brut (`$queryRaw`, `$executeRaw`…) est aussi refusé : on ne peut pas savoir s'il écrit ; aucun usage actuel.
- Effet voulu dans une préversion qui viserait encore la production : inscription, connexion OAuth avec création de compte, éditions artiste/admin, upload, checkout et webhook Stripe échouent avec `EcritureProductionInterdite`.
- Vérifié : cas du garde (préversion/local visant la prod → interdit ; production, autre branche, variable absente → autorisé ; identifiant saisi avec majuscules, `-pooler` ou hôte complet → reconnu) ; écriture refusée avant tout accès réseau, lecture transmise ; `scripts/verifier-base.ts` sort en 1 / 0 ; `npm run lint`, `tsc --noEmit` et `npm run build` passent (6 `DatabaseNotReachable` attendus).
- `epic-1-context.md` : ligne Node réalignée sur `engines.node` `24.x` (décision du porteur consignée dans `docs/decisions-porteur.md`), car `epics.md` et le spine avaient changé depuis la compilation.

## Review Triage Log

- CLI Prisma (`db push`) non protégé alors que le README le conseille — medium : vrai ; corrigé par `scripts/verifier-base.ts` et les scripts `db:push` / `db:seed`.
- `$queryRaw` compté comme écriture — low : vrai ; gardé (le SQL brut peut écrire, aucun usage), README précisé.
- `DATABASE_PRODUCTION_ID` non normalisé — medium : vrai (garde silencieusement inactif) ; même normalisation appliquée.
- Mode inactif sans variable peu visible — low : README le dit explicitement, la PR aussi.
- Effets de bord dans une préversion visant la prod non documentés — low : ajoutés aux notes et à la PR.
- Pas de critères ni vérifications dans la spec — low : vérifications ajoutées aux notes et à la PR.
- Modification d'`epic-1-context.md` hors périmètre — false : recompilation exigée par le workflow, alignée sur `docs/decisions-porteur.md`.
- `garde-production.ts` hors d'un module `src/lib/<module>/`, pas de règle ESLint — low : c'est de l'infrastructure à côté de `prisma.ts`, et la règle d'import est la story 1.6 ; rejeté.
