---
title: 'Story 6.4 — Paiement constaté par l''équipe et confirmation idempotente'
created: '2026-11-12'
status: 'done'
baseline_commit: 'e342bf4'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-6-3-vente-assistee-reserver-et-envoyer-le-lien.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Une vente assistée se conclut hors de l'application : l'équipe reçoit un virement ou un lien de paiement, mais rien ne le constate, ne vend les œuvres ni ne confirme les commandes (FR-13, AD-4, AD-8). Une confirmation rejouée ou deux constats du même paiement ne doivent jamais vendre deux fois.

**Approach:**
- Module `paiement` : ports Encaissement, Remboursement, Reversement (interfaces) et adaptateur `constat-manuel` (qui, quand, référence) ; aucun nom de prestataire hors `src/lib/paiement/adaptateurs/**`. La table `Paiement` reste à `commandes` (décision de la 6.1).
- `commandes.traiterPaiementConstate(fait)`, point d'entrée unique, une seule transaction : `Paiement` `ouvert` → `constate` par mise à jour conditionnelle, œuvres du passage `vendue` (par `disponibilite`, qui ferme leur réservation `confirmee`), commandes `confirmee` (table de transitions de `commandes`), événements `PaiementConstate` et `CommandeConfirmee` écrits avec elle.
- Montant ou devise différents de l'attendu, ou œuvre qui n'est plus vendable (vendue ailleurs, réservée par un autre) : rien n'est confirmé et un incident est enregistré ; l'annulation et le remboursement sont la story 6.5.
- Écran de l'équipe sur `/dashboard/admin/commandes` : commandes en attente de paiement, formulaire « Constater un paiement » (référence, montant), incidents.

## Boundaries & Constraints

**Always:**
- Seul l'acteur `admin` (rôle relu en base, vérifié dans le module et par test).
- Un paiement couvre tout le passage (décision 1A, OQ-16 reste ouverte) : le montant constaté doit égaler le total des commandes du passage encore `en_attente_paiement`, toutes confirmées ensemble ou aucune ; ce total vient d'un agrégat de la base (`_sum` des totaux de lignes figés), jamais d'une addition écrite dans le code (un test scanne `src/`) ; la devise est celle du passage.
- Incidents (décision 2A) : table `Incident` de `commandes` (passage, paiement, commande si connue, cause `montant_different` | `devise_differente` | `oeuvre_indisponible`, date, `traiteLe` facultatif sans écran de résolution) ; migration additive appliquée par le porteur avant la fusion.
- La paire (source, référence) est unique ; le même constat rejoué, ou sous une autre référence pour un passage déjà constaté, ne change rien (test) ; un seul `Paiement` ouvert par passage ; aucun e-mail ni adresse dans les journaux ; textes dans `fr` ; `LOT2_OUVERT` sans effet.
- Les œuvres ne passent en `vendue` que par `disponibilite` : mise à jour conditionnelle depuis `reservee` (réservation de ce passage) ou `disponible`, jamais écraser `vendue_ailleurs` ou `retiree`.

**Never:** e-mails d'acheteur, d'artiste et d'équipe (story suivante, `deferred-work.md`) ; annulation, remboursement, paiement tardif, abandon (6.5) ; vente ailleurs (6.6) ; balayage (6.7) ; prestataire de paiement (OQ-1 ouverte), `/api/checkout`, webhook Stripe ; `Order`, `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Constat valide | admin, passage de 2 commandes, montant exact | paiement `constate`, œuvres `vendue`, réservations `confirmee`, commandes `confirmee`, événements | — |
| Même constat rejoué | même référence | succès sans effet | paire unique |
| Autre référence, même passage | passage déjà constaté | rien ne change | aucun second paiement |
| Montant différent | écart | rien confirmé, incident `montant_different` | — |
| Devise différente | autre devise | rien confirmé, incident `devise_differente` | — |
| Œuvre non vendable | vendue ailleurs entre-temps | rien confirmé, incident `oeuvre_indisponible` | transaction annulée sauf l'incident |
| Non admin | visiteur, utilisateur, artiste | `acces_refuse`, rien écrit | — |
| Passage inconnu ou sans commande en attente | id absurde | refus `introuvable` ou `invalide`, rien écrit | — |
| Deux constats simultanés | même passage | un seul vend, l'autre sans effet | mise à jour conditionnelle |

</frozen-after-approval>

## Review Triage Log

