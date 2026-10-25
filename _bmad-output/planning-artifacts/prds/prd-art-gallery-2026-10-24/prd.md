---
title: "PRD — Refonte d'Errancy"
status: final
created: 2026-10-24
updated: 2026-10-25
---

# PRD — Refonte d'Errancy

*Brouillon rédigé en voie rapide, puis corrigé après la réconciliation avec les sources et deux relectures. Les points déduits sans confirmation du porteur sont marqués `[ASSUMPTION]` et repris en §13.*

## 0. Objet du document

Ce PRD décrit ce que la refonte d'Errancy doit permettre, dans l'ordre fixé par la stratégie : **convertir d'abord**, différencier ensuite, diversifier enfin. Il s'adresse au porteur du projet, qui le valide, et aux étapes BMAD suivantes : UX (`bmad-ux`), architecture (`bmad-architecture`), puis découpage en epics et stories.

Il s'appuie sur :
- `docs/strategie-refonte.md` : stratégie et audit ;
- `docs/decisions-porteur.md` : décisions du porteur ;
- `docs/analyse-projet.md` : état technique ;
- deux études dans `_bmad-output/planning-artifacts/research/` : fiches œuvres et confiance de l'acheteur, paiement en place de marché.

Le vocabulaire est fixé par le glossaire (§3). Les exigences fonctionnelles (FR) sont numérotées une fois pour toutes et rangées par fonctionnalité. Les détails techniques, les options écartées et les rapports de relecture sont dans `addendum.md` et dans les fichiers `review-*.md` et `reconcile-*.md` de ce dossier.

**Le montage de paiement n'est pas tranché.** Il attend un avis juridique marocain (`docs/decisions-porteur.md` l.17). Ce PRD le traite comme une question ouverte (§10, OQ-1). Toutes les exigences sont écrites pour rester valables, que l'encaissement se fasse par paiement intégré, par lien de paiement ou par virement. Celles qui dépendent du montage sont marquées **« Bloqué par OQ-1 »**. La stratégie demande que ce choix soit fait avant l'architecture (`docs/strategie-refonte.md` l.137 et l.158) : `bmad-architecture` peut traiter tout le reste, mais pas le module d'encaissement et de reversement.

## 1. Vision

Errancy veut devenir une **galerie-curatrice digitale**, et non une boutique de tableaux parmi d'autres. Concrètement :
- une sélection resserrée ;
- des artistes mis en valeur ;
- des prix transparents ;
- un accompagnement humain.

Errancy est une place de marché : l'artiste vend son œuvre via le site et l'expédie lui-même ; Errancy perçoit une commission de 30 %. Les acheteurs visés sont internationaux, en particulier la diaspora, et les artistes viennent de tous pays. Seuls les artistes choisis par Errancy sont publiés. Cette sélection est elle-même un gage de sérieux et doit se voir.

Acheter une œuvre originale à distance est un pari pour l'acheteur. L'hypothèse centrale de la refonte est que **lever ses doutes est le premier levier de vente**. Partout sur le site, et d'abord sur la fiche œuvre, l'acheteur doit pouvoir répondre seul à quatre questions :
- *Ira-t-elle chez moi ?*
- *Est-elle trop petite ?*
- *Est-elle trop chère ?*
- *Est-ce sérieux ?*

Quand il hésite encore, une personne d'Errancy doit pouvoir lui répondre, avant comme après la vente. Les concurrents étudiés proposent aussi des conseillers, par chat, formulaire ou téléphone. Ce qui distingue Errancy, c'est un conseil **par WhatsApp**, canal que la diaspora utilise déjà au quotidien, **avec un délai de réponse annoncé**. S'y ajoutent des couleurs fidèles et des délais exacts. Cette différenciation reste à confirmer par la mesure (SM-3).

Aujourd'hui, personne ne peut acheter. Deux causes sont des faits constatés :
1. le site est en maintenance ;
2. le catalogue n'est qu'une démonstration.

Les sources en suggèrent quatre autres, à confirmer `[ASSUMPTION]` :
3. les fiches n'indiquent ni le prix total, ni le délai, ni l'échelle, ni le certificat ;
4. le panier exige un compte ;
5. il n'existe aucun canal de conseil ;
6. rien n'est mesuré.

La refonte améliore le site existant par étapes, avec retour arrière possible, sans changer de pile.

## 2. Utilisateurs cibles

### 2.1 Besoins à satisfaire (Jobs To Be Done)

**Acheteur**
- Trouver une œuvre qui correspond vraiment à son espace, à son goût et à son budget.
- Être sûr, avant de payer, de la taille réelle, du prix total et du délai total.
- Pouvoir demander l'avis d'une personne avant un achat important, et savoir où en est sa commande après.
- Savoir que l'œuvre est authentique, et qu'un recours existe si elle arrive abîmée ou ne lui convient pas.

**Acheteur de la diaspora**
- Se sentir proche des artistes de son pays d'origine et les soutenir, depuis le pays où il vit.

**Artiste**
- Vendre à l'international sans gérer de boutique.
- Garder la main sur la disponibilité de ses œuvres, qu'il vend aussi ailleurs.
- Être présenté avec sérieux.
- Toucher plus que chez les concurrents : Errancy prend 30 % de commission, les concurrents de 30 à 50 %.

**Équipe Errancy**
- Choisir les œuvres publiées.
- Suivre chaque commande jusqu'à sa clôture.
- Répondre vite aux demandes de conseil.
- Mesurer ce qui fait vendre et ce que rapporte chaque vente.

### 2.2 Hors cible du MVP

- **Acheteurs de décoration à petit prix.** Errancy s'inspire de la clarté de Massinart sans devenir une boutique de décoration.
- **Clients professionnels** (location B2B), commandes sur mesure, abonnements : ce sont des pilotes ultérieurs.
- **Artistes non sélectionnés** : la place de marché est réservée aux artistes choisis par Errancy.
- **Acheteurs de reproductions ou d'éditions** : aucune ne sera vendue sans autorisation écrite des ayants droit, et pas dans le MVP.

### 2.3 Parcours clés

*Les personnages ont été construits à partir des sources. Le porteur peut les remplacer par des cas réels* `[ASSUMPTION]`*.*

- **UJ-1. Yasmine achète, depuis Montréal, un tableau pour son salon.**
  - **Profil et contexte :** Yasmine, 38 ans, d'origine marocaine, vit à Montréal. Elle cherche une grande toile d'un artiste marocain pour le mur au-dessus de son canapé.
  - **Point de départ :** elle arrive sur une fiche œuvre depuis un partage Instagram, sur mobile, sans compte.
  - **Parcours :**
    1. Elle voit la photo de l'œuvre accrochée près d'un fauteuil, qui donne l'échelle. Elle lit ensuite l'histoire courte de l'œuvre.
    2. Elle consulte les dimensions, affichées en pouces et en cm.
    3. Elle voit le prix total, livraison au Canada comprise, avec la mention « hors droits et taxes d'import éventuels ».
    4. Elle voit le délai total : « livrée sous 12 à 16 jours ».
    5. Elle hésite sur les couleurs. Elle touche « Conseil WhatsApp » : un message s'ouvre, déjà rempli avec la référence de l'œuvre. Une conseillère lui répond dans le délai annoncé, avec une photo prise en lumière du jour.
  - **Moment clé :** elle revient sur la fiche, touche « Acheter » et commande sans créer de compte.
  - **Résolution :**
    1. Elle reçoit une confirmation avec le délai.
    2. Elle reçoit ensuite le numéro de suivi saisi par l'artiste.
    3. À la livraison, elle a un moyen simple de signaler un problème.
  - **Cas limite :** quelqu'un a commencé à acheter la même œuvre juste avant elle. La fiche indique « réservée » et lui propose d'être prévenue si l'œuvre redevient disponible.
