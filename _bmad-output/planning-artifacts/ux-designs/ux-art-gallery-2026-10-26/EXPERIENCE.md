---
title: EXPERIENCE — Errancy
status: final
created: 2026-10-26
updated: 2026-10-27
sources:
  - ../../prds/prd-art-gallery-2026-10-24/prd.md
  - ../../prds/prd-art-gallery-2026-10-24/addendum.md
  - ../../research/competitive-fiches-oeuvres-confiance-acheteur-2026-10-24/research.md
  - ../../../../docs/strategie-refonte.md
  - ../../../../docs/analyse-projet.md
---

# Errancy — spécification d’expérience

## Fondations (Foundation)

- **Support** : web **mobile d’abord**, responsive jusqu’à l’ordinateur. Pas d’application native.
- **Pile** : l’existant, Next.js 14 (App Router) + Tailwind 3 + framer-motion. Pas de bibliothèque de composants (pas de shadcn) : les composants de ce document sont à construire sur Tailwind avec les jetons de [DESIGN.md](DESIGN.md), qui fait foi pour l’identité visuelle. Ce document fait foi pour le comportement.
- **Critère de relecture de chaque écran public** : l’acheteur peut-il répondre seul aux quatre questions, *Ira-t-elle chez moi ? Est-elle trop petite ? Est-elle trop chère ? Est-ce sérieux ?* (PRD §1). Un écran qui en cache une sans raison est à reprendre.
- **Lots** (PRD §6.1) : **Lot 1** sans « Acheter » (conseil, visite, catalogue, espace artiste, curation) ; **Lot 2** avec « Acheter », panier, commande, suivi et après-vente. Chaque surface ci-dessous indique son lot. L’état « réservée » ne s’active qu’avec FR-12 (Lot 2, ou plus tôt si OQ-12 l’avance).
- **Glossaire** : celui du PRD §3, sans synonyme (œuvre, fiche œuvre, disponibilité, réservation, panier, commande, prix total, délai total, Conseil WhatsApp, demande de visite, somme due à l’artiste).

## Architecture de l’information (Information Architecture)

| Surface | URL | Accès | FR | Lot | Parcours |
|---|---|---|---|---|---|
| Accueil | `/` | public | FR-18, FR-7 | 1 | UJ-4 |
| Galerie | `/galerie` | public | FR-17, FR-3 | 1 | UJ-4 |
| Fiche œuvre | `/galerie/[id]` (id = slug) | public | FR-1 à FR-9, FR-24 | 1 (+ Acheter en 2) | UJ-1, UJ-4 |
| Demande de visite | `/galerie/[id]/visite` — URL à créer `[ASSUMPTION]` | public | FR-8 | 1 | UJ-4 |
| Demande de sélection personnalisée | `/conseil` — URL à créer `[ASSUMPTION]` | public | FR-8 | 1 | — |
| Artistes / page artiste | `/artistes`, `/artistes/[id]` | public | FR-19, FR-7 | 1 | UJ-1 |
| Pages de confiance | `/livraison`, `/retours`, `/authenticite` — URL à créer `[ASSUMPTION]` | public | FR-24 | 2 | UJ-1 |
| Pages légales | `/cgv`, `/mentions-legales`, `/confidentialite`, `/cookies` — URL à créer `[ASSUMPTION]` | public | FR-23 | 2 | — |
| Panier | `/panier` (devient accessible sans connexion) | public | FR-10, FR-11, FR-12, FR-7 | 2 | UJ-4 |
| Coordonnées | `/commande/coordonnees` — URL à créer `[ASSUMPTION]` | public | FR-10 | 2 | UJ-1, UJ-4 |
| Paiement | `/commande/paiement` — URL à créer `[ASSUMPTION]` | public | FR-14 (zone neutre) | 2 | UJ-1, UJ-4 |
| Confirmation | `/confirmation` | public | FR-13 | 2 | UJ-1, UJ-4 |
| Suivi par lien | `/suivi/[jeton]` — URL à créer `[ASSUMPTION]` | lien à jeton | FR-15, FR-30, FR-7 | 2 | UJ-1, UJ-4 |
| Activation d’invitation | `/auth/invitation/[jeton]` — URL à créer `[ASSUMPTION]` | lien à jeton | FR-34 | 1 | UJ-2 |
| Connexion | `/auth/connexion` | public | — | 1 | UJ-2, UJ-3 |
| Espace artiste — accueil | `/dashboard/artiste` | `artist` | FR-22, FR-32 | 1 (blocs commandes et paiements en 2) | UJ-2 |
| Mes œuvres | `/dashboard/artiste/oeuvres` | `artist` | FR-21 | 1 | UJ-2 |
| Déposer / modifier une œuvre | `/dashboard/artiste/oeuvres/nouvelle`, `/dashboard/artiste/oeuvres/[slug]` | `artist` | FR-20 | 1 | UJ-2 |
| Commandes artiste | `/dashboard/artiste/commandes` (+ `/[numero]`) — URL à créer `[ASSUMPTION]` | `artist` | FR-22 | 2 | UJ-2 |
| Ce qu’on vous doit | `/dashboard/artiste/paiements` — URL à créer `[ASSUMPTION]` | `artist` | FR-32 | 2 | UJ-2 |
| Admin — curation | `/dashboard/admin/oeuvres` (+ `/[slug]`) | `admin` | FR-25 | 1 | UJ-3 |
| Admin — invitations | `/dashboard/admin/artistes` | `admin` | FR-34 | 1 | UJ-2 |
| Admin — file des demandes | `/dashboard/admin/demandes` — URL à créer `[ASSUMPTION]` | `admin` | FR-25, FR-8, FR-9 | 1 | UJ-3, UJ-4 |
| Admin — commandes et alertes | `/dashboard/admin/commandes` — URL à créer `[ASSUMPTION]` | `admin` | FR-26, FR-28, FR-31, FR-32 | 2 | UJ-3 |
| Page de maintenance | servie par `src/middleware.ts` | public | FR-35 | 1 | — |

