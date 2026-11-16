---
title: 'Story 6.6 — Vente ailleurs pendant une réservation'
type: 'feature'
created: '2026-11-12'
status: 'done'
baseline_commit: 'b0eda8e'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-6-5-paiement-tardif-abandon-et-incidents.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Quand l'artiste déclare « Vendue ailleurs » ou retire une œuvre réservée, la déclaration est enregistrée (`reservationInterrompue`) mais la réservation reste active, la commande en attente n'est pas annulée, aucune trace n'alerte l'équipe, et l'artiste ne voit pas ce qui arrive à l'acheteur (FR-21, FR-31, NFR-4, UJ-2).

**Approach:**
- `disponibilite` ferme la réservation active de l'œuvre (issue `interrompue`) dans la transaction de la déclaration et écrit l'événement `ReservationAnnulee`.
- Un gestionnaire de `commandes` annule la commande en attente concernée avec son motif et enregistre un incident ; il ne fait rien si la commande a déjà quitté l'état attendu. Un paiement constaté ensuite pour cette commande donne un remboursement et un incident, jamais une vente (cas 3 de NFR-4).
- L'artiste lit « Un acheteur avait réservé cette œuvre. L'équipe Errancy le prévient et s'occupe d'un éventuel remboursement. Vous n'avez rien à faire. », sans lien « Annuler ».

## Boundaries & Constraints

