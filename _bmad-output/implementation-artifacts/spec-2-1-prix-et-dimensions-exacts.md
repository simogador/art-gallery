---
title: 'Story 2.1 — Prix et dimensions exacts au centime et au millimètre'
type: 'feature'
created: '2026-10-29'
status: 'done'
route: 'dispatch'
baseline_commit: '785f346f06a0b317091f00f42ac738244ab34736'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md', '{project-root}/docs/migrations.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `Artwork.price` est un `Float` en euros et `Artwork.dimensions` un texte libre : le prix envoyé à Stripe passe par un arrondi et aucune taille n'est exploitable (AD-5, AR-10).

**Approach:** Temps 1 à 3 d'AD-20. On ajoute des colonnes exactes : le prix en centimes entiers avec sa devise `EUR`, la hauteur, la largeur et une profondeur facultative en millimètres entiers. Un script SQL idempotent recopie les valeurs existantes et liste les dimensions illisibles, sans jamais les deviner. Toutes les lectures d'un prix ou de dimensions passent aux nouvelles colonnes, au travers du module `catalogue`, qui reprend `src/lib/db/`. Les écritures alimentent les anciennes et les nouvelles colonnes, ce qui garde le retour au commit précédent possible. Décision AQ-4 (2026-10-29) : plan gratuit de Neon ; avant chaque migration de données, branche de sauvegarde datée, puis répétition sur `preview`. Le porteur applique le SQL depuis l'éditeur de Neon.

## Boundaries & Constraints

**Always:** les anciennes colonnes restent en place et continuent d'être écrites. Les nouvelles colonnes sont facultatives : l'ancien code doit pouvoir insérer sans elles. L'argent est manipulé en centimes entiers, jamais en `Float` ; les dimensions en millimètres entiers, hauteur d'abord. Le SQL de recopie et la fonction TypeScript de lecture des dimensions suivent les mêmes règles, et les tests le vérifient. Migration commitée, générée contre un PostgreSQL local.

