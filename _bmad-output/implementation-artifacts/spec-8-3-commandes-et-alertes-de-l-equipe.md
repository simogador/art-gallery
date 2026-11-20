---
title: 'Story 8.3 — Commandes et alertes de l''équipe'
type: 'feature'
created: '2026-11-20'
status: 'done'
baseline_commit: 'b422d25fc22754ef1186ddc002d38fb25ae1bc7e'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-8-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-8-2-l-artiste-expedie-et-saisit-le-suivi.md', '{project-root}/_bmad-output/implementation-artifacts/spec-6-5-paiement-tardif-abandon-et-incidents.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Une fois la commande payée, l'équipe ne voit plus où elle en est : elle ne sait ni si l'artiste l'a prise en charge, ni quand elle devait partir, ni son numéro de suivi, et elle ne peut pas annuler une commande confirmée (FR-26, AD-10, UJ-3).

**Approach:**
- Migration additive : `LigneCommande.preparationJours` (délai de préparation figé à la création, écrit par `creerPassageEnCaisse` avec la valeur de `livraison`), `Commande.expedieAvant` (échéance d'expédition stockée, AD-10) et trois colonnes de trace d'annulation (`annuleeLe`, `annuleePar`, `motifAnnulation`).
- Écran `/dashboard/admin/commandes` : nouvelle section « Commandes » (admin seulement, lecture dans `commandes`) listant les commandes payées (`confirmee`, `prise_en_charge`, `expediee`, `annulee`) : état, artiste, échéance de prise en charge, échéance d'expédition, transporteur et numéro de suivi, envoi assuré et référence, état du remboursement ; réclamations : absentes jusqu'à la 8.5. Les retards (prise en charge au-delà de l'échéance, expédition au-delà de `expedieAvant`) sont calculés à la lecture et signalés par deux alertes distinctes, en tête de la section.
- `annulerParLEquipe(acteur, numero, motif)` (admin seulement, motif de 10 à 500 caractères obligatoire) : `confirmee` ou `prise_en_charge` → `annulee` par la table de transitions, remboursement de l'allocation demandé (état `demande`), qui, quand et motif tracés, événement `CommandeAnnulee` ; l'acheteur est prévenu par l'e-mail d'annulation existant (remboursement demandé) et l'artiste par un nouvel e-mail.

## Boundaries & Constraints

**Always:**
- AD-15 : seul l'acteur `admin` relu en base lit la section et annule ; vérifié dans `commandes` (`acces_refuse`), test pour un artiste et un visiteur.
- AD-9 et AD-10 : transition par `transitionPermise` sous le verrou du passage, mise à jour conditionnelle ; échéances stockées, « en retard » calculé à la lecture, jamais posé par une tâche ; rejouée = succès sans effet (`dejaAnnulee`), un seul remboursement (contrainte `RemboursementCommande`), un seul événement.
- Remboursement : allocation de la commande lue par agrégat de la base (`demanderRemboursement`), rattaché au paiement constaté du passage ; aucun montant additionné dans le code ; une commande sans paiement constaté ne peut pas être annulée ici (`etat_invalide`).
- Aucune donnée personnelle dans les journaux ni les charges d'événements (ids seulement) ; adresse, téléphone et e-mail de l'acheteur absents de la section (l'équipe voit l'acheteur par son numéro de commande) ; textes dans `fr` (règle `jsx-no-literals` sur les composants de la section).

**Never:** livraison constatée (8.4) ; réclamations et retours (8.5) ; écran de remboursement ou d'avoir (8.6) ; clôture et retrait de l'œuvre (8.7 : une œuvre d'une commande annulée reste `vendue` jusqu'à la décision de l'équipe) ; annulation d'une commande `expediee` ou `en_attente_paiement` par ce geste (celle-ci reste `annulerCommande`) ; `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`.

**Décisions du porteur (2026-11-20) :**
- 1A : l'e-mail d'alerte de retard à l'équipe est reporté à la story 6.7 (le balayage `api/balayage` n'existe pas, AQ-2 ouverte) ; la 8.3 ne crée ni route de balayage, ni secret, ni planificateur ; l'écran calcule les alertes à la lecture (`deferred-work.md`).
- 2A : l'échéance d'expédition `expedieAvant` part de la date du constat du paiement (constat + plus long `preparationJours` des lignes), posée à la confirmation par `traiterPaiementConstate`, comme la date de livraison estimée de `/suivi` ; une commande sans `preparationJours` n'a pas d'échéance d'expédition.
- 3A : le motif d'annulation est lu par l'artiste (dans son e-mail) et par l'équipe ; l'acheteur ne le lit pas : il reçoit l'e-mail d'annulation avec l'état du remboursement.
- Les décisions 1A à 3A sont inscrites dans `docs/decisions-porteur.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Retard de prise en charge | `confirmee`, `priseEnChargeAvant` passée | alerte « Prise en charge en retard » sur la ligne et en tête de section | N/A |
| Retard d'expédition | `confirmee` ou `prise_en_charge`, `expedieAvant` passée | alerte distincte « Expédition en retard » | N/A |
| Commande ancienne | sans `expedieAvant` | aucune alerte d'expédition, « — » à l'écran | N/A |
| Annulation | admin, `confirmee` ou `prise_en_charge`, motif valide | `annulee`, remboursement `demande`, trace (qui, quand, motif), événement ; e-mails à l'acheteur et à l'artiste | N/A |
| Motif absent ou court | motif vide ou < 10 caractères | refus `motif_invalide`, rien écrit | message par champ |
| Rejeu | déjà `annulee` | `{ ok, dejaAnnulee: true }`, aucun second remboursement ni événement | N/A |
| Mauvais état | `expediee`, `en_attente_paiement`, `historique` | `etat_invalide` | message neutre |
| Non admin | artiste, user, visiteur | `acces_refuse`, section absente | redirection |
| Deux annulations simultanées | deux appuis | un seul remboursement, un seul événement | N/A |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` (`LigneCommande`, `Commande`) + `prisma/migrations/20261125090000_suivi_equipe/` -- `LigneCommande.preparationJours Int?`, `Commande.expedieAvant`, `annuleeLe`, `annuleePar`, `motifAnnulation` ; `docs/migrations.md`.
- `src/lib/livraison/prix.ts`, `index.ts` (`PrixLivre`, `PrixLivreFige`) -- exposer `preparationJours` (déjà calculé dans la somme préparation + transport) ; `src/lib/commandes/passage.ts:133-170` -- l'écrire sur la ligne.
- `src/lib/commandes/paiement.ts` (confirmation) -- poser `expedieAvant` (constat + plus long `preparationJours` des lignes, ou prise en charge selon Q2) ; `prise-en-charge.ts` selon Q2.
- `src/lib/commandes/etats.ts` -- `confirmee` et `prise_en_charge` → `annulee`.
- `src/lib/commandes/suivi-equipe.ts` (nouveau) + `suivi-equipe-regles.ts` (pur : `alertesDeRetard`) -- `commandesDeLEquipe(acteur)` (admin seulement, lecture par agrégats, bornée) ; `annulation.ts` -- `annulerParLEquipe` (réutilise `demanderRemboursement`, verrou du passage, événement `CommandeAnnulee`) ; export par `index.ts`.
- `src/lib/notifications/gestionnaires.ts`, `contenus.ts`, `abonnements.ts` (`via`), `commandes/courriels.ts`, `src/lib/i18n/fr.ts` -- e-mail à l'artiste pour une annulation par l'équipe (nouveau gestionnaire sur `CommandeAnnulee`, motif selon Q3) ; l'e-mail d'annulation de l'acheteur ne dit plus « aucun paiement reçu » quand un paiement a été constaté.
- `src/app/dashboard/admin/commandes/page.tsx`, `CommandesEquipe.tsx` (client : annulation en deux temps, motif, `role="status"`, `router.refresh()`, garde `useRef`), `actions.ts` (`actionAnnulerParLEquipe`) -- interface ; `.eslintrc.js` (`SURFACES_TEXTES`).
- Réutiliser : `HeureFixe` (équivalent admin), `formaterDateHeure`, `RemboursementsEquipe.tsx` (état du remboursement). Ne pas changer : `annulerCommande` (en attente seulement), `traiterPaiementConstate` hors l'échéance.

## Tasks & Acceptance

**Execution:**
- [x] schéma, migration, `docs/migrations.md`, `livraison` -- données de la story.
- [x] `commandes` (états, échéance d'expédition, lecture de l'équipe, annulation par l'équipe) -- logique, alertes, trace.
- [x] événement, e-mail à l'artiste, correction du texte d'annulation de l'acheteur, `fr` -- notifications.
- [x] section « Commandes » de `/dashboard/admin/commandes`, ESLint -- interface.
- [x] `tests/suivi-equipe.test.ts` (base réelle : matrice, accès, remboursement unique, concurrence), `tests/navigateur/commandes-equipe.test.tsx` -- preuves.
- [x] `AGENTS.md` -- puce « Commandes de l'équipe ».

**Acceptance Criteria:**
- Given une commande dont l'échéance de prise en charge ou d'expédition est passée, when l'équipe ouvre `/dashboard/admin/commandes`, then une alerte distincte la signale sans aucune tâche planifiée.
- Given une commande `confirmee` ou `prise_en_charge` et un motif valide, when l'équipe l'annule, then elle passe en `annulee`, un remboursement est demandé et la trace (qui, quand, motif) est conservée.
- Given un artiste ou un visiteur, when il tente de lire la section ou d'annuler, then l'accès est refusé.

## Implementation Notes

- Migration `20261125090000_suivi_equipe` (SHA-256 `15cd29626795015306a67d4e10176d7bc086d11630864e686eca08463d563a8c`) : `LigneCommande.preparationJours`, `Commande.expedieAvant`, `annuleeLe`, `annuleePar`, `motifAnnulation`.
- Vérifié : `npx eslint .` (0 erreur), trois contrôles d'exceptions (aucun ajout), `npm test` (1 082 réussis, base réelle), `npm run test:navigateur` (213 réussis), `npm run build`.
- Après relecture : les commandes à expédier (`confirmee`, `prise_en_charge`, 300 au plus) sont lues à part des 50 dernières expédiées, avec un signal de troncature ; un délai de préparation nul ou absent ne donne pas d'échéance d'expédition ; `annulerParLEquipe` ne rend « déjà annulée » que pour une commande annulée par l'équipe.
- Limites : pas d'e-mail d'alerte de retard (6.7, `deferred-work.md`) ; commandes confirmées avant la migration sans échéance d'expédition ; textes à relire par le porteur (section, e-mail à l'artiste).

## Spec Change Log

## Review Triage Log

| # | Relecteur | Constat | Verdict | Preuve | Suite |
|---|---|---|---|---|---|
| 1 | edge, blind | Liste des commandes actives plafonnée à 300 (plus anciennes d'abord) : les expédiées s'accumulent jusqu'à la 8.4 et font disparaître sans signal des commandes en retard plus récentes | medium | `take: 300` sur `confirmee`, `prise_en_charge`, `expediee` mêlées | patch (deux lectures, signal de troncature) |
| 2 | edge, blind | `preparationJours` à 0 : `expedieAvant` = date du constat, alerte « Expédition en retard » dès la confirmation | medium | `ajouterJours(constat, 0)` et comparaison inclusive | patch (0 = pas d'échéance) |
| 3 | edge, blind | `annulerParLEquipe` répond « déjà annulée » pour une commande annulée sans paiement (abandon, vente ailleurs) | medium | aucun test de trace `annuleeLe` | patch (`etat_invalide` sans trace d'annulation par l'équipe) |
| 4 | vgap | Exclusion des simples attentes de la liste des annulées non testée ; cas 6.5 jamais lu | medium | le test unique annule une commande confirmée | patch (test, titre) |
| 5 | vgap | Texte « paiement reçu » de l'acheteur testé seulement sur le contenu pur | medium | tous les tests ont un remboursement | patch (test de câblage) |
| 6 | vgap, blind | Confirmation d'une commande aux lignes sans `preparationJours` non testée ; cas 0 | medium | test « ancienne » met `expedieAvant` à NULL par SQL | patch (tests) |
| 7 | blind | Zone de motif sans `maxLength`, bloc d'alertes sans région nommée, aucun focus à l'ouverture de la confirmation, échéances affichées pour une commande expédiée | low | `CommandesEquipe.tsx` | patch |
| 8 | blind | E-mail à l'artiste promet « l'équipe vous écrit pour la suite » sans propriétaire de ce suivi | low | aucune story ne le livre | patch (texte neutre) ; limite : artiste sans compte = aucun e-mail |
| 9 | blind | Aucun rattrapage de `expedieAvant` pour les commandes en cours | low | aucune commande réelle avant l'ouverture du Lot 2 ; limite documentée | rejeté |
| 10 | blind | Alertes passives, aucun compteur dans la navigation | low | décision 1A : e-mail reporté à la 6.7 | rejeté |
| 11 | blind, edge | Liste des annulées incomplète (annulation 6.6 vue par son remboursement seul), tri différent | low | choix de lecture | rejeté |
| 12 | edge | Remboursement d'allocation nulle sans ligne ni incident | low | une commande a toujours des lignes à prix positif | rejeté |
| 13 | blind, edge | `prixLivreFige` renvoie `pas_de_zone` si `preparationJours` est nul | low | une offre livrée sans préparation est déjà « non livrée » en amont | rejeté |
| 14 | blind | Annulation et expédition simultanées : message d'état générique côté artiste | low | verrou de passage : l'un des deux gagne | rejeté |
| 15 | edge | Deux alertes pour une même commande en retard | low | alertes distinctes voulues par la spec | rejeté |
| 16 | blind, edge | État mis à jour après démontage, `numero` mesuré avant `trim`, page sans accès non admin | low | sans effet observable | rejeté |

## Verification

**Commands:**
- `npx eslint .` ; `node scripts/verifier-exceptions-prisma.cjs origin/main` (et les deux listes) ; `npm test` ; `npm run test:navigateur` ; `npm run build` -- tous verts.
