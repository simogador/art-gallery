---
title: "PRD — Refonte d'Errancy"
status: draft
created: 2026-10-24
updated: 2026-10-24
---

# PRD — Refonte d'Errancy

*Brouillon en voie rapide : les points déduits sans confirmation du porteur sont marqués `[ASSUMPTION]` et repris en §12.*

## 0. Objet du document

Ce PRD décrit ce que la refonte d'Errancy doit permettre, dans l'ordre fixé par la stratégie : **convertir d'abord**, différencier ensuite, diversifier enfin. Il s'adresse au porteur du projet, qui valide, et aux étapes BMAD suivantes : UX (`bmad-ux`), architecture (`bmad-architecture`), puis découpage en epics et stories.

Il s'appuie sur :
- `docs/strategie-refonte.md` (stratégie et audit) ;
- `docs/decisions-porteur.md` (décisions du porteur) ;
- `docs/analyse-projet.md` (état technique) ;
- les deux études de `_bmad-output/planning-artifacts/research/`, sur les fiches œuvres et la confiance acheteur d'une part, sur le paiement en place de marché d'autre part.

Le vocabulaire est fixé par le glossaire (§3). Les exigences fonctionnelles (FR) sont numérotées une fois pour toutes et rangées par fonctionnalité. Les détails techniques et les options écartées sont dans `addendum.md`.

**Le montage de paiement n'est pas tranché.** Il attend un avis juridique marocain (`docs/decisions-porteur.md` l.17). Ce PRD le traite comme une question ouverte (§9, OQ-1) : il précise ce qui en dépend et ce qui peut avancer sans lui.

## 1. Vision

Errancy veut devenir une **galerie-curatrice digitale** et non une boutique de tableaux parmi d'autres. Cela veut dire une sélection resserrée, des artistes mis en valeur, des prix transparents et un accompagnement humain. Errancy est une place de marché : l'artiste vend son œuvre via le site, l'expédie lui-même, et Errancy perçoit une commission de 30 %. Les acheteurs visés sont internationaux, en particulier la diaspora ; les artistes viennent de tous pays.

Acheter une œuvre originale à distance est un pari pour l'acheteur. L'hypothèse centrale de la refonte est que **lever ses doutes est le premier levier de vente**. Sur chaque fiche œuvre, l'acheteur doit pouvoir répondre seul à quatre questions : *Ira-t-elle chez moi ? Est-elle trop petite ? Trop chère ? Est-ce sérieux ?* Quand il hésite encore, une personne d'Errancy doit pouvoir lui répondre, par WhatsApp. Aucun concurrent étudié n'offre ce conseil humain direct ; c'est la différence qu'Errancy peut revendiquer dès le lancement.

Aujourd'hui, personne ne peut acheter. `[ASSUMPTION]` Voici ce qui bloque, d'après les sources :
1. le site est en maintenance ;
2. le catalogue n'est qu'une démonstration ;
3. les fiches n'indiquent ni le prix total, ni le délai, ni l'échelle, ni le certificat ;
4. le panier exige un compte ;
5. il n'existe aucun canal de conseil ;
6. rien n'est mesuré.

La refonte améliore le site existant par étapes, avec possibilité de retour arrière, sans changer de pile.

## 2. Utilisateurs cibles

### 2.1 Besoins à satisfaire (Jobs To Be Done)

- **Acheteur** :
  - trouver une œuvre qui correspond vraiment à son espace, à son goût et à son budget ;
  - être sûr, avant de payer, de la taille réelle, du prix final livré chez lui et du délai ;
  - pouvoir demander l'avis d'une personne avant un achat important ;
  - savoir que l'œuvre est authentique et qu'un recours existe si elle arrive abîmée ou ne lui convient pas.
- **Acheteur de la diaspora** : se sentir proche des artistes de son pays d'origine et les soutenir, depuis le pays où il vit.
- **Artiste** :
  - vendre à l'international sans gérer de boutique ;
  - garder la main sur la disponibilité de ses œuvres, qu'il vend aussi ailleurs ;
  - être présenté avec sérieux ;
  - toucher plus que chez les concurrents, grâce à une commission de 30 % contre 30 à 50 % ailleurs.
- **Équipe Errancy (administration et curation)** :
  - choisir les œuvres publiées ;
  - suivre chaque commande jusqu'à la livraison ;
  - répondre vite aux demandes de conseil ;
  - mesurer ce qui fait vendre.

### 2.2 Hors cible du MVP

- Les acheteurs de décoration à petit prix : Errancy n'est pas une boutique de déco, à la différence de Massinart.
- Les clients professionnels (location B2B), les commandes sur mesure et les abonnements : ce sont des pilotes ultérieurs.
- Les artistes non sélectionnés : la place de marché n'est pas ouverte à tous ; seuls les artistes choisis par Errancy sont publiés.
- Les acheteurs de reproductions ou d'éditions : aucune ne sera vendue sans autorisation écrite des ayants droit, et pas dans le MVP.

### 2.3 Parcours clés