**Navigation publique** : en-tête `{components.site-header}` (« Menu », marque, « Panier (n) » dès le Lot 2) ; pied de page avec Conseil WhatsApp, pages de confiance et pages légales. **Espace artiste** : `{components.artist-tabbar}` (Accueil, Œuvres, Commandes, Paiements). **Administration** : spec légère, limitée à la curation, à la file des demandes et aux commandes/alertes nécessaires à UJ-3 ; les écrans admin existants non cités (utilisateurs) restent tels quels.

**Hors spec** : `/expositions` (laissée en l’état, non couverte) ; `/wishlist` hors périmètre (aucune entrée, aucune icône cœur) ; `/dashboard` (espace utilisateur générique) et `/auth/inscription` non retravaillés.

## Voix et ton (Voice and Tone)

Microcopie. L’attitude générale est dans DESIGN.md. Registre : **sobre, précis, chaleureux**, vouvoiement cordial `[ASSUMPTION du PRD §8]`. Phrases courtes et complètes, chiffres exacts, aucune exclamation commerciale.

| À écrire | À ne pas écrire |
|---|---|
| « Droits et taxes d’import éventuels non inclus » | « Livraison offerte* » avec astérisque |
| « Livrée sous 12 à 16 jours » | « Livraison rapide » |
| « Œuvres réservées pour vous jusqu’à 15 h 42. » | « Plus que 12:34 pour valider ! » |
| « Vendue entre-temps — retirée de votre commande. » | « Erreur : article indisponible » |
| « Pas besoin de créer un compte : vous suivrez vos commandes grâce au lien envoyé par e-mail. » | « Créez un compte pour continuer » |
| « Demande reçue. Nous vous répondons sous [délai]. » | « Merci !! On revient vers vous très vite » |
| « Il manque 2 éléments pour envoyer : » suivi de la liste | « Formulaire invalide » |
| (à Karim, cas FR-31) « Un acheteur avait réservé cette œuvre. L’équipe Errancy le prévient et s’occupe d’un éventuel remboursement. Vous n’avez rien à faire. » | « Attention : conflit de réservation » |
| « Retirée de la vente à 10 h 12. » | « Opération réussie ✓ » |
| « Réponse en moins de [délai] · [horaires] » ; hors horaires « Réponse demain à partir de [HH] h » | « Disponible 24 h/24 » |

**Interdits** : compte à rebours, « dernière chance », « plus que N », promotions, prix barrés ; « Garantie Errancy », toute durée de retour ou mention de gratuité tant qu’OQ-2 et OQ-4 ne sont pas tranchées (FR-5, FR-24) ; tout nom de prestataire de paiement (OQ-1) ; tutoiement ; jargon technique (« jeton », « session », « webhook ») ; « Oups ». Les coordonnées de l’artiste ne sont jamais montrées au visiteur (FR-8).

## Motifs de composants (Component Patterns)

Comportement. Rendu visuel : DESIGN.md, Components, sous les mêmes noms.

