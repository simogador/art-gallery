---
title: 'Story 6.3 bis — Libérer et voir les réservations, renvoyer le lien, `/commande` pendant la maintenance'
created: '2026-11-12'
status: 'done'
baseline_commit: 'dbb23e5'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-6-3-vente-assistee-reserver-et-envoyer-le-lien.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Une vente assistée posée ne peut plus être défaite ni suivie depuis l'écran : une réservation dont l'e-mail n'est pas parti, ou envoyée à une mauvaise adresse, bloque l'œuvre jusqu'à 48 h ; l'équipe ne voit aucune réservation ; et tant que `MAINTENANCE_MODE` est actif, l'acheteur ne peut pas ouvrir son lien (FR-12, FR-26, UJ-4).

**Approach:**
- `passeLaMaintenance` laisse passer `/commande` et `/commande/…` pour tout le monde (décision du porteur du 2026-11-11, B) ; la maintenance reste pilotée par `MAINTENANCE_MODE`, rien ne la lève.
- Sur `/dashboard/admin/commandes`, l'admin voit les réservations en cours (œuvre, bénéficiaire, origine, échéance) et le journal des terminées (issue, qui, quand) ; il peut libérer une réservation : l'œuvre redevient disponible, l'issue `liberee` est journalisée avec son auteur, le lien est révoqué.
- « Renvoyer le lien » pour une réservation active dont l'e-mail n'est pas parti (même adresse, même échéance).

## Boundaries & Constraints

