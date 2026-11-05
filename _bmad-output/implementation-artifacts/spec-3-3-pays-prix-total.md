---
title: 'Story 3.3 — Pays de livraison et prix total calculé en un seul endroit'
type: 'feature'
created: '2026-11-05'
status: 'done'
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
- [x] `src/lib/livraison/{index,prix}.ts` -- `prixLivre`, `prixLivresPourPays`, cookie `pays` (`lirePays`, `cookiePays`).
- [x] `src/lib/catalogue/*`, `src/app/galerie/**` -- prix livré et délai par œuvre pour le pays du visiteur, tri sur le prix livré, rendu par requête.
- [x] `src/components/ui/PaysLivraison.tsx` et action serveur -- choix du pays, rafraîchissement, annonce.
- [x] `src/lib/i18n/fr.ts` -- textes (prix livré, délai, pas de livraison, mention des droits, annonce).
- [x] `tests/livraison.test.ts` -- matrice, égalité des deux formes.
- [x] `AGENTS.md` -- règle du prix livré.

**Acceptance Criteria:**
- Given un composant de `src/`, when on cherche une addition de `prixCentimes` et de frais hors de `livraison`, then il n'y en a aucune.
- Given la fiche d'une œuvre livrée en France, when un visiteur sans cookie l'ouvre, then il voit le prix livré France, le délai et « Droits et taxes d'import éventuels non inclus ».

## Implementation Notes