| Composant | Où | Règles de comportement |
|---|---|---|
| `{components.action-bar}` — barre d’actions fixe | Fiche œuvre, panier, coordonnées, confirmation, suivi (mobile) | Toujours visible pendant le défilement. Contenu selon la disponibilité (State Patterns). Lot 1 sur fiche : « Conseil WhatsApp » principal, « Réserver une visite » secondaire ; « Acheter » **absent** (pas un bouton grisé : le pointillé des maquettes n’est qu’une annotation). Lot 2 : « Acheter » devient l’action principale, « Conseil WhatsApp » passe en secondaire, « Réserver une visite » reste disponible. Panier et coordonnées : action principale « Continuer » avec le total et le nombre de commandes en sous-ligne. Ne recouvre jamais un champ actif : masquée quand le clavier est ouvert. |
| `{components.button-primary}` / `{components.button-secondary}` / `{components.button-disabled}` | Partout | Une seule action principale par écran. Un bouton indisponible n’est jamais muet : la raison est écrite juste au-dessus ou en dessous. Pendant un envoi, le libellé devient un verbe en cours (« Envoi… ») et le bouton ignore les doubles appuis. |
| `{components.whatsapp-button}` — Conseil WhatsApp | Fiche, page artiste, panier, suivi, pied de page (FR-7) ; accueil et galerie | Voir la section Conseil WhatsApp. |
| « Acheter » (Lot 2) | Fiche œuvre | Ajoute l’œuvre au panier **et y conduit directement**. Dans le panier, un lien « Continuer à parcourir » ramène à la galerie pour ajouter une œuvre d’un autre artiste. |
| `{components.tile-row}` — rangée trois cases | Fiche, sous la première photo | Taille : unité principale selon le choix cm/in, l’autre en dessous, orientation et format. Prix livré : prix total pour le pays affiché + lien « Modifier » (ouvre le choix du pays, recalcule les trois cases). Délai : délai total en fourchette de jours. Répète, en résumé, les sections dépliables : un chiffre identique aux deux endroits. |
| `{components.disclosure}` — section dépliable | Fiche (quatre questions) | Élément natif `details`/`summary`. À l’arrivée, seule « Ira-t-elle chez moi ? » est ouverte. Ordre fixe : Ira-t-elle chez moi ? · Combien au total ? · Quand la recevrai-je ? · Est-ce sérieux ?. L’état ouvert ne se mémorise pas d’une fiche à l’autre. |
| `{components.photo-carousel}` | Fiche | Première photo = mise en situation avec repère d’échelle (FR-2). Balayage au doigt, boutons précédent/suivant au clavier et à la souris. Jamais de défilement automatique. Toucher une photo l’ouvre en plein écran avec zoom. |
| `{components.availability-label}` | Fiche, vignettes | Reflète la disponibilité publique (« Disponible », « Réservée », « Vendue ») ; mise à jour en moins de 60 s après un changement (FR-21). |
| `{components.filter-chip}` — puce de filtre | Galerie | Chaque filtre actif est une puce ; « × » le retire et relance la liste. « Modifier les filtres » ouvre le panneau complet (FR-17 : prix total, format, orientation, couleur dominante, ambiance, technique, artiste, pays de l’artiste, disponibilité). Le nombre de résultats et le pays de calcul du prix sont rappelés (« 6 œuvres · prix livré France »). Les filtres vivent dans l’URL (lien partageable, retour arrière conservé). |
| `{components.unit-toggle}` | Galerie, fiche | Bascule cm/in pour tout le site, mémorisée sur l’appareil. Les deux unités restent visibles sur la fiche (FR-1), seule leur priorité change. |
| `{components.artwork-card}` | Accueil, galerie, page artiste, œuvres proches | Toute la carte est une seule cible vers la fiche. Affiche artiste, dimensions, prix livré et délai pour le pays choisi. |
| `{components.order-card}` — carte commande par artiste | Panier, paiement, confirmation, suivi | Une carte par artiste, numérotée. Sous-total = œuvres + livraison de cet artiste ; délai et ville d’expédition propres. Changer de pays recalcule toutes les cartes. |
| `{components.total-row}` | Panier, paiement | Total général = somme des sous-totaux, rappelé en clair (« 2 400 € + 680 € »), avec la mention des droits et taxes. Recalcul annoncé aux technologies d’assistance. |
| `{components.unavailable-line}` | Panier | Voir State Patterns, « œuvre devenue indisponible ». |
| `{components.info-banner}` — bandeau d’information | Panier (colis séparés), visite (accusé), espace artiste (confirmations, échéances) | Annonce un fait, sans bouton de fermeture obligatoire ; peut porter un seul lien d’action (« Annuler », « Ouvrir le guide »). Rôle `status`. |
| `{components.form-field}` — champ de formulaire | Coordonnées, visite, conseil, dépôt, accès artiste | Libellé visible, type et `autocomplete` adaptés (e-mail, tel, adresse). Validation à la sortie du champ et à l’envoi, jamais à chaque frappe. Les valeurs saisies ne sont jamais perdues après une erreur. |
| `{components.photo-slot}` | Dépôt d’œuvre | Une case par prise de vue attendue, avec sa légende (« Mise en situation avec repère d’échelle »). Ajout depuis l’appareil photo ou la galerie du téléphone ; « Remplacer » sur une case remplie. |
| `{components.neutral-zone}` — zone neutre hachurée | Paiement, moyen de versement, adresse masquée | Emplacement réservé à un contenu non décidé ou non autorisé ; nomme ce qui manque et pourquoi. Jamais interactif. |
| `{components.status-timeline}` — frise d’états | Suivi, commande artiste, admin | Étapes du glossaire ; date réelle pour une étape faite, date prévue pour la livraison. |
| `{components.confirm-sheet}` | Espace artiste (changement de disponibilité) | Monte du bas de l’écran ; « Confirmer » à droite, « Annuler » à gauche ; Échap ou toucher le voile ferme sans agir. Jamais deux feuilles empilées. |
| `{components.availability-picker}` | Mes œuvres | Sur la ligne d’une œuvre publiée ou réservée : Disponible · Vendue ailleurs · Retirer de la vente. Un choix ouvre `{components.confirm-sheet}`. |
| `{components.artist-tabbar}` | Espace artiste (mobile) | Quatre onglets fixes ; l’onglet courant porte `aria-current="page"`. |
| `{components.count-badge}` | Accueil artiste | Nombre de commandes à prendre en charge ; disparaît à zéro. |
| `{components.site-header}` | Public | « ‹ [écran précédent] » sur les écrans profonds ; « Panier (n) » compte les œuvres. |

## Motifs d’états (State Patterns)

### Disponibilité publique d’une œuvre (FR-6)

| Disponibilité | Libellé sur la fiche | Barre d’actions |
|---|---|---|
| `disponible` | « Disponible » | Lot 1 : Conseil WhatsApp (principal) + Réserver une visite. Lot 2 : Acheter (principal) + Conseil WhatsApp + Réserver une visite. |
| `réservée` | « Réservée » ; aucune heure de fin ni compte à rebours montré aux autres visiteurs `[ASSUMPTION]` | « Me prévenir » (FR-9 : champ e-mail, confirmation « Nous vous écrirons si elle redevient disponible. ») + Conseil WhatsApp |
| `vendue` | « Vendue » + œuvres proches du même artiste | Conseil WhatsApp ; lien vers la page de l’artiste |
| `vendue ailleurs` | « Vendue » (même traitement public, FR-6) | idem `vendue` |
| `retirée` | Fiche non publique ; l’URL redirige vers la page de l’artiste (NFR-2) | — |
| Pays non livré (FR-3) | Case Prix livré : « Pas de livraison vers [pays] » ; phrase « [Artiste] ne livre pas encore [pays]. » | « Acheter » remplacé par Conseil WhatsApp ; visite conservée |

