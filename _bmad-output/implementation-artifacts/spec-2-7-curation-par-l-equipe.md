---
title: 'Story 2.7 — Curation par l''équipe'
type: 'feature'
created: '2026-11-04'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-2-6-expedition-engagements-curation.md', '{project-root}/docs/migrations.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Depuis la story 2.6, les artistes envoient des œuvres en curation, mais l'équipe n'a aucun écran pour les relire : elles restent `en_curation` indéfiniment, et rien n'enregistre l'accord écrit signé que FR-16 exige avant toute publication (FR-25, FR-16).

**Approach:**
- File de curation en tête de `/dashboard/admin/oeuvres` : les œuvres `en_curation`, de la plus ancienne à la plus récente (date d'envoi), avec artiste, date d'envoi et mention « Accord signé » ou « Accord non signé ».
- `/dashboard/admin/oeuvres/[slug]` pour une œuvre en curation : récapitulatif complet en lecture seule (photos en grand, informations, dimensions et prix, offres par zone, visites, engagements) et la liste de contrôle — photos requises, fidélité des couleurs, champs complets, cohérence du prix et des zones.
- « Valider » : passe l'œuvre en `publiee` et `disponible` (visible sur le site). Refusé avec un message si l'artiste n'a pas d'accord signé enregistré.
- « Renvoyer à l'artiste » avec un commentaire obligatoire (10 à 1 000 caractères) : l'œuvre repasse en `brouillon` ; sur sa fiche de dépôt, l'artiste voit le commentaire de l'équipe en bandeau d'information (`role="status"`) jusqu'au prochain envoi. Aucun e-mail (epic 4).
- Chaque décision est conservée (œuvre, décision, commentaire, admin, date) ; écrite seulement par `curation`.
- Accord écrit : sur `/dashboard/admin/artistes`, l'équipe enregistre la date de signature de l'accord d'un artiste (ou l'efface) ; conservé par `curation` sur la fiche artiste.
- La bascule admin existante (`definirPublication`) refuse désormais une œuvre `en_curation` : la file est le seul chemin (reporté de 2.6).
- Migration additive appliquée par le porteur (`preview` puis production) : `Artist.accordSigneLe`, table des décisions de curation.

