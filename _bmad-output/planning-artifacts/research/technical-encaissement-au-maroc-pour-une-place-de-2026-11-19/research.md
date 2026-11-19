---
title: 'Recherche technique (choix) : encaissement au Maroc pour une place de marché d''art'
type: 'technical'
shape: 'select'
topic: 'Encaissement au Maroc pour une place de marché d''art'
decision: 'Choisir la solution d''encaissement d''Errancy depuis le Maroc (cartes étrangères et marocaines) pour le compte d''artistes résidents'
source: 'native run'
status: complete
preset: 'standard'
validation: 'normal'
created: '2026-11-19'
updated: '2026-11-19'
claims_verified: 0
claims_unverified: 12
---

# Encaissement au Maroc pour une place de marché d'art

**Décision servie :** choisir comment Errancy encaisse, depuis le Maroc, les paiements par carte d'acheteurs étrangers et marocains pour le compte d'artistes résidents, avant de leur reverser leur part en dirhams (montage de `_bmad-output/forge/paiement-artistes-residents-maroc/forged-idea.md`).

**Réserve de méthode, à lire d'abord :** le réseau de la session bloquait la plupart des sites officiels (cmi.co.ma, bkam.ma, youcanpay.com, paypal.com, stripe.com, telquel.ma, adala.justice.gov.ma). Aucune page n'a été lue en entier : toutes les affirmations viennent d'extraits de moteur de recherche. **Aucune n'atteint la confiance haute, et aucun prix n'a été lu sur une grille officielle de moins de trois mois.** Ce rapport sert à décider *quoi demander et à qui*, pas à signer.

## Résumé exécutif

**Recommandation provisoire : demander en parallèle une offre écrite à un acquéreur bancaire (CMI par sa banque, ou Attijari Payment) et à PayZone, en posant d'abord la question qui décide tout : acceptez-vous un site qui encaisse pour le compte de vendeurs tiers ?**

1. **Le champ réel est marocain et réglementé.** Stripe, Paddle et (provisoirement) Adyen sont écartés [1][2][3]. Depuis mai 2025, l'acquisition des commerçants n'est plus réservée au CMI : banques et établissements de paiement agréés peuvent la faire [4][5], et Attijari Payment l'a lancée [6].
2. **Le CMI sait déjà faire payer un étranger dans sa devise.** Depuis février 2025, avec Global Blue, l'acheteur étranger paie en euros, dollars ou livres, et le commerçant touche une part de la conversion [7][8]. Cela colle à votre « astuce » du prix affiché, mais le taux et la monnaie de règlement (probablement le dirham) ne sont pas publiés.
3. **Le point qui peut tout bloquer n'est pas technique : c'est le statut.** La loi 103-12 crée les établissements de paiement agréés par Bank Al-Maghrib [9]. Aucune source trouvée ne dit qu'un simple mandat d'encaissement en dispense une place de marché, ni l'inverse [9][10]. Aucun candidat ne dit explicitement accepter ce modèle.

**Principale réserve :** le régime de change d'une vente en ligne par carte à un étranger, et celui d'un remboursement sur la même carte, ne sont décrits par aucune source trouvée [11][12]. C'est la question pour l'Office des Changes ou un avocat.

## Cadre de choix (approuvé le 2026-11-19)

- **Éliminatoires :** entité marocaine acceptée ; cartes Visa/Mastercard étrangères ; remboursement possible ; encaissement pour compte de tiers toléré.
- **Poids :** frais 30 % · intégration 20 % · délai de règlement 15 % · monnaie de règlement 15 % · coût d'entrée 10 % · sérieux et assistance 10 %.

## D1 — Le champ des candidats

- **Écartés.** Stripe : pas de société établie au Maroc d'après la plupart des guides (une source isolée dit le contraire) [1], confiance moyenne. Paddle : biens numériques seulement pour les vendeurs de plateformes, or une œuvre est un bien physique [2], confiance moyenne. Adyen : le Maroc n'apparaît pas parmi ses pays d'acquisition [3], confiance basse, écart provisoire.
- **CMI et banques.** Acquéreur historique ; e-DCC multidevises depuis février 2025 [7][8] ; plus de 26 milliards de dirhams de transactions par cartes étrangères en 2024, tous canaux confondus semble-t-il [7], confiance moyenne.
- **Nouveaux acquéreurs agréés :** Attijari Payment (mars 2025) [6], Vantage (2024), Pay10 (2025), Mazma (2026) [13]. Aucune offre pour places de marché trouvée.
- **PayZone :** plateforme homologuée par le CMI, intégrée à Wix et Shopify [14] ; rien trouvé sur le mode place de marché.
- **NAPS :** acquéreur avec offre e-commerce [13], rien sur les cartes étrangères ni le mode place de marché.
- **YouCan Pay, PayPal Business, 2Checkout :** voir D2.

