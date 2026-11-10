# Décisions du porteur du projet — Errancy.art

> À remplir par le porteur du projet. Ces réponses sont lues par les agents BMAD (PRD,
> architecture, UX) : sans elles, le cadrage reste flou. Répondez simplement ; « je ne sais pas
> encore » est une réponse valable, elle deviendra une question ouverte.
> Remplacez chaque `…` par votre réponse et datez la décision.

## 1. Marché et entité vendeuse (bloquant pour le paiement et la logistique)

- **Marché principal** (Maroc, France, international, diaspora…) : **international et diaspora** (2026-10-23)
- **Marchés secondaires** : …
- **Langue(s) du site** (ordre de priorité) : …
- **Devise(s) affichée(s)** : …
- **Entité juridique qui vend** (pays, forme) : **l'artiste vend, via le site** — modèle de place de marché : Errancy est l'intermédiaire, l'artiste est le vendeur (2026-10-23)
- **Entité qui exploite le site et perçoit la commission** (pays, forme) : Errancy perçoit la commission — pays et forme juridique encore à préciser
- **Pays de résidence des artistes** : **tous pays** (2026-10-24)
- **Stripe est-il utilisable par cette entité ?** (oui / non / à vérifier) : non pour une société marocaine. Recommandation de l'étude (2026-10-24) : société d'exploitation au Royaume-Uni (ou aux États-Unis) + versements par paliers ; **avis juridique marocain requis avant décision**. Voir `_bmad-output/planning-artifacts/research/technical-paiement-place-de-marche-art-exploitant-2026-10-24/research.md`
- **Zones de livraison** et qui paie la livraison : **l'artiste expédie l'œuvre** (2026-10-24) ; **zones de départ : Maroc, Union européenne, Europe hors UE, Amérique du Nord, Reste du monde** (2026-10-31, OQ-5, composition seule) ; prise en charge des frais, douane, seuil d'assurance et casse : … (avant le Lot 2)

## 2. Lieu physique

- **Showroom ou espace d'exposition** (oui / non / ponctuel) : …
- Si oui, adresse ou ville, horaires, visites sur rendez-vous : …

## 3. Contact et accompagnement

- **Numéro WhatsApp Business** à afficher : …
- **Qui répond** et dans quel délai : …
- **Rendez-vous** proposés (showroom, visio, domicile) : …

## 4. Mesure de départ (baseline)

- **Trafic mensuel actuel** (visiteurs, source) ou « aucune donnée » : …
- **Ventes réalisées** à ce jour (nombre, panier moyen, canal) : …
- **Outil de mesure souhaité** (PostHog ou GA4, un seul) : **PostHog, hébergement UE** (2026-10-27)

## 5. Catalogue

- **Nombre d'œuvres** prévues au lancement : …
- **Nombre d'artistes** : …
- **Fourchette de prix** (min – max) : …
- **Les œuvres actuellement en base sont-elles réelles ?** (oui / démonstration à remplacer) : **démonstration, à remplacer** (2026-10-23)
- **Photos** : disponibles en haute définition ? mises en situation ? qui les produit ? : …

## 6. Droits et accords artistes

