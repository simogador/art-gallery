---
title: "Réconciliation PRD → Architecture Spine"
reviewed: ../ARCHITECTURE-SPINE.md (status draft, 2026-10-27) + ../.memlog.md
source: ../../../prds/prd-art-gallery-2026-10-24/prd.md + addendum.md
date: 2026-10-27
---

# Réconciliation PRD → Architecture Spine

## Verdict

Le spine est fidèle au PRD dans ses grandes lignes : les 35 FR et 8 NFR sont listés dans `binds`, OQ-1 et OQ-16 ne sont **pas** tranchées (AD-4 garde les deux variantes, le paiement unique ou par commande reste un réglage), et OQ-9 (PostHog UE) est tranchée de façon légitime par le porteur (memlog l.41). En revanche, plusieurs exigences discrètes du PRD n'ont pas de règle d'architecture, ou sont couvertes de travers. Les plus importantes : le délai de priorité de FR-9, le périmètre du « tout ou rien » de la réservation pour un panier à plusieurs artistes, le cas « vendue ailleurs » après confirmation et la propriété des incidents SM-C1, le seuil de preuve de livraison (FR-29) et la conformité (DSA, DAC7, conservation et purge RGPD). Aucun constat n'est **critical**. Il y a 4 constats **high**, et les autres sont medium ou low.

Légende de gravité : **critical** = contredit une décision ou tranche une OQ protégée ; **high** = deux epics pourraient construire de façon incompatible, ou une exigence testable du PRD est perdue ; **medium** = couverture partielle ou ambiguë ; **low** = cosmétique ou cartographie.

---

## 1. Exigences discrètes perdues ou couvertes de travers

### R-1 [high] FR-9 : ordre d'inscription et délai de priorité absents

- **PRD** FR-9 : « Les inscrits sont prévenus dans l'ordre d'inscription. Chacun dispose d'un court délai de priorité » (`[ASSUMPTION]`, repris en §13).
- **Spine** : AD-11 dit seulement que le balayage envoie « les notifications liées au temps (FR-9) ». AD-7 autorise toute réservation par mise à jour conditionnelle `disponible → reservee`. Rien ne garantit l'ordre d'envoi ni ne réserve la priorité à l'inscrit prévenu : n'importe quel visiteur peut réserver l'œuvre pendant le délai de priorité. La Capability Map range FR-9 sous `demandes` (AD-11, AD-14, AD-10), sans AD-7, alors que la priorité demande la coopération de `disponibilite`.
- **Risque** : l'epic `demandes` construit une liste d'envoi, l'epic `disponibilite` ignore la priorité, et la promesse du PRD n'est tenue par aucun des deux.
- **Correction proposée** : ajouter à AD-7 (ou à un AD dédié) la règle « fenêtre de priorité » : échéance stockée (AD-10), durée en réglage, et `disponibilite` qui refuse pendant ce délai toute réservation d'un autre que l'inscrit prévenu ; préciser l'ordre FIFO dans `demandes` ; ajouter AD-7 dans la ligne FR-9 de la Capability Map. Signaler aussi que, sur un plan Vercel Hobby (AQ-2), la notification FR-9 peut arriver jusqu'à 24 h en retard, ce qui vide la priorité de son sens.

### R-2 [high] FR-12 : « réservé en bloc » par commande ou par passage en caisse ?

- **PRD** FR-12 : « Une commande de plusieurs œuvres est réservée en bloc. Si une seule œuvre n'est pas disponible, aucune n'est réservée. » FR-10 : un panier, un passage en caisse, une commande par artiste.
- **Spine** : AD-7 dit « une seule transaction qui couvre toutes les œuvres **de la commande** ». L'ER rattache pourtant `RESERVATION` au `PASSAGE_EN_CAISSE`. Avec un panier à plusieurs artistes, rien ne dit si l'échec d'une commande fait échouer tout le passage, ou si certaines commandes partent seules. Les deux lectures sont compatibles avec le texte.
- **Risque** : avec la variante « un paiement pour tout le panier » d'OQ-16, une réservation partielle produit un paiement dont le montant ne correspond plus au récapitulatif de FR-11.
- **Correction proposée** : écrire dans AD-7 que le tout-ou-rien porte sur **le passage en caisse entier** (toutes ses commandes), ou poser explicitement la question comme question ouverte liée à OQ-16. Le spine ne doit pas laisser les deux lectures possibles.

### R-3 [high] FR-21 / FR-31 / SM-C1 : « vendue ailleurs » après confirmation, et propriétaire des incidents