## D2 — Conditions commerciales et intégration

| Candidat | Frais carte étrangère | Règlement | Point bloquant ou notable | Confiance |
|---|---|---|---|---|
| CMI via banque | sur devis ; ancien chiffre de 2,5 % HT, fraude à la charge du commerçant [15] | dirhams probablement ; délai non publié | e-DCC disponible [7] ; aucune documentation technique publique | basse |
| Attijari Payment | non trouvé | non trouvé | acquéreur bancaire agréé [6] | basse |
| PayZone | 3 % (1,8 % carte marocaine), sans frais d'adhésion [16] ; d'autres comparatifs donnent 3,2 à 3,9 % et 0 à 199 DH par mois | J+3 à J+7 selon des comparatifs | sources contradictoires | basse |
| YouCan Pay | 4,9 % + 2 MAD (3,9 % + 2 MAD carte marocaine) [17] | 7 jours glissants | plafonds de 5 000 MAD par jour et 35 000 par semaine, retenue d'environ 30 % pendant 30 jours [17] : **inadapté à des œuvres chères** si confirmé | basse |
| PayPal Business | 4,40 % + fixe, plus 3 % de conversion [18] | retrait vers Attijariwafa depuis novembre 2024 [19] | comptes marocains limités selon des tiers ; pas de mode place de marché trouvé | basse |
| 2Checkout | 2,4 à 3,9 % + fixe, plus 2 % transfrontalier [20] | non trouvé | un refus de commerçant marocain rapporté ; acceptation non prouvée | basse |

L'interchange domestique est plafonné à 0,65 % depuis octobre 2024 [21], ce qui pèse sur les cartes marocaines, pas sur les cartes étrangères. Le marché étant passé au multi-acquéreur, les frais du CMI se négocient [21]. Aucune source n'a donné les cautions, les délais de règlement officiels ni les conditions de remboursement par API.

## D3 — Cadre réglementaire

- **Change.** L'IGOC 2026 est en vigueur depuis le 1er janvier 2026 [11]. Les recettes d'exportation de biens se rapatrient sous 150 jours au plus [22], avec un compte en devises pour l'exportateur [22]. La part conservable en devises diffère selon les commentateurs (70 % ou 85 %), confiance basse. Le chapitre « commerce électronique » de l'IGOC vise les **achats** en ligne des résidents, pas les ventes à des étrangers [11].
- **Remboursement.** L'IGOC 2024 a un article « Annulation de règlements au profit de non-résidents » [12] : seul le titre a été vu. Rien n'a été trouvé sur le remboursement sur carte.
- **Statut.** Loi 103-12, articles 15, 16 et 34 : établissements de paiement agréés pour exécuter des paiements à distance lorsque l'opérateur est intermédiaire [9]. L'exclusion éventuelle d'un mandataire du vendeur n'est pas vérifiée [9][10]. Un acquéreur est une banque ou un établissement de paiement agréé qui contracte avec un commerçant [23].
- **Œuvres d'art.** La loi 22-80 modifiée régit l'exportation des biens culturels (ministère de la Culture) [24]. L'obligation pour une œuvre contemporaine non classée n'est pas établie.

## Matrice de décision (à re-pondérer)

Notes de 1 à 5, « ? » quand la donnée manque. Toutes les notes reposent sur des sources de confiance basse.

| Critère (poids) | CMI via banque | Attijari Payment | PayZone | YouCan Pay | PayPal | 2Checkout |
|---|---|---|---|---|---|---|
| Éliminatoires | à confirmer (tiers) | à confirmer (tiers) | à confirmer (tiers, cartes étrangères) | plafonds bloquants | place de marché non trouvée | entité marocaine non prouvée |
| Frais (30) | 4 | ? | 4 | 2 | 1 | 3 |
| Intégration (20) | 2 | ? | 4 | 3 | 4 | 3 |
| Délai de règlement (15) | ? | ? | 3 | 3 | 2 | ? |
| Monnaie de règlement (15) | 3 | ? | 3 | 3 | 3 | ? |
| Coût d'entrée (10) | ? | ? | 4 | 4 | 4 | ? |
| Sérieux (10) | 5 | 5 | 3 | 3 | 4 | 3 |

