---
title: 'Story 7.9 — Retrait de l''ancien modèle de commande'
type: 'chore'
created: '2026-11-19'
status: 'done'
baseline_commit: 'e7214fa30276030d78edc6dfd4bf2a8736761439'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md', '{project-root}/docs/migrations.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La table `Order` (`artworkIds` en CSV, `amount` en `Float`) et l'ancien chemin d'achat (`/api/checkout`, webhook Stripe) existent encore à côté du nouveau modèle (`PassageEnCaisse`, `Commande`, `Paiement`). Tant qu'ils restent, du code peut créer une commande sans réservation (AD-20, temps 4).

**Approach:** Supprimer la table `Order` par une migration commitée (appliquée par le porteur seulement, après sauvegarde et répétition sur une branche Neon), le code qui l'écrivait ou la lisait, et sa description dans `AGENTS.md`.

**Décisions du porteur (2026-11-19) :**
- 1A : tout le code Stripe est supprimé (`/api/checkout`, `/api/webhooks/stripe`, `src/lib/stripe.ts`, dépendance `stripe`) ; la 7.5 écrira son adaptateur sous `src/lib/paiement/adaptateurs/`.
- 2A : le chiffre d'affaires et les commandes récentes de `/dashboard/admin`, et les commandes de la fiche utilisateur, sont retirés (aucun chiffre remplacé).
- 3A : la période de vérification est jugée suffisante (comme pour la 2.10) ; la décision est consignée dans `docs/decisions-porteur.md`.

## Boundaries & Constraints

**Always:**
- La migration refuse de supprimer `"Order"` si elle contient des lignes (garde `RAISE EXCEPTION`) : le porteur lance d'abord `scripts/sql/recopier-anciennes-commandes.sql`.
- Aucune lecture ni écriture de `Order` ne reste dans `src/` ; `User.orders` disparaît avec la table.
- Le nouveau chemin (`/panier`, `/commande/*`, `/confirmation`, `/suivi`, ventes assistées, `traiterPaiementConstate`) n'est pas modifié.
- `lot2Ouvert()`, `MAINTENANCE_MODE`, `public/robots.txt` et `src/generated/prisma/` ne sont pas touchés ; aucun secret dans le code.
- Les tests qui prouvaient l'ancien chemin sont supprimés ou réécrits sur le nouveau modèle, jamais ignorés pour passer au vert.

