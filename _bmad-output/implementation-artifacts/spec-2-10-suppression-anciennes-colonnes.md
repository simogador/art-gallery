---
title: 'Story 2.10 — Suppression des anciennes colonnes'
type: 'refactor'
created: '2026-11-04'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 1
baseline_commit: 'f7e5998d7e1226cfd1db2bd28707b4bf18bb4cc4'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md', '{project-root}/docs/migrations.md', '{project-root}/_bmad-output/implementation-artifacts/spec-2-9-catalogue-reel.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `Artwork.available` (Boolean), `Artwork.price` (Float) et `Artwork.dimensions` (texte) sont encore écrits en double (`champsPrix`, `champsDimensions`, `champAvailable`) et lus pour préremplir le formulaire d'édition. Tant qu'elles existent, du code futur peut relire un prix approximatif ou un état ambigu (AD-20, temps 4 ; AD-6).

**Approach:**
- Le code cesse de lire et d'écrire les trois colonnes ; elles disparaissent de `schema.prisma`.
- Deux migrations, pour qu'aucun code déployé ne casse :
  - **A** (`…_dimensions_par_defaut`) : `dimensions` reçoit la valeur par défaut `''` (`ALTER COLUMN "dimensions" SET DEFAULT ''`), et reste `NOT NULL`. Sans effet sur l'ancien code, qui l'écrit toujours et lit `''` pour les œuvres créées par le nouveau code ; permet au nouveau code de créer une œuvre sans elle. Appliquée par le porteur **avant la fusion** (preview puis production).
  - **B** (`…_suppression_anciennes_colonnes`) : `DROP COLUMN` des trois colonnes. Appliquée par le porteur **après le déploiement de production** du nouveau code, qui ne les lit plus. Irréversible : au-delà, seul le retour à la branche de sauvegarde ramène les colonnes.
- Avant B, sur la production : requêtes de contrôle en lecture seule (`dimensions-illisibles.sql`, `prix-non-recopies.sql`, `ecarts-prix-dimensions.sql`, `ecarts-publication-disponibilite.sql`) ; la sauvegarde datée est vérifiée restaurable juste avant (AQ-4).
- Les scripts SQL de recopie, d'écarts et de correction des stories 2.1 et 2.2 sont supprimés **dans une PR de suivi**, après B ; d'ici là ils restent nécessaires aux contrôles.

**Décisions du porteur (2026-11-04) :**
- Période de vérification suffisante (2.1 en production depuis le 2026-10-29, 2.2 depuis le 2026-10-30) : B est appliquée dès la fin de cette story, après les contrôles.
- Dimensions illisibles : si `dimensions-illisibles.sql` liste des œuvres d'artistes avec accord signé, l'équipe complète leurs millimètres à la main avant B ; la perte du texte est acceptée pour les œuvres de démonstration.
- Contraintes `CHECK` (prix, millimètres, devise) : story à part, hors 2.10.
- Suppression des œuvres et artistes de démonstration : story à part, hors 2.10.
- Migration A = valeur par défaut `''` sur `dimensions` (et non `DROP NOT NULL`), pour que le code précédent fonctionne encore sur les œuvres créées par le nouveau code (relecture 1, décision du porteur).

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

