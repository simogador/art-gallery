# D2 : conditions commerciales et intégration des solutions marocaines d'encaissement (passe r1-1)

Date de consultation de toutes les sources : 2026-11-19.

**Avertissement de méthode.** Aucune page n'a pu être lue en entier : dans cette session, la lecture directe a échoué (`telquel.ma` et `youcanpay.com` sont hors des domaines autorisés, refus DNS). Conformément à la consigne de l'environnement, aucun autre site n'a été tenté. Toutes les affirmations ci-dessous reposent donc sur les **extraits rendus par l'outil de recherche web** (moteur des États-Unis), pas sur la lecture de la page. La confiance est abaissée en conséquence : aucune n'est « haute ». Aucun tarif n'a été vérifié sur une grille officielle lue en entier, et la règle des 3 mois au plus pour les prix n'est remplie pour aucun chiffre.

## Affirmations

### CMI (Centre Monétique Interbancaire) et acquéreurs bancaires

1. **Affirmation :** le CMI ne publie pas de grille tarifaire commerçant ; les commissions d'acquisition se négocient au cas par cas. Le tarif est **sur devis**.
   Source : https://wafir.ma/fr/institutions/cmi · Éditeur : Wafir.ma · Publication : non indiquée · Confiance : moyenne · Classe : tarif

2. **Affirmation :** dans le cadre des engagements pris devant le Conseil de la concurrence, environ 55 000 contrats commerçants ont été transférés vers sept acquéreurs, et le CMI s'est engagé à transférer ses contrats de passerelle e-commerce. Un commerçant peut choisir un autre acquéreur que celui qui lui a été attribué (modèle multi-acquéreur).
   Sources : https://telquel.ma/2024/10/11/paiement-electronique-le-cmi-reduit-ses-commissions-aupres-de-55-000-commercants_1898261 (TelQuel, 2024-10-11) ; https://conseil-concurrence.ma/wp-content/uploads/2024/11/Communique-CC-FR.pdf (Conseil de la concurrence, novembre 2024) ; https://www.lavieeco.com/argent/paiements-electroniques-place-au-modele-multi-acquereur/ (La Vie éco, date non lue) · Confiance : moyenne · Classe : paysage

3. **Affirmation :** Bank Al-Maghrib a plafonné l'interchange domestique à 0,65 % du montant des transactions par carte, à compter d'octobre 2024. Ce plafond vise les cartes marocaines ; rien n'est dit des cartes étrangères.
   Source : https://medias24.com/2024/10/01/paiement-electronique-decisions-historiques-implications-immediates/ · Éditeur : Médias24 · Publication : 2024-10-01 · Confiance : moyenne · Classe : tarif

4. **Affirmation :** la réglementation interdit au commerçant de répercuter les commissions sur le client.
   Source : extrait de la recherche agrégée (TelQuel / Médias24, 2024) ; texte réglementaire non lu · Confiance : basse · Classe : paysage

5. **Affirmation :** en février 2025, le CMI a lancé, avec Global Blue, un service de paiement multidevises par conversion dynamique des devises (e-DCC) sur les sites e-commerce marocains. Un acheteur étranger y paie dans sa devise (EUR, USD, GBP cités), et le commerçant perçoit une « rétrocession » sur ces transactions.
   Sources : https://fr.hespress.com/411997-le-paiement-multidevises-sur-les-sites-marocains-de-e-commerce-desormais-possible.html (Hespress, 2025-02) ; https://lematin.ma/economie/le-cmi-lance-le-paiement-multidevises-sur-les-sites-e-commerce-marocains/264967 (Le Matin, 2025-02) ; https://telquel.ma/2025/02/19/e-commerce-le-cmi-integre-la-conversion-dynamique-des-devises-au-maroc_1918539 (TelQuel, 2025-02-19) · Confiance : moyenne (trois médias indépendants, communiqué commun probable) · Classe : technique

6. **Affirmation :** aucune source trouvée ne précise le taux de rétrocession de l'e-DCC, ses frais, ni la monnaie de règlement du commerçant. Le règlement en dirhams est probable, vu la conversion dynamique, mais **non vérifié**.
   Sources : les mêmes que l'affirmation 5 · Confiance : sans objet (lacune) · Classe : tarif