- **Accords écrits avec les artistes** (oui / en cours / non) : …
- **Commission ou modèle de rémunération** : **30 % pour Errancy** (2026-10-24) ; assiette (prix de l'œuvre seul ou avec livraison) : …
- **Droits sur les images** (site, réseaux, reproductions) : …
- **Éditions limitées autorisées** par certains artistes ? : …

## 7. Ambition et contraintes

- **Date de lancement visée** : …
- **Budget mensuel** (hébergement, outils, publicité) : …
- **Ressources** : qui tient les rôles porteur / technique / contenus ? : …
- **Galeries de référence** (en plus de Massinart) : …
- **Ce que vous ne voulez surtout pas** : …

## Journal des décisions

| Date | Décision | Raison |
|---|---|---|
| 2026-10-23 | Marché principal : international et diaspora | Choix du porteur |
| 2026-10-23 | L'artiste est le vendeur ; Errancy est la plateforme intermédiaire (place de marché) | Choix du porteur |
| 2026-10-23 | Les œuvres en base sont des données de démonstration, à remplacer avant lancement | Constat du porteur |
| 2026-10-24 | Les artistes peuvent résider dans tous les pays | Choix du porteur |
| 2026-10-24 | Commission Errancy : 30 % | Choix du porteur |
| 2026-10-24 | L'artiste expédie lui-même l'œuvre vendue | Choix du porteur |
| 2026-10-27 | Outil de mesure : PostHog, hébergement UE (OQ-9) | Choix du porteur en architecture (AD-19) |
| 2026-10-27 | Next.js : passage immédiat à 14.2.35, puis montée vers 16.x dans un epic dédié | Choix du porteur en architecture (Stack) |
| 2026-10-27 | Tests et CI : Vitest sur un vrai PostgreSQL, GitHub Actions (lint, build, tests) à chaque PR | Choix du porteur en architecture (AD-23) |
| 2026-10-27 | Node.js 24 LTS, `engines.node` `24.x` (plage bornée, remplace « au minimum 22.12 ») | Node 20 en fin de vie et déprécié par Vercel ; plage bornée car Vercel applique `engines` en priorité sur le réglage du projet ; validé par le porteur (story 1.1, PR #7) |
| 2026-10-29 | Neon : plan gratuit conservé. Avant chaque migration de données, branche de sauvegarde datée, puis répétition d'abord sur la branche `preview` ; le porteur applique le SQL depuis l'éditeur SQL de Neon (AQ-4) | Choix du porteur avant la story 2.1 (première migration de données) ; procédure dans `docs/migrations.md` |
| 2026-10-30 | Œuvre retirée : redirection permanente en 308 (`permanentRedirect` de Next.js) au lieu du 301 prévu par FR-6 / NFR-2 | Même effet permanent pour les moteurs de recherche ; une 301 stricte demanderait un mécanisme à part ; validé par le porteur (story 2.2, PR #21) |
| 2026-10-31 | Zones de livraison de départ (OQ-5, composition seule) : Maroc, Union européenne, Europe hors UE (Royaume-Uni, Suisse, Norvège…), Amérique du Nord (États-Unis, Canada), Reste du monde explicite. Données modifiables par l'équipe dans l'administration (AD-12), pas du code ; le porteur expédie ses propres tableaux depuis le Maroc | Zones regroupant frais, délais et régime douanier comparables ; « Reste du monde » explicite pour qu'un artiste puisse y livrer ou cocher « je ne livre pas ». Payeur de la livraison, douane, seuil d'assurance et casse restent ouverts jusqu'au Lot 2 (choix du porteur, story 2.3) |
| 2026-11-02 | Invitation artiste (story 2.4) : lien valable 7 jours ; « Écrire à l'équipe » mène à `contact@errancy.art` ; charte artiste provisoire rédigée par l'agent, relue par le porteur ; la fiche artiste du porteur est créée par un SQL fourni, et le porteur s'invite avec une seconde adresse (un compte n'a qu'un rôle) | Choix du porteur (story 2.4, UXQ-8) |
| 2026-11-02 | Pendant la maintenance, les comptes artistes accèdent à leur seul espace privé (`/dashboard/artiste`) pour déposer leurs œuvres avant l'ouverture ; le site public reste en maintenance pour eux | Choix du porteur (revue de la story 2.4) ; règle `passeLaMaintenance` de `src/lib/reglages` |
| 2026-11-02 | Charte artiste provisoire (version `2026-11-02-provisoire`, 7 articles) validée telle quelle ; une relecture juridique pourra la compléter avant qu'elle ne devienne définitive | Relecture du porteur (story 2.4) |
| 2026-11-04 | Les œuvres et artistes de démonstration déjà en base y restent, masqués du site public par la règle « accord signé requis », sans aucune modification des données ni migration ; leur suppression éventuelle viendra plus tard (story 2.10 ou à part) | Choix du porteur (story 2.9) |
| 2026-11-04 | Suppression des anciennes colonnes `Artwork.available`, `price`, `dimensions` (story 2.10) : période de vérification jugée suffisante (2.1 en production depuis le 2026-10-29, 2.2 depuis le 2026-10-30) ; dimensions illisibles d'œuvres réelles complétées à la main avant la suppression, perte acceptée pour la démonstration ; contraintes `CHECK` et suppression des données de démonstration dans des stories à part | Choix du porteur (spec de la story 2.10) |
| 2026-11-04 | Migration A de la story 2.10 : valeur par défaut `''` sur `Artwork.dimensions` (au lieu de la rendre facultative), pour que le code précédent fonctionne encore sur les œuvres créées par le nouveau code jusqu'à la migration B | Choix du porteur (relecture de la story 2.10) |
| 2026-11-05 | Accessibilité (story 3.1) : socle global, composants partagés et pages non refaites corrigés tout de suite ; accueil, galerie, fiche œuvre et pages artistes corrigés au fil de leur refonte (stories 3.5 à 3.11), via une liste d'exceptions du test qui ne fait que diminuer | Choix du porteur (spec de la story 3.1) |
| 2026-11-05 | Textes de livraison (story 3.3) : « Pas de livraison vers ce pays (Canada) » et « Prix et délais recalculés : Canada », pour éviter l'article manquant devant le nom du pays | Choix du porteur (relecture de la story 3.3) |
| 2026-11-06 | Journal d'événements (story 3.4) : le cache des pages publiques est effacé juste avant de répondre à l'artiste ou à l'équipe (et non après la réponse, perdu avec Next.js 14) ; les modifications sans événement (prix, titre, photos, accord ou activité d'un artiste) apparaissent au plus 60 s plus tard | Choix du porteur (relecture de la story 3.4) ; passage après la réponse avec la montée de Next.js (story 5.3) |
| 2026-11-07 | Format des œuvres (story 3.5, UXQ-7) : selon le plus grand côté, petit < 40 cm, moyen de 40 à 100 cm, grand > 100 cm ; seuils en constantes de `src/lib/reglages`, modifiables par une PR (pas d'écran d'administration : écart assumé avec « sans changement de code » du critère de l'epic) | Choix du porteur (spec de la story 3.5) |
| 2026-11-07 | Fiche œuvre (story 3.6) : les onglets Œuvre / Artiste / Provenance sont remplacés par les quatre sections dépliables ; « Sélectionnée par Errancy » s'affiche pour toute œuvre visible ; la mention du certificat signé seulement si l'artiste s'y est engagé à son dépôt ; aucune durée ni gratuité de retour (OQ-2, OQ-4) | Choix du porteur (spec de la story 3.6) |
| 2026-11-07 | Fiche d'une œuvre vendue (story 3.7) : aucun prix affiché (ni prix de vente, ni prix barré) ; adresse d'œuvre inconnue, ou retirée dont l'artiste n'a pas de page publique : page introuvable 404 et non redirection vers la galerie (écart assumé avec l'epic) ; œuvre retirée d'un artiste public : redirection permanente vers sa page (308, inchangé) | Choix du porteur (spec de la story 3.7) |
| 2026-11-09 | Référencement (story 3.8) : l'adresse d'une œuvre déjà validée par l'équipe est figée (elle ne suit plus son titre), au lieu d'une table d'anciennes adresses avec redirection 301 : aucune adresse ne change, aucune migration ; le sitemap ne liste rien tant que la maintenance est active ; `public/robots.txt` (ligne `Sitemap:`) et `MAINTENANCE_MODE` restent des actes du porteur au lancement | Choix du porteur (spec de la story 3.8) |
| 2026-11-09 | Galerie filtrée (story 3.9) : le texte d'introduction de la galerie ne promet plus de certificat d'origine, de livraison assurée ni d'installation à domicile (politiques non décidées) ; haut de page limité à « La collection » et à la ligne « N œuvres · prix livré [pays] » | Choix du porteur (spec de la story 3.9) |
| 2026-11-10 | Pages artistes (story 3.11) : l'équipe renseigne portrait, biographie, démarche, formation, expositions et photo d'atelier depuis l'administration (pages gérées par l'équipe, OQ-14) ; les photos s'envoient par un bouton (Cloudinary signé), pas par collage d'adresse ; trois colonnes facultatives ajoutées à `Artist` (migration d'ajout appliquée par le porteur) | Choix du porteur (spec de la story 3.11) |
| 2026-11-10 | Tests d'interactions (action A2 de la rétrospective de l'epic 3) : mode navigateur de Vitest (Chromium piloté par Playwright), composants isolés, actions serveur simulées, pas de test du site complet ; contrôle « Navigateur » ajouté à la CI à chaque PR | Choix du porteur (spec du harnais de tests navigateur) |
| 2026-11-10 | E-mails transactionnels (story 4.1, AQ-1) : prestataire Resend, région UE ; expéditeur « Errancy <contact@errancy.art> » avec réponses à la même adresse (le porteur ajoute les enregistrements de vérification du domaine et la clé d'API dans Vercel) ; en attendant le Conseil WhatsApp (story 4.4), les e-mails se terminent par l'adresse de contact ; échec d'envoi : message à l'équipe et invitation relançable, lien d'invitation jamais montré en clair | Choix du porteur (spec de la story 4.1) |

## Conséquences à traiter (relevées le 2026-10-23, à valider en PRD et architecture)

- **Paiement de type place de marché** : le paiement actuel (Stripe Checkout encaissé par un seul
  compte) ne convient plus tel quel. Il faut répartir chaque vente entre l'artiste et la
  commission d'Errancy (piste : Stripe Connect), avec vérification d'identité des artistes et
  disponibilité de Stripe dans leurs pays.
- **Rôle juridique d'Errancy** : intermédiaire, pas vendeur ; CGV et mentions à rédiger en
  conséquence (responsabilité, rétractation, authenticité, litiges).
- **Livraison internationale** : l'artiste expédie. Il faut lui faire saisir frais et délais
  d'envoi par œuvre (ou par zone), le numéro de suivi après la vente, et définir qui supporte
  douane, assurance et casse ; l'acheteur doit voir le prix total et le délai avant de payer.
- **Artistes dans tous les pays** : aucune solution de paiement fractionné (Stripe Connect compris)
  ne couvre tous les pays. À étudier (`bmad-deep-recon`, type technical) : pays couverts,
  solution de repli (versement manuel, autre prestataire), vérification d'identité, fiscalité
  des versements.
- **Commission de 30 %** : préciser l'assiette (œuvre seule ou livraison incluse), qui paie les
  frais de paiement, quand l'artiste est payé (après réception par l'acheteur ?), et comment sont
  gérés retours et remboursements.
- **Multi-devise et multilingue** : à arbitrer pour un public international et diaspora.
- **Double vente** : un artiste peut aussi vendre hors du site ; la disponibilité doit pouvoir être
  mise à jour par l'artiste et réservée pendant un paiement.
- **Données de démonstration** : à purger ; le lancement suppose un vrai catalogue (photos,
  prix, dimensions, accords).
