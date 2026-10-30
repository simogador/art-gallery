---
title: 'Story 2.2 — Publication et disponibilité, deux états distincts'
type: 'feature'
created: '2026-10-30'
status: 'done'
route: 'dispatch'
baseline_commit: '9f49b476f681ff4f6d4a72471096272a70a69c90'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md', '{project-root}/docs/migrations.md', '{project-root}/_bmad-output/implementation-artifacts/spec-2-1-prix-et-dimensions-exacts.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un seul booléen, `Artwork.available`, mélange aujourd'hui deux choses : la mise en ligne (curation) et la vente. Les écrans le lisent chacun à leur façon (AD-6, AD-7, AR-10).

**Approach:** Temps 1 à 3 d'AD-20, comme pour la story 2.1.
- **Deux colonnes facultatives** : `publication` (`brouillon`, `en_curation`, `publiee`) et `disponibilite` (`disponible`, `reservee`, `vendue`, `vendue_ailleurs`, `retiree`), en énumérations PostgreSQL.
- **Recopie SQL idempotente** : `available = true` donne `publiee` + `disponible`, `false` donne `publiee` + `vendue`.
- **Qui écrit quoi** : la disponibilité n'est écrite que par le module `disponibilite`, la publication que par le module `curation`.
- **Définition unique** : `disponibilite` exporte celle de « visible » (`publiee` et non `retiree`) et celle de « disponible » (`publiee` et `disponible`), chacune sous forme de prédicat et de fragment de requête Prisma. Catalogue, espace artiste, administration et paiement l'utilisent, et aucun autre fichier ne lit les colonnes brutes.
- **Pages publiques** : elles ne montrent que les œuvres visibles. L'URL d'une œuvre `retiree` redirige en 301 vers la page de son artiste, et une œuvre non publiée renvoie une 404.
- **Double écriture** : `available` reste écrit, égal à « disponible », pour que le retour au commit précédent reste possible.
- **Nouvelle œuvre d'un artiste** : elle naît en `brouillon` + `disponible`. Un admin la publie depuis l'administration, en attendant la curation complète (story 2.7). La règle d'accord signé (FR-16) viendra avec les stories 2.4 et 2.7, car aucune donnée ne le porte encore.
- Le porteur applique le SQL depuis l'éditeur de Neon : branche de sauvegarde, `preview`, puis production avant la fusion (`docs/migrations.md`).

## Boundaries & Constraints

**Always :**
- Nouvelles colonnes facultatives, sans valeur par défaut, pour que l'ancien code insère sans elles. Une œuvre dont les colonnes sont vides n'est ni visible ni disponible.
- Une seule définition de « visible » et de « disponible ».
- Écritures uniquement via `disponibilite` et `curation`.
- Migration commitée, générée contre un PostgreSQL local.
- Requête d'écarts à lancer après la fusion, comme pour la story 2.1.

**Never :**
- Supprimer `available` (story 2.10).
- Réservation ou expiration (epic 6).
- Déclaration « vendue ailleurs » ou « retirée » par l'artiste (story 2.8).
- File de curation (story 2.7).
- Toucher à `MAINTENANCE_MODE`, `robots.txt`, `src/generated/prisma/` ou un secret.
- Appliquer une migration sur une base partagée.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Recopie disponible | `available` true | `publiee` + `disponible` | N/A |
| Recopie vendue | `available` false | `publiee` + `vendue` | N/A |
| Recopie rejouée | script lancé deux fois | même résultat, aucune valeur présente écrasée | N/A |
| Galerie | œuvres `publiee`/`disponible`, `publiee`/`vendue`, `brouillon`, `publiee`/`retiree`, colonnes vides | seules les deux premières listées, la vendue marquée vendue | N/A |
| Fiche retirée | URL d'une œuvre `retiree` | 301 vers `/artistes/<slug de l'artiste>` | N/A |
| Fiche non publiée | `brouillon` ou `en_curation` | 404 | N/A |
| Paiement | œuvre `publiee` mais `vendue`, `reservee` ou `retiree` | refusé : « n'est plus disponible » | 400 |
| Webhook payé | session avec slugs | `disponibilite` = `vendue` et `available` = false, idempotent | N/A |
| Création artiste | nouvelle œuvre | `brouillon` + `disponible`, absente du catalogue | N/A |
| Publication admin | admin publie ou retire la publication | `publiee` ou `brouillon` ; refusé hors admin | 403 |
| Disponibilité admin | bascule « Disponible / Vendue » | `disponible` ou `vendue`, `available` cohérent | 403 hors admin |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` (`model Artwork`) -- enums `Publication` et `Disponibilite` (valeurs ci-dessus), colonnes `publication Publication?` et `disponibilite Disponibilite?`, avec un index sur les deux.
- `src/lib/catalogue/{artworks,artists,exhibitions,mappers,espace-artiste}.ts` -- filtrent ou lisent `available`.
  - `mapArtwork` calcule `sold: !w.available`.
  - `espace-artiste.ts` calcule le chiffre d'affaires sur `available: false`.
  - Remplacer par le fragment et le prédicat de `disponibilite` ; l'UI garde son booléen `sold`, égal à « non disponible ».
