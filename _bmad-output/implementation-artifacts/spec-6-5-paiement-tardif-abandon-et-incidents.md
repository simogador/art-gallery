---
title: 'Story 6.5 — Paiement tardif, abandon et incidents'
type: 'feature'
created: '2026-11-12'
status: 'done'
baseline_commit: '9125415'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-6-4-paiement-constate-et-confirmation.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un paiement constaté alors qu'une œuvre a été prise par un autre acheteur, ou pour une commande déjà abandonnée, laisse aujourd'hui tout le passage en attente et un incident sans suite : aucune annulation, aucun remboursement, aucun écran pour les traiter (FR-13, FR-31, NFR-4, SM-C1).

**Approach:**
- Échéance d'abandon sur chaque commande en attente (réglage, plus longue que la réservation) ; l'expiration de la réservation n'annule jamais la commande.
- Constat tardif : décision commande par commande. Œuvres vendables → confirmée ; œuvre prise par un autre, commande annulée ou échéance d'abandon dépassée → `annulee`, remboursement `demande` égal à son allocation, incident ; les autres commandes du passage restent confirmées.
- Écran de l'équipe : incidents (commande, cause, date), remboursements à traiter (« Marquer comme effectué » après le geste manuel, OQ-1 ouverte) et bouton « Annuler la commande ».

## Boundaries & Constraints

**Always:**
- Décision 1A : le montant constaté reste le total des commandes en attente du passage (agrégat de la base, jamais une addition dans le code) ; l'allocation d'une commande est le total de ses lignes figées, lu par agrégat ; OQ-16 reste ouverte.
- Décision 2A : l'échéance d'abandon (`DUREE_ABANDON_COMMANDE_JOURS` de `reglages`, 7) est enregistrée à la création ; sans balayage (6.7), une commande qui l'a dépassée est annulée au prochain constat qui la concerne ou par « Annuler la commande » ; une commande sans échéance (anciennes) n'est jamais jugée abandonnée.
- Seul l'acteur `admin` (rôle relu en base, vérifié dans le module et par test) ; annulation par la table de transitions de `commandes` ; œuvres jamais écrasées hors `reservee` par ce passage ou `disponible`.
- Idempotent : un constat rejoué ne crée ni second remboursement ni second incident ; remboursement unique par commande (contrainte en base) ; aucun e-mail ni adresse dans les journaux ; textes dans `fr` ; `LOT2_OUVERT` sans effet.

**Never:** e-mail à l'acheteur (décision 3A : story d'e-mails de confirmation, `deferred-work.md` ; l'équipe prévient l'acheteur elle-même) ; exécution réelle d'un remboursement par un prestataire (OQ-1) ; vente ailleurs (6.6) ; balayage (6.7) ; `Order`, `/api/checkout`, webhook Stripe, `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Tardif, œuvres libres | réservation échue, avant l'abandon | commandes confirmées, œuvres vendues | — |
| Œuvre prise | une commande du passage a une œuvre vendue ou réservée par un autre | cette commande `annulee`, remboursement `demande`, incident ; les autres confirmées | tout ou rien par commande |
| Commande déjà annulée ou abandonnée | constat la concernant | jamais confirmée : remboursement et incident | — |
| Rejeu | même constat | aucun second remboursement ni incident | clé unique |
| Montant ou devise différents | écart | rien annulé ni confirmé, incident (6.4) | — |
| Annulation par l'équipe | commande en attente | `annulee`, réservation libérée, sans remboursement (rien reçu) | autre état : refus typé |
| Remboursement effectué | `demande` | `effectue`, auteur et date | rejeu sans effet |
| Non admin | visiteur, utilisateur, artiste | `acces_refuse`, rien écrit | — |

</frozen-after-approval>

## Code Map

- `src/lib/commandes/paiement.ts` -- `traiterPaiementConstate` : refus global à remplacer par la décision par commande ; `incidentsDeLEquipe` (ajouter commande, cause, remboursements).
- `src/lib/commandes/etats.ts` -- `annulee` déjà permise depuis `en_attente_paiement` ; `src/lib/commandes/passage.ts` -- pose `abandonneLe` ; nouveau `src/lib/commandes/annulation.ts` (annuler, remboursements, marquer effectué).
- `src/lib/disponibilite/reservation.ts` -- `vendreOeuvresDuPassage` (décide avant d'écrire, rend l'œuvre refusée) à appeler par commande ; `libererReservation` pour l'annulation.
- `src/lib/paiement/` -- implémentation manuelle du port `Remboursement` (`adaptateurs/`), sans nom de prestataire.
- `prisma/schema.prisma` + migration additive : `Commande.abandonneLe`, table `RemboursementCommande` (commande unique, montant, devise, état `demande`|`effectue`, auteur, dates), valeur `commande_annulee` de `CauseIncident`.
- `src/lib/reglages/index.ts` -- `DUREE_ABANDON_COMMANDE_JOURS`.
- `src/lib/evenements/catalogue.ts`, `abonnements.ts` -- `CommandeAnnulee` (`{ commandeId }`), sans gestionnaire.
- `src/app/dashboard/admin/commandes/` -- incidents enrichis, remboursements, « Annuler la commande », focus et test navigateur.
- Ne pas modifier : `Order`, `/api/checkout`, webhook Stripe.