### États d’une œuvre côté artiste

| État affiché | Correspond à | Ce que l’artiste peut faire |
|---|---|---|
| Brouillon | non soumise | Compléter, envoyer en curation, supprimer |
| En curation | soumise (FR-25) | Consulter ; délai de réponse annoncé (valeur à fixer, UXQ-8) |
| Publiée | `disponible` | Modifier la disponibilité : Vendue ailleurs, Retirer de la vente |
| Réservée | `réservée` (ligne : « Un acheteur est en train de payer ») | Vendue ailleurs ou Retirer reste possible (FR-21) ; voir UJ-2, cas limite |
| Vendue | `vendue` (numéro de commande affiché) | Ouvrir la commande |
| Vendue ailleurs | `vendue ailleurs` | « Annuler » (retour à Publiée) **tant qu’aucune réservation acheteur n’existe** sur l’œuvre ; si la déclaration a interrompu une réservation, pas d’annulation : passer par l’équipe |
| Retirée | `retirée` (date affichée) | Remettre en vente : retour en curation `[ASSUMPTION]` |

Une œuvre renvoyée par la curation avec un commentaire (FR-25) repasse en « Brouillon » avec le commentaire de l’équipe en `{components.info-banner}` `[ASSUMPTION]` (UXQ-3).

### États de commande (glossaire)

| État | Acheteur (suivi) | Artiste | Équipe |
|---|---|---|---|
| en attente de paiement | — (parcours de paiement) | invisible | visible |
| confirmée | « Confirmée [date] » | « À prendre en charge avant [heure fixe] » (48 h `[ASSUMPTION du PRD]`) | alerte « nouvelle commande » |
| prise en charge | « Prise en charge par l’artiste [date] » | adresse visible, saisie du suivi | alerte séparée si absente après 48 h |
| expédiée | « Expédiée [date] · n° de suivi » | « Expédiée » | alerte séparée si absente à la fin du délai de préparation |
| livrée | « Livrée [date] » + « Signaler un problème » | adresse de nouveau masquée (FR-22) | ouvre le délai de retour (OQ-4) |
| close | lien de suivi expiré | somme due exigible | — |
| annulée / retournée | libellé + état du remboursement (`demandé`, `effectué`) | libellé | motif obligatoire |

Sur l’écran de confirmation, chaque commande porte le libellé « Confirmée » (la maquette affiche « En préparation chez l’artiste », hors glossaire : la spec prime). Reversement (FR-32) : `à verser`, `versée`, `bloquée` ; l’affichage d’une somme pas encore exigible est la question UXQ-4. Demandes (FR-8) : `nouvelle`, `planifiée`, `faite`, `sans suite`.

### Réservation d’environ 30 minutes (FR-12, `[ASSUMPTION du PRD]`)

- Affichée en **heure fixe**, dans le fuseau de l’appareil : « Œuvres réservées pour vous jusqu’à 15 h 42. » (au singulier pour une seule œuvre). Pas de compte à rebours, pas de couleur, pas de rappel insistant.
- Réservation **en bloc** : si une œuvre du panier n’est plus disponible, aucune n’est réservée et l’acheteur le lit sur la ligne concernée.
- À l’échéance, la phrase devient « Votre réservation a pris fin à 15 h 42. » ; « Continuer » tente une nouvelle réservation.
- Le moment exact où elle commence (affichage du panier ou passage au paiement) est la question UXQ-2.

### Œuvre devenue indisponible dans le panier (FR-10)

La carte de l’artiste concerné devient `{components.unavailable-line}` : titre barré, « Vendue entre-temps — retirée de votre commande. », lien « Voir des œuvres proches de [artiste] » et trois vignettes. Les autres commandes restent intactes ; total, nombre de commandes, nombre de colis et heure de réservation sont recalculés et annoncés. Aucune alerte modale.

### Formulaire de dépôt bloquant (FR-20)

- Une seule page en cinq sections : 1. Photos · 2. Informations (titre, technique, année, histoire courte, ambiance) · 3. Dimensions et prix (hauteur, largeur en cm, conversion en pouces et orientation calculées et affichées, couleur dominante, prix de l’œuvre seule) · 4. Expédition par zone (frais, délai de préparation et délai de transport, ou « Je ne livre pas cette zone » ; accepte ou non les visites en atelier) · 5. Engagements (certificat signé, emballage conforme, reprise d’une œuvre retournée dans son emballage d’origine).
- En tête : progression « 3 sections sur 5 complètes » et liste des sections avec « Complet » / « À compléter ».
- Brouillon enregistré automatiquement ; indication « Brouillon enregistré » dans l’en-tête.
- « Envoyer en curation » reste `{components.button-disabled}` tant qu’un élément manque ; au-dessus, « Il manque N éléments pour envoyer : » suivi de liens qui mènent chacun au champ concerné et y placent le focus.
- La maquette omet l’ambiance, les visites en atelier et l’engagement de reprise : la spec les ajoute (FR-20). Les noms des zones (Maroc, Europe, Amérique du Nord) sont illustratifs (OQ-5).

### Vide, chargement, erreur

