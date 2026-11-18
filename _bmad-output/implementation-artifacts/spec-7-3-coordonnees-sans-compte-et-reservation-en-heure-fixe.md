---
title: 'Story 7.3 — Coordonnées sans compte et réservation affichée en heure fixe'
type: 'feature'
created: '2026-11-18'
status: 'review'
baseline_commit: 'b10b28d'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-7-2-panier-sans-compte-une-commande-par-artiste.md', '{project-root}/_bmad-output/implementation-artifacts/spec-6-3-vente-assistee-reserver-et-envoyer-le-lien.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** « Continuer » du panier (7.2) mène à `/commande/coordonnees`, qui n'existe pas : un acheteur sans compte ne peut ni donner ses coordonnées, ni réserver ses œuvres, ni savoir jusqu'à quand elles lui sont réservées (FR-10, FR-12, UX-DR37).

**Approach:**
- Page `/commande/coordonnees` (serveur, `force-dynamic`, `noindex`) : récapitulatif des commandes du panier recalculé par le serveur, pays de livraison modifiable (toutes les commandes recalculées, annoncé), formulaire e-mail, nom, adresse de livraison, téléphone (libellés visibles, `autocomplete`, validation à la sortie du champ et à l'envoi, saisie conservée), phrase « Pas besoin de créer un compte : vous suivrez vos commandes grâce au lien envoyé par e-mail. »
- À l'envoi valide : en une transaction, `creerPassageEnCaisse` puis `reserverOeuvres` (origine `paiement`, 30 minutes) : tout ou rien ; une œuvre devenue indisponible n'est pas réservée et sa ligne le dit.
- Réservation affichée en heure fixe dans le fuseau de l'appareil, sans compte à rebours ni couleur : « Œuvres réservées pour vous jusqu'à 15 h 42. » ; à l'échéance « Votre réservation a pris fin à 15 h 42. » et « Continuer » tente une nouvelle réservation du même passage.

## Boundaries & Constraints

**Always:**
- Décision 1A : « Continuer » mène seulement aux coordonnées ; le passage et la réservation (30 minutes) sont créés à l'envoi du formulaire (écart assumé avec l'hypothèse d'UXQ-2) ; aucune migration pour cela.
- Décision 2A : nouvel usage de jeton `commande_publique` (cible = id du passage, échéance = celle de la réservation), cookie `httpOnly`, émis et lu par `acces` seulement ; migration additive (valeur d'enum `UsageJeton`), appliquée par le porteur avant la fusion.
- Décision 3A : la 7.3 couvre aussi le passage posé par l'équipe : depuis `/commande` (6.3) un lien mène à `/commande/coordonnees`, qui reprend ce passage et sa réservation (aucune nouvelle réservation) et complète adresse et téléphone.
- Page et action serveur refusent tout passage public tant que `lot2Ouvert()` est faux (AD-17) ; la vente assistée n'en dépend pas.
- Montants, frais, délais et totaux calculés par `livraison` (aucun composant n'additionne), cartes par artiste de `composerPanier` (7.2) ; le pays vient du cookie `pays`, les œuvres du panier du navigateur (slugs seulement, revalidés côté serveur) ; mention « Droits et taxes d'import éventuels non inclus » sous tout prix total.
- Coordonnées validées par `coordonnees-regles` (partagé avec le formulaire) ; jamais dans `User`, jamais dans les journaux (ni e-mail, ni adresse) ; adresse obligatoire dans ce formulaire, téléphone facultatif.
- Une saisie invalide n'écrit rien ; un double appui ne crée pas deux passages (garde `useRef` et idempotence côté serveur) ; plafonds de réservation de la 6.2 (3 par e-mail ; l'empreinte de l'appareil n'existe pas encore : pas de contrôle par appareil).
- Textes dans `fr` (règle `jsx-no-literals` sur `src/app/commande/coordonnees/`), formats par `i18n/formats` (heure dans le fuseau de l'appareil), focus, cibles de 44 px et propriétés logiques du socle de l'Epic 3.

**Never:** récapitulatif final et zone de paiement (7.4) ; encaissement (7.5) ; confirmation et suivi (7.6, 7.7) ; pages légales (7.1) ; ouverture d'« Acheter » (7.8) ; `Order`, `/api/checkout`, webhook Stripe ; mesure `DebutCommande` ; `public/robots.txt`, `MAINTENANCE_MODE`, `LOT2_OUVERT` écrit par le code, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Lot 2 fermé | visiteur ouvre `/commande/coordonnees` | page sans formulaire, message « L'achat en ligne ouvrira prochainement », lien vers le panier | action refuse (`ferme`) |
| Panier vide | aucun slug valide | « Votre panier est vide » et « Parcourir la galerie » | — |
| Envoi valide | coordonnées correctes, œuvres disponibles | passage créé, œuvres réservées, phrase d'échéance en heure fixe | — |
| Œuvre indisponible | vendue, réservée par un autre, retirée | rien n'est réservé ni créé, la ligne le dit, trois œuvres proches | — |
| Coordonnées invalides | e-mail ou nom manquant, adresse vide | erreur sous le champ et résumé en tête, saisie conservée, rien écrit | — |
| Plafond | 3 œuvres déjà réservées pour cet e-mail | message sans détail technique, rien réservé | — |
| Changement de pays | autre pays avant l'envoi | toutes les commandes recalculées, annonce `aria-live` | pays non livré : ligne « non livrée », envoi refusé |
| Double appui | deux envois rapprochés | un seul passage | — |
| Réservation échue | retour sur la page après l'échéance | « Votre réservation a pris fin à 15 h 42. », « Continuer » retente la réservation du même passage | œuvre prise entre-temps : la ligne le dit |
| Retour ou rechargement | passage déjà créé | la page reprend le passage et son échéance, sans second passage | — |

</frozen-after-approval>

## Code Map

- `src/lib/commandes/` -- étendre le module (propriétaire des passages) : fonction d'entrée publique du passage (création + réservation en une transaction, sur le modèle de `poserVenteAssistee`), lecture du passage public pour l'écran, retentative de réservation du même passage ; événement éventuel seulement s'il a un lecteur.
- `src/lib/acces/` -- jeton ou cookie qui rattache le navigateur à son passage (voir question ouverte 2).
- `src/app/commande/coordonnees/` -- page serveur, formulaire client (`FormulaireCoordonnees.tsx` sur le modèle de `FormulaireVisite`), action serveur, `loading.tsx`/`error.tsx`, test navigateur ; textes `fr.coordonnees`.
- `src/app/panier/CartContent.tsx`, `src/middleware.ts` -- « Continuer » (déjà en place) ; `/commande/coordonnees` passe la maintenance comme `/commande` (décision du porteur du 2026-11-11 déjà en place pour `/commande`).
- Ne pas modifier : `/api/checkout`, webhook Stripe, `Order`, `traiterPaiementConstate`.

## Tasks & Acceptance

**Execution:**
- [x] module `commandes` : passage public (création + réservation), retentative, lecture ; tests (base réelle)
- [x] rattachement du navigateur au passage (voir questions ouvertes)
- [x] page, formulaire, récapitulatif par commande, échéance en heure fixe, textes `fr`, test navigateur, `AGENTS.md`

**Acceptance Criteria:**
- Given un panier et le Lot 2 ouvert, when l'acheteur envoie des coordonnées valides, then un passage est créé et ses œuvres sont réservées en bloc ; si une œuvre n'est plus disponible, rien n'est réservé et sa ligne le dit.
- Given `/commande/coordonnees`, when l'acheteur saisit e-mail, nom, adresse et téléphone, then libellés visibles, `autocomplete`, validation à la sortie du champ et à l'envoi, saisie conservée, phrase « Pas besoin de créer un compte… ».
- Given un changement de pays, when il a lieu, then toutes les commandes sont recalculées et le changement est annoncé.
- Given une réservation en cours, when l'acheteur regarde l'écran, then « Œuvres réservées pour vous jusqu'à 15 h 42. » dans le fuseau de l'appareil, sans compte à rebours ni couleur ; à l'échéance la phrase devient « Votre réservation a pris fin à 15 h 42. » et « Continuer » tente une nouvelle réservation.
- Given le Lot 2 fermé, when l'action est appelée, then rien n'est créé.

## Implementation Notes

- Module `commandes` : `passage-public.ts` (`poserPassagePublic`, `lirePassagePublic`, `reprendrePassagePublic`, `completerCoordonneesDuPassage`, `completerCoordonneesDuLien`, `oublierPassagePublic`) et `recapitulatif.ts` (lecture des commandes d'un passage, partagée avec la 6.3 ; `Recapitulatif` gagne `adresseRenseignee`). `poserPassagePublic` refuse `ferme` avant toute lecture ; une transaction : `creerPassageEnCaisse(…, tx)`, `reserverOeuvres` (origine `paiement`, 30 min, e-mail, pas d'appareil), jeton ; événements répartis après. Double appui : un cookie valide dont la réservation n'est pas échue fait reprendre le passage ; en simultané, le verrou de ligne de l'œuvre fait échouer le second (rien d'écrit).
- Jeton (décision 2A) : `acces/commande-publique.ts` + `lireJetonRecent` dans `jetons.ts`. Écart de lecture de la spec : le jeton a bien pour échéance celle de la réservation, mais il reste **lisible** pendant `DUREE_ABANDON_COMMANDE_JOURS` après (sinon la page ne pourrait pas afficher « Votre réservation a pris fin à 15 h 42 » ni retenter le même passage, ce que la matrice d'I/O exige) ; une retentative émet un nouveau jeton et révoque l'ancien. Cookie `passage` (`httpOnly`, chemin `/commande`). Migration additive `20261120090000_commande_publique` (SHA-256 `9b59e18b690f28e6e9ebc42f9d9b2b82b5efd84f33a6612cd677b2edf137929f`, consigné dans `docs/migrations.md`), exercée par les tests sur base jetable ; jamais appliquée à une base partagée.
- Décision 3A : `/commande` propose « Indiquer mon adresse de livraison » vers `/commande/coordonnees`, qui lit le cookie `commande`, reprend la réservation sans en créer, et n'affiche que adresse et téléphone ; `completerCoordonneesDuLien` ne met à jour que ces deux colonnes (l'e-mail et le nom envoyés par le client sont ignorés). Indépendant du Lot 2.
- Page `/commande/coordonnees` : états assisté, Lot 2 fermé (message, lien vers le panier, aucun formulaire), passage de l'acheteur, panier. `CoordonneesPanier` recalcule par `recalculerPanier` (7.2) avec les cartes extraites dans `src/app/panier/CartesPanier.tsx` (sans bouton de retrait) ; seules les œuvres livrées sont envoyées, le serveur revérifie. `ReservationHeureFixe` : phrases exactes dans le fuseau de l'appareil, un seul minuteur à l'échéance, « Continuer » = `reprendreReservation`, focus sur la phrase après un envoi réussi. Middleware : `passeLaMaintenance` couvrait déjà `/commande/*`, seul un test est ajouté.
- Après le passage créé, la page n'a pas d'étape suivante (7.4) : « L'étape suivante, le paiement, ouvrira prochainement. » ; pas de moyen de modifier le panier pendant la réservation (limites dans `AGENTS.md`). Le jour est ajouté à la phrase d'échéance quand elle n'est pas aujourd'hui (passage de l'équipe sur 48 h).
- `tests/coordonnees.test.ts` (base réelle, 35 tests) et `tests/navigateur/coordonnees.test.tsx` (18 tests) ; `AGENTS.md` : nouveau paragraphe et trois phrases corrigées (7.2 : entrée de la vente assistée, limite (f), ligne « Running » ; 6.3 : adresse de livraison).

- Corrections après relectures : fin de réservation décidée seulement par le serveur (un `router.refresh()` à l'échéance locale, plus de boucle de rendu) ; `annulerPassagePublic` / « Modifier ma commande » ; reprise ou annulation + nouveau passage selon les œuvres et le pays ; retentative avec revérification des prix par `livraison` (`prix_change`) et prolongation de `abandonneLe` ; limite par IP `LIMITES_PASSAGE_PUBLIC` (`demandes/limites.ts`) ; blocage préventif au-delà de `PLAFONDS_RESERVATION.parEmail` ; `reservation_en_cours` quand la réponse s'est perdue ; formulaire conservé en cas d'échec du recalcul, réarmement du bouton, focus après reprise et complément ; lien de l'équipe inactif ; téléphone jamais écrasé par un champ vide. Aucune nouvelle migration. Écart conservé : aucun e-mail n'est envoyé à l'annulation par l'acheteur (pas d'événement `CommandeAnnulee`).

## Spec Change Log

## Review Triage Log

Passe 1 (trois relecteurs : aveugle, cas limites, lacunes de vérification).

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Boucle de rendu infinie à l'échéance (minuteur sans garde) | high | patch | Deux relecteurs ; un seul `router.refresh()` à l'échéance, seul l'état serveur change la phrase ; test de rendus stables. |
| Passage échu enfermant l'acheteur 7 jours, sans sortie | high | patch | `annulerPassagePublic` et « Modifier ma commande » (commandes annulées sans remboursement, réservations libérées, jeton révoqué). |
| Passage déjà réservé : nouvelle saisie (œuvres, pays, coordonnées) ignorée sans le dire | medium | patch | Mêmes œuvres et pays = reprise avec coordonnées mises à jour ; sinon ancien passage annulé puis nouveau, dans la même transaction. |
| Retentative après échéance au prix et à la livraison figés | medium | patch | Relecture par `prixLivreFige`, refus `prix_change`, abandon prolongé. |
| Réservations en boucle sans limite par IP | high | patch | `LIMITES_PASSAGE_PUBLIC`, clé salée `passage-ip:`, comme `/conseil`. |
| Panier de plus de 3 œuvres : message faux, aucun blocage préventif | medium | patch | Message distinct et blocage avant l'envoi. |
| Réponse perdue ou cookie refusé : bouton bloqué, œuvres dites indisponibles | medium | patch | Cookie posé par l'action, bouton réarmé, refus `reservation_en_cours`. |
| Focus perdu, saisie perdue au recalcul en échec, lien assisté échu sans message, téléphone écrasé | low | patch | Corrigés, avec tests navigateur et base réelle. |
| Tests manquants (pays hors zone, concurrence de la retentative, plafond, fuseau forcé, trois œuvres proches, journaux, mesure) et documentation | medium | patch | Ajoutés ; `AGENTS.md` et `docs/migrations.md` alignés. |
| Empreinte d'appareil absente | medium | defer | Déjà notée à la 6.2 ; limite par IP et par e-mail en attendant. |
| Lien de vente assistée non consommé : réécriture possible de l'adresse jusqu'à l'échéance | low | defer | Limite documentée ; `completerCoordonneesDuPassage` reçoit un id de confiance. |
| Phrase d'attente fausse si le gestionnaire de réservation interrompue échoue ; « maintenant » figé à minuit | low | defer | Limites documentées (6.6c, AQ-2). |
| Attribut `secure` du cookie et couleur par style calculé non testés | low | rejet | Aucun dommage nommé. |

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Migration éventuelle appliquée par le porteur (sauvegarde, `preview`, production) avant la fusion ; préversion avec `LOT2_OUVERT=oui` seulement en préversion, jamais en production.
