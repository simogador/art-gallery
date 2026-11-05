---
title: 'Story 3.2 — Textes, montants et unités au même format partout'
type: 'feature'
created: '2026-11-05'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'd8740310f2140caf095d80b5e464ace3f00dac31'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-3-1-interface-lisible-accessible.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Prix, dimensions, dates et heures sont formatés à la main en plusieurs endroits (`formatPrice` avec une espace sécable avant « € », `toLocaleString` dispersés, « 15:42 » au lieu de « 15 h 42 ») ; les textes d'interface sont écrits en dur ; le visiteur ne peut pas choisir les pouces (AR-11, AD-18, FR-17, UX-DR21).

**Approach:**
- Module `src/lib/i18n/`, sans bibliothèque (AD-18) : dictionnaire français typé (`fr.ts`, objet `as const`, clés par surface) et fonctions pures en locale `fr` :
  - `formaterMontant(centimes, devise = 'EUR')` → « 1 450 € » (séparateur de milliers et espace avant le symbole : U+202F) ; centimes affichés seulement s'ils existent (« 1 450,50 € »).
  - `formaterDimensions(mm, unite)` → « 61 × 76 cm » ou « 24 × 29,9 in » (U+202F autour de « × » et avant l'unité ; cm à une décimale au plus, pouces à une décimale, virgule) ; `formaterDimensionsDouble` pour la fiche (unité choisie, puis l'autre).
  - `formaterDate`, `formaterHeure` (« 15 h 42 », 24 h), `formaterDateHeure`, fuseau `Europe/Paris` par défaut, paramétrable.
- Toutes les mises en forme existantes passent par ces fonctions : `formatPrice`, `formaterDimensions` de `catalogue/conversions` (qui délègue), `heureLisible`, dates de `mappers` et de l'administration, `InvitationArtiste`.
- Bascule cm/in : composant `UniteToggle` (contrôle segmenté « cm / in », 44 px, `DESIGN.md`), choix mémorisé dans un cookie `unite` (un an, lu par le serveur pour un rendu sans clignotement) ; la galerie et la fiche affichent la bascule ; le type d'affichage `Artwork` porte les millimètres ; tout le site affiche l'unité choisie en premier, la fiche montre toujours les deux.
- Règle ESLint `react/jsx-no-literals` (erreur) sur les surfaces de l'epic 3 (accueil, galerie, fiche, artistes, en-tête, pied de page) : les textes viennent du dictionnaire. Comme en 3.1 (décision du porteur du 2026-11-05), les fichiers refaits par les stories 3.5 à 3.11 sont exclus par une liste qui ne fait que diminuer (`eslint/exceptions-textes.cjs`, contrôlée en CI) ; l'en-tête et le pied de page sont migrés maintenant.
- Aucun sélecteur de langue ni de devise (OQ-6).

## Boundaries & Constraints

**Always:** montants en centimes entiers, dimensions en millimètres (AD-5), conversions à l'affichage seulement ; textes en français ; règles d'interface de la story 3.1.

**Never:** bibliothèque d'internationalisation ; préfixe de langue dans les URL ; nouvelle colonne ou migration ; toucher `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`, les secrets ou les réglages Vercel/Neon.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Montant | 145000 centimes | « 1 450 € » (U+202F) | `null` → « — » |
| Dimensions cm | 610 × 760 mm | « 61 × 76 cm » | hauteur ou largeur absente → chaîne vide |
| Dimensions in | 610 × 760 mm, unité `in` | « 24 × 29,9 in » | — |
| Fiche | unité `in` | « 24 × 29,9 in » puis « 61 × 76 cm » | — |
| Heure | 15:42 à Paris | « 15 h 42 » | — |
| Bascule | clic sur « in » puis rechargement | pouces en premier partout, cookie `unite=in` | cookie absent ou invalide → cm |

</frozen-after-approval>

## Code Map

