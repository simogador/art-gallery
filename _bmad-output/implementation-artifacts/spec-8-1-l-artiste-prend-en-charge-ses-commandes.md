---
title: 'Story 8.1 — L''artiste prend en charge ses commandes'
type: 'feature'
created: '2026-11-19'
status: 'done'
baseline_commit: '132faa619ba5731238e7bda3f435116608a49826'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-8-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-7-7-suivi-des-commandes-par-lien-sans-compte.md', '{project-root}/_bmad-output/implementation-artifacts/spec-emails-de-commande.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Une commande confirmée n'a aucune suite côté artiste : l'onglet « Commandes » est un texte d'attente, l'accueil n'a pas de bloc « À expédier », et rien ne permet de prendre en charge une commande ni de recevoir l'adresse de l'acheteur au bon moment (FR-22, AD-16, UJ-2).

**Approach:**
- Nouvel état `prise_en_charge` (table de transitions : `confirmee` → `prise_en_charge`) et trois colonnes de `Commande` : `priseEnChargeAvant` (échéance posée à la confirmation : constat + `DUREE_PRISE_EN_CHARGE_HEURES` = 48 de `reglages`), `priseEnChargeLe`, `priseEnChargePar` ; migration additive, avec rattrapage de l'échéance des commandes déjà confirmées.
- `commandes` expose aux artistes, à partir de l'acteur relu en base : la liste de leurs commandes `confirmee` et `prise_en_charge`, le nombre à prendre en charge, une commande par numéro (œuvres, prénom et pays de l'acheteur, échéance ; adresse et téléphone **seulement** en `prise_en_charge`) et `prendreEnCharge` (transition conditionnelle, auteur, date, événement `CommandePriseEnCharge`).
- Espace artiste : bloc « À expédier » en tête de l'accueil avec compteur masqué à zéro ; liste sur `/dashboard/artiste/commandes` ; page `/dashboard/artiste/commandes/[numero]` (zone neutre avant, « Je prends en charge » avec confirmation en deux temps, adresse, téléphone et rappel du guide d'emballage après).
- E-mail « Prise en charge » à l'acheteur (délai rappelé, lien de suivi émis à l'envoi) ; la frise de `/suivi` gagne l'étape « Prise en charge par l'artiste [date] » ; `/confirmation` et les lectures du passage traitent `prise_en_charge` comme une commande confirmée.

## Boundaries & Constraints

**Always:**
- AD-16 : adresse et téléphone ne sortent du module vers un artiste que pour une commande `prise_en_charge` de ses œuvres ; avant, seuls prénom et pays ; e-mail de l'acheteur jamais (test sur la valeur rendue).
- AD-15 : accès décidé par `acteurCourant()` et vérifié dans `commandes` (artiste de la commande seulement : `acces_refuse` / `introuvable` sans dire si la commande existe) ; jamais `session.user.role`.
- AD-9 : transition par `transitionPermise`, mise à jour conditionnelle `etat = confirmee AND artistId = …`, rejouée = succès sans effet (`dejaPriseEnCharge`), événement dans la transaction, `repartirApresValidation` après.
- AD-10 : l'échéance est stockée, « dépassée » calculée à la lecture ; affichée en heure fixe dans le fuseau de l'appareil, sans compte à rebours ni couleur seule.
- Montants jamais affichés ni additionnés ici ; textes dans `fr` (surface `jsx-no-literals` ajoutée pour `src/app/dashboard/artiste/commandes/**`) ; journaux et charges d'événements : ids seulement ; indépendant de `LOT2_OUVERT` (ventes assistées comprises).

**Never:** expédition, transporteur, numéro de suivi (8.2) ; alertes de retard et écran de l'équipe (8.3) ; livraison et masquage après livraison (8.4) ; somme due et « Ce qu'on vous doit » (8.8) ; prise en charge par l'équipe ; `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`.

