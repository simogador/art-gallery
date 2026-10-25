---
title: "Réconciliation — docs/analyse-projet.md ↔ PRD refonte d'Errancy"
created: 2026-10-24
source: docs/analyse-projet.md (rédigé le 2026-10-13, mis à jour le 2026-10-23, commit 3b25280)
cible: prd.md, addendum.md (prd-art-gallery-2026-10-24)
---

# Réconciliation : analyse technique ↔ PRD

Ce document liste les faits techniques constatés dans `docs/analyse-projet.md` que le PRD ou l'addendum ignorent, contredisent ou rangent au mauvais endroit, lorsqu'ils touchent aux exigences. Règle appliquée : le PRD décrit des capacités ; les chemins de code, modèles et variables vont dans l'addendum. Aucun autre fichier n'a été modifié.

Gravité : **Élevée** = une exigence est fausse ou il en manque une, et la conversion, l'intégrité des ventes ou la sécurité en souffrent ; **Moyenne** = lacune qui fera retravailler l'UX, l'architecture ou les stories ; **Faible** = précision, traçabilité ou rangement.

Faits déjà bien repris, sans écart : panier et checkout soumis à session (addendum A, FR-10) ; prix relus en base et webhook idempotent (FR-11, FR-13) ; prix en `Float`, `Order.artworkIds` en CSV, pas de contrôle de double vente (addendum A) ; `src/data/*` encore importé (FR-16) ; rôle non rafraîchi dans le JWT (addendum A) ; ni tests ni CI (addendum A) ; Next.js 14.2.5 (NFR-5) ; maintenance et `robots.txt` pilotés hors du code (NFR-2, §7, OQ-15).

## Écarts

### E-1. Comptes artistes et attribution des rôles : aucune exigence

- **Source :** l.46-47 « `Artist` (lié optionnellement à un `User`) … `User` (rôle texte : `user` | `artist` | `admin`) » ; l.50 « `artist` ou `admin` → /dashboard/artiste » ; l.72-73 « le rôle n'est pas rafraîchi dans le JWT après un changement par un admin (l'utilisateur doit se reconnecter) ».
- **PRD/addendum :** absent du PRD. UJ-2 part de « il est connecté à son espace artiste » et §4.5 suppose un compte artiste existant, sans dire comment il est créé ni relié à sa fiche artiste. L'addendum A cite le problème du JWT seulement dans « Autres points », sans le rattacher à une FR.
- **Gravité :** Élevée. Sans parcours d'arrivée de l'artiste, aucun artiste ne peut déposer d'œuvre : FR-20 et FR-21 sont bloquées, et avec elles le catalogue réel de FR-16.
- **Correction proposée :**
  - PRD : ajouter en §4.7 une FR du type « L'équipe Errancy invite un artiste sélectionné, lui donne accès à l'espace artiste et relie ce compte à sa page artiste. Le changement de rôle prend effet sans que l'artiste ait à le découvrir seul (au plus : il est invité à se reconnecter). » Ajouter le cas limite à UJ-2.
  - Addendum A : ajouter une ligne pour cette FR avec la liaison optionnelle `Artist`↔`User`, le rôle texte sur `User.role` et le JWT qui n'est pas rafraîchi.

### E-2. Contrôle d'accès par rôle absent de NFR-5

- **Source :** l.43 « `src/middleware.ts` … contrôle des rôles » ; l.75 « typage `any` sur la requête/rôle » ; l.83 « aucun test automatisé ni CI … nombreux `as any` ».
- **PRD/addendum :** NFR-5 traite Next.js, les secrets et l'accès aux données des acheteurs. Il ne dit pas qu'un artiste ne peut modifier que ses propres œuvres et commandes, ni que les fonctions d'administration sont réservées au rôle `admin`. L'addendum ne relève pas le typage `any` sur le rôle.
- **Gravité :** Élevée. FR-21 et FR-22 donnent à l'artiste le droit d'écrire sur la disponibilité et les commandes. Un contrôle de rôle faiblement typé et jamais testé ouvre la porte à des modifications croisées entre artistes.
- **Correction proposée :**
  - PRD (NFR-5) : « Chaque artiste n'agit que sur ses propres œuvres et sur les commandes qui les concernent ; les fonctions d'administration sont réservées à l'équipe Errancy ; ces règles sont vérifiées côté serveur. »
  - Addendum A : ligne NFR-5 complétée avec « contrôle des rôles typé `any` dans le middleware, `as any` répandus, aucun test d'autorisation ».