7. **Affirmation :** en 2024, le volume des transactions par cartes étrangères passées par le CMI a dépassé 26 milliards de dirhams, en hausse de 36 %.
   Source : https://fr.hespress.com/411997-le-paiement-multidevises-sur-les-sites-marocains-de-e-commerce-desormais-possible.html · Éditeur : Hespress · Publication : 2025-02 · Confiance : moyenne · Classe : paysage

8. **Affirmation :** un article ancien sur le CMI donnait au plus 1,5 % HT par transaction pour les cartes marocaines et 2,5 % HT pour les cartes étrangères. Il y ajoutait, pour le PSP, environ 1 000 DH HT de mise en service et 0,5 % HT par transaction, et précisait que la fraude sur carte étrangère reste à la charge du commerçant. Ces chiffres sont **périmés**, plusieurs années avant la réforme de 2024.
   Source : https://www.yabiladi.com/articles/details/50081/qu-il-faut-savoir-pour-ouvrir.html · Éditeur : Yabiladi · Publication : ancienne, date non lue · Confiance : basse · Classe : tarif

9. **Affirmation :** aucune documentation technique publique du CMI (API, 3-D Secure, remboursement, environnement de test) n'a été trouvée par recherche. La documentation passe vraisemblablement par la banque ou l'acquéreur, mais ce point est **non vérifié**.
   Source : recherche sans résultat pertinent (seuls Monetico, Lyra et Up2pay, prestataires français, sont sortis) · Confiance : sans objet · Classe : technique

### PayZone

10. **Affirmation :** selon une page d'aide d'elloha, intégrateur qui propose PayZone, la commission est de 1,8 % par transaction pour une carte marocaine et de 3 % pour une carte hors Maroc. PayZone ne facture ni frais d'intégration ni frais d'adhésion.
    Source : https://elloha.zendesk.com/hc/fr/articles/13788623587229-Percevez-votre-argent-avec-Payzone · Éditeur : elloha (tiers intégrateur) · Publication : non lue · Confiance : moyenne · Classe : tarif

11. **Affirmation :** un guide de 2026 sur Shopify au Maroc donne 1,8 à 2,5 % pour une carte marocaine et 3 % pour une carte hors Maroc chez PayZone. C'est une deuxième source, mais elle n'est pas officielle et peut-être pas indépendante de la première.
    Source : https://hamza-sehouli.com/blog/methodes-paiement-shopify-maroc · Éditeur : blog Hamza Sehouli · Publication : 2026 · Confiance : basse · Classe : tarif

12. **Affirmation :** un comparatif de 2026 avance pour PayZone 3,2 à 3,9 % sur les cartes étrangères, un abonnement de 0 à 199 DH par mois et un virement à J+3 à J+7. Un autre comparatif donne 2,5 à 3,5 % sans distinguer l'origine de la carte. Ces fourchettes **contredisent** le 3 % des affirmations 10 et 11.
    Sources : https://digitoyou.com/blog/paiement-en-ligne-maroc-cmi-stripe-2026/ (Digitoyou, 2026) ; https://www.sentinelstudio.ma/journal/cmi-vs-payzone-vs-stripe-maroc (Sentinel Studio, date non lue) · Confiance : basse · Classe : tarif

### YouCan Pay

13. **Affirmation :** la FAQ officielle de YouCan Pay indique 3,9 % + 2 MAD par transaction pour une carte marocaine et 4,9 % + 2 MAD pour une carte internationale. Elle précise que le service n'est ouvert qu'aux utilisateurs établis au Maroc.
    Source : https://youcanpay.com/faq · Éditeur : YouCan Pay (officiel) · Publication : non datée ; l'outil de recherche signale des pages vieilles d'environ 1 500 à 1 700 jours · Confiance : moyenne (source officielle, mais extrait seulement et page ancienne) · Classe : tarif

14. **Affirmation :** la page tarifaire officielle ne mentionne que 3,9 % + 2 MAD, sans frais d'inscription ni abonnement, avec des remises au-delà de 50 000 USD de ventes par mois. Elle cite un plafond de 5 000 MAD par jour ou 35 000 MAD par semaine, présenté comme destiné aux vendeurs nationaux, et une **retenue d'environ 30 % du volume encaissé pendant 30 jours** (fraude, rétrofacturations, remboursements).
    Source : https://youcanpay.com/pricing · Éditeur : YouCan Pay (officiel) · Publication : ancienne, non datée · Confiance : basse à moyenne (extrait seulement, page potentiellement périmée, à confirmer) · Classe : tarif

