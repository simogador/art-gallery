---
title: 'Story 6.1 — Passage en caisse et commandes par artiste, aux montants figés'
type: 'feature'
created: '2026-11-11'
status: 'done'
baseline_commit: '455e768a8f89d893079a1f337545456f53981db9'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-3-3-pays-prix-total.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le site n'a aucun modèle de commande : l'ancienne table `Order` ne porte qu'un total en euros (`Float`), une liste de slugs séparés par des virgules et l'identifiant Stripe, sans acheteur, sans artiste, sans montant par œuvre. Les réservations, la vente assistée et le constat de paiement (6.2 à 6.4) ont besoin d'un passage en caisse qui produit une commande par artiste avec des montants figés (FR-10, AD-12, AR-10).

**Approach:**
- Un module `commandes` (déjà dans `MODULES_METIER`) crée, en une transaction, un passage en caisse : coordonnées de l'acheteur sans compte, une commande `en_attente_paiement` par artiste, des lignes qui figent identifiant d'œuvre, slug et titre, prix, frais, devise, zone et délai (calculés par `livraison` depuis la base), et un numéro lisible unique.
- Les anciennes commandes sont recopiées par un script SQL idempotent (AD-20, temps 1 et 2) ; `Order` reste lue et écrite par le code actuel, sans nouvelle écriture.
- Aucun écran ni appelant : 6.2 réserve, 6.3 crée le passage en caisse pour l'équipe, 6.4 constate le paiement.

## Boundaries & Constraints

**Always:**
- `commandes` seul propriétaire des tables `PassageEnCaisse`, `CoordonneesAcheteur`, `Commande`, `LigneCommande` (et `Paiement` selon la décision) ; API publique `src/lib/commandes/index.ts` (`creerPassageEnCaisse`) sans contrôle d'acteur (l'appelant, 6.3 ou 7.2, le fait) ; fonctions aval avec `tx` facultatif (AD-3).
- Un passage en caisse = un pays de livraison (code ISO), une devise, des œuvres : refus `liste_vide`, `oeuvre_indisponible` (œuvre non visible par `VISIBLE`, sans prix), `non_livree` (raison de `livraison`), `devise_differente`, `coordonnees_invalides` ; tout est refusé ou tout est écrit (une transaction) ; la disponibilité et la réservation sont celles de 6.2, pas de cette story.
- Montants en centimes entiers (`Int`) et devise ISO 4217 (`EUR`, AD-5) ; le calcul est celui de `livraison`, étendu pour renvoyer prix de l'œuvre seul, frais, devise, zone (id et nom) et délai (préparation + transport) ; aucune addition de prix et de frais hors de `livraison`.
- Chaque ligne fige id d'œuvre (clé étrangère `SET NULL`, l'œuvre peut disparaître), instantané du slug et du titre, prix, frais, devise, zone, délai ; une ligne relue après modification du tarif, du slug ou du titre de l'œuvre est inchangée (test).
- Une commande par artiste (`Artist.id`) du passage, à l'état `en_attente_paiement` ; table de transitions d'états unique dans `commandes` (AD-9), seule la création est livrée ici ; commande horodatée.
- Numéro lisible de commande produit par un seul générateur de `commandes`, distinct de l'id, unique en base (contrainte), régénéré en cas de collision.
- Coordonnées de l'acheteur (e-mail, nom, adresse, téléphone) dans `CoordonneesAcheteur`, jamais de `User` ; règles pures de validation dans `commandes/coordonnees-regles.ts`, textes dans `fr` ; ni e-mail ni adresse dans les journaux.
- Recopie d'`Order` : script `scripts/sql/recopier-anciennes-commandes.sql`, idempotent (rejouable sans doublon), lancé par le porteur seulement (sauvegarde datée, puis `preview`, puis production), jamais par le build ni la CI, avec une requête de contrôle (nombre de commandes et somme des montants avant et après) ; `Order` reste en lecture pour le retour arrière (AD-20 temps 1 à 3) ; sa suppression est la story 7.9.
- Migration additive (nouvelles tables seulement) ; mise à jour d'`AGENTS.md` : plus de « `Order.artworkIds` = slugs » pour les nouvelles commandes ; un module `commandes` nouveau : tests de base réelle.

