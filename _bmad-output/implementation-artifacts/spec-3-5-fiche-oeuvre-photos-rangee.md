---
title: 'Story 3.5 — Fiche œuvre : photos et rangée Taille, Prix livré, Délai'
type: 'feature'
created: '2026-11-07'
status: 'done'
baseline_commit: '79f504b76794965df9fb123f3452bb6bdd82005e'
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
- Seuils du format (décision du porteur du 2026-11-07) : plus grand côté, petit < 40 cm, grand > 100 cm, moyen entre les deux ; deux constantes de `src/lib/reglages`, jamais codées en dur dans un composant ; les changer = une PR (pas d'écran d'administration, pas de migration).
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
| Seuil modifié | une constante de `reglages` change | le format affiché suit, sans toucher à un composant | — |
| Cas limites | plus grand côté de 40 cm ou de 100 cm exactement | « moyen » (bornes incluses) | — |
| Photo d'une vidéo | `PhotoOeuvre` de type `video` | exclue du carrousel | — |

</frozen-after-approval>

## Code Map

- `src/app/galerie/[id]/ArtworkDetail.tsx:107-180` -- bloc image gauche (4/5, `lightboxOpen`) et en-tête à refaire ; onglets, panier et contact (lignes 180+) intacts.
- `src/app/galerie/[id]/page.tsx` -- passe `pays` ; `generateMetadata` inchangé (SEO : story 3.8).
- `src/lib/catalogue/artworks.ts`, `mappers.ts`, `src/lib/types/index.ts` -- `include: { photos }` dans `getArtworkBySlug`, `Artwork.photos` (url, type, largeur, hauteur) ; lecture en cache 60 s déjà en place.
- `prisma/schema.prisma:146-166` -- `PhotoOeuvre` (type, url, largeur/hauteur nullables) : aucune migration nécessaire.
- `src/lib/curation/depot-regles.ts:56-70` -- types et légendes de dépôt ; les légendes visiteur vont dans `fr`.
- `src/components/ui/{ArtworkImage,PaysLivraison,UniteToggle}.tsx`, `DimensionsChoisies` -- à réutiliser ; `src/lib/livraison/{prix,messages}.ts` -- `PrixLivre`, textes de non-livraison.
- `src/lib/i18n/fr.ts:53,165` -- clés `fiche`, `livraison` à étendre ; règle `jsx-no-literals` sur la fiche.
- `src/lib/reglages/index.ts` -- seuils de format ; `eslint/exceptions-textes.cjs`, `tests/exceptions-interface.cjs` -- `ArtworkDetail.tsx` y reste (3.8) ; les nouveaux fichiers doivent passer les deux contrôles.
- `DESIGN.md` `tile-row` (l. 79 et 190) -- trois cases blanches, filet `neutral-300`, liseré or 2 px.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/catalogue/*`, `src/lib/types/index.ts` -- lire et mapper les photos (images seulement, mise en situation en tête).
- [x] `src/lib/reglages/*` -- seuils, orientation (carré à 5 % près) et format, fonction pure.
- [x] `src/lib/i18n/fr.ts` -- légendes, compteur, boutons, libellés des cases.
- [x] `src/app/galerie/[id]/CarrouselPhotos.tsx`, `RangeeFiche.tsx` -- composants, plein écran en `<dialog>` natif, zoom au toucher sans bibliothèque.
- [x] `src/app/galerie/[id]/ArtworkDetail.tsx` -- brancher le nouveau haut de fiche.
- [x] `tests/fiche.test.ts` -- matrice (photos, repli `imageUrl`, non livré, dimensions absentes, seuil).
- [x] `AGENTS.md` -- règles de la fiche.

**Acceptance Criteria:**
- Given une œuvre publiée, when la fiche s'ouvre, then photo de mise en situation, titre, disponibilité puis les trois cases s'affichent dans cet ordre.
- Given le carrousel, when le visiteur balaie ou appuie sur un bouton, then les photos défilent sans automatisme ; un appui ouvre le plein écran avec zoom.
- Given une constante de seuil modifiée, when la fiche se recharge, then le format affiché suit sans changement dans un composant.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Constat (relecteurs) | Verdict | Preuve | Suite |
|---|---|---|---|---|
| 1 | Badge « Coup de cœur » (et badge du médium) supprimés sans décision (B, E) | medium | visibles sur la fiche avant la story (capture du porteur) ; la spec ne les retire pas ; le médium reste dans la grille | patch : rétablir « Coup de cœur » à côté de la disponibilité |
| 2 | Ordre des photos d'un même type non déterministe (B, E) | low | pas d'`orderBy` ; un seul fichier par type en base (`@@unique [artworkId, type]`) mais ordre de lecture non garanti | patch (une ligne) |
| 3 | `in` accepte les clés du prototype (B, E, V) | low | `'constructor' in {}` vrai ; l'énumération en base l'interdit aujourd'hui | patch (`Object.hasOwn`) |
| 4 | Clés React en double si deux photos ont la même adresse (E) | low | `key={p.url}` | patch (clé avec l'index) |
| 5 | Index hors limites si les photos diminuent après `router.refresh` (E) | low | `liste[index]` indéfini | patch (borner l'index) |
| 6 | Diapositives hors écran dans l'ordre de tabulation et lues par les lecteurs d'écran (B) | medium | chaque diapositive a un bouton « Agrandir » focalisable : la tabulation atteint une photo invisible et fait sauter la piste | patch (`aria-hidden` et `tabIndex -1` hors diapositive courante) |
| 7 | `prixLivre` absent affiché comme « Pas de livraison » (B, E) | low | la page passe toujours le pays ; mais l'absence de calcul ne doit pas annoncer un refus | patch : « — » |
| 8 | Tests manquants : délai min = max, « — » sans prix, ordre titre/rangée avant photos, œuvre vendue (V) | medium | aucun test ne les épingle | patch : tests |
| 9 | Aucun test d'interaction du carrousel et du plein écran (V) | medium | pas de jsdom ni de test de bout en bout dans le dépôt | defer : contrôle manuel en préversion, harnais à décider à part |
| 10 | Clé du dictionnaire `fr.fiche.format` probablement morte (B, E) | low | case Format retirée de la grille | patch si inutilisée |
| 11 | Orientation et format ignorent la profondeur (B) | maybe-false | décision du porteur : « plus grand côté » ; une sculpture profonde pourrait changer de classe | defer (à confirmer avec le porteur) |
| 12 | Plein écran sans navigation entre photos ni geste de zoom propre (B, E) | low | la spec demande plein écran avec zoom : boutons, appui et zoom du navigateur le fournissent | rejeté |
| 13 | Flèches gauche/droite et RTL ; focus perdu sur bouton désactivé ; `showModal` qui lève ; ratio de repli 1600×2000 ; `delaiJours` min > max ou 0 (E) | low | site français seulement, valeurs validées au dépôt ; correctifs ajoutent des branches | rejeté (low) |
| 14 | Fiche d'une œuvre vendue sans rangée (E) | false | l'état vendu est la story 3.7 ; la spec vise une œuvre publiée disponible | rejeté |
| 15 | Statuts spec / sprint incohérents (B) | false | le sprint passe en `review` à l'étape de présentation | rejeté |
| 16 | Grille Technique/Médium/Année retouchée (E) | low | changement de classes seulement, onglets et panier intacts | rejeté |
| 17 | Défilement fluide qui fait clignoter le compteur (B) | low | bref et sans perte d'information | rejeté |
| 18 | Test de source « aucun seuil dans les composants » fragile (V) | low | garde-fou utile, ne casse que sur un littéral 40 ou 100 | rejeté |

## Design Notes

Décisions prises sans question (le visiteur ne les distingue pas) : repli sur `imageUrl` quand l'œuvre n'a pas de `PhotoOeuvre` (œuvres déposées avant la story 2.5) ; les photos suivent le cache de 60 s du catalogue ; les onglets restent tels quels jusqu'à la 3.6.

## Verification

**Commands:**
- `npx eslint .` et les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …` -- aucune erreur, aucun ajout
- `npm test` et `npm run build` -- réussis

**Manual checks:**
- Préversion : fiche d'une œuvre de Kara Walker sur mobile (375 px) : carrousel, rangée, changement de pays, bascule cm/in.