15. **Affirmation :** un comparatif de 2026 juge partielle la prise en charge des cartes internationales par YouCan Pay, et donne 2 à 3 % pour les cartes Visa/Mastercard internationales en général au Maroc.
    Source : https://www.baas.ma/en/blog/paiement-en-ligne-maroc-2026 · Éditeur : baas.ma · Publication : 2026 · Confiance : basse · Classe : paysage

### PayPal Business (Maroc)

16. **Affirmation :** le Maroc figure parmi les pays de PayPal, avec un compte professionnel. La page « Seller Fees » de PayPal Maroc indique **4,40 % + frais fixes** pour la réception de paiements nationaux, et **3,0 %** pour convertir un solde ou un paiement reçu dans une autre devise. La grille des ventes internationales n'a pas pu être lue.
    Source : https://www.paypal.com/ma/business/paypal-business-fees · Éditeur : PayPal (officiel) · Publication : non lue · Confiance : moyenne (extrait officiel partiel) · Classe : tarif

17. **Affirmation :** selon la page PayPal Monaco, et non celle du Maroc, un retrait vers un compte en dirhams coûte 48,00 MAD de frais fixes ; la même page place le Maroc à 4,0 % pour la conversion des envois et remboursements. Ce chiffre est **à confirmer sur la page du Maroc**.
    Source : https://www.paypal.com/mc/business/paypal-business-fees · Éditeur : PayPal · Publication : non lue · Confiance : basse · Classe : tarif

18. **Affirmation :** les blogs se contredisent sur le retrait d'un solde PayPal vers une banque marocaine. Certains le disent possible en 3 à 5 jours ouvrables, d'autres le disent restreint et soumis à des conditions propres au Maroc. Aucune source officielle n'a été lue sur ce point.
    Sources : https://charipay.ma/en/blog/paypal-au-maroc (Charipay, date non lue) ; https://ecomgrowth.fr/paypal-au-maroc/ (Ecomgrowth, 2026) · Confiance : basse · Classe : paysage

19. **Affirmation :** Stripe n'est pas disponible pour un commerçant établi au Maroc, d'après la liste officielle citée par un blog (non relue).
    Source : https://www.zenind.com/fr-CA/help/post/how-to-open-a-paypal-account-in-morocco-a-2026-guide-for-entrepreneurs · Éditeur : Zenind · Publication : 2026 · Confiance : basse · Classe : paysage

### 2Checkout / Verifone

20. **Affirmation :** les frais par vente de 2Checkout vont d'environ 2,4 à 3,9 % + 0,30 à 0,45 USD selon le pays du vendeur, le secteur et le modèle d'affaires. Aucune grille propre au Maroc n'a été trouvée.
    Source : https://www.jotform.com/2checkout/faq/ · Éditeur : Jotform (tiers) · Publication : non lue · Confiance : basse · Classe : tarif

21. **Affirmation :** la documentation Verifone indique des frais transfrontaliers de 2 % en plus des taux contractuels lorsque la carte est émise dans un autre pays que celui du vendeur, pour les comptes 2Sell et 2Subscribe seulement.
    Source : https://verifone.cloud/docs/2checkout/Documentation/01Product-catalog/05Pricing_and_charge_scenarios/Cross-border_fee_charges · Éditeur : Verifone (officiel) · Publication : non lue · Confiance : moyenne · Classe : tarif

22. **Affirmation :** 2Checkout verse le commerçant chaque semaine, toutes les deux semaines ou chaque mois, avec un minimum de virement et un choix de devise et de méthode. Un témoignage isolé, sur le forum Shopify, rapporte le refus sans explication d'un commerçant marocain.
    Sources : https://support.ecwid.com/hc/en-us/articles/207806825 (Ecwid, date non lue) ; https://community.shopify.com/t/exploring-additional-payment-options-for-my-shopify-store/242774 (Shopify Community, date non lue) · Confiance : basse · Classe : paysage

### M2T et autres établissements de paiement agréés

