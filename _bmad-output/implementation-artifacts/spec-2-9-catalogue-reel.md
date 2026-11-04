---
title: 'Story 2.9 — Catalogue réel uniquement'
type: 'feature'
created: '2026-11-04'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'fdf69ac85a7a8b6b85d7b5fcad2818e8c262a993'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-2-7-curation-par-l-equipe.md', '{project-root}/docs/migrations.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le site public montre encore un catalogue de démonstration : des œuvres et artistes célèbres (Rothko, Kusama, Basquiat…) recopiés en base et publiés, des sections de l'accueil lues dans `src/data/*`, des chiffres inventés (« 340+ œuvres, 60 artistes ») et une œuvre fictive (« Lumière Dorée — Sophie Marceau »). FR-16 exige qu'aucune page publique ne lise de données de démonstration et que chaque artiste publié ait signé un accord écrit.

**Approach:**
- Les composants `components/sections/*` et `lib/utils/*` lisent le module `catalogue` ; plus aucun fichier n'importe `src/data/*`, et le dossier est supprimé.
- Règle de visibilité publique (fragment `VISIBLE` et prédicat `estVisible` de `disponibilite`, catalogue) : une œuvre n'est visible que si elle est publiée **et** que son artiste a un accord signé enregistré (`accordSigneLe`) et est actif. Un artiste n'apparaît publiquement (liste, page, accueil) que s'il a un accord signé et au moins une œuvre visible ; une exposition, que si elle contient au moins une œuvre visible.
- Accueil : plus de chiffres ni d'œuvre inventés ; l'œuvre mise en avant et les chiffres viennent du catalogue réel, et sont masqués quand ils valent zéro.
- États vides : accueil, galerie, artistes et expositions affichent l'état vide prévu quand il n'y a rien de visible, sans erreur.
- `prisma/seed.ts` ne crée plus aucun catalogue de démonstration (œuvres, artistes, expositions) et refuse de s'exécuter sur la production (`garde-production`).
- Liste des images de démonstration envoyées sur Cloudinary par `scripts/upload-images.ts` fournie au porteur (`docs/images-demonstration.md`) ; la suppression se fait par le porteur, après confirmation des droits.
- `public/robots.txt` et la maintenance restent inchangés.

**Décision du porteur (2026-11-04) :**
- Les œuvres et artistes de démonstration déjà en base sont masqués par la règle « accord signé requis », sans aucune modification des données ni migration. Leur suppression éventuelle viendra plus tard (story 2.10 ou à part).

## Boundaries & Constraints

**Always:** lectures publiques par `catalogue` uniquement ; « visible » ne se lit que par `VISIBLE`/`estVisible` de `disponibilite` ; aucun import Prisma hors des modules ; textes en français.

**Never:** supprimer des lignes en base dans le code ou la CI ; supprimer des images Cloudinary ; changer `publication`/`disponibilite` des œuvres existantes ; toucher `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`, les secrets ou les réglages Vercel/Neon.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Démonstration | œuvres publiées d'artistes sans accord | absentes de l'accueil, de la galerie, des fiches (404) et des pages artistes | — |
| Réel | œuvre validée, artiste avec accord | visible partout | — |
| Accord effacé | artiste dont l'accord est effacé | ses œuvres disparaissent du site public | — |
| Base vide | aucune œuvre visible | état vide sur accueil, galerie, artistes, expositions | aucune erreur |
| Panier | slug d'une œuvre devenue invisible | refus au paiement (règle existante) | message existant |
| Seed | `prisma db seed` sur la production | refus | message de `garde-production` |

</frozen-after-approval>

## Code Map

