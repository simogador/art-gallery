---
title: "Revue adversariale — PRD refonte d'Errancy"
created: 2026-10-24
cible: prd.md, addendum.md (même dossier)
---

# Revue adversariale du PRD — Refonte d'Errancy

**Verdict :** le PRD est bien structuré et prudent sur le paiement, mais il n'est pas prêt pour l'UX et les epics : le Lot 1 « indépendant du paiement » ne se livre pas sans des FR du Lot 2, le zéro double vente est contredit par ses propres parcours, et plusieurs FR (réservation, panier multi-artistes, confirmation par notification) présupposent en douce un paiement intégré en ligne.

Comptes : **3 critical, 8 high, 9 medium, 5 low.**

Remarque de cadrage : ne pas trancher OQ-1 est voulu et légitime. Les findings ci-dessous ne demandent pas de le trancher. Ils demandent que les exigences restent vraies **pour chaque montage encore possible**, y compris l'option R4 (lien de paiement) que le PRD garde ouverte.

---

## Critical

### C-1. Le Lot 1 n'est pas livrable sans le Lot 2 (§6.1 contre §4)

- **Emplacement :** §6.1 Lot 1 ; FR-1, FR-2, FR-3, FR-4, FR-6, FR-8, FR-9, FR-16, FR-28 ; SM-4.
- **Citation :** « Lot 1. Conversion, indépendant du montage de paiement. FR-1 à FR-9, FR-16 à FR-19, FR-27 et FR-28. » ; « Lot 2. Socle commercial. FR-10 à FR-15, FR-20 à FR-26. »
- **Dépendances cachées du Lot 1 vers le Lot 2 :**
  - FR-1 et FR-2 : « ne peut pas être publiée (voir FR-20) ». La règle de publication vit dans FR-20 et FR-25 (Lot 2).
  - FR-3 et FR-4 : prix total et délai calculés à partir des frais et délais **par zone déclarés par l'artiste** (FR-20, Lot 2). Sans FR-20, il n'y a aucune donnée à afficher. FR-3 exige aussi « prix total affiché = montant demandé au paiement », alors que le paiement est au Lot 2.
  - FR-6 : le bouton « Acheter » et les états `réservée` / `vendue` n'existent qu'avec FR-10 à FR-13 (Lot 2). Le PRD ne dit pas ce que fait « Acheter » au Lot 1.
  - FR-9 : « Me prévenir » ne se déclenche que sur une réservation qui expire (FR-12, Lot 2).
  - FR-16 : « publiées après curation ». La curation, c'est FR-25 (Lot 2).
  - FR-8 : la demande est « visible dans l'administration (FR-25) », donc au Lot 2.
  - FR-28 : rattacher une **commande** suppose qu'il existe des commandes (FR-13, Lot 2).
  - SM-4 est la « condition de sortie du Lot 1 » mais « valide FR-20 » (Lot 2).
