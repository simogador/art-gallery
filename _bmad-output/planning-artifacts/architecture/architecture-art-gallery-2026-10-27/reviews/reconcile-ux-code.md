---
type: review
lens: réconciliation (spec UX validée + projet existant)
target: ../ARCHITECTURE-SPINE.md (status: draft, updated 2026-10-27)
authority: ../.memlog.md (décisions du porteur) ; ux .memlog.md (spec UX)
date: 2026-10-27
---

# Relecture de réconciliation — spine d'architecture Errancy

## Verdict

Les sept points UX demandés ont tous atterri dans le spine. Deux règles se contredisent pourtant entre elles : le paiement reçu après expiration de la réservation, et le jeton de suivi glissé dans un e-mail envoyé plus tard. Trois parcours UX ou PRD n'ont pas de mécanisme : le lien de vente assistée, le délai de priorité de « Me prévenir » et le prix par pays sur des pages en cache. Enfin, plusieurs écarts avec le code existant ou AGENTS.md ne sont pas annoncés. Le spine est **à corriger avant validation**. Aucune refonte n'est nécessaire : chaque correction tient en une règle ou une ligne.

Les cinq blocs mermaid (le spine en contient 5, pas 4 : deux `flowchart`, un `erDiagram`, deux `stateDiagram-v2`) passent le parseur mermaid 11.4.1, exécuté sous jsdom ; contre-test : un bloc volontairement faux est bien rejeté. Aucune erreur de syntaxe. Il reste des erreurs de fond dans ces diagrammes (§4).

Gravité : **Haute** = deux epics construiront des choses incompatibles ou la double vente reste possible ; **Moyenne** = trou ou contradiction à combler avant l'epic concerné ; **Basse** = précision ou cohérence documentaire.

## 1. Couverture des points UX imposés