**Never:**
- Réservation, plafonds et durées (6.2), écran ou route d'appel, jeton de commande, e-mail (6.3), module `paiement`, ports, constat et confirmation (6.4), abandon (6.5), prestataire de paiement (OQ-1 ouverte), panier public ou coordonnées sans compte côté acheteur (Epic 7), `LOT2_OUVERT` et `/api/checkout` inchangés (Lot 2 fermé), durée de conservation des coordonnées (Epic 7), suppression d'`Order` (7.9).
- Float ou calcul de prix hors `livraison` ; `prisma db push`, `migrate deploy` en CI ou au build ; toucher à `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Deux artistes | 3 œuvres visibles, 2 artistes, pays livré | 1 passage, 2 commandes `en_attente_paiement`, 3 lignes figées, 2 numéros distincts | — |
| Montants figés | tarif, slug ou titre modifié ensuite | lignes relues inchangées | — |
| Œuvre non livrée | pas de zone ou non livrée vers le pays | refus `non_livree`, rien écrit | raison de `livraison` conservée |
| Œuvre non visible | brouillon, retirée, artiste sans accord | refus `oeuvre_indisponible`, rien écrit | — |
| Devises mélangées | deux devises | refus `devise_differente` | — |
| Coordonnées invalides | e-mail ou nom manquant | refus `coordonnees_invalides` | message par champ |
| Collision de numéro | numéro déjà pris | nouveau numéro, un seul passage créé | — |
| Œuvre supprimée plus tard | ligne existante | ligne gardée, `artworkId` nul, slug et titre conservés | — |
| Recopie rejouée | script lancé deux fois | aucun doublon, contrôle identique | — |
**Decisions (porteur, 2026-11-11):**
- `Paiement` est créée dans cette story, minimale (passage, source, référence externe, montant en centimes, état, paire source + référence unique) ; 6.4 y ajoute les ports et le constat.
- Numéro lisible : « ERR- » suivi de huit caractères aléatoires sans lettres ambiguës (ex. ERR-7K4M-9Q2X), unique en base.
- Recopie d'`Order` : chaque ancien `Order` devient une seule commande « historique » (total, devise, slugs, e-mail, identifiants Stripe), sans ligne figée et hors des sommes dues ; aucune valeur inventée.
- Les lectures d'`Order` (pages d'administration) basculent dans la story 6.3 ; la 6.1 ne touche à aucune page.

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` + migration additive -- `PassageEnCaisse`, `CoordonneesAcheteur`, `Commande` (artiste, numéro unique, état), `LigneCommande` (œuvre `SET NULL`, instantanés, centimes, devise, zone, délais) ; `Paiement` selon la réponse 1 ; ne pas toucher `Order`.
- `src/lib/commandes/` (à créer : `index.ts`, `passage.ts`, `numero.ts`, `etats.ts`, `coordonnees-regles.ts`) -- API, générateur du numéro, table de transitions (création seulement), règles pures ; modèle de forme : `src/lib/demandes/` et `src/lib/livraison/`.
- `src/lib/livraison/index.ts`, `prix.ts` -- étendre `prixLivre` : prix de l'œuvre seul, frais, zone (id, nom), délai préparation + transport ; accepter `tx` ; `tests/livraison.test.ts` garde l'égalité des deux formes (TS et SQL).
- `src/lib/disponibilite/etats.ts` -- fragment `VISIBLE` seulement ; l'état de réservation relève de 6.2.
- `scripts/sql/recopier-anciennes-commandes.sql` -- recopie idempotente et requête de contrôle ; modèle : `scripts/sql/zones-depart.sql`.
- `src/app/api/webhooks/stripe/route.ts`, `src/app/api/checkout/route.ts`, `src/app/confirmation/`, `src/app/dashboard/admin/page.tsx`, `src/app/dashboard/admin/utilisateurs/[id]/page.tsx` -- ne pas modifier (réponse 4) ; `eslint/exceptions-prisma.cjs` ne fait que diminuer.
- `tests/commandes.test.ts` (base réelle : deux artistes, figés, refus, numéro, atomicité), `tests/livraison.test.ts`, `docs/migrations.md`, `AGENTS.md`.

