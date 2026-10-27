---
title: 'Story 1.8 — Rôle toujours à jour, sans reconnexion'
type: 'feature'
created: '2026-10-27'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le rôle est lu dans le jeton de session : après un changement de rôle par un admin, l'utilisateur garde l'ancien jusqu'à sa reconnexion — un artiste promu n'accède pas à son espace, un accès retiré reste ouvert (AR-7, AD-15, FR-34).

**Approach:** Créer le module `acces` (`src/lib/acces/`) qui relit le rôle en base et renvoie un acteur typé (`visiteur`, `user`, `artist` avec son artiste, `admin`). Le middleware ne vérifie plus que la session sur `/dashboard/**` et ne compare plus aucun rôle ; les layouts `/dashboard/artiste` et `/dashboard/admin` redirigent à partir du rôle relu. La maintenance et le passage des admins se comportent comme avant. Tests des deux cas (promu → accès au rechargement ; rôle retiré → refus au rechargement) ; le piège d'AGENTS.md est mis à jour.

</frozen-after-approval>

## Implementation Notes

- `src/lib/acces/acteur.ts` : `acteurDepuis()` (pure ; rôle inconnu → `user`). `src/lib/acces/index.ts` : `acteurCourant()` = identité de la session + rôle relu en base (`select` minimal : id, rôle, artiste lié) ; compte supprimé → `visiteur`.
- Toutes les décisions d'accès lues dans le jeton passent par `acces`, pas seulement les deux layouts : 6 pages admin, les 4 pages de l'espace artiste (un layout n'est pas réexécuté lors d'une navigation interne), le tableau de bord (compte supprimé → connexion), et les routes `api/admin/*` et `api/artiste/*` (sinon un artiste rétrogradé gardait l'API).
- `api/upload` : ne vérifiait que la session — tout utilisateur connecté pouvait remplacer l'image de n'importe quelle œuvre. Désormais réservé à l'admin et à l'artiste propriétaire de l'œuvre.
- `src/lib/prisma.ts` : gestionnaire `error` sur le pool `pg` (journalise le seul code). Sans lui, une connexion inactive coupée par le serveur (veille de Neon) émettait une erreur non gérée ; constaté en test à la suppression de la base jetable. `artiste/layout.tsx` n'importe plus Prisma : retiré de `eslint/exceptions-prisma.cjs` (23 → 22).
- `src/middleware.ts` : contrôles de rôle sur `/dashboard/admin` et `/dashboard/artiste` supprimés. Le passage des admins pendant la maintenance garde le rôle du jeton : le middleware tourne en edge, sans base (« comme avant »).
- `/dashboard/artiste` est réservé au rôle `artist`, comme le layout le faisait déjà ; le middleware laissait passer l'admin jusqu'au layout, qui le renvoyait. Résultat identique pour l'admin, désormais décidé par le seul layout.
- `tests/acces.test.ts` (9 tests) : `acteurDepuis` ; sur base jetable, avec un jeton figé à `user` : layout artiste et layout admin ouverts puis refermés selon le rôle en base, page artiste qui vérifie elle-même, route API artiste ouverte puis refermée, upload réservé au propriétaire ou à l'admin, compte supprimé → visiteur.
- AGENTS.md : « Where things are » (middleware, `acces`) et piège du JWT réécrit.
- Vérifié : 34 tests, `tsc --noEmit`, `npx eslint .`, liste d'exceptions (22), `npm run build`.
- Les stories 1.2 à 1.7 restent en `review` (réglages du porteur non confirmés).

## Review Triage Log

- Pages de l'espace artiste sans contrôle de rôle (layout non réexécuté en navigation interne) — high : vrai ; contrôle dans chaque page, testé.
- `api/upload` sans contrôle de rôle ni de propriété — high : vrai (préexistant, mais c'est l'objet de la story) ; corrigé et testé.
- Admin rétrogradé qui contourne encore la maintenance — low : vrai (préexistant, middleware en edge sans base) ; consigné dans AGENTS.md ; rejeté pour le reste.
- Double lecture dans les routes artiste, pas de `cache()` — low : efficacité seulement ; rejeté.
- Tableau de bord affichant « visiteur » pour un compte supprimé — low : vrai ; redirection vers la connexion.
- Tests trop faibles (API non ouverte avant, admin non rétrogradé) — low : vrai ; complétés.
- Aucune règle n'empêche `session.user.role` — low : règle écrite dans AGENTS.md ; règle ESLint jugée disproportionnée ; rejeté.
- Statut de suivi — low : passé en `review`.
- Description de l'ancien comportement de `/dashboard/artiste` pour l'admin — low : vrai ; note précisée.
