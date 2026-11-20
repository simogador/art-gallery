---
title: 'Story 8.5 — Réclamation et retour'
type: 'feature'
created: '2026-11-20'
status: 'done'
baseline_commit: '9967ce433530a099c8fd5a7c4ccb44124b9333f4'
route: 'dispatch'
review_loop_iteration: 1
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-8-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-8-4-livraison-constatee.md', '{project-root}/_bmad-output/implementation-artifacts/spec-8-3-commandes-et-alertes-de-l-equipe.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un acheteur dont l'œuvre est arrivée abîmée ou ne convient pas n'a aucun moyen de le dire depuis sa page de suivi, et l'équipe n'a ni file de réclamations, ni état « retournée », ni demande de remboursement liée à un retour (FR-30, FR-15).

**Approach:**
- Migration additive : table `Reclamation` (commande, motif `abimee` | `non_conforme` | `changement_avis`, description, état `ouverte` | `acceptee` | `refusee`, motif de refus, auteur et date de la décision) et état `retournee` de `Commande` avec ses colonnes (réception du retour : qui, quand).
- `commandes` : `signalerProbleme` par l'acheteur (jeton `suivi` du navigateur, jamais un identifiant du client) sur une commande `livree` dont `retourAvant` n'est pas échu ; `accepterReclamation`, `refuserReclamation` (motif de 10 à 500 caractères) et l'enregistrement du retour reçu, par l'équipe (admin relu en base) ; `livree` → `retournee` par la table de transitions, sous le verrou du passage, mise à jour conditionnelle, événements dans la transaction. À la réception du retour (décision 3B), `demanderRemboursement` pour un montant total (par défaut) ou partiel saisi par l'équipe, jamais au-delà de l'allocation de la commande.
- Photos (décision 1A) : jusqu'à 3 images jointes par l'acheteur, envoyées directement à Cloudinary (signature serveur après vérification du jeton de suivi), visibles de l'équipe seulement.
- `/suivi` : bouton « Signaler un problème » pendant le délai (calculé côté serveur, `peutSignalerProbleme`), puis état de la réclamation et motif de refus ; délai échu : plus proposé, Conseil WhatsApp reste. E-mail « Livraison » : ajout du lien « Signaler un problème » (levée de la décision 4A de la 8.4). Équipe : file des réclamations sur `/dashboard/admin/commandes`, alerte par e-mail à `CONTACT_EQUIPE` (numéro et lien seulement). Artiste : e-mail à l'acceptation d'un retour (numéro et titres).

## Boundaries & Constraints

**Always:**
- AD-9, AD-15, AD-16 : transitions par `transitionPermise` sous le verrou du passage ; rejeu = succès sans effet ; un seul événement et un seul e-mail par décision ; l'acheteur n'agit que sur une commande de son passage ; l'équipe relue en base ; ids seulement dans les journaux et charges d'événements ; jamais de coordonnées de l'artiste à l'acheteur.
- AD-10 : « délai échu » calculé à la lecture à partir de `Commande.retourAvant` ; une réclamation ouverte dans le délai reste traitable après l'échéance.
- Frais de retour, choix remboursement ou avoir, prise en charge de la casse : OQ-2 et OQ-4 ouvertes, aucune valeur ni promesse en dur (textes neutres) ; la somme des remboursements d'une commande ne dépasse jamais son allocation (refus explicite).
- Textes dans `fr` (surfaces `jsx-no-literals`), indépendant de `LOT2_OUVERT`.

