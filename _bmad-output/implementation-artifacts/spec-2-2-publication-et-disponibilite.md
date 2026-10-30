---
title: 'Story 2.2 — Publication et disponibilité, deux états distincts'
type: 'feature'
created: '2026-10-30'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md', '{project-root}/docs/migrations.md', '{project-root}/_bmad-output/implementation-artifacts/spec-2-1-prix-et-dimensions-exacts.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un seul booléen, `Artwork.available`, mélange aujourd'hui deux choses : la mise en ligne (curation) et la vente. Les écrans le lisent chacun à leur façon (AD-6, AD-7, AR-10).

**Approach:** Temps 1 à 3 d'AD-20, comme pour la story 2.1.
- **Deux colonnes facultatives** : `publication` (`brouillon`, `en_curation`, `publiee`) et `disponibilite` (`disponible`, `reservee`, `vendue`, `vendue_ailleurs`, `retiree`), en énumérations PostgreSQL.
- **Recopie SQL idempotente** : `available = true` donne `publiee` + `disponible`, `false` donne `publiee` + `vendue`.
- **Qui écrit quoi** : la disponibilité n'est écrite que par le module `disponibilite`, la publication que par le module `curation`.
- **Définition unique** : `disponibilite` exporte celle de « visible » (`publiee` et non `retiree`) et celle de « disponible » (`publiee` et `disponible`), chacune sous forme de prédicat et de fragment de requête Prisma. Catalogue, espace artiste, administration et paiement l'utilisent, et aucun autre fichier ne lit les colonnes brutes.
- **Pages publiques** : elles ne montrent que les œuvres visibles. L'URL d'une œuvre `retiree` redirige en 301 vers la page de son artiste, et une œuvre non publiée renvoie une 404.
- **Double écriture** : `available` reste écrit, égal à « disponible », pour que le retour au commit précédent reste possible.
- **Nouvelle œuvre d'un artiste** : elle naît en `brouillon` + `disponible`. Un admin la publie depuis l'administration, en attendant la curation complète (story 2.7). La règle d'accord signé (FR-16) viendra avec les stories 2.4 et 2.7, car aucune donnée ne le porte encore.
- Le porteur applique le SQL depuis l'éditeur de Neon : branche de sauvegarde, `preview`, puis production avant la fusion (`docs/migrations.md`).

## Boundaries & Constraints

**Always :**
- Nouvelles colonnes facultatives, sans valeur par défaut, pour que l'ancien code insère sans elles. Une œuvre dont les colonnes sont vides n'est ni visible ni disponible.
- Une seule définition de « visible » et de « disponible ».
- Écritures uniquement via `disponibilite` et `curation`.
- Migration commitée, générée contre un PostgreSQL local.
- Requête d'écarts à lancer après la fusion, comme pour la story 2.1.

**Never :**
- Supprimer `available` (story 2.10).
- Réservation ou expiration (epic 6).
- Déclaration « vendue ailleurs » ou « retirée » par l'artiste (story 2.8).
- File de curation (story 2.7).
- Toucher à `MAINTENANCE_MODE`, `robots.txt`, `src/generated/prisma/` ou un secret.
- Appliquer une migration sur une base partagée.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Recopie disponible | `available` true | `publiee` + `disponible` | N/A |
| Recopie vendue | `available` false | `publiee` + `vendue` | N/A |
| Recopie rejouée | script lancé deux fois | même résultat, aucune valeur présente écrasée | N/A |
| Galerie | œuvres `publiee`/`disponible`, `publiee`/`vendue`, `brouillon`, `publiee`/`retiree`, colonnes vides | seules les deux premières listées, la vendue marquée vendue | N/A |
| Fiche retirée | URL d'une œuvre `retiree` | 301 vers `/artistes/<slug de l'artiste>` | N/A |
| Fiche non publiée | `brouillon` ou `en_curation` | 404 | N/A |
| Paiement | œuvre `publiee` mais `vendue`, `reservee` ou `retiree` | refusé : « n'est plus disponible » | 400 |
| Webhook payé | session avec slugs | `disponibilite` = `vendue` et `available` = false, idempotent | N/A |
| Création artiste | nouvelle œuvre | `brouillon` + `disponible`, absente du catalogue | N/A |
| Publication admin | admin publie ou retire la publication | `publiee` ou `brouillon` ; refusé hors admin | 403 |
| Disponibilité admin | bascule « Disponible / Vendue » | `disponible` ou `vendue`, `available` cohérent | 403 hors admin |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` (`model Artwork`) -- enums `Publication` et `Disponibilite` (valeurs ci-dessus), colonnes `publication Publication?` et `disponibilite Disponibilite?`, avec un index sur les deux.
- `src/lib/catalogue/{artworks,artists,exhibitions,mappers,espace-artiste}.ts` -- filtrent ou lisent `available`.
  - `mapArtwork` calcule `sold: !w.available`.
  - `espace-artiste.ts` calcule le chiffre d'affaires sur `available: false`.
  - Remplacer par le fragment et le prédicat de `disponibilite` ; l'UI garde son booléen `sold`, égal à « non disponible ».