**Always:**
- La déclaration de l'artiste prime : rien ne la refuse ni ne l'annule à cause d'une réservation ; l'œuvre n'est jamais écrasée par la libération (`vendue_ailleurs` et `retiree` restent).
- `disponibilite` reste seul écrivain de `Reservation` et de l'axe disponibilité ; `commandes` seul écrivain des commandes, incidents et remboursements ; réclamation atomique et idempotence (un événement rejoué n'annule ni n'enregistre deux fois) ; événement écrit dans la transaction, répartition attendue après.
- Charge de l'événement : identifiants seulement ; aucun e-mail ni adresse dans les journaux ; textes dans `fr` ; `LOT2_OUVERT` sans effet.
- Migration additive appliquée par le porteur avant la fusion (nouvelle cause d'incident).
- Décision 2A : une commande de plusieurs œuvres est annulée en entier (lignes figées, pas de lot incomplet) et les réservations de ses autres œuvres sont libérées (jamais une œuvre vendue ailleurs, retirée ou vendue).

**Never:** e-mails à l'acheteur et à l'équipe (décision 1A : story d'e-mails, `deferred-work.md` ; l'équipe voit l'incident sur `/dashboard/admin/commandes` et prévient l'acheteur elle-même) ; remboursement réel (OQ-1) ; balayage et « Me prévenir » (6.7) ; `Order`, `/api/checkout`, webhook Stripe, `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Déclaration sur œuvre réservée | `reservee`, réservation active (paiement ou vente assistée) | déclaration enregistrée `reservationInterrompue`, réservation `interrompue`, événement `ReservationAnnulee` | — |
| Annulation de la commande | commande `en_attente_paiement` du passage | `annulee` avec motif, incident enregistré | état déjà quitté : rien |
| Rejeu | même événement | aucun second incident | réclamation atomique |
| Paiement constaté ensuite | commande annulée | remboursement `demande` et incident, aucune vente | (6.5) |
| Œuvre non réservée | `disponible` | aucun événement `ReservationAnnulee` | — |
| Bandeau artiste | déclaration avec réservation interrompue | texte de l'épic, sans lien « Annuler » | — |
| Commande de plusieurs œuvres | une seule déclarée | commande entière `annulee`, réservations des autres œuvres libérées | œuvre vendue ailleurs, retirée ou vendue jamais écrasée |
| Autre artiste | déclaration d'une œuvre d'autrui | refus (2.8) | — |

</frozen-after-approval>

## Code Map

- `src/lib/disponibilite/index.ts` -- `declarerDisponibilite` : fermer la réservation active (issue `interrompue`), événement ; `annulerDeclaration` et `etats.ts` refusent déjà « Annuler » si interrompue.
- `src/lib/disponibilite/reservation.ts` -- fermeture d'une réservation sans toucher à l'œuvre.
- `src/lib/evenements/catalogue.ts`, `src/lib/abonnements.ts` -- `ReservationAnnulee` (`{ passageId, artworkId }`), gestionnaire de `commandes` relié sans import statique (cycle d'imports).
- `src/lib/commandes/` -- nouveau gestionnaire (annuler, incident, remboursement si déjà payée : non) ; `etats.ts` ; cause d'incident `reservation_interrompue` (schéma + migration additive).
- `src/app/dashboard/artiste/oeuvres/[slug]/page.tsx`, `oeuvres/page.tsx`, `fr` -- bandeau sans « Annuler ».
- Ne pas modifier : `Order`, `/api/checkout`, webhook Stripe.

## Tasks & Acceptance

**Execution:**
- [x] migration (cause d'incident), événement `ReservationAnnulee`
- [x] `declarerDisponibilite` ferme la réservation ; gestionnaire de `commandes`
- [x] bandeau artiste ; tests (base réelle, navigateur si besoin), `AGENTS.md`, `docs/migrations.md`

**Acceptance Criteria:**
- Given une œuvre réservée, when l'artiste la déclare vendue ailleurs ou la retire, then la réservation est `interrompue`, l'œuvre garde l'état déclaré et `ReservationAnnulee` est écrit.
- Given l'événement, when le gestionnaire le traite, then la commande en attente est annulée avec incident ; rien ne change si elle a déjà quitté l'état attendu.
- Given un paiement constaté ensuite, when il est traité, then remboursement et incident, jamais de vente.
- Given l'artiste, when il a déclaré, then le bandeau de l'épic s'affiche sans « Annuler ».

## Implementation Notes

- Migration `20261119090000_vente_ailleurs_reservation` (SHA-256 `609bc888af95f13c6daf87419c6c598dd4161e92e525300b4ac64d1b2f307522`) : valeur `reservation_interrompue` de `CauseIncident`.
- `declarerDisponibilite` ferme la réservation active (`interromprePourDeclaration`) et écrit `ReservationAnnulee` ; le gestionnaire `annulerSuiteReservationAnnulee` (`commandes`) annule la commande en entier et écrit l'incident ; le motif est l'incident.
- Tests : 840 (base réelle) et 106 (navigateur) ; build et eslint sans erreur.

## Spec Change Log

## Review Triage Log

Passe 1 (trois relecteurs : aveugle, cas limites, lacunes de vérification).

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| `AGENTS.md` garde des phrases devenues fausses (6.2 : « reste à brancher en 6.6 », limite (b)) | low | patch | La 6.6 branche `reservationInterrompue` et ferme les réservations actives d'une œuvre déclarée. Mise à jour factuelle de la documentation de la story. |
| Aucun test de l'état laissé par un gestionnaire en échec (réservation interrompue, commande en attente, pas d'incident) ni de l'annulation manuelle qui s'ensuit | medium | patch | Limite (c) documentée mais non figée par un test. |
| Bandeau de l'artiste non vérifié là où il s'affiche (deux pages serveur sans test de rendu) | medium | defer | Aucun test de rendu de page dans le dépôt ; l'extraire en composant testé est une étape à part (`deferred-work.md`). |
| Déclaration sur une œuvre dont la réservation a déjà expiré et été libérée : pas d'événement, commande en attente jusqu'à l'abandon ou au constat | low | defer | Déjà couvert à l'encaissement par la 6.5 (remboursement et incident) ; à traiter avec le balayage (6.7). |
| Échec du gestionnaire : aucun signal à l'équipe alors que le bandeau promet une prise en charge | medium | defer | Dépend d'AQ-2 (rejeu des événements, ouverte) ; limite (c) documentée. |
| Montant à payer pour les commandes restantes après annulation d'une commande | low | rejet | Déjà traité par la 6.5 : le module accepte le total des commandes en attente seul, ou avec les annulées. |
| `/commande` listerait la commande annulée | false | rejet | Corrigé à la 6.5 : `lireRecapitulatifAssiste` ne liste plus les commandes annulées. |
| `reservee` sans ligne `Reservation` marquée `reservationInterrompue` sans événement ; réservation échue interrompue ; pas d'index unique d'incident | low | rejet | Inatteignable en production (toute œuvre `reservee` a une réservation depuis la 6.2) ou déjà documenté (limite (e)) ; chaque correction ajoute une garde sans dommage nommé. |
| Motif de l'annulation absent de `Commande` ; test de rejeu sans réclamation ; libellé et écran des incidents ; clé `viaCommandes` ; boucle de `interromprePourDeclaration` ; entrée `deferred-work.md` mêlée | low | rejet | Le motif est l'incident (voulu, documenté) ; l'idempotence repose sur l'état relu ; aucun dommage nommé pour le reste. |
| Spec et statut de suivi non alignés | false | rejet | Alignés à l'étape de présentation. |

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Migration appliquée par le porteur (sauvegarde, `preview`, production) avant la fusion ; ouvrir l'écran en préversion sans rien déclarer.