**Never:** encaissement et choix du prestataire (7.5, OQ-1) ; ouverture du Lot 2 (7.8) ; migration appliquée par le code ou la CI ; `prisma db push` sur une base partagée ; suppression de commandes `historique` de `Commande`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| `Order` vide (production au 2026-11-11) | migration appliquée | table, index, clé étrangère vers `User` supprimés | — |
| `Order` non vide | migration appliquée | la migration échoue avant toute suppression, aucune donnée perdue | message : lancer d'abord la recopie |
| Ancien appel | `POST /api/checkout`, webhook Stripe | route absente (404), aucune écriture | — |
| Page d'administration | `/dashboard/admin`, fiche utilisateur | ne lit plus `Order` | selon la décision 2 |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` -- `model Order` (ligne 261) et la relation `User.orders` ; nouvelle migration `prisma/migrations/<horodatage>_suppression_order/migration.sql` (garde de lignes, `DROP TABLE "Order"`).
- `src/app/api/checkout/route.ts`, `src/app/api/webhooks/stripe/route.ts`, `src/lib/stripe.ts`, `package.json` (`stripe`) -- ancien chemin, selon la décision 1 ; `src/middleware.ts` (commentaire sur le webhook) et `src/lib/store/cart.ts` (`CartItem` n'existe que pour `/api/checkout`).
- `src/lib/disponibilite/index.ts` -- `marquerVendues` (et son commentaire « webhook Stripe ») n'a plus d'appelant en production : à garder tant que des tests l'utilisent, ou à retirer avec eux ; l'événement `DisponibiliteChangee` doit rester prouvé ailleurs.
- `src/app/dashboard/admin/page.tsx`, `src/app/dashboard/admin/utilisateurs/[id]/page.tsx` -- seuls lecteurs de `Order` hors webhook (décision 2).
- `scripts/sql/recopier-anciennes-commandes.sql`, `scripts/sql/vendues-sans-commande.sql` -- lisent `"Order"` : à garder jusqu'à l'application de la migration, puis à supprimer avec une mention dans `docs/migrations.md`.
- `src/lib/commandes/index.ts` (commentaire « Order reste lue et écrite »), `eslint/exceptions-prisma.cjs` (entrées du webhook, du tableau de bord et de la fiche utilisateur : la liste ne fait que diminuer).
- Tests : `tests/disponibilite.test.ts` (insertions dans `"Order"`), `tests/commandes.test.ts` (recopie), `tests/anciennes-colonnes.test.ts`, `tests/catalogue-reel.test.ts`, `tests/lot2.test.ts` (appels à `/api/checkout` et au webhook), `tests/acces-base.test.ts`, `tests/disponibilite-artiste.test.ts`, `tests/mesure.test.ts`.
- `AGENTS.md`, `docs/analyse-projet.md`, `docs/migrations.md`, `docs/decisions-porteur.md` -- retirer toute description d'`Order.artworkIds` ; section « Story 7.9 » de la migration (sauvegarde, répétition Neon, contrôles, retour arrière) ; décision 3 consignée.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma`, `prisma/migrations/20261122090000_suppression_order/migration.sql` -- supprimer `model Order` et `User.orders` ; migration avec garde (`DO $$ … RAISE EXCEPTION` si `"Order"` a des lignes) puis `DROP TABLE "Order"` -- AD-20 temps 4
- [x] `src/app/api/checkout/`, `src/app/api/webhooks/stripe/`, `src/lib/stripe.ts`, `package.json` + verrou, `src/lib/store/cart.ts` (`CartItem`), `src/middleware.ts` (commentaire) -- supprimer l'ancien chemin d'achat (1A)
- [x] `src/app/dashboard/admin/page.tsx`, `src/app/dashboard/admin/utilisateurs/[id]/page.tsx` -- retirer les lectures d'`Order` et les blocs qui en dépendent (2A), textes dans `fr` ; `src/lib/disponibilite/index.ts` -- `marquerVendues` et son commentaire selon l'usage restant (tests) ; `src/lib/commandes/index.ts` -- commentaire ; `eslint/exceptions-prisma.cjs` -- retirer les entrées devenues inutiles
- [x] `tests/` -- retirer ou réécrire sur le nouveau modèle ce qui prouvait l'ancien chemin (`lot2`, `catalogue-reel`, `anciennes-colonnes`, `disponibilite`, `commandes`, autres) ; un test vérifie que `src/` ne nomme plus `prisma.order`, `"Order"` ni `artworkIds` ; la garde de la migration est prouvée sur une base réelle (vide : supprime ; non vide : refuse)
- [x] `scripts/sql/recopier-anciennes-commandes.sql`, `scripts/sql/vendues-sans-commande.sql` -- supprimer (ils lisent `"Order"`) ; `docs/migrations.md` -- section « Story 7.9 » (empreinte, sauvegarde, répétition Neon, recompte avant, contrôles, retour arrière : restaurer la branche de sauvegarde) ; `AGENTS.md`, `docs/analyse-projet.md` -- retirer `Order.artworkIds` et le paiement Stripe actuel ; `docs/decisions-porteur.md` -- décision du 2026-11-19

**Acceptance Criteria:**
- Given la base de production avec `"Order"` vide, when le porteur applique la migration, then `"Order"` n'existe plus et `prisma migrate diff` ne trouve aucun écart avec `schema.prisma`.
- Given `"Order"` non vide, when la migration est appliquée, then elle échoue sans rien supprimer.
- Given le code après la story, when on cherche `prisma.order`, `"Order"` ou `artworkIds`, then rien ne subsiste dans `src/`, ni dans `AGENTS.md` (hors historique de migrations).
- Given `/api/checkout` ou le webhook (selon la décision 1), when on les appelle, then la route n'existe plus.

## Implementation Notes

- Migration `20261122090000_suppression_order` : garde (refus si `"Order"` a des lignes), `DROP … IF EXISTS`. Elle se lance **après** le déploiement du code de la 7.9 (l'ancien code lit `"Order"` à l'administration), contrairement aux migrations additives. Le script de recopie n'est plus que dans l'historique git (`e7214fa`) ; il ne vide pas `"Order"` : après contrôle `avant`/`apres`, la table se vide à la main.
- Stripe retiré (1A) : routes, bibliothèque, dépendance ; retrait du webhook et des variables `STRIPE_*` consigné comme acte du porteur dans `docs/migrations.md`.
- Pages d'administration (2A) : `/dashboard/admin`, fiche et liste des utilisateurs ne lisent plus `Order` (la liste, hors spec, lisait aussi `User.orders`).
- `marquerVendues` gardée (tests), sans appelant en production. Les colonnes `stripe*` et `*Historique` de `Commande` restent (anciennes commandes). Variables nommées `artworkIds` des modules `disponibilite` et `commandes` : sans rapport avec l'ancienne table.

## Spec Change Log

## Review Triage Log

Passe 1 (trois relectures : aveugle, cas limites, lacunes de vérification).

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| La garde refuse toute table non vide, mais le script de recopie ne vide pas `"Order"` : la procédure ne peut pas aboutir | medium | patch | Procédure : contrôle `avant`/`apres`, puis `DELETE FROM "Order"` ; message de la garde corrigé. |
| Ordre de déploiement contradictoire (migration « avant la fusion » alors que l'ancien code lit `Order`) | high | patch | Doc : fusion et déploiement, puis migration, puis retrait de Stripe. |
| Retrait de Stripe non couvert (webhook côté Stripe, variables Vercel, paiements en attente) | medium | patch | Puce « Retrait de Stripe » de `docs/migrations.md`. |
| `DROP CONSTRAINT`/`DROP TABLE` sans `IF EXISTS` | low | patch | `IF EXISTS` ajouté ; empreinte recalculée dans la doc. |
| Test « aucune table Order » vide de sens | medium | patch | État relevé avant `beforeEach`. |
| Commentaire de `Commande` cite le script supprimé ; commentaire et journal de `marquerVendues` décrivent un flux disparu | low | patch | Commentaires corrigés. |
| Colonnes `stripe*` de `Commande` : volontaires ? | low | patch | Dit dans `AGENTS.md`. |
| Empreinte de la migration non vérifiée par un test | low | rejet | Vérifiée à la main par `sha256sum` (procédure) ; un test ajouterait de la complexité. |
| Scan de `src/` incomplet (`include: { orders: true }`, SQL autrement cité) | low | rejet | `User.orders` n'existe plus : TypeScript refuse ; le scan couvre les écritures réelles. |
| `marquerVendues` à retirer ; `vendues-sans-commande.sql` sans remplaçant ; accueil admin sans lien vers les commandes | low | rejet | Décidé par la spec et par 2A ; tests de la couche disponibilité s'appuient sur `marquerVendues`. |
| `docs/strategie-refonte.md` cite encore Stripe | low | rejet | Document de stratégie historique, hors périmètre. |
| Spec livrée inachevée (cases, journal) | low | patch | Cases cochées, notes et journal remplis. |

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis
- job CI « Migrations » -- vert (migrations appliquées sur base vide, aucun écart)

**Manual checks:**
- Migration appliquée par le porteur seulement : branche Neon de sauvegarde datée, répétition sur une branche Neon (consignée), contrôle du nombre de lignes de `"Order"` juste avant.
