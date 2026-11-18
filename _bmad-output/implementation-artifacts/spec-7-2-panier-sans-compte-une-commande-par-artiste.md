---
title: 'Story 7.2 — Panier sans compte, une commande par artiste'
type: 'feature'
created: '2026-11-18'
status: 'review'
baseline_commit: 'e2679c2'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-6-3-vente-assistee-reserver-et-envoyer-le-lien.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le panier actuel exige une connexion, stocke des prix dans le navigateur, additionne le total dans le composant et envoie au paiement un seul lot, alors qu'un acheteur de deux artistes recevra deux colis (FR-10, FR-11, AD-13, UJ-4).

**Approach:**
- `/panier` devient public (hors des routes protégées) ; le navigateur ne garde que des slugs (nouvelle clé de stockage, anciennes données de prix ignorées).
- Le serveur recompose le panier pour le pays choisi : une carte numérotée par artiste (œuvres, livraison, sous-total, délai, ville d'expédition) et le total général en clair, avec la mention des droits et taxes d'import ; les montants viennent de `livraison`, jamais du navigateur.
- États : changement de pays recalculé et annoncé, œuvre devenue indisponible (« Vendue entre-temps — retirée de votre commande. », trois œuvres proches du même artiste), panier vide, erreur de recalcul avec « Réessayer ».

## Boundaries & Constraints

**Always:**
- Décision 1A : l'entrée des œuvres d'un lien de vente assistée dans le panier est livrée par la 7.3 (« Continuer » crée ou reprend le passage et la réservation) ; ici, le panier ne porte que des slugs.
- Décision 2A : `/panier` est public et visible même Lot 2 fermé ; « Continuer » n'apparaît que si `lot2Ouvert()` est vrai et mène à `/commande/coordonnees` (livré par la 7.3).
- Montants, frais, délais et totaux lus et calculés côté serveur par le module `livraison` ; aucun composant ni module hors `livraison` n'additionne prix et frais (un test scanne `src/`) ; tout prix total porte « Droits et taxes d'import éventuels non inclus » (`fr.livraison`).
- Le pays vient du cookie `pays` (`lirePays`), jamais d'un paramètre du navigateur ; le panier du navigateur ne contient que des slugs, plafonnés et dédoublonnés, validés côté serveur.
- Aucun compte demandé ; textes dans `fr` (règle ESLint des textes visibles) ; formats par `i18n/formats` ; focus, cibles de 44 px et propriétés logiques du socle de l'Epic 3.
- `LOT2_OUVERT` reste lu seulement par `lot2Ouvert()` : le code ne l'ouvre jamais.

**Never:** création de passage en caisse, réservation, coordonnées ou paiement (7.3 à 7.5) ; pages légales (7.1) ; ouverture d'« Acheter » (7.8) ; suppression de `Order`, de `/api/checkout` ou du webhook Stripe (7.9, 7.5) ; `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Visiteur sans session | ouvre `/panier` | la page s'affiche, sans redirection de connexion | — |
| Deux artistes | slugs de deux artistes, pays livré | deux cartes numérotées, sous-totaux, délais, villes, total général « X € + Y € », bandeau « 2 colis séparés, 2 délais : … » | — |
| Changement de pays | autre pays | toutes les cartes et le total recalculés, annonce `aria-live` | pays non livré : ligne « non livrée » |
| Œuvre indisponible | vendue, réservée par un autre, retirée ou non visible | ligne « Vendue entre-temps — retirée de votre commande. », trois œuvres proches du même artiste, les autres commandes intactes | — |
| Panier vide | aucun slug | « Votre panier est vide. » et « Parcourir la galerie » | — |
| Recalcul en échec | erreur serveur | « Nous n'avons pas pu recalculer vos montants. Réessayer », panier conservé, montants masqués | — |
| Anciennes données | ancienne clé avec prix | prix ignorés, seuls les identifiants éventuellement repris | — |

</frozen-after-approval>

## Code Map

- `src/middleware.ts` -- retirer `/panier` de `PROTECTED` ; `src/app/panier/page.tsx` -- sans `auth()` ni redirection.
- `src/lib/store/cart.ts` -- store de slugs seulement (nouvelle clé, ancienne ignorée) ; consommateurs : `Header.tsx` (compteur), `galerie/[id]/ArtworkDetail.tsx` (ajout et retrait), `confirmation/CartClearer.tsx`.
- `src/lib/panier/` (nouveau, lecture seule) -- `composerPanier(slugs, pays)` : relit chaque œuvre (`catalogue`, `disponibilite` pour la disponibilité, `livraison` pour `prixLivre` et les sommes), regroupe par artiste, rend cartes, œuvres indisponibles et œuvres proches ; sommes dans une fonction pure de `livraison` ; ajouter le module à `MODULES_METIER` seulement s'il importe Prisma.
- `src/app/panier/` -- action serveur de recalcul, `CartContent.tsx` refait (cartes, bandeau, barre fixe « Continuer », « Continuer à parcourir », Conseil WhatsApp, `PaysLivraison`, `aria-live`), textes `fr.panier`, test navigateur.
- Ne pas modifier : `/api/checkout`, webhook Stripe, `Order`, `src/lib/commandes/`, états de commande.

## Tasks & Acceptance

**Execution:**
- [x] `/panier` public, store de slugs et consommateurs
- [x] module `panier` (`composerPanier`) et sommes dans `livraison`, tests (base réelle)
- [x] page, cartes, états, recalcul annoncé, barre fixe, textes `fr`, test navigateur, `AGENTS.md`

**Acceptance Criteria:**
- Given un visiteur sans session, when il ouvre `/panier`, then la page s'affiche.
- Given des œuvres de deux artistes, when le panier s'affiche, then une carte numérotée par artiste et le total général en clair sont calculés par le serveur pour le pays choisi.
- Given un changement de pays, when le recalcul a lieu, then toutes les cartes et le total changent et le changement est annoncé.
- Given une œuvre devenue indisponible, when le panier s'affiche, then sa ligne le dit avec trois œuvres proches et les autres commandes restent intactes.
- Given un panier vide ou une erreur de recalcul, when il s'affiche, then le message prévu apparaît et le panier est conservé.
- Given le code, when le test scanne `src/`, then aucun composant n'additionne prix et frais.

## Implementation Notes

- `/panier` retiré de `PROTECTED` (`src/middleware.ts`) ; page serveur sans `auth()`, pays par `lirePays`. Store `src/lib/store/cart.ts` : slugs seulement, clé `errancy-panier`, réhydratation filtrée par `nettoyerSlugs` ; `CartItem` réduit à `{ id }` pour que l'ancien `/api/checkout` (non modifié) compile. `Header`, `ArtworkDetail` (ajout par slug) et `CartClearer` adaptés.
- `src/lib/panier/` n'importe pas Prisma (passe par `catalogue` et `livraison`) : pas ajouté à `MODULES_METIER`. Sommes ajoutées à `livraison/prix.ts` (`sommerPrixLivres`, `prixSansFrais`), exportées par `livraison`.
- Recalcul par action serveur `recalculerPanier` (cookie `pays`) appelée par `CartContent` (client) ; le changement de pays passe par `PaysLivraison` (refresh de la page, `pays.code` en dépendance de l'effet).
- Décision 2A respectée : la barre « Continuer » (vers `/commande/coordonnees`, page de la 7.3) n'existe que si `lot2Ouvert()`. Décision 1A : aucun lien de vente assistée traité ici.
- Écart : la « ville d'expédition » de la carte n'est pas affichée, aucune donnée ne la porte (pas de valeur inventée) ; à trancher avec le porteur.
- Aucun fichier retiré de `eslint/exceptions-textes.cjs` ni de `tests/exceptions-interface.cjs` (seul `ArtworkDetail.tsx` y figure, toujours non refait) ; `src/app/panier/**/*.tsx` ajouté à `SURFACES_TEXTES`.
- Après relectures : reprise des seuls slugs de l'ancienne clé, annonces stables, bouton « Continuer » désactivé accessible, proches une fois par artiste, monnaies mêlées, plafond signalé à l'ajout. Aucune migration.

## Spec Change Log

## Review Triage Log

Passe 1 (trois relecteurs : aveugle, cas limites, lacunes de vérification).

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Retrait de la dernière œuvre non annoncé, focus perdu (région `aria-live` démontée) | medium | patch | Région et zone de focus stables dans toutes les branches ; test navigateur. |
| « Réessayer » sans retour après un premier échec | medium | patch | « Recalcul… », bouton désactivé, nouvel échec annoncé ; test. |
| Bandeau « N colis » comptant des cartes non livrées (« 0 jour ») et périmé pendant le recalcul | medium | patch | Seules les cartes livrées comptent, bandeau masqué pendant le recalcul. |
| Ajout depuis la fiche : « Ajouté ! » malgré le plafond | low | patch | Retour de `addItem` lu, message de plafond annoncé. |
| Monnaies mêlées : message faux, « Continuer » bloqué sans explication | low | patch | Message dédié et test. |
| Œuvres proches dupliquées et lues une fois par œuvre indisponible | low | patch | Une lecture et un affichage par artiste. |
| Ancien panier perdu sans reprise des identifiants (matrice I/O) | medium | patch | Slugs de `errancy-cart` repris, prix jamais, ancienne clé supprimée. |
| « Continuer » inactif en `span aria-disabled` | low | patch | `button disabled` avec `aria-describedby`. |
| Clé `livraisonOffertePar` morte ; ligne d'`AGENTS.md` sur le chemin d'achat local devenue fausse ; tests manquants | low | patch | Clé supprimée, ligne corrigée, neuf tests navigateur et quatre tests en base ajoutés. |
| Ville d'expédition promise par la spec mais sans donnée en base | medium | defer | Aucune colonne ne la porte : ajout = migration, décision du porteur ; consigné dans `AGENTS.md`. |
| `/commande/coordonnees` absente (page de la 7.3) | medium | defer | Décision 2A : « Continuer » n'existe que Lot 2 ouvert ; limite documentée. |
| `recalculerPanier` public, sans limite de débit | medium | defer | Plafond de 20 slugs, lectures mutualisées ; limite par IP avec AQ-2 / Epic 7. |
| Œuvres indisponibles restant dans le store ; compteur de l'en-tête | low | defer | À exclure par la 7.3. |
| « Vendue entre-temps » pour réservée, retirée ou non visible | low | rejet | Texte figé par la spec. |
| Cache de 60 s de `getArtworkBySlug` | low | rejet | Politique du projet (acceptée le 2026-11-06) ; la 7.3 relit sous verrou. |
| Annonce par œuvre indisponible, sélecteur de pays en état d'erreur, test de rendu de page, scan `src/` jugé faible | low | rejet | Aucun dommage nommé ; scan existant conservé. |

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Aucune migration. Ouvrir `/panier` en préversion sans compte (le Lot 2 reste fermé).