- `src/app/galerie/[id]/page.tsx` -- `getArtworkBySlug` puis `notFound()`. Ajouter un cas « retirée » qui redirige en 301 (`permanentRedirect` de Next) vers l'artiste.
- `src/app/api/checkout/route.ts` -- `if (!artwork.available)` devient le prédicat « disponible ».
- `src/app/api/webhooks/stripe/route.ts` -- deux `updateMany({ data: { available: false } })` (lignes 49 et 101) à remplacer par une fonction de `disponibilite` qui écrit `vendue` et `available` = false.
- `src/app/api/admin/oeuvres/[slug]/route.ts` -- `body.available` passe par `disponibilite`. Ajouter `body.publiee` (booléen), qui passe par `curation`.
- `src/app/api/artiste/oeuvres/route.ts` -- création : `brouillon` + `disponible`, via `curation` et `disponibilite`.
- Administration :
  - `src/app/dashboard/admin/page.tsx` : comptages ;
  - `src/app/dashboard/admin/oeuvres/page.tsx` et `[slug]/page.tsx` : `ToggleAction` sur `available` ; ajouter une bascule « Publiée / Brouillon ».
- Espace artiste : `src/app/dashboard/artiste/page.tsx`, `oeuvres/page.tsx`, `oeuvres/[slug]/page.tsx` -- badge « Disponible / Vendue ». Le remplacer par un libellé calculé par `disponibilite` (Brouillon, En curation, Disponible, Réservée, Vendue, Vendue ailleurs, Retirée).
- `src/components/dashboard/ToggleAction.tsx` -- générique (champ booléen), à réutiliser tel quel.
- `.eslintrc.js` -- `MODULES_METIER` contient déjà `curation` et `disponibilite`. `eslint/exceptions-prisma.cjs` : la liste ne doit pas grossir.
- `prisma/seed.ts` -- remplir les deux colonnes.
- Story 2.1 (`spec-2-1-prix-et-dimensions-exacts.md`) -- modèles à reprendre :
  - les scripts `scripts/sql/*.sql` : recopie, contrôle, écarts ;
  - la procédure de `docs/migrations.md` ;
  - les tests sur base jetable de `tests/catalogue.test.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` + `prisma/migrations/<horodatage>_publication_disponibilite/` -- enums, colonnes et index, migration générée sans écart -- temps 1.