- **PRD** FR-21 : l'artiste passe l'œuvre en `vendue ailleurs` « à tout moment ». S'il y avait une réservation, l'acheteur est prévenu ; s'il avait déjà payé, il est remboursé ; l'équipe est alertée ; l'incident est compté dans SM-C1. FR-31 cite « œuvre passée en vendue ailleurs » comme motif de remboursement.
- **Spine** :
  - Le diagramme de disponibilité n'a pas de transition `vendue → vendue_ailleurs`. Le cas de l'artiste qui vend à l'atelier une œuvre déjà vendue et payée sur Errancy (commande `confirmee` ou `prise_en_charge`) n'a donc pas de chemin. Il ne reste que l'annulation avec motif par l'équipe, que le spine ne relie ni à l'artiste ni à SM-C1.
  - AD-7 écrit `ReservationAnnulee`, mais ne dit ni que l'équipe est alertée ni qu'un incident SM-C1 est créé. Seul AD-8 enregistre un incident SM-C1.
  - La donnée « incident SM-C1 » n'a **aucun propriétaire** dans la table d'AD-2.
- **Correction proposée** :
  - Ajouter « Incident (SM-C1) » à la table d'AD-2, avec `commandes` comme propriétaire probable, alimenté par événement depuis `disponibilite`.
  - Dire dans AD-7 que l'annulation d'une réservation par « vendue ailleurs » ou « retirer » crée un incident et alerte l'équipe.
  - Définir le chemin pour une œuvre `vendue` déclarée vendue ailleurs : l'artiste signale, puis l'équipe annule et rembourse (FR-31), et l'incident SM-C1 est créé.

### R-4 [high] FR-29 : la preuve de livraison et l'assurance au-delà d'un seuil ne sont pas une règle

- **PRD** FR-29 : « Au-delà d'un seuil de prix, l'artiste doit expédier avec une preuve de livraison et une assurance » (seuil OQ-5). §12 en fait la réponse au risque de fraude et de litige « colis non reçu ».
- **Spine** : la seule trace est dans le tableau des questions ouvertes (« seuil de FR-29 en réglage »). Aucun AD ne dit où la règle s'applique. AD-9 ne conditionne pas `prise_en_charge → expediee` (saisie du suivi) ni `expediee → livree` à une preuve ou une assurance au-delà du seuil. La ligne FR-29 de la Capability Map ne cite que AD-9, AD-10, AD-11 et AD-16.
- **Correction proposée** : ajouter à AD-9 que, si le prix figé de la commande (AD-12) dépasse le réglage « seuil preuve et assurance », la transition vers `expediee` exige la déclaration d'assurance, et la transition vers `livree` exige une preuve (suivi transporteur ou pièce jointe). Le seuil est lu par `reglages`.

### R-5 [medium] FR-12 : plafond de réservations par e-mail ou par appareil, et contenu du journal

- **PRD** FR-12 : « Le nombre de réservations simultanées par e-mail ou par appareil est limité. Chaque réservation est journalisée : qui, quand, échéance, issue. »
- **Spine** :
  - AD-7 fait du plafond un réglage, ce qui est bien. Mais il ne dit pas **comment on identifie un appareil** pour un acheteur sans compte (cookie signé, identifiant de session ?). Ce choix touche aussi NFR-6, puisqu'un identifiant d'appareil peut relever du consentement. Il ne dit pas non plus quel module applique le plafond.
  - Le journal liste œuvre, bénéficiaire, origine, échéance et issue. Pour une réservation de vente assistée, il manque l'**auteur** (le membre de l'équipe qui l'a posée), alors que FR-13 et FR-26 tracent qui a agi.
- **Correction proposée** : dans AD-7, nommer l'identifiant d'appareil (par exemple un identifiant aléatoire de passage stocké en cookie strictement nécessaire, sans mesure) et confier le contrôle du plafond à `disponibilite`. Ajouter `posee_par` et `cree_le` à la ligne `Reservation`.

### R-6 [medium] FR-16 : aucune garde « accord écrit signé » avant publication

- **PRD** FR-16 : « Chaque artiste publié a signé un accord écrit » (vente, droits sur les images, données des acheteurs, non-contournement). OQ-10 bloque l'ouverture du Lot 1.
- **Spine** : AD-6 donne la règle de visibilité (`publiee` et non `retiree`) sans condition sur l'artiste. `curation` ne vérifie nulle part que l'accord est enregistré.
- **Correction proposée** : ajouter à AD-6 ou à `curation` que la publication d'une œuvre exige que son artiste porte un accord enregistré (date, version), écrit par `curation`.