**Choix provisoire :** CMI par une banque (ou Attijari Payment), pour le coût et la devise étrangère. **Second :** PayZone, qui l'emporte si la banque est trop lente à contractualiser ou si son intégration technique est trop lourde. **Argument le plus fort contre :** aucun candidat ne confirme accepter un encaissement pour le compte de vendeurs tiers ; si tous refusent, il faudra un agrément, un partenaire agréé, ou que l'artiste soit le seul titulaire du contrat. **Protection la moins chère :** le port `Encaissement` existe déjà dans le code (story 7.4) : un adaptateur se change sans toucher au reste.

## Intuitions croisées

- Le multidevises du CMI règle le confort de l'acheteur étranger, mais pas la question du statut : la difficulté est juridique, pas technique.
- Les solutions les plus simples à intégrer (YouCan Pay, PayPal) sont aussi celles dont les frais ou les plafonds conviennent le moins à des œuvres chères.

## Recommandations

1. **Envoyer une même demande écrite** à une banque (pour le CMI), à Attijari Payment et à PayZone : (a) accepter une place de marché qui encaisse pour des vendeurs tiers ; (b) frais pour carte étrangère et marocaine, e-DCC et rétrocession ; (c) monnaie et délai de règlement ; (d) remboursement sur la même carte, partiel ou total, et délai ; (e) caution, abonnement, documentation et environnement de test. Confiance actuelle : basse, d'où la demande. Alimente : story 7.5 et OQ-1.
2. **Poser à un avocat ou à l'Office des Changes** : le mandat d'encaissement exige-t-il un agrément d'établissement de paiement (loi 103-12) ; qui est l'exportateur (l'artiste ou Errancy) ; la commission est-elle une exportation de services ; comment se fait un remboursement par carte à un non-résident (IGOC 2026). Alimente : `docs/decisions-porteur.md`.
3. **Écarter YouCan Pay** pour des œuvres chères tant que ses plafonds et sa retenue ne sont pas démentis.

## Questions ouvertes

- Encaissement pour compte de tiers accepté par un acquéreur marocain : à demander aux acquéreurs (recommandation 1).
- Agrément ou mandat : à demander à un avocat (recommandation 2).
- Remboursement sur carte étrangère et règles de change : IGOC 2026 à lire en entier, ou Office des Changes.
- Grilles tarifaires officielles : relire les pages des prestataires une fois leurs domaines autorisés dans le réseau de la session (approfondissement possible de cette recherche).

## Sources

| n | Ce qu'elle appuie | Éditeur | Publication | Consultée | Confiance |
|---|---|---|---|---|---|
| 1 | Stripe et les sociétés marocaines | [Osome](https://osome.com/uk/blog/stripe-account-setup-in-morocco) | non datée | 2026-11-19 | moyenne |
| 2 | Paddle limité aux biens numériques | [Paddle](https://developer.paddle.com/partners/embed-billing/get-started/supported-sellers) | non datée | 2026-11-19 | moyenne |
| 3 | Pays d'acquisition d'Adyen | [Adyen](https://www.adyen.com/global-payment-processing) | non datée | 2026-11-19 | basse |
| 4 | Ouverture de l'acquisition au 1er mai 2025 | [Le360](https://fr.le360.ma/economie/paiement-electronique-depuis-le-1er-mai-les-etablissements-de-paiement-et-les-filiales-de-banques_DH3TELQMKFHMDIR6Z37AX7SY3I/) | 2025-05 | 2026-11-19 | moyenne |
| 5 | Ouverture du marché saluée par BAM | [Hespress](https://fr.hespress.com/480898-paiement-electronique-bam-et-le-conseil-de-la-concurrence-saluent-louverture-du-marche.html) | 2025 | 2026-11-19 | moyenne |
| 6 | Attijari Payment lance l'acquisition | [Le360](https://fr.le360.ma/economie/attijari-payment-lance-son-activite-dacquisition-commercants_X3X6FWGRHFHDLFKDKTQ74C3S6I/) | 2025 | 2026-11-19 | moyenne |
| 7 | e-DCC du CMI, volumes des cartes étrangères | [Hespress](https://fr.hespress.com/411997-le-paiement-multidevises-sur-les-sites-marocains-de-e-commerce-desormais-possible.html) | 2025-02 | 2026-11-19 | moyenne |
| 8 | e-DCC du CMI | [Le Desk](https://ledesk.ma/encontinu/le-cmi-lance-le-service-de-paiement-multidevises-sur-les-sites-e-commerce-marocains/) | 2025-02 | 2026-11-19 | moyenne |
| 9 | Loi 103-12, articles 15, 16, 34 | [SGG (projet de loi)](https://www.sgg.gov.ma/Portals/0/lois/Projet_loi_103.12-NV_Fr.pdf) | 2014 | 2026-11-19 | moyenne |
| 10 | Commentaire de la loi 103-12 | [The Legal Hive](https://www.thelegalhive.com/103-12/) | non datée | 2026-11-19 | basse |
| 11 | IGOC 2026 ; chapitre commerce électronique | [Office des Changes](https://www.oc.gov.ma/fr/actualites/publication-de-l-instruction-generale-des-operations-de-change-2026) | 2026-01 | 2026-11-19 | moyenne |
| 12 | Article sur l'annulation de règlements (titre seul) | [IGOC 2024, Casainvest](https://casainvest.ma/sites/default/files/IGOC%202024.pdf) | 2024 | 2026-11-19 | basse |
| 13 | Agréments récents ; NAPS | [Médias24](https://medias24.com/2026/07/23/paiements-mazma-technologies-decroche-lagrement-de-bank-al-maghrib-1728679/) | 2026-07 | 2026-11-19 | moyenne |
| 14 | PayZone sur Wix | [Wix](https://support.wix.com/fr/article/connecter-payzone-comme-fournisseur-de-paiement) | non datée | 2026-11-19 | moyenne |
| 15 | Ancien tarif CMI carte étrangère | [Sentinel Studio](https://www.sentinelstudio.ma/journal/cmi-vs-payzone-vs-stripe-maroc) | non datée | 2026-11-19 | basse |
| 16 | Tarifs PayZone | [elloha](https://elloha.zendesk.com/hc/fr/articles/13788623587229-Percevez-votre-argent-avec-Payzone) | non datée | 2026-11-19 | basse |
| 17 | Tarifs et plafonds de YouCan Pay | [YouCan Pay](https://youcanpay.com/pricing) | non datée | 2026-11-19 | basse |
| 18 | Frais PayPal Maroc | [PayPal](https://www.paypal.com/ma/business/paypal-business-fees) | non datée | 2026-11-19 | basse |
| 19 | Retrait PayPal vers Attijariwafa | [Electronic Payments International](https://www.electronicpaymentsinternational.com/news/attijariwafa-bank-paypal-launch-new-service-for-moroccan-merchants-241114-4448393) | 2024-11 | 2026-11-19 | moyenne |
| 20 | Frais transfrontaliers de 2Checkout | [Verifone](https://verifone.cloud/docs/2checkout/Documentation/01Product-catalog/05Pricing_and_charge_scenarios/Cross-border_fee_charges) | non datée | 2026-11-19 | basse |
| 21 | Plafond d'interchange, multi-acquéreur | [La Vie Éco](https://www.lavieeco.com/argent/paiements-electroniques-place-au-modele-multi-acquereur/) | 2024 | 2026-11-19 | moyenne |
| 22 | Rapatriement en 150 jours, compte en devises | [Office des Changes](https://www.oc.gov.ma/fr/personnes-morales/rapatriement-des-produits-des-exportations-de-biens) | non datée | 2026-11-19 | moyenne |
| 23 | Définition de l'acquéreur | [Bank Al-Maghrib, via Médias24](https://medias24.com/content/uploads/2024/09/25/Décision-Réglementaire-Commission-dinterchange_DCOM.pdf) | 2024-09 | 2026-11-19 | moyenne |
| 24 | Loi 22-80 sur les biens culturels | [Casamémoire](https://casamemoire.org) | non datée | 2026-11-19 | basse |

## Péremption

Les tarifs (D2) vieillissent en trois mois : à relire avant toute signature, et dans tous les cas avant le **2027-02-19**. Le paysage des acquéreurs (D1) se revoit sous six mois ; le cadre réglementaire (D3) à chaque nouvelle IGOC.