- Migrations générées par `prisma migrate dev --create-only` sur un PostgreSQL 16 local : A `20261104125132_anciennes_colonnes_facultatives` (`ALTER COLUMN "dimensions" DROP NOT NULL`, SHA-256 `a41efb3db6dc0f4369dc28ad3ff751938ad0c8bfad1e2b0981f454633592926a`), générée sur le schéma de départ avec `dimensions String?` ; B `20261104125144_suppression_anciennes_colonnes` (`DROP COLUMN` des trois, SHA-256 `ecf964b04377f1adbb01b83db980d5c948763d27f0fe0ec2528e5e748faa66a4`). SQL exact avec la ligne `_prisma_migrations` dans `docs/migrations.md`.
- `catalogue/conversions` : `ChampsPrix` = `{ prixCentimes, devise }`, `ChampsDimensions` = millimètres seuls ; `champsDimensionsModifiees` (comparaison à l'ancien texte) et `champsDimensionsExactes` supprimés, les deux routes PUT utilisent `champsDimensions`. `disponibilite` : `champAvailable` supprimé ; `disponibiliteInitiale()` et `disponibiliteRemiseEnVente()` ne prennent plus d'argument. `curation/depot` : brouillon créé sans prix ni dimensions, un champ de dimension n'écrit que sa colonne en millimètres, `envoyerEnCuration` ne relit plus l'état (ligne déjà verrouillée par `verrouillerDepot`) ; `OeuvreVerrouillee` réduite à `{ id, slug }`. `OeuvreAEditer` : `dimensionsLues` fusionné dans `dimensions` (formaté depuis les millimètres, vide sinon), `price` depuis `prixCentimes` seulement.
- Tests : `tests/anciennes-colonnes.test.ts` (schéma Prisma sans les trois colonnes ; scan statique de `src/` : clés dans les appels `.artwork.*(…)`, sélections `artwork(s): {…}`, objets constants qu'ils nomment, `data.<colonne>`, SQL brut sur `"Artwork"`, avec témoin ; base « après A » simulée en recréant les trois colonnes : dépôt, édition et bascules admin, webhook ne touchent pas les anciennes colonnes). Tests des scripts SQL 2.1/2.2 (recopie, écarts, correction) retirés ; `vendues-sans-commande.sql` garde son test (il ne lit pas les anciennes colonnes).
- Vérifié : `npx eslint .` (0 erreur), `verifier-exceptions-prisma` (16, aucun ajout), `npm test` (302 verts, PostgreSQL 16 local), `npm run build`, migrations A+B sur base vide puis `prisma migrate diff --exit-code` (« No difference detected »).

## Spec Change Log

- **Relecture 1 (itération 0 → 1), intent_gap tranché par le porteur le 2026-11-04.** Constat : avec A = `DROP NOT NULL`, le nouveau code crée des œuvres à `dimensions` NULL que l'ancien client Prisma (`dimensions String`) et `champsDimensionsModifiees` ne supportent pas : la ligne « Retour arrière avant B » de la matrice était fausse. Amendement : A devient `SET DEFAULT ''` (bloc gelé, décision du porteur). État évité : retour arrière impossible avant B. KEEP (de l'itération 0, diff complet conservé hors dépôt : `/tmp/claude-0/-home-user-art-gallery/a8f1e083-4c70-5ce5-bdbb-952959d3d527/scratchpad/diff-2-10-iteration0.patch`, à reprendre en l'adaptant à A = `SET DEFAULT ''` et aux Design Notes) : découpage du code (`champsPrix`/`champsDimensions` en colonnes exactes seules, suppression de `champAvailable`, `champsDimensionsExactes`, `champsDimensionsModifiees`, `OeuvreVerrouillee = { id, slug }`, un champ de dimension du dépôt n'écrit que sa colonne), test `tests/anciennes-colonnes.test.ts` (énumération Prisma, scan statique avec témoin, base « après A »), section 2.10 de `docs/migrations.md` (SQL exact, empreintes, contrôles avant B dont la requête « artistes avec accord », retour arrière avant et après B), mises à jour d'`AGENTS.md`.

## Review Triage Log

Revue 1 (blind-hunter, edge-case-hunter, verification-gap), sur le code de l'itération 0.

| # | Source | Constat | Verdict | Route |
|---|--------|---------|---------|-------|
| 1 | blind, edge | Retour arrière avant B cassé : après A (`DROP NOT NULL`), le nouveau code crée des œuvres à `dimensions` NULL ; l'ancien client Prisma (`dimensions String`) et `champsDimensionsModifiees` (`texteEnBase.trim()`) ne supportent pas NULL, alors que la matrice gelée exige que le code précédent fonctionne | high — contradiction dans le bloc gelé (A = `DROP NOT NULL` contre « Retour arrière avant B : fonctionne ») | intent_gap |
| 2 | blind, edge | Fusion avant A : chaque nouveau brouillon échoue (NOT NULL), déjà arrivé pour #29 et #32 | high — même cause que 1 (A doit rendre l'insertion sans `dimensions` possible sans casser l'ancien code) | intent_gap (avec 1) |
| 3 | blind | Enregistrer une œuvre aux dimensions partielles efface ses millimètres (formulaire prérempli vide, `champsDimensions('')`) | medium — perte silencieuse ; ne réécrire les dimensions que si le texte saisi diffère du prérempli | à reporter dans la ré-implémentation (KEEP) |
| 4 | verif | La base « après A » des tests recrée `dimensions` nullable à la main au lieu d'exécuter le fichier de A | medium — A pourrait être vide sans échec | à reporter dans la ré-implémentation (KEEP) |
| 5 | blind | Étape 3 de la procédure : la date de référence des écarts est le déploiement de production, pas A ; `updatedAt` n'est qu'un indice | low — doc | à reporter (KEEP) |
| 6 | blind | Avertissement « après B » : ajouter l'« Instant Rollback » de Vercel et les préversions des PR ouvertes non rebasées | low — doc | à reporter (KEEP) |
| 7 | blind, edge | Retour arrière : une œuvre modifiée par le nouveau code garde dans l'ancien formulaire ses anciens prix/dimensions | low — doc (le signaler dans le retour arrière) | à reporter (KEEP) |
| 8 | blind | En-tête de `dimensions-illisibles.sql` et commentaire de `disponibiliteInitiale` périmés | low — correction directe | à reporter (KEEP) |
| 9 | blind, edge | Scan statique : chaînes non ignorées (`'image/*'`), constantes d'autres fichiers, objets construits par les fonctions d'aide | low — heuristique, TypeScript couvre les clés après B ; la portée réelle doit être décrite dans le test et AGENTS.md | defer (AGENTS.md) |
| 10 | blind, verif | Plus aucun test des requêtes de contrôle utilisées avant B | medium (non vérifié) — contrôle manuel unique en lecture seule | defer |
| 11 | blind | Suppression des scripts 2.1/2.2 non suivie | false — entrée déjà ajoutée à `deferred-work.md` | rejet |
| 12 | blind | Statuts spec / sprint-status différents | false — synchronisés à l'étape de présentation | rejet |
| 13 | blind | Tests « après A » sans la route artiste, l'envoi en curation, la curation, les déclarations | low — couverts par TypeScript après B et par les tests existants | rejet |

## Design Notes

Corrections issues de la relecture 1, à intégrer à la ré-implémentation :
- Édition (routes PUT admin et artiste) : ne réécrire les millimètres que si le texte de dimensions reçu diffère du texte prérempli (`formaterDimensions` des millimètres en base) ; sinon une œuvre aux dimensions partielles perd les autres à chaque enregistrement.
- Base « après A » des tests : recréer les colonnes dans l'état de l'init (`dimensions TEXT NOT NULL`), puis exécuter le fichier `migration.sql` de A lu sur le disque ; le dépôt doit alors donner `dimensions = ''`.
- `docs/migrations.md`, section 2.10 : la référence des écarts attendus est l'heure du déploiement de production de la PR (pas l'application de A), `updatedAt` n'est qu'un indice ; après B, ni redéploiement d'un commit antérieur ni « Instant Rollback » de Vercel, et B sur `preview` casse les préversions des PR ouvertes non rebasées ; au retour arrière avant B, une œuvre modifiée par le nouveau code montre dans l'ancien formulaire ses anciens prix et dimensions.
- En-tête de `scripts/sql/dimensions-illisibles.sql` (le formulaire ne préremplit plus l'ancien texte) et commentaire de `disponibiliteInitiale` à mettre à jour.

## Verification

**Commands:**
- `npx eslint .` -- aucune erreur
- `node scripts/verifier-exceptions-prisma.cjs origin/main` -- aucun ajout
- `npm test` -- tous verts
- `npm run build` -- réussi

**Manual checks:**
- Préversion (base `preview` après A) : dépôt d'une œuvre par Kara Walker, édition, curation.
- Production après B : `npx prisma migrate status` à jour ; accueil, galerie, espace artiste sans erreur.