### E-3. Données de démonstration au-delà de `src/data/*` : seed et images Wikimedia/MET

- **Source :** l.41 « prisma/ … seed.ts » ; l.42 « scripts/upload-images.ts — Import d'images Wikimedia/MET vers Cloudinary » ; l.76-78 « `src/data/*` est encore importé par `components/sections/*` et `lib/utils/*` … risque d'incohérence entre accueil et catalogue ».
- **PRD/addendum :** FR-16 et l'addendum A ne visent que `src/data/*`. Le Lot 1 (§6.1) prévoit « la purge des données de démonstration » sans préciser qu'elle porte aussi sur les données semées en base et sur les images importées dans Cloudinary. FR-18 (accueil) n'est pas reliée aux `components/sections/*`, qui lisent encore les données statiques.
- **Gravité :** Élevée. Si des œuvres de démonstration semées en base, avec des images de musées, restent publiées, FR-16 n'est pas tenue et §10 (droit d'auteur, images publiées avec l'accord de l'artiste) est contredit. *À vérifier dans le code : le contenu exact de `seed.ts`.*
- **Correction proposée :**
  - PRD (FR-16) : critère « aucune œuvre, aucun artiste ni aucune image de démonstration ne reste publié, ni en base ni chez l'hébergeur d'images ».
  - Addendum A : étendre la ligne FR-16 à `prisma/seed.ts`, `scripts/upload-images.ts` et aux images Cloudinary. Ajouter une ligne FR-18 : `components/sections/*` (Hero, Gallery) lisent `src/data/*` alors que le catalogue lit la base.

### E-4. Disponibilité codée en booléen et montant de commande en euros seulement

- **Source :** l.56 « webhook … qui marque les œuvres `available=false` » ; l.48 « `Order` (… montant en euros) ».
- **PRD/addendum :** le glossaire et FR-12/FR-21 posent quatre états (`disponible`, `réservée`, `vendue`, `retirée`) et des états de commande. UJ-1 affiche des dollars canadiens et NFR-8 veut un site prêt pour d'autres devises. L'addendum dit seulement « pas d'états de disponibilité détaillés » (FR-20, FR-21). Il ne relève ni le booléen `available`, ni l'absence d'états de commande (FR-13, FR-15, FR-22, FR-26), ni le fait que le montant est stocké en euros sans devise.
- **Gravité :** Moyenne. C'est un changement du modèle de données à prévoir dans l'architecture, avec migration progressive (NFR-7). Sinon FR-3 (« prix total affiché = montant demandé ») ne peut pas être tenu pour une autre devise.
- **Correction proposée :** addendum A, compléter les lignes FR-12/FR-21 (« disponibilité = booléen `available` ; ni `réservée` ni `retirée` ») et FR-13/FR-15/FR-26 (« `Order` sans état de cycle de vie ») ; ajouter une ligne FR-3/NFR-8 (« montant de commande en euros, aucune devise stockée »). Le PRD ne change pas.

### E-5. Panier persistant côté navigateur : une œuvre qui n'est plus disponible n'est pas traitée

- **Source :** l.22 « Zustand (`src/lib/store/cart.ts`) pour le panier » ; l.54 « panier (Zustand, persistant) » ; l.33 « confirmation (vide le panier) ».
- **PRD/addendum :** FR-6 et FR-12 couvrent la fiche et le paiement, mais aucune exigence ne dit ce que voit l'acheteur quand une œuvre gardée dans son panier depuis plusieurs jours est entre-temps `réservée`, `vendue` ou `retirée` (ventes hors site, UJ-2).
- **Gravité :** Moyenne. L'acheteur découvre le problème au dernier moment, au paiement : c'est une friction de conversion, alors que le contrôle serveur évite la double vente.
- **Correction proposée :** PRD (FR-10 ou FR-11) : « À l'ouverture du panier et avant le paiement, chaque œuvre indisponible est signalée, retirée du total, et l'acheteur se voit proposer "Me prévenir" ou des œuvres proches. » Addendum A : panier Zustand persistant en local, sans revalidation à l'ouverture.