- `src/lib/utils/artworks.ts:4` -- `formatPrice` (euros flottants, espace sécable avant « € ») : déléguer à `formaterMontant` ; 13 fichiers l'appellent. Prix écrits à la main : `components/sections/Gallery.tsx:279`, `app/galerie/GalleryPage.tsx:495`.
- `src/lib/catalogue/conversions.ts:63,97,103,140-144,165` -- `centimesEnEuros`, `enCentimetres`, `formaterDimensions` (espaces simples), `champsDimensionsModifiees` compare le texte posté à `formaterDimensions` : garder le même rendu pour le préremplissage ; `lireDimensions` accepte déjà U+00A0 et U+202F (:71).
- `src/lib/catalogue/mappers.ts:53,125` et `src/lib/types` -- date d'exposition, `size` préformaté : ajouter `hauteurMm`/`largeurMm`/`profondeurMm` au type d'affichage.
- `src/lib/curation/depot-regles.ts:302,396-400` -- `enPouces` (une décimale, virgule) : précédent à reprendre ; `RecapitulatifOeuvre.tsx:106` compose cm et pouces à la main.
- `src/lib/disponibilite/etats.ts:220-227` -- `heureLisible` (« 10 h 12 », Europe/Paris) : modèle de `formaterHeure`.
- Dates : `curation/curation-regles.ts:126`, `dashboard/admin/page.tsx:119`, `dashboard/admin/utilisateurs/[id]/page.tsx:75,110`, `InvitationArtiste.tsx:18` (« 15:42 »).
- `.eslintrc.js` -- un seul bloc `overrides` (AD-1, `excludedFiles` via `echapperGlob`) : même modèle ; `eslint-plugin-react` déjà chargé par `next/core-web-vitals`.
- `scripts/verifier-exceptions-prisma.cjs` -- accepte une liste en troisième argument ; `.github/workflows/ci.yml` l'appelle déjà pour `tests/exceptions-interface.cjs`.
- Tests : `tests/catalogue.test.ts:76-107` attend des espaces simples (`'294,6 × 232,1 cm'`) ; nouveaux tests purs dans `tests/i18n.test.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/i18n/{index,fr,formats,unite}.ts` -- dictionnaire, formatage, lecture du cookie `unite`.
- [x] Appelants listés -- passage par `i18n` ; `Artwork` avec millimètres.
- [x] `src/components/ui/UniteToggle.tsx`, galerie et fiche -- bascule et affichage des deux unités sur la fiche.
- [x] `src/components/layout/{Header,Footer}.tsx` -- textes du dictionnaire.
- [x] `.eslintrc.js`, `eslint/exceptions-textes.cjs`, `.github/workflows/ci.yml` -- règle, liste, contrôle.
- [x] `tests/i18n.test.ts` -- matrice ; tests existants mis à jour.
- [x] `AGENTS.md` -- module `i18n`, bascule, règle des textes.

**Acceptance Criteria:**
- Given `src/`, when on cherche `toLocaleString`, `toLocaleDateString` ou `Intl.DateTimeFormat`/`NumberFormat` hors de `src/lib/i18n/`, then il n'y a aucun résultat (sauf `Intl.DisplayNames` des pays).
- Given une chaîne visible écrite en dur dans l'en-tête ou le pied de page, when on lance `npx eslint .`, then une erreur est signalée.

## Implementation Notes

