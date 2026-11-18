# Epic 7 Context: L'acheteur commande sans compte, auprès de plusieurs artistes, et suit ses commandes

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

L'acheteur ajoute des œuvres de plusieurs artistes à un panier public, voit une commande par artiste aux montants recalculés côté serveur, donne ses coordonnées sans créer de compte, paie, reçoit sa confirmation et suit ses commandes par un lien envoyé par e-mail. Les pages légales et de confiance sont publiées. « Acheter » (Lot 2) s'ouvre quand le porteur le décide, et l'ancien modèle de commande `Order` est retiré une fois le nouveau vérifié. L'encaissement intégré dépend de la décision du porteur sur le montage de paiement (OQ-1, ouverte).

## Stories

- Story 7.1: Pages légales et de confiance
- Story 7.2: Panier sans compte, une commande par artiste
- Story 7.3: Coordonnées sans compte et réservation affichée en heure fixe
- Story 7.4: Récapitulatif et paiement dans une zone neutre
- Story 7.5: Encaissement intégré par le prestataire retenu (bloqué par OQ-1)
- Story 7.6: Confirmation de commande
- Story 7.7: Suivi des commandes par lien, sans compte
- Story 7.8: Ouverture de « Acheter »
- Story 7.9: Retrait de l'ancien modèle de commande

## Requirements & Constraints