- `livraison/prix.ts` (pur) : `calculerPrixLivre(oeuvre, zoneTrouvee, offre)` porte la règle (ordre : `sans_prix`, `pas_de_zone`, `non_livree` — offre absente, `livree = false` ou incomplète —, `devise_differente`, casse ignorée), `lirePays` (trim, majuscules, `FR` sinon), `cookiePays` (options de `cookies().set`, un an, `Path=/`, `SameSite=Lax`). `livraison/index.ts` : `prixLivre` (Prisma) et `prixLivresPourPays(codePays, ids?)` (SQL : `jointuresPrixLivre`, `TOTAL_LIVRE_SQL`, `RAISON_NON_LIVREE_SQL`, réutilisables par 3.9 pour filtrer/trier). Sans `ids`, œuvres visibles lues par le fragment `VISIBLE` de `disponibilite/etats` (le SQL ne nomme jamais `publication`/`disponibilite`, test de 2.2). Repli œuvre par œuvre quand le client en lecture seule de `garde-production` refuse `$queryRaw` (préversion branchée sur la base de production).
- `catalogue` : `getAllArtworks(pays?)`, `getArtworkBySlug(slug, pays?)`, `getRelatedArtworks(…, pays?)` ajoutent `Artwork.prixLivre` (type d'affichage) quand un pays est passé ; sans pays, rien ne change (accueil, artistes).
- Galerie : `PaysLivraison` à côté de la bascule d'unité ; tri sur `prixLivre.totalCentimes`, non livrées en dernier dans les deux sens ; `useMemo` dépend désormais de `artworks` (sinon le rafraîchissement après changement de pays ne se voyait pas). Fiche : bloc « Prix livré » (total, délai, mention, `PaysLivraison`) pour une œuvre disponible ; le bloc « vendue » (prix barré) est laissé à 3.7. Les œuvres proches de la fiche affichent aussi le prix livré et la mention. `sans_prix` s'affiche « — ».
- Action serveur `choisirPaysLivraison` dans `src/app/actions/pays.ts` (pas de route). Tests qui rendent la galerie ou la fiche : `next/headers` simulé (cookie absent).

## Spec Change Log

## Review Triage Log

| # | Relecteur | Constat | Verdict | Route | Preuve |
|---|-----------|---------|---------|-------|--------|
| 1 | BH, ECH | `TOTAL_LIVRE_SQL` int4 + int4 déborde au-delà de 2 147 483 647 | low | patch | addition SQL sans conversion, la forme JS ne lève pas ; correction directe (`::bigint`). |
| 2 | BH, ECH | repli lecture seule : 2 requêtes par œuvre en parallèle | medium | patch | `Promise.all(oeuvres.map(prixLivre))`, chaque appel lit `zonePays` puis `offreLivraison`. |
| 3 | BH | « Pas de livraison vers Canada » : article manquant | medium | patch | `fr.livraison.pasDeLivraison` met le nom nu après « vers » ; formulation sans préposition. |
| 4 | BH, ECH | annonce `aria-live` avant le rafraîchissement, non répétée au même choix | medium | patch | `setAnnonce` juste après `router.refresh()` non attendu. |
| 5 | BH, ECH | « Annuler » garde `choix` et `erreur` | low | patch | `onClick={() => setOuvert(false)}` seul. |
| 6 | BH | focus perdu à la fermeture, pas d'Échap | medium | patch | formulaire démonté, focus sur `<body>`. |
| 7 | ECH | rejet de l'action serveur non intercepté | low | patch | `await choisirPaysLivraison` sans try/catch dans la transition. |
| 8 | ECH | `aria-controls` vers un id absent | low | patch | correction directe. |
| 9 | ECH | œuvre proche non livrée : ni prix ni explication | low | patch | `RelatedSection` n'affiche que `livree`. |
| 10 | VG | tri sur le prix livré non testé | medium | patch | aucune occurrence de `comparerPrixLivre` dans `tests/`. |
| 11 | VG | mention des droits de la fiche satisfaite par les œuvres proches ; cartes non vérifiées | medium | patch | `tests/livraison.test.ts` cherche dans toute la page. |
| 12 | VG | affichage « — » de `sans_prix` non vérifié | low | patch | aucune assertion HTML sur `sans-prix`. |
| 13 | BH, VG | repli testé par simulation de `$queryRaw`, pas par la vraie garde | medium | patch | `vi.spyOn(prisma, '$queryRaw')` ; la garde lève bien la classe (`OPERATIONS_ECRITURE` contient `$queryRaw`), mais rien ne le prouve. |
| 14 | BH, ECH | scan « aucune addition » faible, dépend du répertoire courant | low | patch | regex limitée aux identifiants `frais*`, chemin relatif `'src'`. |
| 15 | BH | cookie `pays` sans `httpOnly`/`secure` | low | patch | le client ne lit jamais le cookie ; correction directe. |
| 16 | BH | statut du sprint `in-progress` au lieu de `review` | low | patch | `sprint-status.yaml:66`. |
| 17 | BH | panier : prix nu et « Transport : Offert », contradictoires avec le prix livré | medium | defer | panier et paiement hors périmètre (Lot 2 fermé, OQ-3 ouverte) ; préexistant. |
| 18 | BH | accueil et profil artiste : prix nu ; fiche : « TVA non applicable » retirée | medium | defer | prix de l'œuvre seule, non total (refontes 3.5/3.9) ; mention TVA à trancher par le porteur. |
| 19 | BH | œuvre non livrée encore ajoutable au panier | low | defer | Lot 2 fermé, aucun paiement possible ; à traiter avec le panier (epic 6). |
| 20 | VG | interaction de `PaysLivraison` non testée | medium | defer | pas d'outillage DOM dans le dépôt ; vérification manuelle en préversion. |
| 21 | ECH | `prix.get(id)` peut manquer | false | — | la carte est construite sur les mêmes `ids` que les lignes lues (`artworks.ts:19,49`, repli `findMany` sur `cibles`). |
| 22 | BH | signature de `getRelatedArtworks` (`3` répété) | low | rejet | cosmétique, aucun défaut constaté. |

## Verification

**Commands:**
- `npx eslint .` -- aucune erreur
- `node scripts/verifier-exceptions-prisma.cjs origin/main` (et les listes `tests/exceptions-interface.cjs`, `eslint/exceptions-textes.cjs`) -- aucun ajout
- `npm test` -- tous verts
- `npm run build` -- réussi

**Manual checks:**
- Préversion : une œuvre publiée d'un artiste avec accord (sur `preview`), fiche ouverte sans cookie (France), « Modifier » → Canada, prix et délai recalculés.