- **UJ-2. Karim, peintre à Essaouira, met une œuvre en vente, puis la vend à l'atelier.**
  - **Profil et contexte :** Karim vend aussi dans son atelier et sur un salon.
  - **Point de départ :** il a reçu une invitation d'Errancy et s'est connecté à son espace artiste.
  - **Parcours :**
    1. Il dépose une œuvre avec trois photos en lumière du jour et un gros plan.
    2. Il renseigne les dimensions, la couleur dominante, ainsi que les frais et délais d'expédition pour trois zones de livraison.
    3. Il s'engage à fournir un certificat signé et un emballage conforme.
    4. L'équipe Errancy valide la fiche œuvre, qui est publiée.
    5. Un mois plus tard, il vend l'œuvre à l'atelier et la passe en « vendue ailleurs » depuis son téléphone.
  - **Moment clé :** en moins d'une minute, l'œuvre n'est plus achetable sur Errancy.
  - **Cas limite :** un acheteur était en train de payer cette œuvre sur Errancy.
    1. La réservation est annulée.
    2. L'acheteur est prévenu et n'est pas débité, ou il est remboursé (FR-31).
    3. L'incident est compté dans SM-C1.
- **UJ-3. Salma, de l'équipe Errancy, suit une commande jusqu'à sa clôture.** `[ASSUMPTION : personnage]`
  - **Parcours :**
    1. Salma reçoit l'alerte « nouvelle commande ».
    2. Elle vérifie que l'artiste a confirmé la disponibilité de l'œuvre et la prise en charge sous 48 h `[ASSUMPTION : délai]`.
    3. Elle vérifie ensuite que l'expédition a eu lieu avant la fin du délai de préparation déclaré par l'artiste.
    4. Elle voit apparaître le numéro de suivi, puis la livraison constatée.
  - **Résolution :** la commande est close une fois le délai de retour passé sans réclamation. La somme due à l'artiste devient alors exigible (FR-32).
- **UJ-4. Thomas, à Lyon, demande une visite avant de se décider.**
  - **Point de départ :** Thomas hésite sur une œuvre à 2 400 €.
  - **Parcours :**
    1. Sur la fiche, il touche « Réserver une visite ».
    2. Il propose des créneaux pour une visite à distance, en visioconférence avec un conseiller ou avec l'artiste. Il n'y a pas de showroom.
    3. L'équipe Errancy confirme le créneau dans le délai annoncé.
  - **Moment clé :** après l'appel, l'équipe Errancy réserve l'œuvre pour lui pendant 48 h `[ASSUMPTION]` et lui envoie le lien pour commander.

## 3. Glossaire

- **Œuvre** : pièce originale et unique proposée à la vente par un artiste. Une œuvre a une fiche œuvre et un seul artiste. Elle est identifiée par son slug.
- **Fiche œuvre** : page publique d'une œuvre (`/galerie/...`).
- **Artiste** : vendeur de l'œuvre. Il expédie l'œuvre et gère sa disponibilité, depuis un espace artiste ouvert sur invitation d'Errancy.
- **Acheteur** : personne qui passe une commande, avec ou sans compte.
- **Visiteur** : personne qui consulte le site, sans forcément acheter.
- **Équipe Errancy** : personnes ayant le rôle `admin`. Elles s'occupent de la curation, du conseil et du suivi des commandes.
- **Curation** : validation d'une œuvre par l'équipe Errancy avant sa publication, selon une liste de contrôle.
- **Disponibilité** : état d'une œuvre. Elle peut être :
  - `disponible` ;
  - `réservée` ;
  - `vendue`, sur Errancy ;
  - `vendue ailleurs`, hors du site, déclarée par l'artiste ;
  - `retirée` : sortie de la vente par l'artiste ou par l'équipe.
- **Réservation** : blocage temporaire d'une œuvre au profit d'un acheteur. Elle naît de deux façons :
  - l'acheteur commence à payer ;
  - l'équipe la pose pour une vente assistée.

  Elle a une échéance, et elle expire si la commande n'est pas confirmée à temps.
- **Panier** : sélection d'œuvres, éventuellement de plusieurs artistes, validée par l'acheteur en un seul passage en caisse. Un panier donne une commande par artiste.
- **Commande** : achat d'une ou plusieurs œuvres d'**un seul artiste** par un acheteur. Elle a son expédition, son suivi, ses retours et sa somme due à l'artiste. Elle passe par les états suivants :
  - `en attente de paiement` ;
  - `confirmée` ;
  - `prise en charge` ;
  - `expédiée` ;
  - `livrée` ;
  - `close`.

  Elle peut aussi finir `annulée` ou `retournée`.
- **Zone de livraison** : groupe de pays pour lequel l'artiste fixe des frais et un délai d'expédition.
- **Prix total** : prix de l'œuvre plus frais de livraison vers le pays de l'acheteur. Les droits et taxes d'import éventuels ne sont pas inclus, et la mention l'indique. Qui paie la livraison, et si elle entre dans l'assiette de la commission, reste ouvert (OQ-3, OQ-5).
- **Délai total** : délai de préparation par l'artiste plus délai de transport vers le pays de l'acheteur.
- **Conseil WhatsApp** : conversation WhatsApp entre un visiteur ou un acheteur et l'équipe Errancy, ouverte depuis le site.
- **Demande de visite** : demande de rendez-vous à distance, ou en atelier si l'artiste l'accepte, envoyée depuis une fiche œuvre.
- **Certificat d'authenticité** : document signé par l'artiste et remis avec l'œuvre.
- **Commission** : part de 30 % qui revient à Errancy sur chaque vente. Son assiette n'est pas encore fixée (OQ-3).
- **Somme due à l'artiste** : montant de la vente moins la commission. Elle devient exigible à la clôture de la commande. Le moyen de la verser dépend de OQ-1.
- **Montage de paiement** : choix de l'entité qui encaisse, des prestataires et du mode de reversement aux artistes. Il n'est pas tranché (OQ-1).
- **Baseline** : première mesure du tunnel de vente, qui sert de référence aux objectifs chiffrés.
- **Marge contributive** : encaissement moins les coûts variables d'une vente. Pour une place de marché, on part de la commission et on retire les frais de paiement, les coûts d'acquisition et les coûts pris en charge par Errancy.

## 4. Fonctionnalités

### 4.1 Une fiche œuvre qui lève les doutes

**Description :** chaque fiche œuvre répond aux quatre questions sans que l'acheteur ait à demander : l'échelle, le prix total, le délai total et le sérieux. Elle raconte aussi l'œuvre en quelques lignes, et propose des actions adaptées à la disponibilité. C'est le cœur de « convertir d'abord ». Réalise UJ-1 et UJ-4.

#### FR-1 : Dimensions et format lisibles

Le visiteur voit les dimensions de l'œuvre en cm et en pouces, son orientation et son format (petit, moyen ou grand). Réalise UJ-1.