- [x] `src/lib/disponibilite/index.ts` -- fragments `VISIBLE` et `DISPONIBLE`, prédicats `estVisible` et `estDisponible`, `libelleEtat`. Écritures : `marquerVendues(slugs)`, `definirDisponibilite(acteur, slug, disponible)`, `disponibiliteInitiale()`. Toujours en double écriture avec `available` -- module unique de la disponibilité.
- [x] `src/lib/curation/index.ts` -- `publicationInitiale()` (brouillon) et `definirPublication(acteur, slug, publiee)`, réservée aux admins.
- [x] Lectures : catalogue public, espace artiste, administration, paiement -- passent par `disponibilite` -- temps 3.
- [x] Écritures : webhook, routes admin et artiste -- passent par les modules.
- [x] `src/app/galerie/[id]/page.tsx` -- 301 si retirée, 404 si non publiée.
- [x] Administration -- bascule de publication, et comptages via le module.
- [x] `scripts/sql/recopie-publication-disponibilite.sql`, `scripts/sql/ecarts-publication-disponibilite.sql` -- temps 2.
- [x] `prisma/seed.ts` -- remplir les colonnes.
- [x] `tests/disponibilite.test.ts` -- matrice I/O sur base jetable : recopie lancée deux fois, galerie, 301, 404, paiement, webhook, création, droits admin, requête d'écarts.
- [x] `docs/migrations.md` (story 2.2) et `AGENTS.md` (où lire la publication et la disponibilité).

**Acceptance Criteria:**
- Given la migration et la recopie appliquées, when on parcourt la galerie, une fiche, l'espace artiste ou l'administration, then publication et disponibilité viennent des nouvelles colonnes, via le module `disponibilite`.
- Given la base migrée, when on revient au commit précédent, then le site fonctionne : `available` reste cohérent.
- Given une recherche dans `src/`, then aucune lecture ni écriture de `publication`/`disponibilite` hors de `src/lib/disponibilite`, `src/lib/curation` et des tests.

## Design Notes

- La bascule admin « Disponible / Vendue » garde son libellé et écrit `disponible` ou `vendue`. Les autres états (`reservee`, `vendue_ailleurs`, `retiree`) n'ont pas encore d'écran.
- Un `reservee` ou un `retiree` n'est pas « disponible » : il apparaît comme vendu dans l'UI tant qu'aucun écran ne le distingue (epic 3).

## Verification

**Commands:**
- `npx eslint .` ; `node scripts/verifier-exceptions-prisma.cjs origin/main` -- expected : OK, la liste ne grossit pas.
- `npx tsc --noEmit` ; `npm test` -- expected : tout passe.
- Migrations appliquées sur une base vide, puis `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` -- expected : aucun écart.
- `npm run build` -- expected : succès.

## Implementation Notes

