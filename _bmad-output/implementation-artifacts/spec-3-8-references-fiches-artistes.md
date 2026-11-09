---
title: 'Story 3.8 — Fiches et pages artistes bien référencées'
type: 'feature'
created: '2026-11-09'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les fiches œuvre et les pages artistes n'ont ni adresse canonique, ni image de partage, ni sitemap. Le jour où la maintenance sera levée, le site ne serait pas correctement indexé, et l'adresse d'une œuvre déjà validée peut encore changer avec son titre (NFR-2).

**Approach:**
- Titre, description, adresse canonique en français et balises de partage (image de mise en situation) sur chaque fiche publique et chaque page artiste.
- Un sitemap des fiches publiées non retirées et des pages artistes, vide tant que la maintenance est active.
- L'adresse d'une œuvre déjà validée par l'équipe est figée : plus de 301 à gérer, aucune migration.

## Boundaries & Constraints

**Always:**
- Décision du porteur du 2026-11-09 : l'adresse (slug) d'une œuvre qui a une décision de curation « valider » ne change plus, même si son titre change ; avant validation, elle suit le titre comme aujourd'hui.
- Adresse canonique absolue construite sur une constante du site dans `src/lib/reglages` (`https://www.errancy.art`), jamais sur la requête.
- Le sitemap reprend les règles de visibilité du catalogue (`VISIBLE`, `ARTISTE_VISIBLE`) : œuvres vendues comprises, retirées exclues ; il suit la publication (cache de 60 s, étiquette du catalogue).
- Pendant la maintenance, le sitemap ne liste rien : `/sitemap.xml` passe à côté du middleware (extension dans l'adresse), il ne doit pas révéler les œuvres avant l'ouverture. La règle « maintenance active » est partagée entre le middleware et le sitemap sans changer son comportement.

**Never:**
- Modifier `public/robots.txt` (donc ni ligne `Sitemap:` ni ouverture aux robots) ni `MAINTENANCE_MODE` : actes du porteur au lancement.
- Table d'anciennes adresses, migration, données structurées JSON-LD, `noindex` (hors périmètre).
- Toucher à la fiche vendue, aux onglets, au prix livré, à `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fiche disponible | œuvre publiée avec photos | titre « œuvre — artiste », description tirée de l'histoire (155 car.), canonique `/galerie/[slug]`, image = mise en situation | — |
| Fiche vendue | œuvre vendue | mêmes balises, canonique inchangé, indexable | — |
| Sans histoire | description vide | description de repli (artiste, technique, année) | — |
| Sans photo de dépôt | seule `imageUrl` | image de partage = `imageUrl` | — |
| Page artiste | artiste public | titre, description (biographie), canonique `/artistes/[slug]`, image du portrait | — |
| Sitemap ouvert | maintenance inactive | accueil, galerie, artistes, fiches publiées non retirées, pages artistes publiques | — |
| Sitemap en maintenance | maintenance active | liste vide | — |
| Œuvre retirée ou non publiée | `retiree`, `brouillon`, `en_curation` | absente du sitemap | — |
| Titre changé après validation | décision « valider » existante | slug inchangé | — |
| Titre changé avant validation | aucune décision « valider » | slug recalculé depuis le titre | — |

</frozen-after-approval>

## Code Map

- `src/app/galerie/[id]/page.tsx:16-28`, `src/app/artistes/[id]/page.tsx:10-23` -- `generateMetadata` existants à compléter (canonique, image, Twitter) ; `src/app/layout.tsx:41-53` fixe `metadataBase`, modèle de titre et `openGraph` du site.
- `src/app/sitemap.ts` (nouveau) -- route Next 14 ; `src/lib/catalogue/` -- nouvelle lecture `adressesPubliques()` (slug, `updatedAt`) enveloppée par `enCache` avec règles `VISIBLE`/`ARTISTE_VISIBLE`.
- `src/middleware.ts:10-15` (`maintenanceEnabled`) et `src/lib/reglages/index.ts` -- extraire la règle dans `reglages` (fonction pure prenant l'environnement), mêmes résultats ; test de non-régression.
- `src/lib/curation/depot.ts:171-195` (`slugDepuisTitre`, cas `titre` l. 211) -- figer le slug si l'œuvre a une `DecisionCuration` « valider » (`curation/decisions.ts`).
- `public/robots.txt` -- ne pas toucher.
- `tests/fiche.test.ts`, `tests/catalogue-reel.test.ts`, `tests/depot.test.ts` -- cas de la matrice (base réelle pour le sitemap et le slug).

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/reglages/index.ts`, `src/middleware.ts` -- `URL_SITE` et règle « maintenance active » partagée.
- [ ] `src/lib/catalogue/` -- `adressesPubliques()`.
- [ ] `src/app/sitemap.ts` -- sitemap, vide en maintenance.
- [ ] `src/app/layout.tsx`, `galerie/[id]/page.tsx`, `artistes/[id]/page.tsx` -- métadonnées, canonique, partage.
- [ ] `src/lib/curation/depot.ts` -- slug figé après validation.
- [ ] `tests/*` -- matrice ; `AGENTS.md`, `docs/` -- règles et rappel des actes du porteur au lancement.

**Acceptance Criteria:**
- Given une fiche ou une page artiste publique, when on lit son HTML, then titre, description, URL canonique en français et balises de partage avec l'image de mise en situation sont présents.
- Given le sitemap, when la maintenance est inactive, then il liste les fiches publiées non retirées et les pages artistes ; when elle est active, then il est vide.
- Given une œuvre validée dont le titre change, when l'artiste enregistre, then son adresse reste la même.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

Au lancement, deux actes du porteur restent à faire, hors code : ouvrir `public/robots.txt` en y ajoutant la ligne `Sitemap: https://www.errancy.art/sitemap.xml`, et lever `MAINTENANCE_MODE`. Le slug figé remplace le 301 prévu par l'epic pour un slug modifié : aucune adresse ne change, donc aucune redirection à tenir.

## Verification

**Commands:**
- `npx eslint .` et les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …` -- aucune erreur, aucun ajout
- `npm test` et `npm run build` -- réussis

**Manual checks:**
- Préversion : code source d'une fiche (balises `canonical`, `og:image`) ; `/sitemap.xml` doit être vide si `MAINTENANCE_MODE` est actif sur cet environnement.
