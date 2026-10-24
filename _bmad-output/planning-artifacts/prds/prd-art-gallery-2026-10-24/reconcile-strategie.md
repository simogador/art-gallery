---
title: "Réconciliation — docs/strategie-refonte.md ↔ PRD refonte d'Errancy"
created: 2026-10-24
source: docs/strategie-refonte.md (191 lignes, lue en entier)
cible: prd.md (550 lignes) + addendum.md (70 lignes)
---

# Réconciliation : stratégie de refonte ↔ PRD

Contrôle croisé avec `docs/decisions-porteur.md` pour distinguer ce qui a été tranché par le porteur
(et peut donc légitimement s'écarter du rapport) de ce que le PRD a tranché seul.

Gravité : **Élevée** (contredit une contrainte non négociable, une décision réservée au porteur ou
oriente à tort l'architecture) ; **Moyenne** (exigence ou signal qualitatif perdu, à rétablir avant
`bmad-ux` / `bmad-architecture`) ; **Mineure** (précision, formulation).

## 0. Verdict sur le montage de paiement

Le PRD **ne tranche pas formellement** le montage : §0 l.24, FR-14 l.247-249, §7 l.419, OQ-1
l.464-472 et addendum §B l.30 (« NON décidées ») le laissent ouvert. Quatre glissements restent à
corriger (détaillés en E-01 à E-04) :

1. la contrainte de calendrier de la source (décision paiement **avant l'architecture**) a disparu ;
2. l'option « solution locale » de la source a disparu, et OQ-1 cadre la question à partir de la
   seule recommandation UK/US ;
3. FR-12/FR-13 et UJ-1 supposent implicitement un paiement intégré, avec une session courte et en
   plusieurs devises ;
4. SM-1 fixe une échéance de première vente (12 semaines) qui suppose le montage résolu à temps.

## 1. Écarts

### A. Montage de paiement et décisions réservées au porteur

| # | Source (ligne) | PRD concerné | Nature | Gravité | Correction proposée |
|---|---|---|---|---|---|
| E-01 | l.158 « Marché/paiement non arbitré — Élevée — Décision en phase 0, avant l'architecture » ; l.137 critère de sortie phase 0 « arbitrages marché/entité/paiement pris » ; l.139 phase 2 « Readiness = PASS ; décision paiement actée » | §11 l.530 (risque reformulé « le montage tarde ») ; §0 l.14 (enchaîne UX → architecture sans condition) ; OQ-1 l.464-472 | Déformé : la mitigation de la source (décider avant l'architecture) est remplacée par « Lot 1 indépendant ». Rien n'empêche de lancer `bmad-architecture` sur les couches paiement/commande sans décision. | Élevée | Dans OQ-1, ajouter « Échéance : avant l'architecture des couches commande/paiement ; condition de readiness (phase 2) ». Rétablir la mitigation de la source dans la ligne §11 l.530, en plus du Lot 1. Garder OQ-1 ouverte. |
| E-02 | l.105 « Stripe (ou solution locale) » | OQ-1 l.470 ; addendum §B l.30-51 | Perdu : la piste d'un prestataire local (marocain ou régional) n'apparaît plus. Le seul état cité est la recommandation UK/US, ce qui oriente la décision. | Moyenne | Dans OQ-1 « Questions à trancher », ajouter « prestataire international ou solution locale ». Dans l'addendum §B, signaler que la piste locale n'a pas été étudiée (ou la faire étudier). |
| E-03 | l.137-139 (choix du prestataire en phase 2, pas avant) | FR-12 l.236 (`[ASSUMPTION : environ 30 min]`) ; FR-13 l.240 (« confirmation du paiement par le prestataire, reçue côté serveur ») ; UJ-1 l.80 (prix en dollars canadiens) vs NFR-8 l.391 (pas d'autre devise au MVP) | Tranché implicitement : la durée de réservation et la confirmation par notification supposent un checkout intégré. Avec l'option R4 (lien de paiement après WhatsApp, OQ-12), la réservation dure plutôt des heures et la confirmation peut être manuelle. UJ-1 suppose un affichage multidevise que NFR-8 exclut. | Moyenne | FR-12 : « durée paramétrable, dépendante du montage (OQ-1/OQ-12) ». FR-13 : ajouter le cas d'une confirmation manuelle et tracée par l'équipe si OQ-12 est retenue. UJ-1 : afficher en euros, ou renvoyer la devise à OQ-6. |
| E-04 | l.148 « Les objectifs chiffrés sont fixés après la mesure initiale » | SM-1 l.428-429 (objectif « dans les 12 semaines », exception explicite l.424) | Contredit : le PRD crée une échéance chiffrée que la source ne fixe pas, alors que la première vente dépend d'OQ-1, OQ-7 et OQ-10, qui sont ouvertes. | Moyenne | Remplacer l'échéance par « date fixée par le porteur après OQ-1 et OQ-11 », ou la marquer `[ASSUMPTION]` et l'ajouter à l'index §12. |
| E-05 | l.26 « Décisions réservées au porteur : … espace physique / showroom » (non renseigné dans `decisions-porteur.md` l.22) | UJ-4 l.102 « Il n'y a pas de showroom : les visites se font à distance, ou en atelier » | Tranché à tort : le parcours affirme comme un fait une décision réservée au porteur, alors qu'OQ-8 l.496-497 la laisse ouverte. | Élevée | Réécrire UJ-4 de façon conditionnelle (« visite à distance ; showroom selon OQ-8 »), marquer `[ASSUMPTION]` et l'ajouter à §12. |
| E-06 | l.26 « accès aux statistiques de trafic et de ventes » ; l.48 « statistiques de trafic et ventes » | §8 l.424 « aucune baseline n'existe » | Déformé : la source traite les statistiques existantes comme une information à obtenir. Le PRD conclut qu'il n'y en a aucune, alors que `decisions-porteur.md` §4 n'est pas renseigné (ventes passées, trafic avant maintenance). | Mineure | « Aucune baseline n'est connue à ce jour ; le porteur indique s'il existe des données historiques (decisions-porteur §4) », plus une OQ dédiée ou un ajout à OQ-11. |

### B. Positionnement, ton, ambiance (éléments qualitatifs)

| # | Source (ligne) | PRD concerné | Nature | Gravité | Correction proposée |
|---|---|---|---|---|---|
| E-07 | l.10-12 « galerie-curatrice digitale — sélection resserrée, artistes mis en valeur, prix transparents, accompagnement humain » ; l.36 « inspiration assumée des galeries en ligne (Massinart notamment) pour une version supérieure, pas une copie » ; l.65-68 (cadrage premium, rendez-vous privés, programme collectionneur) ; l.88 collections « Silence », « Mémoire », « Matière », « Lumières du Sud » | Absent : aucune section ton, voix ou ambiance. §1 l.28 reprend l'ambition en une phrase. §2.2 l.65 ne cite Massinart que comme contre-exemple (« boutique de déco »). FR-18 l.282 tronque les collections en « etc. » | Perdu : le registre curatorial, narratif et haut de gamme, et l'imaginaire suggéré par les noms de collections (matière, lumière du Sud, mémoire, silence), ne sont pas transmis à `bmad-ux`. Le rôle de Massinart est inversé : la source en fait une inspiration à dépasser, le PRD seulement un repoussoir. | Moyenne | Ajouter un §1.1 « Positionnement et ton » : galerie-curatrice et non boutique ; voix sobre, sérieuse et humaine (conseil par une personne) ; récit des œuvres et des artistes ; ambiance éditoriale évoquée par les quatre noms de collections, cités en entier ; Massinart comme référence à dépasser, « pas une copie ». Le présenter comme une consigne pour `bmad-ux`, sans nouvelle FR. |
| E-08 | l.40-41 « Positionnement "galerie-curatrice digitale" ; promesse… » rangés sous « Hypothèses à tester (pas des faits) » | §1 l.28 « Errancy veut devenir une galerie-curatrice digitale » ; §2.1 l.47 | Déformé : le PRD présente le positionnement comme acquis et ne dit pas comment le valider. | Mineure | Ajouter : « Positionnement à valider par les indicateurs (SM-2, SM-3) », ou une ligne dans §12. |
| E-09 | l.70-71 « répondre **sur chaque écran** aux quatre questions de l'acheteur » | §1 l.30 « Sur chaque fiche œuvre » ; §4.1 l.139 | Restreint : la promesse ne couvre plus que la fiche. Le catalogue (prix total et format dans les vignettes), le panier et l'accueil n'ont aucune exigence équivalente. | Moyenne | Reformuler §1 : « sur chaque écran, et en entier sur la fiche ». Ajouter un critère à FR-17/FR-18 : la vignette du catalogue montre le prix total (ou « à partir de ») et le format, et donne un signe de sérieux. |
| E-10 | l.78 filtres « couleur, **ambiance** » | FR-17 l.267-274 | Perdu : le filtre par ambiance, le plus qualitatif, a disparu. Le PRD l'a remplacé par orientation et pays. | Moyenne | Ajouter « ambiance » à FR-17. Si le vocabulaire des ambiances n'est pas encore défini, en faire une OQ liée aux collections narratives. |
| E-11 | l.79 fiche œuvre : « Photos **HD** … **histoire courte** » | FR-1 à FR-6 l.141-186 ; FR-20 l.300-310 | Perdu : l'histoire courte de l'œuvre (le récit, qui porte le caractère curatorial) n'est ni affichée ni demandée au dépôt. L'exigence de photos HD est absente (seule l'optimisation mobile est demandée). | Moyenne | Ajouter à FR-5, ou dans une FR « Récit de l'œuvre », un texte court obligatoire. Ajouter le champ à FR-20 et la règle « photos haute définition, zoom » à FR-2. |
| E-12 | l.77 accueil « **Qualifier la marque**, orienter … appel à l'action clair » | FR-18 l.278-282 | Perdu : l'accueil ne sert plus qu'à afficher une sélection. Sa fonction de présentation de la marque et l'appel à l'action ont disparu. | Mineure | Dans FR-18 : « l'accueil présente le positionnement d'Errancy (galerie-curatrice, conseil humain) et propose un appel à l'action principal ». |
| E-13 | l.80 « Pages artistes — MVP (**gérées par Errancy**) » | FR-19 l.294 `[ASSUMPTION : contenu fourni par l'artiste et validé par Errancy]` ; OQ-14 l.513-514 | Contredit : la source attribue la gestion des pages artistes à Errancy, alors que l'hypothèse du PRD en confie la rédaction à l'artiste. | Moyenne | Prendre la source comme valeur par défaut (pages rédigées et gérées par Errancy, à partir d'éléments fournis par l'artiste) et le dire dans OQ-14. |
| E-14 | l.81 « Conseil et rendez-vous — **Formulaire de sélection ou assistant simple** » | Absent (FR-7 et FR-8 ne couvrent que WhatsApp et la visite) | Perdu : il manque le parcours « aidez-moi à choisir » (espace, goût, budget). C'est pourtant la promesse l.41. | Moyenne | Ajouter une FR « Demande de sélection personnalisée » : formulaire court (pièce, dimensions du mur, budget, goûts), traité par l'équipe, rattaché à FR-25 et compté dans SM-3. Version simple, sans assistant automatique. |
| E-15 | l.19 « Différencier ensuite : … **rendez-vous privés** » ; l.89 « rendez-vous privé » (après MVP) | §6.2 l.403-412 | Perdu : le rendez-vous privé ne figure pas dans la liste hors MVP. | Mineure | Ajouter « Rendez-vous privés (au-delà de la demande de visite FR-8) » à §6.2. |

### C. Contraintes non négociables

| # | Source (ligne) | PRD concerné | Nature | Gravité | Correction proposée |
|---|---|---|---|---|---|
| E-16 | l.110-111 « Migration progressive… : sauvegarde restaurable, **correspondance des données**, redirections 301, **bascule répétée en préproduction**, plan de retour arrière » ; l.140 critère phase 3 « retour arrière testé » | NFR-7 l.390 | Incomplet : la correspondance des données (démonstration → réel, `Float` → centimes, CSV des slugs), la répétition de la bascule en préversion et le test du retour arrière ont disparu. | Élevée | Compléter NFR-7 : correspondance des données documentée pour chaque changement de schéma ; bascule répétée sur la préversion Vercel ; retour arrière testé avant la mise en production. |
| E-17 | l.126-128 règle d'or : « en préservant les données, **les rôles utilisateurs** et les **fonctionnalités critiques** » | Absent (NFR-7 et §7 parlent de pile, pas de rôles) | Perdu : le maintien des rôles `user`/`artist`/`admin`, des comptes existants (Google + identifiants) et des fonctionnalités en place (CRUD artiste, prix relus en base, webhook idempotent) n'est pas exigé en tant que tel. FR-10 (achat sans compte) modifie un parcours critique. | Moyenne | Ajouter à NFR-7 : « les rôles, les comptes et les fonctionnalités critiques existants sont préservés ; toute modification (ex. FR-10) garde le parcours connecté actuel ». |
| E-18 | l.116-117 « Photos clients (simulateur) : traitement local dans le navigateur, sans stockage serveur au départ » | Absent (§6.2 l.405 ne parle que de calibration) | Perdu : la contrainte de confidentialité s'applique dès qu'on conçoit le simulateur, même s'il vient après le MVP. | Moyenne | Ajouter à §6.2 (simulateur) et à §10 : « traitement local, aucune photo client stockée côté serveur ». |
| E-19 | l.113-114 « confirmation serveur **après vérification de la notification** du prestataire » ; « libération des réservations expirées **ou annulées** » | FR-13 l.240 ; FR-12 l.233-235 | Affaibli : la vérification (signature ou authenticité de la notification) n'est pas exigée. La libération après annulation (paiement abandonné ou refusé) n'est prévue que manuellement (FR-26). | Mineure | FR-13 : « après vérification de l'authenticité de la notification ». FR-12 : « libérée à l'expiration ou dès l'annulation du paiement ». |

### D. Indicateurs et économie

| # | Source (ligne) | PRD concerné | Nature | Gravité | Correction proposée |
|---|---|---|---|---|---|
| E-20 | l.54-58 formule de la marge contributive ; l.45-46 offres « à valider par la marge contributive » ; l.147 « **marge contributive par œuvre et par offre** » | SM-5 l.445-447 (« panier moyen… sert à suivre la marge contributive ») | Déformé : le critère qui valide toute offre nouvelle est réduit à un usage secondaire du panier moyen. La formule a disparu et aucune FR n'en permet le calcul (frais de paiement, emballage, coûts d'acquisition). | Élevée | Ajouter un SM « Marge contributive par œuvre et par offre » avec la formule de la source (adaptée à la commission de 30 %), et la condition « aucun pilote (§6.2) sans marge contributive validée ». Lier ce SM à OQ-3. |
| E-21 | l.147 indicateur « **erreurs de commande** et doubles ventes » | SM-C1 l.450-452 (doubles ventes seulement) ; SM-C2 l.453-455 | Partiel : les erreurs de commande (mauvais montant, mauvaise adresse, annulations par l'équipe) ne sont pas suivies. | Mineure | Ajouter un garde-fou SM-C4 « Erreurs de commande », à partir des annulations motivées de FR-26. |
| E-22 | l.21 « expérimentations successives, pas simultanées » ; tableau l.60-68 (statuts) | §6.2 l.408 | Conforme sur la séquence, mais l'ordre de priorité (éditions 3, cadrage 4, B2B 5, sur-mesure 6, abonnement 7) et la règle de validation de chaque pilote sont perdus. | Mineure | Reprendre l'ordre de la source et le critère de passage (E-20) dans §6.2. |

### E. Risques

| # | Source (ligne) | PRD concerné | Nature | Gravité | Correction proposée |
|---|---|---|---|---|---|
| E-23 | l.153 « Perte de trafic SEO à la migration — **Élevée** — 301, bascule progressive, **mesure avant/après** » | §11 l.535 « Moyenne » ; NFR-2 l.385 | Contredit : la gravité est abaissée sans justification. La mesure avant/après n'est pas demandée. | Moyenne | Remettre « Élevée » ou justifier (site en maintenance, donc trafic faible : à confirmer avec les statistiques, E-06). Ajouter à NFR-2 un relevé des URL indexées avant tout changement et une comparaison après. |
| E-24 | l.156 « Droits d'auteur non clarifiés — Élevée » ; l.155 « Aperçu mural trompeur — Moyenne » ; l.157 « Surengagement d'outils avancés — Moyenne » ; l.159 « Dépendance à une seule personne — Moyenne » | §11 l.526-536 (absents ; les droits ne sont couverts qu'en partie par la ligne catalogue l.533) | Perdu : quatre risques de la source ne figurent pas au registre. | Mineure | Ajouter les droits d'auteur (FR-16, §10) et la dépendance à une seule personne (documentation BMAD, validation à chaque étape). Mentionner les deux autres pour mémoire (hors MVP / processus). |

## 2. Points conformes vérifiés (sans écart)

Les trois priorités et leur ordre (l.14-21 → §0 l.14) ; l'hypothèse prioritaire de réduction de
l'incertitude (l.42-43 → §1 l.30) ; les quatre questions de l'acheteur (l.70-71) ; les trois boutons
Acheter / Conseil WhatsApp / Réserver une visite (l.79 → FR-6) ; le prix total avec œuvre, cadre et
livraison (l.79 → glossaire l.126) ; la prévention des doubles ventes, avec atomicité, idempotence et
test concurrent (l.112-115 → FR-12, FR-13, NFR-4, SM-C1) ; les droits sur les éditions (l.118 →
§2.2, §6.2, §10) ; le journal après le lancement (l.85 → §6.2) ; la mention « aperçu illustratif »
(l.87 → §6.2) ; la performance, le SEO et l'accessibilité (l.91-93 → NFR-1 à NFR-3) ; le refus de
la migration vers Supabase (l.168 → §7, addendum §D) ; les constats de l'audit §9.1 (→ addendum §A).