- Migration `20261030090000_publication_disponibilite` : SQL produit par `prisma migrate diff` contre la base locale à jour (PostgreSQL 16) ; migrations appliquées sur une base vide, puis `migrate diff --exit-code` : aucun écart.
- `src/lib/disponibilite/etats.ts` (pur, importable côté client via `catalogue/mappers`) : `CHAMPS_ETAT` (fragment de `select`), fragments `VISIBLE`, `DISPONIBLE`, `RETIREE`, `VENDUE`, `PUBLIEE`, prédicats `estVisible`, `estDisponible`, `estVendue`, `estPubliee`, `estMarqueeDisponible` (axe seul, pour la bascule admin), `codeEtat` / `libelleEtat` (sept états), `champAvailable`. `index.ts` : `disponibiliteInitiale`, `marquerVendues`, `definirDisponibilite`, `compterOeuvres`. Colonnes vides : ni visibles ni disponibles, libellé « Brouillon ».
- `available` = « disponible » (publiée **et** disponible), pas l'axe seul : une nouvelle œuvre (`brouillon` + `disponible`) a `available = false`, donc jamais achetable par l'ancien code après un retour arrière. `curation.definirPublication` recalcule `available` dans la même écriture, via `champAvailable` de `disponibilite` (seule définition).
- Fiche : `permanentRedirect` de Next renvoie un **308** (redirection permanente), pas un 301 au sens strict. Une œuvre `brouillon` + `retiree` donne 404 (non publiée prime).
- Pages publiques : galerie, fiche, œuvres liées, page artiste (liste et compte), expositions (listes, comptes, artistes) filtrées sur `VISIBLE`. `sold` de l'UI = non disponible.
- Comptages « vendues » (admin, espace artiste) et chiffre d'affaires de l'artiste : `disponibilite = vendue` seulement (égal à l'ancien `available = false` après recopie).
- Route admin : `body.publiee` → `curation`, `body.available` → `disponibilite` ; codes `acces_refuse` → 403, `introuvable` → 404 ; mise à jour des autres champs par `updateMany` (404 au lieu d'une erreur 500 sur une œuvre inconnue). La réponse ne renvoie plus `available`.
- Seed : mêmes règles que la recopie, colonnes vides seulement.
- Revue : `definirDisponibilite` refuse (`transition_interdite`, 409) hors `disponible`/`vendue` ; les pages admin n'affichent la bascule que pour ces deux états (libellé en lecture seule sinon). `definirPublication` et `definirDisponibilite` refusent une œuvre non recopiée (`non_recopiee`, 409) et verrouillent la ligne (`SELECT … FOR UPDATE`, `lireEtatVerrouille`) avant de lire l'autre axe ; `marquerVendues` verrouille aussi, écrit toujours `vendue` et journalise (slugs seulement) les œuvres qui n'étaient pas publiées et disponibles ou réservées. Lien « Voir » seulement pour une œuvre visible. Comptes « vendues » de l'espace artiste = `estVendue`, comme le chiffre d'affaires. Ajouts : `scripts/sql/vendues-sans-commande.sql` (contrôle après recopie) et `scripts/sql/corriger-ecarts-publication-disponibilite.sql` (correction ciblée, remplace « vider et recopier »).
- Liste d'exceptions Prisma inchangée (19) : les fichiers touchés lisent encore Prisma pour d'autres données (commandes, artistes, champs d'édition).
- `tests/disponibilite.test.ts` : matrice I/O sur base jetable, plus un test qui interdit tout accès brut aux deux colonnes dans `src/` hors des deux modules. `tests/catalogue.test.ts` (2.1) applique la recopie 2.2 avant de lire le catalogue ; `tests/lot2.test.ts` : maquettes complétées des deux colonnes.

## Spec Change Log

## Review Triage Log

- Bascule admin « Disponible / Vendue » qui écrase `reservee`, `vendue_ailleurs`, `retiree` — medium : vrai ; patch (refus 409 `transition_interdite`, bascule masquée hors disponible/vendue).
- Écriture d'un axe sur une ligne non recopiée — low : vrai (fenêtre migration → fusion) ; patch (refus `non_recopiee`).
- Écritures concurrentes publication / paiement laissant `available` incohérent — medium : vrai (READ COMMITTED) ; patch (verrou `FOR UPDATE`), test de concurrence.
- `marquerVendues` écrase un état hors vente sans trace — medium : vrai ; patch (journal des slugs, sans e-mail).
- Lien « voir dans la galerie » en 404 pour une œuvre non publiée — low : vrai ; patch.
- Nombre de vendues et chiffre d'affaires calculés par deux règles — low : vrai ; patch (`estVendue`).
- Recopie : `available = false` peut désigner une œuvre masquée et non vendue — medium : vrai ; patch (`vendues-sans-commande.sql` à relire par le porteur).
- Correction d'écarts documentée qui efface des états — medium : vrai ; patch (correction ciblée `corriger-ecarts-publication-disponibilite.sql`, testée).
- Expositions et œuvres liées non testées ; lecture de `available` non interdite — medium : vrai (gaps) ; patch (tests et analyse des sources).
- Redirection en 308 et non 301 (`permanentRedirect`) — low : vrai ; même effet permanent pour les moteurs ; posé au porteur dans la PR.
- PUT admin en plusieurs écritures (mise à jour partielle) ; booléen invalide ignoré — low : l'interface n'envoie qu'un champ ; rejeté.
- Aucune interface pour `reservee`, `vendue_ailleurs`, `retiree`, `en_curation` — false : hors périmètre (stories 2.7, 2.8, epic 6) ; 301 testée par la suite.
- Œuvre réservée affichée « vendue » au public — false : choix noté en Design Notes (epic 3).
- Vente manuelle comptée dans le chiffre d'affaires — low : comportement préexistant ; rejeté.
- Bascule de publication absente sur mobile — low : même gabarit que la bascule existante ; rejeté.
- Statuts spec / sprint — false : mis à jour à la présentation.