**Never:** écran de remboursement et avoir (8.6) ; clôture, retrait de l'œuvre `vendue` → `retiree` et révocation des liens de suivi (8.7) ; somme due à l'artiste (8.8) ; transporteur ou étiquette de retour ; `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Signalement | `livree`, délai non échu, jeton `suivi` valide, motif, description, 0 à 3 photos | réclamation `ouverte`, photos enregistrées, événement, alerte équipe | N/A |
| Photos invalides | plus de 3, non image, plus de 5 Mo, signature ou préfixe faux | `invalide`, rien enregistré | message par champ |
| Délai échu | `livree`, `retourAvant` passée | refus `delai_echu`, bouton absent | message neutre |
| Réclamation déjà déposée | commande avec une réclamation (ouverte, acceptée ou refusée) | `{ ok, dejaOuverte: true }` si ouverte, sinon `reclamation_deja_traitee`, rien d'écrit | message neutre |
| Mauvais état | non `livree` | `etat_invalide` | message neutre |
| Autre passage / jeton invalide | numéro d'un autre passage | `introuvable` | message neutre |
| Saisie invalide | motif inconnu, description vide ou trop longue | `invalide`, erreurs par champ | message par champ |
| Acceptation | admin, réclamation `ouverte` | `acceptee` ; e-mails acheteur et artiste ; aucun remboursement encore | N/A |
| Retour reçu | admin, réclamation `acceptee`, montant (défaut : allocation) | `livree` → `retournee`, remboursement `demande` du montant, un seul événement | N/A |
| Remboursement trop élevé | montant > allocation ou nul | refus `montant_depasse`, rien écrit (la commande reste `livree`) | message par champ |
| Refus | admin, motif 10 à 500 caractères | `refusee`, motif visible de l'acheteur, e-mail | message par champ |
| Non admin | artiste, user, visiteur | `acces_refuse` | redirection |

**Décisions du porteur (2026-11-20) :**
- 1A : photos jointes, jusqu'à 3, images seulement, 5 Mo au plus chacune, envoi direct à Cloudinary signé par le serveur.
- 2B : l'équipe enregistre la réception du retour (l'artiste la signale hors du site) ; aucun écran artiste nouveau.
- 3B : le remboursement est demandé à la réception du retour, pas à l'acceptation ; montant saisi par l'équipe (total par défaut, partiel possible).
- 4A : une seule réclamation par commande ; un refus est définitif, le Conseil WhatsApp reste disponible.
- 5A : e-mail à l'artiste à l'acceptation d'un retour (numéro et titres, jamais de coordonnées ni de photos de l'acheteur).

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` (`EtatCommande`, `Commande`, `RemboursementCommande` l.677) -- état `retournee` avant `annulee`, table `Reclamation`, colonnes de réception du retour ; migration additive `…_reclamation` (modèle : `20261126090000_livraison`) ; `docs/migrations.md`.
- `src/lib/commandes/etats.ts` -- `livree: ['retournee']` ; étendre `ETATS_COMMANDE`, `EtatCommandeEquipe` (`suivi-equipe.ts` l.14), `EtatCommandeSuivi` (`suivi-regles.ts` l.8).
- `src/lib/commandes/reclamation.ts` (nouveau) + `reclamation-regles.ts` (pur : motifs, `validerReclamation`, `delaiRetourEchu`) -- `signalerProbleme(jetonSuivi, numero, saisie)`, `accepterReclamation`, `refuserReclamation`, retour reçu ; modèle `livraison.ts` (verrou `FOR UPDATE`, `updateMany` conditionnel, `ecrireEvenement`, `repartirApresValidation`) ; export par `index.ts`.
- `src/lib/commandes/annulation.ts` (`demanderRemboursement`, l.22) -- ajouter un paramètre de montant (partiel) et le refus `montant_depasse` ; unicité `commandeId` conservée.
- `src/lib/commandes/suivi.ts` + `suivi-regles.ts` + `src/app/suivi/ListeSuivi.tsx` (l.46-47), `FriseCommande.tsx`, `actions.ts` -- lire `retourAvant` (aujourd'hui non exposé), `peutSignalerProbleme`, état et motif de refus de la réclamation ; composant client `SignalerProbleme.tsx` (formulaire, deux temps, garde `useRef`, `role="status"`, sans `useFormState`).
- `src/lib/commandes/suivi-equipe.ts`, `src/app/dashboard/admin/commandes/CommandesEquipe.tsx` (composants `Annulation` l.55, `Livraison` l.145 comme patrons), `actions.ts` -- file des réclamations, accepter (montant), refuser (motif), retour reçu ; `SURFACES_TEXTES` de `.eslintrc.js`.
- `src/lib/evenements/catalogue.ts`, `src/lib/abonnements.ts` (`via`), `src/lib/notifications/gestionnaires.ts` + `contenus.ts` -- événements `ReclamationOuverte`, `ReclamationTraitee`, `CommandeRetournee` ; e-mails acheteur (accepté, refusé avec motif), alerte équipe (numéro et lien) ; lien « Signaler un problème » dans `contenuCommandeLivree`.
- Photos : `src/lib/curation/photos.ts` (signature, `signatureReponse`) et `src/components/dashboard/envoiCloudinary.ts` comme modèle ; `commandes` n'importe pas `curation` (frontière de modules, `.eslintrc.js`).

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` + `prisma/migrations/20261127090000_reclamation/migration.sql` -- état `retournee` (avant `annulee`), tables `Reclamation` (une par commande, unique) et `PhotoReclamation`, colonnes `Commande.retourRecuLe`, `retourRecuPar` ; `docs/migrations.md` (SQL, empreinte, contrôles, retour arrière)
- [x] `src/lib/commandes/etats.ts`, `suivi-regles.ts`, `suivi-equipe.ts` -- `livree: ['retournee']`, nouvel état dans les unions et libellés
- [x] `src/lib/commandes/reclamation-regles.ts` + `reclamation.ts` -- `signalerProbleme`, `preparerEnvoiPhotoReclamation` (signature), `accepterReclamation`, `refuserReclamation`, `enregistrerRetourRecu` ; verrou du passage, `updateMany` conditionnel, événements, `index.ts`
- [x] `src/lib/commandes/annulation.ts` -- `demanderRemboursement` accepte un montant (≤ allocation, > 0) ; refus `montant_depasse`
- [x] `src/lib/commandes/suivi.ts`, `src/app/suivi/{ListeSuivi,SignalerProbleme,FriseCommande,actions}.tsx` -- `peutSignalerProbleme`, formulaire, état de la réclamation, motif de refus, étape « Retournée »
- [x] `src/lib/commandes/suivi-equipe.ts`, `src/app/dashboard/admin/commandes/{CommandesEquipe,actions}` -- file des réclamations (photos lues par l'équipe), accepter, refuser, retour reçu avec montant
- [x] `src/lib/evenements/catalogue.ts`, `src/lib/abonnements.ts`, `src/lib/notifications/{gestionnaires,contenus}.ts`, `src/lib/i18n/fr.ts` -- événements, e-mails (équipe, acheteur accepté et refusé, artiste), lien « Signaler un problème » dans l'e-mail « Livraison »
- [x] `AGENTS.md`, `docs/decisions-porteur.md`, `eslint` (`SURFACES_TEXTES`) -- puce « Réclamation et retour », décisions 1A à 5A, nouveaux composants
- [x] `tests/reclamation.test.ts` (base réelle : matrice complète, concurrence, photos, montant) et `tests/navigateur/reclamation.test.tsx`

**Acceptance Criteria:**
- Given une commande `livree` dans le délai, when l'acheteur signale un problème avec motif, description et photos valides, then la réclamation est `ouverte`, l'équipe est alertée et `/suivi` affiche son état sans proposer de nouveau signalement.
- Given le délai de retour échu, when l'acheteur ouvre `/suivi`, then « Signaler un problème » n'est plus proposé et le Conseil WhatsApp reste disponible.
- Given une réclamation refusée avec motif, when l'acheteur ouvre `/suivi`, then il lit le motif et ne peut pas en déposer une autre.
- Given une réclamation acceptée puis le retour enregistré, when le montant saisi dépasse l'allocation, then rien n'est écrit et le refus est explicite ; sinon la commande est `retournee` et un remboursement `demande` du montant existe.
- Given un artiste ou l'acheteur, when il appelle une action de l'équipe, then `acces_refuse` ; l'artiste ne lit jamais la réclamation, la description ni les photos.

## Implementation Notes

- Migration `20261127090000_reclamation` (SHA-256 `fc6531decd893374e8bd049caf74f54517a5340aabbb076b16c93fb0179d2797`) : valeur `retournee` avant `annulee`, `Commande.retourRecuLe`/`retourRecuPar`, enums `MotifReclamation`/`EtatReclamation`, tables `Reclamation` (unique par commande) et `PhotoReclamation` ; `prisma migrate diff` : aucun écart avec `schema.prisma`.
- Photos : signature par commande (`signerEnvoiPhoto`), revérification des réponses de Cloudinary à l'enregistrement (`verifierPhotos`) ; `commandes` n'importe pas `curation` (mécanique reprise dans `photos-reclamation.ts`).
- Le montant du retour est saisi au geste « Retour reçu » (décision 3B), pas à l'acceptation ; `demanderRemboursement` accepte un montant et refuse `montant_depasse` avant toute écriture.
- `tests/suivi.test.ts` adapté : le formulaire de réclamation (composant client) est le seul à porter des champs de saisie dans `src/app/suivi`, et l'état d'un remboursement demandé ou effectué est la seule mention du remboursement autorisée en plus de la phrase d'annulation.
- Vérifié : `npx eslint .` (0 erreur), trois contrôles d'exceptions (aucun ajout), `npm test` (base réelle), `npm run test:navigateur` (233 réussis), `npm run build`.

## Spec Change Log

## Review Triage Log

| # | Relecture | Constat | Verdict | Route |
|---|-----------|---------|---------|-------|
| 1 | Blind | Sélection de fichiers périmée dans `SignalerProbleme.tsx` après retour au formulaire (anciennes photos envoyées) | medium, réel | patch |
| 2 | Edge | `<ul>` vide rendu dans `CommandesEquipe.tsx` quand tout est à traiter | low, réel | patch |
| 3 | Blind | Description d'une seule lettre qui brûle l'unique réclamation (4A) | medium, réel | patch (minimum 10 caractères) |
| 4 | Verification Gap | Aucun test de `lireConfirmationPassage`, `ouvrirSuiviDuNavigateur`, `emettreLienSuiviDeCommande` sur `retournee` | medium, réel | patch (tests) |
| 5 | Edge + Blind | `bytes` et `format` des photos fournis par le client, 5 Mo non imposé par la signature | medium, réel | patch doc (limite AGENTS) : un contrôle Cloudinary côté serveur ajouterait un appel externe, hors périmètre |
| 6 | Edge + Blind | Signature d'envoi répétable sans plafond, fichiers orphelins | medium, réel | patch doc (limite) ; même classe que la limite (i) de la 8.4 |
| 7 | Blind | « Visible de l'équipe seulement » : URL publiques à identifiant aléatoire | low, réel | patch doc (limite) |
| 8 | Edge | Commande `retournee` absente de l'espace de l'artiste ; `/confirmation` la libelle « Confirmée » | low, voulu | patch doc (limite) : `/confirmation` n'est atteignable que quelques jours après la réservation |
| 9 | Blind | Aucun e-mail à la réception du retour (`CommandeRetournee` sans gestionnaire) | medium, réel | defer : e-mails de remboursement de la 8.6 |
| 10 | Blind | Aucun moyen dans l'écran de joindre l'acheteur pour organiser le retour (coordonnées jamais montrées à l'équipe, décision 8.3) | high, réel | defer : décision du porteur à prendre (`deferred-work.md`) |
| 11 | Edge | `enregistrerRetourRecu` avec remboursement déjà existant ou allocation nulle | false : une commande `livree` n'est pas annulable donc n'a jamais de remboursement ; une ligne a toujours un prix > 0 | reject |
| 12 | Edge + Blind | `demanderRemboursement` ignore le montant demandé si un remboursement existe | low, inatteignable aujourd'hui | reject (limite notée) |
| 13 | Edge | Jeton de suivi révoqué entre la lecture et le verrou | low | reject : même schéma que 7.7 et 8.4 |
| 14 | Edge | `envoyerLivraisonCommande` accepte `retournee` : e-mail périmé si événement rejoué | low | reject (limite) : AQ-2 ouverte |
| 15 | Blind | Pas de contraintes `CHECK` pour motif de refus et plafond de 3 photos | low | reject : appliqué par le code sous verrou |
| 16 | Blind | File de réclamations plafonnée à 200 sans note | low | reject (limite notée) |
| 17 | Blind | Ré-envoi de toutes les photos après un échec | low | reject (limite 6) |
| 18 | Blind | Texte « délai échu » pour une commande sans `retourAvant` | false : toute commande `livree` a un `retourAvant` posé à la livraison | reject |