**Never:** supprimer ou renommer une ancienne colonne (story 2.10) ; deviner une dimension illisible ; refondre le formulaire en champs séparés (story 2.5) ; toucher à `Order.amount`, à la disponibilité (story 2.2), à `MAINTENANCE_MODE`, à `robots.txt`, à `src/generated/prisma/` ou à un secret ; appliquer une migration sur une base partagée.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Prix existant | `price` 12400 | `prixCentimes` 1240000, `devise` EUR | N/A |
| Prix absent | `price` NULL | `prixCentimes` NULL, affiché comme aujourd'hui | N/A |
| Dimensions lisibles | « 120 × 90 cm », « 294.6 × 232,1 cm », « 45 x 30 x 28 cm », « 800×600 mm » | H/L/P en mm (1200/900, 2946/2321, 450/300/280, 800/600) | N/A |
| Dimensions illisibles | « Impression 80 × 80 cm », « 120 cm », « variable », « » | colonnes mm NULL ; ligne listée par la requête de contrôle | jamais devinée |
| Recopie rejouée | script lancé deux fois | même résultat, aucune valeur déjà présente écrasée | N/A |
| Saisie formulaire | prix « 1 250,50 », dimensions « 60 × 80 cm » | 125050 centimes ; 600 × 800 mm ; anciennes colonnes aussi écrites | N/A |
| Saisie illisible | dimensions « environ 1 m » | refus 400 avec l'exemple « 120 × 80 cm » | message en français |
| Prix invalide | « -5 », « abc », plus de 2 décimales | refus 400 | message en français |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` (`model Artwork`) -- ajouter `prixCentimes Int?`, `devise String @default("EUR")`, `hauteurMm Int?`, `largeurMm Int?`, `profondeurMm Int?`.
- `src/lib/db/*` -- lectures publiques (`artworks.ts`, `artists.ts`, `exhibitions.ts`, `mappers.ts` : `mapArtwork` lit `price` et `dimensions`). Importé par 13 fichiers via `@/lib/db/...`, à déplacer.
- `.eslintrc.js` -- `MODULES_METIER` contient `db` et `catalogue`. `eslint/exceptions-prisma.cjs` : la liste ne peut que diminuer.
- Écritures : `src/app/api/artiste/oeuvres/route.ts` (POST), `src/app/api/artiste/oeuvres/[slug]/route.ts` (PUT), `src/app/api/admin/oeuvres/[slug]/route.ts` (PUT). Toutes font `parseFloat(price)` et `dimensions.trim()`.
- Lectures hors catalogue public :
  - `src/app/api/checkout/route.ts` : `Math.round(price*100)`.
  - `src/app/confirmation/page.tsx`.
  - Espace artiste : `src/app/dashboard/artiste/page.tsx` (chiffre d'affaires en somme de `Float`), `oeuvres/page.tsx`, `oeuvres/[slug]/page.tsx`.
  - Administration : `src/app/dashboard/admin/oeuvres/page.tsx`, `oeuvres/[slug]/page.tsx`.
- `src/components/dashboard/ArtworkForm.tsx` -- champ texte unique pour les dimensions, prix en `string`. Garder l'interface ; seul le libellé d'aide change.
- `src/lib/utils/artworks.ts` (`formatPrice(euros)`) et `src/lib/types` (`Artwork.price` en euros, `size` en texte) -- types d'affichage conservés.
- `prisma/seed.ts` -- écrit `price` et `dimensions` : y ajouter les nouvelles colonnes à l'aide des conversions.
- `tests/utils/base-jetable.ts` -- base migrée par les migrations du dépôt, pour les tests SQL.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` + `prisma/migrations/<horodatage>_prix_dimensions_exacts/` -- colonnes ajoutées par une migration générée et sans écart -- temps 1.
- [x] `src/lib/catalogue/` (`git mv src/lib/db`) -- `index.ts` (API publique), `conversions.ts` pur : `prixEnCentimes`, `lireDimensions`, `formaterDimensions`, `centimesEnEuros`. Mise à jour des 13 imports, `db` retiré de `MODULES_METIER` -- module unique des lectures.
- [x] `src/lib/catalogue/mappers.ts` + lectures de l'espace artiste dans `catalogue` (accueil, liste, œuvre à éditer) -- lisent `prixCentimes` et les mm. Les trois pages artiste quittent la liste d'exceptions -- temps 3.
- [x] Routes d'écriture (artiste POST/PUT, admin PUT) -- double écriture via `conversions`, refus 400 si illisible -- retour arrière possible.
- [x] `checkout/route.ts`, `confirmation/page.tsx`, pages admin des œuvres -- lisent les nouvelles colonnes (`unit_amount` = `prixCentimes`).
- [x] `scripts/sql/recopie-prix-dimensions.sql` (idempotent) + `scripts/sql/dimensions-illisibles.sql` -- temps 2.
- [x] `prisma/seed.ts` -- remplit les nouvelles colonnes.
- [x] `tests/catalogue.test.ts` -- matrice I/O sur les conversions ; recopie SQL sur base jetable (deux passages, illisibles listés, accord avec `lireDimensions`) ; lecture du catalogue sur les nouvelles colonnes ; refus 400.
- [x] `docs/decisions-porteur.md` (AQ-4), `docs/migrations.md` (procédure des migrations de données : sauvegarde datée, `preview` d'abord, SQL de l'éditeur Neon avec empreinte SHA-256), `AGENTS.md` (`catalogue` au lieu de `src/lib/db/`).

**Acceptance Criteria:**
- Given la migration et la recopie appliquées, when on affiche la galerie, une fiche, le panier, l'espace artiste ou l'administration, then prix et dimensions viennent des nouvelles colonnes.
- Given la base migrée, when on revient au commit précédent, then le site fonctionne, l'ancien code ignorant les colonnes ajoutées.
- Given une œuvre créée ou modifiée après la livraison, then anciennes et nouvelles colonnes sont cohérentes.
- Given le checkout ouvert (`LOT2_OUVERT=oui`), then le montant Stripe vaut exactement `prixCentimes`.

## Design Notes

- Lecture des dimensions, stricte : nombres séparés par `x`, `X` ou `×` (2 ou 3), virgule ou point décimal, unité `cm` ou `mm` finale obligatoire, espaces libres. Aucun autre texte n'est accepté. Arrondi au millimètre (`round`).
- Œuvre dont les dimensions sont illisibles : l'affichage public ne montre aucune taille. Le formulaire d'édition préremplit l'ancien texte pour permettre la saisie manuelle : c'est la seule lecture de l'ancienne colonne.
- Prix saisi : espaces ignorés, virgule acceptée, au plus deux décimales, positif.

## Verification

**Commands:**
- `npx eslint .` ; `node scripts/verifier-exceptions-prisma.cjs origin/main` (liste en baisse) -- expected : OK.
- `npx tsc --noEmit` ; `npm test` (PostgreSQL local) -- expected : tout passe.
- `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code` (base fantôme locale) -- expected : aucun écart.
- `npm run build` -- expected : succès (avec les `DatabaseNotReachable` attendus).

**Manual checks:**
- Galerie, fiche, espace artiste, création puis édition d'une œuvre sur une base locale migrée et recopiée.

## Implementation Notes

- Migration `20261029084432_prix_dimensions_exacts` générée contre un PostgreSQL 16 local ; `migrate diff` sur base vide migrée : aucun écart.
- `lireDimensions` et le SQL de recopie partagent le motif `MOTIF_DIMENSIONS` (le test vérifie que le SQL le contient mot pour mot). Arrondi au millimètre en décimal exact des deux côtés (chaînes en TypeScript, `numeric` en SQL), moitié vers le haut ; une valeur arrondie à 0 mm est illisible. Unité `cm`/`mm` en minuscules seulement ; nombres limités à 6 chiffres avant la virgule.
- Écritures : `champsPrix` / `champsDimensions` (conversions) donnent anciennes et nouvelles colonnes ; l'ancienne colonne `dimensions` reçoit le texte normalisé (`formaterDimensions`), relu à l'identique. Dimensions vides acceptées (toutes colonnes vides), comme avant ; l'obligation vient en 2.5/2.6. Prix `0` = pas de prix, comme l'ancien formulaire ; négatif refusé. En modification, un texte de dimensions illisible renvoyé inchangé laisse les colonnes intactes ; le formulaire préremplit l'ancien `price` tant que `prixCentimes` est vide. La recopie ne copie que les prix exacts au centime (≥ 1 centime) ; `scripts/sql/ecarts-prix-dimensions.sql` liste les écarts à corriger juste après la fusion.
- Champ prix du formulaire passé de `type=number step=100` à `type=text inputMode=decimal` : sinon « 1 250,50 » est impossible à saisir. Le prix est envoyé tel que saisi et converti au serveur.
- `prixCentimes` est un `Int` (spec) : plafond 21 474 836,47 €. Trois œuvres de démonstration du seed (28 M€, 86,9 M€, 110,5 M€) ne sont pas recopiées ; requête de contrôle ajoutée : `scripts/sql/prix-non-recopies.sql`.
- Pages admin, checkout et confirmation lisent les nouvelles colonnes mais restent dans la liste d'exceptions (hors périmètre) ; les trois pages artiste en sortent (22 → 19).

## Spec Change Log

## Review Triage Log

- L'édition efface l'ancien prix quand `prixCentimes` est vide — medium : vrai (préremplissage vide puis double écriture) ; patch : préremplissage depuis `price`, test.
- Dimensions anciennes illisibles : toute modification refusée en 400 — medium : vrai ; patch : texte renvoyé inchangé = colonnes intactes, test.
- Prix `0` refusé alors qu'il valait « sans prix » — low : vrai ; patch : 0 = pas de prix.
- Recopie SQL et `prixEnCentimes` en désaccord (plus de deux décimales arrondies, 0 < prix < 0,005 → 0) — low : vrai ; patch : prix exact au centime et ≥ 1 seulement, test.
- Écart possible entre la migration en production et la fusion (ancien code qui modifie `price`) — medium : vrai ; patch : `ecarts-prix-dimensions.sql`, étape 7 de `docs/migrations.md`, test.
- Seed relancé : `update: {}` laisse les colonnes exactes vides — low : vrai ; patch.
- Checkout sans `prixCentimes` non testé — medium : vrai (gap) ; patch : test 400.
- Plafond `Int` (21 474 836,47 €) non consigné comme décision — low : vrai mais conforme à la spec (« centimes entiers ») ; aucune œuvre réelle n'en approche ; posé au porteur dans la PR.
- Affichage du prix (confirmation, liste admin) non testé — low : vrai ; différé (pas de rendu de pages dans la suite).
- Charge utile du formulaire (prix envoyé brut) non testée — low : vrai ; différé (pas de tests de composants), vérification manuelle en préversion.
- Contraintes `CHECK` absentes (prix > 0, mm ≥ 1, devise) — low : vrai ; rejeté pour cette story (les écritures passent par `conversions`), différé.
- `@/lib/catalogue` importable depuis un composant client — low : risque non réalisé (aucun import client) ; rejeté.
- Artiste relu en base deux fois par page — low : vrai, coût d'une requête ; rejeté.
- Chiffre d'affaires sans les œuvres non recopiées, somme en `bigint` — low : seules les œuvres de démonstration dépassent le plafond ; somme en JS sur des `Int` ; rejeté.
- Statuts spec / sprint différents — false : le sprint passe en `review` à la présentation (étape 5).
- Duplication d'affichage `formatPrice(centimesEnEuros(x)!)`, `?? 0` du mapper — low : cosmétique ou préexistant ; rejeté.
- Panier en localStorage avec l'ancien prix — false : préexistant ; le checkout relit `prixCentimes` en base.
- Lectures admin/checkout/confirmation hors `catalogue` — false : la spec les laisse dans les exceptions.
- Analyseur trop étroit (unité `m`, `CM`, séparateur de milliers) — false : règle stricte voulue (« jamais deviné ») ; les textes refusés sont listés pour saisie manuelle.