| Surface | Vide | Chargement | Erreur |
|---|---|---|---|
| Galerie | « Aucune œuvre ne correspond à ces filtres. » + retirer le dernier filtre + « Demander une sélection » (FR-8) | Vignettes squelettes `{colors.neutral-200}` aux proportions attendues | « La galerie ne s’est pas chargée. Réessayer » ; filtres conservés |
| Fiche | — | Rangée trois cases et titre avant les photos | Œuvre introuvable : page de l’artiste ou galerie |
| Panier | « Votre panier est vide. » + Parcourir la galerie | Montants masqués tant qu’ils ne sont pas recalculés côté serveur (FR-11) | « Nous n’avons pas pu recalculer vos montants. Réessayer » ; panier conservé |
| Coordonnées, visite, conseil | — | Bouton « Envoi… » | Message sous le champ fautif ; résumé en tête si plusieurs ; saisie conservée |
| Paiement | — | Dans `{components.neutral-zone}` | Contenu selon OQ-1 ; réservation rappelée avec son heure |
| Suivi | — | Frise squelette | Lien expiré après clôture : « Ce lien de suivi n’est plus actif : la commande est close. » + Conseil WhatsApp |
| Activation d’invitation | — | — | « Ce lien d’invitation a expiré. » + « Écrire à l’équipe » (durée : UXQ-8) |
| Mes œuvres / Commandes / Paiements | « Vous n’avez pas encore déposé d’œuvre. » + Déposer ; « Aucune commande pour l’instant. » ; « Aucune somme due pour l’instant. » | Lignes squelettes | Réessayer ; aucune action perdue |
| Admin (files) | « Aucune demande en attente. » / « Aucune alerte. » | Lignes squelettes | Réessayer |
| Maintenance (FR-35) | — | — | Après « Me notifier » : accusé à l’écran, consentement explicite |

## Primitives d’interaction (Interaction Primitives)

- **Toucher pour agir.** Aucune action accessible seulement au survol. Au survol sur ordinateur : soulignement des liens, rien de plus.
- **Défilement vertical** ; la barre d’actions et la navigation basse restent fixes.
- **Balayage** limité au carrousel de photos, toujours doublé de boutons.
- **Deux touches puis confirmation** pour un changement de disponibilité (choix → `{components.confirm-sheet}` → bandeau avec « Annuler » quand il est autorisé).
- **Galerie** : bouton « Afficher plus d’œuvres », pas de défilement infini `[ASSUMPTION]` (UXQ-11).
- **Retour arrière** du navigateur toujours fiable : filtres, pays et unités dans l’URL ou mémorisés ; panier persistant sur l’appareil.
- **Proscrits** : compte à rebours, fenêtre surgissante d’inscription, carrousel ou vidéo en lecture automatique, modales empilées, glisser-déposer obligatoire, icône favoris.
- **Mouvement** : `fade-in` à l’apparition des sections et `scale-in` pour la photo plein écran ; tout mouvement est coupé sous `prefers-reduced-motion`.

## Socle d’accessibilité (Accessibility Floor)

- **Cible : WCAG 2.1 AA** `[ASSUMPTION du PRD, NFR-3]`. Contrastes : DESIGN.md, Colors.
- **Clavier** : tout est atteignable et utilisable au clavier, dans l’ordre de lecture ; lien d’évitement vers le contenu ; focus visible (contour noir 2 px, décalage 2 px), jamais or ; Échap ferme la feuille de confirmation et rend le focus à l’élément d’origine.
- **Libellés** : chaque champ a un libellé visible relié ; erreurs reliées par `aria-describedby` ; boutons nommés par leur action (« Conseil WhatsApp sur Lumière sur la médina »).
- **Textes alternatifs** : chaque photo d’œuvre dit l’œuvre, l’artiste et la prise de vue (« Lumière sur la médina, Karim B., accrochée au-dessus d’un canapé à côté d’une personne de 1,70 m »). Proposé à partir des métadonnées du dépôt et vérifié en curation `[ASSUMPTION]`.
- **États** jamais portés par la couleur seule (libellé obligatoire) ; bandeaux et recalculs annoncés par `role="status"` / `aria-live="polite"`.
- **Cibles tactiles** d’au moins 44 × 44 px (`{spacing.touch-target}`).
- **Mouvement réduit** respecté ; aucun contenu clignotant.
- **Agrandissement** à 200 % sans perte ni défilement horizontal ; champs à 16 px.
- `lang="fr"` sur toutes les pages ; montants et heures écrits pour être lus correctement (« 15 h 42 », pas « 15:42 »).

## Parcours clés (Key Flows)

### UJ-1. Yasmine achète, depuis Montréal, un tableau pour son salon (Lot 2)

1. Yasmine ouvre une fiche œuvre depuis un partage Instagram, sur mobile, sans compte.
2. Première photo : l’œuvre accrochée près d’un fauteuil, qui donne l’échelle. Juste dessous, `{components.tile-row}` : dimensions en pouces et en cm, prix total livraison au Canada comprise (pays proposé d’office, modifiable), délai « 12 à 16 j », mention des droits et taxes.
3. Elle lit l’histoire courte dans « Est-ce sérieux ? ».
4. Elle hésite sur les couleurs et touche « Conseil WhatsApp » : le message s’ouvre, prérempli avec la référence et le lien de l’œuvre ; le délai annoncé est affiché sur le bouton.
5. Une conseillère répond dans le délai, avec une photo en lumière du jour.
6. **Moment clé** : elle revient sur la fiche, touche « Acheter » (l’œuvre entre au panier et elle y arrive), puis commande sans créer de compte (coordonnées → paiement → confirmation).
7. Elle reçoit la confirmation avec le délai, puis le numéro de suivi saisi par l’artiste ; à la livraison, « Signaler un problème » est sur sa page de suivi.

Échec : quelqu’un paie la même œuvre juste avant elle → la fiche affiche « Réservée » et propose « Me prévenir » (FR-9). En Lot 1, le parcours s’arrête à l’étape 5 et se poursuit par une vente assistée (OQ-12).