### R-7 [medium] FR-27 / SM-2 : suivi du taux de consentement

- **PRD** FR-27 : « Le taux de consentement est suivi, pour corriger SM-2. » SM-2 publie ce taux à côté de la conversion.
- **Spine** : AD-19 bloque tout événement sans consentement, ce qui est juste. Mais rien ne mesure le refus lui-même, et le port Mesure ne peut donc pas produire ce taux. Le spine ne dit pas non plus comment le consentement est connu côté serveur pour l'événement « commande confirmée », émis par `commandes`.
- **Correction proposée** : ajouter à AD-19 un compteur agrégé et anonyme des choix de consentement, stocké en base par `mesure`, sans identifiant, et préciser comment le consentement accompagne les événements émis côté serveur.

### R-8 [medium] Conformité : DSA, DAC7 et conservation RGPD absents ou reportés à tort

- **PRD** §11 recense : traçabilité des vendeurs (DSA), déclaration fiscale des revenus des vendeurs (DAC7), règles d'export des biens culturels, encadrement des transferts d'adresses hors UE. NFR-6 exige : « Une durée de conservation est définie, avec une purge. »
- **Spine** :
  - DSA et DAC7 ne figurent nulle part, ni dans les AD, ni dans les questions ouvertes, ni dans Deferred. Ils touchent pourtant le modèle `Artiste` (identité, adresse, numéro fiscal) et l'agrégation annuelle des sommes dues par artiste (AD-24). Le PRD n'en fait pas des exigences, mais il les recense « pour que le juriste les traite ». Le spine doit au moins les porter comme questions ouvertes liées à OQ-1.
  - La conservation et la purge sont en **Deferred** (« durée à fixer par le porteur »), alors que NFR-6 est une exigence du MVP et qu'aucune OQ du PRD ne la couvre. La ligne NFR-6 de la Capability Map ne cite que AD-16 et AD-19.
  - Transferts hors UE : AD-16 limite bien la durée d'accès de l'artiste à l'adresse. AQ-1, en revanche, ne cite pas la contrainte RGPD (Resend, par exemple, est un prestataire américain).
- **Correction proposée** :
  - Ajouter une question ouverte « DSA / DAC7 : données vendeurs et déclaration annuelle (lié à OQ-1) ».
  - Faire passer la conservation et la purge de Deferred à une question ouverte, avec « à trancher avant l'ouverture du Lot 2 », et compléter la ligne NFR-6 (balayage, AD-11).
  - Ajouter « localisation UE ou clauses de transfert » comme critère d'AQ-1.

### R-9 [medium] FR-14 / OQ-1 : les contestations de paiement n'ont pas de place dans AD-4

- **PRD** FR-14 et OQ-1 citent le traitement des contestations de paiement parmi les points bloqués. §12 cite le risque « contestation de paiement ».
- **Spine** : AD-4 pose que « tout adaptateur traduit ses notifications en **un fait unique**, paiement constaté ». Une contestation, ou un échec de remboursement notifié par le prestataire, n'entre pas dans ce fait. La règle, écrite ainsi, interdit à un futur adaptateur de remonter autre chose.
- **Correction proposée** : remplacer « un fait unique » par « des faits normalisés, dont *paiement constaté* », et nommer *contestation ouverte* comme fait réservé, sans traitement tant qu'OQ-1 est ouverte. Cela ne tranche pas OQ-1.

### R-10 [medium] NFR-1 : le seuil de LCP délégué à l'architecture n'est ni confirmé ni infirmé

- **PRD** NFR-1 : `[ASSUMPTION : LCP < 2,5 s, à confirmer par l'architecture]`.
- **Spine** : la ligne NFR-1 renvoie à AD-21 (cache de 60 s), sans budget chiffré ni règle sur les images (formats Cloudinary, tailles, chargement au défilement).
- **Correction proposée** : confirmer ou amender explicitement « LCP < 2,5 s au 75e centile mobile » dans AD-21 ou dans une convention, avec la règle « images d'œuvres servies uniquement par la fonction de transformation Cloudinary commune ».

### R-11 [medium] FR-6 / NFR-2 : la redirection d'une fiche `retiree` n'est pas portée

