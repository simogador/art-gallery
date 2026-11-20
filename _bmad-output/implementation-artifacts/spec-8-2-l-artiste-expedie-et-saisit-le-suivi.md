---
title: 'Story 8.2 — L''artiste expédie et saisit le suivi'
type: 'feature'
created: '2026-11-20'
status: 'done'
baseline_commit: '12a62ecfc88bb777b6a08d96bc38886aa5cd9aac'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-8-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-8-1-l-artiste-prend-en-charge-ses-commandes.md', '{project-root}/_bmad-output/implementation-artifacts/spec-7-7-suivi-des-commandes-par-lien-sans-compte.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Une commande prise en charge n'a pas de suite : l'artiste ne peut ni dire qu'il a expédié ni saisir le transporteur et le numéro de suivi, et l'acheteur ne sait pas que son œuvre est en route (FR-22, FR-29, UJ-2).

**Approach:**
- Nouvel état `expediee` (table de transitions : `prise_en_charge` → `expediee`) et colonnes de `Commande` : `transporteur`, `numeroSuivi`, `expedieeLe`, `expedieePar`, `envoiAssure` (booléen) et `referenceAssurance` ; migration additive.
- `commandes` : `marquerExpediee(acteur, numero, saisie)` (artiste de la commande seulement, transition conditionnelle sous le verrou du passage, événement `CommandeExpediee`) ; transporteur et numéro de suivi requis ; au-delà du seuil réglable (`SEUIL_ASSURANCE` de `reglages`, OQ-5), case « envoi assuré avec preuve de livraison » et référence obligatoires, et le refus dit ce qui manque.
- Page `/dashboard/artiste/commandes/[numero]` : formulaire « Marquer comme expédiée » (transporteur, numéro, case et référence d'assurance si exigées) pour une commande `prise_en_charge` ; une fois expédiée, la page montre transporteur, numéro et date ; l'adresse et le téléphone restent visibles jusqu'à la livraison (AD-16 : `prise_en_charge` et `expediee`). L'accueil et la liste intègrent les commandes expédiées.
- E-mail « Expédition » à l'acheteur (transporteur, numéro, lien de suivi émis à l'envoi) ; la frise de `/suivi` gagne l'étape « Expédiée [date] · n° de suivi » ; `/confirmation` traite `expediee` comme une commande confirmée.

## Boundaries & Constraints

