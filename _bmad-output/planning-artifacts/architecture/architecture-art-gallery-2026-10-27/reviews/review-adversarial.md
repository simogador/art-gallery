---
type: review
lens: adversarial (paires d'unités incompatibles)
target: ../ARCHITECTURE-SPINE.md
reviewed: '2026-10-27'
sources:
  - ../ARCHITECTURE-SPINE.md
  - ../.memlog.md
  - ../../../prds/prd-art-gallery-2026-10-24/prd.md
  - ../../../ux-designs/ux-art-gallery-2026-10-26/EXPERIENCE.md
  - ../../../../../src/app/api/webhooks/stripe/route.ts
  - ../../../../../prisma/schema.prisma
constraints: 'OQ-1 et OQ-16 non tranchées ; aucun changement de pile'
---

# Relecture adversariale — Architecture Spine Errancy

## Verdict

Le spine ferme bien les grands risques de structure (propriété des données, deux axes d'état, réservation conditionnelle, outbox, frontière de paiement), mais **le chemin « paiement constaté → confirmation » reste assez flou pour que deux agents, en respectant chaque AD à la lettre, produisent une double confirmation, un remboursement à tort ou une commande coincée**. Les trous les plus graves touchent la clé d'idempotence, la portée et le rattachement de la réservation, l'état d'une commande qu'on ne peut plus honorer, et les remboursements partiels sur un paiement qui couvre plusieurs commandes. Viennent ensuite des fuites de données personnelles (jeton dans l'URL, acteur « système » non défini) et un journal d'événements dont le déclenchement sur Vercel n'est pas fixé. Aucun de ces trous ne demande de trancher OQ-1 ou OQ-16, ni de changer de pile : il faut resserrer des AD existantes ou en ajouter quelques-unes.

**Méthode.** Chaque trou est décrit par une paire d'unités (stories ou epics) que construisent deux agents différents. Chacune respecte les AD citées, et pourtant elles ne s'emboîtent pas. Pour chaque trou, la gravité est donnée (Critique / Haute / Moyenne / Basse), avec l'AD nouvelle ou resserrée qui le fermerait.

## Synthèse des trous prioritaires

| # | Trou | Gravité | Correction (résumé) |
|---|---|---|---|
| T1 | Idempotence sur une « référence externe » ambiguë, possédée par deux modules et atteinte par deux chemins | Critique | Idempotence sur l'id du `Paiement` (transition conditionnelle `ouvert → constate` dans `paiement`) et un seul point d'entrée synchrone, `commandes.traiterPaiementConstate(fait, tx)` |
| T2 | Commande impossible à honorer : état final non défini, course avec l'annulation asynchrone, confirmation sans mise à jour conditionnelle | Critique | Non honorable ⇒ `annulee` + remboursement de l'allocation ; gestionnaire `ReservationAnnulee` sans effet hors `en_attente_paiement` ; confirmation par `UPDATE … WHERE` avec contrôle du nombre de lignes, plus un index unique « une vente par œuvre » |
| T3 | Portée et rattachement de la réservation : par commande ou par passage ; bénéficiaire non défini ; vente assistée sans lien de commande | Haute | Réservation en bloc **par passage en caisse** ; `Reservation.passageEnCaisseId` obligatoire ; la confirmation accepte toute réservation de ce passage ; nouvel usage de jeton `commande` pour la vente assistée |
| T4 | Disponibilité « effective » non définie avec la libération paresseuse : filtres, fiches et confirmation divergent ; une œuvre non publiée peut être réservée | Haute | `disponibilite` exporte un prédicat unique (fragment Prisma/SQL) de disponibilité effective, qui inclut `publiee` et l'échéance ; le catalogue et la confirmation l'utilisent |
| T5 | Remboursement partiel et paiement multi-commandes : montants, plafonds, somme due, transitions d'œuvre manquantes, commande `annulee` sans paiement jamais close | Haute | Le remboursement référence (Paiement, Commande), avec somme ≤ allocation sous contrainte ; somme due recalculée à la clôture à partir des remboursements effectués ; transitions `vendue → disponible/retiree` ; `annulee` sans encaissement ⇒ `close` |
| T6 | Données personnelles et autorisation : acteur « système » des notifications, jeton dans l'URL (mesure, journaux, Referer), bénéficiaire de la réservation, expiration du jeton qui crée un cycle | Haute | Acteur `systeme` restreint par gabarit, avec AD-16 appliquée par destinataire ; échange jeton → cookie puis redirection, pages à jeton exclues de la mesure ; aucune coordonnée hors `commandes`/`demandes` |
| T7 | Outbox : « juste après la réponse » non défini sur Vercel ; concurrence entre répartition et balayage ; catalogue d'événements non fixé ; invalidation du cache après validation | Moyenne à haute | Catalogue typé unique des événements ; réclamation atomique (événement, gestionnaire) ; mécanisme de répartition nommé (`waitUntil`) et e-mails critiques à moins d'une minute, quel que soit AQ-2 ; invalidation par gestionnaire d'événement |

---

## T1 — Idempotence de la confirmation : quelle référence, qui la possède, par quel chemin ? (Critique)

### Paire 1.a — deux notifications d'un même paiement, deux références

- **Story A, « Adaptateur stripe-checkout ».** Elle reprend le code existant (`src/app/api/webhooks/stripe/route.ts`), qui traite à la fois `checkout.session.completed` et `payment_intent.succeeded` (repli). Conformément à AD-4, chaque notification est traduite en un fait « paiement constaté ». La référence externe vaut `cs_…` pour la première et `pi_…` pour la seconde, puisque chaque objet a son propre id.
- **Story B, « Confirmation idempotente » (AD-8).** Elle enregistre la référence externe sous contrainte d'unicité.
- **Incompatibilité.** Les deux références sont différentes, donc le second fait n'est pas un doublon. Au second passage, l'œuvre est déjà `vendue`, si bien que pour AD-8 elle n'est « ni `reservee` pour cette réservation, ni `disponible` ». Résultat : un remboursement `demandé` et un incident SM-C1 sur une vente légitime, qui faussent la métrique garde-fou.

### Paire 1.b — constat manuel puis notification du prestataire

- **Story A, « Constat manuel » (FR-13, FR-26).** L'équipe saisit une référence libre (« VIR 12/10 ») pour un lien de paiement.
- **Story B, adaptateur « lien de paiement ».** Ajouté plus tard selon OQ-1, il reçoit la notification du même paiement avec la référence du prestataire.
- **Incompatibilité.** Mêmes effets que dans la paire 1.a. À l'inverse, deux virements distincts saisis avec la même référence humaine bloquent à tort le second.

### Paire 1.c — deux propriétaires de la référence et deux chemins

- **Story A, epic paiement.** AD-2 donne `Paiement` à `paiement`. L'adaptateur `constat-manuel` écrit donc `Paiement.reference` et `Paiement.etat = constate`. Comme `paiement` ne peut pas appeler `commandes`, qui est en amont (AD-3), il écrit l'événement `PaiementConstate`, auquel `commandes` s'abonne.
- **Story B, epic commandes.** Selon AD-8, « `commandes` enregistre d'abord la référence externe sous une contrainte d'unicité ». Elle crée donc sa propre table de références et attend un appel synchrone depuis le route handler.
- **Incompatibilité.** La même donnée a deux propriétaires et deux contraintes d'unicité. Le chemin manuel est asynchrone tandis que celui du webhook est synchrone, ce qui contredit « exactement le même chemin ». De plus, `PaiementConstate` figure parmi les exemples de noms d'événements sans qu'il soit dit s'il **déclenche** la confirmation ou s'il **la relate**.

### Correction proposée

> **AD-8 resserrée.** La clé d'idempotence est l'**id du `Paiement`** créé à l'ouverture. `paiement.enregistrerConstat(fait, tx)` fait passer le paiement de `ouvert` à `constate` par une mise à jour conditionnelle et renvoie `deja_constate` si aucune ligne n'a changé. La référence externe est unique par `(source, reference)` et sert seulement à retrouver le `Paiement`. Elle n'est jamais une clé de dédoublonnage entre sources différentes.
> **AD-4 resserrée.** Il y a un seul point d'entrée : `commandes.traiterPaiementConstate(fait, tx)`. Le route handler de notification et l'action du constat manuel l'appellent tous les deux, de façon synchrone. `PaiementConstate` est un événement qui relate un fait déjà accompli, jamais un déclencheur. Chaque adaptateur doit retrouver le `Paiement` à partir de **chacune** de ses notifications.

---

## T2 — La commande qu'on ne peut plus honorer (Critique)

### Paire 2.a — « vendue ailleurs » pendant le paiement : course entre l'outbox et le webhook

- **Story A, « Vendue ailleurs » (AD-7).** Elle annule la réservation et écrit `ReservationAnnulee`. Le gestionnaire de `commandes` (AD-3, AD-11) fait ensuite passer la commande de `en_attente_paiement` à `annulee`. Cela se produit « juste après la réponse », voire seulement au balayage.
- **Story B, « Confirmation » (AD-8).** Le paiement arrive entre-temps. L'œuvre est `vendue_ailleurs`, donc la commande « ne peut pas être honorée » et un remboursement est créé. AD-8 ne dit pas **dans quel état** passe la commande : l'agent B la laisse en `en_attente_paiement`, ou la passe en `confirmee` avec un remboursement en cours.
- **Incompatibilité.** Si B a choisi `confirmee`, le gestionnaire de A, qui arrive ensuite, tente `en_attente_paiement → annulee`, obtient `transition_interdite` et finit en erreur, puis le balayage le rejoue indéfiniment. Si A passe avant B, la commande est déjà `annulee` au moment où B veut la confirmer : soit B lève `transition_interdite` **avant** de créer le remboursement, et l'acheteur est débité sans remboursement ; soit B lève l'erreur après l'avoir créé, et la transaction est annulée en entier.

### Paire 2.b — deux paiements tardifs sur la même œuvre

- **Story A, « Confirmation » (AD-8).** Elle lit l'œuvre (`disponible`), puis écrit `vendue`. AD-8 n'impose pas de mise à jour conditionnelle : seule AD-7 le fait, et pour la réservation.
- **Story B, « Paiement après expiration » (test NFR-4).** Le test ne vérifie qu'un seul retardataire.
- **Incompatibilité.** Deux acheteurs dont la réservation a expiré paient presque en même temps. Les deux lisent `disponible` et les deux confirment : c'est une **double vente**. Aucun index n'interdit deux lignes confirmées sur la même œuvre, puisque l'index partiel ne porte que sur `Reservation`.

### Paire 2.c — paiement en retard sur une commande déjà annulée par expiration

- **Story A, gestionnaire d'expiration.** Il fait passer la commande de `en_attente_paiement` à `annulee` (« réservation annulée ou expirée », diagramme des états).
- **Story B, confirmation.** Le paiement arrive à T+40 min et l'œuvre est encore `disponible`. FR-13 dit qu'elle doit être vendue à cet acheteur, mais le diagramme ne prévoit pas `annulee → confirmee`.
- **Incompatibilité.** L'agent B ajoute la transition `annulee → confirmee` dans la table d'AD-9, ou bien il rembourse. Deux epics obtiennent deux comportements opposés sur le cas n° 2 de NFR-4.

### Correction proposée

> **AD-8 resserrée.** Pour chaque commande couverte, la confirmation fait passer les œuvres en `vendue` par `UPDATE … WHERE disponibilite IN ('disponible') OR (disponibilite='reservee' AND reservation du même passage)` et vérifie le nombre de lignes modifiées : c'est tout ou rien **par commande**. En cas de succès, la commande passe en `confirmee` depuis `en_attente_paiement` **ou depuis `annulee` pour motif d'expiration** (transition ajoutée à AD-9). En cas d'échec, la commande passe ou reste en `annulee`, avec le motif `non_honorable`, l'allocation est enregistrée, un remboursement de l'allocation est créé à l'état `demandé` et un incident SM-C1 est ouvert, le tout dans la même transaction.
> **Nouvelle règle d'AD-7.** Un index unique partiel « une seule ligne de commande vendue par œuvre » complète celui des réservations.
> **AD-3 resserrée.** Tout gestionnaire qui réagit à un événement de disponibilité est sans effet si l'entité n'est plus dans l'état source attendu. Il renvoie `ok`, pas une erreur à rejouer.

---

## T3 — Portée et rattachement de la réservation (Haute)

### Paire 3.a — « en bloc » par commande ou par panier ?

- **Story A, « Réservation » (AD-7).** Elle suit la lettre d'AD-7 (« toutes les œuvres de **la commande** ») et ouvre une transaction par commande, donc par artiste.
- **Story B, « Panier multi-artistes ».** Elle suit EXPERIENCE.md (« si une œuvre **du panier** n'est plus disponible, aucune n'est réservée »).
- **Incompatibilité.** Avec un paiement unique (variante OQ-16), A peut réserver la commande 1 et refuser la commande 2. Le paiement unique est alors ouvert pour un passage à moitié réservé, et B affiche l'inverse de ce qui s'est produit. Le PRD (FR-12, « commande ») et la spec UX (« panier ») divergent eux aussi : le spine aurait dû lever l'ambiguïté.

### Paire 3.b — « pour cette réservation » : laquelle ?

- **Story A, « Réservation ».** `Reservation.beneficiaire` est un e-mail, puisque AD-7 parle de « bénéficiaire » sans dire de quoi il s'agit.
- **Story B, « Récapitulatif » (UX : « Continuer tente une nouvelle réservation » après l'échéance).** Elle crée une **nouvelle** réservation pour le même passage. Le paiement ouvert sur la première réservation reste valide chez le prestataire.
- **Incompatibilité.** À la confirmation, « `reservee` pour cette réservation » compare l'id de réservation porté par le paiement à l'id de la réservation active. Ils diffèrent, si bien que l'acheteur est remboursé alors qu'il détient la réservation active.

### Paire 3.c — vente assistée (UJ-4, OQ-12) puis lien de commande

- **Story A, « Réservation par l'équipe » (FR-26).** Elle crée une `Reservation` d'origine `vente_assistee`, de 48 h, au bénéfice de Thomas. AD-13 dit que le passage en caisse « est créé quand la réservation commence », mais l'agent A ne le crée pas, faute d'adresse.
- **Story B, « Tunnel de commande ».** Thomas suit « le lien pour commander » : un nouveau passage tente de réserver une œuvre déjà `reservee`, par l'équipe, et obtient `oeuvre_indisponible`. Thomas est bloqué par sa propre réservation. De plus, AD-14 ne connaît pas d'usage de jeton pour ce lien (`suivi`, `invitation`, `desinscription` seulement) : un agent mettra le slug en clair dans l'URL, un autre inventera un usage hors liste.

### Correction proposée

> **AD-7 resserrée.** La réservation se fait en bloc **par passage en caisse**, dans une seule transaction pour toutes ses œuvres. Cela satisfait la lettre de FR-12 et celle de l'UX. Toute `Reservation` porte un `passageEnCaisseId` obligatoire et ne contient jamais de coordonnées. La vente assistée crée d'abord le passage (avec les coordonnées connues), puis la réservation. La confirmation accepte **toute réservation active ou échue du même passage**, sans comparer un id de réservation.
> **AD-14 resserrée.** Ajouter l'usage `commande` : un jeton donne accès à un passage existant, pour la vente assistée. Le tunnel reprend ce passage au lieu d'en créer un nouveau.

---

## T4 — Disponibilité effective et libération paresseuse (Haute)

### Paire 4.a — filtre de la galerie et fiche

- **Story A, « Galerie et filtres » (`catalogue`).** Par souci de performance, la requête filtre `WHERE disponibilite = 'disponible'`. Elle lit la colonne, ce qu'autorise « lectures publiques par `catalogue` ».
- **Story B, « Fiche œuvre ».** Elle applique AD-10 : une réservation échue se calcule à la lecture et l'œuvre s'affiche « Disponible ».
- **Incompatibilité.** Avec la libération paresseuse d'AD-7, la colonne garde la valeur `reservee` jusqu'à la tentative de réservation suivante. L'œuvre est donc absente de la galerie mais achetable sur sa fiche. L'écran artiste continue d'afficher « Un acheteur est en train de payer », et « Me prévenir » reste proposé.

### Paire 4.b — confirmation d'un retardataire face à une réservation échue d'un tiers

- **Story A, « Confirmation ».** La colonne vaut `reservee`, au profit d'un autre passage dont la réservation a expiré mais n'a pas été libérée. L'œuvre n'est « ni réservée pour cette réservation, ni disponible » : l'acheteur est remboursé et un incident SM-C1 est ouvert.
- **Story B, « Réservation ».** Elle aurait libéré cette réservation et vendu l'œuvre.
- **Incompatibilité.** L'issue dépend de l'ordre des requêtes, et non de la règle FR-13 (« l'œuvre encore disponible est vendue à cet acheteur »).

### Paire 4.c — œuvre non publiée réservable

- **Story A, « Dépôt » (`curation`).** Elle crée l'œuvre avec la valeur par défaut de la colonne, `disponible`, car le schéma demande une valeur et AD-6 ne précise pas l'état de disponibilité d'un brouillon.
- **Story B, « Réservation ».** La condition d'AD-7 ne porte que sur `disponibilite = 'disponible'`.
- **Incompatibilité.** Un slug de brouillon ou d'œuvre `en_curation` injecté dans le panier (les slugs viennent du navigateur, AD-13) est réservé puis vendu.

### Correction proposée

> **Nouvelle AD-7 bis.** `disponibilite` exporte **un seul** prédicat de disponibilité effective, sous la forme d'un fragment `where` Prisma ou d'une vue SQL : `publication = 'publiee' AND (disponibilite = 'disponible' OR (disponibilite = 'reservee' AND réservation active échue))`. La réservation, la confirmation, le catalogue et ses filtres l'utilisent tous. Lire la colonne brute est interdit hors de `disponibilite`. Une œuvre n'a pas d'état de disponibilité (`NULL`) avant sa première publication.

---

## T5 — Remboursements, paiement multi-commandes et somme due (Haute)

### Paire 5.a — remboursement d'une commande sur un paiement unique

- **Story A, « Remboursement » (`commandes`).** `Remboursement` est rattaché à la `Commande` (diagramme des entités) et son montant vaut le total de la commande.
- **Story B, port Remboursement (`paiement`).** Un remboursement s'exécute sur un **paiement**, ce qui est commun à tous les prestataires.
- **Incompatibilité.** B ne sait pas à quel paiement rattacher le remboursement quand une commande a plusieurs allocations, par exemple après un premier paiement échoué puis un second. Deux administrateurs qui remboursent en même temps la commande 1 et la commande 2 d'un paiement unique peuvent, en l'absence de plafond, rembourser plus que le montant encaissé.

### Paire 5.b — remboursement partiel et somme due figée

- **Story A, « Somme due » (AD-24).** Elle est figée à la confirmation, puis passe `à verser` à la clôture.
- **Story B, « Réclamation » (FR-30, FR-31).** L'équipe accorde un remboursement **partiel**, par exemple pour un cadre abîmé ou des frais de livraison. La commande va ensuite jusqu'à `close`.
- **Incompatibilité.** La somme due reste celle de la confirmation et l'artiste reçoit la totalité, alors qu'Errancy a remboursé une partie. Pour une commande `retournee`, A peut quand même la passer `à verser`, puisque `retournee → close` mène à la clôture, qui rend la somme exigible.

### Paire 5.c — l'œuvre d'une commande annulée ou retournée

- **Story A, « Annulation avec motif » (FR-26).** Elle fait passer la commande de `confirmee` à `annulee`. L'œuvre est `vendue` et le diagramme de disponibilité ne connaît aucune sortie depuis `vendue`.
- **Story B, « Retour accepté » (FR-30).** Elle ajoute de son côté une fonction `remettreEnVente` dans `disponibilite`, qui passe l'œuvre en `disponible`, tandis que A la laisse `vendue`.
- **Incompatibilité.** Les deux chemins se concurrencent sur l'axe Disponibilité, et l'œuvre réapparaît, ou non, sans passer par la curation, alors que la spec UX prévoit « retour en curation » pour une œuvre retirée.

### Paire 5.d — commande annulée sans encaissement

- **Story A, « Expiration »** et **Story B, « Clôture » (FR-33 : « `annulee` est close une fois le remboursement effectué »).** Une commande annulée avant tout paiement n'a jamais de remboursement.
- **Incompatibilité.** La commande ne devient jamais `close`. Le jeton de suivi, qui « expire quand toutes les commandes sont closes » (AD-14), reste donc actif sans limite, avec les coordonnées de l'acheteur derrière lui.

### Correction proposée

> **AD-4 resserrée.** Un `Remboursement` référence `(paiementId, commandeId)` et porte un montant en centimes. Une contrainte ou une vérification transactionnelle garantit que la somme des remboursements est inférieure ou égale à l'allocation, par commande et par paiement.
> **AD-24 resserrée.** Le **taux et l'assiette** sont figés à la confirmation, mais le **montant** dû est recalculé par la fonction unique à la clôture, en déduisant les remboursements `effectué`. Une commande `annulee` ou `retournee` ne produit aucune somme `à verser`.
> **AD-6 et AD-9 resserrées.** Ajouter `vendue → retiree` (annulation ou retour), posée par `disponibilite` à l'appel de `commandes`. Une remise en vente repasse par la curation. Une commande `annulee` sans montant encaissé passe en `close` dans la même transaction.

---

## T6 — Données personnelles et autorisation (Haute)

### Paire 6.a — l'acteur des notifications

- **Story A, « E-mail nouvelle commande à l'artiste ».** Le gestionnaire déclaré dans `abonnements.ts` lit la commande par `commandes`, ce qui exige un acteur (AD-15). L'agent A crée un acteur `systeme` qui a tous les droits. Le gabarit reprend l'adresse de l'acheteur dès l'état `confirmee`.
- **Story B, « Écran artiste ».** Elle applique AD-16 (adresse seulement en `prise_en_charge` ou `expediee`).
- **Incompatibilité.** AD-15 énumère quatre acteurs sans acteur système, et AD-16 ne filtre que l'acteur `artist`. L'e-mail contourne donc la règle que l'écran respecte. De plus, `notifications` ne dépend pas de `commandes` (diagramme) et la charge utile ne contient aucune donnée personnelle : rien ne dit qui fournit l'e-mail du destinataire.

### Paire 6.b — jeton de suivi dans l'URL et mesure

- **Story A, « Suivi par lien ».** Elle sert la page `/suivi/[jeton]`, conformément à AD-14 et à l'UX.
- **Story B, « Mesure » (AD-19).** Elle installe PostHog avec la vue de page standard. Les événements FR-27 ne portent que le slug et la source, mais l'URL courante, le référent et le chemin font partie des propriétés par défaut.
- **Incompatibilité.** Après consentement, le jeton, qui équivaut à un mot de passe, part chez un tiers. Il part aussi dans les journaux de requêtes Vercel, malgré la règle de journalisation, et dans l'en-tête `Referer` du lien WhatsApp ouvert depuis la page de suivi (FR-7).

### Paire 6.c — l'expiration du jeton crée un cycle

- **Story A, `acces`.** « Seul à vérifier les jetons », il doit savoir si toutes les commandes du passage sont closes, ce qui suppose d'appeler `commandes`. Or `commandes` est en amont de `acces`, ce qui crée un cycle.
- **Story B, `commandes`.** Elle écrit une échéance sur le jeton à la clôture, ce qui revient à écrire une donnée d'`acces` et viole AD-2.
- **Incompatibilité.** Deux agents prennent deux voies illégales, ou le jeton n'expire jamais.

### Paire 6.d — coordonnées dans la réservation et lien entre artiste et compte

- **Story A, « Vente assistée ».** Elle range le nom et l'e-mail de Thomas dans `Reservation.beneficiaire`, une donnée de `disponibilite`. L'écran artiste « Réservée », qui lit par `disponibilite`, l'affiche, et AD-16 n'y peut rien puisqu'elle ne s'applique qu'à `commandes`.
- **Story B, « Invitation artiste ».** `acces` écrit `Artist.userId` (une donnée de `curation`), tandis que l'epic curation écrit `User.artistId`.
- **Incompatibilité.** Les coordonnées sortent du seul module qui les filtre, et le lien entre compte et artiste, sur lequel repose tout contrôle « ses œuvres, ses commandes », a deux propriétaires.

### Paire 6.e — mesure côté serveur de « commande confirmée »

- **Story A, port Mesure côté serveur.** Elle envoie `commande_confirmee` depuis la confirmation, qui est appelée par le webhook. Le port « vérifie le consentement », mais côté serveur ce consentement n'existe pas : l'agent A considère que l'absence vaut accord.
- **Story B.** Elle ne l'envoie jamais, de sorte que SM-2 reste sans numérateur.

### Correction proposée

> **AD-15 resserrée.** Ajouter l'acteur `systeme(gabarit)`. Chaque gabarit d'e-mail déclare ses destinataires, et `commandes.donneesNotification(evenementId, destinataire)` applique AD-16 **par destinataire**. Les coordonnées d'un acheteur ne sortent que vers lui-même ou vers l'équipe.
> **AD-14 resserrée.** `/suivi/[jeton]` échange le jeton contre un cookie `httpOnly` limité au passage, puis redirige vers `/suivi/[numero]`. Les pages à jeton sont exclues de la mesure et servies avec `Referrer-Policy: no-referrer`. `acces` vérifie seulement l'empreinte, l'usage et l'échéance ; l'état « lien inactif » est calculé par `commandes`.
> **AD-2 resserrée.** Le lien entre User et Artiste appartient à `acces`. Les coordonnées n'existent que dans `commandes` (passage en caisse) et `demandes` ; `Reservation` ne porte que des ids. Le consentement à la mesure est enregistré sur le passage en caisse, et le port Mesure côté serveur ne part qu'avec lui.

---

## T7 — Journal d'événements : déclenchement, concurrence, catalogue, cache (Moyenne à haute)

### Paire 7.a — « juste après la réponse » sur Vercel

- **Story A, epic `evenements`.** Elle répartit avec `setTimeout` ou une promesse non attendue après `return`. Sur une fonction serverless Vercel, la fonction s'arrête : l'événement attend donc le balayage, **quotidien** sur le plan Hobby (AQ-2). Les e-mails de confirmation et l'alerte « nouvelle commande » partent avec jusqu'à 24 h de retard, alors que FR-22 prévoit une prise en charge sous 48 h.
- **Story B.** Elle répartit de façon synchrone avant la réponse, ce qui allonge le webhook et expose aux nouvelles tentatives du prestataire.

### Paire 7.b — répartition et balayage simultanés

- **Story A, répartition immédiate.** Elle suit le schéma « lire, envoyer l'e-mail, marquer l'événement traité ».
- **Story B, balayage.** Il prend les événements « non traités », y compris celui qui est en cours chez A.
- **Incompatibilité.** L'idempotence « par (événement, gestionnaire) » est respectée sur le papier, mais deux e-mails partent quand même.

### Paire 7.c — noms et charges utiles

- **Story A.** Elle émet `ReservationExpiree` lors de la libération paresseuse.
- **Story B.** Elle émet `ReservationAnnulee { motif: 'expiration' }` et `commandes` ne s'abonne qu'à `ReservationAnnulee`.
- **Incompatibilité.** Les commandes restent `en_attente_paiement`. Le même flou touche FR-9 : le balayage notifie « de nouveau disponible » une œuvre déjà réservée par un autre passage. Le « délai de priorité » est implémenté une fois comme une réservation d'une origine hors liste et une fois comme rien du tout.

### Paire 7.d — invalidation du cache (AD-21)

- **Story A.** `disponibilite` appelle `revalidateTag` dans sa fonction, alors qu'elle reçoit le client de transaction (AD-3) : l'invalidation a lieu **avant** la validation, et la page est régénérée à partir de l'ancien état.
- **Story B.** Elle attend que l'orchestrateur `commandes` invalide, mais celui-ci ne sait pas quelles pages sont concernées.
- **Incompatibilité.** Personne n'invalide au bon moment, et le délai de moins de 60 s de FR-21 ne tient qu'au filet de revalidation.

### Correction proposée

> **AD-11 resserrée.** Il y a un catalogue unique et typé, `src/lib/evenements/catalogue.ts` : une union discriminée qui donne le nom, la version, la charge utile en ids seulement et le producteur unique de chaque événement. Le gestionnaire réclame son travail par une insertion conditionnelle de `(evenementId, gestionnaire)` **avant** l'effet. La répartition immédiate passe par `waitUntil` (`@vercel/functions`) avec Next 14, puis par `after()` avec Next 16. Les e-mails transactionnels doivent partir en moins d'une minute, quelle que soit la réponse à AQ-2.
> **AD-21 resserrée.** L'invalidation du cache est un gestionnaire des événements `DisponibiliteChangee` et `PublicationChangee`, exécuté après la validation et jamais dans une fonction qui reçoit `tx`. FR-9 réagit à l'événement de libération, sous réserve que le prédicat d'AD-7 bis soit vrai au moment de l'envoi. Le délai de priorité est une règle d'envoi, pas une réservation.

---

## Trous secondaires (Moyenne / Basse)

| # | Paire incompatible | Gravité | AD proposée |
|---|---|---|---|
| S1 | Une story « Encaissement » ouvre une session de paiement dont la durée de validité dépasse la réservation de 30 min. Une story « Vendue ailleurs » annule la réservation, mais le port Encaissement n'a aucune opération pour fermer le paiement ouvert : l'acheteur est débité alors que FR-21 et UJ-2 disent « n'est pas débité ». | Moyenne | Le port Encaissement expose `annuler(paiementId)`, au mieux de ce que permet le prestataire. Un paiement s'ouvre avec une échéance inférieure ou égale à celle de la réservation quand l'adaptateur le permet ; sinon, le chemin du paiement tardif (T2) s'applique. |
| S2 | La confirmation d'une story accepte un fait dont le montant ou la devise ne correspond pas aux allocations (virement manuel incomplet), alors qu'une autre le refuse. | Moyenne | AD-8 : confirmation seulement si `montant = Σ allocations` et si la devise est identique. Sinon, incident et aucune confirmation. |
| S3 | Une story crée les commandes (et fige les prix, AD-12) au début de la réservation, une autre à l'ouverture du paiement. Entre les deux, l'artiste modifie son prix ou ses frais et les deux montants divergent. | Moyenne | AD-12 : commandes, lignes et allocations sont créées dans la transaction de réservation ; le paiement s'ouvre sur ces montants figés. |
| S4 | Rattachement FR-28 : `demandes` en est « propriétaire », mais `commandes` ne peut pas l'appeler, et une story écrit `Commande.demandeId`. Il y a deux propriétaires. | Moyenne | Table de rattachement possédée par `demandes`, remplie par un gestionnaire de `CommandeConfirmee` à partir de `Reservation.demandeId`. |
| S5 | La spec UX prévoit de « remettre en vente » une œuvre `retiree` (retour en curation), alors que le diagramme fait de `retiree` un état final. Elle autorise aussi « Annuler vendue ailleurs tant qu'aucune réservation acheteur n'existe », là où AD-7 dit « si elle n'a interrompu aucune réservation ». | Basse | Ajouter `retiree → disponible` (après curation) et aligner la condition sur « a interrompu une réservation ». |
| S6 | Le plafond de réservations « par e-mail ou par appareil » est contourné par des e-mails aléatoires : un robot bloque tout le catalogue 30 min par 30 min, surtout si UXQ-2 fait démarrer la réservation à l'affichage du panier. | Basse | Vérifier le plafond dans la transaction de réservation, avec une limite par IP en plus de l'e-mail et de l'appareil, sans trancher UXQ-2. |
| S7 | Le choix entre paiement unique et paiement par commande est « un réglage du module `paiement` », mais l'interface (enchaîner N paiements) et `commandes` (N allocations) doivent le lire. Une story le lit dans `reglages`, une autre l'infère du nombre de paiements. | Basse | Le réglage est exposé par une seule fonction de `paiement` (`modeEncaissement()`), lue par `commandes` et par l'interface. Cela ne tranche pas OQ-16. |

## Ce que le spine fait bien (à ne pas casser)

- La séparation en deux axes (AD-6) et la propriété exclusive de l'axe Disponibilité par `disponibilite`.
- La mise à jour conditionnelle avec l'index partiel (AD-7), et la règle selon laquelle la protection ne dépend jamais du balayage.
- La frontière de paiement en trois ports, avec l'adaptateur `constat-manuel` toujours présent : OQ-1, OQ-12 et OQ-16 restent ouvertes.
- Le panier qui ne garde que des slugs, et les montants toujours relus en base (AD-12, AD-13).