**Always:**
- Seul l'acteur `admin` (rôle relu en base, vérifié dans le module et par test).
- Libération par `libererReservation` de `disponibilite` (seul écrivain de `Reservation`), jamais par SQL ; une œuvre vendue ailleurs ou retirée entre-temps n'est jamais écrasée.
- Colonne facultative `Reservation.issuePar` (identifiant de l'utilisateur, sans clé étrangère) : migration additive appliquée par le porteur avant la fusion (décision 1A).
- Révoquer = libérer (décision 2A) : pas de correction d'adresse ; pour la changer, on libère puis on pose de nouveau. Le renvoi n'existe que pour une réservation active de vente assistée, non échue, sans lien actif.
- Aucun e-mail ni lien dans les journaux ; textes dans `fr` ; `LOT2_OUVERT` sans effet.

**Never:** rattachement à la demande d'origine (FR-28, story suivante) ; paiement, constat (6.4) ; annulation de la commande et abandon (6.5) : la commande reste `en_attente_paiement` après une libération ; balayage, « Me prévenir » (6.7) ; lever la maintenance ou toucher `public/robots.txt`, `MAINTENANCE_MODE` ; `/api/checkout`, webhook Stripe ; `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Maintenance | lien `/commande/…` ou `/commande`, maintenance active, visiteur | la page répond ; `/galerie` reste en maintenance | — |
| Libération | admin, réservation active | œuvres `disponible`, issue `liberee`, `issuePar`, `issueLe`, lien révoqué, événements répartis | — |
| Œuvre déclarée vendue ailleurs | pendant la réservation | libération n'y touche pas | mise à jour conditionnelle |
| Non admin | visiteur, utilisateur, artiste | `acces_refuse`, rien écrit | — |
| Déjà terminée | libération rejouée | succès sans effet (idempotent) | — |
| Renvoi | e-mail non parti, active, non échue | nouveau lien, e-mail envoyé, même échéance | échec : lien révoqué, message |
| Renvoi refusé | lien actif, échue ou terminée | refus typé, rien envoyé | — |
| Vue | admin | en cours (œuvre, bénéficiaire, origine, échéance) et 50 dernières terminées avec issue, auteur, date | état vide |

</frozen-after-approval>

## Review Triage Log

Passe 1 (trois relecteurs : aveugle, cas limites, lacunes de vérification).

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Vue des réservations : passage de plusieurs œuvres, lien actif et échéance dépassée jamais vérifiés | medium | patch | Le seul test de la vue n'a qu'un passage d'une œuvre, sans lien actif ni échue : `lienActif` toujours faux ou `echue` toujours faux passeraient. Test ajouté. |
| Libération d'un identifiant de passage inconnu : « déjà terminée » | low | patch | `libererVenteAssistee` rend `liberees: 0` pour un id inexistant ; refus `invalide` si le passage n'existe pas. |
| « Libérer » et « Renvoyer » affichés pour une réservation d'origine paiement, qui les refuse | low | patch | Aucune n'existe avant l'Epic 7, mais le bouton échouerait toujours ; seul `vente_assistee` les montre. |
| La confirmation ne dit pas que la commande reste en attente | low | patch | L'équipe pourrait croire la commande annulée ; phrase ajoutée au texte de confirmation (annulation = 6.5). |
| Séparateur « · » écrit à la main dans le journal | low | patch | Convention `SEPARATEUR` de `i18n` (espace insécable avant le point). |
| Focus perdu après « Libérer » ou « Annuler » | low | defer | Réel (focus sur `<body>` quand le bouton disparaît) mais sans perte de donnée ; à traiter avec un composant de confirmation commun. |
| Page `/dashboard/admin/commandes` sans test de rendu | low | defer | Données lues par un module testé, rendu mince ; même choix qu'en 6.3. |
| Origines mélangées, `issuePar` d'un utilisateur supprimé, `issueLe` nul trié en tête | low | rejet | Cas inatteignables aujourd'hui : un passage a une seule origine, `issueLe` est toujours écrit avec `issue`. |
| Deux renvois simultanés, renvoi sans limite de débit, réutilisation de `VenteAssisteePosee`, `envoye` faux sans tentative d'envoi | low | rejet | Limite (a) déjà documentée ; chaque correction ajoute un verrou, un événement ou un code. |
| Journal limité aux 50 dernières, `issue!`, état d'attente commun à toutes les lignes, message périmé, double appui de test | low | rejet | Volume faible, aucun dommage nommé ; corrections plus lourdes que le défaut. |
| `/commande` sans test du middleware pendant la maintenance | low | rejet | Fonction pure testée (`passeLaMaintenance`) ; le middleware ne fait que l'appeler. |
| Documentation non mise à jour (migrations, AGENTS.md) | false | rejet | `docs/migrations.md`, `AGENTS.md` et `docs/decisions-porteur.md` sont mis à jour (le fichier de diff les excluait). |

## Code Map

- `src/lib/reglages/index.ts` `passeLaMaintenance` (chemin `/commande`) ; test : visiteur sur `/commande`, `/commande/x`, refusé ailleurs.
- `prisma/schema.prisma` + migration additive `Reservation.issuePar` ; `src/lib/disponibilite/reservation.ts` (`libererReservation(…, { par })`, lecture `reservationsPourAdmin`), `disponibilite/index.ts`.
- `src/lib/commandes/vente-assistee.ts` : `libererVenteAssistee(acteur, passageId)` (libère, révoque le jeton, répartit), `renvoyerLienVenteAssistee(acteur, passageId)` (réutilise l'événement `VenteAssisteePosee` et `preparerLienVenteAssistee`), `reservationsDeLEquipe(acteur)` (bénéficiaire lu sur `CoordonneesAcheteur`).
- `src/app/dashboard/admin/commandes/` : liste, boutons « Libérer » (confirmation) et « Renvoyer le lien », composant client testé dans le navigateur, textes `fr.venteAssistee`.
- Ne pas modifier : états de commande, `/api/checkout`, webhook Stripe. Tests : `tests/vente-assistee.test.ts` (base réelle), `tests/navigateur/`, `docs/migrations.md`, `AGENTS.md`.

## Tasks & Acceptance

**Execution:**
- [x] `passeLaMaintenance` et son test
- [x] migration `issuePar`, `libererReservation` avec auteur, lecture admin
- [x] `libererVenteAssistee`, `renvoyerLienVenteAssistee`, `reservationsDeLEquipe`
- [x] liste, boutons, textes, tests, `AGENTS.md`, `docs/migrations.md`

**Acceptance Criteria:**
- Given la maintenance active, when un visiteur ouvre un lien `/commande`, then la page répond ; ailleurs la maintenance s'applique toujours.
- Given une réservation active, when l'admin la libère, then les œuvres redeviennent disponibles, l'issue `liberee` porte son auteur et sa date, et le lien est inactif.
- Given un autre acteur, when il tente la libération ou le renvoi, then `acces_refuse` et rien n'est écrit.
- Given une réservation active sans lien actif, when l'admin renvoie le lien, then l'acheteur reçoit un nouveau lien valable jusqu'à la même échéance.
- Given l'écran, when l'admin l'ouvre, then il voit les réservations en cours et le journal des terminées avec issue, auteur et date.

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Migration appliquée par le porteur (sauvegarde, `preview`, production) avant la fusion ; ouvrir l'écran en préversion sans rien poser.