- Le tunnel (panier, coordonnées, paiement, confirmation, suivi) ne demande jamais de compte ; un compte pourra être rattaché plus tard (UXQ-9) sans toucher aux commandes.
- Montants, frais, délais et totaux sont toujours recalculés côté serveur ; le navigateur ne fournit que des slugs. Le serveur ne débite jamais un montant différent du total recalculé. Tout prix total porte la mention des droits et taxes d'import éventuels non inclus.
- Une commande par artiste (colis, délais et villes d'expédition séparés), avec rappel du total général en clair.
- Un paiement couvre de 1 à N commandes ; le réglage OQ-16 (un paiement pour tout le passage, ou un par commande enchaîné) reste ouvert et relève du module de paiement.
- Tant qu'OQ-1 est ouverte : zone de paiement neutre, sans formulaire, logo ni nom de prestataire ; l'acheteur finalise avec l'équipe (constat manuel). Identité de l'exploitant dans une zone neutre.
- Tant qu'OQ-2 et OQ-4 sont ouvertes : aucune durée de retour, gratuité ni « Garantie Errancy ». Les CGV présentent l'artiste comme vendeur et Errancy comme intermédiaire. Contenu légal fourni ou validé par le porteur.
- Réservation affichée en heure fixe dans le fuseau de l'appareil, sans compte à rebours ni couleur ; à l'échéance, « Continuer » retente la réservation.
- Fiabilité de la vente (NFR-4) : aucune double vente ; les tests correspondants sont une condition d'ouverture du Lot 2.
- L'ouverture du Lot 2 reste un geste du porteur (variable Vercel), jamais du code.

## Technical Decisions

- Interrupteur du Lot 2 (AD-17) : variable `LOT2_OUVERT` lue seulement par `lot2Ouvert()` de `reglages`. Fermé, le serveur refuse tout passage en caisse public, y compris l'ancien `/api/checkout`. Les ventes assistées n'en dépendent pas.
- Panier (AD-13) : store Zustand persistant limité aux slugs ; anciennes données de prix ignorées ; `/panier` sort des routes protégées (middleware).
- Le passage en caisse est créé en base au début de la réservation (« Continuer ») et porte les coordonnées (e-mail, nom, adresse, téléphone), jamais dans `User`. Il s'appuie sur `creerPassageEnCaisse` (6.1) et `reserverOeuvres` (6.2) ; une réservation déjà détenue (vente assistée, priorité « Me prévenir ») est reprise. Plafonds de réservation par e-mail et par appareil déjà définis en 6.2.
- Paiement (AD-4, AD-8) : port `Encaissement` ; tout constat, manuel ou notification de prestataire, passe par `commandes.traiterPaiementConstate`, point d'entrée unique, synchrone et idempotent. Une notification est vérifiée par signature, et ses identifiants externes sont rattachés à un seul Paiement. Le nom d'un prestataire n'apparaît que dans son adaptateur `src/lib/paiement/adaptateurs/<nom>/`. Si Stripe est retenu, `/api/checkout` et le webhook actuels sont réécrits en adaptateur `stripe-checkout` et sortent des exceptions d'AD-1. Remboursement et reversement : stories séparées.
- Jetons (AD-14) : seul `acces` crée et vérifie les jetons (256 bits, empreinte SHA-256 stockée, usage, cible, échéance). Nouvel usage `suivi` : `/suivi/[jeton]` échange le jeton contre un cookie `httpOnly`, redirige sans jeton, `Referrer-Policy: no-referrer`, hors mesure. Le lien est émis à l'envoi de chaque e-mail de commande. Le lien `commande_assistee` (6.3) alimente le panier avec ses réservations.
- Prix livré : calculé uniquement par le module `livraison` ; aucun composant n'additionne prix et frais. Le pays vient du cookie `pays`.
- Textes dans le dictionnaire `fr` (règle ESLint sur les textes visibles) ; formats par `i18n/formats` ; nouvelles URL : `/cgv`, `/mentions-legales`, `/confidentialite`, `/cookies`, `/livraison`, `/retours`, `/authenticite`, `/commande/coordonnees`, `/commande/paiement`, `/confirmation`, `/suivi/[jeton]`.
- Retrait de `Order` (AD-20, temps 4) : migration de suppression après vérification en production, sauvegarde restaurable contrôlée avant, répétition sur une branche Neon consignée ; mise à jour d'AGENTS.md. Toute migration est commitée et appliquée en production par le porteur seulement.
- Accès à la base réservé aux modules métier ; les pages passent par `commandes`, `livraison`, `disponibilite`, `acces`.

## UX & Interaction Patterns

- Composants : `order-card` numérotée par artiste et `total-row` (« 2 400 € + 680 € »), bandeau « N colis séparés, N délais », `unavailable-line` (titre barré, « Vendue entre-temps — retirée de votre commande. », trois œuvres proches, sans modale), `neutral-zone` (hachures, jamais interactive), `status-timeline` (dates réelles des étapes faites, date prévue de livraison).
- Changement de pays depuis le panier ou les coordonnées : recalcul de toutes les cartes et du total, annoncé aux technologies d'assistance (`aria-live`).
- Formulaires : libellé visible, `autocomplete` adapté, validation à la sortie du champ et à l'envoi, saisie conservée après erreur (mêmes habitudes que `/conseil`).
- Barre fixe du panier : « Continuer » avec le total et le nombre de commandes en sous-ligne ; « Continuer à parcourir » et Conseil WhatsApp proposés. En-tête « Panier (n) » seulement Lot 2 ouvert.
- Textes d'état : « Votre panier est vide. » ; « Nous n'avons pas pu recalculer vos montants. Réessayer » ; confirmation « Merci, [prénom] » sans « Confirmée » à tort tant que le constat manque ; lien de suivi clos : « Ce lien de suivi n'est plus actif : la commande est close. » ; jeton inconnu = même page.
- Pas de proposition de créer un compte sur la confirmation.

## Cross-Story Dependencies

- Dépend de l'Epic 6 : passage en caisse et commandes (6.1), réservation en bloc (6.2), lien `commande_assistee` (6.3), constat de paiement et confirmation (6.4), annulation et remboursement (6.5), priorité « Me prévenir » (6.7).
- 7.3 s'appuie sur 7.2 (panier) ; 7.4 sur 7.3 ; 7.6 et 7.7 sur le constat de paiement (6.4) ; 7.5 est bloquée par OQ-1 et réutilise le point d'entrée du constat manuel.
- 7.1 est requise avant l'ouverture : « Est-ce sérieux ? » (fiche, 3.6), le pied de page et le récapitulatif (7.4) renvoient aux pages de confiance ; la page Cookies reprend le choix de mesure de la 4.8.
- 7.7 enrichit les e-mails de commande de l'Epic 6 d'un lien de suivi ; « Signaler un problème » viendra avec l'Epic 8.
- 7.8 exige : tests NFR-4 verts, pages légales publiées, moyen d'encaissement décidé (OQ-1) ou constat manuel assumé, assiette de commission (OQ-3), zones (OQ-5), durée de conservation (AQ-6).
- 7.9 exige les stories 6.1 et 7.2 à 7.7 en production depuis la période de vérification convenue.