- `src/lib/i18n/` : `formats.ts` (seul usage d'`Intl.DateTimeFormat` de `src/`, hors `Intl.DisplayNames` des pays), `unite.ts` (pur : `lireUnite(valeur du cookie)`, `cookieUnite`), `fr.ts`, `index.ts`. Montant et dimensions écrits à la main (pas d'`Intl.NumberFormat`) pour garantir U+202F partout ; dimensions sans séparateur de milliers (le texte prérempli doit rester lisible par `lireDimensions`).
- Unité : le layout racine (déjà dynamique par `auth()`) lit le cookie et fournit `UniteProvider` ; `useUnite()` dans les vignettes (accueil, galerie, artiste), le Hero et la fiche ; la bascule met à jour tout le site sans rechargement et écrit le cookie (`Path=/`, un an, `SameSite=Lax`).
- `Artwork.size` retiré du type d'affichage au profit des millimètres (tout affichage passe par l'unité choisie).
- `champsDimensionsModifiees` compare aux espaces près (U+202F, U+00A0, espaces multiples) : un texte prérempli en espaces fines ou retapé en espaces simples laisse les colonnes intactes.
- Règle `react/jsx-no-literals` : `noStrings`, `ignoreProps` (les attributs — classes, `href`, `aria-label` — ne sont pas visés ; l'en-tête et le pied de page passent quand même leurs `aria-label` par le dictionnaire), ponctuation seule permise. Liste `eslint/exceptions-textes.cjs` = les huit fichiers de `tests/exceptions-interface.cjs` ; `tests/i18n.test.ts` vérifie qu'un fichier listé échoue encore à la règle et qu'un texte en dur dans `Header`/`Footer` est une erreur.
- Relecture 1 : `Dictionnaire` élargi (`fr` vérifié par `satisfies`) ; liens du pied de page `{ libelle, ancre }` ; `formaterMontant` lit la devise en majuscules et reçoit celle de l'appelant (`Artwork.devise`, `session.currency`, `DepotLu.devise`), total absent de la confirmation → « — » ; dates et heures illisibles (date invalide, fuseau inconnu) → « — » ; séparateur unique `SEPARATEUR` (U+00A0 avant « · ») ; espace artiste et récapitulatif dans l'unité choisie par `DimensionsChoisies` (client, `useUnite()`), le préremplissage d'édition reste en cm ; `OeuvreArtiste` porte les millimètres ; bascule : `fond-sombre` sur le segment actif, `aria-label` « centimètres »/« pouces », `aria-labelledby` sur la fiche, `UniteProvider` resynchronisé sur `initiale`.
- Textes du pied de page repris tels quels, sauf « 10h – 19h » → « 10 h – 19 h » (format des heures).

## Spec Change Log

## Review Triage Log

Revue 1 (blind-hunter, edge-case-hunter, verification-gap).

| # | Source | Constat | Verdict | Route |
|---|--------|---------|---------|-------|
| 1 | blind | `Dictionnaire = typeof fr` (littéraux `as const`) : un second dictionnaire ne compilerait pas | medium — contredit AD-18 (prêt pour d'autres langues) | patch |
| 2 | blind | `formaterMontant` : devise ignorée par les appelants, `eur` en minuscules non reconnu, « 0 € » pour un montant Stripe absent | medium | patch |
| 3 | blind, edge | Unité choisie ignorée dans l'espace artiste et le récapitulatif de curation (« tout le site » dans l'intention) | medium | patch |
| 4 | verif, blind | Aucun rendu testé avec `UniteProvider` (pouces, ordre des deux unités sur la fiche, `aria-pressed`) ni ligne « Dimensions » du récapitulatif | medium | patch |
| 5 | blind, edge | Pied de page : libellés et ancres appariés par position | low — correction directe | patch |
| 6 | blind | Bascule : bouton actif sans `fond-sombre`, noms accessibles « cm »/« in » | low — correction directe | patch |
| 7 | edge | Date invalide : `Intl` lève `RangeError` et fait tomber la page | low — garde directe | patch |
| 8 | edge | `UniteProvider` ne suit pas un nouveau cookie après un nouveau rendu serveur | low — correction directe | patch |
| 9 | blind | Séparateur « · » à espaces sécables à côté de dimensions insécables | low — constante commune | patch |
| 10 | blind | Tâche « Appelants listés » non cochée, AGENTS.md (« retire un fichier ») inexact | low | patch |
| 11 | blind | Prix public absent affiché « 0 € » (`price ?? 0`) | low — antérieur ; toute œuvre publiée par la curation a un prix | rejet |
| 12 | blind | `ignoreProps` : `aria-label`, `alt`, `placeholder` non contrôlés | low — `noAttributeStrings` viserait aussi `className` ; reporté | defer |
| 13 | blind | Coordonnées du pied de page inventées (adresse, téléphone, e-mail, marque « Galerie ») déplacées telles quelles dans le dictionnaire | medium — antérieur à la story ; à trancher par le porteur avant l'ouverture | defer |
| 14 | edge | Récapitulatif aux dimensions partielles affiché « — » | low — l'envoi en curation exige hauteur et largeur | rejet |
| 15 | blind | Signe moins ASCII pour un montant négatif | low — aucun montant négatif affiché | rejet |
| 16 | blind | Statuts spec / sprint-status différents | false — synchronisés à la présentation | rejet |

## Verification

**Commands:**
- `npx eslint .` -- aucune erreur
- `node scripts/verifier-exceptions-prisma.cjs origin/main` (et `… tests/exceptions-interface.cjs`, `… eslint/exceptions-textes.cjs`) -- aucun ajout
- `npm test` -- tous verts
- `npm run build` -- réussi

**Manual checks:**
- Préversion : bascule cm/in dans la galerie, rechargement, choix conservé ; aucun sélecteur de langue ni de devise.
