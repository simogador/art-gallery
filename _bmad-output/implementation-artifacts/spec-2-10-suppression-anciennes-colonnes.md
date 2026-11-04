---
title: 'Story 2.10 — Suppression des anciennes colonnes'
type: 'refactor'
created: '2026-11-04'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md', '{project-root}/docs/migrations.md', '{project-root}/_bmad-output/implementation-artifacts/spec-2-9-catalogue-reel.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `Artwork.available` (Boolean), `Artwork.price` (Float) et `Artwork.dimensions` (texte) sont encore écrits en double (`champsPrix`, `champsDimensions`, `champAvailable`) et lus pour préremplir le formulaire d'édition. Tant qu'elles existent, du code futur peut relire un prix approximatif ou un état ambigu (AD-20, temps 4 ; AD-6).

**Approach:**
- Le code cesse de lire et d'écrire les trois colonnes ; elles disparaissent de `schema.prisma`.
- Deux migrations, pour qu'aucun code déployé ne casse :
  - **A** (`…_anciennes_colonnes_facultatives`) : `dimensions` devient facultative (`DROP NOT NULL`). Sans effet sur l'ancien code, qui l'écrit toujours ; permet au nouveau code de créer une œuvre sans elle. Appliquée par le porteur **avant la fusion** (preview puis production).
  - **B** (`…_suppression_anciennes_colonnes`) : `DROP COLUMN` des trois colonnes. Appliquée par le porteur **après le déploiement de production** du nouveau code, qui ne les lit plus. Irréversible : au-delà, seul le retour à la branche de sauvegarde ramène les colonnes.
- Avant B, sur la production : requêtes de contrôle en lecture seule (`dimensions-illisibles.sql`, `prix-non-recopies.sql`, `ecarts-prix-dimensions.sql`, `ecarts-publication-disponibilite.sql`) ; la sauvegarde datée est vérifiée restaurable juste avant (AQ-4).
- Les scripts SQL de recopie, d'écarts et de correction des stories 2.1 et 2.2 sont supprimés **dans une PR de suivi**, après B ; d'ici là ils restent nécessaires aux contrôles.

## Boundaries & Constraints

**Always:** l'agent fournit le SQL exact de chaque migration, avec la ligne `_prisma_migrations` et l'empreinte SHA-256 ; les types d'affichage (`lib/types` `Artwork.price`, `size`, `CartItem.price`) restent ; textes en français.