### UJ-2. Karim, peintre à Essaouira, met une œuvre en vente, puis la vend à l’atelier

→ [mockups/parcours-karim-espace-artiste.html](mockups/parcours-karim-espace-artiste.html)

1. Karim reçoit l’e-mail d’invitation et touche « Créer mon accès » ; l’e-mail est prérempli, il choisit un mot de passe et accepte la charte artiste.
2. L’accueil de son espace montre trois blocs dans l’ordre de l’urgence : À expédier, Mes œuvres, Ce qu’on vous doit.
3. Il dépose une œuvre : photos en lumière du jour, gros plan, mise en situation ; dimensions, couleur dominante ; frais et délais pour trois zones ; engagements. Il manque deux éléments : la liste les nomme et les liens l’y conduisent. Il complète et envoie en curation.
4. « Mes œuvres » confirme l’envoi ; l’œuvre est « En curation », puis « Publiée » après validation par l’équipe (e-mail).
5. Un mois plus tard, il vend « Lumière sur la médina » à l’atelier. Sur la ligne de l’œuvre : Disponibilité → « Vendue ailleurs » → « Confirmer ».
6. **Moment clé** : le bandeau « Retirée de la vente à 10 h 12. » apparaît avec « Annuler » ; en moins d’une minute, l’œuvre n’est plus achetable sur Errancy.
7. Une commande arrive (Thomas, France). Avant prise en charge, il voit l’œuvre, le prénom et le pays de l’acheteur et l’échéance en heure fixe ; l’adresse reste dans `{components.neutral-zone}`.
8. Il touche « Je prends en charge » : l’adresse apparaît avec le rappel du guide d’emballage ; il saisit transporteur et numéro de suivi puis « Marquer comme expédiée ». Thomas est prévenu.
9. Dans Paiements, « Ce qu’on vous doit » détaille chaque commande : prix de l’œuvre, commission Errancy (assiette OQ-3, le 30 % des maquettes est illustratif), montant dû, état du reversement ; le moyen de versement est une `{components.neutral-zone}` (OQ-1).

Échec (FR-31) : il déclare « Vendue ailleurs » une œuvre qu’un acheteur est en train de payer → la réservation est annulée, le bandeau dit « Un acheteur avait réservé cette œuvre. L’équipe Errancy le prévient et s’occupe d’un éventuel remboursement. Vous n’avez rien à faire. », sans lien « Annuler ». L’équipe est alertée et l’incident compté (SM-C1).

### UJ-3. Salma, de l’équipe Errancy, suit une commande jusqu’à sa clôture (admin léger)

1. Salma reçoit l’alerte « nouvelle commande » et l’ouvre dans Commandes et alertes.
2. Elle vérifie que l’artiste a pris en charge sous 48 h `[ASSUMPTION du PRD]` ; sinon une alerte dédiée apparaît.
3. Elle vérifie l’expédition avant la fin du délai de préparation déclaré (alerte distincte).
4. Le numéro de suivi apparaît, puis la livraison constatée.
5. **Moment clé** : à la fin du délai de retour sans réclamation, la commande passe en `close` et la somme due à l’artiste passe à `à verser`.

Autres tâches couvertes par les mêmes écrans : valider ou renvoyer une œuvre en curation avec un commentaire ; traiter la file des demandes (visites, sélections, « Me prévenir ») ; poser une réservation de vente assistée (FR-12) ; déclencher un remboursement avec motif (FR-31). Pas de spec détaillée au-delà.

### UJ-4. Thomas, à Lyon, demande une visite avant de se décider (prolongé : panier multi-artistes)

→ [mockups/parcours-thomas-achat.html](mockups/parcours-thomas-achat.html) et [mockups/fiche-oeuvre.html](mockups/fiche-oeuvre.html)

1. Thomas arrive sur l’accueil : sélection curatoriale, « Parcourir la galerie ».
2. En galerie, il pose ses filtres pour son mur : grand format, paysage, prix total ≤ 3 000 €, France. Chaque vignette donne le prix livré et le délai.
3. Il ouvre « Les remparts au crépuscule » (Nadia R., 2 400 € livrée). Grand format cher : il touche « Réserver une visite ».
4. Il propose deux ou trois créneaux pour une visite à distance et laisse ses coordonnées ; accusé « Demande reçue. Nous vous répondons sous [délai]. »
5. Hors écran : l’équipe confirme le créneau, la visite a lieu, l’équipe réserve l’œuvre pour lui 48 h `[ASSUMPTION du PRD]` et lui envoie le lien pour commander.
6. Le lien met l’œuvre dans son panier. Il touche « Continuer à parcourir » et ouvre « Bleu de Chefchaouen » (Karim B., autre artiste, autre ville, autre délai), puis « Acheter ».
7. **Moment clé** : le panier montre deux `{components.order-card}`, un bandeau « 2 colis séparés, 2 délais : 8 à 12 j et 12 à 16 j », le total général 3 080 € et la réservation en heure fixe. Il comprend sans effort qu’il recevra deux colis, de deux villes, à deux dates.
8. « Continuer » : coordonnées sans compte (e-mail, nom, adresse, téléphone) ; changer de pays recalcule les deux commandes.
9. Paiement en zone neutre : récapitulatif par commande et total (voir Paiement et versement).
10. Confirmation : « Merci, Thomas », deux commandes numérotées, chacune « Confirmée » avec son artiste et son délai ; « Suivre mes commandes ».
11. Quelques jours plus tard, le lien de suivi ouvre une frise d’états par commande, avec « Signaler un problème » et Conseil WhatsApp.

