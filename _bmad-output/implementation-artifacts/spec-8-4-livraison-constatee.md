---
title: 'Story 8.4 — Livraison constatée'
type: 'feature'
created: '2026-11-20'
status: 'done'
baseline_commit: '9bab5b0931f9eb1e143793af62e9e157922dc81e'
route: 'dispatch'
review_loop_iteration: 1
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-8-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-8-2-l-artiste-expedie-et-saisit-le-suivi.md', '{project-root}/_bmad-output/implementation-artifacts/spec-8-3-commandes-et-alertes-de-l-equipe.md', '{project-root}/_bmad-output/implementation-artifacts/spec-7-7-suivi-des-commandes-par-lien-sans-compte.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Une commande expédiée ne se termine jamais : rien n'enregistre que l'œuvre est arrivée, l'adresse de l'acheteur reste visible de l'artiste sans limite, et le délai de retour n'a aucune date de départ (FR-29, FR-22, AD-9).

**Approach:**
- Migration additive : état `livree` et colonnes de `Commande` `livreeLe`, `livraisonSource` (`acheteur`, `equipe_suivi`, `equipe_preuve`), `livraisonPar`, `preuveLivraison`, `retourAvant` (échéance de fin du délai de retour, AD-10).
- `commandes` : `constaterLivraison` par l'acheteur (bouton « J'ai reçu l'œuvre » de `/suivi`, deux temps, jeton `suivi` du navigateur : jamais un identifiant du client) et `enregistrerLivraison(acteur, numero, saisie)` par l'équipe (admin seulement, source « suivi du transporteur » ou « preuve ») ; `expediee` → `livree` par la table de transitions, sous le verrou du passage, mise à jour conditionnelle, événement `CommandeLivree`. Au-dessus du seuil d'assurance de la 8.2 (`SEUIL_ASSURANCE`, prix des œuvres sans frais), seule l'équipe peut constater, et sur preuve saisie (référence obligatoire).
- `retourAvant` = date de livraison + `DUREE_RETOUR_JOURS` de `reglages` (OQ-4, réglable, décision plus bas).
- Artiste : une commande `livree` reste visible (liste et page, lecture seule) mais adresse et téléphone redeviennent masqués (AD-16 : seulement `prise_en_charge` et `expediee`).
- Acheteur : étape « Livrée [date] » sur `/suivi`, `/confirmation` « Confirmée » ; e-mail « Livraison » (confirmation de la livraison, lien de suivi émis à l'envoi). Équipe : section « Commandes » de `/dashboard/admin/commandes` avec « Enregistrer la livraison » sur les commandes expédiées, et date, source et preuve des livrées.

## Boundaries & Constraints

**Always:**
- AD-9, AD-15, AD-16 : transition par `transitionPermise` sous le verrou du passage ; rejouée = succès sans effet (`dejaLivree`, la première date et la première source ne sont jamais écrasées) ; un seul événement et un seul e-mail sous deux appuis simultanés ; la constatation de l'acheteur vérifie que la commande appartient au passage du jeton ; l'équipe relue en base ; aucune donnée personnelle dans les journaux ni les charges d'événements (ids seulement).
- AD-10 : `retourAvant` stockée à la livraison ; « délai échu » se calcule à la lecture, jamais posé par une tâche.
- Toute lecture ou règle qui traite `expediee` comme une commande vivante ou confirmée traite aussi `livree` (suivi, confirmation, e-mail d'annulation, « Modifier ma commande » refusé, ouverture du suivi depuis le navigateur) ; l'artiste ne voit jamais l'adresse ni le téléphone d'une commande `livree`.
- Le seuil est celui de la 8.2 (`SEUIL_ASSURANCE`, jamais recopié) ; la durée de retour est un réglage de `src/lib/reglages` ; aucune durée de retour, gratuité ni promesse n'est écrite en dur dans un texte (OQ-2, OQ-4).
- Textes dans `fr` (surfaces `jsx-no-literals` déjà posées) ; indépendant de `LOT2_OUVERT`.

**Never:** réclamation, retour et bouton « Signaler un problème » (8.5) ; remboursement et avoir (8.6) ; clôture, retrait de l'œuvre et révocation des liens de suivi (8.7) ; somme due (8.8) ; retour arrière d'une livraison constatée (limite documentée : correction par SQL) ; lecture automatique du suivi d'un transporteur ; envoi de fichier de preuve ; `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`.

**Décisions du porteur (2026-11-20) :**
- 1A : `DUREE_RETOUR_JOURS` = 14 jours (réglage de `reglages`, modifiable par une PR) ; `retourAvant` = date de livraison + 14 jours calendaires.
- 2A : la date limite de retour n'est que stockée : ni l'e-mail « Livraison » ni `/suivi` ne disent de durée ni de date de retour tant que les pages de confiance (7.1, OQ-2, OQ-4) ne sont pas publiées.
- 3A : la preuve de livraison est une référence saisie par l'équipe (texte de 2 à 200 caractères), obligatoire au-dessus du seuil ; aucun fichier envoyé.
- 4A : l'e-mail « Livraison » renvoie vers `/suivi` (lien émis à l'envoi) et le Conseil WhatsApp ; le bouton « Signaler un problème » arrive avec la 8.5 (d'ici là, `/suivi` ne propose que le Conseil).
- Les décisions 1A à 4A sont inscrites dans `docs/decisions-porteur.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Acheteur, sous le seuil | `expediee`, prix des œuvres ≤ seuil, jeton `suivi` valide | `livree`, source `acheteur`, `retourAvant`, événement, e-mail « Livraison » ; frise « Livrée [date] » | N/A |
| Acheteur, au-dessus du seuil | `expediee`, prix > seuil | refus `preuve_requise`, rien écrit ; le bouton n'est pas proposé | message neutre |
| Équipe, sous le seuil | admin, `expediee`, source `equipe_suivi` | `livree`, source, auteur ; preuve facultative | N/A |
| Équipe, au-dessus du seuil | admin, source `equipe_preuve`, référence saisie | `livree`, `preuveLivraison` écrite | N/A |
| Équipe, preuve manquante | au-dessus du seuil, source `equipe_suivi` ou référence vide | refus `preuve_requise` (message par champ) | message par champ |
| Rejeu / double appui | déjà `livree` | `{ ok, dejaLivree: true }`, aucun événement, première saisie intacte | N/A |
| Mauvais état | `confirmee`, `prise_en_charge`, `annulee`, `en_attente_paiement` | `etat_invalide` | message neutre |
| Commande d'un autre passage | acheteur A, numéro d'un passage B | `introuvable`, rien écrit | message neutre |
| Jeton invalide ou périmé | cookie `suivi` absent, révoqué, mal formé | `introuvable` ; la page affiche l'état « close » | message neutre |
| Artiste, commande livrée | artiste de la commande | commande lisible, `adresse` et `telephone` absents du résultat | N/A |
| Non admin (équipe) | artiste, user, visiteur | `acces_refuse` | redirection |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` (`EtatCommande`, `Commande`) + `prisma/migrations/20261126090000_livraison/` -- valeur `livree` (avant `annulee`), colonnes `livreeLe`, `livraisonSource` (texte), `livraisonPar`, `preuveLivraison`, `retourAvant` ; `docs/migrations.md`.
- `src/lib/reglages/index.ts` -- `DUREE_RETOUR_JOURS` (selon Q1).
- `src/lib/commandes/etats.ts` -- `expediee: ['livree']`, `livree: []`.
- `src/lib/commandes/livraison.ts` (nouveau) + `livraison-regles.ts` (pur : `validerLivraison`, `sourcesPermises(prix, seuil)`, `retourAvant`) -- `constaterLivraisonAcheteur(jetonSuivi, numero)`, `enregistrerLivraison(acteur, numero, saisie)` ; verrou `FOR UPDATE` du passage comme `expedition.ts` ; réutilise `assuranceRequise` (8.2) pour le seuil ; export par `index.ts`.
- `src/lib/commandes/prise-en-charge.ts` -- liste et détail de l'artiste : ajouter `livree` (50 dernières, lecture seule), adresse et téléphone **pas** pour `livree`.
- `src/lib/commandes/suivi-regles.ts`, `suivi.ts`, `confirmation.ts`, `passage-public.ts`, `src/app/suivi/ListeSuivi.tsx`, `FriseCommande.tsx`, `src/app/confirmation/` -- inclure `livree` ; frise : « Livrée [date] » à la place de « Livraison prévue » ; `CommandeSuivie` porte `peutConfirmerReception` (booléen calculé côté serveur, sous le seuil et `expediee`).
- `src/app/suivi/ConfirmerReception.tsx` (client, deux temps, garde `useRef`, `role="status"`, `router.refresh()`), `src/app/suivi/actions.ts` (`confirmerReception(numero)` : lit le cookie `suivi`, jamais un identifiant du client).
- `src/lib/commandes/suivi-equipe.ts`, `src/app/dashboard/admin/commandes/CommandesEquipe.tsx`, `actions.ts` -- section de l'équipe : « Enregistrer la livraison » (source, preuve) sur les `expediee`, livrées avec date, source, preuve et `retourAvant` ; lecture bornée des livrées.
- `src/lib/evenements/catalogue.ts`, `src/lib/abonnements.ts` (`via`), `src/lib/notifications/gestionnaires.ts`, `contenus.ts`, `src/lib/commandes/courriels.ts`, `src/lib/i18n/fr.ts` -- `CommandeLivree`, `envoyerLivraisonCommande`, `contenuCommandeLivree`, textes `fr.courriels.commande.livraison`, `fr.commandesArtiste`, `fr.suivi`, `fr.commandesEquipe` ; les gestionnaires précédents acceptent aussi `livree`.
- Réutiliser : `assuranceRequise`, `emettreLienSuiviDeCommande`, `lirePassageDuSuivi`, `HeureFixe`. Ne pas changer : `annulerParLEquipe` (`expediee` et `livree` restent hors de portée).

## Tasks & Acceptance

**Execution:**
- [x] schéma, migration, `docs/migrations.md`, `reglages` -- données de la story.
- [x] `commandes` (états, livraison, lectures artiste, suivi, confirmation, équipe) -- logique, seuil, AD-16.
- [x] événement, abonnement, gestionnaire, contenu, `fr` -- e-mail « Livraison ».
- [x] `/suivi` (bouton, frise), espace artiste, section de l'équipe -- interface.
- [x] `tests/livraison-constatee.test.ts` (base réelle : matrice, seuil, AD-16, concurrence ; nom différent de `tests/livraison.test.ts`, déjà pris par le module `livraison`), `tests/navigateur/livraison.test.tsx` -- preuves.
- [x] `AGENTS.md` -- puce « Livraison constatée ».

**Acceptance Criteria:**
- Given une commande `expediee` sous le seuil, when l'acheteur touche « J'ai reçu l'œuvre » sur sa page de suivi, then elle passe en `livree` avec la date et la source, et l'acheteur reçoit l'e-mail « Livraison ».
- Given une commande `expediee` au-dessus du seuil, when l'acheteur ouvre sa page, then le bouton n'est pas proposé et seule l'équipe, avec une preuve, peut constater.
- Given une commande `livree`, when l'artiste l'ouvre, then l'adresse et le téléphone de l'acheteur sont masqués.

## Implementation Notes

- Migration `20261126090000_livraison` (SHA-256 `cd5ea488…d8793fc8`) : valeur avant `annulee`, cinq colonnes ; appliquée par les migrations du dépôt sur les bases jetables des tests, non appliquée à une base partagée.
- `tests/livraison-constatee.test.ts` (26 cas, base réelle) et `tests/navigateur/livraison.test.tsx` ; `tests/navigateur/suivi.test.tsx` et `commandes-equipe.test.tsx` adaptés (mock des actions, champs ajoutés).
- `CommandeSuivie.peutConfirmerReception` est calculé par `lireSuiviPassage` (agrégat `_sum` du prix, seuil de la 8.2) ; le prix n'est jamais rendu.
- L'événement `CommandeExpediee` retardé accepte aussi `livree` (comme les gestionnaires précédents).

## Spec Change Log

## Review Triage Log

| # | Relecture | Constat | Verdict | Route |
|---|-----------|---------|---------|-------|
| 1 | Blind + Edge | Message de succès et focus perdus : `ConfirmerReception` démonté après `router.refresh()` | Réel | patch (composant gardé monté) |
| 2 | Verification Gap | `confirmerReception` et `actionEnregistrerLivraison` jamais exécutées par un test | Réel | patch (tests base réelle) |
| 3 | Edge | Tri des livrées sans `nulls: 'last'` côté équipe | Réel, faible | patch |
| 4 | Edge | Commentaire d'en-tête de la page artiste obsolète | Réel, trivial | patch |
| 5 | Blind | Ligne 8.4 de `decisions-porteur.md` sans 3e colonne | Réel | patch |
| 6 | Blind + Edge | Aucun délai minimal avant la confirmation de l'acheteur ; `retourAvant` sans indicateur « échu » ; pas de CHECK sur `livraisonSource` ; e-mail périmé sur événement rejoué | Limites assumées (décisions 1A à 4A) | patch doc : limites connues dans AGENTS.md ; « échu » reporté à la 8.5 |
| 7 | Edge | Jeton de suivi révoqué entre la lecture et le verrou | Rejeté : même schéma que 7.7, probabilité négligeable, lien non consommé | reject |
| 8 | Edge | Preuve facultative d'un seul caractère refusée | Rejeté : message d'erreur clair, cas marginal | reject |
| 9 | Edge | Commande sans ligne : somme nulle | Rejeté : `assuranceRequise(null)` traité, cas impossible par le code | reject |
| 10 | Blind | Confirmation de l'équipe sans récapitulatif, `champ` serveur ignoré, pas de refresh sur échec | Rejeté : confort, non exigé par la spec | reject |
| 11 | Blind + Edge | Code Map cite des fichiers non modifiés ; statut sprint | Sans effet fonctionnel ; statut mis à jour au commit | note |


## Verification

**Commands:**
- `npx eslint .` ; `node scripts/verifier-exceptions-prisma.cjs origin/main` (et les deux listes) ; `npm test` ; `npm run test:navigateur` ; `npm run build` -- tous verts.