**Conséquences testables :**
- Les deux unités s'affichent ensemble sur toutes les fiches publiées.
- Les seuils de format sont fixés par l'équipe Errancy.
- Une œuvre sans dimensions ne peut pas être soumise à la curation (FR-20).

#### FR-2 : Photos qui donnent l'échelle et la matière

Le visiteur voit au moins :
- une photo de mise en situation avec un repère d'échelle (un meuble ou une personne) ;
- un gros plan ;
- une photo prise en lumière du jour.

Réalise UJ-1.

**Conséquences testables :**
- La présence de ces photos et leur fidélité de couleur sont vérifiées en curation, selon une liste de contrôle (FR-25).
- Les photos sont optimisées pour le mobile (NFR-1).

**Hors périmètre :** le simulateur mural et la visualisation « dans votre pièce » (§6.2).

#### FR-3 : Prix total pour le pays du visiteur

Le visiteur voit le prix total pour son pays avant d'ajouter l'œuvre au panier. Le prix est affiché en euros et mentionne que les droits et taxes d'import éventuels ne sont pas inclus. Réalise UJ-1.

**Conséquences testables :**
- Le pays de livraison est proposé d'office, et le visiteur peut le changer. `[ASSUMPTION]` (OQ-13)
- Pour un même pays, le prix total affiché est égal au montant demandé à la commande.
- Si l'artiste ne livre pas le pays choisi, la fiche le dit. Elle propose alors le Conseil WhatsApp au lieu du bouton « Acheter ».
- La devise affichée suit OQ-6 : en attendant, c'est l'euro.

#### FR-4 : Délai total annoncé

Le visiteur voit le délai total de livraison vers son pays, sous forme d'une fourchette en jours. Réalise UJ-1.

**Conséquence testable :**
- Le délai est calculé à partir du délai de préparation et du délai de transport déclarés par l'artiste pour la zone de livraison.

#### FR-5 : Histoire courte et signes de sérieux

Le visiteur voit sur la fiche :
- l'histoire courte de l'œuvre ;
- sa disponibilité ;
- la mention « sélectionnée par Errancy » ;
- la mention du certificat d'authenticité ;
- un résumé de la politique de retour ;
- un lien vers la page de l'artiste ;
- un lien vers les pages de confiance (FR-24).

**Conséquence testable :**
- Le texte du résumé de retour et des garanties reprend le contenu de FR-24. Aucune durée ni gratuité n'est affichée tant que OQ-2 et OQ-4 ne sont pas tranchées.

#### FR-6 : Actions selon la disponibilité

Le visiteur voit les actions qui correspondent à la disponibilité de l'œuvre. Sur mobile, elles restent visibles dans une barre fixe. Réalise UJ-1 et UJ-4.

| Disponibilité | Actions proposées |
|---|---|
| `disponible` | « Acheter » (dès que le Lot 2 est ouvert), « Conseil WhatsApp », « Réserver une visite » |
| `réservée` | « Me prévenir » (FR-9), « Conseil WhatsApp » |
| `vendue` ou `vendue ailleurs` | Mention « vendue » et œuvres proches du même artiste |
| `retirée` | La fiche n'est plus publique. Son URL redirige vers la page de l'artiste (NFR-2) |

**Conséquences testables :**
- Tant que le Lot 2 n'est pas ouvert, « Acheter » est remplacé par « Conseil WhatsApp » ou par le parcours retenu en OQ-12.
- Chaque action déclenche un événement de mesure (FR-27).

### 4.2 Conseil humain : WhatsApp, visite et suivi

**Description :** quand le visiteur hésite, il parle à une personne. Après la vente, l'acheteur garde ce même contact. Le délai de réponse est annoncé et tenu, sinon la promesse se retourne contre Errancy. Réalise UJ-1 et UJ-4.

#### FR-7 : Conseil WhatsApp contextualisé

Le visiteur ouvre une conversation WhatsApp avec l'équipe Errancy depuis n'importe quelle page. Depuis une fiche œuvre, le message contient déjà la référence et le lien de l'œuvre.

**Conséquences testables :**
- Le bouton est présent sur :
  - les fiches œuvres ;
  - les pages artistes ;
  - le panier ;
  - la page de suivi de commande ;
  - le pied de page.
- Le délai de réponse annoncé s'affiche à côté du bouton (OQ-7).
- En dehors des heures de service, le délai affiché en tient compte. `[ASSUMPTION]`
- Sur ordinateur, le lien ouvre WhatsApp Web ou affiche un QR code.

**Repli :** tant qu'aucun répondant n'est désigné (OQ-7), le bouton est remplacé par un formulaire de demande de conseil (FR-8), avec un délai annoncé.

#### FR-8 : Demande de conseil ou de visite

Le visiteur envoie l'une de ces deux demandes :
- une **demande de visite** depuis une fiche œuvre : à distance, ou en atelier si l'artiste l'accepte, avec des créneaux souhaités ;
- une **demande de sélection personnalisée** depuis n'importe quelle page : espace, goût, budget.

Réalise UJ-4.

**Conséquences testables :**
- Le visiteur reçoit un accusé de réception par e-mail, avec le délai de réponse.
- La demande est visible dans l'administration, avec l'un de ces états (FR-25) :
  - `nouvelle` ;
  - `planifiée` ;
  - `faite` ;
  - `sans suite`.
- Les coordonnées de l'artiste ne sont jamais communiquées au visiteur. La visite en atelier est organisée par l'équipe Errancy (voir le risque de contournement de la commission, §12).

**Hors périmètre :** la prise de rendez-vous en temps réel sur un agenda.

#### FR-9 : Être prévenu d'un retour en disponibilité

Le visiteur laisse son e-mail sur une œuvre `réservée`. Si la réservation expire, il est prévenu. Réalise le cas limite de UJ-1.

**Conséquence testable :**
- Les inscrits sont prévenus dans l'ordre d'inscription. Chacun dispose d'un court délai de priorité. `[ASSUMPTION]`

### 4.3 Commander sans friction et sans double vente

**Description :** du bouton « Acheter » à la confirmation, l'acheteur ne rencontre aucun obstacle inutile, et une même œuvre ne peut jamais être vendue deux fois. Ces exigences valent pour tout mode d'encaissement :
- paiement intégré avec notification du prestataire ;
- lien de paiement envoyé après une vente assistée ;
- virement.

Seuls FR-14 et le paiement en une fois d'un panier à plusieurs artistes (FR-10) dépendent du montage. Réalise UJ-1, UJ-2 et UJ-4.

#### FR-10 : Panier et commande sans compte

Le visiteur ajoute des œuvres au panier et commande sans créer de compte. Il peut créer un compte après coup.

**Conséquences testables :**
- `/panier` est accessible sans connexion.
- La commande demande seulement l'e-mail, le nom, l'adresse de livraison et le téléphone.
- Le panier peut contenir des œuvres de plusieurs artistes, et l'acheteur le valide en un seul passage en caisse (même saisie, même récapitulatif). Le panier produit une commande par artiste, chacune avec son expédition, son suivi, ses retours et sa somme due à l'artiste (décision du 2026-10-25, sur le modèle de Saatchi Art, Singulart et Artmajeur).
- Le paiement se fait en une fois si le montage retenu le permet. Sinon, l'acheteur règle chaque commande à la suite, dans le même parcours (OQ-1).
- Le récapitulatif (FR-11) montre le délai et les frais de chaque artiste, et indique que les œuvres arriveront dans des colis séparés.
- Une œuvre du panier qui n'est plus `disponible` est signalée et ne peut pas être commandée.