- `src/app/galerie/[id]/page.tsx` -- `getArtworkBySlug` puis `notFound()`. Ajouter un cas « retirée » qui redirige en 301 (`permanentRedirect` de Next) vers l'artiste.
- `src/app/api/checkout/route.ts` -- `if (!artwork.available)` devient le prédicat « disponible ».
- `src/app/api/webhooks/stripe/route.ts` -- deux `updateMany({ data: { available: false } })` (lignes 49 et 101) à remplacer par une fonction de `disponibilite` qui écrit `vendue` et `available` = false.
- `src/app/api/admin/oeuvres/[slug]/route.ts` -- `body.available` passe par `disponibilite`. Ajouter `body.publiee` (booléen), qui passe par `curation`.
- `src/app/api/artiste/oeuvres/route.ts` -- création : `brouillon` + `disponible`, via `curation` et `disponibilite`.
- Administration :
  - `src/app/dashboard/admin/page.tsx` : comptages ;
  - `src/app/dashboard/admin/oeuvres/page.tsx` et `[slug]/page.tsx` : `ToggleAction` sur `available` ; ajouter une bascule « Publiée / Brouillon ».
- Espace artiste : `src/app/dashboard/artiste/page.tsx`, `oeuvres/page.tsx`, `oeuvres/[slug]/page.tsx` -- badge « Disponible / Vendue ». Le remplacer par un libellé calculé par `disponibilite` (Brouillon, En curation, Disponible, Réservée, Vendue, Vendue ailleurs, Retirée).
- `src/components/dashboard/ToggleAction.tsx` -- générique (champ booléen), à réutiliser tel quel.
- `.eslintrc.js` -- `MODULES_METIER` contient déjà `curation` et `disponibilite`. `eslint/exceptions-prisma.cjs` : la liste ne doit pas grossir.
- `prisma/seed.ts` -- remplir les deux colonnes.
- Story 2.1 (`spec-2-1-prix-et-dimensions-exacts.md`) -- modèles à reprendre :
  - les scripts `scripts/sql/*.sql` : recopie, contrôle, écarts ;
  - la procédure de `docs/migrations.md` ;
  - les tests sur base jetable de `tests/catalogue.test.ts`.

## Tasks & Acceptance

**Execution:**
- [ ] `prisma/schema.prisma` + `prisma/migrations/<horodatage>_publication_disponibilite/` -- enums, colonnes et index, migration générée sans écart -- temps 1.
- [ ] `src/lib/disponibilite/index.ts` -- fragments `VISIBLE` et `DISPONIBLE`, prédicats `estVisible` et `estDisponible`, `libelleEtat`. Écritures : `marquerVendues(slugs)`, `definirDisponibilite(acteur, slug, disponible)`, `disponibiliteInitiale()`. Toujours en double écriture avec `available` -- module unique de la disponibilité.
- [ ] `src/lib/curation/index.ts` -- `publicationInitiale()` (brouillon) et `definirPublication(acteur, slug, publiee)`, réservée aux admins.
- [ ] Lectures : catalogue public, espace artiste, administration, paiement -- passent par `disponibilite` -- temps 3.
- [ ] Écritures : webhook, routes admin et artiste -- passent par les modules.
- [ ] `src/app/galerie/[id]/page.tsx` -- 301 si retirée, 404 si non publiée.
- [ ] Administration -- bascule de publication, et comptages via le module.
- [ ] `scripts/sql/recopie-publication-disponibilite.sql`, `scripts/sql/ecarts-publication-disponibilite.sql` -- temps 2.
- [ ] `prisma/seed.ts` -- remplir les colonnes.
- [ ] `tests/disponibilite.test.ts` -- matrice I/O sur base jetable : recopie lancée deux fois, galerie, 301, 404, paiement, webhook, création, droits admin, requête d'écarts.
- [ ] `docs/migrations.md` (story 2.2) et `AGENTS.md` (où lire la publication et la disponibilité).

**Acceptance Criteria:**
- Given la migration et la recopie appliquées, when on parcourt la galerie, une fiche, l'espace artiste ou l'administration, then publication et disponibilité viennent des nouvelles colonnes, via le module `disponibilite`.
- Given la base migrée, when on revient au commit précédent, then le site fonctionne : `available` reste cohérent.
- Given une recherche dans `src/`, then aucune lecture ni écriture de `publication`/`disponibilite` hors de `src/lib/disponibilite`, `src/lib/curation` et des tests.

## Design Notes

- La bascule admin « Disponible / Vendue » garde son libellé et écrit `disponible` ou `vendue`. Les autres états (`reservee`, `vendue_ailleurs`, `retiree`) n'ont pas encore d'écran.
- Un `reservee` ou un `retiree` n'est pas « disponible » : il apparaît comme vendu dans l'UI tant qu'aucun écran ne le distingue (epic 3).

## Verification

**Commands:**
- `npx eslint .` ; `node scripts/verifier-exceptions-prisma.cjs origin/main` -- expected : OK, la liste ne grossit pas.
- `npx tsc --noEmit` ; `npm test` -- expected : tout passe.
- Migrations appliquées sur une base vide, puis `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` -- expected : aucun écart.
- `npm run build` -- expected : succès.

## Implementation Notes

## Spec Change Log

## Review Triage Log