Échec : « Bleu de Chefchaouen » est vendue entre-temps → `{components.unavailable-line}`, total ramené à 2 400 €, une commande, un colis.

## Inspiration et anti-modèles (Inspiration & Anti-patterns)

- **Repris de Saatchi Art** : prix livraison incluse et délai affichés sur la fiche ; retour vers l’artiste dans l’emballage d’origine (pour FR-30, contenu selon OQ-4).
- **Repris de Singulart** : certificat signé par l’artiste et sélection par un comité, ici « Sélectionnée par Errancy ».
- **Repris de Rise Art et Artfinder** : filtres par orientation, couleur, unités cm/in, localisation de l’artiste.
- **Repris de Massinart** : la clarté des formats et des prix, sans le registre de boutique de décoration.
- **Réponse aux plaintes relevées chez les concurrents** : couleurs différentes de l’écran → photo en lumière du jour et gros plan obligatoires ; délais inexacts → délai total calculé depuis les déclarations de l’artiste ; communication lente → délai de réponse annoncé.
- **Écarté pour le MVP** : visualisation « dans votre pièce » et simulateur mural (Saatchi Art, Artsy), suivre un artiste et favoris (Artsy), certificat traçable par QR (Artmajeur).
- **Anti-références** : boutique de décoration à promotions, compte à rebours, fausse rareté (« 3 personnes regardent cette œuvre »), prix barrés, vert « WhatsApp » criard. Aucune référence externe à imiter.

## Responsive et plateformes (Responsive & Platform)

| Largeur | Comportement |
|---|---|
| < `md` (mobile, référence 375 px) | Une colonne ; barre d’actions fixe en bas ; galerie en deux colonnes de vignettes ; navigation basse dans l’espace artiste. |
| `md` à `lg` | Galerie en trois colonnes ; fiche toujours en une colonne avec barre fixe. |
| ≥ `lg` | Fiche en deux colonnes : photos à gauche, informations à droite, les actions forment un bloc collant en haut de la colonne d’informations au lieu de la barre fixe `[ASSUMPTION]` ; panier : commandes à gauche, total et « Continuer » à droite `[ASSUMPTION]` ; galerie en quatre colonnes ; espace artiste et admin avec navigation latérale au lieu de la navigation basse `[ASSUMPTION]`. |

Sur ordinateur, le Conseil WhatsApp ouvre WhatsApp Web ou affiche un QR code (FR-7). Navigateurs mobiles récents (Safari iOS, Chrome Android) prioritaires.

## International : préparation (OQ-6)

- Pays de livraison **proposé d’office et modifiable** (FR-3, OQ-13) ; il pilote le prix livré, le délai, les filtres de prix et le panier.
- Bascule **cm / in** sur tout le site (FR-17), les deux unités toujours visibles sur la fiche.
- **Euros seulement** ; aucun sélecteur de langue ni de devise tant qu’OQ-6 est ouverte.
- Textes d’interface **externalisables** (aucune chaîne en dur dans les composants), formats de date, d’heure et de nombre pris de la locale `fr`.
- Propriétés CSS logiques (DESIGN.md) : pas de RTL au lancement, mais rien qui l’empêche.

## Conseil WhatsApp

- **Emplacements** (FR-7) : fiches œuvres (action principale en Lot 1), pages artistes, panier, page de suivi, pied de page ; également accueil, galerie et confirmation dans les maquettes.
- **Message prérempli** depuis une fiche : référence (slug) et lien de l’œuvre ; depuis le panier ou le suivi : numéro de commande.
- **Délai affiché** sous le libellé (« Réponse en moins de [délai] · [horaires] »). **Hors horaires** : « Réponse demain à partir de [HH] h ». Les valeurs réelles (numéro, horaires, délai) attendent OQ-7 ; « 2 h · 9 h–19 h » des maquettes est fictif.
- **Ordinateur** : WhatsApp Web, ou QR code si l’ouverture échoue.
- **Repli tant qu’OQ-7 est ouverte** : même emplacement, même libellé de délai, mais le bouton ouvre le formulaire de demande de conseil (FR-8) ; accusé par e-mail avec le délai.
- Chaque appui déclenche l’événement de mesure (FR-27), sous réserve du consentement.

## Paiement et versement : zone neutre (OQ-1)

**Figé** : une commande par artiste (FR-10) ; récapitulatif par commande avec prix de l’œuvre, livraison, prix total, délai total, artiste, rappel des garanties et conditions de retour (FR-11) ; total général ; montants relus côté serveur ; réservation rappelée en heure fixe ; lien « Une question ? Écrire sur WhatsApp ».

**Ouvert, non tranché ici** : un seul paiement pour tout le panier ou un paiement par commande enchaîné dans le même parcours (OQ-16) ; prestataire et entité qui encaisse (OQ-1) ; devise d’encaissement (OQ-1, OQ-6) ; moyen de rembourser (FR-31) ; moyen de versement à l’artiste (FR-32) ; assiette de la commission (OQ-3). L’écran de paiement et le bloc « Moyen de versement » restent des `{components.neutral-zone}` qui nomment l’alternative sans la choisir.

## E-mails transactionnels

Contenu et déclencheurs seulement ; pas de gabarit visuel détaillé `[ASSUMPTION]`. Tous contiennent un lien Conseil WhatsApp (ou le repli FR-8).

