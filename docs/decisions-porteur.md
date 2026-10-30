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
- **Zones de livraison** et qui paie la livraison : **l'artiste expédie l'œuvre** (2026-10-24) ; zones et prise en charge des frais : …

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