**Décisions du porteur (2026-11-19) :**
- 1A : le prénom affiché à l'artiste est le premier mot du nom saisi (`prenom` pur, nom vide → « — »).
- 2A : le rappel du guide d'emballage est un court texte rédigé par l'agent dans `fr`, à relire par le porteur (reprend l'engagement du dépôt, sans promesse d'assurance ni de casse).
- 3A : l'e-mail « Nouvelle commande » à l'artiste porte aussi l'échéance de prise en charge (heure de Paris, écrite) et un bouton vers `/dashboard/artiste/commandes/[numero]`.
- 4A : trois relectures par des sous-agents indépendants.
- 5A : la spec est gardée entière (environ 2 300 jetons).
- 6A (2026-11-20) : une commande payée sans adresse de livraison (vente assistée dont l'acheteur n'a pas complété l'adresse) peut être prise en charge ; à la place de l'adresse, la page dit « Adresse non encore transmise : l'équipe Errancy vous la communique. ».
- 7A (2026-11-20) : une commande `historique` donne `introuvable` à l'artiste (elle n'a jamais d'artiste), et non `etat_invalide`.
- Les décisions 1A à 3A, 6A et 7A sont inscrites dans `docs/decisions-porteur.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Avant prise en charge | artiste A, commande `confirmee` de A | œuvres, prénom, pays, échéance ; `adresse`/`telephone` absents du résultat | N/A |
| Prise en charge | A confirme | `prise_en_charge`, date et auteur, événement, e-mail acheteur ; adresse, téléphone, guide affichés | N/A |
| Rejeu / double appui | commande déjà `prise_en_charge` | `{ ok, dejaPriseEnCharge: true }`, aucun événement | N/A |
| Autre artiste | artiste B, commande de A | `introuvable` (lecture et action), rien écrit | message neutre |
| Mauvais état | `en_attente_paiement`, `annulee`, `historique` | invisible pour l'artiste ; action `etat_invalide` | message neutre |
| Non artiste | visiteur, user, admin | `acces_refuse` ; page redirigée comme l'espace artiste | redirection |
| Échéance dépassée | `confirmee`, `priseEnChargeAvant` passée | « Échéance dépassée » écrit ; prise en charge toujours permise | N/A |
| Compteur | 0 commande `confirmee` | badge absent ; bloc absent s'il n'y a ni `confirmee` ni `prise_en_charge` | N/A |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` (`EtatCommande`, `Commande`) + `prisma/migrations/20261123090000_prise_en_charge/` -- valeur `prise_en_charge` (ajoutée avant `annulee`), colonnes `priseEnChargeAvant`, `priseEnChargeLe` (Timestamptz(3)), `priseEnChargePar` (texte, sans clé étrangère, comme `issuePar`) ; `UPDATE` de rattrapage depuis `Paiement.constateLe` ; `docs/migrations.md`.
- `src/lib/commandes/etats.ts` -- ajouter l'état et `confirmee: ['prise_en_charge']`.
- `src/lib/commandes/paiement.ts:162` -- poser `priseEnChargeAvant` avec `etat: 'confirmee'`.
- `src/lib/commandes/prise-en-charge.ts` (nouveau) + `prise-en-charge-regles.ts` (pur : `prenom`, `echeanceDepassee`) -- `commandesDeLArtiste`, `nombreAPrendreEnCharge`, `commandeDeLArtiste`, `prendreEnCharge` ; verrou `FOR UPDATE` du passage comme `annulation.ts:81` ; export par `index.ts`.
- `src/lib/commandes/suivi-regles.ts`, `suivi.ts:47,117,138`, `confirmation.ts:67`, `passage-public.ts:83`, `src/app/confirmation/page.tsx:63`, `src/app/suivi/FriseCommande.tsx`, `ListeSuivi.tsx` -- inclure `prise_en_charge` (frise : étape `prise_en_charge` faite et datée entre paiement et livraison ; confirmation : libellé « Confirmée »).
- `src/lib/evenements/catalogue.ts`, `src/lib/abonnements.ts` (`via`) -- événement `CommandePriseEnCharge` (`{ commandeId }`).
- `src/lib/notifications/gestionnaires.ts` (`envoyerCommande`, étendre `etatAttendu`), `contenus.ts`, `src/lib/i18n/fr.ts` (`fr.courriels.commande.priseEnCharge`, `fr.commandesArtiste`) -- e-mail acheteur, lien de suivi.
- `src/lib/reglages` -- `DUREE_PRISE_EN_CHARGE_HEURES = 48`.
- `src/app/dashboard/artiste/page.tsx` -- `BlocAExpedier` en premier ; `commandes/page.tsx` (réécrite), `commandes/[numero]/page.tsx`, `PriseEnCharge.tsx` (client, deux temps, garde `useRef`, `role="status"`, `router.refresh()`), `HeureFixe.tsx` (client, `formaterDateHeure` + `fuseauAppareil` après montage), `actions.ts` -- `.eslintrc.js` `SURFACES_TEXTES`.
- Réutiliser : `nomPays` (`livraison/pays`), `.zone-neutre` (`globals.css`), `lirePassageDuSuivi`, `urlAbsolue`. Ne pas changer : `traiterPaiementConstate` hors l'échéance, `annulerCommande` (reste `en_attente_paiement` seul).

## Tasks & Acceptance

**Execution:**
- [x] schéma, migration, `docs/migrations.md`, `reglages` -- données de la story.
- [x] `commandes` (états, confirmation, prise en charge, suivi, confirmation, passage public) -- logique et filtrage AD-16.
- [x] événement, abonnement, gestionnaire, contenu, `fr` -- e-mail « Prise en charge ».
- [x] pages et composants de l'espace artiste, `/suivi`, `/confirmation`, ESLint -- interface.
- [x] `tests/prise-en-charge.test.ts` (base réelle : matrice, AD-16 sur la valeur rendue, autre artiste, concurrence de deux appuis), `tests/suivi.test.ts` et `tests/emails-commande.test.ts` complétés, `tests/navigateur/prise-en-charge.test.tsx` -- preuves.
- [x] `AGENTS.md` -- puce « Prise en charge par l'artiste ».

**Acceptance Criteria:**
- Given une commande `confirmee` d'un artiste, when il ouvre son accueil, then « À expédier » est le premier bloc avec le compteur des commandes à prendre en charge.
- Given la prise en charge, when l'acheteur ouvre `/suivi`, then l'étape « Prise en charge par l'artiste [date] » est faite et la commande reste visible sur `/confirmation`.
- Given deux appuis simultanés, when ils aboutissent, then un seul événement et un seul e-mail.

## Verification

**Commands:**
- `npx eslint .` ; `node scripts/verifier-exceptions-prisma.cjs origin/main` (et les deux listes) ; `npm test` ; `npm run test:navigateur` ; `npm run build` -- tous verts.

## Implementation Notes

- Migration `20261123090000_prise_en_charge` (SHA-256 `79962c6a…857ca8`) : valeur avant `annulee`, trois colonnes, rattrapage depuis le dernier `Paiement.constateLe` constaté du passage + 48 h ; `prisma migrate diff` sans écart ; rattrapage vérifié à la main sur une base locale. Procédure dans `docs/migrations.md` ; non appliquée à une base partagée.
- `commandes/prise-en-charge.ts` : résultats typés `{ ok, … } | { ok: false, code }` pour les quatre fonctions (`acces_refuse` pour tout non-artiste) ; artiste sans profil lié : listes vides, `introuvable`. Une commande `historique` n'a jamais d'artiste (contrainte `Commande_forme_check`) : elle est `introuvable` pour l'artiste, en lecture comme en action (la matrice disait `etat_invalide` en action, cas inatteignable pour une commande de l'artiste) ; `en_attente_paiement` et `annulee` donnent bien `etat_invalide`.
- Frise de `/suivi` : l'étape `prise_en_charge` n'apparaît qu'une fois faite (pas d'étape « à venir » pour une commande confirmée : les frises existantes de la 7.7 sont inchangées).
- `/confirmation` : `lireConfirmationPassage` rend `prise_en_charge` comme `confirmee` (aucun changement de la page). `annulerPassagePublic` refuse tout état autre que en attente ou annulée. `emettreLienSuiviDeCommande` compte `prise_en_charge` comme commande vivante.
- E-mail artiste (3A) : `contenuCommandeArtiste` reçoit `priseEnChargeAvant` et `lien` ; texte `suite` modifié (l'adresse s'affiche dans l'espace dès la prise en charge). E-mail acheteur « Prise en charge » : intro avec le nom de l'artiste, délai figé de chaque ligne, lien de suivi émis à l'envoi.
- Interface : `BlocAExpedier.tsx` et `ListeCommandes.tsx` sont sous `src/app/dashboard/artiste/commandes/` (surface `jsx-no-literals`) et importés par l'accueil ; `PriseEnCharge` reste monté (prop `prise`) après la bascule pour garder l'annonce `role="status"` ; compteur = chiffre `aria-hidden` + texte `sr-only`.
- Décisions 1A à 3A inscrites dans `docs/decisions-porteur.md` (2026-11-19). La relecture par trois sous-agents (4A) n'a pas été faite par l'agent d'implémentation.

## Spec Change Log

## Review Triage Log

| # | Relecteur | Constat | Verdict | Preuve | Suite |
|---|---|---|---|---|---|
| 1 | blind | (résolu par la décision 6A, patch) Vente assistée confirmée sans adresse (`adresse: ''`, `vente-assistee.ts:90`), l'acheteur ne peut plus la compléter une fois la réservation `confirmee` ; l'artiste prend en charge sans adresse | high | `completerCoordonneesDuLien` exige une réservation `vente_assistee` active ; elle est fermée `confirmee` au constat | intent_gap (question au porteur) |
| 2 | edge, blind, vgap | Gestionnaires de `CommandeConfirmee` (acheteur, artiste, équipe) n'acceptent que `confirmee` : rejoués ou retardés après une prise en charge, ils n'envoient rien | medium | `envoyerCommande(..., 'confirmee')`, `alerterEquipeCommande` `etat !== 'confirmee'` ; la commande est visible par l'artiste dès la validation, avant la répartition | patch |
| 3 | edge, blind | `decodeURIComponent` d'un segment mal encodé lève `URIError` (500 au lieu de 404) | low | `[numero]/page.tsx:22,31`, aucun `try` | patch |
| 4 | edge, blind | Échec d'une lecture de commandes : tout l'accueil tombe | low | `Promise.all` sans repli ; panne de base rare, `accueilArtiste` tombait déjà de même | rejeté (peu probable, ajout de branches) |
| 5 | edge | Après succès, le bouton « Je prends en charge » réapparaît jusqu'au `router.refresh()` | low | `setEtape('repos')` avec `prise` encore faux | patch |
| 6 | edge | Délai omis dans l'e-mail si `delaiMinJours` = 0 | low | même règle que l'e-mail de confirmation existant | rejeté (cohérent avec l'existant) |
| 7 | edge, blind | `HeureFixe` vide avant l'hydratation | low | même comportement que `ReservationHeureFixe` ; l'espace artiste exige JavaScript | rejeté |
| 8 | edge, blind | Compteur et liste lus par deux requêtes ; liste complète lue pour décider du bloc | low | `page.tsx:20-24` | patch (compteur tiré de la liste) |
| 9 | blind | `aria-label` du lien de carte masque œuvres, prénom, pays, échéance | medium | `ListeCommandes.tsx` `aria-label={t.ouvrir(...)}` remplace le nom accessible | patch |
| 10 | blind | Adresse ou téléphone vides (`''`) affichés en case blanche, pas « Non renseigné » | low | `??` n'attrape que `null` ; la vente assistée écrit `''` | patch (normaliser dans le module) |
| 11 | blind | Le rappel cite un « guide d'emballage Errancy » qui n'existe pas | low | aucun guide dans `src/` ni `docs/` | patch (reformuler) |
| 12 | blind | E-mail « Prise en charge » promet « Nous vous écrirons à l'expédition » avant la 8.2 | medium | aucun e-mail d'expédition n'existe | patch (retirer la promesse) |
| 13 | blind | E-mail « Nouvelle commande » sans le pays de livraison prévu par l'épopée | low | `lireDonneesCourrielCommande` ne lit pas `paysLivraison` | patch |
| 14 | blind | Le rattrapage marque « dépassée » toute commande confirmée depuis plus de 48 h | low | constat + 48 h passé | patch (requête de comptage avant application dans `docs/migrations.md`) |
| 15 | blind | Spec « terminée » sans relecture ; `historique` → `introuvable` au lieu de `etat_invalide` | false / maybe | statut `in-review`, relecture faite ici ; écart `historique` : contrainte `Commande_forme_check`, signalé au porteur | rejeté |
| 16 | blind | Échap ne ferme pas la question ; double test d'acteur ; filet `maj.count` rend un succès | low | filet inatteignable sous le verrou | rejeté |
| 17 | vgap | Rattrapage de la migration jamais exercé sur des lignes | medium (non vérifié) | bases jetables migrées à vide | defer |
| 18 | vgap | « Modifier ma commande » sur un passage entièrement `prise_en_charge` non testé | medium | test existant mêle une `confirmee` | patch (test) |
| 19 | vgap | « Suivre mes commandes » d'un passage entièrement `prise_en_charge` non testé | medium | `ouvrirSuivi` jamais appelé après `prendreEnCharge` | patch (test) |
| 20 | vgap | Ordre de la liste et texte « Échéance dépassée » jamais observés | medium | un seul ordre par artiste dans les tests | patch (test) |
| 21 | vgap | Type de `alerterEquipeCommande` élargi à `CommandePriseEnCharge` | low | non abonné aujourd'hui | traité avec #2 |