### E-6. Formulaire « Me notifier » de la page de maintenance : il n'envoie rien

- **Source :** l.66-67 « page servie : `public/maintenance.html` (son formulaire « Me notifier » n'envoie rien) ».
- **PRD/addendum :** absent. Le PRD dit (§8) qu'aucune baseline n'existe pendant la maintenance, mais il ne prévoit pas de recueillir les contacts des visiteurs actuels. Les adresses laissées sont donc perdues.
- **Gravité :** Moyenne. Des intentions d'achat sont perdues, et une promesse visible n'est pas tenue (crédibilité).
- **Correction proposée :** PRD : ajouter au Lot 1 une exigence courte, « Pendant la maintenance, le visiteur qui laisse son e-mail est réellement enregistré et prévenu à l'ouverture, avec son consentement (NFR-6) ». Une autre option : rattacher ce cas à FR-9. Addendum A : ligne « `public/maintenance.html`, formulaire sans envoi ». Le formulaire est modifié, mais la maintenance n'est pas levée (politique du dépôt).

### E-7. Mécanisme de maintenance et état de `robots.txt` absents de l'addendum

- **Source :** l.63-68 « active en production Vercel sauf si `MAINTENANCE_MODE=off` (`on` la force partout) ; les préversions et le local montrent le vrai site ; les admins connectés et `/auth/*` passent … `public/robots.txt` interdit toujours l'indexation ».
- **PRD/addendum :** NFR-2, §7 et OQ-15 posent la règle, mais l'addendum ne décrit pas le comportement actuel. Le PRD (§6.1, §8) fixe le relevé de la baseline « dès la sortie de maintenance » sans tenir compte de deux faits : les préversions montrent déjà le vrai site, et l'indexation reste bloquée tant que `robots.txt` n'est pas ouvert, ce qui fausse le trafic de référence.
- **Gravité :** Faible.
- **Correction proposée :** addendum A, rubrique « Maintenance et indexation » reprenant l.63-68. Dans OQ-15, préciser que la baseline doit être lue en distinguant le trafic d'avant et d'après l'ouverture de `robots.txt`.

### E-8. Page `/wishlist` : un placeholder protégé par connexion, qui reste en ligne

- **Source :** l.34 « wishlist/ Placeholder (état vide uniquement, pas de modèle en base) » ; l.43 « protège /dashboard, /wishlist, /panier » ; l.79 « Wishlist non implémentée ».
- **PRD/addendum :** §6.2 met les favoris hors MVP, mais rien ne dit quoi faire de la page vide existante, qui exige en plus une connexion.
- **Gravité :** Faible. Une page vide derrière une connexion nuit à l'image de sérieux visée par FR-5.
- **Correction proposée :** PRD §6.2 : « aucune entrée vers des favoris n'est visible dans le MVP ». Addendum A : `/wishlist` est un placeholder protégé par le middleware, à masquer ou à rediriger.

### E-9. Détails techniques dans le corps du PRD et hypothèses que la source confirme déjà

- **Source :** l.9-10 (maintenance), l.74 (panier soumis à session), l.76-78 (données statiques) : ces faits sont constatés, pas déduits.
- **PRD/addendum :** §1 marque la liste des freins `[ASSUMPTION]` alors que les freins 1, 2 et 4 sont constatés. FR-10 (« aujourd'hui, le panier exige une session »), FR-11 (`src/app/api/checkout/route.ts`), FR-16 (`src/data/*`) et NFR-2 (`public/robots.txt`, `MAINTENANCE_MODE`) contiennent des chemins de code et des variables.
- **Gravité :** Faible. C'est du rangement et de la traçabilité.
- **Correction proposée :** en §1, citer `docs/analyse-projet.md` pour les freins 1, 2 et 4 et garder `[ASSUMPTION]` pour les freins 3, 5 et 6. Dans les FR, remplacer les chemins par la capacité (« le paiement est calculé côté serveur », « aucune donnée de démonstration »), puis renvoyer vers l'addendum A, qui a déjà les chemins. NFR-2 peut garder la règle (« l'ouverture de l'indexation et la sortie de maintenance sont des décisions du porteur, jamais des changements de code ») sans nommer les fichiers.