| E-mail | Déclencheur | Destinataire | Contenu |
|---|---|---|---|
| Accusé de demande | Demande de visite ou de sélection envoyée (FR-8) | Visiteur | Rappel de la demande, délai de réponse |
| « Me prévenir » | Inscription ; puis réservation expirée (FR-9) | Visiteur | Confirmation d’inscription ; puis « [œuvre] est de nouveau disponible » avec le délai de priorité |
| Confirmation de commande | Commande `confirmée` (FR-13) | Acheteur | Récapitulatif FR-11 par commande, délai, lien de suivi |
| Prise en charge | Commande `prise en charge` (FR-22) | Acheteur | L’artiste prépare l’œuvre, délai rappelé |
| Expédition | Numéro de suivi saisi (FR-22) | Acheteur | Transporteur, numéro, lien de suivi |
| Livraison | Commande `livrée` (FR-29) | Acheteur | Confirmation, « Signaler un problème », délai de retour selon OQ-4 |
| Réservation annulée / remboursement | Vendue ailleurs pendant réservation (FR-21), remboursement `demandé` puis `effectué` (FR-31) | Acheteur | Fait, excuses sobres, état du remboursement |
| Invitation | Invitation par l’équipe (FR-34) | Artiste | Lien personnel « Créer mon accès », durée de validité (UXQ-8) |
| Nouvelle commande | Commande `confirmée` (FR-22) | Artiste | Œuvre, pays, échéance de prise en charge en heure fixe |
| Résultat de curation | Validée ou renvoyée (FR-25) | Artiste | Publication, ou commentaire de l’équipe |
| Alerte nouvelle commande | Commande `confirmée` (UJ-3) | Équipe | Lien vers la commande |
| Ouverture du site | Levée de la maintenance par le porteur (FR-35) | Contacts « Me notifier » | Annonce, lien vers l’accueil |

## Questions ouvertes

**Du PRD, avec effet sur l’UX** (non tranchées ici) :

- **OQ-1** montage de paiement : contenu de l’écran de paiement, moyen de rembourser et de verser, identité de l’exploitant dans les pages légales.
- **OQ-16** un paiement pour le panier ou un par commande.
- **OQ-2 / OQ-4** garanties et politique de retour : contenu de « Est-ce sérieux ? », des pages de confiance et du récapitulatif ; aucune durée ni gratuité affichée d’ici là.
- **OQ-3** assiette de la commission : calcul affiché dans « Ce qu’on vous doit ».
- **OQ-5** zones de livraison : noms des zones du formulaire de dépôt, contenu de la page Livraison.
- **OQ-6** langues et devises ; **OQ-13** pays déduit ou choisi à la première visite.
- **OQ-7** numéro, horaires et délai WhatsApp ; en attendant, repli FR-8.
- **OQ-8** qui mène la visite (conseiller ou artiste) et délai de confirmation : la maquette affiche « Un membre de l’équipe », « Environ 20 minutes, gratuit », « sous 24 h », « Heure de Paris » et une visio WhatsApp, tous non décidés.
- **OQ-12** ouverture avant le Lot 2 avec ventes assistées (active « réservée » plus tôt).
- **OQ-14** part rédigée par l’artiste sur sa page.

**Nouvelles, propres à l’UX** :

- ~~**UXQ-1**~~ Tranchée le 2026-10-27 : en Lot 2, « Acheter » est l’action principale et Conseil WhatsApp passe en secondaire (la maquette Thomas, qui garde WhatsApp en principal, est dépassée sur ce point).
- **UXQ-2** Début de la réservation d’environ 30 min : dès l’affichage du panier (maquette) ou au passage au paiement (lettre de FR-12) ? Et comment afficher ensemble une réservation de vente assistée de 48 h et une réservation de paiement (la maquette donne la même heure pour les deux œuvres) ?
- **UXQ-3** Œuvre renvoyée par la curation : retour en Brouillon avec commentaire (hypothèse retenue) ou huitième état « À revoir » ?
- **UXQ-4** Somme due pas encore exigible : la maquette affiche « En attente de livraison » et « À reverser », hors du vocabulaire FR-32 (`à verser`, `versée`, `bloquée`).
- **UXQ-5** Voile derrière `{components.confirm-sheet}` : couleur et opacité sans jeton.
- **UXQ-6** Absence de tout jeton d’état (erreur, succès) : suffisant, ou un besoin apparaîtra-t-il (pages légales, erreurs de paiement du prestataire) ?
- **UXQ-7** Seuils petit / moyen / grand (FR-1), à fixer par l’équipe.
- **UXQ-8** Durée de validité de l’invitation (maquette : 7 jours « à fixer ») et délai de réponse de la curation (« X jours »).
- **UXQ-9** Où proposer la création de compte après coup (FR-10) : confirmation, e-mail, ou nulle part au MVP ?
- **UXQ-10** Fuseau des heures affichées (réservation, créneaux de visite) : celui de l’appareil (hypothèse retenue) ou celui de Paris (maquette) ?
- **UXQ-11** Galerie : « Afficher plus » (hypothèse retenue) ou pagination numérotée ?
- **UXQ-12** `{colors.white}` (palette Tailwind par défaut) comme surface posée : à confirmer comme jeton de la charte.

---

En cas de conflit, **les spines (DESIGN.md et EXPERIENCE.md) priment sur les maquettes** : [mockups/fiche-oeuvre.html](mockups/fiche-oeuvre.html) (fiche œuvre Lot 1, haut de page et page dépliée), [mockups/parcours-thomas-achat.html](mockups/parcours-thomas-achat.html) (UJ-4, Lot 2, onze écrans et variante 7b), [mockups/parcours-karim-espace-artiste.html](mockups/parcours-karim-espace-artiste.html) (UJ-2 prolongé). Historique des variantes A/B/C de la fiche : [.working/fiche-oeuvre-variantes-2026-10-27.html](.working/fiche-oeuvre-variantes-2026-10-27.html).