#### FR-11 : Récapitulatif avant paiement

Avant de payer, l'acheteur voit pour chaque œuvre :
- le prix de l'œuvre ;
- les frais de livraison ;
- le prix total ;
- le délai total ;
- l'artiste ;
- le rappel des garanties et des conditions de retour (FR-24).

**Conséquence testable :**
- Les montants sont recalculés côté serveur à partir de la base, jamais repris du navigateur.

#### FR-12 : Réservation

Une œuvre passe en `réservée` dans deux cas :
- un acheteur commence à payer : la réservation dure alors environ 30 minutes `[ASSUMPTION]` ;
- l'équipe Errancy réserve l'œuvre pour un acheteur identifié, dans le cadre d'une vente assistée : la réservation dure alors environ 48 h `[ASSUMPTION]`.

À l'échéance, la réservation expire et l'œuvre redevient `disponible`.

**Conséquences testables :**
- Si deux acheteurs tentent de réserver la même œuvre en même temps, un seul obtient la réservation. L'autre voit « œuvre réservée » avant de payer.
- Une commande de plusieurs œuvres est réservée en bloc. Si une seule œuvre n'est pas disponible, aucune n'est réservée et l'acheteur en est informé.
- Une réservation expirée est libérée automatiquement.
- Le nombre de réservations simultanées par e-mail ou par appareil est limité.
- Chaque réservation est journalisée : qui, quand, échéance, issue.

#### FR-13 : Confirmation fiable de la commande

Une commande passe en `confirmée` dans deux cas :
- le prestataire confirme le paiement côté serveur ;
- un membre de l'équipe Errancy constate le paiement. Il enregistre alors qui a confirmé, quand, et la référence du paiement.

L'œuvre passe alors en `vendue`.

**Conséquences testables :**
- Une même confirmation reçue plusieurs fois ne crée qu'une commande.
- Si le paiement est constaté après l'expiration de la réservation :
  - l'œuvre encore `disponible` est vendue à cet acheteur ;
  - sinon, l'acheteur est remboursé (FR-31) et l'incident est compté dans SM-C1.
- L'acheteur reçoit une confirmation par e-mail avec le récapitulatif de FR-11.

#### FR-14 : Encaissement

L'acheteur paie le prix total par un moyen de paiement accepté à l'international.

**Bloqué par OQ-1.** Plusieurs points dépendent du montage de paiement :
- le prestataire ;
- l'entité qui encaisse ;
- la devise d'encaissement ;
- le traitement des contestations de paiement ;
- le reversement à l'artiste.

Le paiement actuel encaisse tout sur un seul compte Stripe Checkout. Il « ne convient plus tel quel » (`docs/decisions-porteur.md` l.73-74). Les options étudiées sont dans `addendum.md` §B, pour information seulement.

#### FR-15 : Suivi de commande pour l'acheteur

L'acheteur voit l'état de sa commande et le numéro de suivi, sans compte, grâce à un lien envoyé par e-mail. Depuis cette page, il peut contacter l'équipe Errancy et signaler un problème (FR-30). Réalise UJ-1.

**Conséquences testables :**
- Le lien contient un jeton aléatoire impossible à deviner, et il expire après la clôture.
- La page affiche le minimum de données personnelles.

### 4.4 Après la vente : livraison, retour, remboursement, clôture

**Description :** une vente n'est réussie qu'une fois l'œuvre livrée et le délai de retour passé sans litige (SM-1). L'artiste expédie lui-même, donc Errancy doit suivre chaque étape et intervenir en cas de problème. Réalise UJ-3.

#### FR-29 : Livraison constatée

Une commande passe en `livrée` dans l'un de ces cas :
- l'acheteur confirme la réception ;
- le suivi du transporteur indique la livraison ;
- l'équipe Errancy constate la livraison sur preuve.

**Conséquences testables :**
- Au-delà d'un seuil de prix, l'artiste doit expédier avec une preuve de livraison et une assurance. `[ASSUMPTION : seuil à fixer]` (OQ-5)
- La date de livraison ouvre le délai de retour.

#### FR-30 : Réclamation et retour

L'acheteur signale un problème depuis sa page de suivi (FR-15), pendant le délai de retour :
- œuvre abîmée ;
- œuvre non conforme ;
- changement d'avis.

L'équipe Errancy traite la réclamation et, si le retour est accepté, organise le renvoi à l'artiste dans l'emballage d'origine.

**Conséquence testable :**
- La durée du délai de retour, la prise en charge des frais de retour et le choix entre remboursement et avoir suivent OQ-4. Qui supporte la casse suit OQ-2.

#### FR-31 : Remboursement de l'acheteur

L'équipe Errancy déclenche un remboursement total ou partiel dans l'un de ces cas :
- commande annulée ;
- œuvre passée en `vendue ailleurs` ;
- paiement reçu après une réservation perdue ;
- retour accepté.

Le motif est enregistré.

**Conséquence testable :**
- Le remboursement porte un état : `demandé`, `effectué`. L'acheteur est prévenu à chaque changement.

**Bloqué par OQ-1** pour le moyen de rembourser.

#### FR-32 : Somme due à l'artiste

L'équipe Errancy voit, pour chaque commande :
- la somme due à l'artiste ;
- la date à laquelle elle devient exigible, c'est-à-dire la clôture de la commande ;
- l'état du reversement : `à verser`, `versée`, `bloquée`.

L'artiste voit les mêmes informations pour ses ventes.

**Bloqué par OQ-1 et OQ-3** pour le calcul exact (assiette, frais) et le moyen de verser. L'existence de cette information ne dépend pas du montage.

#### FR-33 : Clôture

Une commande `livrée` passe en `close` à la fin du délai de retour, si aucune réclamation n'est ouverte. Une commande `annulée` ou `retournée` est close une fois le remboursement effectué.

**Conséquence testable :**
- La durée du délai de retour suit OQ-4.

### 4.5 Un vrai catalogue, facile à parcourir

**Description :** le catalogue de démonstration est remplacé par de vraies œuvres d'artistes qui ont signé un accord écrit. Le visiteur trouve vite une œuvre qui correspond à son espace, à son goût et à son budget.

#### FR-16 : Catalogue réel uniquement

Le site ne montre que des œuvres et des artistes réels, publiés après curation.

**Conséquences testables :**
- Aucune page publique ne lit les données de démonstration. Cela vaut pour `src/data/*`, pour le jeu de données initial de la base, et pour les images de démonstration hébergées. Les images dont les droits ne sont pas acquis sont supprimées.
- Chaque artiste publié a signé un accord écrit (OQ-10). Cet accord couvre :
  - la vente ;
  - les droits sur les images ;
  - les obligations d'expédition et d'emballage ;
  - le certificat ;
  - la protection des données des acheteurs ;
  - l'interdiction de contourner la commission.

#### FR-17 : Filtres utiles

Le visiteur filtre le catalogue par :
- prix total, pour le pays choisi ;
- format ;
- orientation ;
- couleur dominante ;
- ambiance ;
- technique ;
- artiste ;
- pays de l'artiste ;
- disponibilité.

Il choisit aussi l'unité d'affichage, cm ou pouces.