- **Scénario d'échec :** le découpage en epics suit §6.1. L'epic Lot 1 démarre, puis bloque sur des données (zones, curation, états) que personne n'a planifiées. Soit le Lot 1 glisse jusqu'au Lot 2, et « convertir d'abord » tombe ; soit l'équipe bricole des valeurs en dur sur la fiche, qui seront à refaire.
- **Correction proposée :** redécouper les lots par **capacité livrable** et non par numéro de FR.
  - Lot 1 = fiche (FR-1 à FR-5), modèle de données œuvre et zones, saisie par l'artiste ou par l'admin (une partie de FR-20), curation minimale (une partie de FR-25), FR-7, FR-8, FR-16 à FR-19, FR-27.
  - Au Lot 1, définir « Acheter » explicitement : soit il mène à OQ-12 (conseil WhatsApp ou demande d'achat), soit il est masqué.
  - Passer FR-9, FR-12 et FR-28 au Lot 2.
  - Ajouter en §6 une matrice des dépendances FR vers FR.

### C-2. Le zéro double vente est contredit par le PRD lui-même (UJ-2, FR-21, FR-12 contre NFR-4 et SM-C1)

- **Emplacement :** UJ-2 (cas limite), FR-21, FR-12, NFR-4, SM-C1, §11.
- **Citation :** « si une commande sur Errancy arrive avant sa mise à jour, l'équipe le contacte et la commande est annulée et remboursée » ; « Une œuvre `réservée` ne peut pas être modifiée par l'artiste » ; « SM-C1 Doubles ventes. Cible : zéro, sans exception ».
- **Scénarios d'échec :**
  1. Karim vend à l'atelier pendant qu'un acheteur en ligne paie. FR-21 l'empêche de passer l'œuvre en `vendue` (elle est `réservée`). Le paiement aboutit et FR-13 passe l'œuvre en `vendue`. Résultat : deux acheteurs payés, et la double vente est **créée par la règle elle-même**.
  2. L'artiste oublie de mettre à jour une œuvre vendue ailleurs il y a trois semaines. Le PRD n'a aucun mécanisme de reconfirmation (rien ne vérifie que la disponibilité est encore vraie).
  3. Le PRD qualifie d'annulation ce qui est en fait une double vente. SM-C1 ne la compte donc pas. Le garde-fou n'est pas mesuré : le PRD ne dit nulle part si une annulation après une vente hors site compte comme double vente.
- **Correction proposée :**
  - Définir la double vente comme « deux engagements, en ligne ou hors site, sur une même œuvre », et faire compter les annulations pour vente hors site dans SM-C1, ou dans un SM-C1b séparé.
  - Permettre à l'artiste de signaler « vendue ailleurs » même sur une œuvre `réservée`. Ce signal bloque la confirmation, ou déclenche un remboursement automatique avant tout engagement.
  - Ajouter une FR de reconfirmation périodique de la disponibilité (par exemple tous les 30 jours, sinon l'œuvre passe en `retirée`), et une **reconfirmation par l'artiste avant la confirmation définitive** si le montage le permet (encaissement différé).
  - Mettre l'accord artiste (OQ-10) en lien avec une obligation contractuelle de mise à jour.

### C-3. Les FR « valables quel que soit le montage » présupposent un checkout intégré à notification serveur (FR-12, FR-13, FR-14)

- **Emplacement :** §4.3 (description), FR-12, FR-13, FR-14, OQ-12.
- **Citation :** « Les exigences ci-dessous valent quel que soit ce montage » ; « uniquement après la confirmation du paiement par le prestataire, reçue côté serveur » ; « Une réservation expirée est libérée automatiquement » ; « La durée de réservation est un paramètre. [environ 30 min] ».
- **Scénarios d'échec :**
  - Option R4 / OQ-12, que le PRD garde ouverte : un lien de paiement est envoyé par WhatsApp. L'acheteur paie trois heures plus tard. La réservation de 30 minutes a expiré et l'œuvre a pu être vendue à un autre. Avec un lien manuel, il n'existe pas forcément de notification serveur rattachée à la commande. FR-13 ne peut donc pas être satisfaite.
  - Moyens de paiement asynchrones (virement, paiement différé, 3-D Secure lent) : la confirmation arrive après l'expiration de la réservation, et l'œuvre est payée deux fois.
  - Encaissement par une entité tierce (au Royaume-Uni, OQ-1) : le webhook n'arrive pas nécessairement dans l'application Errancy.
- **Correction proposée :**
  - Reformuler FR-12 et FR-13 en invariants indépendants du canal :
    - « une œuvre ne peut être engagée que par une seule commande à la fois » ;
    - « un paiement reçu sur une œuvre déjà engagée est remboursé automatiquement et signalé » ;
    - la confirmation peut venir d'une notification du prestataire **ou d'une validation manuelle tracée par l'équipe** ;
    - la durée de réservation dépend du canal (environ 30 min en paiement intégré, quelques heures à 48 h pour un lien).
  - Ajouter FR-12 et FR-13 à la liste « Bloquant pour » de OQ-1, ou en tout cas à la liste « dépend partiellement de ».

---

## High

### H-1. Le panier multi-œuvres et multi-artistes présuppose un paiement fractionné (FR-10, FR-11, glossaire « Commande »)

- **Emplacement :** glossaire (« achat confirmé d'une ou plusieurs œuvres »), FR-10, FR-11, FR-12.
- **Citation :** « Commande : achat confirmé d'une ou plusieurs œuvres par un acheteur » ; « pour chaque œuvre : … l'artiste ».
- **Scénario d'échec :** l'acheteur prend deux œuvres de deux artistes, dans deux pays. Comme l'artiste est le vendeur, une seule transaction implique deux vendeurs. Cela exige un paiement fractionné (Connect), ou un encaissement pour le compte de tiers par Errancy, c'est-à-dire exactement ce qu'OQ-1 n'a pas tranché. Autres conséquences : remboursement partiel si un seul artiste n'expédie pas, deux suivis, deux délais de retour. Les états de la commande (glossaire) sont globaux, alors que l'expédition se fait par artiste.
- **Correction proposée :** au MVP, une commande = une œuvre (ou un seul artiste), ou bien faire de la « commande par artiste » (sous-commande) l'unité d'état, d'expédition et de remboursement. Placer la décision « panier multi-vendeurs » sous OQ-1.

### H-2. Aucune FR pour la livraison constatée, le retour, le remboursement et la clôture (trou dans le parcours d'achat)

- **Emplacement :** glossaire (états `livrée`, `close`, `annulée`, `retournée`), UJ-3, FR-15, FR-22, FR-26.
- **Citation :** « la commande passe à « livrée », ce qui ouvre le délai de retour de 14 jours » ; FR-26 : « Elle peut annuler une commande en indiquant un motif ».
- **Scénario d'échec :** aucune FR ne dit qui passe la commande en `livrée` (l'artiste ? le transporteur ? l'acheteur ? l'admin ?), ni comment l'acheteur déclare un retour ou une casse, ni comment un remboursement est déclenché, ni quand la commande passe en `close`. Ce sont pourtant les états qui déclencheront le reversement à l'artiste (addendum §B : « livraison plus 14 jours »). L'UX n'a aucun écran à concevoir pour l'après-vente, et l'architecture n'a aucune transition à modéliser. FR-26 « annuler » ne dit rien du remboursement.
- **Correction proposée :** ajouter des FR pour :
  - la constatation de livraison (source de vérité, et un fallback manuel) ;
  - la demande de retour, de casse ou de litige par l'acheteur (depuis le lien de suivi de FR-15) ;
  - le traitement par l'admin et le remboursement (dont la mécanique est bloquée par OQ-1, mais dont l'existence et les états ne le sont pas) ;
  - le passage en `close`.
  
  Donner une machine à états complète, avec les acteurs autorisés pour chaque transition.

### H-3. « Prix total livré » faux à l'international : droits, taxes d'import et devise (FR-3, UJ-1, NFR-8)

- **Emplacement :** UJ-1 étape 3, glossaire « Prix total », FR-3, NFR-8, OQ-5, OQ-6.
- **Citation :** « le prix total, livraison au Canada comprise, en dollars canadiens » ; « C'est le montant que l'acheteur paie » ; NFR-8 : « sans les livrer [d'autres devises] dans le MVP ».
- **Scénarios d'échec :**
  - Yasmine paie le « prix total », puis le transporteur lui réclame à la porte la TPS/TVH et des frais de dédouanement. L'œuvre est refusée, renvoyée, abîmée. C'est exactement le motif de déception relevé dans l'addendum §C. Le prix total exclut implicitement droits et taxes (incoterm DAP ou DDP non tranché, OQ-5 très en dessous de son importance).
  - UJ-1 affiche des CAD alors que NFR-8 exclut le multidevise : contradiction directe, qui se propagera dans l'UX.
  - Les artistes de tous pays fixent leur prix et leurs frais dans quelle devise ? Le PRD ne le dit pas.
- **Correction proposée :**
  - Ajouter au glossaire « Prix total » la mention explicite « hors droits et taxes d'importation, signalés sur la fiche », ou bien en faire une question ouverte bloquante (DDP).
  - Ajouter une FR d'affichage obligatoire « droits et taxes d'import éventuels à la charge de l'acheteur » tant que OQ-5 n'est pas tranché.
  - Mettre UJ-1 en cohérence avec NFR-8 (EUR seul, ou devise indicative marquée comme telle), et fixer la devise de saisie de l'artiste.

### H-4. La politique de retour de 14 jours est affirmée alors qu'elle est ouverte, et son cadre juridique est mal borné (FR-5, FR-23, UJ-3, §10)

- **Emplacement :** FR-5, FR-11, FR-23, UJ-3, §10, OQ-4.
- **Citation :** FR-5 : « la politique de retour (14 jours) » ; UJ-3 : « « livrée », ce qui ouvre le délai de retour » ; §10 : « Droit de rétractation de 14 jours pour les acheteurs de l'UE, ou un équivalent selon le pays ».
- **Problèmes :**
  - FR-5 promet 14 jours sur chaque fiche, alors qu'OQ-4 (gratuit ou avoir, qui paie le retour) est ouverte.
  - La rétractation légale de l'UE n'existe que si le **vendeur est un professionnel**. Ici le vendeur est l'artiste, qui peut être un particulier ou un professionnel hors UE. Le PRD ne distingue pas rétractation légale et politique commerciale. Il ne prévoit pas non plus l'obligation des places de marché d'indiquer si le vendeur est professionnel ou non (directive Omnibus).
  - La traçabilité des vendeurs professionnels (DSA, art. 30) et la déclaration DAC7 des revenus des vendeurs ne sont pas mentionnées, alors que les acheteurs et une partie des artistes sont dans l'UE.
  - La sortie des biens culturels du pays de l'artiste (export d'œuvres d'art, par exemple depuis le Maroc) n'est pas bornée.
- **Scénario d'échec :** une CGV rédigée d'après FR-23 promet un droit que l'artiste particulier n'est pas tenu d'honorer, ou en promet un qu'Errancy finance sans le vouloir. Un acheteur de l'UE retourne une toile de 2 400 € depuis le Canada : personne n'a défini qui paie, et la promesse affichée sur la fiche engage Errancy.
- **Correction proposée :**
  - Sur la fiche, afficher « conditions de retour » avec un contenu dépendant d'OQ-4, et non « 14 jours » en dur.
  - En §10, séparer « rétractation légale (dépend du statut du vendeur) » et « politique commerciale Errancy ».
  - Ajouter le statut professionnel ou particulier de l'artiste au dépôt (FR-20) et à la fiche.
  - Ajouter DSA, DAC7 et export de biens culturels à la liste des points soumis à l'avis juridique (OQ-1 ou une nouvelle OQ).

### H-5. Désintermédiation : le PRD met acheteur et artiste en contact direct sans aucun garde-fou (FR-8, UJ-4, NFR-5)

- **Emplacement :** UJ-4, FR-8 (visite « avec l'artiste », « en atelier »), NFR-5 (adresse transmise à l'artiste), FR-22, §11.
- **Citation :** « un créneau en visioconférence avec l'artiste » ; « en atelier si l'artiste l'accepte ».
- **Scénario d'échec :** Thomas visite l'atelier, et l'artiste lui propose le même tableau à -20 % en direct. Errancy perd 30 % sur ses ventes les plus chères, précisément celles qui passent par la visite. Pour l'artiste, qui « vend aussi ailleurs », c'est un réflexe naturel. Le risque n'est pas dans §11 et aucun indicateur ne le voit, puisque la vente n'existe pas pour Errancy.
- **Correction proposée :** ajouter le risque en §11. Exiger, dans l'accord artiste (OQ-10), une clause de non-contournement pour les acheteurs présentés par Errancy. Faire de la présence d'un conseiller Errancy la règle par défaut des visites. Mesurer les visites sans commande dans un délai de 60 jours.

### H-6. Indicateurs impossibles à mesurer ou biaisés (SM-1, SM-2, SM-3, SM-C3, FR-27, FR-28)

- **Emplacement :** §8, FR-27, FR-28.
- **Problèmes :**
  - **SM-2** : le numérateur (commandes en base) est exhaustif, mais le dénominateur (« visiteurs ») ne compte que ceux qui ont consenti au traçage (FR-27, NFR-6). Le taux est donc gonflé, de manière variable selon les pays. « Visiteur » n'est pas défini (appareil, cookie, session). Les ventes par lien WhatsApp (OQ-12) sortent du tunnel.
  - **SM-1** : « acheteur extérieur au cercle du porteur et des artistes » n'est pas vérifiable. Un délai de 12 semaines, plus 16 jours de livraison, plus 14 jours de retour, rend l'objectif inatteignable si la première vente a lieu après la semaine 6 environ. Le point de départ est inconnu (OQ-11).
  - **SM-3** : « vérifier l'hypothèse que la diaspora préfère WhatsApp ». Aucune donnée collectée n'identifie la diaspora, et aucune comparaison avec un autre canal n'est prévue.
  - **SM-C3** : un lien `wa.me` ne remonte aucune donnée. Mesurer le délai réel de réponse exige WhatsApp Business (application ou API) et une saisie, et aucune FR ne le prévoit.
  - **FR-28** : rattacher une commande à « un conseil WhatsApp » suppose un identifiant de conversation qui n'existe nulle part. Le rattachement manuel ne sera ni exhaustif ni auditable.
  - **FR-27** : « source d'arrivée » n'est pas définie (UTM ? référent ? premier ou dernier contact ?). Des événements importants manquent : vue d'une œuvre réservée ou vendue, « Me prévenir », pays non livré, réservation refusée, paiement échoué ou abandonné.
  - **SM-5** « sert à suivre la marge contributive » : la marge dépend d'OQ-3 et des frais de paiement, et n'est pas définie.
- **Correction proposée :**
  - SM-2 : ne compter au dénominateur que les sessions mesurées et rapporter seulement les commandes de ces sessions, ou bien utiliser des métriques côté serveur sans cookie.
  - SM-1 : retenir comme jalon « première commande payée et livrée », et suivre « sans litige à J+14 » comme critère distinct.
  - SM-3 : ajouter le pays déclaré de l'acheteur et le pays de l'artiste.
  - SM-C3 et FR-28 : une FR d'enregistrement des conversations (au minimum : horodatage du premier message, de la première réponse, et slug de l'œuvre), choisie selon OQ-7.
  - FR-27 : définir les règles d'attribution et compléter la liste des événements.

### H-7. Les blocages d'OQ-1 sont sous-déclarés (§9 OQ-1 contre §4)

- **Emplacement :** OQ-1 « Bloquant pour », FR-3, FR-10, FR-11, FR-12, FR-13, FR-15, FR-26, FR-23.
- **Citation :** « Bloquant pour : FR-14, l'identité de l'exploitant dans FR-23, et le reversement aux artistes. »
- **Scénario d'échec :** l'architecture et les epics croient pouvoir livrer FR-10 à FR-13 et FR-26 sans OQ-1. En réalité, chacune en dépend :
  - devise et montant demandé (FR-3, FR-11) ;
  - source de la confirmation (FR-13) ;
  - panier multi-vendeurs (FR-10) ;
  - remboursement en cas d'annulation (FR-26, UJ-2) ;
  - données à transmettre au prestataire, et KYC de l'artiste au dépôt (FR-20, que le PRD omet).
  
  Résultat probable : du travail refait dès que le montage est tranché.
- **Correction proposée :** pour chaque FR, ajouter une colonne « indépendante, dépend partiellement, ou bloquée » par rapport à OQ-1. Ajouter à FR-20 « informations de versement et vérification d'identité de l'artiste : contenu selon OQ-1 », et la marquer comme dépendante.

### H-8. Affirmation concurrentielle dangereuse : « Aucun concurrent étudié n'offre ce conseil humain direct » (§1)

- **Emplacement :** §1 ; addendum §C.
- **Citation :** « Aucun concurrent étudié n'offre ce conseil humain direct ; c'est la différence qu'Errancy peut revendiquer dès le lancement. »
- **Scénario d'échec :** Saatchi Art et Singulart proposent publiquement des conseillers en art gratuits. L'addendum §C ne parle d'ailleurs que d'une « différenciation possible » par « suivi humain par WhatsApp ». Si la proposition de valeur et le message marketing s'appuient sur une exclusivité fausse, l'argument tombe au premier contact, et l'investissement en personnel (OQ-11, inconnu) repose sur une prémisse non vérifiée.
- **Correction proposée :** reformuler en « conseil humain direct et immédiat par WhatsApp, avec délai annoncé », à revérifier dans la source. Faire de la valeur du conseil une hypothèse testée par SM-3, et non un acquis.

---

## Medium

### M-1. Champs nécessaires aux filtres et aux fiches absents du dépôt (FR-17, FR-3, FR-8 contre FR-20)

- **Citation :** FR-17 : « couleur dominante ; format ; orientation » ; glossaire « plus le cadre s'il est proposé ».
- **Problème :** FR-20 ne demande ni couleur dominante, ni format, ni orientation, ni cadre, ni acceptation des visites en atelier. Le filtre « prix total » dépend du pays du visiteur (calcul par œuvre et par zone). Le cadre est inclus dans le prix total, mais le « cadrage premium » est hors MVP et aucune FR ne décrit l'option cadre.
- **Correction proposée :** compléter FR-20 avec ces champs. Définir « format » (seuils en cm). Dire si le cadre est au MVP (et si oui, ajouter une FR) ou le retirer du glossaire. Préciser que le filtre de prix utilise le pays choisi.

### M-2. Le délai d'expédition de 48 h contredit le délai de préparation déclaré par l'artiste (UJ-3, FR-26 contre FR-4, FR-20)

- **Citation :** « confirmé l'expédition sous 48 h » ; « signalée … [48 h] » ; FR-20 : « le délai de préparation ».
- **Scénario d'échec :** l'artiste déclare 7 jours de préparation (encadrement, séchage). Chaque commande est signalée en retard au bout de 48 h, et les alertes deviennent du bruit.
- **Correction proposée :** distinguer la confirmation de prise en charge par l'artiste (48 h) et l'expédition (avant la fin du délai de préparation déclaré). Signaler chacune par rapport à son propre seuil.

### M-3. FR non testables ou ambiguës

- **FR-21 « visible immédiatement »** : avec le cache ou l'ISR de Next.js, rien n'est « immédiat ». Fixer un seuil (par exemple 60 s, et un `Acheter` toujours refusé côté serveur dès le changement).
- **FR-6 « sans faire défiler l'écran sur mobile »** : quelle taille d'écran ? Fixer une référence (par exemple 360×640) et une règle (barre d'actions fixe).
- **FR-2 « photos prises en lumière du jour »** : impossible à vérifier automatiquement. Le transformer en critère de curation (FR-25) avec une liste de contrôle.
- **FR-18 « en un clic »** et **NFR-1 « vite »** : déjà marqués comme hypothèses, mais à chiffrer avant l'architecture.
- **SM-4 « tous les champs de FR-1 à FR-5 »** : FR-5 contient des liens et l'état de disponibilité, qui sont toujours présents. Lister les champs exacts.

### M-4. Réservation d'un panier multi-œuvres et partiellement réservable non spécifiée (FR-12)

- **Citation :** « chaque œuvre de la commande passe en `réservée` ».
- **Scénario d'échec :** sur deux œuvres, une est déjà réservée. Le PRD ne dit pas si le paiement est bloqué pour tout le panier, ni si l'œuvre disponible reste bloquée pendant 30 minutes pour rien. Autre cas : une réservation abandonnée en boucle (un concurrent qui bloque des œuvres), que rien ne limite.
- **Correction proposée :** réservation tout ou rien, message explicite, limite du nombre de réservations par e-mail ou appareil, journal des réservations dans FR-26.

### M-5. Transfert de données personnelles vers des artistes hors UE (NFR-5, NFR-6)

- **Citation :** « pour la livraison, à l'artiste concerné ».
- **Problème :** les adresses d'acheteurs de l'UE sont transmises à des artistes de tous pays. Il s'agit d'un transfert hors UE au sens du RGPD (chapitre V), avec un rôle (responsable ou sous-traitant) non défini. Aucune durée de conservation ni procédure de purge n'est prévue.
- **Correction proposée :** l'ajouter à §10. Prévoir dans l'accord artiste une clause de protection des données. Ne rendre l'adresse visible à l'artiste que pendant la fenêtre d'expédition.

### M-6. Fraude, rétrofacturations et litige « non reçu » absents des risques (§11)

- **Problème :** le paiement sans compte de biens uniques à forte valeur, expédiés à l'international par un tiers, est un profil classique de fraude. L'acheteur peut contester un paiement après une livraison réelle, et rien ne dit qui supporte le coût (artiste, Errancy, entité d'encaissement). Aucune exigence de preuve de livraison (signature, assurance) n'est formulée.
- **Correction proposée :** ajouter le risque. Exiger un suivi avec preuve de livraison au-delà d'un seuil de prix (dans FR-20 ou FR-22). Rattacher la question de qui supporte une rétrofacturation à OQ-2 et OQ-3.

### M-7. Le lien de suivi sans compte est une surface d'exposition (FR-15)

- **Citation :** « grâce au lien envoyé par e-mail, sans compte ».
- **Scénario d'échec :** un lien devinable (identifiant séquentiel, slug) expose l'adresse et le nom. Le rattachement à un compte créé après coup (FR-10) n'est pas spécifié.
- **Correction proposée :** jeton aléatoire non devinable, données minimales affichées, expiration, rattachement par e-mail vérifié.

### M-8. La baseline mesure un site déjà transformé (§4.8, §6.1, §8)

- **Citation :** « avant de changer quoi que ce soit, Errancy mesure son tunnel de vente » contre « La baseline est relevée dès la sortie de maintenance » (avec le Lot 1 déjà livré).
- **Problème :** il n'existe aucun « avant » mesurable : le site est en maintenance et le catalogue est fictif. La baseline mesurera le Lot 1. Elle ne permet donc pas de valider l'hypothèse centrale (« lever les doutes fait vendre »), et SM-2 « Valide FR-1 à FR-13 » ne peut rien attribuer.
- **Correction proposée :** assumer que la baseline est celle du Lot 1. Prévoir des tests A/B ou des déploiements progressifs (par exemple prix total affiché ou non, présence ou non du bouton WhatsApp) pour attribuer les effets. Retirer « Valide FR-x » des métriques globales.

### M-9. États de disponibilité incomplets (FR-6, FR-3, FR-9, glossaire)

- **Problème :**
  - FR-6 ne traite pas `retirée` (page 404 ? redirection 301 pour le référencement, NFR-2 ?).
  - FR-3 traite le pays non desservi, mais pas l'œuvre sans aucune zone.
  - FR-9 notifie tous les inscrits en même temps quand une réservation expire, ce qui peut créer une course à l'achat et des déceptions.
  - Le cas « vendue hors site » n'a pas d'état distinct de « vendue » en ligne, alors qu'il en faut un pour mesurer SM-C1 (C-2).
- **Correction proposée :** compléter la matrice état × affichage × action. Ajouter un état ou un motif `vendue_hors_site`.

---

## Low

### L-1. FR-19 contredit la source stratégique

- **Citation :** FR-19 « Le contenu est fourni par l'artiste » contre `docs/strategie-refonte.md` : « Pages artistes … MVP (gérées par Errancy) ».
- **Correction proposée :** citer la contradiction dans OQ-14 et retenir par défaut la source (géré par Errancy).

### L-2. Le §1 mélange constats et hypothèses

- **Citation :** « Aujourd'hui, personne ne peut acheter. `[ASSUMPTION]` ».
- **Problème :** la maintenance et le catalogue de démonstration sont des faits sourcés (`decisions-porteur.md` l.42). Le marqueur d'hypothèse dévalue ces faits.
- **Correction proposée :** marquer seulement les freins 3 à 6.

### L-3. OQ-7 est bloquante pour le différenciateur principal, sans plan de repli

- **Problème :** si aucun répondant n'est trouvé, FR-7 (et OQ-12, qui repose aussi sur WhatsApp) tombent.
- **Correction proposée :** prévoir un repli (formulaire de contact avec délai annoncé), ou masquer le bouton en dehors des heures de service.

### L-4. UJ-4 suppose la disponibilité de l'artiste pour des visios, sans moyen de la connaître

- **Problème :** FR-8 ne dit pas qui confirme le créneau, ni dans quel délai.
- **Correction proposée :** ajouter un accusé avec délai de réponse et un état de la demande (nouvelle, planifiée, faite, sans suite) dans FR-25.

### L-5. Le glossaire « Équipe Errancy = rôle `admin` » ignore les profils

- **Problème :** curation, conseil et suivi sont fusionnés en un seul rôle, alors que NFR-5 restreint l'accès aux données acheteurs. Un conseiller WhatsApp n'a pas besoin d'annuler des commandes.
- **Correction proposée :** le noter comme évolution possible. Le garder hors MVP si l'équipe est d'une seule personne (OQ-11).
