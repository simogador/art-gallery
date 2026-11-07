---
title: 'Story 3.7 — Fiche d''une œuvre vendue ou retirée'
type: 'feature'
created: '2026-11-07'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La fiche d'une œuvre vendue montre encore un prix de vente barré (interdit par les règles de ton), la rangée tronquée et les sections « Combien au total ? » et « Quand la recevrai-je ? » qui parlent d'achat. Le visiteur ne comprend pas tout de suite que l'œuvre n'est plus disponible et n'a pas de suite à donner (FR-6, partie états).

**Approach:**
- Une œuvre `vendue` ou `vendue_ailleurs` garde la même fiche (photos, titre, taille, histoire) avec « Vendue », sans aucun prix, sans « Prix livré » ni « Délai », et sans les deux sections d'achat.
- La section d'œuvres proches de l'artiste reste affichée, avec un lien vers sa page.
- Les états `disponible`, `retiree` et inconnu ne changent pas (redirection de l'œuvre retirée déjà en place).

## Boundaries & Constraints

**Always:**
- Décisions du porteur du 2026-11-07 : aucun prix sur la fiche d'une œuvre vendue ; adresse inconnue, ou œuvre retirée dont l'artiste n'a pas de page publique : page introuvable 404 (pas de redirection vers la galerie).
- Œuvre retirée dont l'artiste est public : redirection permanente vers `/artistes/[slug]` (308, décision du 2026-10-30, déjà en place).
- Une œuvre `disponible` affiche « Disponible » ; aucun bouton « Acheter » (Lot 2 fermé).
- Textes dans `fr`, jamais de prix barré, compte à rebours ni « dernière chance ».
- « Vendue » et « Disponible » se lisent par `Artwork.sold` (prédicats de `disponibilite`), jamais par une colonne.

**Never:**
- Prix, prix barré, prix livré ou délai d'achat sur une œuvre vendue.
- Toucher au calcul du prix livré, au carrousel, à la fiche d'une œuvre disponible, aux métadonnées de référencement (3.8), à la barre d'actions (Epic 4), à `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Vendue | `disponibilite` = `vendue` | « Vendue », taille, histoire, œuvres proches avec lien vers l'artiste ; aucun prix | — |
| Vendue ailleurs | `vendue_ailleurs` | identique à « vendue » | — |
| Sans prix livré | œuvre vendue, pays quelconque | ni « Prix livré », ni « Délai », ni sections « Combien au total ? » et « Quand la recevrai-je ? » | — |
| Œuvre proche absente | l'artiste n'a pas d'autre œuvre visible | pas de section d'œuvres proches, lien vers l'artiste conservé | — |
| Disponible | `disponible` | fiche actuelle inchangée | — |
| Retirée, artiste public | `retiree` | redirection permanente vers la page de l'artiste | — |
| Retirée, artiste sans page, ou inconnue | `retiree` ou slug inexistant | page introuvable 404 | — |

</frozen-after-approval>

## Code Map

- `src/app/galerie/[id]/ArtworkDetail.tsx:143-153` -- bloc « Prix de vente » barré à supprimer ; `RangeeFiche` (l. 152), boutons (l. 178+), `RelatedSection` (l. 327, titre « Vous pourriez aimer ») et `SectionsFiche` à adapter pour `artwork.sold`.
- `src/app/galerie/[id]/RangeeFiche.tsx`, `SectionsFiche.tsx` -- case Taille réutilisable seule ; sections 2 et 3 masquées pour une œuvre vendue.
- `src/app/galerie/[id]/page.tsx` -- redirection de l'œuvre retirée déjà en place (`artisteDOeuvreRetiree`) ; 404 sinon : aucun changement attendu, à couvrir par un test.
- `src/lib/catalogue/artworks.ts` (`getRelatedArtworks`, `artisteDOeuvreRetiree`) -- œuvres proches et redirection ; ne pas changer la règle de visibilité.
- `src/lib/i18n/fr.ts` -- clés `fr.fiche` : titre de la section d'œuvres proches d'une œuvre vendue et lien vers l'artiste.
- `tests/fiche.test.ts`, `tests/disponibilite-artiste.test.ts` -- cas de la matrice (rendu et base réelle).

## Tasks & Acceptance

**Execution:**
- [ ] `src/app/galerie/[id]/ArtworkDetail.tsx` -- retirer le prix barré ; pour `sold`, afficher la case Taille seule, masquer prix livré et délai, boutons et sections d'achat.
- [ ] `src/app/galerie/[id]/SectionsFiche.tsx`, `RangeeFiche.tsx` -- mode œuvre vendue (Taille seule ; deux sections d'achat absentes).
- [ ] `src/app/galerie/[id]/ArtworkDetail.tsx` (`RelatedSection`) -- pour une œuvre vendue, titre dédié et lien « Découvrir [artiste] ».
- [ ] `src/lib/i18n/fr.ts` -- textes.
- [ ] `tests/fiche.test.ts` -- matrice : vendue, vendue ailleurs, aucun prix dans le HTML, disponible inchangée, retirée (redirection), inconnue (404).
- [ ] `AGENTS.md` -- règles de la fiche vendue.

**Acceptance Criteria:**
- Given une œuvre `vendue` ou `vendue_ailleurs`, when la fiche s'ouvre, then « Vendue » est affiché, sans aucun montant ni délai d'achat, avec des œuvres proches et un lien vers l'artiste.
- Given une œuvre `retiree` dont l'artiste est public, when on ouvre son adresse, then redirection permanente vers la page de l'artiste.
- Given une adresse inconnue, when on l'ouvre, then 404.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

Décisions prises sans question : « Vendue ailleurs » est présentée comme « Vendue » (même libellé que l'axe `vendue`) ; la fiche vendue garde l'histoire, la taille et « Est-ce sérieux ? » ; la barre d'actions et « M'alerter » viennent de l'Epic 4.

## Verification

**Commands:**
- `npx eslint .` et les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …` -- aucune erreur, aucun ajout
- `npm test` et `npm run build` -- réussis

**Manual checks:**
- Préversion : déclarer « A Subtlety » vendue ailleurs (compte Kara Walker), recharger la fiche : « Vendue », aucun prix ; puis annuler la déclaration.