## Tasks & Acceptance

**Execution:**
- [x] migration, `reglages`, `abandonneLe` posé par `passage.ts`
- [x] `traiterPaiementConstate` par commande, annulation, remboursement, incident, événement `CommandeAnnulee`
- [x] annulation par l'équipe et « Marquer comme effectué » (module, actions)
- [x] écran : incidents, remboursements, boutons ; tests (base réelle, navigateur), `AGENTS.md`, `docs/migrations.md`

**Acceptance Criteria:**
- Given un paiement tardif dont une œuvre est prise, when le constat est traité, then seule cette commande est annulée avec un remboursement égal à son allocation et un incident, les autres sont confirmées.
- Given un paiement tardif dont les œuvres sont libres, when le constat est traité, then les commandes sont confirmées et les œuvres vendues.
- Given une commande annulée ou abandonnée, when un paiement la concerne, then elle n'est jamais confirmée : remboursement demandé et incident enregistré.
- Given l'écran, when l'équipe l'ouvre, then elle voit les incidents et les remboursements à traiter, et marque l'un d'eux effectué.

## Implementation Notes

- Migration `20261118090000_paiement_tardif` (SHA-256 `adcd085ac43ed2ebabffcb68a41679d8ef5d237a165760d0bcb0211265f4e64e`) : `Commande.abandonneLe`, table `RemboursementCommande` (une par commande, `CHECK` montant > 0), cause `commande_annulee`.
- Le module accepte deux montants pour un passage ayant des commandes annulées (en attente seules, ou avec les annulées remboursées) ; échéance d'abandon = max(maintenant, fin de la réservation) + 7 jours.
- Tests : 828 (base réelle) et 106 (navigateur) ; build et eslint sans erreur.

## Spec Change Log

## Review Triage Log

Passe 1 (trois relecteurs : aveugle, cas limites, lacunes de vérification).

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Total affiché à l'écran (commandes en attente) différent du total attendu par le module (en attente + annulées) : un montant honnête est refusé après une annulation | medium | patch | Deux relecteurs ; `commandesEnAttenteDeLEquipe` ne somme que `en_attente_paiement`. Le module accepte les deux totaux (avec ou sans les commandes annulées) et l'écran les montre. |
| Échéance d'abandon fixe à 7 jours, plus courte qu'une réservation de vente assistée réglée à 14 jours | medium | patch | Contredit « plus longue que la réservation » : une commande à réservation encore active est jugée abandonnée. |
| `/commande` (page de l'acheteur) liste encore une commande annulée avec ses montants | high | patch | `lireRecapitulatifAssiste` ne filtre pas `etat` : l'acheteur pourrait payer une commande annulée. |
| Remboursement de 0 centime possible, sans contrainte en base | low | patch | Migration non encore appliquée : une contrainte `CHECK` coûte une ligne. |
| Écarts « Attendu » et « Reçu » incompréhensibles pour les incidents d'annulation | low | patch | Pour `oeuvre_indisponible` et `commande_annulee`, `attenduCentimes` est l'allocation et `recuCentimes` le paiement entier. |
| Tests manquants : `libererReservation` avec `artworkIds`, rejeu d'un incident, course annulation contre constat, frontière de l'échéance | medium | patch | Aucun test ne les exerce. |
| Paiement en double sur un passage déjà constaté, ou remboursement déjà créé par un autre paiement : aucun incident | medium | defer | Réel mais hors du périmètre demandé (`deferred-work.md`). |
| Passage dont toutes les commandes sont annulées : paiement non constatable depuis l'écran | medium | defer | Limite (d) d'`AGENTS.md` ; le module le traite. Noté pour une story suivante. |
| Listes limitées à 100 et 200 sans pagination | low | defer | Déjà noté à la 6.4. |
| `constateLe` fourni par l'appelant pour juger l'abandon | low | rejet | Appelants de confiance seulement (même choix qu'en 6.4). |
| Commande sans ligne confirmée sans rien vendre | low | rejet | Inatteignable : une commande est toujours créée avec ses lignes. |
| Annulation pendant un paiement ouvert qui a un incident | low | rejet | Couvert par l'acceptation des deux totaux. |
| Port `Remboursement` jamais appelé, mise à jour d'un composant démonté, rendu de la page sans test, étiquette d'anciens incidents | low | rejet | Port demandé par la spec (OQ-1) ; React 18 sans avertissement ; table `Incident` vide en production ; rendu mince. |
| Spec, `sprint-status.yaml` et documentation non alignés | false | rejet | Aligné à l'étape de présentation. |

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Migration appliquée par le porteur (sauvegarde, `preview`, production) avant la fusion ; ouvrir l'écran en préversion sans rien constater.
