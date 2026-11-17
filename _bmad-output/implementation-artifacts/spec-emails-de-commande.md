---
title: 'E-mails de commande — confirmation, annulation, remboursement et alertes de l''équipe'
type: 'feature'
created: '2026-11-17'
status: 'done'
baseline_commit: '9a7550a'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-6-6-vente-ailleurs-pendant-une-reservation.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Quand une commande est confirmée, annulée ou remboursée, personne n'est prévenu : l'acheteur ne reçoit rien, l'artiste n'apprend pas qu'une œuvre est vendue, et l'équipe doit surveiller l'écran (FR-34, FR-25, FR-31). Les événements existent déjà (`CommandeConfirmee`, `CommandeAnnulee`, `PaiementConstate`) mais sans gestionnaire.

**Approach:**
- Gestionnaires du module `notifications`, reliés à ces événements dans `abonnements.ts` par `via`, un e-mail par événement même rejoué (réclamation atomique, clé d'idempotence), adresses lues en base à l'envoi, jamais dans les journaux.
- Acheteur : confirmation de commande, puis annulation (avec l'état du remboursement quand il existe). Artiste : avis de nouvelle commande. Équipe : alerte à `CONTACT_EQUIPE` pour une commande confirmée ou annulée.
- Contenus purs dans `contenus.ts`, textes dans `fr.courriels`, sobres, au vouvoiement, sans promesse de délai de remboursement ni de retour (OQ-2, OQ-4 ouvertes).

## Boundaries & Constraints

**Always:**
- Décision 1A : un e-mail à l'acheteur par commande (« Commande ERR-… confirmée » ou annulée), pas de récapitulatif par paiement.
- Décision 2A : l'avis à l'artiste est sobre : numéro, titres des œuvres, « L'équipe Errancy vous écrira pour l'expédition » ; ni coordonnées de l'acheteur, ni échéance de prise en charge (pas de délai décidé).
- Un seul e-mail par événement et par destinataire, même rejoué ; aucun e-mail si la commande n'a pas de passage (commande historique) ou si l'adresse manque.
- Aucune migration : seules lectures et e-mails ; aucune écriture hors `TraitementEvenement`.
- Montants et délais lus sur les lignes figées de la commande, jamais additionnés dans le code ; aucune coordonnée de l'acheteur dans l'e-mail de l'artiste ni de l'équipe.
- Hors production, seul l'adaptateur « journal » tourne (AD-22) ; textes dans `fr` ; `LOT2_OUVERT` sans effet.

**Never:** nouvel essai automatique ou balayage (AQ-2, 6.7) ; remboursement réel (OQ-1) ; espace de commande de l'artiste (Epic 8) ; page de suivi de l'acheteur (7.7) ; e-mails de la 6.7 ; `Order`, `/api/checkout`, webhook Stripe, `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Commande confirmée | `CommandeConfirmee` | e-mail à l'acheteur, avis à l'artiste, alerte à l'équipe | adresse absente : rien, journal d'ids |
| Commande annulée avec remboursement | `CommandeAnnulee`, remboursement `demande` | e-mail à l'acheteur qui dit l'annulation et que le remboursement est demandé, alerte à l'équipe | — |
| Annulée sans paiement | annulation par l'équipe ou vente ailleurs | e-mail à l'acheteur (annulation, aucun débit), alerte à l'équipe | — |
| Rejeu | même événement | aucun second e-mail | réclamation atomique |
| Commande historique | sans passage | aucun e-mail | — |
| Échec d'envoi | prestataire en échec | l'événement reste traité, échec journalisé (ids) | pas de nouvel essai (AQ-2) |

</frozen-after-approval>

## Code Map

- `src/lib/notifications/gestionnaires.ts`, `contenus.ts` -- nouveaux gestionnaires et contenus purs, sur le modèle de `envoyerAccuseVisite` et `envoyerLienVenteAssistee` (lecture en base à l'envoi, `envoyer`, clé `${evenement.id}:nom`).
- `src/lib/abonnements.ts` -- relier `CommandeConfirmee` et `CommandeAnnulee` par `via` (ajouter les noms à `via`, jamais d'import statique : cycle d'imports, `tests/abonnements-ordre.test.ts`).
- `src/lib/commandes/` -- lecture des données d'e-mail (numéro, lignes figées, adresse de l'acheteur, état du remboursement) par une fonction du module, sans accès à Prisma depuis `notifications` hors du schéma existant.
- `src/lib/i18n/fr.ts` -- `fr.courriels` (confirmation, annulation, avis artiste, alertes) ; `src/lib/reglages` -- `CONTACT_EQUIPE`.
- Ne pas modifier : `Order`, `/api/checkout`, webhook Stripe, états de commande.

## Tasks & Acceptance

**Execution:**
- [x] contenus purs et textes `fr.courriels` (acheteur : confirmation, annulation ; artiste : nouvelle commande ; équipe : deux alertes)
- [x] gestionnaires et lecture des données par le module `commandes`
- [x] abonnements, tests (base réelle : un seul e-mail par événement, rejeu, sans passage, remboursement), `AGENTS.md`

**Acceptance Criteria:**
- Given une commande confirmée, when `CommandeConfirmee` est traité, then l'acheteur, l'artiste et l'équipe reçoivent chacun un e-mail, et rejouer l'événement n'en renvoie aucun.
- Given une commande annulée, when `CommandeAnnulee` est traité, then l'acheteur est prévenu (et informé du remboursement demandé s'il existe) et l'équipe est alertée.
- Given l'e-mail de l'artiste ou de l'équipe, when il est composé, then il ne contient ni adresse ni coordonnées de l'acheteur.
- Given une commande sans passage, when un événement la concerne, then aucun e-mail ne part.

## Implementation Notes

- Aucune migration. Lecture seule par `src/lib/commandes/courriels.ts` ; quatre gestionnaires (`envoyerConfirmationCommande`, `envoyerAvisCommandeArtiste`, `envoyerAnnulationCommande`, `alerterEquipeCommande`) reliés à `CommandeConfirmee` et `CommandeAnnulee` par `via`.
- Textes dans `fr.courriels.commande` ; l'e-mail d'annulation dit « à ce jour, aucun paiement reçu » ou l'état du remboursement de la commande nommée.
- Tests : 849 (base réelle) et 106 (navigateur) ; build et eslint sans erreur.

## Spec Change Log

## Review Triage Log

Passe 1 (trois relecteurs : aveugle, cas limites, lacunes de vérification).

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Confirmation sans la mention « Droits et taxes d'import éventuels non inclus » alors que `AGENTS.md` l'impose à tout prix total | medium | patch | Chaque ligne montre son total livré, sans la mention de `fr.livraison`. |
| « Aucun montant débité » peut devenir faux si un paiement est constaté ensuite pour la commande annulée | medium | patch | Texte reformulé (« à ce jour, aucun paiement reçu ») ; l'e-mail de suivi à la création tardive du remboursement est reporté. |
| Texte de remboursement qui ne dit pas de quelle commande (passage à deux commandes) | low | patch | Le texte doit nommer la commande concernée. |
| « 1 jours » : pas de singulier pour le délai | low | patch | `fr.courriels.commande.confirmee.delai` écrit toujours « jours ». |
| `AGENTS.md` garde « aucun e-mail » dans les puces 6.4, 6.5 et 6.6 | low | patch | Le nouveau paragraphe les contredit ; mise à jour factuelle. |
| Aucun test : annulation par vente ailleurs (6.6), événement périmé, branche « remboursement effectué » | medium | patch | La chaîne `ReservationAnnulee` → `CommandeAnnulee` → e-mails et la garde d'état ne sont exercées par aucun test. |
| Remboursement marqué effectué sans e-mail à l'acheteur ; pas d'e-mail quand le remboursement naît après une annulation sans paiement | medium | defer | Aucun événement `RemboursementEffectue` n'existe (`deferred-work.md`). |
| E-mail perdu sans signal visible pour l'équipe | medium | defer | Dépend d'AQ-2 (rejeu et visibilité des échecs). |
| Total de commande absent, alertes d'équipe multiples par paiement, lecture répétée de la commande, dépendance directe à `@/lib/commandes/courriels`, adresse mal formée, lignes vides, états postérieurs à `confirmee` | low | rejet | Aucun total (règle : pas d'addition hors `livraison`) ; une alerte par commande est voulue ; cas inatteignables aujourd'hui (une commande a toujours des lignes et une adresse valide) ; mêmes imports directs ailleurs. |
| `via` sans changement visible, spec non alignée, clé d'idempotence non assertée | false | rejet | La compilation et les tests passent ; spec alignée à la présentation ; la réclamation protège l'idempotence. |

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Aucune migration. Textes des e-mails à relire par le porteur avant l'ouverture ; aucun envoi réel hors production.