- `src/data/{artists,artworks,exhibitions}.ts` -- à supprimer.
- `src/components/sections/{Artists,Gallery,Exhibitions,Hero}.tsx` -- lisent `src/data` ou des valeurs inventées ; à brancher sur `catalogue` (composants serveur ou props).
- `src/lib/utils/{artworks,artists,exhibitions}.ts` -- importent `src/data` ; garder seulement les fonctions pures encore utilisées (`formatPrice`…), le reste passe par `catalogue`.
- `src/lib/catalogue/{artworks,artists,exhibitions,index,mappers}.ts` -- lectures publiques à filtrer par la nouvelle règle.
- `src/lib/disponibilite/etats.ts` -- `VISIBLE`, `estVisible` : y intégrer la condition d'accord (`artist: { accordSigneLe: { not: null }, active: true }`) ; vérifier tous les appelants (catalogue, checkout, curation, espace artiste) et le test d'isolement.
- `src/app/page.tsx`, `src/app/galerie/**`, `src/app/artistes/**`, `src/app/expositions/**` -- pages publiques et états vides.
- `src/app/auth/connexion` (panneau « 5 artistes · 8 œuvres · 3 expositions ») -- chiffres à lire du catalogue réel ou à retirer.
- `prisma/seed.ts`, `src/lib/garde-production.ts`, `scripts/upload-images.ts` -- seed et liste des images.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/disponibilite/etats.ts`, `src/lib/catalogue/*` -- règle de visibilité avec accord, artistes et expositions publics filtrés.
- [x] `src/components/sections/*`, `src/lib/utils/*`, pages publiques -- lecture par `catalogue`, états vides, plus de valeurs inventées.
- [x] `src/data/` -- suppression.
- [x] `prisma/seed.ts` -- plus de catalogue de démonstration, refus en production.
- [x] `docs/images-demonstration.md` -- liste des images Cloudinary de démonstration.
- [x] `tests/catalogue-reel.test.ts` -- matrice, aucun import de `src/data`, états vides.
- [x] `AGENTS.md` -- règle de visibilité.

**Acceptance Criteria:**
- Given le dépôt, when on cherche `@/data` dans `src/`, then il n'y a aucun résultat et le dossier `src/data/` n'existe plus.
- Given une œuvre validée d'un artiste avec accord, when un visiteur ouvre la galerie, then elle est la seule œuvre affichée.

## Implementation Notes

- Règle dans `disponibilite/etats.ts` : `ARTISTE_ACCORD` (`accordSigneLe` non nul, `active`), intégré à `VISIBLE` (`artist: ARTISTE_ACCORD`) ; `ARTISTE_VISIBLE` (accord + `artworks: { some: VISIBLE }`) et `EXPOSITION_VISIBLE` (`artworks: { some: { artwork: VISIBLE } }`) ; `estVisible` reçoit désormais `artist` (`CHAMPS_ARTISTE_ACCORD`), prédicat `aUnAccord`. `DISPONIBLE`/`estDisponible` restent l'axe disponibilité seul (ils alimentent `champAvailable`, qui ne doit pas changer) ; le checkout exige `estDisponible` **et** `estVisible`, même message « n'est plus disponible ». Appelants mis à jour : catalogue (galerie, fiches, artistes, expositions, liées), espace artiste (`visible`), page admin d'une œuvre (lien « Voir »), checkout. `getArtistArtworksBySlug` passe par `AND` (un `artist` voisin de `...VISIBLE` écraserait la condition d'accord).
- Œuvre retirée : redirection 301 vers l'artiste seulement si sa page est publique (`ARTISTE_VISIBLE` : accord, actif, une autre œuvre visible) ; sinon la fiche répond 404, jamais de redirection vers une page artiste en 404.
- Accueil : `src/app/page.tsx` (serveur) lit `accueilPublic()` (`catalogue/accueil.ts`) ; `Hero`, `Gallery`, `Artists`, `Exhibitions` reçoivent leurs données en props. Œuvre mise en avant : coup de cœur disponible, sinon première disponible, sinon première visible ; carte de prix seulement si disponible ; badge « Exposition en cours » seulement si une exposition visible est en cours ; chiffres nuls masqués. Sans œuvre visible, la collection affiche « La collection arrive bientôt » ; sections artistes et expositions vides masquées.
- États vides : galerie (« La collection arrive bientôt », sans « Réinitialiser »), artistes (« Les artistes arrivent bientôt »), expositions (« Aucune exposition n'est programmée pour le moment. ») ; chiffres nuls masqués, « 340+ » et le « + » de la page artistes retirés. Panneau de connexion : chiffres codés en dur retirés.
- `src/data/`, `lib/utils/artists.ts`, `lib/utils/exhibitions.ts` supprimés ; `lib/utils/artworks.ts` ne garde que `formatPrice`.
- Seed : plus aucune écriture ; `amorcageInterdit` / `AmorcageProductionInterdit` (`garde-production`) refusent `VERCEL_ENV=production` et une `DATABASE_URL` sur `DATABASE_PRODUCTION_ID` ; `prisma.config.ts` déclare `migrations.seed` (`tsx prisma/seed.ts`, Prisma ne passe pas par un shell : `scripts/verifier-base.ts` reste lancé par `npm run db:seed` seul). Décision du porteur du 2026-11-04 consignée dans `docs/decisions-porteur.md`. `prisma/seed.ts` sort de `eslint/exceptions-prisma.cjs` (16 au lieu de 17).
- `docs/images-demonstration.md` : huit images (`errancy/artworks/<slug>`, compte `djiu4tirq`) et requête de contrôle en lecture seule ; aucune suppression.
- Vérifié : `npx eslint .` (0 erreur), `verifier-exceptions-prisma` (aucun ajout), `npm test` (301 verts, PostgreSQL 16 local), `npm run build`, et `next start` sur une base locale migrée (œuvre de démonstration absente de l'accueil et de la galerie, fiche et page artiste en 404 ; œuvre réelle visible ; états vides après effacement de l'accord).

## Spec Change Log

## Review Triage Log

Revue 1 (trois relecteurs : blind-hunter, edge-case-hunter, verification-gap).

| # | Source | Constat | Verdict | Route |
|---|--------|---------|---------|-------|
| 1 | blind | `sprint-status` à `in-progress`, spec à `in-review` | false — la synchronisation du suivi se fait à l'étape de présentation (passage en `review`) | rejet |
| 2 | blind, edge | rangées de chiffres vides (`ArtistsList`, `GalleryPage`, `ExhibitionsList`) : filet `border-t` orphelin quand tout vaut zéro | low — visible sur chaque page vide, correction directe (ne rendre le conteneur que s'il reste un chiffre) | patch |
| 3 | blind | `ArtistsList` : état vide affiché sous la grille vide au lieu de la remplacer | low — marges en trop, correction directe (ternaire) | patch |
| 4 | blind | `ArtistsList` : « Expositions » = somme par artiste, une exposition à deux artistes compte double | medium — chiffre public faux alors que la story annonce des chiffres réels | patch |
| 5 | blind | `ExhibitionsList` vide : « Aucune exposition » puis « Aucune exposition n'est programmée… », onglets vides | low — redondance visible, correction directe du titre | patch |
| 6 | blind, edge | œuvre publiée d'un artiste sans accord ou inactif : « Publiée » affiché à l'artiste et à l'admin, lien « Voir » disparu sans raison | medium — conséquence directe de la nouvelle règle, aucune explication | patch (mention courte) |
| 7 | blind | panier local garde des œuvres devenues invisibles | false — la matrice prévoit le refus au paiement (règle existante), Lot 2 fermé | rejet |
| 8 | blind | accueil charge tout le catalogue à chaque requête | low — catalogue minuscule, même schéma que `/galerie` ; correction non directe | rejet |
| 9 | blind, edge | commentaire de `prisma.config.ts` : `prisma db seed` ne lance pas `verifier-base.ts` contrairement à `db:seed` | low — commentaire inexact, correction directe | patch |
| 10 | blind | README demande encore `db:seed` | false — le README a été mis à jour (aucun catalogue, zones par SQL) | rejet |
| 11 | blind | `amorcageInterdit` recopie la comparaison d'endpoint de `ecritureInterdite` | low — divergence future si l'analyse de l'URL change ; extraction directe | patch |
| 12 | blind, edge | test du seed dépendant de `.env.local` (dotenv du script enfant) | low — échec local possible selon le fichier du développeur ; correction directe | patch |
| 13 | blind | décision du porteur du 2026-11-04 absente de `docs/decisions-porteur.md` (« à purger ») | low — registre des décisions incomplet ; ajout d'une ligne | patch |
| 14 | blind | `<Link><Button>` dans `Hero` | low — même schéma déjà employé 5 fois dans les sections ; corriger demande de refondre `Button` | rejet |
| 15 | blind | filet décoratif vide dans `LoginForm` | low — suppression directe | patch |
| 16 | edge | `artisteDOeuvreRetiree` : redirection permanente vers une page artiste en 404 si l'artiste n'a plus d'œuvre visible | medium — 308 mise en cache vers une 404 | patch (`ARTISTE_VISIBLE`) |
| 17 | verif, blind | `oeuvreMiseEnAvant` et badge « Exposition en cours » non distingués d'une règle plus simple par les tests | medium — l'accueil pourrait mettre en avant une œuvre vendue sans échec de test | patch (tests) |
| 18 | verif | règles d'affichage de `Hero` jamais rendues en test | medium (non vérifié) — rendu sous Node avec framer-motion à étudier ; contrôle manuel en préversion | defer |
| 19 | verif, blind | `getRelatedArtworks`, `getExhibitionArtistsBySlug`, redirection 301 conservée : pas de test avec le catalogue mixte | medium — une fuite de la démonstration ne ferait échouer aucun test | patch (tests) |

## Verification

**Commands:**
- `npx eslint .` -- aucune erreur
- `node scripts/verifier-exceptions-prisma.cjs origin/main` -- aucun ajout
- `npm test` -- tous verts
- `npm run build` -- réussi

**Manual checks:**
- Production (admin, maintenance) : accueil et galerie sans œuvre de démonstration.
