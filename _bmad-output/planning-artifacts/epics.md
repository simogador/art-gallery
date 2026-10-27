---
status: final
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/specs/spec-art-gallery/SPEC.md
  - _bmad-output/specs/spec-art-gallery/capability-map.md
  - _bmad-output/planning-artifacts/prds/prd-art-gallery-2026-10-24/prd.md
  - _bmad-output/planning-artifacts/prds/prd-art-gallery-2026-10-24/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-art-gallery-2026-10-27/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-art-gallery-2026-10-26/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-art-gallery-2026-10-26/EXPERIENCE.md
---

# Errancy (art-gallery) - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Errancy (art-gallery), decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

Les identifiants FR, NFR, AD, CAP, OQ, AQ et UXQ sont ceux des documents d'origine. Le détail testable de chaque FR reste dans `prd.md`, qui fait foi. **OQ-1 (montage de paiement) et OQ-16 (paiement unique ou par commande) restent ouvertes.**

## Requirements Inventory

### Functional Requirements

FR-1: Le visiteur voit les dimensions en cm et en pouces, l'orientation et le format (petit, moyen ou grand). Les seuils de format sont fixés par l'équipe. Une œuvre sans dimensions ne peut pas être soumise à la curation.
FR-2: Le visiteur voit au moins une photo de mise en situation avec repère d'échelle, un gros plan et une photo en lumière du jour. Ces photos et la fidélité de leurs couleurs sont vérifiées en curation, et elles sont optimisées pour le mobile.
FR-3: Le visiteur voit le prix total pour son pays (pays proposé d'office et modifiable, OQ-13), en euros, avec la mention « droits et taxes d'import éventuels non inclus ». Le prix affiché égale le montant demandé à la commande. Si l'artiste ne livre pas ce pays, la fiche le dit et propose le Conseil WhatsApp à la place de « Acheter ».
FR-4: Le visiteur voit le délai total vers son pays, en fourchette de jours (délai de préparation + délai de transport de la zone).
FR-5: Le visiteur voit l'histoire courte, la disponibilité, « sélectionnée par Errancy », le certificat, un résumé de la politique de retour, un lien vers l'artiste et vers les pages de confiance. Aucune durée ni gratuité de retour n'est affichée tant qu'OQ-2 et OQ-4 sont ouvertes.
FR-6: Les actions affichées suivent la disponibilité (disponible, réservée, vendue ou vendue ailleurs, retirée), dans une barre fixe sur mobile. « Acheter » est absent tant que le Lot 2 n'est pas ouvert. Une fiche retirée redirige vers la page de l'artiste. Chaque action émet un événement de mesure.
FR-7: Conseil WhatsApp depuis la fiche, la page artiste, le panier, le suivi et le pied de page, avec un message prérempli (référence et lien de l'œuvre) et le délai de réponse affiché (heures de service comprises). Sur ordinateur : WhatsApp Web ou QR code. Repli par un formulaire (FR-8) tant qu'OQ-7 est ouverte.
FR-8: Demande de visite (à distance, ou en atelier si l'artiste l'accepte, avec des créneaux) ou de sélection personnalisée (espace, goût, budget). Accusé par e-mail avec le délai. Suivi en administration (`nouvelle`, `planifiée`, `faite`, `sans suite`). Les coordonnées de l'artiste ne sont jamais communiquées.
FR-9: Le visiteur laisse son e-mail sur une œuvre réservée et il est prévenu si la réservation expire, dans l'ordre d'inscription, avec un court délai de priorité.
FR-10: Panier et commande sans compte ; `/panier` est public. Seuls l'e-mail, le nom, l'adresse et le téléphone sont demandés. Le panier peut réunir plusieurs artistes en un seul passage en caisse et produit une commande par artiste. Paiement en une fois si le montage le permet, sinon à la suite (OQ-1). Le récapitulatif indique les colis séparés. Une œuvre devenue indisponible est signalée et ne peut pas être commandée.
FR-11: Le récapitulatif montre, pour chaque œuvre, son prix, les frais de livraison, le prix total, le délai total, l'artiste, et rappelle les garanties et les conditions de retour. Les montants sont recalculés côté serveur.
FR-12: Réservation d'environ 30 min au paiement, ou d'environ 48 h quand l'équipe la pose pour une vente assistée. Un seul acheteur obtient l'œuvre en cas de tentatives simultanées. Une commande est réservée en bloc ou pas du tout. Une réservation expirée est libérée automatiquement. Le nombre de réservations simultanées par e-mail ou par appareil est limité, et chaque réservation est journalisée.
FR-13: La commande passe en `confirmée` sur confirmation du prestataire côté serveur, ou sur constat de l'équipe (qui, quand, référence), et l'œuvre passe en `vendue`. Une confirmation reçue plusieurs fois ne crée qu'une commande. Un paiement arrivé après expiration vend l'œuvre si elle est encore disponible, sinon il donne lieu à un remboursement et à un incident SM-C1. L'acheteur reçoit un e-mail de confirmation.
FR-14: L'acheteur paie le prix total par un moyen de paiement accepté à l'international. **Bloqué par OQ-1.**
FR-15: Suivi de commande sans compte, par un lien envoyé par e-mail : état et numéro de suivi, contact de l'équipe, signalement d'un problème. Le jeton est impossible à deviner et expire après la clôture. Le minimum de données personnelles est affiché.
FR-16: Seuls des œuvres et des artistes réels, publiés après curation, apparaissent. Aucune page publique ne lit de données de démonstration ; les images sans droits sont supprimées. Chaque artiste publié a signé un accord écrit.
FR-17: Filtres : prix total pour le pays, format, orientation, couleur dominante, ambiance, technique, artiste, pays de l'artiste, disponibilité. Choix de l'unité d'affichage (cm ou pouces).
FR-18: L'accueil montre une sélection curatoriale et les nouveautés ; une fiche œuvre est à un clic.
FR-19: Page artiste : portrait, démarche, formation, expositions, photo d'atelier, œuvres disponibles et mention de la sélection. Gérée par l'équipe (OQ-14).
FR-20: Dépôt d'une œuvre complète :
- description : titre, technique, année, histoire courte, dimensions, couleur dominante, ambiance, prix ;
- photos : mise en situation, gros plan, lumière du jour, vidéo facultative ;
- livraison : frais, délai de préparation et délai de transport par zone, et acceptation des visites en atelier ;
- engagements : certificat, emballage, reprise en cas de retour.

Soumission impossible tant qu'un champ obligatoire manque ; publication seulement après validation.
FR-21: L'artiste passe une œuvre en `vendue ailleurs` ou `retirée` à tout moment, même si elle est réservée. Le serveur refuse aussitôt toute nouvelle réservation ou commande, et le site l'affiche en moins de 60 s. Une réservation en cours est annulée et l'acheteur prévenu (remboursé s'il avait payé) ; l'équipe est alertée et l'incident est compté dans SM-C1.
FR-22: L'artiste est prévenu de chaque commande. Il confirme la prise en charge sous 48 h (la commande passe en `prise en charge`), puis expédie avant la fin du délai de préparation et saisit le numéro de suivi (la commande passe en `expédiée` et l'acheteur est prévenu). L'adresse lui est visible seulement entre la prise en charge et la livraison.
FR-23: CGV, mentions légales, politique de confidentialité, politique de cookies. Les CGV présentent l'artiste comme vendeur et traitent la rétractation selon le pays. Identité de l'exploitant **bloquée par OQ-1**.
FR-24: Pages Livraison, Retours, Authenticité et certificat, liées depuis les fiches et le récapitulatif. Leur contenu suit OQ-2, OQ-4 et OQ-5 ; aucune « Garantie Errancy » tant qu'OQ-2 ne la permet pas.
FR-25: Curation : valider ou renvoyer une œuvre avec un commentaire, selon une liste de contrôle (photos, couleurs, champs complets, cohérence prix et zones). L'administration montre aussi les demandes avec leur état et les inscriptions « Me prévenir ».
FR-26: L'équipe voit chaque commande (état, artiste, délais attendus, suivi, réclamations, remboursements), les réservations en cours et leur journal. Elle pose une réservation de vente assistée, confirme, annule avec un motif et libère une réservation. Une prise en charge manquante après 48 h et une expédition manquante sont signalées séparément.
FR-27: Événements du tunnel : vue d'une fiche, choix du pays, clic sur WhatsApp, envoi d'une demande, ajout au panier, début de commande, commande confirmée. Chacun porte le slug de l'œuvre et la source d'arrivée. Ils ne partent qu'avec consentement là où la loi l'exige, et le taux de consentement est suivi.
FR-28: L'équipe rattache une commande au conseil ou à la visite qui l'a précédée ; une commande issue d'une réservation posée par l'équipe y est rattachée automatiquement.
FR-29: La commande passe en `livrée` sur confirmation de l'acheteur, suivi du transporteur ou preuve. Au-delà d'un seuil de prix (OQ-5), assurance et preuve de livraison sont obligatoires. La date de livraison ouvre le délai de retour.
FR-30: Réclamation depuis le suivi pendant le délai de retour (œuvre abîmée, non conforme, changement d'avis). L'équipe la traite et organise le renvoi à l'artiste. Durée, frais et choix entre remboursement et avoir suivent OQ-4 ; la casse suit OQ-2.
FR-31: Remboursement total ou partiel avec motif (annulation, vendue ailleurs, paiement après réservation perdue, retour accepté). États `demandé` et `effectué`, avec l'acheteur prévenu à chaque changement. Le moyen de rembourser est **bloqué par OQ-1**.
FR-32: Somme due à l'artiste, date d'exigibilité (la clôture) et état du reversement (`à verser`, `versée`, `bloquée`), visibles par l'équipe et par l'artiste. Calcul selon OQ-3, versement selon OQ-1.
FR-33: Une commande `livrée` passe en `close` à la fin du délai de retour sans réclamation. Une commande `annulée` ou `retournée` passe en `close` après le remboursement. Durée selon OQ-4.
FR-34: L'invitation crée un compte `artist` rattaché à la fiche de l'artiste. Un artiste n'accède qu'à ses propres œuvres et commandes, contrôle fait côté serveur. Un changement de rôle prend effet sans reconnexion.
FR-35: Le formulaire « Me notifier » de la page de maintenance enregistre les e-mails avec consentement, et ces contacts sont prévenus à l'ouverture.

### NonFunctional Requirements

NFR-1: Performance mobile. Fiches et catalogue rapides en 4G, avec images au bon format et chargées au défilement ; LCP < 2,5 s `[ASSUMPTION]`.
NFR-2: Référencement. Métadonnées, URL canonique en français et sitemap pour chaque fiche et page artiste ; redirection 301 à chaque changement d'URL. Lever la maintenance et ouvrir `robots.txt` sont des actes du porteur.
NFR-3: Accessibilité. Clavier, contrastes, libellés, texte alternatif sur les images d'œuvres ; WCAG 2.1 AA `[ASSUMPTION]`.
NFR-4: Fiabilité de la vente. Aucune double vente : réservation et confirmation atomiques et idempotentes. Trois cas testés avant le Lot 2 : achat simultané, paiement après expiration, vente ailleurs pendant une réservation.
NFR-5: Sécurité. Next.js mis à jour ; accès par rôle contrôlé côté serveur sur toutes les actions ; secrets hors du dépôt ; données des acheteurs visibles seulement par l'équipe et, pendant la livraison, par l'artiste concerné.
NFR-6: Données personnelles. Collecte minimale, consentement aux cookies de mesure, durée de conservation avec purge, transfert encadré des adresses vers des artistes hors UE.
NFR-7: Migration progressive. Sauvegarde restaurable, correspondance vérifiée, redirections 301, bascule répétée en préproduction, retour arrière testé. Les fonctions critiques restent opérationnelles à chaque étape ; pas de changement de pile.
NFR-8: Langue et devise. Interface et URL en français, prix en euros, conception prête pour d'autres langues et devises (OQ-6).

### Additional Requirements

Issues de `ARCHITECTURE-SPINE.md`. Pas de modèle de démarrage : projet brownfield, la pile est conservée.

**Socle (à faire en premier, CAP-20)**
- AR-1 (pile, NFR-5) : passer Next.js de 14.2.5 à 14.2.35 ; passer Node à 24 LTS (`engines.node`, réglage Node du projet Vercel, `@types/node` 24) ; épingler Prisma en `~7.10`, sans jamais utiliser `@latest`.
- AR-2 (AD-20) : créer une migration Prisma de ligne de base, car `Order` et `Artist.userId` sont dans le schéma mais dans aucune migration (diff, puis marquée appliquée en production). `migrate deploy` ne s'exécute qu'à un seul endroit, jamais dans le build Vercel.
- AR-3 (AD-23) : Vitest, avec des tests de modules sur un vrai PostgreSQL jetable. GitHub Actions lance `eslint .`, `npm run build` et les tests à chaque PR. AGENTS.md est mis à jour (CI et tests existent désormais).
- AR-4 (AD-1) : règle ESLint `no-restricted-imports`, qui réserve Prisma à `src/lib/<module>/**` et `src/auth.ts`, avec des motifs par alias et relatifs. Liste d'exceptions pour les 22 fichiers existants ; elle ne fait que diminuer.
- AR-5 (AD-17, AD-4) : interrupteur du Lot 2 côté serveur (variable Vercel lue par `reglages`). Le chemin d'achat actuel (`POST /api/checkout`, bouton du panier, appel Stripe de `confirmation/page.tsx`) passe sous cet interrupteur, fermé.
- AR-6 (AD-22, AQ-3) : vérifier quelle base utilisent les préversions Vercel ; si c'est celle de production, basculer sur une branche Neon. Hors production, adaptateurs en mode test ou journal.
- AR-7 (AD-15) : le middleware ne vérifie plus que la session sur `/dashboard/**`. Rôle relu en base par `acces`, redirections par rôle dans les layouts. `/panier` sort des routes protégées au Lot 2 (AD-13).

**Structure et règles transverses**
- AR-8 (AD-1, AD-2, AD-3) : modules `src/lib/<module>/` (catalogue, curation, disponibilite, livraison, commandes, paiement, demandes, acces, evenements, notifications, mesure, reglages), chacun avec une API publique dans `index.ts` et un seul propriétaire par donnée. Le sens des dépendances suit le diagramme du spine. Les fichiers existants migrent au fil des epics.
- AR-9 (AD-11) : journal d'événements (outbox) avec un catalogue typé unique, une réclamation atomique (événement, gestionnaire), la répartition après réponse par `waitUntil` (Next 14) puis `after()` (Next 16), un balayage via `api/balayage` (déclencheur selon AQ-2), et `src/lib/abonnements.ts`.
- AR-10 (AD-5, AD-20) : migrations en quatre temps vers des centimes entiers + devise, des dimensions en mm, deux axes d'état (publication, disponibilité) et l'éclatement d'`Order` en passage en caisse, commande, ligne de commande et paiement.
- AR-11 (AD-18) : dictionnaire français typé et fonctions de formatage communes (`src/lib/i18n/`) ; aucune chaîne en dur.
- AR-12 (AD-19) : port Mesure avec consentement, adaptateur PostHog hébergé dans l'UE ; aucune URL à jeton n'est mesurée.
- AR-13 (AD-21) : cache au niveau des données, avec étiquettes par œuvre et par artiste (≤ 60 s) et invalidation par gestionnaire d'événement. Les pages qui affichent un prix se rendent par requête, avec le cookie `pays`.
- AR-14 (AD-14) : jetons dans `acces` (≥ 256 bits, empreinte SHA-256, usages `suivi`, `invitation`, `desinscription` et `commande_assistee`). Échange contre un cookie `httpOnly` et redirection, `Referrer-Policy: no-referrer`.
- AR-15 (AD-4) : module paiement avec les ports Encaissement, Remboursement et Reversement, l'adaptateur `constat-manuel`, l'adaptateur `stripe-checkout` issu du code actuel, l'idempotence par Paiement (`ouvert` → `constate`) et une paire (source, référence externe) unique.
- AR-16 (AD-7, AD-8, AD-9, AD-24) : réservation conditionnelle en bloc par passage en caisse, index unique partiel (préversion `partialIndexes`), prédicat de disponibilité effective, confirmation tout ou rien par commande, échéance d'abandon, table de transitions et somme due calculée en un seul endroit.
- AR-17 (conventions) : mutations par actions serveur et route handlers pour les appels externes ; résultats `{ ok, code }` ; ni données personnelles ni jetons dans les journaux ; limitation des envois de formulaires publics.

**Questions ouvertes qui conditionnent des stories :** OQ-1, OQ-16 (paiement) ; OQ-3, OQ-5 (avant le Lot 2, zones avant l'ouverture du Lot 1) ; OQ-7 (WhatsApp) ; OQ-12 ; AQ-1 (e-mails, avant le premier epic qui envoie un e-mail) ; AQ-2 (plan Vercel, avant FR-9) ; AQ-4 (Neon, avant la première migration de données) ; AQ-5, AQ-6.

### UX Design Requirements

Issues de `DESIGN.md` (apparence) et `EXPERIENCE.md` (comportement).

**Fondations visuelles et transverses**
- UX-DR1 : Jetons. Garder la palette et les polices de `tailwind.config.ts`. Ajouter `heading-sm`, `body-strong`, `price-lg`, `label-caps`, `caption`, `button` et `input`, ainsi que `spacing.touch-target` (44 px) et `gutter-mobile`. L'or reste décoratif : jamais en texte, en fond de bouton, en focus ou en état. Aucun texte en `neutral-400` ; le gris le plus clair pour du texte est `neutral-500`, jamais sur `neutral-200`. Aucune couleur d'état, aucun mode sombre. Coins à 2 px ; `rounded.full` est réservé aux pastilles. Interface plate : seul `shadow-premium` est admis, pour un élément superposé.
- UX-DR2 : Focus visible (contour noir 2 px, décalage 2 px, jamais or) et lien d'évitement vers le contenu.
- UX-DR3 : Propriétés CSS logiques partout (`inline-start`/`inline-end`), sans `left`/`right` codés en dur.
- UX-DR4 : Mouvement limité à `fade-in` (400 ms) et `scale-in` (450 ms), coupé sous `prefers-reduced-motion`. Ni parallaxe, ni lecture automatique, ni rebonds.
- UX-DR5 : Typographie. Titre de fiche en `display-sm` sur mobile, titre d'écran de service en `display-xs`, champs à 16 px, 12 px au minimum. Espaces fines insécables (« 1 450 € », « 15 h 42 »). Environ 65 caractères par ligne pour l'histoire courte sur grand écran.
- UX-DR6 : Socle d'accessibilité. Tout atteignable au clavier, dans l'ordre de lecture. Erreurs reliées par `aria-describedby`. Boutons nommés par leur action. États jamais portés par la couleur seule. Recalculs annoncés (`aria-live="polite"`). Cibles de 44 × 44 px. Zoom à 200 % sans défilement horizontal. `lang="fr"`.
- UX-DR7 : Texte alternatif des photos d'œuvre (œuvre, artiste, prise de vue), proposé à partir des métadonnées du dépôt et vérifié en curation.
- UX-DR8 : Voix et ton. Microcopie sobre, précise et chaleureuse, au vouvoiement. Interdits : compte à rebours, « dernière chance », promotions, prix barrés, « Garantie Errancy », durée ou gratuité de retour tant qu'OQ-2 et OQ-4 sont ouvertes, nom d'un prestataire de paiement, tutoiement, jargon (« jeton », « session », « webhook »), « Oups ». Les phrases de référence sont celles du tableau de EXPERIENCE.md.
- UX-DR9 : Responsive.
  - Mobile (référence 375 px) : une colonne, galerie en 2 colonnes, barre d'actions fixe.
  - De `md` à `lg` : galerie en 3 colonnes.
  - À partir de `lg` : fiche en deux colonnes (photos à gauche, bloc d'actions collant à droite), panier en deux colonnes, galerie en 4 colonnes, navigation latérale pour l'espace artiste et l'administration.
- UX-DR10 : Préparation à l'international. Pays de livraison proposé d'office et modifiable, qui pilote prix, délai, filtres et panier. Bascule cm/in. Euros seulement ; aucun sélecteur de langue ni de devise.

**Composants**
- UX-DR11 : `site-header` avec « Menu », la marque et « Panier (n) » à partir du Lot 2, plus « ‹ [écran précédent] » sur les écrans profonds. Pas d'icône favoris.
- UX-DR12 : `action-bar`, barre d'actions fixe.
  - Contenu selon la disponibilité et le lot : Lot 1 = WhatsApp en action principale et visite en secondaire, « Acheter » absent ; Lot 2 = « Acheter » en action principale.
  - Panier et coordonnées : « Continuer », avec en sous-ligne le total et le nombre de commandes.
  - Masquée quand le clavier est ouvert.
- UX-DR13 : `button-primary`, `button-secondary`, `button-disabled`. Une seule action principale par écran. Un bouton indisponible indique toujours sa raison. Pendant un envoi, libellé « Envoi… » et doubles appuis ignorés.
- UX-DR14 : `whatsapp-button`. Sous-ligne « Réponse en moins de [délai] · [horaires] » ; hors horaires, « Réponse demain à partir de [HH] h ». Message prérempli (slug et lien de l'œuvre, ou numéro de commande). WhatsApp Web ou QR code sur ordinateur. Repli vers le formulaire FR-8 au même emplacement. Ni vert, ni logo en couleur.
- UX-DR15 : `tile-row`. Trois cases (Taille, Prix livré, Délai) sous la première photo, avec liseré or, libellés en capitales, « Modifier » le pays (recalcule les trois cases) et la mention des droits et taxes. Chiffres identiques à ceux des sections dépliables.
- UX-DR16 : `disclosure`. Quatre sections natives `details`/`summary` dans un ordre fixe : « Ira-t-elle chez moi ? », « Combien au total ? », « Quand la recevrai-je ? », « Est-ce sérieux ? ». Seule la première est ouverte à l'arrivée, et l'état ne se mémorise pas.
- UX-DR17 : `photo-carousel`. Première photo = mise en situation, pleine largeur. Balayage au doigt et boutons précédent/suivant. Jamais de défilement automatique. Plein écran avec zoom (`scale-in`). Points, compteur « 1/4 » et légende de la prise de vue.
- UX-DR18 : `availability-label` (point et libellé « Disponible », « Réservée », « Vendue »), mis à jour en moins de 60 s. Aucune heure de fin montrée aux autres visiteurs.
- UX-DR19 : `status-badge` et ses variantes, par style de trait et toujours avec un libellé : Publiée, En curation, Brouillon, Réservée et Vendue ailleurs, Vendue, Retirée. Même badge pour les états de commande.
- UX-DR20 : `filter-chip` et panneau « Modifier les filtres » (les 9 filtres de FR-17). « × » retire un filtre. Rappel « N œuvres · prix livré [pays] ». Filtres dans l'URL.
- UX-DR21 : `unit-toggle` cm/in pour tout le site, mémorisé sur l'appareil. Les deux unités restent visibles sur la fiche.
- UX-DR22 : `artwork-card`. Toute la carte est une seule cible. Elle affiche artiste, dimensions, prix livré et délai pour le pays choisi. Ni prix barré, ni étiquette promotionnelle.
- UX-DR23 : `order-card` et `total-row`. Une carte numérotée par artiste : sous-total (œuvres + livraison), délai, ville d'expédition, colis séparé. Total général rappelé en clair (« 2 400 € + 680 € »), avec la mention des droits et taxes. Recalcul annoncé quand le pays change.
- UX-DR24 : `unavailable-line`. Titre barré, « Vendue entre-temps — retirée de votre commande. », lien vers les œuvres proches et trois vignettes. Les autres commandes restent intactes ; total, nombre de colis et heure de réservation sont recalculés et annoncés. Aucune modale.
- UX-DR25 : `info-banner`. Un fait, `role="status"`, au plus un lien d'action (« Annuler »), trait or en `border-inline-start`.
- UX-DR26 : `form-field`.
  - Libellé visible ; `type` et `autocomplete` adaptés.
  - Validation à la sortie du champ et à l'envoi, jamais à la frappe ; la saisie est conservée après une erreur.
  - Champ manquant : bordure en tirets et « À compléter · ».
- UX-DR27 : `photo-slot`. Une case par prise de vue attendue, avec sa légende. Ajout depuis l'appareil photo ou la galerie, et « Remplacer ».
- UX-DR28 : `neutral-zone`. Hachures, jamais interactive. Elle nomme ce qui n'est pas décidé : paiement, moyen de versement, adresse masquée.
- UX-DR29 : `status-timeline`. Étapes du glossaire, avec la date réelle des étapes faites et la date prévue de la livraison.
- UX-DR30 : `confirm-sheet`.
  - Monte du bas, « Annuler » à gauche, « Confirmer » à droite.
  - Échap ou un appui sur le voile ferme sans agir, puis le focus revient à l'élément d'origine.
  - Jamais deux feuilles empilées. Voile : UXQ-5.
- UX-DR31 : `availability-picker` sur la ligne d'une œuvre publiée ou réservée : Disponible, Vendue ailleurs, Retirer de la vente. Le choix ouvre `confirm-sheet`.
- UX-DR32 : `artist-tabbar`. Accueil, Œuvres, Commandes, Paiements, avec `aria-current="page"`. Navigation latérale à partir de `lg`.
- UX-DR33 : `count-badge`, nombre de commandes à prendre en charge, masqué à zéro.
- UX-DR34 : `ornament-rule`, filet or de 40 px en `aria-hidden`.

**Écrans, états et parcours**
- UX-DR35 : Formulaire de dépôt bloquant, sur une seule page en cinq sections :
  1. Photos.
  2. Informations, dont l'ambiance.
  3. Dimensions et prix, avec pouces et orientation calculés.
  4. Expédition par zone, avec « Je ne livre pas cette zone » et les visites en atelier.
  5. Engagements, dont la reprise.

  Progression « N sections sur 5 complètes » et brouillon enregistré automatiquement. « Il manque N éléments pour envoyer : » suivi de liens qui placent le focus sur le champ concerné. « Reprendre les zones de ma dernière œuvre ».
- UX-DR36 : Sept états d'œuvre côté artiste, avec leurs actions : Annuler « Vendue ailleurs » seulement si aucune réservation n'a été interrompue, et remettre en vente une œuvre retirée la renvoie en curation. Bandeaux « Retirée de la vente à 10 h 12. » et message du cas FR-31.
- UX-DR37 : Réservation affichée en heure fixe dans le fuseau de l'appareil : « Œuvres réservées pour vous jusqu'à 15 h 42. » À l'échéance : « Votre réservation a pris fin à 15 h 42. », puis « Continuer » relance la réservation. Ni compte à rebours ni couleur.
- UX-DR38 : États vide, chargement et erreur pour la galerie, la fiche, le panier, les formulaires, le paiement, le suivi, l'invitation, l'espace artiste, l'administration et la maintenance, selon le tableau de EXPERIENCE.md. Les montants du panier restent masqués tant qu'ils ne sont pas recalculés.
- UX-DR39 : Galerie. Bouton « Afficher plus d'œuvres », sans défilement infini. Le retour arrière reste fiable : filtres, pays et unités dans l'URL ou mémorisés.
- UX-DR40 : Espace artiste. Accueil en trois blocs dans l'ordre de l'urgence : À expédier, Mes œuvres, Ce qu'on vous doit. Commande avant prise en charge : œuvre, prénom et pays de l'acheteur, échéance en heure fixe, adresse en zone neutre. « Je prends en charge » révèle l'adresse et le guide d'emballage. Saisie du transporteur et du numéro de suivi.
- UX-DR41 : « Ce qu'on vous doit ». Par commande : prix de l'œuvre, commission (assiette OQ-3), montant dû et état du reversement ; moyen de versement en zone neutre.
- UX-DR42 : Écrans d'administration légers : curation (valider, ou renvoyer avec commentaire), file des demandes (visites, sélections, « Me prévenir »), commandes et alertes (réservation assistée, confirmation, annulation avec motif, remboursement avec motif).
- UX-DR43 : Nouvelles URL de l'architecture de l'information : `/galerie/[id]/visite`, `/conseil`, `/livraison`, `/retours`, `/authenticite`, `/cgv`, `/mentions-legales`, `/confidentialite`, `/cookies`, `/commande/coordonnees`, `/commande/paiement`, `/suivi/[jeton]`, `/auth/invitation/[jeton]`, `/dashboard/artiste/commandes`, `/dashboard/artiste/paiements`, `/dashboard/admin/demandes`, `/dashboard/admin/commandes`.
- UX-DR44 : Contenu et déclencheurs des 12 e-mails transactionnels (tableau de EXPERIENCE.md), chacun avec un lien WhatsApp ou le repli FR-8.

### FR Coverage Map

FR-1: Epic 3 - Dimensions cm/pouces, orientation, format
FR-2: Epic 3 - Photos d'échelle et de matière (vérifiées en curation, Epic 2)
FR-3: Epic 3 - Prix total pour le pays choisi
FR-4: Epic 3 - Délai total
FR-5: Epic 3 - Histoire courte et signes de sérieux
FR-6: Epic 3 (états vendue et retirée) + Epic 4 (barre d'actions) ; « Acheter » activé en Epic 7
FR-7: Epic 4 - Conseil WhatsApp contextualisé
FR-8: Epic 4 - Demandes de visite et de sélection
FR-9: Epic 4 (inscription) + Epic 6 (priorité à l'expiration)
FR-10: Epic 7 - Panier et commande sans compte, une commande par artiste
FR-11: Epic 7 - Récapitulatif recalculé côté serveur
FR-12: Epic 6 - Réservation sans double vente
FR-13: Epic 6 - Confirmation fiable et idempotente
FR-14: Epic 7 - Encaissement (bloqué par OQ-1)
FR-15: Epic 7 - Suivi de commande par lien
FR-16: Epic 2 - Catalogue réel uniquement
FR-17: Epic 3 - Filtres et unités
FR-18: Epic 3 - Sélection curatoriale à l'accueil
FR-19: Epic 3 - Pages artistes
FR-20: Epic 2 - Dépôt d'œuvre complet
FR-21: Epic 2 (vendue ailleurs, retrait) + Epic 6 (annulation de réservation)
FR-22: Epic 8 - Prise en charge et expédition
FR-23: Epic 7 - Pages légales
FR-24: Epic 7 - Pages de confiance
FR-25: Epic 2 (curation) + Epic 4 (file des demandes)
FR-26: Epic 6 (réservations, confirmation) + Epic 8 (alertes, annulations)
FR-27: Epic 4 - Événements du tunnel avec consentement
FR-28: Epic 6 - Rattachement des ventes assistées
FR-29: Epic 8 - Livraison constatée
FR-30: Epic 8 - Réclamation et retour
FR-31: Epic 8 - Remboursement
FR-32: Epic 8 - Somme due à l'artiste
FR-33: Epic 8 - Clôture
FR-34: Epic 2 - Accès artiste sur invitation
FR-35: Epic 1 (enregistrement) + Epic 4 (e-mail d'ouverture)

## Epic List

### Lot 1 — conversion et catalogue (sans « Acheter »)

### Epic 1: Un site sûr, vérifié et prêt à recevoir des contacts
Le porteur dispose d'un site corrigé (Next.js 14.2.35, Node 24), dont chaque PR passe lint, build et tests sur un vrai PostgreSQL, dont l'historique de migrations correspond à la base, et dont le chemin d'achat actuel est fermé par l'interrupteur du Lot 2 ; les visiteurs de la page de maintenance laissent leur e-mail.
**FRs covered:** FR-35 ; AR-1 à AR-7 ; NFR-5, NFR-7, outillage de NFR-4.

### Epic 2: Les artistes invités déposent leurs œuvres, l'équipe les publie
L'équipe invite un artiste, qui dépose une œuvre complète ; l'équipe la valide ou la renvoie ; l'artiste tient la disponibilité de ses œuvres ; le catalogue de démonstration disparaît.
**FRs covered:** FR-16, FR-20, FR-21 (hors réservation), FR-25 (curation), FR-34 ; AR-8, AR-10, AR-14 (invitation) ; conditionné par AQ-4 et la composition des zones (OQ-5).

### Epic 3: Le visiteur trouve une œuvre et répond seul aux quatre questions
Fiche œuvre (échelle, prix livré pour le pays, délai, sérieux, barre d'actions du Lot 1), galerie filtrable, accueil curatorial, pages artistes ; SM-4 à 100 %.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6 (états vendue et retirée), FR-17, FR-18, FR-19 ; NFR-1, NFR-2, NFR-3, NFR-8 ; AR-9 (fondation du journal d'événements), AR-11, AR-13.

### Epic 4: Le visiteur hésitant parle à une personne, et l'équipe mesure ce qui fait vendre
Conseil WhatsApp (et son repli), demandes de visite et de sélection avec accusé, inscription « Me prévenir », file des demandes, événements du tunnel sous consentement (PostHog UE).
**FRs covered:** FR-6 (barre d'actions), FR-7, FR-8, FR-9 (inscription), FR-25 (demandes), FR-27, FR-35 (e-mail d'ouverture) ; NFR-6 ; AR-9 (e-mails), AR-12 ; envoi automatique des e-mails d'invitation et de curation de l'Epic 2 ; conditionné par AQ-1.

### Epic 5: Mise à niveau de la pile vers Next.js 16
React 19, `src/proxy.ts`, ESLint 9 en configuration plate, `after()` ; vérifié en préversion et réversible ; placé avant le Lot 2.
**FRs covered:** aucun FR ; NFR-5.

### Lot 2 — commande et après-vente

### Epic 6: L'équipe réserve une œuvre pour un acheteur et conclut une vente assistée
Réservation sans double vente, vente assistée avec lien de commande, confirmation par constat manuel tracé et idempotente, journal des réservations, rattachement au conseil, priorité « Me prévenir », annulation de réservation sur vendue ailleurs ; utilisable sans prestataire de paiement (option OQ-12).
**FRs covered:** FR-9 (effet), FR-12, FR-13, FR-21 (réservation), FR-26 (réservations et confirmation), FR-28 ; NFR-4 ; AR-15 (constat manuel), AR-16 ; conditionné par AQ-2.

### Epic 7: L'acheteur commande sans compte, auprès de plusieurs artistes, et suit ses commandes
Panier public, une commande par artiste, récapitulatif recalculé, coordonnées sans compte, paiement en zone neutre, confirmation, lien de suivi, pages de confiance et légales, activation de « Acheter ».
**FRs covered:** FR-6 (« Acheter », Lot 2), FR-10, FR-11, FR-14 (bloqué par OQ-1), FR-15, FR-23, FR-24 ; AR-14 (suivi), AR-15.

### Epic 8: Chaque commande est menée jusqu'à sa clôture, et l'artiste est payé
Prise en charge et expédition (adresse révélée au bon moment), alertes, livraison constatée avec preuve au-delà du seuil, réclamation, remboursement, clôture, somme due et « Ce qu'on vous doit ».
**FRs covered:** FR-22, FR-26 (alertes et annulations), FR-29, FR-30, FR-31, FR-32, FR-33 ; valeurs selon OQ-2, OQ-3, OQ-4 ; moyen de rembourser et de verser selon OQ-1.

## Epic 1: Un site sûr, vérifié et prêt à recevoir des contacts

Le porteur dispose d'un site corrigé, dont chaque changement est vérifié automatiquement et peut être annulé, qui n'accepte plus de vente non protégée, et dont la page de maintenance collecte réellement les contacts. Couvre FR-35, AR-1 à AR-7, NFR-5, NFR-7 et l'outillage de NFR-4.

### Story 1.1: Correctifs de sécurité et Node 24

En tant que porteur,
je veux que le site tourne sur une version corrigée de Next.js et sur un Node maintenu,
afin de ne plus exposer de failles connues ni dépendre d'un environnement déprécié par Vercel.

**Acceptance Criteria:**

**Étant donné** le projet en Next.js 14.2.5 et sans version de Node déclarée
**Quand** la story est livrée
**Alors** `next` et `eslint-config-next` sont en 14.2.35, `engines.node` vaut `>=22.12` (cible 24 LTS), `@types/node` est en 24, et Prisma est épinglé en `~7.10` (AR-1)
**Et** `npm run lint` et `npm run build` passent, les `DatabaseNotReachable` sans `DATABASE_URL` n'étant pas un échec (AGENTS.md)

**Étant donné** la préversion Vercel de la PR
**Quand** on l'ouvre
**Alors** l'accueil, la galerie, une fiche, la connexion, l'espace artiste et l'administration se comportent comme avant
**Et** la PR indique au porteur le réglage Node à passer en 24.x dans le projet Vercel.

### Story 1.2: Préversions isolées de la base de production

En tant que porteur,
je veux qu'une préversion ne puisse jamais écrire dans la base de production,
afin qu'aucun test ne modifie ni ne bloque une vraie œuvre ou une vraie commande (AD-22, AQ-3).

**Acceptance Criteria:**

**Étant donné** la configuration Vercel actuelle
**Quand** on vérifie la base utilisée par l'environnement « Preview »
**Alors** le constat est consigné dans la PR, sans jamais y recopier de secret

**Étant donné** des préversions branchées sur la base de production
**Quand** la story est livrée
**Alors** les préversions pointent sur une branche Neon dédiée, et la procédure (créer la branche, régler `DATABASE_URL` pour « Preview ») est décrite pour le porteur, qui garde la main sur les réglages Vercel et Neon
**Et** une vérification au démarrage refuse d'écrire si l'environnement n'est pas la production alors que l'URL de base est celle de la production (comparaison par une variable d'identification de la base, sans exposer l'URL)

**Étant donné** l'environnement local
**Quand** un développeur suit le README
**Alors** il travaille sur sa propre base ou sa propre branche, jamais sur la production.

### Story 1.3: Intégration continue : lint et build à chaque PR

En tant que porteur qui construit avec des agents,
je veux qu'aucune PR ne puisse être fusionnée sans lint ni build vérifiés,
afin que Vercel n'échoue plus sur une erreur ESLint découverte trop tard (AR-3).

**Acceptance Criteria:**

**Étant donné** une PR vers `main`
**Quand** elle est ouverte ou mise à jour
**Alors** un workflow GitHub Actions installe les dépendances sous Node 24 (`npm ci`) puis lance `npx eslint .` et `npm run build`
**Et** le workflow échoue si l'une des deux commandes échoue

**Étant donné** le build sans base de données
**Quand** il tourne en CI
**Alors** il réussit malgré les `DatabaseNotReachable`, sans aucun secret de production dans GitHub

**Et** la section « Running and verifying » d'AGENTS.md mentionne la CI.

### Story 1.4: Historique des migrations aligné sur la base réelle

En tant que porteur,
je veux que l'historique des migrations Prisma corresponde exactement à la base,
afin que chaque future migration de données puisse être appliquée et annulée sans surprise (AR-2, AD-20).

**Acceptance Criteria:**

**Étant donné** `Order` et `Artist.userId`, présents dans `schema.prisma` mais dans aucune migration
**Quand** la story est livrée
**Alors** une migration de ligne de base les crée à partir d'une base vide, et la procédure pour la marquer appliquée en production (`prisma migrate resolve --applied`) est décrite pour le porteur

**Étant donné** une base PostgreSQL vide en CI
**Quand** on applique toutes les migrations puis `prisma migrate diff` entre migrations et schéma
**Alors** aucune différence n'apparaît, et le job CI échoue dans le cas contraire

**Étant donné** le déploiement
**Quand** on cherche où `prisma migrate deploy` s'exécute
**Alors** il ne s'exécute qu'à un seul endroit documenté, une étape explicite et manuelle de GitHub Actions ou une commande du porteur, jamais dans le build Vercel
**Et** `db push` est proscrit sur une base partagée (AGENTS.md mis à jour).

### Story 1.5: Tests automatisés sur un vrai PostgreSQL

En tant que porteur,
je veux une suite de tests qui tourne sur une vraie base à chaque PR,
afin que la protection contre la double vente puisse être prouvée par des tests et non supposée (AR-3, NFR-4).

**Acceptance Criteria:**

**Étant donné** le projet sans tests
**Quand** la story est livrée
**Alors** Vitest 5 est installé avec un script `npm test`, et un utilitaire de test crée une base PostgreSQL jetable, migrée par les migrations du dépôt, puis la supprime

**Étant donné** une PR
**Quand** la CI tourne
**Alors** les tests s'exécutent contre un service PostgreSQL de GitHub Actions et le workflow échoue si un test échoue

**Étant donné** un premier test
**Quand** il s'exécute
**Alors** il prouve que deux transactions concurrentes sont bien concurrentes sur la base de test (deux connexions distinctes), condition des futurs tests de NFR-4

**Et** AGENTS.md ne dit plus « il n'existe ni tests ni CI ».

### Story 1.6: Accès à la base réservé aux modules métier

En tant que porteur qui construit avec des agents,
je veux qu'un agent ne puisse plus importer Prisma hors des modules métier,
afin que les règles de vente ne soient jamais réécrites dans une page ou une route (AR-4, AD-1).

**Acceptance Criteria:**

**Étant donné** la configuration ESLint
**Quand** un fichier hors de `src/lib/<module>/**` et de `src/auth.ts` importe `@/lib/prisma`, `@/generated/prisma*`, ou leurs équivalents relatifs (`**/lib/prisma`, `**/generated/prisma*`)
**Alors** `eslint .` échoue avec un message qui renvoie à AD-1

**Étant donné** les 22 fichiers existants qui importent Prisma
**Quand** la story est livrée
**Alors** ils figurent sur une liste d'exceptions nommée, commentée « ne fait que diminuer », et le lint passe

**Étant donné** un nouveau fichier ajouté à la liste d'exceptions
**Quand** la CI tourne
**Alors** un contrôle signale l'ajout (la liste est comparée à celle de `main` et ne peut que raccourcir).

### Story 1.7: Interrupteur du Lot 2 et fermeture du chemin d'achat actuel

En tant que porteur,
je veux décider moi-même quand l'achat en ligne s'ouvre, par un réglage côté serveur,
afin qu'aucune œuvre ne soit vendue sans réservation avant le Lot 2 (AR-5, AD-17).

**Acceptance Criteria:**

**Étant donné** le module `reglages` créé dans `src/lib/reglages/`
**Quand** la variable d'environnement d'ouverture du Lot 2 est absente ou fermée
**Alors** une seule fonction répond « Lot 2 fermé »

**Étant donné** le Lot 2 fermé
**Quand** un client appelle `POST /api/checkout`
**Alors** le serveur refuse (aucune session de paiement créée), le panier n'affiche plus le bouton de paiement, et `confirmation/page.tsx` n'appelle plus le prestataire

**Étant donné** le Lot 2 ouvert dans un environnement de test
**Quand** on appelle le même chemin
**Alors** le comportement actuel est inchangé, ce qui garde le retour arrière possible

**Et** des tests couvrent les deux états, et la PR décrit comment le porteur ouvre ou ferme le Lot 2 dans Vercel.

### Story 1.8: Rôle toujours à jour, sans reconnexion

En tant que membre de l'équipe Errancy,
je veux qu'un changement de rôle prenne effet sans que la personne ait à se reconnecter,
afin qu'un artiste invité ou promu accède tout de suite à son espace, et qu'un accès retiré le soit tout de suite (AR-7, AD-15, FR-34).

**Acceptance Criteria:**

**Étant donné** le module `acces` créé dans `src/lib/acces/`
**Quand** une page ou une action protégée demande l'acteur courant
**Alors** `acces` relit le rôle en base et renvoie un acteur typé (`visiteur`, `user`, `artist` avec son artiste, `admin`)

**Étant donné** `src/middleware.ts`
**Quand** un visiteur sans session ouvre `/dashboard/**`
**Alors** il est redirigé vers la connexion
**Et** le middleware ne compare plus aucun rôle ; les layouts `/dashboard/artiste` et `/dashboard/admin` redirigent à partir du rôle relu
**Et** la maintenance (`MAINTENANCE_MODE`) et le passage des admins se comportent comme avant

**Étant donné** un utilisateur passé de `user` à `artist` par un admin
**Quand** il recharge `/dashboard/artiste`, sans se reconnecter
**Alors** il y accède ; à l'inverse, un rôle retiré lui en refuse l'accès au rechargement

**Et** des tests couvrent ces deux cas, et le piège correspondant d'AGENTS.md est mis à jour.

### Story 1.9: Contacts de la page de maintenance enregistrés

En tant que visiteur arrivé pendant la maintenance,
je veux laisser mon e-mail pour être prévenu de l'ouverture,
afin de ne pas manquer le lancement d'Errancy (FR-35).

**Acceptance Criteria:**

**Étant donné** la page `public/maintenance.html`
**Quand** le visiteur envoie le formulaire « Me notifier » avec un e-mail valide et la case de consentement cochée
**Alors** l'e-mail et la date du consentement sont enregistrés par le module `demandes` (table créée par cette story), et un accusé s'affiche à l'écran

**Étant donné** un formulaire sans consentement ou avec un e-mail invalide
**Quand** il est envoyé
**Alors** rien n'est enregistré et le message dit ce qui manque, sans perdre la saisie

**Étant donné** des envois répétés depuis une même adresse IP ou pour un même e-mail
**Quand** le seuil est dépassé
**Alors** les envois suivants sont refusés sans erreur technique visible, et un e-mail déjà inscrit ne crée pas de doublon

**Étant donné** un membre de l'équipe
**Quand** il ouvre l'administration
**Alors** il voit le nombre d'inscrits et peut exporter la liste (l'e-mail d'ouverture sera envoyé par le module notifications, en Epic 4)
**Et** aucun e-mail inscrit n'apparaît dans les journaux.

## Epic 2: Les artistes invités déposent leurs œuvres, l'équipe les publie

L'équipe invite un artiste sélectionné, qui dépose une œuvre complète ; l'équipe la valide ou la renvoie ; l'artiste tient la disponibilité de ses œuvres ; le catalogue de démonstration disparaît. Couvre FR-16, FR-20, FR-21 (hors réservation), FR-25 (curation), FR-34 ; AR-8, AR-10, AR-14 ; UX-DR19, UX-DR25 à UX-DR27, UX-DR30 à UX-DR32, UX-DR35, UX-DR36, UX-DR42 (curation). Préalables : AQ-4 (fenêtre de restauration Neon) avant la story 2.1 ; composition des zones (OQ-5) avant la story 2.3.

### Story 2.1: Prix et dimensions exacts au centime et au millimètre

En tant qu'artiste et futur acheteur,
je veux que les prix et les dimensions soient enregistrés sans arrondi,
afin que le prix total et la taille affichés soient exacts partout (AD-5, AR-10).

**Acceptance Criteria:**

**Étant donné** `Artwork.price` (`Float`) et `Artwork.dimensions` (texte libre)
**Quand** la story est livrée
**Alors** de nouvelles colonnes portent le prix en centimes entiers avec sa devise (`EUR`), et la hauteur et la largeur en millimètres entiers (profondeur facultative)
**Et** un script idempotent recopie les valeurs existantes ; les dimensions illisibles sont listées pour une saisie manuelle, jamais devinées

**Étant donné** les lectures du catalogue et de l'espace artiste
**Quand** elles affichent un prix ou des dimensions
**Alors** elles lisent les nouvelles colonnes, au travers du module `catalogue` (qui reprend `src/lib/db/`), et les anciennes colonnes restent en place pour le retour arrière (temps 1 à 3 d'AD-20)

**Étant donné** la répétition sur une branche Neon
**Quand** on applique la migration puis qu'on revient au commit précédent
**Alors** le site fonctionne dans les deux cas, ce que la PR consigne.

### Story 2.2: Publication et disponibilité, deux états distincts

En tant qu'artiste et membre de l'équipe,
je veux qu'une œuvre ait un état de publication et un état de disponibilité séparés,
afin que la curation et les ventes ne se marchent jamais dessus (AD-6, AR-10).

**Acceptance Criteria:**

**Étant donné** le booléen `Artwork.available`
**Quand** la story est livrée
**Alors** l'œuvre porte une **publication** (`brouillon`, `en_curation`, `publiee`), écrite seulement par le module `curation`, et une **disponibilité** (`disponible`, `reservee`, `vendue`, `vendue_ailleurs`, `retiree`), écrite seulement par le module `disponibilite`
**Et** la recopie fait correspondre `available = true` à `publiee` + `disponible`, et `available = false` à `publiee` + `vendue`

**Étant donné** le module `disponibilite`
**Quand** un autre module veut savoir si une œuvre est visible ou disponible
**Alors** il passe par la définition unique exportée par `disponibilite` (prédicat et fragment de requête), et la colonne brute n'est lue nulle part ailleurs (AD-7)

**Étant donné** une œuvre `retiree`
**Quand** un visiteur ouvre son URL
**Alors** il est redirigé en 301 vers la page de l'artiste (FR-6, NFR-2)

**Et** les fiches publiques ne montrent que des œuvres `publiee` non retirées.

### Story 2.3: Zones de livraison gérées par l'équipe

En tant que membre de l'équipe,
je veux définir les zones de livraison et les pays qu'elles regroupent,
afin que les artistes fixent leurs frais par zone sans que les zones soient codées en dur (AD-12, OQ-5).

**Acceptance Criteria:**

**Étant donné** le module `livraison`
**Quand** la story est livrée
**Alors** une zone a un nom et une liste de pays (codes ISO 3166-1 alpha-2), chaque pays appartient au plus à une zone, et seul l'acteur `admin` peut les modifier

**Étant donné** l'écran d'administration des zones
**Quand** un membre de l'équipe crée, renomme ou modifie une zone
**Alors** le changement est enregistré et visible aussitôt dans le formulaire de dépôt
**Et** une zone utilisée par au moins une offre ne peut pas être supprimée, et le message le dit

**Étant donné** aucune zone encore définie
**Quand** un artiste ouvre le dépôt
**Alors** la section Expédition explique que les zones ne sont pas encore ouvertes, au lieu d'afficher une liste vide.

### Story 2.4: Invitation et premier accès de l'artiste

En tant qu'artiste sélectionné par Errancy,
je veux créer mon accès à partir d'une invitation personnelle,
afin d'entrer dans mon espace sans démarche administrative (FR-34, AD-14).

**Acceptance Criteria:**

**Étant donné** un membre de l'équipe sur `/dashboard/admin/artistes`
**Quand** il invite un artiste existant en saisissant son e-mail
**Alors** le module `acces` émet un jeton `invitation` (au moins 256 bits, seule l'empreinte stockée, échéance réglable, 7 jours par défaut, UXQ-8)
**Et** tant qu'aucun prestataire d'e-mail n'est choisi (AQ-1), l'écran montre le lien une seule fois pour un envoi manuel ; l'envoi automatique viendra en Epic 4

**Étant donné** l'artiste qui ouvre `/auth/invitation/[jeton]`
**Quand** le jeton est valide
**Alors** le jeton est échangé contre un cookie `httpOnly` puis l'URL est redirigée sans jeton (`Referrer-Policy: no-referrer`)
**Et** il voit son e-mail prérempli, choisit un mot de passe, accepte la charte artiste, et son compte reçoit le rôle `artist`, rattaché à sa fiche
**Et** le jeton est consommé et ne peut pas resservir

**Étant donné** un jeton expiré ou déjà utilisé
**Quand** il est ouvert
**Alors** la page dit « Ce lien d'invitation a expiré. » et propose « Écrire à l'équipe »

**Étant donné** l'artiste connecté
**Quand** il arrive sur `/dashboard/artiste`
**Alors** il voit la navigation basse (Accueil, Œuvres, Commandes, Paiements ; latérale à partir de `lg`) et l'accueil avec le bloc « Mes œuvres » ; les blocs « À expédier » et « Ce qu'on vous doit » viennent au Lot 2
**Et** il n'accède qu'à ses propres œuvres, ce qui est vérifié côté serveur par un test.

### Story 2.5: Déposer une œuvre : photos, informations, dimensions et prix

En tant qu'artiste,
je veux déposer une œuvre depuis mon téléphone, avec ses photos et sa description,
afin que la fiche publique réponde aux questions de l'acheteur (FR-20, FR-1, FR-2).

**Acceptance Criteria:**

**Étant donné** `/dashboard/artiste/oeuvres/nouvelle`
**Quand** l'artiste ouvre le formulaire
**Alors** il voit une seule page avec les sections 1. Photos, 2. Informations, 3. Dimensions et prix, la progression « N sections sur 5 complètes » et l'état de chaque section

**Étant donné** la section Photos
**Quand** l'artiste ajoute une image depuis l'appareil photo ou la galerie
**Alors** chaque case correspond à une prise de vue légendée (mise en situation avec repère d'échelle, gros plan, lumière du jour ; vidéo facultative), l'image part sur Cloudinary par un envoi signé, et « Remplacer » est proposé sur une case remplie

**Étant donné** la section Informations
**Quand** l'artiste la remplit
**Alors** titre, technique, année, histoire courte, ambiance et couleur dominante sont enregistrés

**Étant donné** la section Dimensions et prix
**Quand** il saisit hauteur et largeur en cm et le prix de l'œuvre seule
**Alors** la conversion en pouces et l'orientation s'affichent aussitôt, et les valeurs sont stockées en millimètres et en centimes (story 2.1)

**Étant donné** toute modification
**Quand** l'artiste quitte un champ
**Alors** le brouillon est enregistré automatiquement (« Brouillon enregistré »), la saisie n'est jamais perdue après une erreur, et chaque champ a un libellé visible et l'`autocomplete` adapté
**Et** l'œuvre reste en `brouillon` et n'est visible que de son artiste.

### Story 2.6: Expédition par zone, engagements et envoi en curation

En tant qu'artiste,
je veux indiquer mes frais et délais par zone et mes engagements, puis envoyer l'œuvre en curation,
afin qu'Errancy affiche un prix livré et un délai exacts (FR-20, FR-4, AD-12).

**Acceptance Criteria:**

**Étant donné** la section 4. Expédition
**Quand** l'artiste la remplit pour chaque zone définie par l'équipe
**Alors** il saisit les frais, le délai de préparation et un délai de transport minimal et maximal, ou coche « Je ne livre pas cette zone » ; il indique aussi s'il accepte les visites en atelier
**Et** « Reprendre les zones de ma dernière œuvre » préremplit la section à partir de sa dernière œuvre

**Étant donné** la section 5. Engagements
**Quand** l'artiste la remplit
**Alors** il s'engage sur le certificat signé, l'emballage conforme et la reprise d'une œuvre retournée dans son emballage d'origine

**Étant donné** un élément obligatoire manquant
**Quand** l'artiste regarde le bouton « Envoyer en curation »
**Alors** le bouton est indisponible, et au-dessus « Il manque N éléments pour envoyer : » liste des liens qui mènent chacun au champ concerné et y placent le focus

**Étant donné** un dépôt complet (au moins une zone livrée)
**Quand** l'artiste l'envoie
**Alors** l'œuvre passe en `en_curation`, « Mes œuvres » le confirme, et le délai de réponse de la curation s'affiche (valeur réglable, UXQ-8).

### Story 2.7: Curation par l'équipe

En tant que membre de l'équipe,
je veux valider ou renvoyer chaque œuvre soumise selon une liste de contrôle,
afin que seules des fiches complètes et fidèles soient publiées (FR-25, FR-16).

**Acceptance Criteria:**

**Étant donné** `/dashboard/admin/oeuvres`
**Quand** un membre de l'équipe ouvre la file
**Alors** il voit les œuvres `en_curation`, de la plus ancienne à la plus récente, avec la liste de contrôle : photos requises, fidélité des couleurs, champs complets, cohérence du prix et des zones

**Étant donné** la fiche d'un artiste
**Quand** l'équipe enregistre que son accord écrit est signé (date)
**Alors** l'information est conservée par `curation`

**Étant donné** une œuvre dont l'artiste a un accord signé
**Quand** l'équipe la valide
**Alors** elle passe en `publiee` et `disponible`, et devient visible sur le site
**Et** la validation est refusée, avec un message, si l'artiste n'a pas d'accord signé

**Étant donné** une œuvre incomplète ou infidèle
**Quand** l'équipe la renvoie avec un commentaire obligatoire
**Alors** elle repasse en `brouillon`, et l'artiste voit le commentaire en bandeau d'information sur la fiche de dépôt (UXQ-3 : hypothèse retenue)
**Et** l'e-mail « Résultat de curation » viendra en Epic 4 ; d'ici là, le résultat est visible dans l'espace artiste.

### Story 2.8: L'artiste tient la disponibilité de ses œuvres

En tant qu'artiste qui vend aussi ailleurs,
je veux passer une œuvre en « Vendue ailleurs » ou la retirer de la vente depuis mon téléphone,
afin qu'elle ne soit plus achetable sur Errancy en moins d'une minute (FR-21, UJ-2).

**Acceptance Criteria:**

**Étant donné** `/dashboard/artiste/oeuvres`
**Quand** l'artiste ouvre la liste
**Alors** chaque œuvre porte son badge d'état parmi Brouillon, En curation, Publiée, Réservée, Vendue, Vendue ailleurs et Retirée, tous lisibles sans la couleur, et les états vide et chargement sont prévus

**Étant donné** une œuvre publiée
**Quand** l'artiste choisit « Vendue ailleurs » ou « Retirer de la vente », puis confirme dans la feuille de confirmation
**Alors** le module `disponibilite` change l'état ; dès cet instant, le serveur refuse toute nouvelle réservation ou commande sur l'œuvre, et la fiche publique l'affiche « Vendue » (ou la redirige si elle est retirée) en moins de 60 s
**Et** le bandeau « Retirée de la vente à [heure]. » apparaît avec « Annuler »
**Et** Échap ou un appui sur le voile ferme la feuille sans agir et rend le focus ; deux feuilles ne s'empilent jamais

**Étant donné** une déclaration « Vendue ailleurs » qui n'a interrompu aucune réservation
**Quand** l'artiste touche « Annuler »
**Alors** l'œuvre redevient `disponible` ; le module retient pour chaque déclaration si elle a interrompu une réservation, ce qui servira en Epic 6

**Étant donné** une œuvre `vendue`
**Quand** l'artiste ouvre ses options
**Alors** « Vendue ailleurs » n'est pas proposé, et un lien invite à écrire à l'équipe

**Étant donné** une œuvre retirée
**Quand** l'artiste la remet en vente
**Alors** elle repasse en curation.

### Story 2.9: Catalogue réel uniquement

En tant que visiteur,
je veux ne voir que de vraies œuvres d'artistes sélectionnés,
afin de pouvoir faire confiance à ce que le site présente (FR-16).

**Acceptance Criteria:**

**Étant donné** `src/data/*`, encore importé par `components/sections/*` et `lib/utils/*`
**Quand** la story est livrée
**Alors** ces composants lisent le module `catalogue`, plus aucun fichier n'importe `src/data/*`, et le dossier est supprimé

**Étant donné** le jeu de données initial (`prisma/seed.ts`) et les images importées (Wikimedia, MET)
**Quand** la story est livrée
**Alors** le seed ne crée plus de catalogue de démonstration en production, et la liste des images de démonstration à supprimer de Cloudinary est fournie au porteur (la suppression se fait après confirmation des droits)

**Étant donné** une base qui ne contient encore aucune œuvre publiée
**Quand** un visiteur ouvre l'accueil ou la galerie
**Alors** l'état vide prévu s'affiche, sans erreur
**Et** `public/robots.txt` et la maintenance restent inchangés.

### Story 2.10: Suppression des anciennes colonnes

En tant que porteur,
je veux retirer les anciennes colonnes une fois la nouvelle forme vérifiée,
afin qu'aucun code futur ne lise de nouveau un prix approximatif ou un état ambigu (AD-20, temps 4).

**Acceptance Criteria:**

**Étant donné** les stories 2.1 et 2.2 en production depuis la période de vérification convenue avec le porteur
**Quand** la story est livrée
**Alors** `Artwork.available`, l'ancien `Artwork.price` (`Float`) et l'ancien `Artwork.dimensions` (texte) sont supprimés par migration, et plus aucun code ne les lit
**Et** la sauvegarde restaurable a été vérifiée juste avant (AQ-4), et la répétition sur une branche Neon est consignée dans la PR.

## Epic 3: Le visiteur trouve une œuvre et répond seul aux quatre questions

La fiche œuvre montre l'échelle, le prix livré dans le pays choisi, le délai et les signes de sérieux ; la galerie se filtre selon le mur et le budget ; l'accueil présente la sélection ; les pages artistes sont refaites. Couvre FR-1 à FR-5, FR-6 (états vendue et retirée ; la barre d'actions vient en Epic 4), FR-17, FR-18, FR-19 ; NFR-1, NFR-2, NFR-3, NFR-8 ; AR-9 (fondation du journal d'événements), AR-11, AR-13 ; UX-DR1 à UX-DR7, UX-DR9 à UX-DR11, UX-DR15 à UX-DR22, UX-DR34, UX-DR38 (galerie, fiche), UX-DR39.

### Story 3.1: Une interface lisible et accessible partout

En tant que visiteur, y compris au clavier ou avec une aide technique,
je veux une interface aux contrastes sûrs et à la navigation prévisible,
afin de lire et d'agir sans effort sur mobile comme sur ordinateur (UX-DR1 à UX-DR6, NFR-3).

**Acceptance Criteria:**

**Étant donné** `tailwind.config.ts`
**Quand** la story est livrée
**Alors** la palette et les polices existantes sont conservées, et les jetons `heading-sm`, `body-strong`, `price-lg`, `label-caps`, `caption`, `button`, `input`, `touch-target` (44 px) et `gutter-mobile` sont ajoutés
**Et** une règle de lint ou un test interdit l'or et `neutral-400` comme couleur de texte

**Étant donné** n'importe quelle page publique
**Quand** on la parcourt au clavier
**Alors** un lien d'évitement mène au contenu, le focus est visible (contour noir 2 px, décalage 2 px, jamais or) et l'ordre suit la lecture

**Étant donné** les composants de mise en page
**Quand** on recherche `left`/`right` codés en dur
**Alors** seules des propriétés logiques (`inline-start`/`inline-end`) sont employées
**Et** les animations se limitent à `fade-in` et `scale-in`, coupées sous `prefers-reduced-motion`

**Et** `lang="fr"` est posé, les champs font 16 px, les cibles tactiles 44 × 44 px, et l'agrandissement à 200 % ne crée pas de défilement horizontal sur l'accueil, la galerie et la fiche.

### Story 3.2: Textes, montants et unités au même format partout

En tant que visiteur,
je veux des prix, des dimensions et des heures écrits de la même façon sur tout le site, en cm ou en pouces selon mon choix,
afin de comparer les œuvres sans effort (AR-11, AD-18, FR-17, UX-DR21).

**Acceptance Criteria:**

**Étant donné** `src/lib/i18n/`
**Quand** la story est livrée
**Alors** un dictionnaire français typé porte les textes des surfaces de cet epic, et des fonctions communes formatent montants (« 1 450 € », espace fine insécable), dimensions (« 61 × 76 cm »), dates et heures (« 15 h 42 »), en locale `fr`
**Et** une règle de lint signale une chaîne visible écrite en dur dans un composant de cet epic

**Étant donné** la bascule cm/in
**Quand** le visiteur choisit « in »
**Alors** tout le site affiche les pouces en priorité, le choix est mémorisé sur l'appareil, et la fiche montre toujours les deux unités

**Et** aucun sélecteur de langue ni de devise n'apparaît (OQ-6).

### Story 3.3: Pays de livraison et prix total calculé en un seul endroit

En tant que visiteur à l'étranger,
je veux voir le prix total livré dans mon pays et le délai total,
afin de savoir tout de suite ce que l'œuvre me coûtera et quand je la recevrai (FR-3, FR-4, AD-12).

**Acceptance Criteria:**

**Étant donné** le module `livraison`
**Quand** on lui donne une œuvre et un pays
**Alors** une seule fonction renvoie le prix total (œuvre + frais de la zone, en centimes et en euros) et le délai total (préparation + transport minimal et maximal), ou « pas de livraison vers ce pays »
**Et** la même règle existe sous forme de fragment de requête pour filtrer et trier la galerie, et un test prouve que les deux formes donnent le même montant

**Étant donné** un visiteur sans pays choisi
**Quand** il arrive
**Alors** le pays proposé est la France, modifiable (hypothèse en attendant OQ-13), et le choix est conservé dans un cookie `pays` (code ISO)

**Étant donné** le lien « Modifier » le pays
**Quand** le visiteur choisit un autre pays
**Alors** les prix et délais affichés sont recalculés côté serveur, et le recalcul est annoncé aux technologies d'assistance

**Et** chaque prix total est accompagné de « Droits et taxes d'import éventuels non inclus ».

### Story 3.4: Journal d'événements et pages publiques toujours fraîches

En tant que visiteur,
je veux que le site reflète en moins d'une minute qu'une œuvre a été vendue ailleurs ou publiée,
afin de ne jamais m'intéresser à une œuvre qui n'est plus disponible, sans que les pages deviennent lentes (AD-11, AD-21, AR-9, AR-13).

**Acceptance Criteria:**

**Étant donné** le module `evenements`
**Quand** la story est livrée
**Alors** il fournit le catalogue typé des événements, l'écriture d'un événement dans la transaction du changement d'état, la réclamation atomique (événement, gestionnaire) avant tout effet, la répartition après la réponse (`waitUntil` de `@vercel/functions`), et `src/lib/abonnements.ts`
**Et** un test prouve qu'un même événement traité deux fois en parallèle ne produit l'effet qu'une seule fois

**Étant donné** les lectures du catalogue public
**Quand** elles sont mises en cache
**Alors** le cache porte sur les données, étiquetées par œuvre et par artiste, avec une revalidation d'au plus 60 s ; les pages qui affichent un prix se rendent par requête avec le cookie `pays`

**Étant donné** un changement de disponibilité (story 2.8) ou une publication (story 2.7)
**Quand** la transaction est validée
**Alors** l'événement correspondant est écrit, et son gestionnaire invalide les étiquettes de l'œuvre et de son artiste
**Et** la fiche publique reflète le changement en moins de 60 s, ce que vérifie un test.

### Story 3.5: Fiche œuvre : photos et rangée Taille, Prix livré, Délai

En tant que visiteur sur mobile,
je veux voir d'abord l'œuvre accrochée chez quelqu'un, puis sa taille, son prix livré et son délai,
afin de répondre en quelques secondes à « Ira-t-elle chez moi ? » et « Est-elle trop chère ? » (FR-1 à FR-4, UX-DR15, UX-DR17, UX-DR18).

**Acceptance Criteria:**

**Étant donné** une œuvre publiée sur `/galerie/[id]`
**Quand** la fiche s'ouvre
**Alors** la première photo est la mise en situation, en pleine largeur, suivie du titre en `display-sm`, du libellé de disponibilité, puis de la rangée de trois cases
- Taille : unité principale selon le choix cm/in, l'autre unité en dessous, orientation et format
- Prix livré : prix total pour le pays affiché et « Modifier »
- Délai : fourchette de jours

**Étant donné** le carrousel
**Quand** le visiteur balaie ou utilise les boutons précédent/suivant
**Alors** les photos défilent sans aucun défilement automatique, avec le compteur « 1/4 » et la légende de la prise de vue ; un appui ouvre la photo en plein écran avec zoom

**Étant donné** un pays non livré par l'artiste
**Quand** la fiche s'affiche
**Alors** la case Prix livré dit « Pas de livraison vers [pays] » et une phrase indique « [Artiste] ne livre pas encore [pays]. »

**Étant donné** le seuil de format réglable (UXQ-7)
**Quand** l'équipe le change
**Alors** le format affiché suit, sans changement de code

**Et** pendant le chargement, la rangée et le titre apparaissent avant les photos, et chaque photo a un texte alternatif qui dit l'œuvre, l'artiste et la prise de vue.

### Story 3.6: Fiche œuvre : les quatre questions et les signes de sérieux

En tant que visiteur qui hésite,
je veux trouver sur la fiche les réponses détaillées à mes questions, avec l'histoire de l'œuvre et les signes de sérieux,
afin de décider sans avoir à demander (FR-5, UX-DR16).

**Acceptance Criteria:**

**Étant donné** la fiche
**Quand** le visiteur fait défiler la page
**Alors** quatre sections natives `details`/`summary` apparaissent dans cet ordre : « Ira-t-elle chez moi ? » (seule ouverte à l'arrivée), « Combien au total ? », « Quand la recevrai-je ? », « Est-ce sérieux ? »
**Et** les chiffres y sont identiques à ceux de la rangée de trois cases, et l'état ouvert ne se mémorise pas d'une fiche à l'autre

**Étant donné** « Est-ce sérieux ? »
**Quand** on l'ouvre
**Alors** on y lit l'histoire courte, « Sélectionnée par Errancy », la mention du certificat d'authenticité signé par l'artiste, un résumé de la politique de retour sans aucune durée ni gratuité (OQ-2, OQ-4), et un lien vers la page de l'artiste
**Et** le lien vers les pages de confiance n'apparaît qu'une fois ces pages publiées (Epic 7)

**Et** aucune mention ne contient compte à rebours, prix barré ni « Garantie Errancy ».

### Story 3.7: Fiche d'une œuvre vendue ou retirée

En tant que visiteur,
je veux comprendre tout de suite qu'une œuvre n'est plus disponible et voir d'autres œuvres de l'artiste,
afin de ne pas rester sur une impasse (FR-6, partie états).

**Acceptance Criteria:**

**Étant donné** une œuvre `vendue` ou `vendue_ailleurs`
**Quand** la fiche s'ouvre
**Alors** elle affiche « Vendue », les mêmes informations sans prix livré actif, et des œuvres proches du même artiste avec un lien vers sa page

**Étant donné** une œuvre `retiree` ou inconnue
**Quand** on ouvre son URL
**Alors** le visiteur est redirigé vers la page de l'artiste (301), ou vers la galerie si l'artiste est inconnu

**Étant donné** une œuvre `disponible`
**Quand** la fiche s'affiche
**Alors** elle montre « Disponible » ; les actions viendront avec la barre d'actions de l'Epic 4, et aucun bouton « Acheter » n'apparaît tant que le Lot 2 est fermé (story 1.7).

### Story 3.8: Fiches et pages artistes bien référencées

En tant que porteur,
je veux que chaque fiche et chaque page artiste soient correctement indexables le jour où la maintenance sera levée,
afin de ne perdre aucun référencement (NFR-2).

**Acceptance Criteria:**

**Étant donné** une fiche œuvre ou une page artiste publique
**Quand** on lit son HTML
**Alors** elle porte un titre, une description, une URL canonique en français et des balises de partage (image de mise en situation)

**Étant donné** le sitemap
**Quand** on l'ouvre
**Alors** il liste les fiches publiées non retirées et les pages artistes, et se met à jour avec la publication

**Étant donné** un slug d'œuvre modifié
**Quand** on ouvre l'ancienne URL
**Alors** une redirection 301 mène à la nouvelle

**Et** `public/robots.txt` et `MAINTENANCE_MODE` ne sont pas modifiés (actes du porteur).

### Story 3.9: Galerie filtrée pour un mur et un budget

En tant que visiteur qui cherche pour un mur précis,
je veux filtrer les œuvres par prix livré, format, orientation, couleur, ambiance, technique, artiste, pays de l'artiste et disponibilité,
afin de ne voir que ce qui peut convenir (FR-17, UX-DR20, UX-DR22, UX-DR39).

**Acceptance Criteria:**

**Étant donné** `/galerie`
**Quand** le visiteur pose des filtres depuis « Modifier les filtres »
**Alors** chaque filtre actif devient une puce, « × » retire la puce et relance la liste, et la ligne « N œuvres · prix livré [pays] » rappelle le nombre de résultats et le pays de calcul
**Et** les filtres vivent dans l'URL : le lien est partageable et le retour arrière les conserve

**Étant donné** le filtre de prix total
**Quand** il s'applique
**Alors** il utilise le fragment de requête de `livraison` (story 3.3), et une œuvre filtrée « ≤ 3 000 € » affiche sur sa fiche un prix livré ≤ 3 000 € pour le même pays

**Étant donné** la liste
**Quand** elle s'affiche
**Alors** chaque vignette est une seule cible vers la fiche et montre l'artiste, les dimensions, le prix livré et le délai ; la galerie compte 2 colonnes sur mobile, 3 de `md` à `lg` et 4 au-delà
**Et** « Afficher plus d'œuvres » charge la suite, sans défilement infini

**Étant donné** aucun résultat, un chargement ou une erreur
**Quand** la liste s'affiche
**Alors** on voit respectivement « Aucune œuvre ne correspond à ces filtres. » avec un moyen de retirer le dernier filtre, des vignettes squelettes, ou « La galerie ne s'est pas chargée. Réessayer », les filtres étant conservés.

### Story 3.10: Accueil curatorial

En tant que visiteur qui découvre Errancy,
je veux voir dès l'accueil une sélection choisie par l'équipe et les nouveautés,
afin d'atteindre une œuvre en un clic (FR-18).

**Acceptance Criteria:**

**Étant donné** l'accueil
**Quand** il s'affiche
**Alors** il présente la sélection de l'équipe (œuvres marquées par l'équipe dans l'administration) et les dernières œuvres publiées, sous forme de vignettes qui mènent chacune à une fiche
**Et** un accès « Parcourir la galerie » est visible

**Étant donné** l'en-tête du site
**Quand** il s'affiche
**Alors** il montre « Menu », la marque et, sur les écrans profonds, « ‹ [écran précédent] », sans icône favoris ni « Panier » tant que le Lot 2 est fermé

**Et** le filet or décoratif (`ornament-rule`) est `aria-hidden`, et aucun carrousel ni vidéo ne démarre seul.

### Story 3.11: Pages artistes

En tant que visiteur, notamment de la diaspora,
je veux découvrir l'artiste, sa démarche et ses œuvres disponibles,
afin de me sentir proche de lui et de lui faire confiance (FR-19).

**Acceptance Criteria:**

**Étant donné** l'administration d'un artiste
**Quand** l'équipe renseigne son portrait, sa démarche, sa formation, ses expositions et une photo d'atelier
**Alors** ces éléments sont enregistrés par `curation` (pages gérées par l'équipe, OQ-14)

**Étant donné** `/artistes/[id]`
**Quand** la page s'ouvre
**Alors** elle montre ces éléments, la mention « Sélectionné par Errancy » et ses œuvres disponibles avec prix livré et délai pour le pays choisi
**Et** `/artistes` liste les artistes publiés

**Et** les coordonnées de l'artiste n'apparaissent jamais sur la page (FR-8).

## Epic 4: Le visiteur hésitant parle à une personne, et l'équipe mesure ce qui fait vendre

Le visiteur ouvre un Conseil WhatsApp ou envoie une demande de visite ou de sélection, avec un délai annoncé ; il s'inscrit à « Me prévenir » ; la fiche porte sa barre d'actions du Lot 1 ; l'équipe traite la file des demandes et mesure le tunnel, avec le consentement du visiteur. Couvre FR-6 (barre d'actions), FR-7, FR-8, FR-9 (inscription), FR-25 (demandes), FR-27, FR-35 (e-mail d'ouverture) ; NFR-6 ; AR-9 (e-mails), AR-12 ; UX-DR8, UX-DR12 à UX-DR14, UX-DR25, UX-DR26, UX-DR38 (formulaires), UX-DR42 (demandes), UX-DR43, UX-DR44. Préalable : le porteur choisit le prestataire d'e-mails (AQ-1) avant la story 4.1.

### Story 4.1: E-mails transactionnels fiables

En tant que membre de l'équipe,
je veux que les e-mails partent d'eux-mêmes, une seule fois, avec le bon contenu,
afin de ne plus envoyer à la main les invitations ni les résultats de curation (AD-11, AQ-1, UX-DR44).

**Acceptance Criteria:**

**Étant donné** le module `notifications`
**Quand** la story est livrée
**Alors** il expose un port d'envoi d'e-mail, avec un adaptateur pour le prestataire choisi par le porteur (AQ-1, garanties de transfert UE) et un adaptateur « journal » utilisé hors production (AD-22)
**Et** aucun nom de prestataire n'apparaît hors de l'adaptateur et des variables d'environnement

**Étant donné** un e-mail déclenché par un événement
**Quand** l'événement est traité, y compris deux fois par la répartition puis par le balayage
**Alors** un seul e-mail part, grâce à la réclamation atomique (story 3.4)
**Et** son contenu vient du dictionnaire, au vouvoiement, sans jargon, et il contient un lien Conseil WhatsApp (ou le repli vers la demande de conseil)

**Étant donné** une invitation (story 2.4) ou un résultat de curation (story 2.7)
**Quand** l'équipe invite un artiste, ou valide ou renvoie une œuvre
**Alors** l'e-mail « Invitation » (lien personnel « Créer mon accès » et durée de validité) ou « Résultat de curation » (publication, ou commentaire de l'équipe) part automatiquement
**Et** le jeton d'invitation est émis au moment de l'envoi et n'existe en clair que dans l'e-mail (AD-14)

**Étant donné** l'adresse ou le téléphone d'un acheteur
**Quand** on lit les journaux et les charges utiles d'événements
**Alors** on n'y trouve que des identifiants.

### Story 4.2: Demande de sélection personnalisée

En tant que visiteur qui ne sait pas par où commencer,
je veux décrire mon espace, mes goûts et mon budget à l'équipe,
afin de recevoir une sélection faite pour moi (FR-8).

**Acceptance Criteria:**

**Étant donné** `/conseil`, accessible depuis toutes les pages
**Quand** le visiteur remplit espace, goût, budget et ses coordonnées (e-mail obligatoire, téléphone facultatif)
**Alors** la demande est enregistrée par `demandes` à l'état `nouvelle`, et l'écran affiche « Demande reçue. Nous vous répondons sous [délai]. »
**Et** l'e-mail « Accusé de demande » part avec le délai de réponse

**Étant donné** un champ fautif
**Quand** le visiteur envoie
**Alors** le message apparaît sous le champ (avec un résumé en tête s'il y en a plusieurs), la saisie est conservée, et le bouton affiche « Envoi… » et ignore les doubles appuis pendant l'envoi

**Étant donné** des envois répétés depuis une même adresse IP ou pour un même e-mail
**Quand** le seuil est dépassé
**Alors** les envois suivants sont refusés sans message technique.

### Story 4.3: Demande de visite à distance ou en atelier

En tant que visiteur qui hésite devant une œuvre chère,
je veux demander une visite à distance, ou en atelier si l'artiste l'accepte,
afin de voir l'œuvre avant de me décider (FR-8, UJ-4).

**Acceptance Criteria:**

**Étant donné** `/galerie/[id]/visite`
**Quand** le visiteur choisit le type de visite et propose deux ou trois créneaux
**Alors** « En atelier » n'est proposé que si l'artiste accepte les visites (story 2.6), et les créneaux s'affichent dans le fuseau de l'appareil (UXQ-10 : hypothèse retenue)

**Étant donné** une demande envoyée
**Quand** elle est enregistrée
**Alors** elle est rattachée à l'œuvre, à l'état `nouvelle`, et l'accusé s'affiche puis part par e-mail avec le délai

**Étant donné** toute étape de la demande
**Quand** on lit l'écran ou l'e-mail
**Alors** les coordonnées de l'artiste n'apparaissent jamais ; la visite est organisée par l'équipe (OQ-8 pour qui la mène).

### Story 4.4: Conseil WhatsApp contextualisé, avec repli

En tant que visiteur de la diaspora,
je veux écrire à une personne d'Errancy sur WhatsApp, avec la référence de l'œuvre déjà dans le message,
afin d'avoir une réponse dans le délai annoncé sans avoir à expliquer ce que je regarde (FR-7, UX-DR14).

**Acceptance Criteria:**

**Étant donné** les réglages WhatsApp (numéro, horaires, délai annoncé : valeurs d'OQ-7, saisies par l'équipe)
**Quand** le visiteur touche « Conseil WhatsApp » sur une fiche
**Alors** WhatsApp s'ouvre avec un message prérempli contenant la référence (slug) et le lien de l'œuvre ; sur la page d'un artiste, le message nomme l'artiste
**Et** le bouton affiche en sous-ligne « Réponse en moins de [délai] · [horaires] », ou, hors horaires, « Réponse demain à partir de [HH] h »

**Étant donné** un ordinateur
**Quand** le visiteur touche le bouton
**Alors** WhatsApp Web s'ouvre, ou un QR code s'affiche si l'ouverture échoue

**Étant donné** des réglages WhatsApp absents
**Quand** le bouton s'affiche
**Alors** il garde le même emplacement et le même libellé de délai, mais ouvre la demande de conseil (story 4.2)

**Et** le bouton est présent sur la fiche, la page artiste, l'accueil, la galerie et le pied de page, sans vert ni logo en couleur, nommé par son action (« Conseil WhatsApp sur [titre] »).

### Story 4.5: « Me prévenir » sur une œuvre réservée

En tant que visiteur arrivé trop tard,
je veux laisser mon e-mail sur une œuvre réservée,
afin d'être prévenu si elle redevient disponible (FR-9, inscription).

**Acceptance Criteria:**

**Étant donné** une œuvre à l'état `reservee`
**Quand** le visiteur laisse son e-mail dans « Me prévenir »
**Alors** l'inscription est enregistrée par `demandes`, avec son rang dans l'ordre d'arrivée, et l'écran dit « Nous vous écrirons si elle redevient disponible. »
**Et** l'e-mail de confirmation d'inscription part avec un lien de désinscription (jeton `desinscription`, AD-14)

**Étant donné** un e-mail déjà inscrit sur la même œuvre
**Quand** il s'inscrit de nouveau
**Alors** aucun doublon n'est créé et son rang ne change pas

**Étant donné** le lien de désinscription
**Quand** il est ouvert
**Alors** l'inscription est retirée et la page le confirme, sans demander de connexion

**Et** la notification à l'expiration, avec son délai de priorité, viendra avec les réservations (Epic 6).

### Story 4.6: File des demandes de l'équipe

En tant que membre de l'équipe,
je veux voir et traiter toutes les demandes en un seul endroit,
afin de répondre dans le délai annoncé (FR-25, FR-8, UX-DR42).

**Acceptance Criteria:**

**Étant donné** `/dashboard/admin/demandes`
**Quand** un membre de l'équipe l'ouvre
**Alors** il voit les demandes de visite et de sélection, de la plus ancienne à la plus récente, avec leur type, l'œuvre concernée, la date et l'état
**Et** il voit aussi les inscriptions « Me prévenir » par œuvre, avec leur nombre et leur ordre

**Étant donné** une demande
**Quand** il change son état parmi `nouvelle`, `planifiée`, `faite` et `sans suite`
**Alors** le changement est enregistré avec qui et quand

**Étant donné** aucune demande, un chargement ou une erreur
**Quand** la file s'affiche
**Alors** on voit « Aucune demande en attente. », des lignes squelettes, ou « Réessayer »

**Et** seul l'acteur `admin` y accède, ce qui est vérifié côté serveur par un test.

### Story 4.7: Barre d'actions de la fiche (Lot 1)

En tant que visiteur sur mobile,
je veux que les actions utiles restent toujours à portée de pouce,
afin de demander conseil ou une visite au moment où j'hésite (FR-6, UX-DR12, UX-DR13).

**Acceptance Criteria:**

**Étant donné** une œuvre `disponible` et le Lot 2 fermé
**Quand** le visiteur fait défiler la fiche sur mobile
**Alors** la barre fixe montre « Conseil WhatsApp » en action principale et « Réserver une visite » en secondaire ; « Acheter » est absent, et non grisé

**Étant donné** une œuvre `reservee`
**Quand** la barre s'affiche
**Alors** elle propose « Me prévenir » et Conseil WhatsApp ; aucune heure de fin de réservation n'est montrée aux autres visiteurs

**Étant donné** une œuvre `vendue` ou `vendue_ailleurs`
**Quand** la barre s'affiche
**Alors** elle propose Conseil WhatsApp et un lien vers la page de l'artiste

**Étant donné** un pays que l'artiste ne livre pas
**Quand** la barre s'affiche
**Alors** Conseil WhatsApp est l'action principale et la visite reste proposée

**Étant donné** le clavier ouvert, ou un écran à partir de `lg`
**Quand** la fiche s'affiche
**Alors** la barre se masque pendant la saisie ; à partir de `lg`, les actions forment un bloc collant en haut de la colonne d'informations

**Et** il n'y a jamais plus d'une action principale à l'écran.

### Story 4.8: Mesure du tunnel avec consentement

En tant que porteur,
je veux savoir ce qui fait vendre, dans le respect du consentement des visiteurs,
afin de fixer les objectifs après la baseline et de tester chaque levier (FR-27, AD-19, NFR-6).

**Acceptance Criteria:**

**Étant donné** un premier visiteur
**Quand** il arrive sur le site
**Alors** un choix de consentement à la mesure lui est proposé là où la loi l'exige, sans fenêtre surgissante bloquante, et son choix est conservé et modifiable depuis la politique de cookies

**Étant donné** le module `mesure`
**Quand** la story est livrée
**Alors** la liste typée des événements comprend vue de fiche, choix du pays, clic sur Conseil WhatsApp, envoi d'une demande, ajout au panier, début de commande et commande confirmée ; chaque événement porte le slug de l'œuvre et la source d'arrivée
**Et** l'adaptateur de production est PostHog, hébergé dans l'UE ; aucun composant n'importe son SDK directement ; hors production, l'adaptateur « journal » est utilisé

**Étant donné** un visiteur qui refuse la mesure
**Quand** il navigue
**Alors** aucun événement n'est envoyé, ce que vérifie un test, et seuls les taux de consentement et de refus sont comptés

**Et** aucune URL portant un jeton n'est mesurée.

### Story 4.9: Annonce de l'ouverture aux contacts de la maintenance

En tant que porteur,
je veux prévenir, au moment de l'ouverture, toutes les personnes inscrites pendant la maintenance,
afin que le lancement profite à ceux qui l'attendaient (FR-35).

**Acceptance Criteria:**

**Étant donné** les contacts enregistrés par la story 1.9
**Quand** le porteur, après avoir levé lui-même la maintenance dans Vercel, déclenche « Annoncer l'ouverture » depuis l'administration
**Alors** chaque contact consentant reçoit une seule fois l'e-mail « Ouverture du site » (annonce et lien vers l'accueil), avec un lien de désinscription

**Étant donné** un second déclenchement
**Quand** il a lieu
**Alors** aucun contact déjà prévenu ne reçoit un deuxième e-mail

**Et** le bouton ne lève pas la maintenance et ne touche pas `robots.txt` (actes du porteur).

## Epic 5: Mise à niveau de la pile vers Next.js 16

Le site passe sur une version de Next.js maintenue avant que le Lot 2 ne manipule de l'argent et des données personnelles. Chaque étape est vérifiée en préversion et peut être annulée en revenant au commit précédent. Couvre NFR-5 et l'élément différé « montée vers Next.js 16.x » du spine. Aucun FR.

### Story 5.1: Next.js 16, React 19 et ESLint 9

En tant que porteur,
je veux que le site tourne sur Next.js 16 et React 19, avec un lint toujours aussi strict,
afin de recevoir les correctifs de sécurité dans la durée sans affaiblir les règles d'architecture (NFR-5).

**Acceptance Criteria:**

**Étant donné** le projet en Next.js 14.2.35
**Quand** la story est livrée
**Alors** `next` est en 16.x (version épinglée, vérifiée sur npm le jour de la story), `react` et `react-dom` en 19.x, et `eslint-config-next` en 16.x avec ESLint 9 en configuration plate
**Et** les API devenues asynchrones (`params`, `cookies`, `headers`) et les appels à `revalidateTag` sont adaptés, via les codemods officiels quand ils existent
**Et** framer-motion est dans une version compatible avec React 19 (11.18 au minimum)

**Étant donné** la nouvelle configuration ESLint
**Quand** on lance `npx eslint .`
**Alors** toutes les règles existantes sont reprises à l'identique : confinement de Prisma (story 1.6) avec sa liste d'exceptions, interdiction de l'or et de `neutral-400` en texte, chaînes en dur, `react/no-unescaped-entities`

**Étant donné** la CI et la préversion
**Quand** la PR est ouverte
**Alors** lint, build et tests passent, et l'accueil, la galerie, une fiche, le dépôt, la curation, la file des demandes et la connexion se comportent comme avant
**Et** la PR consigne la procédure de retour arrière, et AGENTS.md est mis à jour (versions, commandes).

### Story 5.2: Le middleware devient `src/proxy.ts`

En tant que porteur,
je veux que la maintenance et la protection des espaces continuent de fonctionner sous la nouvelle convention de Next.js 16,
afin de ne pas dépendre d'une fonction dépréciée (NFR-5, AD-15).

**Acceptance Criteria:**

**Étant donné** `src/middleware.ts`
**Quand** la story est livrée
**Alors** il est remplacé par `src/proxy.ts`, qui exporte le gestionnaire d'Auth.js construit à partir de `authConfig` seul (sans Prisma ni bcrypt), selon la forme confirmée par la documentation d'Auth.js le jour de la story
**Et** le fichier n'est jamais placé à la racine du dépôt

**Étant donné** la maintenance active en production
**Quand** un visiteur ouvre une page
**Alors** il voit `maintenance.html`, alors que les admins connectés, `/auth/*`, les routes API et les fichiers statiques passent, comme avant

**Étant donné** une page de `/dashboard/**`
**Quand** un visiteur sans session l'ouvre
**Alors** il est redirigé vers la connexion, sans boucle de redirection sur les routes d'authentification

**Et** des tests ou une vérification consignée en préversion couvrent ces trois cas, et le piège « middleware à la racine » d'AGENTS.md est remplacé par son équivalent pour `src/proxy.ts`.

### Story 5.3: Répartition des événements par `after()`

En tant que porteur,
je veux que les e-mails et l'invalidation du cache partent juste après chaque réponse grâce au mécanisme natif de Next.js 16,
afin de ne plus dépendre d'un contournement propre à Vercel (AD-11).

**Acceptance Criteria:**

**Étant donné** la fonction unique de répartition du module `evenements` (story 3.4)
**Quand** la story est livrée
**Alors** elle utilise `after()` de Next.js à la place de `waitUntil`, et `@vercel/functions` est retiré s'il ne sert plus ailleurs

**Étant donné** un changement de disponibilité ou une demande envoyée
**Quand** la requête se termine
**Alors** l'invalidation du cache et l'e-mail ont lieu sans attendre le balayage, et le test « un seul effet par événement » passe toujours

**Et** aucun autre fichier n'appelle directement `after()` ni `waitUntil` pour des effets de bord.

## Epic 6: L'équipe réserve une œuvre pour un acheteur et conclut une vente assistée

L'équipe réserve une œuvre pour un acheteur identifié, lui envoie un lien de commande, puis constate le paiement ; aucune œuvre n'est jamais vendue deux fois, même quand un paiement arrive en retard ou que l'artiste la vend ailleurs entre-temps. L'epic fonctionne sans prestataire de paiement intégré, ce qui rend possible l'option OQ-12 sans la trancher. Couvre FR-9 (effet), FR-12, FR-13, FR-21 (réservation), FR-26 (réservations et confirmation), FR-28 ; NFR-4 ; AR-10 (éclatement d'`Order`), AR-15 (constat manuel), AR-16. Préalable : plan Vercel ou déclencheur du balayage (AQ-2) avant la story 6.7.

### Story 6.1: Passage en caisse et commandes par artiste, aux montants figés

En tant que membre de l'équipe,
je veux préparer pour un acheteur un passage en caisse qui produit une commande par artiste, aux montants figés,
afin que chaque commande ait son expédition, son suivi et sa somme due, sans que les tarifs changent ensuite (FR-10, AD-12, AR-10).

**Acceptance Criteria:**

**Étant donné** le module `commandes`
**Quand** un passage en caisse est créé pour des œuvres et un pays de livraison
**Alors** il porte les coordonnées de l'acheteur (e-mail, nom, adresse, téléphone) sans `User`, et produit une commande `en_attente_paiement` par artiste
**Et** chaque ligne fige l'id de l'œuvre, un instantané du slug et du titre, le prix de l'œuvre, les frais, la devise, la zone et le délai, calculés par `livraison` à partir de la base

**Étant donné** un tarif ou un slug modifié après la création
**Quand** on relit la commande
**Alors** ses montants et son instantané sont inchangés, ce que vérifie un test

**Étant donné** le modèle `Order` existant
**Quand** la story est livrée
**Alors** ses données éventuelles sont recopiées vers passage en caisse, commande, ligne et paiement par un script idempotent, l'ancienne table restant en lecture pour le retour arrière (temps 1 à 3 d'AD-20)
**Et** chaque commande reçoit un numéro lisible, produit par un seul générateur.

### Story 6.2: Réservation en bloc sans double vente

En tant qu'acheteur,
je veux que les œuvres que je commande me soient réservées pendant que je paie, et à personne d'autre,
afin de ne jamais payer une œuvre déjà vendue (FR-12, AD-7, NFR-4).

**Acceptance Criteria:**

**Étant donné** le module `disponibilite`
**Quand** on réserve les œuvres d'un passage en caisse
**Alors** toutes passent de disponible à `reservee` par une mise à jour conditionnelle dans une seule transaction, ou aucune ; si une seule n'est pas disponible, le résultat nomme l'œuvre en cause (`oeuvre_indisponible`)
**Et** chaque réservation est une ligne `Reservation` (œuvre, passage en caisse, origine `paiement`, échéance, issue)

**Étant donné** l'index unique partiel « une seule réservation active par œuvre »
**Quand** les migrations sont appliquées
**Alors** il est déclaré dans le schéma avec la préversion `partialIndexes` de Prisma, et un test de CI vérifie qu'il existe en base

**Étant donné** deux passages en caisse qui réservent la même œuvre au même instant
**Quand** le test de concurrence s'exécute sur le vrai PostgreSQL
**Alors** exactement un obtient la réservation (cas 1 de NFR-4)

**Étant donné** une réservation dont l'échéance est passée
**Quand** une nouvelle réservation est tentée sur la même œuvre
**Alors** l'ancienne est libérée dans la même transaction, avec l'issue `expiree`, et la nouvelle réussit

**Étant donné** le plafond réglable de réservations simultanées par e-mail et par appareil
**Quand** il est atteint
**Alors** la réservation suivante est refusée avec un code explicite
**Et** la durée (environ 30 minutes) est un réglage.

### Story 6.3: Vente assistée : réserver pour un acheteur et lui envoyer son lien

En tant que membre de l'équipe, après un conseil ou une visite,
je veux réserver une œuvre pour un acheteur identifié et lui envoyer un lien qui rouvre sa commande,
afin qu'il puisse commander sans risque que l'œuvre parte entre-temps (FR-12, FR-26, FR-28, UJ-4).

**Acceptance Criteria:**

**Étant donné** `/dashboard/admin/commandes`
**Quand** l'équipe pose une réservation de vente assistée pour un acheteur (e-mail, nom, pays) et une ou plusieurs œuvres
**Alors** un passage en caisse est créé à son nom, les œuvres sont réservées avec l'origine `vente_assistee` et l'échéance réglable (environ 48 h), et un jeton `commande_assistee` est émis
**Et** l'e-mail part avec le lien ; le jeton n'existe en clair que dans l'e-mail (AD-14)

**Étant donné** l'acheteur qui ouvre le lien
**Quand** le jeton est valide
**Alors** il est échangé contre un cookie `httpOnly`, puis une page sans jeton montre le récapitulatif de son passage en caisse (œuvres, commandes par artiste, montants recalculés côté serveur, réservation en heure fixe) et indique que l'équipe lui transmet le moyen de paiement, avec Conseil WhatsApp
**Et** sa propre réservation ne le bloque pas ; l'arrivée de ce lien dans le panier viendra avec la story 7.2

**Étant donné** une réservation de vente assistée
**Quand** l'équipe la libère
**Alors** l'œuvre redevient disponible, l'issue est journalisée (`liberee`, qui, quand), et le lien ne rouvre plus rien

**Étant donné** la vue des réservations
**Quand** l'équipe l'ouvre
**Alors** elle voit les réservations en cours (œuvre, bénéficiaire, origine, échéance) et le journal des réservations terminées avec leur issue

**Étant donné** une demande de visite ou un conseil à l'origine de la vente
**Quand** l'équipe pose la réservation depuis la demande, ou rattache ensuite la commande à une demande
**Alors** la commande est rattachée à la vente assistée, automatiquement dans le premier cas (FR-28)
**Et** seul l'acteur `admin` peut faire ces opérations, ce que vérifie un test.

### Story 6.4: Paiement constaté par l'équipe et confirmation idempotente

En tant que membre de l'équipe,
je veux enregistrer un paiement reçu par virement ou par lien, et que les commandes soient confirmées une seule fois,
afin de conclure une vente sans prestataire intégré, en toute traçabilité (FR-13, AD-4, AD-8).

**Acceptance Criteria:**

**Étant donné** le module `paiement`
**Quand** la story est livrée
**Alors** il expose les ports Encaissement, Remboursement et Reversement, et un Paiement couvre une ou plusieurs commandes d'un passage en caisse avec un montant alloué à chacune (unique ou par commande : réglage, OQ-16)
**Et** l'adaptateur `constat-manuel` enregistre qui a constaté, quand, avec quelle référence ; la paire (source, référence externe) est unique
**Et** aucun nom de prestataire n'apparaît hors de `src/lib/paiement/adaptateurs/**`

**Étant donné** un constat de paiement
**Quand** `commandes.traiterPaiementConstate` le reçoit
**Alors** dans une seule transaction, le Paiement passe de `ouvert` à `constate` par une mise à jour conditionnelle, puis, pour chaque commande couverte, ses œuvres passent en `vendue` (réservées pour ce passage, ou encore disponibles) et la commande en `confirmee`
**Et** l'acheteur reçoit la confirmation (récapitulatif par commande, délai ; le lien de suivi s'y ajoutera avec la story 7.7), l'artiste reçoit « Nouvelle commande » avec l'échéance de prise en charge en heure fixe, et l'équipe reçoit l'alerte « nouvelle commande »

**Étant donné** le même constat enregistré deux fois, ou sous deux références qui désignent le même Paiement
**Quand** il est traité
**Alors** rien ne change la seconde fois, ce que vérifie un test

**Étant donné** un montant ou une devise différents de l'allocation
**Quand** le constat est traité
**Alors** aucune commande n'est confirmée et un incident est enregistré pour l'équipe.

### Story 6.5: Paiement tardif, abandon et incidents

En tant que membre de l'équipe,
je veux qu'un paiement arrivé après la fin d'une réservation soit traité sans jamais vendre une œuvre deux fois,
afin de ne perdre ni une vente légitime ni la confiance d'un acheteur (FR-13, FR-31, NFR-4, SM-C1).

**Acceptance Criteria:**

**Étant donné** une commande `en_attente_paiement`
**Quand** elle est créée
**Alors** elle porte une échéance d'abandon, réglable et plus longue que la réservation ; l'expiration de la réservation n'annule pas la commande

**Étant donné** un paiement constaté après l'expiration de la réservation mais avant l'abandon
**Quand** les œuvres de la commande sont encore disponibles
**Alors** la commande est confirmée et les œuvres vendues (cas 2 de NFR-4, testé)

**Étant donné** le même paiement tardif alors qu'une œuvre de la commande a été réservée ou vendue pour quelqu'un d'autre
**Quand** il est traité
**Alors** cette commande passe en `annulee`, un remboursement égal à son allocation est créé à l'état `demandé`, un incident SM-C1 est enregistré, et les autres commandes du même paiement restent confirmées (tout ou rien par commande, testé)
**Et** l'acheteur reçoit un e-mail sobre qui explique le fait et l'état du remboursement

**Étant donné** une commande déjà `annulee` (abandon passé)
**Quand** un paiement la concernant est constaté
**Alors** elle n'est jamais confirmée : un remboursement est demandé et un incident est enregistré

**Étant donné** la vue des incidents
**Quand** l'équipe l'ouvre
**Alors** elle voit chaque incident (commande, cause, date) et les remboursements `demandé` à traiter ; leur exécution passe par l'adaptateur manuel (moyen selon OQ-1).

### Story 6.6: Vente ailleurs pendant une réservation

En tant qu'artiste qui vend une œuvre à l'atelier pendant qu'un acheteur la paie sur Errancy,
je veux que ma déclaration prime et que l'acheteur soit pris en charge par l'équipe,
afin de n'avoir rien d'autre à faire (FR-21, FR-31, NFR-4, UJ-2).

**Acceptance Criteria:**

**Étant donné** une œuvre `reservee`
**Quand** l'artiste la déclare « Vendue ailleurs » ou la retire (story 2.8)
**Alors** `disponibilite` annule la réservation, mémorise que la déclaration l'a interrompue, et écrit l'événement `ReservationAnnulee`

**Étant donné** l'événement `ReservationAnnulee`
**Quand** le gestionnaire de `commandes` le traite
**Alors** la commande en attente concernée passe en `annulee` avec le motif, l'acheteur est prévenu (réservation annulée, excuses sobres), l'équipe est alertée, et un incident SM-C1 est enregistré
**Et** le gestionnaire ne fait rien si la commande a déjà quitté l'état attendu

**Étant donné** un paiement constaté plus tard pour cette commande
**Quand** il est traité
**Alors** il donne lieu à un remboursement et à un incident, jamais à une vente (cas 3 de NFR-4, testé)

**Étant donné** l'espace artiste
**Quand** l'artiste confirme sa déclaration
**Alors** le bandeau dit « Un acheteur avait réservé cette œuvre. L'équipe Errancy le prévient et s'occupe d'un éventuel remboursement. Vous n'avez rien à faire. », sans lien « Annuler ».

### Story 6.7: Balayage et priorité « Me prévenir »

En tant que visiteur inscrit à « Me prévenir »,
je veux être prévenu dès qu'une réservation expire, et avoir alors un court délai pour commander avant les autres,
afin que mon inscription me serve vraiment (FR-9, AD-7, AD-11).

**Acceptance Criteria:**

**Étant donné** la route protégée `api/balayage`
**Quand** elle est appelée par le déclencheur retenu (Vercel Cron sur le plan Pro, ou un déclencheur externe planifié, AQ-2)
**Alors** elle rejoue les événements en échec, libère les réservations échues avec l'issue `expiree`, et toute exécution répétée est sans effet supplémentaire
**Et** un appel sans le secret du déclencheur est refusé

**Étant donné** une réservation expirée sur une œuvre qui a des inscrits
**Quand** le balayage la traite
**Alors** le premier inscrit reçoit « [œuvre] est de nouveau disponible » avec le délai de priorité, et une réservation d'origine `priorite` est posée à son nom pour ce délai (réglable)
**Et** si le délai passe sans commande, l'inscrit suivant est prévenu à son tour ; sans inscrit restant, l'œuvre redevient disponible pour tous

**Étant donné** l'inscrit prioritaire
**Quand** il ouvre le lien reçu
**Alors** la fiche lui indique que l'œuvre lui est réservée jusqu'à [heure fixe] et lui propose Conseil WhatsApp pour une vente assistée ; personne d'autre ne peut la réserver pendant ce délai
**Et** la commande directe par le panier honorera cette priorité avec la story 7.3.

## Epic 7: L'acheteur commande sans compte, auprès de plusieurs artistes, et suit ses commandes

L'acheteur ajoute des œuvres de plusieurs artistes à un panier public, voit une commande par artiste avec des montants recalculés côté serveur, donne ses coordonnées sans créer de compte, paie, reçoit sa confirmation et suit ses commandes par un lien ; les pages légales et de confiance sont publiées ; « Acheter » s'ouvre quand le porteur le décide. Couvre FR-6 (Lot 2), FR-10, FR-11, FR-14 (bloqué par OQ-1), FR-15, FR-23, FR-24 ; AD-13, AR-14 (suivi), AR-15 ; UX-DR11, UX-DR12 (Lot 2), UX-DR23, UX-DR24, UX-DR28, UX-DR29, UX-DR37, UX-DR38 (panier, paiement, suivi), UX-DR43. OQ-16 reste un réglage du module de paiement.

### Story 7.1: Pages légales et de confiance

En tant qu'acheteur à distance,
je veux trouver des règles claires sur le rôle d'Errancy, la livraison, les retours et l'authenticité,
afin de savoir à quoi je m'engage avant de payer (FR-23, FR-24).

**Acceptance Criteria:**

**Étant donné** les URL `/cgv`, `/mentions-legales`, `/confidentialite`, `/cookies`, `/livraison`, `/retours` et `/authenticite`
**Quand** elles sont publiées
**Alors** leur contenu vient de textes fournis ou validés par le porteur ; les CGV présentent l'artiste comme vendeur et Errancy comme intermédiaire
**Et** l'identité de l'exploitant reste dans une zone neutre tant qu'OQ-1 est ouverte, et aucune durée de retour, aucune gratuité et aucune « Garantie Errancy » n'apparaissent tant qu'OQ-2 et OQ-4 sont ouvertes

**Étant donné** la fiche œuvre (story 3.6) et le pied de page
**Quand** les pages de confiance existent
**Alors** « Est-ce sérieux ? » et le pied de page y renvoient

**Et** la politique de cookies permet de modifier le choix de consentement à la mesure (story 4.8).

### Story 7.2: Panier sans compte, une commande par artiste

En tant qu'acheteur qui a choisi deux œuvres de deux artistes,
je veux voir mon panier sans me connecter, organisé en une commande par artiste,
afin de comprendre que je recevrai deux colis, de deux villes, à deux dates (FR-10, FR-11, AD-13, UJ-4).

**Acceptance Criteria:**

**Étant donné** `/panier`
**Quand** un visiteur sans session l'ouvre
**Alors** la page s'affiche (le chemin sort des routes protégées), et le panier du navigateur ne garde que des slugs ; les anciennes données de prix stockées sont ignorées

**Étant donné** un panier contenant des œuvres de plusieurs artistes
**Quand** il s'affiche
**Alors** le serveur recalcule, pour le pays choisi, une carte numérotée par artiste (œuvres, livraison, sous-total, délai, ville d'expédition) et le total général rappelé en clair (« 2 400 € + 680 € »), avec la mention des droits et taxes
**Et** un bandeau dit « N colis séparés, N délais : … » ; les montants restent masqués tant qu'ils ne sont pas recalculés

**Étant donné** le pays changé depuis le panier
**Quand** le recalcul a lieu
**Alors** toutes les cartes et le total sont recalculés, et le recalcul est annoncé aux technologies d'assistance

**Étant donné** une œuvre du panier devenue indisponible
**Quand** le panier s'affiche
**Alors** sa ligne devient « Vendue entre-temps — retirée de votre commande. », avec trois œuvres proches du même artiste, sans modale ; les autres commandes restent intactes

**Étant donné** un panier vide, ou une erreur de recalcul
**Quand** il s'affiche
**Alors** on voit « Votre panier est vide. » avec « Parcourir la galerie », ou « Nous n'avons pas pu recalculer vos montants. Réessayer », le panier étant conservé

**Étant donné** un lien `commande_assistee` (story 6.3)
**Quand** l'acheteur l'ouvre
**Alors** les œuvres réservées pour lui entrent dans son panier avec leur réservation, et il peut y ajouter une œuvre d'un autre artiste (UJ-4)

**Et** le panier propose « Continuer à parcourir » et Conseil WhatsApp, et la barre fixe affiche « Continuer » avec le total et le nombre de commandes en sous-ligne.

### Story 7.3: Coordonnées sans compte et réservation affichée en heure fixe

En tant qu'acheteur,
je veux donner seulement mes coordonnées, sans créer de compte, et savoir jusqu'à quand mes œuvres me sont réservées,
afin de commander vite et sans pression (FR-10, FR-12, UX-DR37).

**Acceptance Criteria:**

**Étant donné** le panier
**Quand** l'acheteur touche « Continuer » (début de la réservation : hypothèse retenue pour UXQ-2)
**Alors** un passage en caisse est créé et ses œuvres sont réservées en bloc (story 6.2) ; si une œuvre n'est plus disponible, rien n'est réservé et sa ligne le dit
**Et** une réservation déjà détenue pour cet acheteur (vente assistée ou priorité « Me prévenir », stories 6.3 et 6.7) est reprise et ne le bloque pas

**Étant donné** `/commande/coordonnees`
**Quand** l'acheteur saisit e-mail, nom, adresse de livraison et téléphone
**Alors** les champs ont un libellé visible et l'`autocomplete` adapté, la validation a lieu à la sortie du champ et à l'envoi, et la saisie est conservée après une erreur
**Et** la page dit « Pas besoin de créer un compte : vous suivrez vos commandes grâce au lien envoyé par e-mail. »
**Et** changer le pays de livraison recalcule toutes les commandes

**Étant donné** une réservation en cours
**Quand** l'acheteur regarde l'écran
**Alors** il lit « Œuvres réservées pour vous jusqu'à 15 h 42. » dans le fuseau de son appareil, sans compte à rebours ni couleur
**Et** à l'échéance, la phrase devient « Votre réservation a pris fin à 15 h 42. », et « Continuer » tente une nouvelle réservation.

### Story 7.4: Récapitulatif et paiement dans une zone neutre

En tant qu'acheteur,
je veux un récapitulatif complet par commande avant de payer,
afin d'être sûr du prix total, du délai et des conditions (FR-11, FR-14, AD-4).

**Acceptance Criteria:**

**Étant donné** `/commande/paiement`
**Quand** l'acheteur y arrive
**Alors** il voit, pour chaque commande, le prix de chaque œuvre, les frais de livraison, le prix total, le délai total, l'artiste, le rappel des garanties et conditions de retour avec un lien vers les pages de confiance, puis le total général, tous recalculés côté serveur
**Et** la réservation est rappelée en heure fixe, avec « Une question ? Écrire sur WhatsApp »

**Étant donné** le port Encaissement
**Quand** le paiement s'ouvre
**Alors** un ou plusieurs Paiements sont ouverts selon le réglage OQ-16 (un pour tout le passage en caisse, ou un par commande enchaîné dans le même parcours), aux montants alloués par commande

**Étant donné** aucun adaptateur d'encaissement intégré configuré (OQ-1 ouverte)
**Quand** la zone de paiement s'affiche
**Alors** elle reste une zone neutre qui nomme ce qui n'est pas décidé, sans formulaire, sans logo ni nom de prestataire, et l'acheteur est invité à finaliser avec l'équipe (le constat manuel de la story 6.4 s'applique)
**Et** le serveur ne débite jamais un montant différent du total recalculé.

### Story 7.5: Encaissement intégré par le prestataire retenu (bloqué par OQ-1)

En tant qu'acheteur,
je veux payer le prix total en ligne par un moyen accepté à l'international,
afin de finir ma commande sans attendre l'équipe (FR-14).

**Acceptance Criteria:**

**Étant donné** la décision du porteur sur OQ-1 (prestataire, entité qui encaisse, devise)
**Quand** la story démarre
**Alors** l'adaptateur de ce prestataire est écrit dans `src/lib/paiement/adaptateurs/<nom>/` ; si Stripe est retenu, le code Stripe actuel (`/api/checkout`, `api/webhooks/stripe`) est réécrit en adaptateur `stripe-checkout` et sort de la liste d'exceptions d'AD-1

**Étant donné** une notification du prestataire
**Quand** elle est reçue
**Alors** sa signature est vérifiée, chacun de ses identifiants externes est rattaché à un seul Paiement, et elle est transmise à `commandes.traiterPaiementConstate`, comme le constat manuel
**Et** les deux notifications d'un même paiement ne produisent qu'une confirmation, ce que vérifie un test

**Étant donné** la zone de paiement
**Quand** l'adaptateur est configuré
**Alors** elle affiche le moyen de paiement du prestataire, et le nom du prestataire n'apparaît que dans ce composant d'adaptateur

**Et** le remboursement et le reversement par ce prestataire suivent la même décision d'OQ-1, dans des stories séparées.

### Story 7.6: Confirmation de commande

En tant qu'acheteur,
je veux savoir tout de suite que mes commandes sont confirmées et ce qui va se passer,
afin d'être rassuré après avoir payé (FR-13, UJ-1).

**Acceptance Criteria:**

**Étant donné** `/confirmation` après un paiement
**Quand** le paiement est constaté
**Alors** la page dit « Merci, [prénom] », liste chaque commande numérotée avec l'artiste, le délai et le libellé « Confirmée », et propose « Suivre mes commandes »

**Étant donné** un paiement pas encore constaté au moment de l'affichage
**Quand** la page s'ouvre
**Alors** elle dit que la confirmation arrive par e-mail, sans afficher « Confirmée » à tort, et se met à jour quand le constat arrive

**Et** la page n'appelle aucun prestataire directement, et ne propose pas de créer de compte (UXQ-9).

### Story 7.7: Suivi des commandes par lien, sans compte

En tant qu'acheteur,
je veux suivre toutes mes commandes à partir du lien reçu par e-mail,
afin de savoir où en est chaque colis sans créer de compte (FR-15, AD-14).

**Acceptance Criteria:**

**Étant donné** un lien `/suivi/[jeton]`
**Quand** il est ouvert avec un jeton valide
**Alors** le jeton est échangé contre un cookie `httpOnly` puis l'URL est redirigée sans jeton, avec `Referrer-Policy: no-referrer`, et la page est exclue de la mesure
**Et** chaque e-mail de commande (confirmation, prise en charge, expédition, livraison) porte désormais un lien de suivi, émis au moment de l'envoi (AD-14)

**Étant donné** la page de suivi
**Quand** elle s'affiche
**Alors** elle montre chaque commande du passage en caisse avec sa frise d'états (dates réelles des étapes faites, date prévue de livraison), le transporteur et le numéro de suivi une fois saisis, et le minimum de données personnelles
**Et** elle propose Conseil WhatsApp avec le numéro de commande ; « Signaler un problème » viendra avec les réclamations (Epic 8)

**Étant donné** toutes les commandes du passage closes
**Quand** le lien est ouvert
**Alors** la page dit « Ce lien de suivi n'est plus actif : la commande est close. », avec Conseil WhatsApp
**Et** un jeton inconnu donne la même page, sans indiquer s'il a existé.

### Story 7.8: Ouverture de « Acheter »

En tant que porteur,
je veux ouvrir l'achat en ligne quand toutes les conditions sont réunies,
afin que les visiteurs puissent acheter seuls, en toute sécurité (FR-6, AD-17).

**Acceptance Criteria:**

**Étant donné** le Lot 2 ouvert par le porteur (story 1.7)
**Quand** une œuvre `disponible` s'affiche dans un pays livré
**Alors** « Acheter » est l'action principale de la barre, Conseil WhatsApp passe en secondaire, « Réserver une visite » reste disponible, et « Acheter » ajoute l'œuvre au panier et y conduit directement
**Et** l'en-tête affiche « Panier (n) »

**Étant donné** le Lot 2 fermé
**Quand** les mêmes écrans s'affichent
**Alors** rien de cela n'apparaît, et le serveur refuse le passage en caisse public

**Étant donné** l'ouverture du Lot 2
**Quand** le porteur la prépare
**Alors** la PR fournit une liste de contrôle : tests NFR-4 au vert, pages légales et de confiance publiées, moyen d'encaissement décidé (OQ-1) ou ventes par constat manuel assumées, assiette de la commission (OQ-3) et zones (OQ-5) réglées, durée de conservation fixée (AQ-6)
**Et** l'ouverture reste un geste du porteur dans Vercel.

### Story 7.9: Retrait de l'ancien modèle de commande

En tant que porteur,
je veux supprimer l'ancien modèle `Order` et l'ancien chemin d'achat une fois le nouveau vérifié,
afin qu'aucun code ne crée plus de commande sans réservation (AD-20, temps 4).

**Acceptance Criteria:**

**Étant donné** les stories 6.1 et 7.2 à 7.7 en production depuis la période de vérification convenue
**Quand** la story est livrée
**Alors** la table `Order` (`artworkIds` en CSV, `amount` en `Float`) et le code qui l'écrivait sont supprimés, et AGENTS.md ne décrit plus `Order.artworkIds`
**Et** la sauvegarde restaurable est vérifiée juste avant, et la répétition sur une branche Neon est consignée.

## Epic 8: Chaque commande est menée jusqu'à sa clôture, et l'artiste est payé

L'artiste prend en charge et expédie chaque commande, l'adresse de l'acheteur ne lui étant visible qu'au bon moment ; l'équipe est alertée des retards, constate la livraison, traite réclamations et remboursements, et chaque commande se clôt ; la somme due à l'artiste est calculée en un seul endroit et visible par l'artiste comme par l'équipe. Couvre FR-22, FR-26 (alertes et annulations), FR-29, FR-30, FR-31, FR-32, FR-33 ; AD-9, AD-10, AD-16, AD-24 ; UX-DR29, UX-DR33, UX-DR40, UX-DR41, UX-DR42 (commandes), UX-DR44. Les valeurs (délai de retour, seuil d'assurance, assiette de la commission) sont des réglages qui attendent OQ-2, OQ-3, OQ-4 et OQ-5 ; le moyen de rembourser et de verser reste manuel tant qu'OQ-1 est ouverte.

### Story 8.1: L'artiste prend en charge ses commandes

En tant qu'artiste,
je veux voir chaque nouvelle commande et la prendre en charge en un geste,
afin de préparer l'envoi dans les temps, l'adresse de l'acheteur ne m'étant donnée qu'à ce moment-là (FR-22, AD-16, UJ-2).

**Acceptance Criteria:**

**Étant donné** l'accueil de l'espace artiste
**Quand** une commande `confirmee` existe sur ses œuvres
**Alors** le bloc « À expédier » apparaît en premier, avec un compteur du nombre de commandes à prendre en charge, masqué à zéro

**Étant donné** `/dashboard/artiste/commandes/[numero]` avant la prise en charge
**Quand** l'artiste l'ouvre
**Alors** il voit l'œuvre, le prénom et le pays de l'acheteur, et l'échéance de prise en charge en heure fixe (48 h par défaut, réglable) ; l'adresse et le téléphone restent dans une zone neutre, et le module `commandes` ne les renvoie pas (test)

**Étant donné** « Je prends en charge »
**Quand** l'artiste confirme
**Alors** la commande passe en `prise_en_charge` par la table de transitions, l'adresse et le téléphone apparaissent avec le rappel du guide d'emballage, et l'acheteur reçoit l'e-mail « Prise en charge »
**Et** un artiste ne peut ni voir ni prendre en charge la commande d'un autre artiste (test).

### Story 8.2: L'artiste expédie et saisit le suivi

En tant qu'artiste,
je veux indiquer le transporteur et le numéro de suivi,
afin que l'acheteur sache que son œuvre est en route (FR-22, FR-29).

**Acceptance Criteria:**

**Étant donné** une commande `prise_en_charge`
**Quand** l'artiste saisit le transporteur et le numéro de suivi, puis « Marquer comme expédiée »
**Alors** la commande passe en `expediee`, et l'acheteur reçoit l'e-mail « Expédition » avec le transporteur, le numéro et le lien de suivi

**Étant donné** une commande dont le prix figé dépasse le seuil réglable (OQ-5)
**Quand** l'artiste veut la marquer expédiée
**Alors** l'envoi assuré avec preuve de livraison est exigé (case et référence obligatoires), et le message dit ce qui manque

**Et** la page de suivi de l'acheteur affiche l'étape « Expédiée [date] · n° de suivi ».

### Story 8.3: Commandes et alertes de l'équipe

En tant que membre de l'équipe,
je veux voir où en est chaque commande et être alerté des retards,
afin d'intervenir avant qu'un acheteur ne s'inquiète (FR-26, AD-10, UJ-3).

**Acceptance Criteria:**

**Étant donné** `/dashboard/admin/commandes`
**Quand** l'équipe l'ouvre
**Alors** elle voit chaque commande avec son état, l'artiste, l'échéance de prise en charge, l'échéance d'expédition (fin du délai de préparation déclaré), le numéro de suivi, les réclamations et les remboursements

**Étant donné** une prise en charge absente 48 h après la confirmation, ou une expédition absente à la fin du délai de préparation
**Quand** la liste s'affiche
**Alors** chaque retard est signalé par une alerte distincte, calculée à la lecture à partir des échéances stockées, sans attendre aucune tâche
**Et** le balayage envoie à l'équipe une seule alerte par retard

**Étant donné** une commande `confirmee` ou `prise_en_charge`
**Quand** l'équipe l'annule avec un motif obligatoire
**Alors** la commande passe en `annulee`, un remboursement de son allocation est demandé, l'acheteur et l'artiste sont prévenus, et l'action est tracée (qui, quand, motif)

**Et** seul l'acteur `admin` accède à ces écrans et à ces actions (test).

### Story 8.4: Livraison constatée

En tant qu'acheteur, artiste ou membre de l'équipe,
je veux que la livraison soit enregistrée de façon fiable,
afin que le délai de retour démarre à la bonne date et que l'adresse ne reste pas exposée (FR-29, FR-22).

**Acceptance Criteria:**

**Étant donné** une commande `expediee`
**Quand** l'acheteur touche « J'ai reçu l'œuvre » sur sa page de suivi, ou que l'équipe enregistre la livraison d'après le suivi du transporteur ou sur preuve
**Alors** la commande passe en `livree` avec la date et la source du constat
**Et** au-delà du seuil réglable, seule une preuve de livraison enregistrée par l'équipe permet le constat

**Étant donné** une commande `livree`
**Quand** l'artiste l'ouvre
**Alors** l'adresse et le téléphone de l'acheteur sont de nouveau masqués (test)
**Et** l'échéance de fin du délai de retour est stockée à partir de la date de livraison (durée réglable, OQ-4), et l'acheteur reçoit l'e-mail « Livraison » avec « Signaler un problème ».

### Story 8.5: Réclamation et retour

En tant qu'acheteur dont l'œuvre est arrivée abîmée ou ne convient pas,
je veux signaler le problème depuis ma page de suivi,
afin que l'équipe le règle rapidement (FR-30, FR-15).

**Acceptance Criteria:**

**Étant donné** une commande `livree` pendant le délai de retour
**Quand** l'acheteur touche « Signaler un problème » sur sa page de suivi
**Alors** il choisit le motif (œuvre abîmée, non conforme, changement d'avis), décrit le problème et peut joindre des photos ; la réclamation est enregistrée par `commandes` et l'équipe est alertée

**Étant donné** une réclamation ouverte
**Quand** l'équipe l'accepte comme retour
**Alors** le renvoi à l'artiste dans l'emballage d'origine est organisé, puis la commande passe en `retournee` à la réception par l'artiste ; un remboursement (total ou partiel) est demandé
**Et** quand l'équipe la refuse, elle saisit un motif communiqué à l'acheteur

**Étant donné** le délai de retour échu
**Quand** l'acheteur ouvre sa page de suivi
**Alors** « Signaler un problème » n'est plus proposé, et Conseil WhatsApp reste disponible

**Et** les frais de retour, le choix entre remboursement et avoir et la prise en charge de la casse suivent OQ-2 et OQ-4 : aucune valeur n'est codée en dur.

### Story 8.6: Remboursements tracés

En tant que membre de l'équipe,
je veux déclencher et suivre chaque remboursement avec son motif,
afin que chaque acheteur soit remboursé de ce qu'il a payé, et pas plus (FR-31, AD-24).

**Acceptance Criteria:**

**Étant donné** une commande annulée, une œuvre vendue ailleurs, un paiement reçu après une réservation perdue ou un retour accepté
**Quand** l'équipe déclenche un remboursement total ou partiel avec un motif
**Alors** il est rattaché à la paire (paiement, commande), et la somme des remboursements d'une commande ne peut jamais dépasser son allocation (refus explicite, test)

**Étant donné** un remboursement `demandé`
**Quand** l'équipe l'exécute par le moyen disponible et le marque `effectué` avec sa référence (adaptateur manuel tant qu'OQ-1 est ouverte)
**Alors** l'état change, et l'acheteur est prévenu par e-mail à chaque changement d'état

**Et** la page de suivi affiche l'état du remboursement d'une commande annulée ou retournée.

### Story 8.7: Clôture des commandes

En tant que membre de l'équipe,
je veux que chaque commande se clôture d'elle-même au bon moment,
afin que la somme due à l'artiste devienne exigible et que les données de l'acheteur cessent d'être exposées (FR-33, AD-9, AD-10).

**Acceptance Criteria:**

**Étant donné** une commande `livree` dont le délai de retour est échu, sans réclamation ouverte
**Quand** le balayage passe
**Alors** elle passe en `close`, une seule fois même si le balayage repasse

**Étant donné** une commande `annulee` ou `retournee`
**Quand** ses remboursements sont tous `effectué`, ou s'il n'y a eu aucun encaissement
**Alors** elle passe en `close`

**Étant donné** la dernière commande d'un passage en caisse close
**Quand** la clôture est enregistrée
**Alors** un gestionnaire d'événement révoque les jetons de suivi de ce passage, et la page de suivi devient inactive

**Étant donné** une œuvre `vendue` dont la commande est annulée ou retournée
**Quand** l'équipe le décide
**Alors** l'œuvre passe en `retiree` par `disponibilite`, et l'artiste peut la remettre en vente, ce qui la renvoie en curation.

### Story 8.8: Somme due à l'artiste

En tant qu'artiste,
je veux voir ce qu'Errancy me doit pour chaque vente, et quand,
afin de suivre mes revenus sans avoir à demander (FR-32, AD-24, UX-DR41).

**Acceptance Criteria:**

**Étant donné** une commande confirmée
**Quand** la confirmation est enregistrée
**Alors** le taux de commission (30 %) et l'assiette (réglage OQ-3 : œuvre seule ou livraison comprise) en vigueur sont figés sur la commande, et une seule fonction de `commandes` calcule la commission et la somme due

**Étant donné** la clôture de la commande
**Quand** elle est enregistrée
**Alors** la somme due est recalculée, déduction faite des remboursements, et passe à `à verser`

**Étant donné** `/dashboard/artiste/paiements` (« Ce qu'on vous doit ») et le bloc correspondant de l'accueil
**Quand** l'artiste les ouvre
**Alors** il voit, par commande, le prix de l'œuvre, la commission avec la mention de son assiette, le montant dû et l'état du reversement ; le moyen de versement reste une zone neutre (OQ-1)
**Et** l'affichage d'une somme pas encore exigible suit le vocabulaire de FR-32 (UXQ-4 : hypothèse retenue)

**Étant donné** l'équipe sur `/dashboard/admin/commandes`
**Quand** elle verse la somme par le moyen disponible ou la bloque avec un motif
**Alors** l'état passe à `versée` (avec référence) ou `bloquée`, par l'adaptateur manuel du port Reversement, et l'artiste voit le même chiffre et le même état que l'équipe (test).
