# Stratégie — Refonte et optimisation d'Errancy.art

> Transcription du rapport exécutif du 21 octobre 2026 (PDF fourni par le porteur du projet),
> suivie d'une **annexe de confrontation au code réel** (§9) rédigée après l'audit du dépôt.
> En cas de contradiction, l'annexe et `docs/analyse-projet.md` (faits constatés) priment sur les
> hypothèses du rapport. Les décisions du porteur sont dans `docs/decisions-porteur.md`.

## 1. Synthèse décisionnelle

**Ambition :** faire d'Errancy.art une galerie-curatrice digitale — sélection resserrée, artistes
mis en valeur, prix transparents, accompagnement humain — et non une boutique de tableaux parmi
d'autres.

**Trois priorités, dans l'ordre :**

1. **Convertir d'abord.** Améliorer fiches œuvres, prix, dimensions, photos et le canal de conseil
   direct (WhatsApp) avant toute refonte profonde.
2. **Différencier ensuite.** Simulateur mural, collections narratives, pages artistes, éditions
   limitées, rendez-vous privés.
3. **Diversifier enfin.** Cadrage premium, location B2B, commandes sur mesure, programme
   collectionneur — lancés comme expérimentations successives, pas simultanées.

**Périmètre du premier lancement :** optimiser l'existant avant de décider ce qu'il faut remplacer.
La refonte technique n'est arbitrée qu'après l'audit brownfield.

**Décisions réservées au porteur :** marché principal (Maroc, France, international, diaspora) ;
entité juridique vendeuse ; espace physique / showroom ; accès aux statistiques de trafic et de
ventes.

**Conditions de réussite :** dépôt Git accessible, mesure initiale du trafic et des conversions,
droits clairs sur les images et accords artistes, validation humaine à chaque étape BMAD.

## 2. Situation et hypothèses

**Confirmé :** Errancy.art existe (projet brownfield) ; BMAD est le système de production ;
inspiration assumée des galeries en ligne (Massinart notamment) pour une version supérieure, pas
une copie.

**Hypothèses à tester (pas des faits) :**
- Positionnement « galerie-curatrice digitale » ; promesse : « trouver une œuvre qui correspond
  vraiment à votre espace, votre goût et votre budget ».
- **Hypothèse prioritaire : la réduction de l'incertitude de l'acheteur est le principal levier de
  conversion.**
- Pile technique candidate (voir §5) — proposition, pas décision.
- Revenus additionnels (cadrage, location, sur-mesure, abonnement) à valider par la marge
  contributive.

