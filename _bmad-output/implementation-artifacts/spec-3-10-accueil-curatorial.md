---
title: 'Story 3.10 — Accueil curatorial'
type: 'feature'
created: '2026-11-10'
status: 'done'
baseline_commit: '4f2581c2035562dbb33e15d3fe58c2fff9fe14df'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'accueil montre une galerie filtrée côté navigateur, sans la sélection de l'équipe ni les nouveautés ; l'équipe n'a aucun écran pour marquer une œuvre « mise en avant » ; l'en-tête affiche « Panier » alors que le Lot 2 est fermé et n'a ni « Menu » lisible ni retour vers l'écran précédent ; quatre fichiers de l'accueil échappent encore aux règles de textes et d'interface (FR-18, UX-DR20, UX-DR22).

**Approach:**
- L'accueil présente « Sélection de l'équipe » (œuvres marquées) et « Dernières œuvres publiées », en vignettes qui mènent à la fiche, avec un accès « Parcourir la galerie » visible.
- L'équipe marque une œuvre depuis `/dashboard/admin/oeuvres` (action serveur de `curation`).
- L'en-tête montre « Menu » et la marque, un retour « ‹ [écran précédent] » sur les écrans profonds, ni favoris ni « Panier » tant que le Lot 2 est fermé.

## Boundaries & Constraints

**Always:**
- Sélection de l'équipe = le marqueur `Artwork.featured` (déjà affiché « Coup de cœur » sur la fiche) : un seul marqueur, écrit seulement par `src/lib/curation` (admin seulement, œuvre publiée non retirée).
- Les œuvres de l'accueil se lisent par `catalogue` (règles `VISIBLE`) ; « dernières publiées » = les plus récentes par date de dépôt, hors œuvres déjà dans la sélection ; vendues exclues de la sélection et des nouveautés.
- Le choix de l'équipe apparaît sur l'accueil au plus 60 s plus tard (cache du catalogue, accepté en 3.4) ; aucun nouvel événement.
- « Panier » et favoris absents de l'en-tête quand `lot2Ouvert()` est faux (lu côté serveur et passé à l'en-tête) ; le retour « ‹ [écran précédent] » mène à la liste parente (`/galerie`, `/artistes`, `/expositions`), jamais à l'historique du navigateur.
- Le filet or `ornament-rule` est `aria-hidden` ; aucun carrousel ni vidéo qui démarre seul ; vignettes de l'accueil = celles de la galerie (une seule cible).
- Les quatre fichiers listés pour l'accueil (`Hero`, `Gallery`, `Artists`, `Exhibitions`) passent `react/jsx-no-literals` et le scan d'interface, et sortent de `eslint/exceptions-textes.cjs` et `tests/exceptions-interface.cjs` (ou disparaissent) ; aucun texte qui promette certificat, assurance ou installation.
- Les sections « Artistes » et « Expositions » de l'accueil restent, masquées si vides.

**Never:**
- Défilement automatique, nouvelle bibliothèque, migration, nouvel événement.
- Toucher à la galerie, à la fiche, au Footer, à `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Accueil | œuvres marquées et récentes | deux sections de vignettes vers les fiches, « Parcourir la galerie » | — |
| Aucune œuvre marquée | `featured` partout faux | « Sélection de l'équipe » absente, nouveautés seules | — |
| Aucune œuvre visible | catalogue vide | état vide de l'accueil sans erreur | — |
| Œuvre marquée vendue | `featured` + vendue | absente de la sélection | — |
| Marquage par l'équipe | admin bascule « Sélection de l'accueil » | `featured` mis à jour ; refus pour un non-admin, un brouillon ou une œuvre retirée | code de refus |
| En-tête, Lot 2 fermé | `lot2Ouvert()` faux | ni « Panier » ni favoris | — |
| En-tête, écran profond | `/galerie/[id]`, `/artistes/[id]`, `/expositions/[id]` | « ‹ Galerie » / « ‹ Artistes » / « ‹ Expositions » | — |
| En-tête, accueil | `/` | « Menu » et marque, pas de retour | — |

</frozen-after-approval>

## Code Map

- `src/app/page.tsx`, `src/lib/catalogue/accueil.ts` (`accueilPublic`) -- fournir `selection` et `nouveautes` ; `oeuvreMiseEnAvant` (`mappers.ts:221`) sert déjà le Hero.
- `src/components/sections/{Hero,Gallery,Artists,Exhibitions}.tsx` -- à rendre conformes (textes dans `fr`, propriétés logiques) ; `Gallery.tsx` (filtres client) remplacé par les deux sections ; réutiliser `src/app/galerie/VignetteOeuvre.tsx` (3.9).
- `src/components/layout/Header.tsx` -- « Menu », marque, retour, sans « Panier » ni favoris ; `src/app/layout.tsx` lit `lot2Ouvert()` (`src/lib/reglages`) et le passe.
- `src/lib/curation/` -- nouvelle `definirSelection(acteur, slug, marquee)` (admin, œuvre publiée non retirée) ; `src/app/dashboard/admin/oeuvres/page.tsx` -- bascule et action serveur ; l'ancienne route `/api/admin/oeuvres/[slug]` (clé `featured`) reste.
- `src/lib/i18n/fr.ts` ; `eslint/exceptions-textes.cjs`, `tests/exceptions-interface.cjs` -- retirer les quatre fichiers ; `tests/interface-accessible.test.ts`, `tests/i18n.test.ts` les contrôlent.
- `tests/accueil.test.ts` (nouveau), `tests/curation.test.ts` -- matrice, base réelle.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/curation/` -- `definirSelection` ; `src/app/dashboard/admin/oeuvres/` -- bascule.
- [x] `src/lib/catalogue/accueil.ts` -- sélection et nouveautés.
- [x] `src/components/sections/*`, `src/app/page.tsx` -- accueil refait, quatre fichiers conformes.
- [x] `src/components/layout/Header.tsx`, `src/app/layout.tsx` -- « Menu », marque, retour, Lot 2.
- [x] `src/lib/i18n/fr.ts`, listes d'exceptions -- textes, sorties de liste.
- [x] `tests/accueil.test.ts` -- matrice ; `AGENTS.md`.

