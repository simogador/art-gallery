---
title: 'Story 3.9 — Galerie filtrée pour un mur et un budget'
type: 'feature'
created: '2026-11-09'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La galerie filtre côté navigateur (médium, artiste, disponibles, tri), sans rien dans l'adresse : un lien ne conserve pas les filtres et le retour arrière les perd. Elle n'a ni prix livré maximum, ni format, ni orientation, ni couleur, ni ambiance, ni pays de l'artiste, et son texte d'introduction promet un certificat, une assurance et une installation non décidés (FR-17, UX-DR20, UX-DR22, UX-DR39).

**Approach:**
- `/galerie` lit ses filtres dans l'adresse (serveur) ; « Modifier les filtres » est un formulaire `GET` natif ; chaque filtre actif devient une puce-lien qui le retire.
- Les filtres s'appliquent au catalogue déjà lu avec son prix livré (le même calcul que la fiche, story 3.3) ; « Afficher plus d'œuvres » augmente le nombre affiché dans l'adresse.
- La grille a 2 colonnes sur mobile, 3 de `md` à `lg`, 4 au-delà ; la vignette est une seule cible vers la fiche.

## Boundaries & Constraints

**Always:**
- Décisions du porteur du 2026-11-09 : le texte d'introduction ne promet ni certificat, ni assurance, ni installation (haut de page : « La collection » et la ligne « N œuvres · prix livré [pays] »).
- Filtres : prix livré maximum (en euros), format (petit, moyen, grand, seuils de `reglages`), orientation (portrait, paysage, carré), couleur dominante et ambiance (listes fermées de `curation/depot-regles`), technique (catégorie : peinture, sculpture, photographie, art numérique), artiste (slug), pays de l'artiste (valeur de « nationalité » saisie, options tirées des œuvres visibles), disponibilité (disponibles seulement), plus le tri existant (défaut, prix livré croissant, décroissant). Valeur inconnue dans l'adresse : ignorée.
- Une œuvre non livrée vers le pays n'est jamais retenue par un filtre de prix ; une œuvre filtrée « ≤ 3 000 € » a sur sa fiche un prix livré ≤ 3 000 € pour le même pays.
- « Afficher plus d'œuvres » : un lien (24 œuvres de plus), jamais de défilement infini ; page rendue à chaque requête (cookie `pays`).
- Vignette : une seule cible ; artiste, dimensions (unité choisie), prix livré, délai ; aucun prix barré ni étiquette promotionnelle.
- États : « Aucune œuvre ne correspond à ces filtres. » avec lien pour retirer le dernier filtre ; chargement par vignettes squelettes ; erreur « La galerie ne s'est pas chargée. Réessayer », filtres conservés (ils sont dans l'adresse).
- Textes dans `fr`, propriétés logiques, cibles 44 px, mouvement coupé sous `prefers-reduced-motion`, nombre de résultats annoncé (`aria-live`).

**Never:**
- Défilement infini, nouvelle bibliothèque, chargement par le client, migration.
- Toucher à la fiche, au calcul du prix livré, à `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sans filtre | `/galerie` | toutes les œuvres visibles, 24 premières, ligne « N œuvres · prix livré [pays] » | — |
| Prix maximum | `?prix=3000` | seules les œuvres livrées au pays dont le prix livré ≤ 3 000 € | — |
| Plusieurs filtres | format + couleur + artiste | intersection ; une puce par filtre | — |
| Retrait d'une puce | clic sur « × » | lien sans ce filtre, liste relancée | — |
| Valeur inconnue | `?couleur=turquoise` | ignorée, aucune puce | — |
| Aucun résultat | filtres sans œuvre | message avec retrait du dernier filtre | — |
| Plus d'œuvres | `?n=48` | 48 œuvres affichées, lien « Afficher plus » absent s'il n'en reste pas | — |
| Retour arrière | navigateur | filtres retrouvés (adresse) | — |
| Chargement / erreur | requête lente ou échec | squelettes / « La galerie ne s'est pas chargée. Réessayer » | filtres conservés |

</frozen-after-approval>

## Code Map

- `src/app/galerie/page.tsx`, `src/app/galerie/GalleryPage.tsx` (593 l., état client) -- à remplacer ; ajouter `loading.tsx` et `error.tsx` ; `GalleryPage.tsx` sort des listes `eslint/exceptions-textes.cjs` et `tests/exceptions-interface.cjs` (ou disparaît).
- `src/lib/catalogue/` -- `filtres.ts` pur (lecture et écriture des paramètres, listes fermées) ; `galerie.ts` : filtrage et tri sur `getAllArtworks(pays)` (prix livré par le calcul de `livraison`) ; `mappers.ts`, `src/lib/types/index.ts` : exposer `ambiance`, `couleurDominante`, nationalité de l'artiste.
- `src/lib/reglages/index.ts` (`formatOeuvre`, `orientationOeuvre`), `src/lib/curation/depot-regles.ts` (`AMBIANCES`, `COULEURS_DOMINANTES`) -- règles et listes à réutiliser, pas à copier.
- `src/components/ui/{PaysLivraison,UniteToggle}.tsx`, `DimensionsChoisies`, `src/lib/i18n/fr.ts` -- bascules, unité, textes ; `tests/livraison.test.ts` -- équivalence des prix à conserver.
- `tests/galerie.test.ts` (nouveau) -- matrice sur base réelle.

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/catalogue/filtres.ts`, `galerie.ts`, `mappers.ts`, `types` -- filtres, tri, pagination, champs exposés.
- [ ] `src/app/galerie/page.tsx` et composants -- formulaire « Modifier les filtres », puces, ligne de résultats, grille, vignette, « Afficher plus d'œuvres ».
- [ ] `src/app/galerie/loading.tsx`, `error.tsx` -- squelettes et erreur avec « Réessayer ».
- [ ] `src/lib/i18n/fr.ts` -- textes ; retirer l'ancien `GalleryPage.tsx` et ses entrées d'exceptions.
- [ ] `tests/galerie.test.ts` -- matrice, équivalence prix galerie / fiche, adresses ; `AGENTS.md`.

**Acceptance Criteria:**
- Given `/galerie` avec des filtres, when la page s'affiche, then chaque filtre actif est une puce qui le retire et la ligne « N œuvres · prix livré [pays] » est juste.
- Given un prix maximum, when il s'applique, then toute œuvre listée a sur sa fiche un prix livré inférieur ou égal pour le même pays.
- Given une adresse avec filtres, when on la partage ou revient en arrière, then les mêmes filtres s'appliquent.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

Décisions prises sans question (le visiteur ne les distingue guère) : prix maximum seul (pas de minimum) ; « technique » = catégorie plutôt que le texte libre ; « pays de l'artiste » = la nationalité saisie à la création de la fiche (une orthographe homogène reste à la charge de l'équipe) ; filtrage en mémoire sur le catalogue lu avec son prix livré (volume d'un catalogue de galerie), à repasser en SQL si le catalogue grossit.

## Verification

**Commands:**
- `npx eslint .` et les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …` -- aucune erreur, aucun ajout
- `npm test` et `npm run build` -- réussis

**Manual checks:**
- Préversion : filtres combinés, puces, copie de l'adresse dans un autre onglet, bouton retour, 375 px (2 colonnes).