| Point UX | Où dans le spine | Statut |
|---|---|---|
| Panier sans compte, multi-artistes, une commande par artiste | AD-13, AD-4 (1 passage → N commandes), erDiagram `PASSAGE_EN_CAISSE ||--|{ COMMANDE`, `ARTISTE ||--o{ COMMANDE` | Atterri |
| Réservation ~30 min sans double vente | AD-7 (mise à jour conditionnelle en bloc, index unique partiel, expiration paresseuse), AD-8, AD-23 | Atterri ; voir C-1 (paiement tardif) et C-6 (vente assistée) |
| Suivi par lien à jeton sans compte | AD-14 (un jeton par passage en caisse, ancré par commande), AD-16, AD-10 | Atterri ; voir C-2 (jeton brut introuvable pour l'e-mail) |
| Espace artiste sur invitation | AD-14 (usage `invitation`), AD-15, module `acces` | Atterri ; voir C-8 (FR-34 « sans reconnexion ») |
| « Vendue ailleurs » annulable tant qu'aucune réservation n'existe | AD-7 dernier point, diagramme de disponibilité `vendue_ailleurs --> disponible` | Atterri, conforme au memlog UX l.33 |
| Adresse de l'acheteur visible seulement après prise en charge | AD-16 (`prise_en_charge` ou `expediee`, filtrée par `commandes`) | Atterri, conforme à EXPERIENCE (masquée de nouveau à `livree`) |
| Prix total par pays de livraison, zones fixées par l'artiste | AD-12, AD-5, option C (memlog) | Atterri ; voir C-3 (pays et cache) |
| Préparation internationale OQ-6 | AD-18, AD-5 | Atterri en partie : les propriétés CSS logiques (DESIGN.md l.165) manquent ; voir C-14 |
| Lot 1 sans Acheter, Lot 2 avec | AD-17 (interrupteur serveur) | Atterri ; voir C-4 (le code existant vend déjà) |

## 2. Constats

### C-1 — Haute — Paiement constaté après expiration : les deux diagrammes d'état se contredisent

- Diagramme de disponibilité : `disponible --> vendue : paiement constaté après expiration` (FR-13, AD-8).
- Diagramme de commande : `en_attente_paiement --> annulee : réservation annulée ou expirée`, et aucune transition ne sort de `annulee` vers `confirmee`.
- Conséquence : l'œuvre passe à `vendue` pour une commande `annulee`. Or c'est le deuxième cas de NFR-4, celui qu'AD-23 impose comme premier test. Le module `commandes` ne peut pas l'implémenter sans violer AD-9.
- **Correction :** l'expiration de la réservation ne doit pas annuler la commande. Elle reste `en_attente_paiement` jusqu'à une échéance d'abandon distincte, stockée selon AD-10. Si l'on préfère annuler à l'expiration, il faut ajouter la transition `annulee --> confirmee` sous condition d'AD-8. Dans les deux cas, AD-8 et le diagramme doivent le dire.

### C-2 — Haute — Jeton de suivi : seule l'empreinte est stockée, mais les e-mails sont envoyés plus tard

- AD-14 : « seule son empreinte SHA-256 est stockée » et il existe « un jeton de suivi par passage en caisse ». Les e-mails de chaque commande (confirmation, prise en charge, expédition, livraison) « y renvoient ».
- AD-11 : ces e-mails partent de façon asynchrone, depuis l'outbox ou le balayage, avec une charge utile limitée à des ids. Le gestionnaire ne connaît donc jamais le jeton en clair. Le même problème touche l'e-mail d'invitation.
- **Correction :** trancher dans AD-14. Option a : un nouveau jeton est émis à chaque e-mail, plusieurs jetons valides par passage, tous révoqués à la clôture. La phrase « un jeton par passage » devient alors « un *accès* de suivi par passage ». Option b : le jeton est chiffré et stocké, en plus de l'empreinte. Cette option doit être soumise au porteur, car elle s'écarte du memlog l.29.

### C-3 — Haute — Prix total par pays et pages publiques en cache : aucune règle ne dit où vit le pays

- AD-12 et AD-18 font du pays un « paramètre explicite » ; AD-21 met les pages publiques en cache, avec une revalidation de 60 s au plus. EXPERIENCE demande le prix livré sur chaque vignette et chaque fiche, un lien « Modifier » qui recalcule, le pays rappelé dans les filtres et « filtres, pays et unités dans l'URL ou mémorisés ».
- Selon l'endroit où l'on range le pays, le résultat diffère :
  - un cookie rend les pages dynamiques, ce qui contredit AD-21 et NFR-1 ;
  - un paramètre d'URL multiplie les variantes en cache ;
  - un calcul dans le navigateur expose toutes les offres et sort le calcul de la fonction unique d'AD-12.
- Deux epics (catalogue, panier) choisiront différemment.
- **Correction :** ajouter une règle qui fixe trois choses : où vit le pays choisi (par exemple un paramètre `?pays=` dans l'URL, plus un souvenir dans `localStorage`) ; comment la fiche en cache obtient le prix (par exemple les offres de l'œuvre servies avec la page, puis la fonction pure de `livraison` partagée entre serveur et navigateur) ; la valeur par défaut tant qu'OQ-13 est ouverte.

### C-4 — Haute — Le code existant vend déjà, hors de toutes les règles, et le spine ne dit pas quand il s'éteint

- Aujourd'hui, `src/app/galerie/[id]/ArtworkDetail.tsx` affiche « Ajouter au panier ». `src/app/api/checkout/route.ts` ouvre une session Stripe sans réservation (vérification de `available` puis paiement : la double vente reste possible). `src/app/api/webhooks/stripe/route.ts` passe `available=false` sans condition. `src/app/confirmation/page.tsx` appelle `getStripe()`.
- AD-1 tolère ces fichiers sur la liste d'exceptions Prisma, et ils ne seront repris « qu'au fil des epics ». AD-17 ne vise que les fonctions de `commandes`. Au Lot 1, l'ancien tunnel reste donc ouvert : il contredit AD-7, AD-17, EXPERIENCE (« Acheter » absent au Lot 1) et decisions-porteur.md l.73-74 (« ne convient plus tel quel »).
- AD-4 interdit tout nom de prestataire hors des adaptateurs, mais n'a pas de liste d'exceptions pour `src/lib/stripe.ts`, `api/checkout` et `confirmation/page.tsx`.
- **Correction :** une règle explicite. Dès le premier epic du Lot 1, le bouton existant et `POST /api/checkout` sont soumis à l'interrupteur d'AD-17, ou retirés. Les usages Stripe existants rejoignent une liste d'exceptions décroissante, comme pour AD-1.

### C-5 — Moyenne — Délai de priorité de « Me prévenir » (FR-9) : aucun mécanisme

- PRD FR-9 : « Les inscrits sont prévenus dans l'ordre d'inscription. Chacun dispose d'un court délai de priorité. » EXPERIENCE (e-mail « Me prévenir ») : « avec le délai de priorité ».
- AD-7 ne connaît que les origines `paiement` et `vente_assistee`. Pendant le délai de priorité, rien n'empêche un autre visiteur de réserver.
- **Correction :** soit ajouter une origine `priorite` à `Reservation`, posée par le balayage à l'expiration, avec une durée en réglage ; soit déclarer explicitement que la priorité n'est qu'un ordre d'envoi, sans blocage, et le faire valider par le porteur.

### C-6 — Moyenne — Vente assistée puis panier (UJ-4, étapes 5-6) : comment l'acheteur reprend sa propre réservation

- L'équipe réserve l'œuvre 48 h pour Thomas et lui envoie un lien qui « met l'œuvre dans son panier » ; Thomas ajoute ensuite une œuvre d'un autre artiste.
- AD-7 réserve par `WHERE disponibilite = 'disponible'`. Une œuvre déjà `reservee` pour Thomas fait donc échouer la réservation en bloc. Aucun usage de jeton (`suivi`, `invitation`, `desinscription`) ne correspond au « lien pour commander ». Rien ne dit comment le serveur reconnaît le bénéficiaire.
- Le diagramme de classes impose `PASSAGE_EN_CAISSE ||--o{ RESERVATION` : chaque réservation aurait un passage en caisse. Ce n'est pas le cas d'une réservation de vente assistée, posée avant tout passage.
- EXPERIENCE UXQ-2 pose déjà la question de l'affichage de deux échéances (48 h et 30 min) dans un même panier.
- **Correction :** ajouter un usage de jeton `commande_assistee`. Dans AD-7, la réservation en bloc accepte une œuvre `reservee` dont la réservation active a le même bénéficiaire, et la reprend. Dans le diagramme de classes, la cardinalité devient `|o--o{`. La réservation garde son échéance propre.

### C-7 — Moyenne — Disponibilité calculée à la lecture : le spine ne le dit pas pour `reservee`

- AD-7 libère paresseusement : la colonne reste `reservee` après l'échéance, jusqu'à la prochaine tentative. AD-10 dit que les états temporels se calculent à la lecture, mais n'y range pas « réservée expirée ». AD-21 n'invalide le cache qu'à une écriture, et une expiration n'écrit rien.
- Conséquence : la galerie (filtre « disponibilité »), la fiche (« Réservée » et « Me prévenir ») et l'espace artiste peuvent afficher « Réservée » longtemps après l'échéance si un epic lit la colonne brute.
- **Correction :** dans AD-10, ajouter que la disponibilité effective vaut `disponible` si la réservation active est échue, qu'elle est calculée par une fonction unique de `disponibilite` et traduite en requête pour la galerie. Préciser aussi que l'index partiel porte sur une issue stockée, jamais sur `now()`.

### C-8 — Moyenne — FR-34 « sans reconnexion » : le middleware existant l'empêche

- AD-15 dit : « Le rôle du JWT ne sert qu'au tri grossier des URL dans le middleware, ce qui satisfait FR-34 sans reconnexion. »
- Or `src/middleware.ts` (l.42-46) redirige vers `/dashboard` tout JWT dont le rôle n'est ni `artist` ni `admin`. Un `user` promu `artist` est donc refoulé de `/dashboard/artiste` tant qu'il ne se reconnecte pas. Le callback `jwt` de `src/auth.config.ts`, qui tourne en edge sans Prisma, ne peut pas relire le rôle.
- Le piège AGENTS.md (« le JWT garde l'ancien rôle : l'utilisateur doit se reconnecter ») reste vrai, et le spine ne le ratifie pas et ne le change pas non plus.
- **Correction :** choisir et écrire la règle. Option a : le middleware ne vérifie plus que la présence d'une session pour `/dashboard/**`, et le contrôle de rôle passe entièrement aux modules (AD-15). Option b : le callback `jwt` de `src/auth.ts`, qui tourne en Node, relit le rôle. Dans les deux cas, annoncer la mise à jour du piège AGENTS.md.

### C-9 — Moyenne — Diagramme des dépendances incomplet alors qu'AD-3 le rend normatif

- AD-3 : « un module n'appelle que les modules situés en aval dans le diagramme ». Cinq arêtes indispensables manquent :
  - `disponibilite --> reglages` : durées de 30 min et 48 h, plafond de réservations (AD-7) ;
  - `demandes --> acces` : jeton `desinscription` de « Me prévenir », dont `acces` est seul créateur (AD-14) ;
  - `notifications --> reglages` : numéro, horaires et délai WhatsApp à insérer dans chaque e-mail (OQ-7) ;
  - `UI --> reglages` (AD-17 : « L'interface … la consultent ») ;
  - `UI --> livraison` : saisie des zones par l'équipe, d'après AD-2.
- Un agent qui applique AD-3 à la lettre ne peut pas implémenter AD-7, AD-14 ni AD-17.
- **Correction :** ajouter ces arêtes. On peut aussi déclarer `reglages` et `acces` comme modules feuilles, appelables par tous.

### C-10 — Moyenne — Convention AGENTS.md « Order.artworkIds = slugs » amendée sans le dire

- AD-12 et la convention « Identifiants » font désigner l'œuvre par son id dans les commandes, avec un instantané du slug. C'est un **[ASSUMPTION]** dans le memlog (l.52, « À confirmer en relecture »), mais le spine l'énonce comme une règle ferme, sans balise.
- Le spine n'annonce pas non plus la mise à jour d'AGENTS.md (« Conventions that differ from defaults »), alors qu'il le fait pour la CI (AD-23) et Next 16.
- **Correction :** marquer `[ASSUMPTION]` dans AD-12, ou faire ratifier par le porteur, et ajouter : « AGENTS.md mis à jour dans l'epic qui migre `Order.artworkIds` (AD-20) ». Même remarque pour la propriété par champ d'AD-2 (memlog l.53, `[ASSUMPTION]` non repris).

### C-11 — Moyenne — AD-20 n'inventorie pas tout le modèle `Order` existant

- `prisma/schema.prisma` : `Order.amount Float`, `currency "eur"` (minuscules, alors qu'AD-5 impose ISO 4217), `status "paid"` (hors glossaire AD-9), `stripeSessionId` et `stripePaymentIntentId` (un nom de prestataire dans le modèle, contraire à AD-4), `userId` (contraire à AD-13, acheteur sans `User`).
- AD-20 ne cite qu'`Order.artworkIds`.
- **Correction :** étendre la liste d'AD-20 à `Order.amount`, `currency`, `status` et `stripe*`. Ces champs migrent vers `Paiement` et sa référence externe, sous la contrainte d'unicité d'AD-8. Pour `Order.userId`, préciser ce que deviennent les commandes historiques, ou dire qu'il n'y a rien à reprendre (données de démonstration, decisions-porteur.md l.42).

### C-12 — Basse — Retour en vente d'une œuvre retirée absent du diagramme

- EXPERIENCE (états côté artiste) : « Retirée → Remettre en vente : retour en curation `[ASSUMPTION]` ».
- Le diagramme de disponibilité termine sur `retiree --> [*]` : aucun chemin de retour.
- **Correction :** ajouter `retiree --> disponible` à la nouvelle publication (axe Publication remis à `en_curation` par `curation`), ou noter explicitement que c'est différé.

### C-13 — Basse — Commandes annulées sans paiement : elles ne se ferment jamais

- Diagramme de commande : `annulee --> close : remboursement effectué` est la seule sortie. Une commande annulée avant paiement n'a pas de remboursement, donc ne passe jamais `close`.
- AD-14 fait expirer le jeton « quand toutes ces commandes sont closes » : il ne s'éteint donc jamais.
- **Correction :** ajouter `annulee --> close : aucun paiement à rembourser`. On peut aussi faire expirer le jeton quand chaque commande est `close` ou `annulee` sans paiement.

### C-14 — Basse — Préparation OQ-6 : deux trous mineurs

- Les propriétés CSS logiques (DESIGN.md l.165 et l.224, « Do's and Don'ts ») ne figurent pas dans AD-18, alors que l'EXPERIENCE les range dans la préparation OQ-6.
- AD-5 calcule le format (petit, moyen, grand) et l'orientation « à l'affichage ». La galerie filtre pourtant sur ces critères (FR-17), donc le calcul doit aussi se traduire en requête, comme le prix.
- **Correction :** une phrase dans AD-18 sur les propriétés CSS logiques ; une phrase dans AD-5 : « calculés par une fonction unique, aussi traduite en requête ».

### C-15 — Basse — Conventions de code nouvelles, absentes des décisions et du memlog

- Plusieurs conventions n'apparaissent ni dans decisions-porteur.md ni dans le memlog d'architecture :
  - noms de modules et de fonctions en français sans accent, alors que le code existant est en anglais (`handleCheckoutCompleted`, `useCartStore`, `getStripe`) ;
  - forme `{ ok, code }` des résultats ;
  - `timestamptz` (AD-5), alors que Prisma `DateTime` produit `timestamp(3)` sans fuseau et que tout le schéma existant l'utilise ;
  - commission figée « à la confirmation » (AD-24), alors qu'AD-12 et le memlog l.35 figent tout « à la création ».
- **Correction :** journaliser ces conventions dans le memlog, ou les marquer `[ASSUMPTION]`. Aligner AD-24 sur AD-12, ou justifier la différence. Pour `timestamptz`, préciser « `@db.Timestamptz` pour les nouvelles colonnes, les anciennes migrées selon AD-20 », ou s'en tenir à « UTC ».

### C-16 — Basse — Couches : imports existants que la règle ESLint d'AD-1 bloquerait sans l'annoncer

- La table des couches autorise l'interface à importer `@/lib/<module>` (son `index.ts`), `src/lib/types` et `src/lib/i18n`, rien d'autre.
- Or `Header.tsx`, `ArtworkDetail.tsx`, `CartContent.tsx` et `CartClearer.tsx` importent `@/lib/store/cart`. D'autres composants importent `@/lib/utils/*` et `@/lib/cloudinary`.
- Le formulaire « Me notifier » de `public/maintenance.html` (FR-35, rattaché à `demandes`) est une page statique : il ne peut pas appeler une action serveur et a besoin d'un route handler. La convention « Mutations » réserve pourtant ces derniers aux appelants externes.
- **Correction :** ajouter `src/lib/store` et les utilitaires d'affichage à la colonne « Peut importer » ; ajouter « formulaire de la page de maintenance » aux exceptions de la convention « Mutations ».

### C-17 — Basse — Décisions du porteur prises en architecture mais absentes de decisions-porteur.md

- Le memlog d'architecture fait foi, et ces décisions y figurent bien : PostHog UE (OQ-9), Next.js 14.2.35 puis 16, Vitest et GitHub Actions, tarifs par œuvre (option C), un jeton par passage en caisse.
- decisions-porteur.md §4 reste vide (« Outil de mesure souhaité : … »), et son journal s'arrête au 2026-10-24.
- AGENTS.md (Policy) renvoie à decisions-porteur.md ou à « un document BMAD validé ». Or le spine est en `status: draft`.
- **Correction :** reporter ces décisions dans le journal de decisions-porteur.md à la validation du spine, ou passer le spine en `validated`.

## 3. Ce qui est ratifié correctement (brownfield)

Les points suivants sont soit conservés, soit modifiés avec annonce explicite :

- **Pile conservée, changements annoncés :**
  - la pile reste en place (Neon, Prisma, NextAuth, Cloudinary, Vercel), sans Supabase ;
  - Next.js 14.2.35 puis 16, avec `src/proxy.ts`, la mise à jour d'AGENTS.md et un retour arrière ;
  - Vitest et la CI, avec mise à jour d'AGENTS.md (« ni tests ni CI »).
- **Interdits d'AGENTS.md respectés :**
  - la maintenance et `robots.txt` restent pilotés par `MAINTENANCE_MODE` (AD-22) ;
  - `src/generated/prisma/` n'est jamais modifié ;
  - aucun nouvel usage de `src/data/*` ;
  - les secrets restent dans `.env.local` ;
  - les URL sont en français et les apostrophes JSX s'écrivent `&apos;` ;
  - les rôles restent `user` | `artist` | `admin`.
- **Paiement :**
  - le webhook reste idempotent, et la contrainte d'unicité d'AD-8 reprend l'upsert sur `stripeSessionId` ;
  - les prix sont relus en base (AD-12, conforme à `api/checkout`) ;
  - la frontière de paiement couvre OQ-1 et OQ-16 sans les trancher (AD-4).
- **Autres modifications annoncées :**
  - le middleware reste dans `src/` ;
  - `/panier` est retiré des routes protégées (AD-13), un changement explicite par rapport à `src/middleware.ts` l.7 ;
  - `src/lib/db` et `mappers.ts` sont repris par `catalogue` au fil des epics.
- **Constat :** il y a bien 22 fichiers qui importent Prisma hors de `src/lib/` (21 sous `src/app/`, plus `src/auth.ts`), ce qui correspond au memlog.

## 4. Diagrammes mermaid

Les blocs ont été validés avec `mermaid.parse` (mermaid 11.4.1, sous jsdom). Un contre-test avec un bloc volontairement faux est bien rejeté.

| # | Bloc (ligne du spine) | Syntaxe | Remarques de fond |
|---|---|---|---|
| 1 | `flowchart TD`, dépendances (l.57-85) | OK | Arêtes manquantes, voir C-9 |
| 2 | `erDiagram`, entités (l.317-340) | OK | `PASSAGE_EN_CAISSE ||--o{ RESERVATION` doit devenir `|o--o{` (C-6) ; aucun lien `COMMANDE`–`RESERVATION` alors qu'AD-8 raisonne « réservée pour cette réservation » ; `PAIEMENT` n'est relié qu'aux commandes (acceptable) ; `JETON` n'est relié qu'au passage en caisse (l'invitation et la désinscription n'apparaissent pas) |
| 3 | `stateDiagram-v2`, disponibilité (l.344-357) | OK | Pas de sortie depuis `retiree` (C-12) ; `[*] --> disponible : publication` mêle les deux axes d'AD-6 (à libeller « mise en vente ») |
| 4 | `stateDiagram-v2`, commande (l.361-376) | OK | Contradiction avec le paiement tardif (C-1) ; `annulee` sans paiement ne se ferme jamais (C-13) |
| 5 | `flowchart LR`, déploiement (l.380-391) | OK | `NEON[("…")]` (cylindre) et `PSP -- "notification" --> VER` sont valides |

Aucune ligne n'a une syntaxe suspecte. Les libellés accentués du `erDiagram` sans guillemets sont tous des mots simples (`expedie`, `bloque`…), et les libellés de plusieurs mots sont bien entre guillemets.

## 5. Corrections prioritaires (résumé)

1. **C-1 (Haute)** : aligner le diagramme de commande sur AD-8. L'expiration ne fait pas passer la commande à `annulee` ; ajouter une échéance d'abandon.
2. **C-2 (Haute)** : dans AD-14, choisir entre un jeton émis à chaque e-mail et un jeton chiffré, pour que les e-mails de l'outbox puissent contenir le lien de suivi et celui d'invitation.
3. **C-3 (Haute)** : ajouter une règle « pays choisi » qui fixe où il vit, comment la fiche en cache obtient le prix total, et la valeur par défaut tant qu'OQ-13 est ouverte.
4. **C-4 (Haute)** : soumettre dès le Lot 1 le bouton « Ajouter au panier » et `POST /api/checkout` existants à l'interrupteur d'AD-17, ou les retirer ; créer une liste d'exceptions Stripe dans AD-4.
5. **C-5, C-6 (Moyenne)** : ajouter le délai de priorité de FR-9 et la reprise d'une réservation de vente assistée dans AD-7.
6. **C-8, C-9, C-10, C-11 (Moyenne)** : FR-34 et le middleware, les arêtes du diagramme, l'`[ASSUMPTION]` sur les ids de commande avec la mise à jour d'AGENTS.md, et l'inventaire complet d'`Order` dans AD-20.
