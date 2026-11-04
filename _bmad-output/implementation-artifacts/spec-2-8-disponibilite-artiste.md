---
title: 'Story 2.8 — L''artiste tient la disponibilité de ses œuvres'
type: 'feature'
created: '2026-11-04'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-2-7-curation-par-l-equipe.md', '{project-root}/docs/migrations.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un artiste qui vend aussi ailleurs n'a aucun moyen de retirer de la vente une œuvre publiée sur Errancy : seule l'équipe peut basculer la disponibilité, et une œuvre déjà vendue ailleurs reste achetable (FR-21, UJ-2).

**Approach:**
- `/dashboard/artiste/oeuvres` : chaque œuvre porte son badge d'état — Brouillon, En curation, Publiée, Réservée, Vendue, Vendue ailleurs, Retirée — lisible sans la couleur (libellé + style de trait), avec états vide et chargement.
- Sur une œuvre publiée `disponible` (ou `reservee`), « Changer la disponibilité » ouvre un choix « Vendue ailleurs » / « Retirer de la vente », puis une feuille de confirmation (monte du bas, « Annuler » à gauche, « Confirmer » à droite ; Échap ou un appui sur le voile ferme sans agir et rend le focus ; jamais deux feuilles empilées).
- Confirmé : le module `disponibilite` change l'état sur la ligne verrouillée et enregistre une déclaration (œuvre, type, artiste, date, « a interrompu une réservation » — toujours faux tant qu'il n'existe pas de réservation, epic 6). Dès cet instant le serveur refuse toute commande (contrôle existant `estDisponible`), la fiche publique affiche « Vendue » pour une œuvre vendue ailleurs et redirige (301) vers la page de l'artiste pour une œuvre retirée, en moins de 60 s.
- Bandeau `role="status"` : « Vendue ailleurs à 10 h 12. » ou « Retirée de la vente à 10 h 12. », avec un seul lien « Annuler » : l'œuvre redevient `disponible` si la déclaration n'a interrompu aucune réservation.
- Œuvre `vendue` : « Vendue ailleurs » n'est pas proposé ; un lien « Écrire à l'équipe » (`CONTACT_EQUIPE`) le remplace.
- Œuvre retirée : « Remettre en vente » la renvoie en curation (`en_curation`, `disponible`, nouvelle date d'envoi), où l'équipe la revalide (2.7).
- Migration additive appliquée par le porteur (`preview` puis production, **avant** la fusion) : table des déclarations de disponibilité.

**Décision du porteur (2026-11-04) :**
- « Annuler » est accepté pendant 15 minutes après la déclaration (`DELAI_ANNULATION_DECLARATION_MINUTES = 15` dans `reglages`), depuis le bandeau comme depuis la fiche. Au-delà : une œuvre retirée passe par « Remettre en vente » (curation), une œuvre vendue ailleurs par l'équipe (lien « Écrire à l'équipe »). Refus serveur après le délai : `delai_depasse`.

## Boundaries & Constraints

**Always:** artiste propriétaire seulement (acteur de `acteurCourant()`) ; `disponibilite` écrit seulement par `disponibilite`, `publication` seulement par `curation` ; transitions vérifiées sur la ligne verrouillée ; actions serveur ; `{ ok, code }` et messages en français ; cibles de 44 px, focus géré, états jamais portés par la couleur seule.

**Never:** réservation ou annulation de réservation (epic 6) ; e-mail ; modification d'une œuvre vendue par l'artiste ; écriture directe des colonnes d'état hors des deux modules ; toucher `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`, les secrets ou les réglages Vercel/Neon.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Vendue ailleurs | publiée + disponible, confirmé | `vendue_ailleurs`, déclaration enregistrée, bandeau avec heure | — |
| Retirer | publiée + disponible, confirmé | `retiree`, fiche publique → 301 vers l'artiste | — |
| Annuler | dernière déclaration sans réservation interrompue | `disponible`, déclaration marquée annulée | déjà annulée ou état changé : `transition_interdite` |
| Œuvre vendue | `vendue` | pas de « Vendue ailleurs », lien vers l'équipe | requête forcée : `transition_interdite` |
| Remettre en vente | `retiree` | `en_curation` + `disponible`, visible dans la file | autre état : `transition_interdite` |
| Autre artiste | slug d'autrui | rien n'est écrit | `acces_refuse` |
| Commande | œuvre `vendue_ailleurs` ou `retiree` | checkout refusé | message existant |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` -- modèle `DeclarationDisponibilite` (id, `artworkId` FK `CASCADE`, `type` enum `vendue_ailleurs`/`retiree`, `userId`, `reservationInterrompue Boolean @default(false)`, `annuleeLe DateTime?`, `createdAt`), index `(artworkId, createdAt)`.
- `src/lib/disponibilite/index.ts` -- `definirDisponibilite` (admin), `lireEtatVerrouille`, `champAvailable` : y ajouter `declarerDisponibilite(acteur, slug, type)`, `annulerDeclaration(acteur, slug)`, `derniereDeclaration`.
- `src/lib/disponibilite/etats.ts` -- `LIBELLES_ETAT` (« Disponible » → « Publiée » pour le badge artiste), `codeEtat`, `RETIREE`, `VENDUE`.
- `src/lib/curation/` -- ajouter `remettreEnVente(acteur, slug)` (publication `en_curation`, `envoyeeEnCurationLe`, disponibilité remise à `disponible` via `disponibilite`).
- `src/lib/reglages/index.ts` -- `CONTACT_EQUIPE`.
- `src/app/dashboard/artiste/oeuvres/page.tsx`, `src/components/dashboard/StatusBadge.tsx` -- liste et badges.
- `src/app/galerie/[id]/page.tsx` -- redirection 301 existante (`artisteDOeuvreRetiree`) ; vérifier le délai de cache (≤ 60 s) et l'affichage « Vendue » d'une œuvre vendue ailleurs.
- `src/app/api/checkout/route.ts` -- refuse déjà ce qui n'est pas `estDisponible`.
- `tests/disponibilite.test.ts` -- modèle, dont le test de concurrence.

## Tasks & Acceptance

**Execution:**
- [ ] `prisma/schema.prisma` + `prisma/migrations/<horodatage>_declarations_disponibilite/` -- table additive.
- [ ] `src/lib/disponibilite/`, `src/lib/curation/` -- déclarer, annuler, remettre en vente, libellés -- logique métier.
- [ ] `src/app/dashboard/artiste/oeuvres/` (+ composants `availability-picker`, `confirm-sheet`, `info-banner`) -- interface artiste.
- [ ] `src/app/galerie/[id]/page.tsx` -- « Vendue » et cache ≤ 60 s si nécessaire.
- [ ] `tests/disponibilite-artiste.test.ts` -- matrice, propriété, concurrence avec la validation de curation, refus du checkout.
- [ ] `docs/migrations.md`, `AGENTS.md` -- journal et repères.

**Acceptance Criteria:**
- Given la feuille de confirmation ouverte, when l'artiste appuie sur Échap ou sur le voile, then rien n'est écrit et le focus revient sur le bouton qui l'a ouverte.
- Given une œuvre vendue ailleurs, when un visiteur ouvre sa fiche dans la minute, then il lit « Vendue » et ne peut pas l'ajouter au panier.

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
- Préversion, sur téléphone : déclarer « Vendue ailleurs », annuler, retirer, remettre en vente.
