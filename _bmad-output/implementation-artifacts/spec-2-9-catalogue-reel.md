---
title: 'Story 2.9 — Catalogue réel uniquement'
type: 'feature'
created: '2026-11-04'
status: 'ready-for-dev'
route: 'dispatch'
review_loop_iteration: 0
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
- [ ] `src/lib/disponibilite/etats.ts`, `src/lib/catalogue/*` -- règle de visibilité avec accord, artistes et expositions publics filtrés.
- [ ] `src/components/sections/*`, `src/lib/utils/*`, pages publiques -- lecture par `catalogue`, états vides, plus de valeurs inventées.
- [ ] `src/data/` -- suppression.
- [ ] `prisma/seed.ts` -- plus de catalogue de démonstration, refus en production.
- [ ] `docs/images-demonstration.md` -- liste des images Cloudinary de démonstration.
- [ ] `tests/catalogue-reel.test.ts` -- matrice, aucun import de `src/data`, états vides.
- [ ] `AGENTS.md` -- règle de visibilité.

**Acceptance Criteria:**
- Given le dépôt, when on cherche `@/data` dans `src/`, then il n'y a aucun résultat et le dossier `src/data/` n'existe plus.
- Given une œuvre validée d'un artiste avec accord, when un visiteur ouvre la galerie, then elle est la seule œuvre affichée.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npx eslint .` -- aucune erreur
- `node scripts/verifier-exceptions-prisma.cjs origin/main` -- aucun ajout
- `npm test` -- tous verts
- `npm run build` -- réussi

**Manual checks:**
- Production (admin, maintenance) : accueil et galerie sans œuvre de démonstration.