Passe 1 (trois relecteurs : aveugle, cas limites, lacunes de vérification).

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Une œuvre dépubliée ou d'un artiste désactivé entre la pose et le constat est vendue | medium | patch | `vendreOeuvresDuPassage` ne relit pas `estVisible`, alors que la règle du projet est que le paiement refuse une œuvre non visible. Relue sous le verrou, refus `oeuvre_indisponible`. |
| Constat en un clic, irréversible (œuvres vendues, commandes confirmées, avant la 6.5) | medium | patch | Aucune confirmation ni montant à vérifier ; confirmation en deux temps (« Confirmer X pour N commande(s) ? »), comme la libération. |
| Paiement connu dans un autre état qu'`ouvert` ou `constate` : montant écrasé puis `paiement_conflit` opaque | low | patch | `connu` est repris quel que soit son état ; refus `invalide` si ce n'est pas `ouvert`. Test ajouté. |
| Montant très grand : dépasse `Int` et `SUM(...)::int` | low | patch | Borne haute dans `faitValide`, l'adaptateur et le formulaire ; `SUM` en `bigint`. |
| Montant 0 ou négatif : message d'erreur de la référence | low | patch | Message du montant. |
| Étiquette « € » pour un passage d'une autre monnaie | low | patch | Étiquette et total avec la monnaie du passage. |
| Incident déjà ouvert pour la même cause : le montant reçu de la seconde tentative n'est pas retenu | low | patch | L'incident existant est mis à jour (reçu, attendu). |
| Message de résultat commun à tous les passages | low | patch | Message effacé à chaque envoi et rattaché au passage concerné. |
| Texte mort `fr.paiement.acheteurInconnu` | low | patch | Clé non utilisée supprimée. |
| Branches de vente, œuvre supprimée, doublon d'incident d'autres causes sans test | medium | patch | Aucun test n'a d'échéance dépassée, de réservation libérée, de ligne sans œuvre (`SET NULL`) ni de rejeu pour `devise_differente` ou `oeuvre_indisponible`. Tests ajoutés. |
| Œuvre libérée puis constat : vendue sans réservation | low | rejet | Voulu par la spec et l'épic (« réservées pour ce passage, ou encore disponibles ») ; la commande reste en attente jusqu'à la 6.5. |
| Auteur du constat falsifiable par l'appelant (`constatePar`) | low | rejet | Seuls des appelants de confiance (adaptateurs) fournissent `FaitPaiementConstate` ; aucun chemin d'écran. |
| Référence et montant d'un paiement ouvert réécrits par la tentative suivante | low | rejet | Un seul paiement ouvert par passage (décision 1A) ; l'incident garde l'écart, la trace complète viendra avec la 6.5. |
| Test de nom de prestataire ne scanne que `paiement` et `commandes` | low | rejet | Le code Stripe historique (`/api/checkout`, webhook, supprimé en 7.9) en porte le nom ; un scan de tout `src/` échouerait. |
| Index partiel sur des lignes existantes, action qui valide le montant avant l'acteur, documentation non mise à jour | false | rejet | Aucun `Paiement` n'existe encore ; l'acteur est vérifié par le module ; `AGENTS.md` et `docs/migrations.md` sont mis à jour (le fichier de diff les excluait). |
| Incident sans œuvres ni références, liste limitée à 100, focus clavier, rendu de la page sans test | low | defer | Sans perte de donnée ; à traiter avec la vue des incidents de la 6.5 (`deferred-work.md`). |

## Code Map

- `src/lib/paiement/` (nouveau) : `ports.ts` (Encaissement, Remboursement, Reversement), `adaptateurs/constat-manuel.ts` ; ajouter le module à `MODULES_METIER` de `.eslintrc.js` s'il importe Prisma ; test « aucun nom de prestataire hors `adaptateurs/` ».
- `src/lib/commandes/` : `traiterPaiementConstate(fait)` (`paiement.ts`), transition `confirmee` dans `etats.ts`, écriture des incidents ; `src/lib/disponibilite/` : `vendreOeuvresDuPassage(passageId, tx)` (ferme les réservations `confirmee`, événements rendus).
- `src/lib/evenements/catalogue.ts`, `src/lib/abonnements.ts` : `PaiementConstate` (`{ paiementId }`) et `CommandeConfirmee` (`{ commandeId }`), sans gestionnaire d'e-mail (relatent seulement) ; un test.
- `prisma/schema.prisma` + migration additive : table `Incident` (cause en énumération), colonnes de `Paiement` retenant l'auteur et la date du constat.
- `src/app/dashboard/admin/commandes/` : commandes en attente (acheteur, œuvres, total à recevoir), formulaire « Constater un paiement » (référence, montant en euros par `champsPrix`), incidents ; `AdminNav` inchangé ; test navigateur.
- Ne pas modifier : `Order`, `/api/checkout`, webhook Stripe, états de commande hors confirmation. Tests : `tests/paiement.test.ts` (base réelle), `docs/migrations.md`, `AGENTS.md`.

## Tasks & Acceptance

**Execution:**
- [x] module `paiement` (ports, adaptateur `constat-manuel`) et test d'absence de nom de prestataire
- [x] migration `Incident` et colonnes de `Paiement`, transition `confirmee`
- [x] `vendreOeuvresDuPassage` (`disponibilite`) et `traiterPaiementConstate` (`commandes`), événements
- [x] écran : commandes en attente, formulaire, incidents ; tests (base réelle, navigateur), `AGENTS.md`, `docs/migrations.md`

**Acceptance Criteria:**
- Given un passage de commandes en attente et un constat au montant exact, when l'admin le constate, then paiement `constate`, œuvres `vendue`, réservations `confirmee` et commandes `confirmee` sont écrits ensemble.
- Given le même constat enregistré deux fois, ou sous deux références pour le même passage, when il est traité, then rien ne change la seconde fois.
- Given un montant ou une devise différents, ou une œuvre non vendable, when le constat est traité, then aucune commande n'est confirmée et un incident est enregistré.
- Given un autre acteur que l'admin, when il tente un constat, then `acces_refuse` et rien n'est écrit.
- Given le module `paiement`, when le test de CI scanne `src/`, then aucun nom de prestataire n'apparaît hors `src/lib/paiement/adaptateurs/**`.

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Migration appliquée par le porteur (sauvegarde, `preview`, production) avant la fusion ; ouvrir l'écran en préversion sans rien constater (aucune commande réelle).