#### FR-18 : Sélection curatoriale à l'accueil

À l'accueil, le visiteur voit une sélection choisie par l'équipe Errancy et les nouveautés. Il atteint une fiche œuvre en un clic depuis l'accueil.

**Hors périmètre :** les collections narratives (« Silence », « Mémoire », « Matière », « Lumières du Sud »), prévues juste après le MVP.

#### FR-19 : Pages artistes

Pour chaque artiste, le visiteur voit :
- son portrait ;
- sa démarche ;
- sa formation ;
- ses expositions ;
- une photo de l'atelier ;
- ses œuvres disponibles ;
- la mention de sa sélection par Errancy.

Les pages sont gérées par l'équipe Errancy à partir des éléments fournis par l'artiste (OQ-14).

### 4.6 Espace artiste : entrer, déposer, mettre à jour, expédier

**Description :** l'artiste vend via Errancy sans gérer de boutique. Il déclare tout ce que la fiche œuvre doit afficher, et il garde la main sur la disponibilité, puisqu'il vend aussi ailleurs. Réalise UJ-2.

#### FR-34 : Accès artiste sur invitation

L'équipe Errancy invite un artiste sélectionné. L'invitation crée un compte avec le rôle `artist`, rattaché à la fiche de cet artiste.

**Conséquences testables :**
- Un artiste n'accède qu'à ses propres œuvres et à ses propres commandes. Ce contrôle est fait côté serveur (NFR-5).
- Un changement de rôle prend effet sans que l'utilisateur ait à se déconnecter et se reconnecter. `[ASSUMPTION]`

**Hors périmètre :** la vérification d'identité et la saisie des coordonnées de versement, qui dépendent de OQ-1.

#### FR-20 : Dépôt d'une œuvre complète

L'artiste dépose une œuvre avec les éléments suivants.

**Description de l'œuvre :**
- titre, technique, année ;
- histoire courte ;
- dimensions ;
- couleur dominante, ambiance ;
- prix.

**Photos :**
- photo de mise en situation avec un repère d'échelle ;
- gros plan ;
- photos en lumière du jour ;
- vidéo, si possible.

**Livraison :**
- pour chaque zone de livraison acceptée : les frais, le délai de préparation et le délai de transport ;
- l'acceptation ou non des visites en atelier.

**Engagements :**
- certificat d'authenticité signé ;
- emballage conforme ;
- reprise de l'œuvre retournée dans son emballage d'origine.

**Conséquences testables :**
- L'œuvre ne peut pas être soumise à la curation tant qu'il manque un champ obligatoire.
- Elle n'est publiée qu'après validation par l'équipe Errancy (FR-25).

#### FR-21 : Mise à jour immédiate de la disponibilité

L'artiste passe une œuvre en `vendue ailleurs` ou `retirée` depuis son espace, sur mobile, à tout moment, même si elle est `réservée`. Réalise UJ-2.

**Conséquences testables :**
- Dès le changement, le serveur refuse toute nouvelle réservation ou commande sur l'œuvre. Le changement est visible sur le site en moins de 60 secondes.
- Si l'œuvre était `réservée`, la réservation est annulée et l'acheteur est prévenu. S'il avait déjà payé, il est remboursé (FR-31). L'équipe Errancy est alertée, et l'incident est compté dans SM-C1.

#### FR-22 : Prise en charge et expédition

L'artiste est prévenu de chaque commande sur ses œuvres. Il doit confirmer la disponibilité de l'œuvre et la prise en charge sous 48 h `[ASSUMPTION]`. Il expédie ensuite avant la fin du délai de préparation qu'il a déclaré, et saisit le numéro de suivi. Réalise UJ-2 et UJ-3.

**Conséquences testables :**
- La confirmation fait passer la commande en `prise en charge`.
- La saisie du numéro de suivi la fait passer en `expédiée` et prévient l'acheteur.
- L'adresse de l'acheteur n'est visible par l'artiste qu'après la prise en charge, et seulement jusqu'à la livraison.

### 4.7 Confiance et pages légales

**Description :** l'acheteur trouve des règles claires sur la livraison, les retours, l'authenticité et le rôle d'Errancy. Le contenu juridique reflète le statut d'intermédiaire. Une partie de ce contenu dépend de OQ-1, OQ-2 et OQ-4.

#### FR-23 : Pages légales

Le visiteur consulte :
- les CGV ;
- les mentions légales ;
- la politique de confidentialité ;
- la politique de cookies.

Les CGV indiquent que l'artiste est le vendeur et qu'Errancy est l'intermédiaire.

**Conséquences testables :**
- Les CGV traitent le droit de rétractation selon le pays de l'acheteur et le statut de l'artiste (§11).
- L'identité de l'exploitant est reprise du montage retenu. **Bloqué par OQ-1.**

#### FR-24 : Pages de confiance

Le visiteur consulte trois pages :
- **livraison** : zones, délais, droits et taxes d'import, casse ;
- **retours** ;
- **authenticité et certificat**.

Chaque fiche œuvre et le récapitulatif de commande renvoient vers ces pages (FR-5, FR-11).

**Conséquence testable :**
- Le contenu suit OQ-2, OQ-4 et OQ-5 :
  - qui couvre la casse ;
  - retour gratuit ou avoir ;
  - durée du délai de retour.

  Une « Garantie Errancy » n'est affichée que si OQ-2 la rend possible.

### 4.8 Administration et curation

**Description :** l'équipe Errancy publie, suit et règle les problèmes sans toucher à la base de données. Réalise UJ-3.

#### FR-25 : Curation et file des demandes

L'équipe Errancy voit les œuvres soumises par les artistes. Elle les valide ou les renvoie avec un commentaire, selon une liste de contrôle :
- photos ;
- fidélité des couleurs ;
- champs complets ;
- cohérence entre prix et zones de livraison.

Elle voit aussi les demandes de visite et de sélection, avec leur état, ainsi que les inscriptions « Me prévenir ».

#### FR-26 : Suivi des commandes, réservations et incidents

L'équipe Errancy voit chaque commande avec :
- son état ;
- l'artiste ;
- le délai de prise en charge et le délai d'expédition attendus ;
- le numéro de suivi ;
- les réclamations ;
- les remboursements.

Elle voit aussi les réservations en cours et le journal des réservations. Elle peut :
- poser une réservation pour une vente assistée (FR-12) ;
- confirmer une commande (FR-13) ;
- annuler une commande en donnant un motif ;
- libérer une réservation.

**Conséquence testable :**
- Le système signale séparément une prise en charge manquante après 48 h `[ASSUMPTION]` et une expédition manquante à la fin du délai de préparation déclaré.

### 4.9 Mesurer pour savoir ce qui fait vendre

**Description :** il n'existe aucun « avant » mesurable, puisque le site est en maintenance et que le catalogue est fictif. La baseline est donc celle du Lot 1 à sa mise en ligne. Les leviers de conversion se mesurent ensuite par des mises en ligne progressives ou des comparaisons A/B, par exemple avec ou sans le prix total, avec ou sans le bouton WhatsApp.

#### FR-27 : Événements du tunnel

Le site enregistre les événements suivants :
- vue d'une fiche œuvre ;
- choix du pays ;
- clic sur Conseil WhatsApp ;
- envoi d'une demande ;
- ajout au panier ;
- début de commande ;
- commande confirmée.