23. **Affirmation :** M2T, filiale du groupe Banque Centrale Populaire, fait partie des premiers établissements de paiement agréés par Bank Al-Maghrib en février 2018, avec Wafacash, Cash Plus et NAPS. D'autres agréments ont suivi, dont Vantage Payment Systems (2024), Pay10 (2025) et Mazma Technologies (juillet 2026). Aucune source ne décrit une passerelle e-commerce de M2T ouverte aux cartes internationales.
    Sources : https://telquel.ma/2018/02/15/quatre-etablissements-de-paiement-desormais-agrees-par-bam_1580502 (TelQuel, 2018-02-15) ; https://medias24.com/2024/02/26/vantage-payment-systems-obtient-lagrement-detablissement-de-paiement-de-bank-al-maghrib/ (Médias24, 2024-02-26) ; https://medias24.com/2025/10/17/la-fintech-pay10-rejoint-lecosysteme-marocain-des-paiements-numeriques/ (Médias24, 2025-10-17) ; https://medias24.com/2026/07/23/paiements-mazma-technologies-decroche-lagrement-de-bank-al-maghrib-1728679/ (Médias24, 2026-07-23) · Confiance : moyenne pour les agréments, sans objet pour l'offre e-commerce (lacune) · Classe : paysage

24. **Affirmation :** le dirham n'est pas librement convertible, et les flux transfrontaliers relèvent de l'Office des changes.
    Source : https://www.worldfirst.com/af/blog/online-sellers/marketplace-payment-solutions/ · Éditeur : WorldFirst (tiers) · Publication : non lue · Confiance : basse (à vérifier auprès de l'Office des changes) · Classe : paysage

## Pistes à suivre

- **Autoriser la lecture** de `youcanpay.com`, `telquel.ma`, `paypal.com`, `payzone.ma`, `cmi.co.ma`, `verifone.cloud` et `bkam.ma` dans les réglages réseau de la session, puis relire les pages officielles en entier : grilles datées, conditions de retenue, documentation.
- **CMI et acquéreurs** : demander une offre écrite à deux ou trois acquéreurs du modèle multi-acquéreur (banques). Elle doit couvrir la commission sur carte marocaine et étrangère, les frais de mise en service et l'abonnement, l'e-DCC (taux de rétrocession, devise de règlement), le délai de règlement, la caution, la responsabilité en cas de fraude sur carte étrangère, le remboursement (back-office ou API, partiel ou total) et l'environnement de test.
- **PayZone** : obtenir la grille officielle actuelle, car les sources donnent 3 % ou 3,2 à 3,9 % pour une carte étrangère, et la documentation développeur (API, page hébergée, 3-D Secure, remboursement).
- **YouCan Pay** : vérifier si le plafond de 5 000 MAD par jour et la retenue de 30 % pendant 30 jours sont encore en vigueur. Ils rendraient l'outil inadapté à des œuvres d'art de plusieurs milliers d'euros.
- **PayPal Maroc** : lire la grille officielle complète des ventes internationales et les conditions de retrait vers une banque marocaine (frais fixe de 48 MAD ?), et vérifier le traitement des remboursements (conversion à 4 % ?).
- **Office des changes** : vérifier les règles de rapatriement et de délai de cession des devises encaissées par une société marocaine, pour PayPal et 2Checkout.
- **Liste officielle** des établissements de paiement agréés de Bank Al-Maghrib : repérer ceux qui offrent une acquisition e-commerce de cartes internationales (NAPS, Vantage, Pay10, Mazma…).

## Cherché et non trouvé

- Toute grille tarifaire officielle du CMI ou d'un acquéreur bancaire marocain pour l'e-commerce : les tarifs sont **sur devis**.
- Taux de rétrocession de l'e-DCC du CMI, frais associés et monnaie de règlement du commerçant.
- Documentation technique publique du CMI : API, 3-D Secure, remboursement par API, environnement de test.
- Documentation technique de PayZone, YouCan Pay et M2T : aucune page lue.
- Délais de règlement officiels pour tous les candidats, sauf la fourchette J+3 à J+7 donnée par un blog pour PayZone.
- Conditions de remboursement (même carte, partiel, délai) pour tous les candidats.
- Caution ou dépôt de garantie, sauf la retenue de 30 % de YouCan Pay, non confirmée.
- Offre e-commerce de M2T.
- Grille de 2Checkout/Verifone propre au Maroc, et acceptation des commerçants marocains.
- Toute source tarifaire datée de moins de 3 mois et lue directement.