**Informations nécessaires :** dépôt et hébergement ; statistiques de trafic et ventes ;
catalogue (nombre d'œuvres, artistes, prix) ; droits sur les images et accords artistes ; marché
visé et entité vendeuse.

## 3. Stratégie économique

Le cœur du modèle reste la vente d'œuvres ; chaque nouvelle offre est une **expérimentation
séquencée**, validée par la marge contributive :

> Marge contributive = encaissement − (rémunération artiste ou coût d'achat + production + frais de
> paiement + emballage + livraison prise en charge + coûts d'acquisition + coûts variables)

| Priorité | Offre | Rôle | Statut |
|---|---|---|---|
| 1 | Œuvres originales | Cœur du modèle | Immédiat |
| 2 | Accompagnement à l'achat (WhatsApp, rendez-vous) | Convertir les hésitants | Immédiat |
| 3 | Éditions limitées signées et numérotées | Prix d'entrée, fidélisation | Après lancement, sous réserve des droits |
| 4 | Cadrage premium | Marge additionnelle (à valider) | Après lancement |
| 5 | Location d'œuvres B2B | Revenus récurrents | Pilote ultérieur |
| 6 | Commandes sur mesure | Panier moyen élevé (hypothèse) | Pilote ultérieur |
| 7 | Abonnement collectionneur | Fidélité, accès anticipé | Pilote ultérieur |

**La promesse :** répondre sur chaque écran aux quatre questions de l'acheteur — « est-ce que cette
œuvre ira chez moi ? est-elle trop petite ? trop chère ? sérieuse ? ».

## 4. Structure du site

| Section | Objectif | Contenu indispensable | Priorité |
|---|---|---|---|
| Accueil | Qualifier la marque, orienter | Sélection curatoriale, nouveautés, appel à l'action clair | MVP |
| Catalogue / collections | Trouver vite l'œuvre | Filtres : artiste, prix, format, couleur, ambiance, disponibilité | MVP |
| Fiche œuvre | Lever l'incertitude, convertir | Photos HD dont mise en situation, dimensions réelles, prix total transparent (œuvre, cadre, livraison), histoire courte, certificat, disponibilité, délai ; boutons **Acheter / Conseil WhatsApp / Réserver une visite** | MVP |
| Pages artistes | Confiance et valeur | Portrait, démarche, atelier, œuvres disponibles | MVP (gérées par Errancy) |
| Conseil et rendez-vous | Convertir les hésitants | Formulaire de sélection ou assistant simple ; réservation visite / visio | MVP simplifié |
| Panier, commande, suivi | Finaliser l'achat | Paiement fiable, suivi soigné | MVP |
| Confiance et pages légales | Rassurer | CGV, livraison, retours, authenticité, mentions légales | MVP |
| Administration | Gérer catalogue et commandes | Gestion œuvres, commandes, prévention des doubles ventes | MVP |
| Journal | SEO, fidélisation | Articles courts | Après lancement |

**Après le MVP :** simulateur mural (calibration ou mention « aperçu illustratif ») ; collections
narratives (« Silence », « Mémoire », « Matière », « Lumières du Sud ») ; espace collectionneur
(favoris, alertes, suivi d'artistes) ; comparateur de formats (éditions) ; rendez-vous privé.

**Exigences d'optimisation :** performance mobile et médias (images adaptées, compression) ;
SEO (métadonnées, sitemap, canoniques, redirections 301) ; accessibilité (clavier, contraste,
formulaires, textes alternatifs).

## 5. Choix techniques

L'audit arbitre entre trois scénarios :

| Scénario | Quand | Avantage | Risque |
|---|---|---|---|
| Optimiser l'existant | Site viable, frein commercial | Coût minimal, rapidité | Plafond technique |
| Moderniser certaines couches | Socle correct, briques manquantes | Équilibre coût/bénéfice | Complexité d'intégration |
| Reconstruire | Cœur obsolète ou fragile | Architecture propre | Fonctionnalités perdues, coût, délais |

Pile candidate du rapport : Next.js, Supabase, Supabase Storage ou Cloudflare R2, Stripe (ou
solution locale), Vercel, Resend, WhatsApp Business, PostHog ou GA4, Git + GitHub Actions.
**Voir §9 : l'existant couvre déjà la plupart de ces besoins.**

**Exigences non négociables :**
- **Migration progressive, jamais big-bang** : sauvegarde restaurable, correspondance des données,
  redirections 301, bascule répétée en préproduction, plan de retour arrière.
- **Œuvres uniques — prévention des doubles ventes** : réservation temporaire au début du paiement
  avec expiration ; attribution atomique ; confirmation serveur après vérification de la
  notification du prestataire, traitement idempotent ; libération des réservations expirées ou
  annulées ; test explicite de deux achats concurrents.
- **Photos clients (simulateur)** : traitement local dans le navigateur, sans stockage serveur au
  départ.
- **Droits** : ni éditions ni reproductions sans autorisation écrite des ayants droit.

## 6. Exploitation de BMAD

Séquence brownfield : documenter l'existant → PRD d'amélioration → architecture d'intégration →
epics et stories → implémentation story par story. Correspondance avec la version installée
(6.12.2) en §9.2.

**Règle d'or :** ne jamais demander « refais toute la plateforme ». Demander : « analyse ce dépôt,
documente l'existant, puis propose une migration progressive vers cette architecture cible, en
préservant les données, les rôles utilisateurs et les fonctionnalités critiques ».

Les boucles autonomes et les agents personnalisés sont réservés à un projet stabilisé ; le MVP se
construit avec les workflows noyau.

## 7. Calendrier indicatif (12 semaines, modernisation ciblée)

| Phase | Semaines | Livrables | Critère de sortie |
|---|---|---|---|
| 0 — Audit et mesure | 1–2 | Documentation de l'existant, mesure initiale, inventaire catalogue/droits/prix | Documentation validée, baseline de mesure, arbitrages marché/entité/paiement pris |
| 1 — Corrections rapides de conversion | 3–4 | Fiches enrichies (prix, dimensions, délais, photos), WhatsApp visible partout, suivi analytique | Fiches complètes sur tout le catalogue, parcours de contact contrôlés, événements analytiques vérifiés |
| 2 — Cadrage de la refonte | 5–6 | PRD brownfield, UX, architecture + ADR, plan de migration, choix du prestataire de paiement | Readiness = PASS ; décision paiement actée |
| 3 — Socle commercial | 7–10 | Catalogue filtrable, pages artistes, panier/commande fiables sans double vente, pages légales, admin catalogue | Recette en préproduction, redirections vérifiées, retour arrière testé |
| 4 — Lancement et stabilisation | 11–12 | Bascule production, monitoring, retour arrière, premières optimisations | Site stable, conversion comparée à la baseline |
| 5 — Différenciation | après 12 | Simulateur, collections, éditions, cadrage, pilotes B2B, programme collectionneur | Selon résultats |

## 8. Pilotage et risques

**Indicateurs :** demandes qualifiées (WhatsApp, formulaires, visites) ; taux de conversion ;
panier moyen ; marge contributive par œuvre et par offre ; erreurs de commande et doubles ventes.
Les objectifs chiffrés sont fixés après la mesure initiale.

| Risque | Gravité | Mitigation |
|---|---|---|
| Refaire au lieu d'améliorer | Élevée | Conversion d'abord ; arbitrage technique après audit |
| Perte de trafic SEO à la migration | Élevée | 301, bascule progressive, mesure avant/après |
| Double vente d'une œuvre unique | Élevée | Réservation expirable, attribution atomique, idempotence, test concurrent |
| Aperçu mural trompeur | Moyenne | Calibration ou mention « aperçu illustratif » |
| Droits d'auteur non clarifiés | Élevée | Autorisations écrites avant toute édition |
| Surengagement d'outils avancés | Moyenne | Réservés au projet stabilisé |
| Marché/paiement non arbitré | Élevée | Décision en phase 0, avant l'architecture |
| Dépendance à une seule personne | Moyenne | Documentation vivante BMAD, Git, validation à chaque étape |

## 9. Annexe — Confrontation au code réel (audit du 2026-10-23)

### 9.1 Ce que le rapport ne pouvait pas savoir

| Le rapport suppose | Constat dans le dépôt |
|---|---|
| Site non inspecté, pile inconnue | Next.js 14 (App Router), Prisma 7 + PostgreSQL Neon, NextAuth v5 (Google + identifiants, rôles user/artist/admin), Stripe Checkout + webhook, Cloudinary, Zustand, Vercel. Détails : `docs/analyse-projet.md`. |
| Pile candidate : Supabase, Supabase Storage / R2 | **Équivalents déjà en place** (Neon/Prisma, NextAuth, Cloudinary). Migrer vers Supabase n'apporte rien de démontré et correspond au risque « refaire au lieu d'améliorer ». Scénario le plus probable : **optimiser / moderniser certaines couches**. À trancher par `bmad-architecture`. |
| Double vente : risque à prévenir | **Défaut réel** : aucune réservation, l'œuvre n'est marquée vendue qu'au webhook ; deux paiements simultanés aboutissent. |
| Resend, analytics, WhatsApp | Absents : aucun e-mail transactionnel, aucune mesure, aucun bouton WhatsApp. |
| Git + GitHub Actions | Git oui ; **aucun test ni CI**. |
| Fiches œuvres | Existent (`/galerie/[id]`) mais sans prix total, délai, certificat, mise en situation ni boutons de conseil/visite. |
| Pages légales, filtres avancés, suivi de commande | Absents (pas de CGV, filtres limités, pas d'espace commandes client). |

Corrigé le 2026-10-23 (commit « fix: build Vercel… ») : build Vercel cassé, réécriture
`vercel.json` qui bloquait toute l'app, middleware jamais exécuté (placé hors de `src/`), rôle
perdu à la connexion par identifiants. La maintenance est désormais pilotée par la variable
`MAINTENANCE_MODE` (voir `docs/analyse-projet.md`).

### 9.2 Commandes BMAD : rapport → version installée (6.12.2)

| Nom dans le rapport | Commande réelle |
|---|---|
| `document-project` | N'existe plus : `docs/analyse-projet.md` + `bmad-architecture` (lit le code en brownfield) |
| `bmad-market-research`, `-technical-research`, `-domain-research` | `bmad-deep-recon` (types market, competitive, domain, technical) |
| `create-brownfield-prd` | `bmad-prd` |
| `create-brownfield-architecture` | `bmad-architecture` |
| `bmad-check-implementation-readiness` | `bmad-sprint-planning` (« check implementation readiness ») |
| `bmad-sprint-status` | `bmad-sprint-planning` (« show sprint status ») |
| `bmad-review`, `bmad-forge-idea`, `bmad-party-mode`, `bmad-advanced-elicitation`, `bmad-customize` | Installés |
| TEA, BMad Builder, Loop | Non installés (conforme au principe de prudence) |