**Never:** appliquer une migration soi-même, en CI ou dans le build ; supprimer des données autres que ces colonnes ; toucher `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`, les secrets, les réglages Vercel/Neon.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Dépôt | artiste crée un brouillon, base après A (colonnes encore là) | œuvre créée sans écrire les anciennes colonnes | — |
| Édition | œuvre sans dimensions en mm | formulaire vide sur les dimensions (plus de préremplissage par l'ancien texte) | — |
| Admin / webhook | bascule de disponibilité, paiement | seuls `publication`/`disponibilite` changent | — |
| Retour arrière avant B | code précédent redéployé sur base après A | fonctionne (il écrit encore les colonnes) | — |
| Base migrée A+B | toutes les migrations sur base vide | `prisma migrate diff` sans écart | CI « Migrations » |

</frozen-after-approval>

## Open Questions

1. **Période de vérification** (AC de l'epic : « depuis la période convenue avec le porteur », jamais fixée) : 2.1 est en production depuis le 2026-10-29, 2.2 depuis le 2026-10-30. Options : *suffisante* (on supprime dès la fin de cette story) / *attendre une date* (A et le code peuvent partir, B attend cette date).
2. **Dimensions illisibles** : si `dimensions-illisibles.sql` liste en production des œuvres sans millimètres, leur texte disparaît avec B. Options : *œuvres réelles complétées à la main avant B, perte acceptée pour la démonstration* (recommandé) / *bloquer B tant que la liste n'est pas vide*.
3. **Contraintes `CHECK`** reportées par la 2.1 « avec la story 2.10 » (`prixCentimes > 0`, millimètres ≥ 1, devise de trois lettres) : *à part* (recommandé : risque de refus sur des données de démonstration, story suivante) / *dans cette story* (requête de contrôle préalable, migration A).
4. **Données de démonstration** (« story 2.10 ou à part », décision du 2026-11-04) : *à part* (recommandé : suppression irréversible, droits Cloudinary à confirmer) / *dans cette story*.

## Code Map

- `prisma/schema.prisma:44,47,55` -- `dimensions String`, `price Float?`, `available Boolean @default(true)` ; commentaires « jusqu'à la story 2.10 » (:48-49, :56-58) à mettre à jour.
- `src/lib/catalogue/conversions.ts:114-181` -- `ChampsPrix`, `ChampsDimensions`, `champsPrix`, `champsDimensions`, `champsDimensionsExactes`, `champsDimensionsModifiees` (compare à l'ancien texte) : ne plus produire `price`/`dimensions`.
- `src/lib/disponibilite/etats.ts:124-130` (`champAvailable`) et `disponibilite/index.ts:26-65,104,128,213,257` (types de retour, `marquerVendues`, commentaire de `lireEtatVerrouille`) : retirer `available`.
- Appelants : `curation/index.ts:84`, `curation/file.ts:153,185`, `curation/depot.ts:151-164,226-245,368`, `curation/remise-en-vente.ts:39`.
- Lectures : `catalogue/espace-artiste.ts:140-174` (`versOeuvreAEditer`, `CHAMPS_EDITION`), `app/api/admin/oeuvres/[slug]/route.ts:36-47`, `app/api/artiste/oeuvres/[slug]/route.ts:12-67`, `app/dashboard/admin/oeuvres/[slug]/page.tsx:30`. Les clés de corps `available`/`price`/`dimensions` (`ToggleAction`, `ArtworkForm`) ne sont pas des colonnes : à garder.
- Tests : `disponibilite`, `catalogue`, `depot`, `curation`, `disponibilite-artiste`, `catalogue-reel`, `lot2` ; INSERT bruts avec `dimensions` dans `acces`, `invitations`, `livraison` ; les tests des scripts SQL 2.1/2.2 (`catalogue.test.ts:23-26,191-252`, `disponibilite.test.ts:187-241`) sont retirés avec la colonne.
- `docs/migrations.md` -- nouvelle section 2.10 (ordre inversé : A avant fusion, B après déploiement), journal des bases partagées ; `AGENTS.md` -- puces « Prix et dimensions » et « Publication et disponibilité ».

## Tasks & Acceptance

**Execution:**
- [ ] `prisma/schema.prisma`, `prisma/migrations/<A>`, `prisma/migrations/<B>` -- retrait des colonnes, deux migrations générées (`migrate dev --create-only`), A réduite au `DROP NOT NULL`.
- [ ] `src/lib/catalogue/*`, `src/lib/disponibilite/*`, `src/lib/curation/*`, routes et pages listées -- plus aucune lecture ni écriture des trois colonnes.
- [ ] `tests/*` -- mise à jour ; test qui échoue si `src/` (hors `src/generated`) nomme `available`, `price` ou `dimensions` comme colonne d'`Artwork` dans une requête Prisma.
- [ ] `docs/migrations.md`, `AGENTS.md` -- procédure 2.10 (SQL exact, empreintes, contrôles avant B, retour arrière), règles mises à jour.

**Acceptance Criteria:**
- Given le dépôt, when on lance les migrations sur une base vide, then le schéma n'a plus `available`, `price`, `dimensions` et `prisma migrate diff` ne trouve aucun écart.
- Given la base après A seulement, when le code de la PR tourne (préversion), then dépôt, édition, curation, bascules admin et webhook fonctionnent.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npx eslint .` -- aucune erreur
- `node scripts/verifier-exceptions-prisma.cjs origin/main` -- aucun ajout
- `npm test` -- tous verts
- `npm run build` -- réussi

**Manual checks:**
- Préversion (base `preview` après A) : dépôt d'une œuvre par Kara Walker, édition, curation.
- Production après B : `npx prisma migrate status` à jour ; accueil, galerie, espace artiste sans erreur.