*Les personnages ci-dessous ont été construits à partir des sources ; le porteur doit les confirmer ou les remplacer par des cas réels.* `[ASSUMPTION]`

- **UJ-1. Yasmine achète, depuis Montréal, un tableau pour son salon.**
  - **Profil et contexte :** Yasmine, 38 ans, d'origine marocaine, vit à Montréal et cherche une grande toile d'un artiste marocain pour le mur au-dessus de son canapé.
  - **Point de départ :** elle arrive sur une fiche œuvre depuis un partage Instagram, sur mobile et sans compte.
  - **Parcours :**
    1. Elle voit la photo de l'œuvre accrochée près d'un fauteuil, qui donne l'échelle.
    2. Elle lit les dimensions en pouces et en cm.
    3. Elle voit le prix total, livraison au Canada comprise, en dollars canadiens `[ASSUMPTION : devise affichée]`, ainsi que le délai total : « livrée sous 12 à 16 jours ».
    4. Elle hésite sur les couleurs. Elle touche « Conseil WhatsApp » : un message s'ouvre, déjà rempli avec la référence de l'œuvre. Une conseillère lui répond dans le délai annoncé, avec une photo prise en lumière du jour.
  - **Moment clé :** elle revient sur la fiche, touche « Acheter » et règle la commande sans créer de compte.
  - **Résolution :** elle reçoit une confirmation par e-mail avec le délai, puis le numéro de suivi saisi par l'artiste.
  - **Cas limite :** si quelqu'un a lancé un paiement sur la même œuvre juste avant elle, la fiche indique « réservée » et lui propose d'être prévenue si l'œuvre redevient disponible.
- **UJ-2. Karim, peintre à Essaouira, met une œuvre en vente et la retire après une vente à l'atelier.**
  - **Profil et contexte :** Karim vend aussi dans son atelier et sur un salon.
  - **Point de départ :** il est connecté à son espace artiste.
  - **Parcours :**
    1. Il dépose une œuvre avec trois photos prises en lumière du jour, un gros plan, les dimensions, et les frais et délais d'expédition pour trois zones.
    2. Errancy valide la fiche, qui est publiée.
    3. Un mois plus tard, il vend l'œuvre à l'atelier et la passe en « vendue » depuis son téléphone.
  - **Moment clé :** l'œuvre disparaît immédiatement de la vente sur Errancy, et aucune commande ne peut plus être passée dessus.
  - **Cas limite :** si une commande sur Errancy arrive avant sa mise à jour, l'équipe le contacte et la commande est annulée et remboursée selon les CGV.
- **UJ-3. Salma, de l'équipe Errancy, suit une commande jusqu'à la livraison.** `[ASSUMPTION : personnage]`
  - **Parcours :**
    1. Salma reçoit l'alerte « nouvelle commande ».
    2. Elle vérifie que l'artiste a confirmé l'expédition sous 48 h `[ASSUMPTION : délai]`.
    3. Elle relance l'artiste si besoin, puis voit le numéro de suivi apparaître.
  - **Résolution :** la commande passe à « livrée », ce qui ouvre le délai de retour de 14 jours.
- **UJ-4. Thomas, à Lyon, demande une visite avant de se décider.**
  - **Point de départ :** Thomas hésite sur une œuvre à 2 400 €.
  - **Parcours :** sur la fiche, il touche « Réserver une visite » et choisit un créneau en visioconférence avec l'artiste ou un conseiller. Il n'y a pas de showroom : les visites se font à distance, ou en atelier si l'artiste l'accepte.
  - **Moment clé :** après l'appel, l'équipe lui envoie le lien de la fiche, et il commande.

## 3. Glossaire

