---
title: 'Story 3.4 — Journal d''événements et pages publiques toujours fraîches'
type: 'feature'
created: '2026-11-06'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md', '{project-root}/docs/migrations.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les lectures publiques du catalogue interrogent la base à chaque requête, sans cache, et aucun mécanisme ne permet à un module de réagir après une publication ou un changement de disponibilité (AD-11, AD-21, AR-9, AR-13). Les epics suivants (e-mails, réservation) en dépendent, et le cache à venir ne doit jamais laisser une œuvre vendue affichée plus de 60 s.

**Approach:**
- Module `src/lib/evenements/` :
  - catalogue typé unique `catalogue.ts` (noms `NomAuPasseCompose`, version, charge utile = ids seulement) : `PublicationChangee` et `DisponibiliteChangee` `{ artworkId, artistId }` ;
  - `ecrireEvenement(tx, evenement)` dans la transaction du changement d'état ;
  - réclamation atomique (événement, gestionnaire) par insertion conditionnelle avant tout effet ;
  - `repartirApresReponse(ids)` après validation (`waitUntil` de `@vercel/functions`, version épinglée).
- `src/lib/abonnements.ts` (racine de composition) : les deux événements → gestionnaire `invaliderCatalogue` (étiquettes de l'œuvre, de l'artiste et de la liste du catalogue).
- Nouvelles tables `Evenement` et `TraitementEvenement` (migration d'ajout seulement, appliquée par le porteur sur `preview` puis en production avant la fusion).
- `curation` et `disponibilite` écrivent l'événement dans chaque transaction qui change `publication` ou `disponibilite`, puis le répartissent après validation.
- `catalogue` met en cache les données des œuvres, artistes et expositions (`unstable_cache`, étiquettes par œuvre et par artiste, `revalidate` ≤ 60 s) ; le prix livré reste calculé à chaque requête avec le cookie `pays`.

## Boundaries & Constraints

**Always:** l'écriture d'un événement échoue (et annule la transaction) si son nom n'est pas au catalogue ; un gestionnaire ne fait rien si l'entité a déjà quitté l'état attendu ou si la réclamation existe déjà ; l'invalidation ne s'exécute jamais dans une fonction qui reçoit `tx` ; une erreur de répartition est journalisée sans faire échouer l'action de l'utilisateur.

**Never:** donnée personnelle (e-mail, nom, IP) dans un événement ou un journal ; balayage des échecs et sa planification (AQ-2 ouverte, le `revalidate` de 60 s rattrape un échec) ; e-mails (epic 4/5) ; mise en cache du prix livré ou des pages ; toucher `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`, les secrets ou les réglages Vercel/Neon.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Vendue ailleurs | l'artiste déclare « vendue ailleurs » | `DisponibiliteChangee` écrit dans la transaction ; après validation, étiquettes de l'œuvre et de l'artiste invalidées ; fiche à jour en moins de 60 s | — |
| Publication | l'équipe valide une œuvre en curation | `PublicationChangee` écrit puis réparti | — |
| Transaction annulée | refus métier après l'écriture | aucun événement en base | — |
| Double traitement | même événement réparti deux fois en parallèle | l'effet n'a lieu qu'une fois (une seule réclamation) | test |
| Gestionnaire en échec | `revalidateTag` lève | erreur journalisée (ids seulement), action réussie, cache rattrapé à 60 s | — |
| Événement inconnu | nom absent du catalogue | refusé (erreur de type et contrôle à l'exécution) | transaction annulée |

</frozen-after-approval>

## Code Map

- `.eslintrc.js:9-21` -- `MODULES_METIER` contient déjà `evenements` ; ajouter `src/lib/abonnements.ts` aux fichiers autorisés seulement s'il importe Prisma (il ne devrait pas).
- `prisma/schema.prisma` -- ajouter `Evenement` (`id`, `nom`, `version`, `charge` Json, `createdAt`) et `TraitementEvenement` (clé `[evenementId, gestionnaire]`, `traiteLe`, `CASCADE`) ; migration nommée `…_journal_evenements`.
- `src/lib/curation/file.ts:137,167` (`validerOeuvre`, `renvoyerOeuvre`), `curation/index.ts:66` (`definirPublication`), `curation/depot.ts:343` (`envoyerEnCuration`), `curation/remise-en-vente.ts:29` (`remettreEnVente`) -- transactions qui changent `publication` : y écrire l'événement, répartir après le `$transaction`.
- `src/lib/disponibilite/index.ts:74,103,189,227` (`marquerVendues`, `definirDisponibilite`, `declarerDisponibilite`, `annulerDeclaration`) -- idem pour `disponibilite`. `creerBrouillon(tx)` et `cloreDeclarationRetrait(tx)` n'en écrivent pas.
- `src/lib/catalogue/{artworks,artists,exhibitions,accueil}.ts` -- lectures Prisma directes à envelopper d'`unstable_cache` ; `prixLivresPourPays` / `prixLivre` restent hors cache.
- `src/lib/garde-production.ts` -- en préversion sur la base de production, les écritures sont déjà refusées : rien à changer.
- `tests/disponibilite.test.ts:79-112` -- scan interdisant `publication`/`disponibilite` hors de `curation` et `disponibilite` : `evenements` et `abonnements.ts` ne nomment pas ces colonnes.
- Tests qui simulent `next/cache` (`curation`, `disponibilite-artiste`, `depot`, `invitations`, `livraison`) -- ajouter `revalidateTag` et `unstable_cache` (passe-plat) aux simulations.
- `package.json` -- `@vercel/functions` épinglé en `3.10.2` (publiée le 2026-10-20).

## Tasks & Acceptance

**Execution:**
- [ ] `prisma/schema.prisma`, `prisma/migrations/…_journal_evenements/` -- deux tables, ajout seulement.
- [ ] `src/lib/evenements/{catalogue,index}.ts` -- catalogue, écriture, réclamation, répartition.
- [ ] `src/lib/abonnements.ts` -- abonnements et gestionnaire `invaliderCatalogue`.
- [ ] `src/lib/curation/*`, `src/lib/disponibilite/index.ts` -- écrire et répartir.
- [ ] `src/lib/catalogue/*` -- cache étiqueté, 60 s.
- [ ] `tests/evenements.test.ts` -- matrice, double traitement en parallèle, transaction annulée, cache invalidé après une déclaration.
- [ ] `docs/migrations.md`, `AGENTS.md` -- procédure de la migration, règles du module.

**Acceptance Criteria:**
- Given deux répartitions parallèles du même événement, when elles se terminent, then une seule ligne `TraitementEvenement` existe et le gestionnaire n'a agi qu'une fois.
- Given une lecture publique du catalogue, when elle est mise en cache, then elle porte les étiquettes de l'œuvre et de l'artiste et un `revalidate` d'au plus 60 s.

## Spec Change Log

## Verification

**Commands:**
- `npx eslint .` -- aucune erreur
- `node scripts/verifier-exceptions-prisma.cjs origin/main` (et les deux autres listes) -- aucun ajout
- `npm test` -- tous verts (dont le job « Migrations » : aucun écart avec `schema.prisma`)
- `npm run build` -- réussi

**Manual checks:**
- Préversion, après la migration sur `preview` : déclarer une œuvre « vendue ailleurs » depuis le compte artiste, puis la fiche publique la montre vendue en moins de 60 s.

## Implementation Notes