- **PRD** FR-6 : une fiche `retirée` n'est plus publique et « son URL redirige vers la page de l'artiste (NFR-2) ».
- **Spine** : AD-6 rend la fiche invisible. AD-20 ne couvre que les changements d'URL. La redirection d'une œuvre retirée, et donc le risque d'un 404 qui fait perdre le référencement, n'est pas une règle.
- **Correction proposée** : ajouter à AD-6 ou à AD-21 que `catalogue` renvoie, pour une œuvre `retiree`, une redirection vers la page de l'artiste et la retire du sitemap.

---

## 2. Questions ouvertes OQ-1 à OQ-16

| OQ | Report dans le spine | Constat |
|---|---|---|
| OQ-1 | Ouverte, bien reportée | Conforme : non tranchée. Manquent les tensions du PRD : pays sans rail contre « artistes de tous pays », acceptation de l'usage par Stripe, fiscalité des versements (voir aussi R-8). [low] |
| OQ-2, OQ-4 | Regroupées | Conforme. La condition d'affichage « Garantie Errancy seulement si OQ-2 le permet » (FR-24) n'est pas rappelée. [low] |
| OQ-3 | « Avant l'epic Lot 2 » | Conforme, et AD-24 en fait un réglage. Le PRD donne le porteur pour responsable ; le spine ne le nomme pas. [low] |
| OQ-5 | « Avant l'epic Lot 2 » | **[medium] R-12.** Les zones et la correspondance pays → zone sont nécessaires dès le **Lot 1** : FR-3, FR-4, FR-17 et FR-20 sont au Lot 1, et SM-4, condition de sortie du Lot 1, exige au moins une zone par œuvre. Seuls le seuil de FR-29 et le contenu de FR-24 peuvent attendre le Lot 2. Correction : scinder la ligne en « composition des zones : avant le premier epic `livraison`, au Lot 1 » et « seuil, douane, casse : avant le Lot 2 ». |
| OQ-6 | Ouverte | Conforme (AD-5, AD-18). |
| OQ-7 | Ouverte | Conforme, avec le repli FR-8. |
| OQ-8 | Ouverte | Conforme. La partie déjà décidée (pas de showroom) n'est pas rappelée. [low] |
| OQ-9 | **Absente du tableau** | Tranchée par le porteur (memlog l.41, AD-19) : c'est légitime. Mais elle a disparu du tableau. Correction : y ajouter une ligne « OQ-9 tranchée : PostHog UE, porteur, 2026-10-27 » pour la traçabilité. [low] |
| OQ-10, OQ-11 | Regroupées, effet « Plan Vercel » | **[low]** OQ-10 est *bloquante pour l'ouverture du Lot 1* d'après le PRD, et elle conditionne la garde d'accord de R-6. Le spine ne garde que l'effet sur le plan Vercel. |
| OQ-12 | Ouverte, « possible sans changement » | Conforme : AD-17 et `constat-manuel` la rendent possible sans la trancher. |
| OQ-13 | Ouverte | Conforme (AD-18). |
| OQ-14 | Ouverte | Conforme. |
| OQ-15 | Ouverte, « aucun code » | Conforme (AD-22). |
| OQ-16 | Ouverte, « réglage du module `paiement` » | **Non tranchée par le spine**, ce qui est conforme. Mais voir **R-13** ci-dessous. |

### R-13 [medium] Ambiguïté de vocabulaire qui pourrait passer pour une décision sur OQ-16

- **PRD** OQ-1 : « Un panier avec plusieurs artistes peut-il être payé en une fois (**paiement fractionné**, OQ-16) ? » Ici, « paiement fractionné » désigne la répartition d'un paiement unique entre plusieurs commandes.
- **Memlog** l.19 : « le porteur confirme : […] aucun cas particulier (acompte, **paiement fractionné**, vente atelier tracée) à prévoir ». Dans ce contexte, le terme veut probablement dire « paiement en plusieurs fois ». Un lecteur, ou un agent, peut pourtant y lire que le porteur a écarté le paiement unique d'un panier multi-artistes, c'est-à-dire tranché OQ-16.
- **Correction proposée** : préciser dans le memlog, et si besoin dans AD-4, que « paiement fractionné » veut dire ici « paiement en plusieurs échéances », et que la répartition d'un paiement entre commandes (OQ-16) reste ouverte.

---

## 3. Autres écarts (medium et low)