**Acceptance Criteria:**
- Given des œuvres marquées par l'équipe, when l'accueil s'affiche, then la sélection et les dernières œuvres publiées sont des vignettes menant chacune à une fiche, avec « Parcourir la galerie ».
- Given le Lot 2 fermé, when l'en-tête s'affiche, then il n'a ni « Panier » ni favoris et, sur une fiche, « ‹ Galerie ».
- Given les fichiers de l'accueil, when on lance lint et tests, then ils sont conformes sans figurer dans les listes d'exceptions.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Constat (relecteurs) | Verdict | Preuve | Suite |
|---|---|---|---|---|
| 1 | La date de dépôt, relue du cache, est une chaîne : l'ordre des nouveautés n'est testé qu'avec le simulacre passe-plat (V, E) | medium | `unstable_cache` renvoie les dates en texte ; aucune assertion ne l'exerce ; une date illisible ferait échouer la lecture | patch : test avec aller-retour JSON, date illisible ignorée |
| 2 | Pays de livraison de l'accueil (cookie) non testé (V) | medium | le cookie est simulé vide ; aucun prix livré vérifié | patch : test |
| 3 | « Panier » du menu mobile et passage de `lot2Ouvert()` par le layout non gardés (V, B) | medium | le panneau mobile est fermé au rendu statique ; supprimer la condition laisserait le test vert | patch : tests sur le texte source des deux conditions |
| 4 | Le bandeau d'administration promet l'apparition sur l'accueil pour une œuvre qui peut rester masquée (accord non signé, vendue) (B, E) | medium | `VISIBLE` et « non vendue » restent appliqués à l'affichage | patch : texte sans promesse |
| 5 | Séparateur « · » écrit avec une espace simple dans `Exhibitions` (B) | low | l'usage du projet impose `SEPARATEUR` | patch |
| 6 | Légende du bandeau d'ouverture avec virgule en tête si la technique est vide (E) | low | assemblage sans filtre | patch |
| 7 | Sélection sans plafond, section Artistes sans plafond (E, B) | low | l'équipe choisit ; comportement d'avant pour les artistes | rejeté |
| 8 | « Dernières publiées » classées par date de dépôt (B) | false | choix de la spec, noté dans les Design Notes | rejeté |
| 9 | Œuvre marquée vendue ou accord non signé non refusée par `definirSelection` ; accueil vide si tout est vendu ; bouton sur œuvre vendue (B, E) | low | ces œuvres restent masquées à l'affichage ; cas rare | rejeté |
| 10 | Ancienne route `PUT /api/admin/oeuvres/[slug]` écrit encore `featured` (E) | false | prévu par la spec | rejeté |
| 11 | Rendus de `Artists`, `Exhibitions` et de la page d'administration seulement vérifiés par type (V) | low | logique de présentation sans risque ; règles du module testées | defer |
| 12 | Lien « À propos » de l'en-tête vers une ancre absente de l'accueil (E) | low | déjà sans cible avant la story | defer |
| 13 | Clés de dictionnaire inutilisées, couches (`VignetteOeuvre` dans `app/`), classes de lien dupliquées, indentation, cases en dur, lecture du catalogue à chaque visite, états spec / sprint (B) | low | sans effet visible ; lecture identique à la galerie ; le sprint passe en `review` à la présentation | rejeté |

## Design Notes

Décisions prises sans question : un seul marqueur « sélection de l'équipe » = « Coup de cœur » ; « dernières publiées » classées par date de dépôt (pas de date de publication en base, à affiner plus tard) ; le bouton « Ajouter au panier » de la fiche reste jusqu'à l'Epic 4 et l'Epic 7 (l'en-tête ne montre simplement plus le panier) ; sur grand écran les liens de navigation restent, « Menu » est le libellé du bouton de petit écran.

## Verification

**Commands:**
- `npx eslint .` et les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …` -- aucune erreur, aucun ajout (deux listes de textes et d'interface diminuent)
- `npm test` et `npm run build` -- réussis

**Manual checks:**
- Préversion : marquer « A Subtlety » depuis l'administration, attendre 60 s, accueil et en-tête à 375 px et en grand écran, retour depuis une fiche.