**Always:**
- AD-9 et AD-15 : transition par `transitionPermise`, acteur `artist` relu en base, artiste de la commande seulement (`introuvable` sinon) ; rejouée = succès sans effet (`dejaExpediee`), les données de la première saisie ne sont jamais écrasées ; un seul événement et un seul e-mail sous deux appuis simultanés.
- AD-16 : adresse et téléphone pour un artiste en `prise_en_charge` et `expediee` seulement ; e-mail de l'acheteur jamais. La référence d'assurance n'est jamais montrée à l'acheteur ni écrite dans un journal ou un événement (ids seulement).
- Toute lecture ou règle qui traite `prise_en_charge` comme une commande vivante ou confirmée traite aussi `expediee` (suivi, confirmation, e-mail d'annulation, « Modifier ma commande » refusé) ; le gestionnaire « Prise en charge » accepte aussi une commande déjà `expediee` (événement retardé).
- Le seuil est un réglage de `src/lib/reglages` (jamais dans un composant) ; le montant comparé est lu par agrégat de la base (`_sum` des prix figés), jamais additionné dans le code.
- Textes dans `fr` (surface `jsx-no-literals` déjà posée sur `src/app/dashboard/artiste/commandes/**`) ; indépendant de `LOT2_OUVERT`.

**Never:** échéance d'expédition et alertes de retard (8.3 : elle exigera de figer le délai de préparation sur les lignes) ; livraison constatée et masquage de l'adresse après livraison (8.4) ; annulation d'une commande prise en charge ou expédiée ; modification du numéro de suivi après l'expédition ; lien de suivi du transporteur (le lien de l'e-mail est celui de `/suivi`) ; `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`.

**Décisions du porteur (2026-11-20) :**
- 1A : `SEUIL_ASSURANCE` = 1 000 € (100 000 centimes, devise du site, EUR), réglage de `reglages` modifiable par une PR ; une commande dans une autre devise est traitée comme au-dessus du seuil (prudence).
- 2A : le transporteur est un texte libre (requis, 2 à 60 caractères) ; le numéro de suivi est requis (2 à 60 caractères) ; la référence d'assurance (requise au-dessus du seuil) est limitée à 60 caractères.
- 3A : aucune correction du numéro de suivi après l'expédition dans la 8.2 (l'équipe corrige par SQL ; limite documentée).
- 4A : le montant comparé au seuil est le prix des œuvres de la commande, sans frais de livraison (agrégat `_sum` des `prixCentimes` figés).
- Le bloc « À expédier » de l'accueil liste aussi les commandes `prise_en_charge` (à expédier) ; le compteur reste le nombre de commandes à prendre en charge (8.1).
- Les décisions 1A à 4A sont inscrites dans `docs/decisions-porteur.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Expédition simple | `prise_en_charge`, prix des œuvres ≤ seuil, transporteur et numéro | `expediee`, date, auteur, événement, e-mail acheteur ; page montre transporteur, numéro, adresse | N/A |
| Au-delà du seuil | prix des œuvres > seuil, assurance non cochée ou référence vide | refus `assurance_requise`, rien écrit ; message : ce qui manque (case, référence) | message par champ |
| Au-delà du seuil complet | case cochée et référence saisie | `expediee`, `envoiAssure` vrai, référence conservée | N/A |
| Saisie incomplète | transporteur ou numéro vide, trop long | refus `invalide` (message par champ) | message par champ |
| Rejeu / double appui | déjà `expediee` | `{ ok, dejaExpediee: true }`, aucun événement, saisie d'origine intacte | N/A |
| Mauvais état | `confirmee`, `en_attente_paiement`, `annulee` | `etat_invalide` | message neutre |
| Autre artiste / inconnue | commande d'un autre artiste, numéro mal formé | `introuvable`, rien écrit | message neutre |
| Non artiste | visiteur, user, admin | `acces_refuse` | redirection |
| Acheteur, suivi | `expediee` | étape « Expédiée [date] · n° de suivi » faite et datée, transporteur et numéro lisibles ; pas de référence d'assurance | N/A |
| Acheteur, confirmation | `expediee` | libellé « Confirmée », commande comptée comme vivante | N/A |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` (`EtatCommande`, `Commande`) + `prisma/migrations/20261124090000_expedition/` -- valeur `expediee` (avant `annulee`), colonnes `transporteur`, `numeroSuivi`, `expedieeLe` (Timestamptz(3)), `expedieePar` (texte sans clé étrangère), `envoiAssure` (booléen, défaut faux), `referenceAssurance` ; `docs/migrations.md`.
- `src/lib/commandes/etats.ts` -- `prise_en_charge: ['expediee']`, `expediee: []`.
- `src/lib/commandes/expedition.ts` (nouveau) + `expedition-regles.ts` (pur : `validerExpedition`, `assuranceRequise(prixCentimes, seuil)`) -- `marquerExpediee` ; verrou `FOR UPDATE` du passage comme `prise-en-charge.ts:prendreEnCharge` ; agrégat `_sum` des `LigneCommande.prixCentimes` ; export par `index.ts`.
- `src/lib/commandes/prise-en-charge.ts` -- `ETATS_ARTISTE` et listes : ajouter `expediee` ; `adresse`/`telephone` pour `prise_en_charge` et `expediee` ; détail : transporteur, numéro, date d'expédition, assurance.
- `src/lib/commandes/suivi-regles.ts`, `suivi.ts:47,54,90,120,141`, `confirmation.ts:68,103`, `src/app/suivi/ListeSuivi.tsx`, `FriseCommande.tsx`, `src/app/confirmation/` -- inclure `expediee` ; frise : étape `expediee` (transporteur et numéro) entre prise en charge et livraison prévue.
- `src/lib/evenements/catalogue.ts`, `src/lib/abonnements.ts` (`via`) -- `CommandeExpediee` (`{ commandeId }`).
- `src/lib/notifications/gestionnaires.ts` (`envoyerCommande`, `etatsAcceptes`), `contenus.ts`, `src/lib/commandes/courriels.ts`, `src/lib/i18n/fr.ts` -- `envoyerExpeditionCommande`, `contenuCommandeExpediee` (transporteur, numéro, lien de suivi), textes `fr.courriels.commande.expedition`, `fr.commandesArtiste.expedition`, `fr.suivi.frise.etapes.expediee` ; le gestionnaire « Prise en charge » accepte aussi `expediee`.
- `src/lib/reglages/index.ts` -- `SEUIL_ASSURANCE` (devise et centimes ; décision Q1).
- `src/app/dashboard/artiste/commandes/[numero]/page.tsx`, `FormulaireExpedition.tsx` (client, état local, garde `useRef`, résumé d'erreurs, `role="status"`, `router.refresh()`, sans `useFormState`), `actions.ts` (`actionMarquerExpediee`), `ListeCommandes.tsx`, `BlocAExpedier.tsx` -- interface ; le bloc « À expédier » liste aussi les commandes `prise_en_charge`.
- Réutiliser : `nomPays`, `HeureFixe`, `lirePassageDuSuivi`, `urlAbsolue`, motif de 8.1 (`PriseEnCharge.tsx`). Ne pas changer : `annulerCommande`, `traiterPaiementConstate`.

## Tasks & Acceptance

**Execution:**
- [x] schéma, migration, `docs/migrations.md`, `reglages` -- données de la story.
- [x] `commandes` (états, expédition, lectures artiste, suivi, confirmation) -- logique, seuil, AD-16.
- [x] événement, abonnement, gestionnaire, contenu, `fr` -- e-mail « Expédition ».
- [x] pages et composants de l'espace artiste, `/suivi`, `/confirmation` -- interface.
- [x] `tests/expedition.test.ts` (base réelle : matrice, seuil, AD-16, concurrence, rendu des pages, suivi) et `tests/navigateur/expedition.test.tsx` -- preuves ; `tests/suivi.test.ts` et `tests/emails-commande.test.ts` non complétés (couverts par `expedition.test.ts`).
- [x] `AGENTS.md` -- puce « Expédition ».

**Acceptance Criteria:**
- Given une commande `prise_en_charge` sous le seuil, when l'artiste saisit transporteur et numéro puis « Marquer comme expédiée », then elle passe en `expediee` et l'acheteur reçoit l'e-mail avec transporteur, numéro et lien de suivi.
- Given une commande au-dessus du seuil, when l'artiste n'a pas coché l'assurance ou n'a pas saisi la référence, then l'expédition est refusée avec ce qui manque.
- Given une commande expédiée, when l'acheteur ouvre `/suivi`, then l'étape « Expédiée [date] · n° de suivi » est faite.

## Implementation Notes

- Migration `20261124090000_expedition` (SHA-256 `517f87c7…c23fd9d`) : valeur avant `annulee`, six colonnes ; appliquée par les migrations du dépôt sur les bases jetables des tests, non appliquée à une base partagée ; `prisma migrate diff` laissé au job « Migrations » de la CI.
- `marquerExpediee` : `assurance_requise` quand seuls la case ou la référence manquent ; `invalide` dès qu'un champ de texte est refusé (toutes les erreurs sont rendues).
- Le test de dictionnaire de la 8.1 exclut désormais `fr.commandesArtiste.expedition` (le formulaire parle d'assurance).
- `PriseEnCharge` reste monté pour `confirmee`, `prise_en_charge` et `expediee` (annonce de la 8.1 conservée) ; le formulaire d'expédition affiche « Une fois enregistrée, la saisie ne peut plus être modifiée. » (décision 3A).
- `tests/expedition.test.ts` (25 cas, base réelle, dont rendu des pages, `emettreLienSuiviDeCommande` et `ouvrirSuiviDuNavigateur` avec des commandes expédiées) passe ; `tests/suivi.test.ts` et `tests/emails-commande.test.ts` ne sont pas complétés.

## Spec Change Log

## Review Triage Log

| # | Relecteur | Constat | Verdict | Preuve | Suite |
|---|---|---|---|---|---|
| 1 | blind, vgap | `PriseEnCharge` démonté après la bascule (`{!prise && …}`) : l'annonce `role="status"` de la 8.1 est perdue au `router.refresh()` | medium | le composant porte `prise` pour se garder monté sans bouton (spec 8.1) ; la page ne le monte plus | patch |
| 2 | vgap | Aucun test ne rend la page, la liste ni le bloc selon l'état (formulaire, champ d'assurance, récapitulatif) | medium | `tests/expedition.test.ts` appelle le module, pas la page | patch (test) |
| 3 | vgap | `exigerCommandeVivante` et `ouvrirSuiviDuNavigateur` avec `expediee` non testés | medium | retirer `'expediee'` du `in` ne fait échouer aucun test | patch (test) |
| 4 | blind | Expédition d'un clic, sans correction possible (3A) | medium | aucune mention sur le formulaire | patch (phrase « la saisie ne peut plus être modifiée ») |
| 5 | blind, edge | `maxLength` 120 pour une limite de 60 ; `tropCourt(2)`, `tropLong(60)` en dur ; `messageChamp` non exhaustif | low | `FormulaireExpedition.tsx`, `actions.ts` | patch |
| 6 | blind | AGENTS.md : puces 8.1 (« rien ensuite avant la 8.2 ») et 7.7 (« Epic 8, aucune donnée ») périmées | low | textes relus | patch (AGENTS.md fait partie de la story) |
| 7 | blind | Spec : tâches non cochées, notes de vérification contradictoires | low | statut des cases | patch |
| 8 | blind | Équipe sans vue sur référence d'assurance et numéro de suivi | medium | lecture réservée à l'artiste | defer (8.3, `deferred-work.md`) |
| 9 | blind | La livraison prévue reste ancrée sur le constat après l'expédition | low | choix assumé de la 7.7 | rejeté, ajouté aux limites |
| 10 | blind | Texte libre (transporteur, numéro) dans l'e-mail et `/suivi` | low | `assembler` échappe le HTML ; artiste sélectionné par l'équipe | rejeté |
| 11 | blind | Pas de contrainte `CHECK` sur `expediee` | low | lectures déjà tolérantes (`expedition: null`) | rejeté |
| 12 | blind | Assurance facultative sous le seuil inaccessible | low | la spec ne l'expose que si exigée | rejeté |
| 13 | blind | Test de la 8.1 exclut le sous-arbre `expedition` | low | exclusion ciblée sur un seul sous-arbre | rejeté |
| 14 | blind, edge | Bloc « À expédier » : compteur et phrase ne décrivent que les commandes à prendre en charge | low | « Toutes vos commandes sont prises en charge. » reste exact | rejeté |
| 15 | edge | Erreurs d'assurance renvoyées alors que les champs sont masqués | low | seuil constant, prix figés : inatteignable sans déploiement entre deux appuis | rejeté |
| 16 | edge | `_sum` nul (commande sans lignes) | low | une commande a toujours des lignes (`confirmation_incoherente` ailleurs) | rejeté |
| 17 | edge | « Prise en charge » rejoué après « Expédition » | low | exigé par la spec (événement retardé), sans rejeu automatique (AQ-2) | rejeté |
| 18 | edge | Liste des expédiées sans borne | low | volume nul avant l'ouverture du Lot 2 | rejeté |
| 19 | edge | `maj.count` nul traité comme `dejaExpediee` | low | inatteignable sous le verrou, comme en 8.1 | rejeté |
| 20 | edge | Référence trop longue ignorée quand non assuré : erreur | low | cas marginal | rejeté |

## Verification

**Commands:**
- `npx eslint .` ; `node scripts/verifier-exceptions-prisma.cjs origin/main` (et les deux listes) ; `npm test` ; `npm run test:navigateur` ; `npm run build` -- tous verts.

**Run by the implementer:** eslint, les trois contrôles d'exceptions, `npm run build`, `tests/expedition.test.ts` (base réelle), `tests/navigateur/expedition.test.tsx` et `prise-en-charge.test.tsx`. `npm test` entier et `npm run test:navigateur` entier : à la charge du coordinateur.