## Tasks & Acceptance

**Execution:**
- [ ] `prisma/` -- tables et migration additive
- [ ] `src/lib/livraison/` -- valeurs figées par œuvre et pays
- [ ] `src/lib/commandes/` -- création du passage, commandes par artiste, lignes figées, numéro, coordonnées
- [ ] `scripts/sql/` -- recopie idempotente et contrôle
- [ ] tests (base réelle), `AGENTS.md`, `docs/migrations.md`

**Acceptance Criteria:**
- Given des œuvres de deux artistes et un pays livré, when le passage en caisse est créé, then il y a une commande `en_attente_paiement` par artiste, des lignes figées et un numéro lisible par commande.
- Given un tarif, un slug ou un titre modifié après la création, when on relit la commande, then ses montants et son instantané sont inchangés.
- Given une œuvre non visible, non livrée ou une devise différente, when on crée le passage, then rien n'est écrit et le refus est typé.
- Given l'ancienne table `Order`, when le script est lancé deux fois, then aucune ligne n'est dupliquée et la requête de contrôle donne le même résultat.

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Migration puis script appliqués par le porteur (sauvegarde `sauvegarde-avant-6-1-…`, `preview`, production, avant la fusion) ; comptage d'`Order` en production avant la recopie ; aucun écran à vérifier.

## Review Triage Log

Passe 1 (trois relecteurs : aveugle, cas limites, lacunes de vérification).

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Œuvre vendue ou réservée acceptée (`VISIBLE` sans `DISPONIBLE`) | medium | defer | La spec gelée renvoie disponibilité et réservation à la 6.2 ; noté en limite connue dans `AGENTS.md`. |
| Pas de verrou de ligne d'œuvre, deux passages simultanés réussissent | medium | defer | Même cause : la réservation sans double vente est la 6.2. |
| Devise de ligne non mise en majuscules (contrainte `^[A-Z]{3}$`) | medium | patch | `passage.ts` écrit `prix.devise` brut ; `livraison` compare avec `upper()`, donc une offre en minuscules est atteignable. |
| Test d'atomicité n'exerce aucun retour arrière | medium | patch | L'échec survient dans `numerosLibres`, avant toute écriture. |
| Délai de transaction par défaut (5 s) | low | patch | Trois requêtes par œuvre dans une transaction interactive. |
| Retrait `P2002` sur numéro non testé | low | defer | Course difficile à provoquer, improbable (30^8) ; limite connue. |
| `adresse` / `telephone` facultatifs | low | defer | La matrice ne rend obligatoires que l'e-mail et le nom ; à confirmer par le porteur en 6.3 (limite connue). |
| `lireCommande` sans contrôle d'acteur | low | patch | Documenter dans `AGENTS.md` : l'appelant contrôle, comme `creerPassageEnCaisse`. |
| Limites connues absentes d'`AGENTS.md`, section mal placée dans `docs/migrations.md` | low | patch | Constaté dans le diff. |
| Suppression d'un artiste ayant une commande (clé étrangère `Restrict`, 500) | low | defer | Aucune commande réelle avant la 6.3 ; à traiter avec le premier écran des commandes. |
| `pays` hors forme ISO, `oeuvres` non tableau, `CHECK` brut | false | rejet | Un pays inconnu n'a pas de zone : `non_livree` avant toute écriture ; l'appelant est typé. |
| Plafond de la liste d'œuvres | low | rejet | Fix = nouvelle surface (code de refus) ; les appelants (6.3, 7.2) bornent leurs listes. |
| Script SQL : devise ou montant atypique, exécutions simultanées, commande historique périmée, alphabet dupliqué | low | rejet | Échec franc et atomique (aucune écriture partielle) ; usage unique par le porteur ; alphabet noté en limite. |
| Intégrité de schéma (égalité des devises, index Stripe, `zoneId` sans clé) | low | rejet | Aucun lecteur avant 6.4 ; corrections = complexité sans dommage montré. |
| Statut de suivi `in-progress` contre `in-review` | false | rejet | `sprint-status` passe à `review` à la présentation, comme les autres stories. |
| Repli `pas_de_zone` de `prixLivreFige` jamais atteint | false | rejet | Garde défensive pour le typage, inoffensive. |

