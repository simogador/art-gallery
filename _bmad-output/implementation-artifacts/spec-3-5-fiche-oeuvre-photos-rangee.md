---
title: 'Story 3.5 — Fiche œuvre : photos et rangée Taille, Prix livré, Délai'
type: 'feature'
created: '2026-11-07'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La fiche `/galerie/[id]` montre encore une seule image au format 4/5 et un prix sans taille, ni délai, ni photos de prise de vue. Le visiteur ne peut pas répondre seul à « Ira-t-elle chez moi ? » et « Est-elle trop chère ? » (FR-1 à FR-4, UX-DR15, UX-DR17, UX-DR18).

**Approach:**
- Le haut de la fiche devient : carrousel de photos (mise en situation d'abord), titre, libellé de disponibilité, rangée de trois cases Taille / Prix livré (+ « Modifier ») / Délai.
- `catalogue` lit les photos de l'œuvre (`PhotoOeuvre`) et les passe en props.
- Les trois cases reprennent `Artwork.prixLivre` (story 3.3), `DimensionsChoisies` et les textes de `fr` ; aucun calcul de prix dans un composant.

## Boundaries & Constraints

**Always:**
- Carrousel : balayage et boutons précédent/suivant, jamais de défilement automatique, compteur « 1/4 », légende de la prise de vue, appui = plein écran avec zoom.
- Texte alternatif de chaque photo : œuvre, artiste, prise de vue.
- Rangée et titre rendus avant les photos.
- Taille : unité choisie d'abord, l'autre dessous, orientation et format.
- Pays non livré : « Pas de livraison vers [pays] » et « [Artiste] ne livre pas encore [pays]. »
- Mention « Droits et taxes d'import éventuels non inclus » sous la rangée.
- Seuils du format : réglage de l'équipe, jamais codés en dur dans un composant.
- Règles de `AGENTS.md` : textes dans `fr`, propriétés logiques, cibles 44 px, mouvement coupé sous `prefers-reduced-motion`, pas de `<main>`.

**Never:**
- Défilement automatique, vidéo qui démarre seule, nouvelle bibliothèque de carrousel ou de zoom.
- Mise en cache du prix livré.
- Toucher aux onglets, au panier et au formulaire de contact de la fiche (stories 3.6 à 3.8), à `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Œuvre déposée | trois photos (mise en situation, face, gros plan) | première photo = mise en situation, compteur « 1/3 », légende de la prise de vue | — |
| Œuvre sans `PhotoOeuvre` | seule `imageUrl` | une photo, ni compteur ni boutons, légende « Photo de l'œuvre » | — |
| Pays livré | offre de la zone | prix total, « Modifier », délai « 8 à 12 jours » | — |
| Pays non livré | `prixLivre` non livrée | case Prix : « Pas de livraison vers [pays] », phrase de l'artiste | — |
| Dimensions absentes | hauteur ou largeur nulle | case Taille : « — », ni orientation ni format | — |
| Seuil modifié | l'équipe change un seuil | le format affiché suit, sans changement de code | — |
| Photo d'une vidéo | `PhotoOeuvre` de type `video` | exclue du carrousel | — |

</frozen-after-approval>

## Open Questions

- Valeurs des seuils petit / moyen / grand (UXQ-7, jamais fixées par le porteur) — options : A) selon le plus grand côté, petit < 40 cm, moyen de 40 à 100 cm, grand > 100 cm (ordre de grandeur courant en galerie, à corriger ensuite) / B) le porteur donne ses valeurs maintenant.
- Où l'équipe change ces seuils « sans changement de code » (critère d'acceptation de l'epic) — options : A) deux constantes dans `src/lib/reglages` : une ligne à modifier, mais c'est un changement de code déployé par une PR (comme les délais des stories 2.6 et 2.8) / B) une table et un écran d'administration comme pour les zones : respecte le critère à la lettre, mais ajoute une migration (appliquée par le porteur) et une page d'administration à cette story.

## Code Map

- `src/app/galerie/[id]/ArtworkDetail.tsx:107-180` -- bloc image gauche (4/5, `lightboxOpen`) et en-tête à refaire ; onglets, panier et contact (lignes 180+) intacts.
- `src/app/galerie/[id]/page.tsx` -- passe `pays` ; `generateMetadata` inchangé (SEO : story 3.8).
- `src/lib/catalogue/artworks.ts`, `mappers.ts`, `src/lib/types/index.ts` -- `include: { photos }` dans `getArtworkBySlug`, `Artwork.photos` (url, type, largeur, hauteur) ; lecture en cache 60 s déjà en place.
- `prisma/schema.prisma:146-166` -- `PhotoOeuvre` (type, url, largeur/hauteur nullables) : aucune migration nécessaire.
- `src/lib/curation/depot-regles.ts:56-70` -- types et légendes de dépôt ; les légendes visiteur vont dans `fr`.
- `src/components/ui/{ArtworkImage,PaysLivraison,UniteToggle}.tsx`, `DimensionsChoisies` -- à réutiliser ; `src/lib/livraison/{prix,messages}.ts` -- `PrixLivre`, textes de non-livraison.
- `src/lib/i18n/fr.ts:53,165` -- clés `fiche`, `livraison` à étendre ; règle `jsx-no-literals` sur la fiche.
- `src/lib/reglages/index.ts` -- seuils (selon la réponse) ; `eslint/exceptions-textes.cjs`, `tests/exceptions-interface.cjs` -- `ArtworkDetail.tsx` y reste (3.8) ; les nouveaux fichiers doivent passer les deux contrôles.
- `DESIGN.md` `tile-row` (l. 79 et 190) -- trois cases blanches, filet `neutral-300`, liseré or 2 px.

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/catalogue/*`, `src/lib/types/index.ts` -- lire et mapper les photos (images seulement, mise en situation en tête).
- [ ] `src/lib/reglages/*` (+ migration si option B) -- seuils, orientation (carré à 5 % près) et format, fonction pure.
- [ ] `src/lib/i18n/fr.ts` -- légendes, compteur, boutons, libellés des cases.
- [ ] `src/app/galerie/[id]/CarrouselPhotos.tsx`, `RangeeFiche.tsx` -- composants, plein écran en `<dialog>` natif, zoom au toucher sans bibliothèque.
- [ ] `src/app/galerie/[id]/ArtworkDetail.tsx` -- brancher le nouveau haut de fiche.
- [ ] `tests/fiche.test.ts` -- matrice (photos, repli `imageUrl`, non livré, dimensions absentes, seuil).
- [ ] `AGENTS.md` -- règles de la fiche.

**Acceptance Criteria:**
- Given une œuvre publiée, when la fiche s'ouvre, then photo de mise en situation, titre, disponibilité puis les trois cases s'affichent dans cet ordre.
- Given le carrousel, when le visiteur balaie ou appuie sur un bouton, then les photos défilent sans automatisme ; un appui ouvre le plein écran avec zoom.
- Given un seuil modifié, when la fiche se recharge, then le format affiché suit.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

Décisions prises sans question (le visiteur ne les distingue pas) : repli sur `imageUrl` quand l'œuvre n'a pas de `PhotoOeuvre` (œuvres déposées avant la story 2.5) ; les photos suivent le cache de 60 s du catalogue ; les onglets restent tels quels jusqu'à la 3.6.

## Verification

**Commands:**
- `npx eslint .` et les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …` -- aucune erreur, aucun ajout
- `npm test` et `npm run build` -- réussis

**Manual checks:**
- Préversion : fiche d'une œuvre de Kara Walker sur mobile (375 px) : carrousel, rangée, changement de pays, bascule cm/in.
