---
title: 'Story 3.11 — Pages artistes'
type: 'feature'
created: '2026-11-10'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md', '{project-root}/docs/migrations.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La page d'un artiste n'a ni formation, ni expositions, ni photo d'atelier, et l'équipe ne peut renseigner aucun de ces éléments : seules la biographie et la photo existent, saisies en SQL. Les deux pages (`/artistes`, `/artistes/[id]`) affichent des chiffres inventés (« années d'activité » = naissance + 20) et n'ont pas de prix livré ni de délai pour les œuvres disponibles (FR-19, FR-8).

**Approach:**
- Trois colonnes facultatives ajoutées à `Artist` : `formation`, `expositions` (textes) et `atelierUrl` (migration d'ajout, appliquée par le porteur).
- L'administration (`/dashboard/admin/artistes`) permet à l'équipe de renseigner biographie, démarche, formation, expositions, portrait et photo d'atelier ; l'écriture passe par `curation` (admin seulement).
- Les photos partent directement du navigateur vers Cloudinary, signées par le serveur, comme celles des œuvres.
- La page artiste montre ces éléments, « Sélectionné par Errancy » et ses œuvres disponibles avec prix livré et délai pour le pays choisi ; `/artistes` liste les artistes publics.

## Boundaries & Constraints

**Always:**
- Décision du porteur du 2026-11-10 : envoi des photos par un bouton (Cloudinary signé), pas de collage d'adresse.
- Portrait = `Artist.imageUrl` ; démarche = `Artist.statement` (existants) ; formation, expositions = textes libres de l'équipe ; une section vide n'est pas affichée.
- Photos : `public_id` imposé sous `errancy/artistes/<id>/`, réponse Cloudinary revérifiée (signature) avant d'écrire ; jamais de fichier transitant par Vercel.
- Seuls les artistes publics (`ARTISTE_VISIBLE`) sont listés et ouverts ; « Sélectionné par Errancy » pour chacun ; œuvres affichées = disponibles, avec prix livré et délai (cookie `pays`, vignette de la galerie).
- Aucune valeur inventée : plus d'« années d'activité » calculées ni de compteurs déduits.
- Textes dans `fr`, `ArtistsList.tsx` et `ArtistProfile.tsx` conformes aux règles de textes et d'interface et retirés des listes d'exceptions ; aucun texte qui promette certificat, assurance ou installation.

**Never:**
- Coordonnées de l'artiste (site, e-mail, compte) sur une page publique (FR-8) : `website` n'entre jamais dans le type d'affichage.
- Suppression ou renommage de colonne, migration de données, nouvel événement.
- Toucher à la fiche œuvre, à la galerie, à `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Saisie par l'équipe | admin enregistre formation, expositions, démarche, biographie | valeurs enregistrées ; non-admin refusé | code de refus |
| Envoi d'une photo | admin choisit un portrait ou une photo d'atelier | envoi signé, réponse vérifiée, adresse enregistrée | « Envoi impossible » sans toucher l'ancienne photo |
| Page complète | artiste public avec tous les éléments | portrait, biographie, démarche, formation, expositions, atelier, « Sélectionné par Errancy », œuvres | — |
| Éléments absents | formation, expositions ou atelier vides | section absente | — |
| Œuvres disponibles | pays livré / non livré | prix livré et délai / « Pas de livraison vers [pays] » | — |
| Aucune œuvre disponible | toutes vendues | page sans section d'œuvres | — |
| Artiste sans accord ou inactif | adresse directe | 404 (règle de visibilité) | — |
| Coordonnées | `website`, e-mail du compte | jamais dans le HTML | — |
| Liste | `/artistes` | artistes publics, sans chiffre inventé | — |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma:10-35` (`Artist`, `statement`, `imageUrl`, `website`), `prisma/migrations/` -- ajouter `formation`, `expositions` (`Text?`) et `atelierUrl` (`String?`) ; migration `…_pages_artistes` d'ajout seulement ; `docs/migrations.md` y porte la procédure.
- `src/lib/curation/` -- nouvelle écriture `enregistrerFichePublique(acteur, artistId, champs)` ; `photos.ts` (`preparerEnvoiPhoto`, `signatureReponse`, `dossierOeuvre`) sert de modèle pour `preparerEnvoiPhotoArtiste` et `enregistrerPhotoArtiste` ; `curation/curation-regles.ts` pour les limites.
- `src/app/dashboard/admin/artistes/{page,actions}.tsx`, `AccordArtiste.tsx` (modèle de formulaire) -- formulaire de la fiche publique et envois ; `src/app/dashboard/artiste/oeuvres/depot/CasePhoto.tsx` -- modèle d'envoi côté navigateur.
- `src/lib/catalogue/{artists,mappers}.ts`, `src/lib/types/index.ts` (`Artist`, `yearsActive`, `exhibitions`) -- exposer `formation`, `expositions`, `statement`, `atelierUrl` ; retirer `yearsActive` et les compteurs inventés ; `getArtistArtworksBySlug(slug, pays)` avec prix livré.
- `src/app/artistes/{page.tsx,ArtistsList.tsx}`, `src/app/artistes/[id]/{page.tsx,ArtistProfile.tsx}` -- refaits ; `src/app/galerie/VignetteOeuvre.tsx` réutilisée ; `eslint/exceptions-textes.cjs`, `tests/exceptions-interface.cjs` -- vider ce qui concerne ces fichiers.
- `tests/artistes.test.ts` (nouveau) -- matrice sur base réelle ; `tests/curation.test.ts`.

## Tasks & Acceptance

**Execution:**
- [ ] `prisma/schema.prisma`, `prisma/migrations/…_pages_artistes/` -- trois colonnes facultatives, ajout seulement.
- [ ] `src/lib/curation/` -- écriture de la fiche publique, envoi signé et enregistrement des photos (admin seulement).
- [ ] `src/app/dashboard/admin/artistes/` -- formulaire et envois de photos.
- [ ] `src/lib/catalogue/`, `src/lib/types/index.ts` -- lecture des nouveaux champs, œuvres disponibles avec prix livré, sans valeur inventée.
- [ ] `src/app/artistes/**`, `src/lib/i18n/fr.ts` -- pages refaites, textes dans `fr`, sorties des listes d'exceptions.
- [ ] `tests/artistes.test.ts` -- matrice ; `AGENTS.md`, `docs/migrations.md`.

**Acceptance Criteria:**
- Given l'administration d'un artiste, when l'équipe renseigne les éléments et envoie les photos, then ils sont enregistrés par `curation` et un non-admin est refusé.
- Given `/artistes/[id]`, when la page s'ouvre, then elle montre les éléments renseignés, « Sélectionné par Errancy » et les œuvres disponibles avec prix livré et délai, sans aucune coordonnée.
- Given `/artistes`, when elle s'ouvre, then elle liste les artistes publics sans chiffre inventé.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

Décisions prises sans question : la biographie (`bio`) reste le texte de présentation, modifiable par l'équipe avec les autres champs ; « expositions » est un texte libre (liste de l'équipe), sans lien avec les expositions du site ; l'artiste ne modifie pas sa page lui-même (pages gérées par l'équipe, OQ-14) ; le nouveau code lit les nouvelles colonnes : la migration doit être appliquée par le porteur sur `preview`, puis en production **avant** la fusion.

## Verification

**Commands:**
- `npx eslint .` et les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …` -- aucune erreur, aucun ajout
- `npm test` (dont le job « Migrations ») et `npm run build` -- réussis

**Manual checks:**
- Préversion, après la migration sur `preview` : renseigner un artiste de test depuis l'administration (compte administrateur indisponible sur les préversions : SQL fourni par l'agent), page artiste complète, sans coordonnées.