- **R-14 [medium] Identifiant de l'œuvre dans les commandes : décision de modèle présentée comme une règle.** Le glossaire du PRD dit qu'une œuvre « est identifiée par son slug », et AGENTS.md dit `Order.artworkIds` = slugs. Le spine (Consistency Conventions, ligne « Identifiants », et AD-12) passe à « id dans les commandes, plus un instantané du slug », sans l'étiquette `[ASSUMPTION]` que le memlog lui donne (l.52). C'est une décision de modèle de données structurante, que la politique du dépôt réserve au porteur ou à un document validé. Correction : ajouter `[ASSUMPTION]` dans le spine, à confirmer avec le porteur.
- **R-15 [low] Capability Map, cartographie incomplète :**
  - FR-26 (voir et poser des réservations, libérer, consulter le journal) ne cite que `commandes` ; il faut ajouter `disponibilite` et AD-7.
  - FR-25 (voir les demandes et les inscriptions « Me prévenir ») ne cite pas `demandes`.
  - FR-30 (réclamation depuis la page de suivi) ne cite pas AD-14 ni AD-15 (acteur acheteur porteur d'un jeton).
  - FR-28 (rattachement automatique d'une commande issue d'une réservation de vente assistée) : `commandes` est en amont de `demandes`, donc le rattachement doit passer par un événement (AD-3, AD-11). Le préciser.
- **R-16 [low] FR-15 :** « La page affiche le minimum de données personnelles. » AD-16 ne filtre que pour l'acteur `artist`. Ajouter la même règle pour l'acteur acheteur porteur d'un jeton (pas d'adresse complète en clair, par exemple).
- **R-17 [low] FR-29, « le suivi du transporteur indique la livraison » :** le spine ne dit pas si ce constat est manuel ou automatisé. Aucun port transporteur n'est prévu. Ajouter une question d'architecture, ou écrire que le constat est manuel au MVP.
- **R-18 [low] FR-1 et FR-20 :** le refus de soumettre à la curation une œuvre incomplète (dimensions, zones, engagements), et le calcul de SM-4 (condition de sortie du Lot 1), n'ont pas d'emplacement nommé. Les attribuer explicitement à `curation`.
- **R-19 [low] FR-35 :** « Ces contacts sont prévenus à l'ouverture » n'a pas de déclencheur. L'ouverture étant un geste du porteur, préciser qui lance l'envoi (une action admin qui écrit un événement, AD-11).
- **R-20 [low] FR-31 et AD-24 :** la somme due est figée à la confirmation. L'effet d'un remboursement partiel sur la commission et la somme due n'est pas dit. À poser avec OQ-3.
- **R-21 [low] SM-1 et SM-6 :** l'exclusion des « proches déclarés par le porteur » (SM-1) et les coûts variables de la marge contributive (SM-6) n'ont pas de donnée prévue. C'est acceptable au MVP, mais on peut le mentionner dans Deferred.
- **R-22 [low] Ton (§8) :** le spine ne porte rien sur le ton. C'est normal, cela relève de DESIGN.md et EXPERIENCE.md. Une seule tension existe : « ni compte à rebours, ni fausse rareté » face à l'échéance de 30 minutes. Le spine la renvoie déjà à l'UX (UXQ-2), donc rien à corriger dans le spine. Le dictionnaire AD-18 est le bon endroit pour le vouvoiement.

---

## 4. Ce qui est correctement couvert (pour mémoire)

- FR-3, FR-4, FR-11, FR-17 : prix et délai total par une seule fonction, montants relus en base, commande figée (AD-12).
- FR-10 et FR-13 : acheteur sans compte (AD-13), confirmation idempotente et paiement tardif (AD-8), constat manuel tracé (AD-4).
- FR-21 : délai de visibilité de 60 s (AD-21).
- FR-22 et NFR-5 : adresse visible par l'artiste seulement entre la prise en charge et l'expédition (AD-16), autorisation dans les modules et rôle relu en base, ce qui couvre l'hypothèse de FR-34 (AD-15).
- FR-26 : délais de prise en charge et d'expédition, alertes séparées (AD-10, AD-11).
- FR-32 et FR-33 : somme due en un seul endroit, états `à verser`/`versée`/`bloquée` (AD-24, AD-4).
- NFR-4 : trois tests avant le Lot 2 (AD-23). NFR-7 : migration en quatre temps (AD-20). NFR-8 : AD-5, AD-18.
- Maintenance et `robots.txt` hors code (AD-22), pas de changement de pile, OQ-12 rendue possible sans être tranchée (AD-17).
- OQ-1 et OQ-16 : non tranchées. OQ-9 : tranchée par le porteur, ce qui est légitime.