**Décisions du porteur (2026-11-04) :**
- Liste de contrôle obligatoire : « Valider » reste indisponible tant que les quatre cases ne sont pas cochées ; le serveur refuse une validation sans les quatre (`controle_incomplet`) et la décision enregistre la liste cochée.
- Spec gardée entière malgré sa longueur (valider exige l'accord).

## Boundaries & Constraints

**Always:** admin seulement, acteur issu de `acteurCourant()` ; `publication` écrit seulement par `curation`, `disponibilite` seulement par `disponibilite` ; transitions sur la ligne verrouillée (`en_curation` → `publiee` ou `brouillon`, toute autre transition refusée) ; actions serveur ; résultats `{ ok, code }` et messages en français ; libellés visibles, erreurs reliées, cibles de 44 px.

**Never:** e-mail à l'artiste ; retrait d'une œuvre publiée (2.8) ; catalogue réel seul (2.9) ; modification du contenu de l'œuvre par l'équipe ; publication sans accord signé ; toucher `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`, les secrets ou les réglages Vercel/Neon.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| File | 3 œuvres envoyées le 1er, le 3 et le 2 | ordre 1er, 2, 3 ; brouillons et publiées absents | file vide : « Aucune œuvre à relire. » |
| Valider | accord signé, liste de contrôle cochée | `publiee` + `disponible`, décision enregistrée, visible sur le site | accord absent : `accord_absent`, rien n'est écrit |
| Renvoyer | commentaire de 40 caractères | `brouillon`, décision enregistrée, bandeau sur la fiche de dépôt | commentaire vide ou < 10 : erreur reliée au champ |
| Double décision | œuvre déjà validée ou renvoyée | — | `transition_interdite` |
| Accord | date du 2026-11-04 sur Mustapha Timija | « Accord signé le 4 novembre 2026 » | date future ou illisible : erreur reliée |
| Non admin | artiste ou visiteur | redirection, rien n'est écrit | `acces_refuse` |
| Bascule ancienne | `definirPublication` sur une œuvre en curation | refus | `transition_interdite` |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` -- `Artist.accordSigneLe DateTime?` ; modèle `DecisionCuration` (id, `artworkId` FK `CASCADE`, `decision` enum `valider`/`renvoyer`, `commentaire` texte facultatif, `adminId` facultatif, `createdAt`), index `(artworkId, createdAt)`.
- `src/lib/curation/index.ts` -- `definirPublication` (bascule admin, à refuser sur `en_curation`) ; y ajouter `curation.ts` ou `file.ts` : `fileDeCuration()`, `oeuvreACurer(slug)`, `validerOeuvre`, `renvoyerOeuvre`, `enregistrerAccord(acteur, artistId, date|null)`, `dernierRenvoi(artworkId)`.
- `src/lib/curation/depot.ts` -- `verrouillerOeuvre`/`lireOeuvreEnCuration` (2.6) à réutiliser pour le récapitulatif ; `relireDepot` doit porter le dernier commentaire de renvoi.
- `src/lib/disponibilite` -- `estEnCuration`, `champAvailable`, `lireEtatVerrouille` ; la validation garde `disponible` (posé au dépôt) et `available` vrai via `champAvailable`.
- `src/app/dashboard/artiste/oeuvres/depot/RecapitulatifCuration.tsx` -- modèle du récapitulatif à réutiliser côté admin (composant partagé ou variante).
- `src/app/dashboard/admin/oeuvres/page.tsx` et `[slug]/page.tsx` -- exceptions Prisma existantes ; la file et la page de curation passent par `curation` (n'ajouter aucun import Prisma).
- `src/app/dashboard/admin/artistes/page.tsx`, `actions.ts` -- ajouter l'accord signé.
- `src/app/dashboard/artiste/oeuvres/depot/FormulaireDepot.tsx` / `PageDepot.tsx` -- bandeau du commentaire de renvoi.
- `src/app/api/admin/oeuvres/[slug]/route.ts` -- appelle `definirPublication`.
- `tests/depot.test.ts`, `tests/disponibilite.test.ts` -- modèles.

## Tasks & Acceptance

**Execution:**
- [ ] `prisma/schema.prisma` + `prisma/migrations/<horodatage>_curation/` -- colonne et table, `migrate dev --create-only` -- migration additive.
- [ ] `src/lib/curation/` -- file, récapitulatif, valider, renvoyer, accord, dernier renvoi ; garde de `definirPublication` -- logique métier.
- [ ] `src/app/dashboard/admin/oeuvres/` -- file en tête, page de curation avec liste de contrôle, valider, renvoyer -- interface admin.
- [ ] `src/app/dashboard/admin/artistes/` -- date d'accord signé -- interface admin.
- [ ] `src/app/dashboard/artiste/oeuvres/depot/` -- bandeau du commentaire de renvoi -- interface artiste.
- [ ] `tests/curation.test.ts` -- matrice, ordre de la file, accès, bandeau.
- [ ] `docs/migrations.md`, `AGENTS.md`, `deferred-work.md` (entrée `definirPublication` close) -- journal et repères.

**Acceptance Criteria:**
- Given une œuvre validée, when un visiteur consulte la galerie, then elle y figure comme les autres œuvres publiées.
- Given une œuvre renvoyée puis corrigée et renvoyée en curation, when l'équipe ouvre la file, then elle y figure avec sa nouvelle date d'envoi et le bandeau de l'artiste a disparu.

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
- Préversion : enregistrer l'accord de Kara Walker, valider puis renvoyer une œuvre, voir le bandeau côté artiste.
