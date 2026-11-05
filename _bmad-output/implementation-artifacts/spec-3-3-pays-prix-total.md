---
title: 'Story 3.3 — Pays de livraison et prix total calculé en un seul endroit'
type: 'feature'
created: '2026-11-05'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '6c335206d4fcd0c5c8cbfa4d39360f78b747d9f8'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-3-2-formats-textes-montants.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le visiteur ne voit que le prix de l'œuvre seule : ni frais de livraison vers son pays, ni délai, ni indication qu'une œuvre n'est pas livrée chez lui. Les offres par zone (story 2.6) existent en base mais aucune page ne les lit (FR-3, FR-4, AD-12).

**Approach:**
- Module `livraison` (seul endroit du calcul, aucun composant ne calcule de prix) :
  - `prixLivre(oeuvre, codePays)` → `{ livree: true, totalCentimes, devise, fraisCentimes, delaiMinJours, delaiMaxJours }` ou `{ livree: false, raison: 'pas_de_zone' | 'non_livree' | 'sans_prix' }` ; total = `prixCentimes` + `fraisCentimes` de l'offre de la zone du pays ; délai = `preparationJours` + `transportMin/MaxJours` ; pays sans zone, offre absente ou `livree = false` → non livrée ; devises différentes entre œuvre et offre → non livrée (`devise_differente`).
  - `prixLivresPourPays(codePays)` : même règle en SQL (fragment `Prisma.sql`, jointure `ZonePays` → `OffreLivraison`), qui renvoie le total par œuvre visible pour filtrer et trier ; un test sur base prouve que les deux formes donnent le même montant pour chaque œuvre.
- Pays du visiteur : cookie `pays` (code ISO, un an, comme `unite` en 3.2), lu par le serveur et passé explicitement aux fonctions de prix ; défaut `FR` (hypothèse en attendant OQ-13) ; valeur invalide → `FR`.
- Composant `PaysLivraison` : pays affiché, lien « Modifier » ouvrant la liste des pays (noms de `livraison/pays`), choix enregistré par une action serveur qui pose le cookie puis rafraîchit la page (`router.refresh`) ; zone `aria-live="polite"` annonçant « Prix et délais recalculés pour [pays] ».
- Affichage minimal, en attendant les refontes 3.5 et 3.9 : la fiche montre « Prix livré » (total, pays, « Modifier »), le délai (« Livrée sous 12 à 16 jours ») ou « Pas de livraison vers [pays] » ; les cartes de la galerie montrent le prix livré et le délai ; chaque prix total porte « Droits et taxes d'import éventuels non inclus ». Les pages qui affichent un prix livré sont rendues à chaque requête (fiche : retrait de `revalidate = 60`).
- Textes dans le dictionnaire `fr` (story 3.2).

## Boundaries & Constraints

**Always:** montants en centimes, formatés par `formaterMontant` ; zones et offres lues en base, jamais codées en dur ; lectures par les modules (`livraison`, `catalogue`) ; règles d'interface (3.1) et de textes (3.2).

**Never:** changer le paiement (`/api/checkout`, Lot 2 fermé) ; nouvelle colonne ou migration ; trancher OQ-3 (qui paie la livraison) ou OQ-13 (pays deviné) ; toucher `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`, les secrets ou les réglages Vercel/Neon.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Livrée | œuvre 1 450 €, zone UE 40 €, prépa 3, transport 5-9, pays `FR` | total 1 490 €, « Livrée sous 8 à 12 jours » | — |
| Zone non livrée | offre `livree = false` pour la zone du pays | « Pas de livraison vers [pays] » | — |
| Pays sans zone | pays absent de `ZonePays` | « Pas de livraison vers [pays] » | — |
| Sans offre | aucune offre pour la zone | non livrée | — |
| Sans prix | `prixCentimes` nul | non livrée (`sans_prix`) | — |
| Cookie | absent ou code invalide | pays `FR` | — |
| Deux formes | toutes les œuvres visibles, un pays | `prixLivre` et `prixLivresPourPays` donnent le même total | test |
| Changement de pays | choix « Canada » | cookie `pays=CA`, prix recalculés côté serveur, annonce `aria-live` | — |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma:292-330` -- `Zone`, `ZonePays` (`codePays` clé, un pays dans au plus une zone), `OffreLivraison` (`livree`, `fraisCentimes`, `devise`, `preparationJours`, `transportMinJours`, `transportMaxJours`, unique `[artworkId, zoneId]`, contraintes `CHECK`).
- `src/lib/livraison/index.ts` -- module avec base (zones, `offresDeLOeuvre`) : y ajouter `prixLivre` et `prixLivresPourPays` ; `pays.ts` pur (`CODES_PAYS`, `estCodePays`, `nomPays`, `trierParNom`).
- `src/lib/i18n/unite.ts`, `src/app/layout.tsx:60,72`, `src/components/ui/UniteToggle.tsx` -- modèle du cookie (`lireUnite`, `cookieUnite`) ; `fr.ts` a un type `Dictionnaire` explicite (ajouter les clés aux deux).
- `src/lib/catalogue/{artworks,mappers}.ts` -- `getAllArtworks`, `getArtworkBySlug`, `mapArtwork` (sans offres) : joindre le résultat de `livraison` par œuvre pour un pays donné.
- `src/app/galerie/page.tsx`, `GalleryPage.tsx:17,77-80,501` (tri client sur le prix de l'œuvre seul : trier sur le prix livré), `src/app/galerie/[id]/page.tsx:9` (`revalidate = 60`), `ArtworkDetail.tsx:228,235,624` -- fichiers listés dans les exceptions 3.1/3.2 : y toucher au minimum.
- `.eslintrc.js:49` (`SURFACES_TEXTES`) -- ajouter `PaysLivraison.tsx`.
- `tests/livraison.test.ts` -- blocs purs et base existants ; ajouter les cas de la matrice.

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/livraison/{index,prix}.ts` -- `prixLivre`, `prixLivresPourPays`, cookie `pays` (`lirePays`, `cookiePays`).
- [ ] `src/lib/catalogue/*`, `src/app/galerie/**` -- prix livré et délai par œuvre pour le pays du visiteur, tri sur le prix livré, rendu par requête.
- [ ] `src/components/ui/PaysLivraison.tsx` et action serveur -- choix du pays, rafraîchissement, annonce.
- [ ] `src/lib/i18n/fr.ts` -- textes (prix livré, délai, pas de livraison, mention des droits, annonce).
- [ ] `tests/livraison.test.ts` -- matrice, égalité des deux formes.
- [ ] `AGENTS.md` -- règle du prix livré.

**Acceptance Criteria:**
- Given un composant de `src/`, when on cherche une addition de `prixCentimes` et de frais hors de `livraison`, then il n'y en a aucune.
- Given la fiche d'une œuvre livrée en France, when un visiteur sans cookie l'ouvre, then il voit le prix livré France, le délai et « Droits et taxes d'import éventuels non inclus ».

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npx eslint .` -- aucune erreur
- `node scripts/verifier-exceptions-prisma.cjs origin/main` (et les listes `tests/exceptions-interface.cjs`, `eslint/exceptions-textes.cjs`) -- aucun ajout
- `npm test` -- tous verts
- `npm run build` -- réussi

**Manual checks:**
- Préversion : une œuvre publiée d'un artiste avec accord (sur `preview`), fiche ouverte sans cookie (France), « Modifier » → Canada, prix et délai recalculés.