Chaque événement porte le slug de l'œuvre et la source d'arrivée.

**Conséquences testables :**
- Les événements ne sont enregistrés qu'avec le consentement du visiteur, quand la loi l'exige (NFR-6). Le taux de consentement est suivi, pour corriger SM-2.
- L'outil n'est pas choisi (OQ-9).

#### FR-28 : Ventes assistées par le conseil

L'équipe Errancy rattache une commande à un Conseil WhatsApp ou à une visite qui l'a précédée. Une commande issue d'une réservation posée par l'équipe Errancy (FR-12) y est rattachée automatiquement.

#### FR-35 : Contacts de la page de maintenance

Le formulaire « Me notifier » de la page de maintenance enregistre réellement les e-mails laissés, avec consentement. Ces contacts sont prévenus à l'ouverture. Aujourd'hui, ce formulaire n'envoie rien.

## 5. Exigences non fonctionnelles transverses

- **NFR-1 Performance mobile.** Les fiches œuvres et le catalogue se chargent vite sur mobile en 4G : images au bon format et à la bonne taille, chargées au fil du défilement. `[ASSUMPTION : LCP < 2,5 s, à confirmer par l'architecture]`
- **NFR-2 Référencement.** Chaque fiche œuvre et chaque page artiste ont des métadonnées, une URL canonique en français et une place dans le sitemap. Tout changement d'URL passe par une redirection 301. La perte de référencement est un risque élevé (§12). L'ouverture de `public/robots.txt` et la levée de la maintenance (`MAINTENANCE_MODE`) sont des actes du porteur, jamais des changements de code.
- **NFR-3 Accessibilité.** Navigation au clavier, contrastes suffisants, formulaires avec libellés, texte alternatif sur les images d'œuvres. `[ASSUMPTION : niveau WCAG 2.1 AA]`
- **NFR-4 Fiabilité de la vente.**
  - Aucune double vente : la réservation et la confirmation sont atomiques et idempotentes.
  - Avant l'ouverture du Lot 2, trois cas sont testés explicitement :
    - l'achat simultané de la même œuvre ;
    - le paiement après expiration de la réservation ;
    - la vente ailleurs pendant une réservation.
- **NFR-5 Sécurité.**
  - Next.js est mis à jour pour recevoir les correctifs de sécurité.
  - L'accès par rôle est contrôlé côté serveur sur toutes les actions : un artiste n'agit que sur ses œuvres, et seule l'équipe Errancy administre.
  - Les secrets restent hors du dépôt.
  - Les données des acheteurs ne sont visibles que par l'équipe Errancy et, pendant la livraison, par l'artiste concerné.
- **NFR-6 Données personnelles.**
  - La collecte est minimale.
  - Le consentement aux cookies de mesure est demandé quand la loi l'exige, par exemple dans l'UE.
  - Une durée de conservation est définie, avec une purge.
  - Le transfert des adresses d'acheteurs à des artistes hors UE est encadré (§11).
- **NFR-7 Migration progressive.** Chaque évolution qui touche aux données ou aux URL est livrée par étapes :
  - sauvegarde restaurable ;
  - correspondance vérifiée entre anciennes et nouvelles données ;
  - redirections 301 ;
  - bascule répétée en préproduction ;
  - retour arrière testé.

  Les rôles existants et les fonctions critiques (connexion, espace artiste, administration, commande) restent opérationnels à chaque étape. Pas de bascule en une fois, pas de changement de pile.
- **NFR-8 Langue et devise.** L'interface et les URL sont en français, et les prix sont affichés en euros. Le site est conçu pour accueillir d'autres langues et devises. Lesquelles, et dans quel lot, reste à arbitrer (OQ-6).

## 6. Périmètre du MVP

### 6.1 Inclus

Le MVP est découpé en deux lots. Le Lot 1 ne dépend pas du montage de paiement.

- **Lot 1. Conversion et catalogue, indépendant du paiement.**
  - Exigences : FR-1 à FR-9, FR-16 à FR-21, FR-25, FR-27, FR-34 et FR-35.
  - Travaux associés : purge des données de démonstration, publication des premières œuvres réelles, mise à jour de Next.js, mise en place de la mesure.
  - « Acheter » reste masqué (FR-6). Le visiteur passe par le conseil, la visite, ou le parcours retenu en OQ-12.
  - L'état `réservée` (FR-6, FR-9) et l'annulation de réservation de FR-21 ne s'activent qu'avec FR-12, donc au Lot 2, ou dès le Lot 1 si OQ-12 l'avance.
  - Condition de sortie : SM-4 à 100 %.
- **Lot 2. Commande et après-vente.**
  - Exigences : FR-10 à FR-15, FR-22 à FR-24, FR-26, FR-28 à FR-33.
  - Bloqués par le montage : FR-14, la partie de FR-23 qui donne l'identité de l'exploitant, et le moyen de rembourser et de verser (FR-31, FR-32). Ils attendent OQ-1.
  - Le contenu de FR-24 attend OQ-2, OQ-4 et OQ-5 ; FR-30 et FR-33 attendent OQ-4.