- **Œuvre** : pièce originale et unique proposée à la vente par un artiste. Elle a une seule fiche œuvre et appartient à un seul artiste. Elle est identifiée par son slug.
- **Fiche œuvre** : page publique d'une œuvre (`/galerie/...`).
- **Artiste** : vendeur de l'œuvre. Il expédie l'œuvre et gère sa disponibilité. Il dispose d'un espace artiste.
- **Acheteur** : personne qui passe une commande, avec ou sans compte.
- **Visiteur** : personne qui consulte le site, sans forcément acheter.
- **Équipe Errancy** : personnes qui ont le rôle `admin`. Elles s'occupent de la curation, du conseil et du suivi des commandes.
- **Curation** : validation par l'équipe Errancy d'une œuvre avant sa publication.
- **Disponibilité** : état d'une œuvre. Les quatre états sont :
  - `disponible` ;
  - `réservée` (un paiement est en cours) ;
  - `vendue` ;
  - `retirée` (l'artiste ou l'équipe l'a sortie de la vente).
- **Réservation** : blocage temporaire d'une œuvre pendant un paiement. Elle expire si le paiement n'aboutit pas.
- **Commande** : achat confirmé d'une ou plusieurs œuvres par un acheteur. Elle passe par les états suivants :
  - `confirmée` ;
  - `expédiée` ;
  - `livrée` ;
  - `close`, `annulée` ou `retournée`.
- **Zone de livraison** : groupe de pays pour lequel l'artiste fixe des frais et un délai d'expédition.
- **Prix total** : prix de l'œuvre, plus les frais de livraison vers le pays de l'acheteur, plus le cadre s'il est proposé. C'est le montant que l'acheteur paie.
- **Délai total** : temps de préparation par l'artiste, plus temps de transport vers le pays de l'acheteur.
- **Conseil WhatsApp** : conversation WhatsApp entre un visiteur et l'équipe Errancy, ouverte depuis le site.
- **Demande de visite** : demande de rendez-vous (à distance ou en atelier) envoyée depuis une fiche œuvre.
- **Certificat d'authenticité** : document signé par l'artiste et remis avec l'œuvre.
- **Commission** : part de 30 % revenant à Errancy sur chaque vente. Son assiette n'est pas encore fixée (OQ-3).
- **Montage de paiement** : choix de l'entité qui encaisse, des prestataires et du mode de reversement aux artistes. Il n'est pas tranché (OQ-1).
- **Baseline** : première mesure du tunnel de vente. Elle sert de référence pour fixer les objectifs chiffrés.

## 4. Fonctionnalités

### 4.1 Une fiche œuvre qui lève les doutes

**Description :** chaque fiche œuvre répond aux quatre questions de l'acheteur sans qu'il ait besoin de demander : l'échelle, le prix final livré, le délai et le sérieux de l'offre. Elle propose aussi trois actions : Acheter, Conseil WhatsApp et Réserver une visite. C'est le cœur de « convertir d'abord ». Réalise UJ-1 et UJ-4.

#### FR-1 : Dimensions lisibles dans les deux systèmes

Le visiteur voit les dimensions de l'œuvre en cm et en pouces, ainsi que son orientation. Réalise UJ-1.
- Les deux unités s'affichent ensemble sur toutes les fiches publiées.
- Une œuvre sans dimensions ne peut pas être publiée (voir FR-20).

#### FR-2 : Photos qui donnent l'échelle et la matière

Le visiteur voit :
- au moins une photo de mise en situation avec un repère d'échelle (un meuble ou une personne) ;
- un gros plan ;
- des photos prises en lumière du jour.

Réalise UJ-1.
- Une œuvre sans photo de mise en situation ne peut pas être publiée.
- Les photos sont optimisées pour le mobile (voir NFR-1).

**Hors périmètre :** le simulateur mural et la visualisation « dans votre pièce » (voir §6.2).

#### FR-3 : Prix total pour le pays du visiteur

Le visiteur voit le prix total, livraison vers son pays comprise, avant d'ajouter l'œuvre au panier. Réalise UJ-1.
- Le pays de livraison est proposé d'office et le visiteur peut le changer. `[ASSUMPTION : pays déduit, puis modifiable]` (OQ-13)
- Le prix total affiché est égal au montant demandé au paiement, pour un même pays.
- Si l'artiste ne livre pas le pays choisi, la fiche l'indique et propose le Conseil WhatsApp au lieu d'« Acheter ».

#### FR-4 : Délai total annoncé

Le visiteur voit le délai total de livraison vers son pays, sous forme de fourchette en jours. Réalise UJ-1.
- Le délai est calculé à partir de la préparation et du transport que l'artiste a déclarés pour la zone de livraison.

#### FR-5 : Signes de sérieux

Le visiteur voit sur la fiche :
- la disponibilité ;
- la mention du certificat d'authenticité ;
- la politique de retour (14 jours) ;
- un lien vers la page de l'artiste et vers les pages de confiance (FR-24).

Le texte exact des garanties dépend de OQ-2 et OQ-4.

#### FR-6 : Trois actions visibles

Le visiteur dispose, sans faire défiler l'écran sur mobile, des actions « Acheter », « Conseil WhatsApp » et « Réserver une visite ». Réalise UJ-1 et UJ-4.
- Une œuvre `réservée` ou `vendue` n'affiche pas « Acheter ». Elle propose « Me prévenir » pour une œuvre réservée, ou des œuvres proches pour une œuvre vendue.
- Chaque action déclenche un événement de mesure (FR-27).

### 4.2 Conseil humain : WhatsApp et visite

**Description :** quand le visiteur hésite, il parle à une personne. Le conseil WhatsApp est la différence d'Errancy face aux concurrents. Le délai de réponse est annoncé pour que la promesse soit crédible. Réalise UJ-1 et UJ-4.

#### FR-7 : Conseil WhatsApp contextualisé

Le visiteur ouvre, depuis une fiche œuvre ou toute autre page, une conversation WhatsApp avec l'équipe Errancy. Quand il part d'une fiche, le message contient déjà la référence et le lien de l'œuvre.
- Le bouton est présent sur les fiches œuvres, les pages artistes, le panier et le pied de page.
- Le délai de réponse annoncé est affiché à côté du bouton (OQ-7).
- Sur ordinateur, le lien ouvre WhatsApp Web ou affiche un QR code. `[ASSUMPTION]`

#### FR-8 : Demande de visite

Le visiteur envoie, depuis une fiche œuvre, une demande de visite :
- type de visite : à distance, ou en atelier si l'artiste l'accepte ;
- créneaux souhaités ;
- moyen de contact.

L'équipe Errancy reçoit la demande. Réalise UJ-4.
- Le visiteur reçoit un accusé de réception par e-mail.
- La demande est rattachée à l'œuvre et visible dans l'administration (FR-25).

**Hors périmètre :** la prise de rendez-vous en temps réel sur un agenda (MVP « simplifié », voir `docs/strategie-refonte.md` l.81).

#### FR-9 : Être prévenu d'un retour en disponibilité

Le visiteur laisse son e-mail sur une œuvre `réservée` pour être prévenu si la réservation expire. Réalise le cas limite de UJ-1.

### 4.3 Parcours d'achat sans friction

**Description :** de « Acheter » à la confirmation, l'acheteur ne rencontre aucun obstacle inutile, et une même œuvre unique ne peut jamais être vendue deux fois. Le moyen d'encaisser dépend du montage de paiement (OQ-1). Les exigences ci-dessous valent quel que soit ce montage. Réalise UJ-1.

#### FR-10 : Panier et commande sans compte

Le visiteur ajoute une œuvre au panier et passe commande sans créer de compte. Il peut créer un compte après la commande s'il le souhaite.
- `/panier` est accessible sans connexion. C'est un changement : aujourd'hui, le panier exige une session.
- La commande demande seulement l'e-mail, le nom, l'adresse de livraison et le téléphone.

#### FR-11 : Récapitulatif avant paiement

Avant de payer, l'acheteur voit, pour chaque œuvre : le prix de l'œuvre, les frais de livraison, le prix total, le délai total, l'artiste, et les conditions de retour.
- Les montants sont recalculés côté serveur à partir de la base, et non repris du navigateur. Cette règle existe déjà dans `src/app/api/checkout/route.ts` et doit être conservée.

#### FR-12 : Réservation pendant le paiement

Quand l'acheteur lance le paiement, chaque œuvre de la commande passe en `réservée` pour une durée limitée. Elle revient en `disponible` si le paiement n'aboutit pas.
- Si deux acheteurs lancent un paiement sur la même œuvre au même moment, un seul obtient la réservation. L'autre voit « œuvre réservée » avant de payer.
- Une réservation expirée est libérée automatiquement, sans intervention humaine.
- La durée de réservation est un paramètre. `[ASSUMPTION : environ 30 min]`

#### FR-13 : Confirmation fiable de la commande

Une commande passe en `confirmée` uniquement après la confirmation du paiement par le prestataire, reçue côté serveur. L'œuvre passe alors en `vendue`.
- Si la même notification du prestataire est reçue plusieurs fois, une seule commande est créée (idempotence, comme dans le webhook actuel).
- L'acheteur reçoit un e-mail de confirmation avec le récapitulatif de FR-11.

#### FR-14 : Encaissement

L'acheteur paie le prix total par un moyen de paiement international.

**Bloqué par OQ-1.** Le prestataire, l'entité qui encaisse, la devise d'encaissement et le reversement à l'artiste dépendent du montage de paiement. Le paiement actuel (Stripe Checkout sur un seul compte) « ne convient plus tel quel » (`docs/decisions-porteur.md` l.73-74). Ce PRD ne choisit pas de solution. Les options étudiées sont dans `addendum.md` §B, pour information.
- Quel que soit le montage, FR-11, FR-12 et FR-13 s'appliquent.

#### FR-15 : Suivi de commande pour l'acheteur

L'acheteur voit l'état de sa commande (`confirmée`, `expédiée`, `livrée`) et le numéro de suivi, grâce au lien envoyé par e-mail, sans compte. Réalise UJ-1.

### 4.4 Un vrai catalogue, facile à parcourir

**Description :** le catalogue de démonstration est remplacé par de vraies œuvres d'artistes ayant signé un accord écrit. Le visiteur trouve vite une œuvre qui correspond à son espace et à son budget.

#### FR-16 : Catalogue réel uniquement

Le site ne montre que des œuvres et des artistes réels, publiés après curation.
- Aucune page publique ne lit les données de démonstration (`src/data/*`).
- Chaque artiste publié a signé un accord écrit couvrant la vente et les droits sur les images (OQ-10).

#### FR-17 : Filtres utiles

Le visiteur filtre le catalogue par :
- prix total ;
- format ;
- orientation ;
- couleur dominante ;
- artiste ;
- pays de l'artiste ;
- disponibilité.

Il choisit aussi l'unité d'affichage (cm ou pouces).

#### FR-18 : Sélection curatoriale à l'accueil

Le visiteur voit à l'accueil une sélection choisie par l'équipe Errancy et les nouveautés. Il atteint une fiche œuvre en un clic.

**Hors périmètre :** les collections narratives (« Silence », « Mémoire », etc.), prévues après le MVP.

#### FR-19 : Pages artistes

Le visiteur voit pour chaque artiste :
- son portrait ;
- sa démarche ;
- sa formation ;
- ses expositions ;
- une photo de l'atelier ;
- ses œuvres disponibles.

Le contenu est fourni par l'artiste et validé par l'équipe Errancy. `[ASSUMPTION : partage des rôles]` (OQ-14)

### 4.5 Espace artiste : déposer, mettre à jour, expédier

**Description :** l'artiste vend ses œuvres via Errancy sans gérer de boutique. Il déclare tout ce que la fiche œuvre doit afficher, et garde la main sur la disponibilité, puisqu'il vend aussi ailleurs. Réalise UJ-2.

#### FR-20 : Dépôt d'une œuvre complète

L'artiste dépose une œuvre avec :
- son titre, sa technique et son année ;
- ses dimensions ;
- son prix ;
- au moins une photo de mise en situation avec repère d'échelle, un gros plan, et des photos en lumière du jour (une vidéo est facultative) ;
- pour chaque zone de livraison qu'il accepte : les frais d'expédition, le délai de préparation et le délai de transport ;
- son engagement sur l'emballage.
- L'œuvre ne peut pas être soumise à la curation tant qu'un champ obligatoire manque.
- L'œuvre n'est publiée qu'après validation par l'équipe Errancy (FR-25).

#### FR-21 : Mise à jour immédiate de la disponibilité

L'artiste passe une œuvre en `vendue` ou `retirée` depuis son espace, sur mobile. Réalise UJ-2.
- Le changement est visible sur le site immédiatement.
- Une œuvre `réservée` ne peut pas être modifiée par l'artiste. Il est invité à contacter l'équipe Errancy.

#### FR-22 : Notification de vente et expédition

L'artiste est prévenu de chaque commande sur ses œuvres, par e-mail `[ASSUMPTION : WhatsApp en plus]`. Il confirme l'expédition et saisit le numéro de suivi. Réalise UJ-2 et UJ-3.
- La saisie du numéro de suivi passe la commande en `expédiée` et prévient l'acheteur.

**Hors périmètre :** le reversement à l'artiste et l'affichage de ses gains, qui dépendent de OQ-1 et OQ-3.

### 4.6 Confiance et pages légales

**Description :** l'acheteur trouve des règles claires sur la livraison, les retours, l'authenticité et le rôle d'Errancy. Le contenu juridique doit refléter le statut d'intermédiaire d'Errancy. Une partie de ce contenu dépend des questions ouvertes OQ-1, OQ-2 et OQ-4.

#### FR-23 : Pages légales

Le visiteur consulte :
- les CGV ;
- les mentions légales ;
- la politique de confidentialité ;
- la politique de cookies.

Les CGV indiquent que l'artiste est le vendeur et qu'Errancy est l'intermédiaire.
- Les CGV couvrent le droit de rétractation de 14 jours pour les acheteurs concernés.
- L'identité de l'exploitant est reprise du montage retenu (OQ-1).

#### FR-24 : Pages de confiance

Le visiteur consulte une page sur la livraison (zones, délais, casse), une sur les retours, et une sur l'authenticité et le certificat. Chaque fiche œuvre renvoie vers ces pages (FR-5).
- Le contenu « retour gratuit » ou « avoir », et la question de qui couvre la casse, attendent OQ-2 et OQ-4.

### 4.7 Administration et curation

**Description :** l'équipe Errancy publie, suit et règle les problèmes sans toucher à la base. Réalise UJ-3.

#### FR-25 : File de curation et de demandes

L'équipe Errancy voit les œuvres soumises par les artistes. Elle les valide ou les renvoie avec un commentaire. Elle voit aussi les demandes de visite et les demandes « Me prévenir ».

#### FR-26 : Suivi des commandes et des réservations

L'équipe Errancy voit chaque commande avec son état, l'artiste concerné, le délai annoncé et le numéro de suivi. Elle voit aussi les réservations en cours. Elle peut annuler une commande en indiquant un motif, et libérer une réservation.
- Une commande `confirmée` sans expédition après le délai convenu est signalée. `[ASSUMPTION : 48 h]`

### 4.8 Mesurer pour savoir ce qui fait vendre

**Description :** avant de changer quoi que ce soit, Errancy mesure son tunnel de vente, puis compare chaque évolution à cette baseline. Sans mesure, le taux de conversion ne peut pas être suivi (SM-2).

#### FR-27 : Événements du tunnel

Le site enregistre les événements suivants :
- vue d'une fiche œuvre ;
- choix du pays de livraison ;
- clic sur Conseil WhatsApp ;
- envoi d'une demande de visite ;
- ajout au panier ;
- début du paiement ;
- commande confirmée.

Chaque événement porte le slug de l'œuvre et la source d'arrivée.
- Les événements ne sont enregistrés qu'avec le consentement du visiteur quand la loi l'exige (voir NFR-6).
- L'outil d'analytique n'est pas choisi (PostHog ou GA4, OQ-9).

#### FR-28 : Ventes assistées par le conseil

L'équipe Errancy peut rattacher une commande à un conseil WhatsApp ou à une visite qui l'a précédée. Cela permet de mesurer la part des ventes obtenues grâce au conseil humain (SM-3).

## 5. Exigences non fonctionnelles transverses

- **NFR-1 Performance mobile.** Les fiches œuvres et le catalogue se chargent vite sur mobile en 4G : images au bon format et à la bonne taille, chargées au fur et à mesure du défilement. `[ASSUMPTION : cible LCP < 2,5 s sur mobile, à confirmer par l'architecture]`
- **NFR-2 Référencement.** Chaque fiche œuvre et chaque page artiste a des métadonnées, une URL canonique en français et une place dans le sitemap. Tout changement d'URL passe par une redirection 301. L'ouverture de `public/robots.txt` et la levée de la maintenance (`MAINTENANCE_MODE`) sont des actes du porteur, jamais des changements de code.
- **NFR-3 Accessibilité.** Le site est navigable au clavier, les contrastes sont suffisants, les formulaires ont des libellés, et les images d'œuvres ont un texte alternatif. `[ASSUMPTION : niveau WCAG 2.1 AA]`
- **NFR-4 Fiabilité de la vente.** Aucune double vente. La réservation et la confirmation sont atomiques et idempotentes. L'achat simultané de la même œuvre par deux acheteurs est testé explicitement avant le lancement.
- **NFR-5 Sécurité.** Next.js est mis à jour pour recevoir les correctifs de sécurité. Les secrets restent hors du dépôt. Les données des acheteurs ne sont accessibles qu'à l'équipe Errancy et, pour la livraison, à l'artiste concerné.
- **NFR-6 Données personnelles.** Collecte minimale. Le consentement aux cookies de mesure est demandé aux visiteurs pour qui la loi l'exige, par exemple dans l'UE. Les données d'adresse transmises à l'artiste se limitent à ce que la livraison exige.
- **NFR-7 Migration progressive.** Chaque évolution est livrée par étapes, avec sauvegarde restaurable et retour arrière possible. Pas de bascule en une fois, pas de changement de pile.
- **NFR-8 Langue.** L'interface et les URL sont en français. Le site est conçu pour pouvoir accueillir d'autres langues et d'autres devises, sans les livrer dans le MVP (OQ-6).

## 6. Périmètre du MVP

### 6.1 Inclus

Le MVP est découpé en deux lots, pour ne pas faire attendre la conversion derrière le montage de paiement.

- **Lot 1. Conversion, indépendant du montage de paiement.** FR-1 à FR-9, FR-16 à FR-19, FR-27 et FR-28. Il comprend aussi la purge des données de démonstration, les premières œuvres réelles, la mise à jour de Next.js et la mise en place de la mesure. La baseline est relevée dès la sortie de maintenance.
- **Lot 2. Socle commercial.** FR-10 à FR-15, FR-20 à FR-26. FR-14, FR-23 (identité de l'exploitant) et FR-24 (garanties) attendent OQ-1, OQ-2 et OQ-4.
- La question de savoir si le Lot 1 peut ouvrir au public avant le Lot 2, en vendant au début par conseil WhatsApp puis lien de paiement, dépend aussi du montage : elle reste ouverte (OQ-12).

### 6.2 Hors MVP

- Simulateur mural et visualisation « dans votre pièce » : la photo avec repère d'échelle suffit au lancement. Le simulateur viendra ensuite, avec la mention « aperçu illustratif » s'il n'est pas calibré.
- Collections narratives, espace collectionneur (favoris, alertes, suivi d'artistes), comparateur de formats.
- Éditions limitées et reproductions : jamais sans autorisation écrite des ayants droit.
- Cadrage premium, location B2B, sur-mesure, abonnement : pilotes successifs, pas simultanés.
- Journal éditorial : après le lancement.
- Multilingue et multidevise complets (OQ-6).
- Reversement automatisé aux artistes et tableau de bord de leurs gains (OQ-1, OQ-3).
- Prise de rendez-vous en temps réel sur un agenda.

## 7. Ce que la refonte n'est pas

- Ce n'est pas une refonte complète ni un changement de pile, par exemple vers Supabase : le site existant est amélioré.
- Ce n'est pas une boutique de décoration ni un catalogue ouvert à tous les artistes.
- Ce n'est pas une galerie qui achète et revend : l'artiste vend, Errancy est l'intermédiaire. Si le montage de paiement change cela, la décision revient au porteur.
- Ce PRD ne choisit ni prestataire de paiement ni entité juridique.
- La maintenance ne sera pas levée et `robots.txt` ne sera pas ouvert depuis le code.

## 8. Indicateurs de réussite

*Les objectifs chiffrés, sauf la première vente, sont fixés après la baseline (`docs/strategie-refonte.md` l.148). Le site étant en maintenance, aucune baseline n'existe : elle est relevée dès la réouverture.*

**Principaux**
- **SM-1 Première vente réelle.**
  - Définition : une commande payée par un acheteur extérieur au cercle du porteur et des artistes, livrée, et passée au-delà du délai de retour sans litige.
  - Objectif : dans les 12 semaines du calendrier indicatif, c'est-à-dire avant la fin de la phase 4. Le point de départ sera fixé avec la date de lancement (OQ-11).
  - Valide FR-1 à FR-15 et FR-22.
- **SM-2 Taux de conversion.**
  - Définition : commandes confirmées divisées par le nombre de visiteurs ayant vu au moins une fiche œuvre, sur 30 jours glissants.
  - Objectif : fixé après la baseline.
  - Valide FR-1 à FR-13 et FR-27.

**Secondaires**
- **SM-3 Demandes qualifiées et ventes assistées.**
  - Définition : nombre de conseils WhatsApp et de demandes de visite par semaine, et part des commandes précédées d'un conseil.
  - Ce qu'il permet de vérifier : l'hypothèse que la diaspora préfère WhatsApp.
  - Valide FR-7, FR-8 et FR-28.
- **SM-4 Complétude des fiches.**
  - Définition : part des œuvres publiées qui ont tous les champs de FR-1 à FR-5.
  - Objectif : 100 %, c'est la condition de sortie du Lot 1.
  - Valide FR-20.
- **SM-5 Panier moyen.**
  - Définition : montant moyen d'une commande confirmée.
  - Il sert à suivre la marge contributive par œuvre.

**Garde-fous (à ne pas optimiser)**
- **SM-C1 Doubles ventes.**
  - Cible : zéro, sans exception.
  - Il équilibre SM-1 et SM-2 : on ne gagne pas en conversion en assouplissant la réservation.
- **SM-C2 Taux de retours et de litiges.**
  - Ce qu'on surveille : retours, casse, couleurs « différentes de l'écran », délais dépassés.
  - Il équilibre SM-2 : promettre trop pour convertir se paie en retours, et l'artiste expédie lui-même.
- **SM-C3 Délai réel de réponse au conseil WhatsApp.**
  - Ce qu'on surveille : l'écart avec le délai annoncé.
  - Il équilibre SM-3 : un canal saturé ou lent détruit la promesse qu'il est censé porter.

## 9. Questions ouvertes

*« Bloquant » veut dire que la FR concernée ne peut pas être spécifiée en détail ni livrée sans réponse.*

1. **OQ-1. Montage de paiement et entité d'exploitation.**
   - **Bloquant pour :** FR-14, l'identité de l'exploitant dans FR-23, et le reversement aux artistes.
   - **Questions à trancher :**
     - Qui encaisse, dans quel pays et sous quelle forme juridique ?
     - Avec quel prestataire ?
     - Comment l'artiste est-il payé selon son pays ?
   - **État :** l'étude recommande une société d'exploitation au Royaume-Uni ou aux États-Unis, avec des versements par paliers. Ce n'est qu'une recommandation : un avis juridique et comptable marocain est requis avant toute décision (`docs/decisions-porteur.md` l.17).
   - **Décision :** le porteur, après l'avis juridique.
   - **Tension à arbitrer :** l'étude propose une « galerie qui encaisse, puis reverse », alors que le porteur a posé Errancy en intermédiaire. Il faut vérifier que le montage retenu reste compatible avec ce statut.
2. **OQ-2. Qui porte les garanties ?**
   - **Bloquant pour :** le contenu de FR-24.
   - **Questions à trancher :** qui porte l'authenticité, la conformité et la casse ? Une « Garantie Errancy » est-elle compatible avec le rôle d'intermédiaire ?
   - **Lien :** dépend de OQ-1.
3. **OQ-3. Assiette de la commission et frais de paiement.**
   - **Bloquant pour :** les reversements et l'affichage des gains de l'artiste.
   - **Questions à trancher :** les 30 % portent-ils sur l'œuvre seule ou livraison incluse ? Qui paie les frais de paiement ?
4. **OQ-4. Politique de retour.**
   - **Bloquant pour :** FR-24.
   - **Questions à trancher :**
     - Le retour est-il gratuit, ou donne-t-il lieu à un avoir ?
     - Qui paie le retour vers l'artiste ?
     - Quand l'artiste est-il payé : à la livraison, ou à la livraison plus 14 jours ?
5. **OQ-5. Livraison.**
   - **Questions à trancher :** quelles zones ? Qui gère la douane et l'assurance ? Que se passe-t-il en cas de casse ?
   - **Valeur par défaut** `[ASSUMPTION]` : l'artiste fixe ses frais et ses délais par zone.
6. **OQ-6. Langues et devises.**
   - **Questions à trancher :** quelles langues et quelles devises en plus du français et de l'euro ? Affichage seulement, ou aussi encaissement ?
   - **Lien :** dépend en partie de OQ-1.
7. **OQ-7. Conseil WhatsApp.**
   - **Bloquant pour :** la mise en ligne de FR-7.
   - **Questions à trancher :** quel numéro WhatsApp Business ? Qui répond, à quelles heures, avec quel délai annoncé ?
   - **État (2026-10-24) :** le porteur ne sait pas encore. Bloquant pour l'ouverture au public, pas pour l'UX ni l'architecture.
8. **OQ-8. Visites.**
   - **Questions à trancher :** existe-t-il un showroom ? Les visites se font-elles à distance seulement, ou aussi en atelier ? Avec qui (artiste ou conseiller) ?
9. **OQ-9. Outil d'analytique.**
   - **Questions à trancher :** PostHog ou GA4, en tenant compte du consentement.
   - **Décision :** à trancher dans `bmad-architecture`.
10. **OQ-10. Catalogue de lancement.**
    - **Bloquant pour :** l'ouverture du Lot 1.
    - **Questions à trancher :** combien d'œuvres et d'artistes ? Quelle fourchette de prix ? Les accords écrits sont-ils signés et les droits sur les images obtenus ? Qui prend les photos de mise en situation ?
    - **État (2026-10-24) :** le porteur ne sait pas encore. Bloquant pour l'ouverture au public, pas pour l'UX ni l'architecture.
11. **OQ-11. Date de lancement, budget et ressources.**
    - **Questions à trancher :** quelle date de lancement, quel budget mensuel, combien de personnes disponibles pour le conseil et le suivi des commandes ?
    - **État (2026-10-24) :** le porteur ne sait pas encore. Sans date, l'objectif de SM-1 n'a pas de point de départ.
12. **OQ-12. Démarrer sans paiement intégré ?**
    - **Questions à trancher :** ouvrir avec un conseil WhatsApp, puis une réservation et un lien de paiement pour les premières ventes, avant que le Lot 2 soit prêt ?
    - **État :** l'étude paiement le recommande (R4) ; c'est une option liée à OQ-1, pas une décision.
13. **OQ-13. Pays du visiteur.**
    - **Questions à trancher :** le pays est-il déduit automatiquement (et proposé), ou choisi par le visiteur à la première visite ?
14. **OQ-14. Partage des rôles entre curation et autonomie de l'artiste.**
    - **Questions à trancher :** qui rédige les pages artistes ? Errancy peut-elle modifier une fiche déposée par un artiste ?
15. **OQ-15. Sortie de maintenance.**
    - **Questions à trancher :** quels critères le porteur retient-il pour lever `MAINTENANCE_MODE` et ouvrir `robots.txt` ? Par exemple : Lot 1 complet, catalogue réel publié, mesure en place.

## 10. Conformité et cadre réglementaire

- **Droit de rétractation de 14 jours** pour les acheteurs de l'UE, ou un équivalent selon le pays. Il est repris dans les CGV (FR-23).
- **RGPD et consentement aux cookies** pour les visiteurs de l'UE (NFR-6).
- **Statut d'intermédiaire** : les CGV et les mentions légales décrivent l'artiste comme vendeur.
- **Droit d'auteur** : les photos des œuvres ne sont publiées qu'avec l'accord de l'artiste. Les éditions et reproductions sont exclues sans autorisation écrite des ayants droit.
- **Réglementation des changes marocaine et encaissement pour le compte de tiers** : relèvent de OQ-1 et de l'avis juridique. Aucune exigence n'est fixée ici.

## 11. Risques

| Risque | Gravité | Réponse dans ce PRD |
|---|---|---|
| Le montage de paiement tarde et bloque la première vente | Élevée | Lot 1 indépendant (§6.1) ; option OQ-12 à arbitrer |
| Double vente, aggravée par les ventes hors site des artistes | Élevée | FR-12, FR-13, FR-21, NFR-4, SM-C1 |
| Retards ou casse, puisque l'artiste expédie | Élevée | FR-4, FR-20, FR-22, FR-26, SM-C2 ; OQ-5 |
| Catalogue réel ou accords d'artistes absents au lancement | Élevée | FR-16 ; OQ-10 bloquant pour le Lot 1 |
| Promesse de conseil non tenue (aucun répondant) | Moyenne | FR-7 avec délai annoncé, SM-C3 ; OQ-7 |
| Perte de référencement lors des changements d'URL | Moyenne | NFR-2 |
| Refaire au lieu d'améliorer | Élevée | NFR-7, §7 |

## 12. Index des hypothèses

- §1 : les six freins à l'achat sont déduits des sources ; le porteur a renvoyé la question.
- §2.3 : les personnages Yasmine, Karim, Salma et Thomas, et leurs détails (devise affichée, délai d'expédition de 48 h).
- FR-3 : pays de livraison déduit, puis modifiable.
- FR-7 : WhatsApp Web ou QR code sur ordinateur.
- FR-12 : durée de réservation d'environ 30 minutes.
- FR-19 : contenu des pages artistes fourni par l'artiste et validé par Errancy.
- FR-22 : notification de vente à l'artiste par WhatsApp en plus de l'e-mail.
- FR-26 : signalement après 48 h sans expédition.
- NFR-1 : LCP mobile inférieur à 2,5 s.
- NFR-3 : niveau WCAG 2.1 AA.
- OQ-5 : frais et délais fixés par l'artiste, zone par zone.