- **Ouverture avant le Lot 2.** Le Lot 1 peut-il ouvrir au public avant le Lot 2, avec des premières ventes assistées (Conseil WhatsApp, réservation par l'équipe Errancy, puis lien de paiement) ? La question dépend du montage et reste ouverte (OQ-12). Si la réponse est oui, FR-12, FR-13 et FR-26 doivent avancer avec le Lot 1.

### 6.2 Hors MVP

- **Simulateur mural et visualisation « dans votre pièce ».** La photo avec repère d'échelle suffit au lancement. Plus tard, l'aperçu traitera les photos des clients localement dans le navigateur, avec la mention « aperçu illustratif » s'il n'est pas calibré.
- **Collections narratives, espace collectionneur** (favoris, alertes, suivi d'artistes), **comparateur de formats.**
- **Certificat traçable**, par exemple numérique ou vérifiable en ligne.
- **Cadre et cadrage premium.**
- **Éditions limitées et reproductions** : jamais sans autorisation écrite des ayants droit.
- **Location B2B, sur-mesure, abonnement** : des pilotes successifs, pas simultanés, chacun validé par sa marge contributive.
- **Journal éditorial** : après le lancement.
- **Multilingue et multidevise**, selon l'arbitrage de OQ-6.
- **Versement automatisé aux artistes** (OQ-1, OQ-3).
- **Prise de rendez-vous en temps réel**, et **profils distincts au sein de l'équipe Errancy** : curation, conseil, suivi.

## 7. Ce que la refonte n'est pas

- Ce n'est pas une refonte complète ni un changement de pile, par exemple vers Supabase : on améliore le site existant.
- Ce n'est pas une boutique de décoration, ni un catalogue ouvert à tous les artistes.
- Ce n'est pas une galerie qui achète et revend : l'artiste vend, Errancy est l'intermédiaire. Si le montage de paiement remet cela en cause, la décision revient au porteur.
- Ce PRD ne choisit ni prestataire de paiement ni entité juridique.
- On ne lève pas la maintenance et on n'ouvre pas `robots.txt` depuis le code.

## 8. Ton et ambiance

- **Une galerie, pas une boutique.** Le ton est sobre, précis et chaleureux, et l'écriture soignée. Il n'y a ni promotions criardes, ni compte à rebours, ni fausse rareté.
- **Des artistes mis en valeur.** Chaque œuvre a une histoire courte, et chaque artiste une démarche.
- **La transparence comme signature.** Les prix, délais et conditions s'affichent sans astérisque caché.
- **Une présence humaine.** Le conseil a un visage et un délai, et le vouvoiement est cordial. `[ASSUMPTION]`
- **Une identité visuelle existante à garder.** Elle associe une typographie serif élégante (Cormorant Garamond) et Inter.
- **Un imaginaire pour la suite.** Les collections narratives (« Silence », « Mémoire », « Matière », « Lumières du Sud ») donnent le ton de la phase « différencier ».
- **Massinart, une inspiration à dépasser.** On reprend sa clarté, avec une exigence curatoriale supérieure.

## 9. Indicateurs de réussite

*Hormis la première vente, les objectifs chiffrés sont fixés après la baseline (`docs/strategie-refonte.md` l.148). Cette baseline est relevée à la mise en ligne du Lot 1.*

**Principaux**
- **SM-1. Première vente réelle.**
  - Définition : une commande passe en `close` (FR-33) sans litige. L'acheteur ne figure pas sur la liste de proches que le porteur aura déclarée.
  - Objectif : dans les 12 semaines du calendrier indicatif. Le point de départ sera fixé avec la date de lancement (OQ-11).
- **SM-2. Taux de conversion.**
  - Définition : nombre de commandes confirmées, divisé par le nombre de visiteurs uniques ayant consenti à la mesure et vu au moins une fiche œuvre, sur 30 jours glissants. Le taux de consentement est publié à côté.
  - Objectif : fixé après la baseline. L'effet de chaque levier est mesuré par une mise en ligne progressive (§4.9).

**Secondaires**
- **SM-3. Demandes qualifiées et ventes assistées.**
  - Définition : nombre de Conseils WhatsApp et de demandes par semaine, et part des commandes rattachées à un conseil (FR-28).
  - Ce qu'il vérifie : l'hypothèse que la diaspora préfère WhatsApp.
- **SM-4. Complétude des fiches.**
  - Définition : part des œuvres publiées qui ont toutes les informations suivantes :
    - dimensions en cm et en pouces ;
    - format ;
    - photo de mise en situation avec repère d'échelle ;
    - gros plan ;
    - histoire courte ;
    - au moins une zone de livraison avec frais et délais ;
    - engagement sur le certificat.
  - Objectif : 100 %. C'est la condition de sortie du Lot 1.
- **SM-5. Panier moyen.**
  - Définition : montant moyen d'une commande confirmée.
- **SM-6. Marge contributive.**
  - Définition : marge contributive par œuvre vendue et par offre. Chaque nouvelle offre (éditions, cadrage, location) doit d'abord prouver une marge positive.

**Garde-fous (à ne pas optimiser)**
- **SM-C1. Doubles ventes et ventes perdues.**
  - Ce qu'on compte : toutes les commandes payées qui ne peuvent pas être honorées, y compris les annulations après une vente ailleurs et les paiements reçus après une réservation perdue.
  - Cible : aucune double vente ; tout autre incident est analysé.
  - Ce qu'il protège : SM-1 et SM-2. On ne gagne pas en conversion en assouplissant la réservation.
- **SM-C2. Taux de retours et de litiges.**
  - Ce qu'on compte : les retours, la casse, les couleurs « différentes de l'écran » et les délais dépassés.
  - Ce qu'il protège : SM-2. Trop promettre pour convertir se paie en retours, d'autant que l'artiste expédie lui-même.
- **SM-C3. Délai réel de réponse au conseil.**
  - Ce qu'on mesure : l'écart avec le délai annoncé, d'après les statistiques de WhatsApp Business ou un relevé de l'équipe Errancy `[ASSUMPTION]`.
  - Ce qu'il protège : SM-3. Un canal lent détruit la promesse qu'il porte.

## 10. Questions ouvertes

*« Bloquant » signifie que l'exigence concernée ne peut pas être spécifiée en détail, ou livrée, sans réponse. Le porteur est responsable de chaque question, sauf mention contraire.*

1. **OQ-1. Montage de paiement et entité d'exploitation.**
   - **Bloquant pour :** FR-14, FR-23 (identité de l'exploitant), le moyen de rembourser (FR-31) et de verser (FR-32), la vérification d'identité et les coordonnées de versement des artistes, la fiscalité de ces versements, ainsi que le module d'encaissement dans l'architecture.
   - **Questions à trancher :**
     - Qui encaisse, dans quel pays, sous quelle forme juridique, et avec quel prestataire ?
     - Comment l'artiste est-il payé selon son pays ?
     - Qui supporte une contestation de paiement ?
     - Un panier avec plusieurs artistes peut-il être payé en une fois (paiement fractionné, OQ-16) ?
   - **État :** l'étude recommande une société d'exploitation au Royaume-Uni ou aux États-Unis, avec des versements par paliers. D'autres pistes existent, dont une « solution locale ». Ce ne sont que des recommandations : un avis juridique et comptable marocain est requis avant toute décision.
   - **Décision :** le porteur, après l'avis juridique.
   - **Tensions à arbitrer :**
     - La « galerie qui encaisse, puis reverse » de l'étude est-elle compatible avec le statut d'intermédiaire ?
     - Certains pays n'ont aucun moyen de reverser à l'artiste, ce qui contredit la décision « artistes de tous pays ».
     - Stripe accepte-t-il l'usage « place de marché d'art » ?
2. **OQ-2. Qui porte les garanties ?**
   - **Bloquant pour :** le contenu de FR-24 et FR-30.
   - **Questions à trancher :**
     - Qui porte l'authenticité, la conformité, la casse et le coût d'une contestation de paiement ?
     - Une « Garantie Errancy » est-elle compatible avec le rôle d'intermédiaire ?
     - Le droit de rétractation s'applique-t-il quand l'artiste n'est pas un vendeur professionnel ?
   - **Lien :** dépend de OQ-1.
3. **OQ-3. Assiette de la commission et frais de paiement.**
   - **Bloquant pour :** le calcul de FR-32 et SM-6.
   - **Questions à trancher :**
     - Les 30 % portent-ils sur l'œuvre seule, ou livraison comprise ?
     - Qui paie les frais de paiement ?
4. **OQ-4. Politique de retour.**
   - **Bloquant pour :** FR-24, FR-30, FR-33.
   - **Questions à trancher :**
     - Retour gratuit ou avoir ? Saatchi Art, par exemple, retient 20 % hors des États-Unis.
     - Quelle durée de délai ?
     - Qui paie le retour vers l'artiste ?
   - **Méthode proposée :** calculer la marge contributive dans les deux cas, puis tester.
5. **OQ-5. Livraison.**
   - **Bloquant pour :** le contenu de FR-24 (livraison) et le seuil de FR-29.
   - **Questions à trancher :**
     - Quelles zones de livraison ?
     - Qui paie la livraison ?
     - Qui gère la douane et les droits d'import ?
     - À partir de quel seuil de prix l'assurance et la preuve de livraison sont-elles obligatoires ?
     - Qui paie en cas de casse ?
   - **Défaut retenu :** l'artiste fixe ses frais et délais par zone, et le prix total ne comprend pas les droits d'import.
6. **OQ-6. Langues et devises.**
   - **Questions à trancher :**
     - Quelles langues et quelles devises en plus du français et de l'euro ?
     - Pour l'affichage seulement, ou aussi pour l'encaissement ?
     - Dans quel lot ?
   - **Lien :** dépend en partie de OQ-1.
7. **OQ-7. Conseil WhatsApp.**
   - **Bloquant pour :** la mise en ligne de FR-7. En attendant, le repli prévu en FR-7 s'applique.
   - **Questions à trancher :** quel numéro WhatsApp Business ? Qui répond, à quelles heures, avec quel délai annoncé ?
   - **État (2026-10-24) :** le porteur ne le sait pas encore.
8. **OQ-8. Visites.**
   - **Décidé (2026-10-24) :** pas de showroom ; visites à distance, ou en atelier si l'artiste l'accepte.
   - **Reste à trancher :** qui mène la visite (conseiller ou artiste), et avec quel délai de confirmation ?
9. **OQ-9. Outil de mesure (analytics).**
   - **Question à trancher :** PostHog ou GA4, en tenant compte du consentement.
   - **Responsable :** `bmad-architecture`.
10. **OQ-10. Catalogue de lancement.**
    - **Bloquant pour :** l'ouverture du Lot 1.
    - **Questions à trancher :**
      - Combien d'œuvres et d'artistes, et dans quelle fourchette de prix ?
      - Les accords écrits sont-ils signés (contenu en FR-16) ?
      - Qui prend les photos de mise en situation ?
    - **État (2026-10-24) :** le porteur ne le sait pas encore.
11. **OQ-11. Date de lancement, budget et ressources.**
    - **Questions à trancher :**
      - Quelle date de lancement ?
      - Quel budget mensuel ?
      - Combien de personnes pour le conseil et le suivi ?
    - **État (2026-10-24) :** le porteur ne le sait pas encore. Sans date, SM-1 n'a pas de point de départ.
12. **OQ-12. Ouvrir avant le paiement intégré ?**
    - **Question à trancher :** peut-on ouvrir le Lot 1 au public avec des ventes assistées (Conseil WhatsApp, réservation par l'équipe Errancy, lien de paiement) avant le Lot 2 ?
    - **État :** l'étude paiement le recommande (R4). C'est une option liée à OQ-1, pas une décision.
13. **OQ-13. Pays du visiteur.**
    - **Question à trancher :** le pays est-il déduit puis proposé, ou choisi par le visiteur dès sa première visite ?
14. **OQ-14. Rôle de l'artiste et rôle d'Errancy.**
    - **Défaut retenu :** la stratégie prévoit des pages artistes « gérées par Errancy ».
    - **Questions à trancher :**
      - Jusqu'où l'artiste rédige-t-il ses pages ?
      - Errancy peut-elle corriger une fiche œuvre déposée par un artiste ?
15. **OQ-15. Sortie de maintenance.**
    - **Question à trancher :** quels critères le porteur retient-il pour lever `MAINTENANCE_MODE` et ouvrir `robots.txt` ? Par exemple : le Lot 1 complet, le catalogue réel publié, la mesure en place.
16. **OQ-16. Paniers avec plusieurs artistes.**
    - **Décidé (2026-10-25) :** un seul panier et un seul passage en caisse, mais une commande par artiste (FR-10). Le porteur a délégué ce choix, qui reprend la pratique des concurrents.
    - **Reste à trancher, avec OQ-1 :** un seul paiement pour tout le panier, ou un paiement par commande.

## 11. Conformité et cadre réglementaire

*Parmi les points ci-dessous, ce PRD ne fixe aucune exigence sur ceux qui dépendent de l'avis juridique. Il les recense pour que le juriste les traite.*

- **Droit de rétractation de 14 jours** pour les acheteurs de l'UE, selon le statut de l'artiste (OQ-2). Il est repris dans les CGV (FR-23).
- **RGPD.** Consentement aux cookies et durée de conservation des données. Encadrement du transfert des adresses d'acheteurs de l'UE vers des artistes situés hors de l'UE : clause dans l'accord artiste, accès limité dans le temps (FR-22, NFR-6).
- **Statut d'intermédiaire.** Les CGV et les mentions légales présentent l'artiste comme vendeur.
- **Obligations des places de marché à vérifier :**
  - transparence et traçabilité des vendeurs (DSA dans l'UE) ;
  - déclaration fiscale des revenus des vendeurs (DAC7) ;
  - règles d'export des biens culturels selon le pays de l'artiste.
- **Droit d'auteur.** Les photos d'œuvres ne sont publiées qu'avec l'accord de l'artiste. Les images de démonstration sans droits sont supprimées (FR-16). Les éditions et reproductions sont exclues sans autorisation écrite des ayants droit.
- **Réglementation des changes marocaine, encaissement pour le compte de tiers, fiscalité des versements :** relèvent de OQ-1 et de l'avis juridique.

## 12. Risques

| Risque | Gravité | Réponse dans ce PRD |
|---|---|---|
| Le montage de paiement tarde et bloque la première vente | Élevée | Lot 1 indépendant du paiement (§6.1), option OQ-12 à arbitrer |
| Double vente, aggravée par les ventes hors site | Élevée | FR-12, FR-13, FR-21, NFR-4, SM-C1 |
| Retards ou casse, puisque l'artiste expédie | Élevée | FR-4, FR-20, FR-22, FR-26, FR-29, SM-C2 ; OQ-5 |
| Pas de catalogue réel ou pas d'accords avec les artistes au lancement | Élevée | FR-16, et OQ-10 bloquante pour le Lot 1 |
| Perte de référencement lors des changements d'URL | Élevée | NFR-2, NFR-7 |
| Refaire au lieu d'améliorer | Élevée | NFR-7, §7 |
| Contournement de la commission : acheteur et artiste traitent en direct après une visite | Moyenne | Visites organisées par Errancy (FR-8), clause dans l'accord artiste (FR-16) |
| Fraude, contestation de paiement, litige « colis non reçu » | Moyenne | Preuve de livraison au-delà d'un seuil (FR-29) ; qui supporte le coût : OQ-1 et OQ-2 |
| Promesse de conseil non tenue, faute de répondant | Moyenne | Repli prévu en FR-7, SM-C3 ; OQ-7 |
| Droits d'auteur sur les images de démonstration | Élevée | Purge prévue en FR-16 |

## 13. Index des hypothèses

- **§1 :** les freins 3 à 6 sont déduits des sources.
- **§2.3 :** les personnages Yasmine, Karim, Salma et Thomas.
- **FR-3 :** le pays du visiteur est déduit puis modifiable.
- **FR-7 :** le délai de réponse affiché tient compte des heures de service.
- **FR-9 :** les inscrits sont prévenus dans l'ordre, avec un délai de priorité.
- **FR-12 :** réservation d'environ 30 min au paiement, et d'environ 48 h pour une vente assistée (UJ-4).
- **FR-22, FR-26 et UJ-3 :** l'artiste confirme la prise en charge sous 48 h.
- **FR-29 :** au-delà d'un seuil de prix, l'expédition est assurée avec preuve de livraison (seuil à fixer).
- **FR-34 :** un changement de rôle prend effet sans reconnexion.
- **NFR-1 :** LCP inférieur à 2,5 s sur mobile.
- **NFR-3 :** niveau WCAG 2.1 AA.
- **§8 :** vouvoiement cordial.
- **SM-C3 :** mesure par les statistiques de WhatsApp Business ou par un relevé de l'équipe.
