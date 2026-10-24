---
title: "Addendum — PRD refonte d'Errancy"
created: 2026-10-24
updated: 2026-10-24
---

# Addendum au PRD — Refonte d'Errancy

Ce document rassemble ce qui sert aux étapes suivantes (UX, architecture) mais n'a pas sa place dans le PRD : correspondance avec le code existant, options de paiement étudiées, socle concurrentiel. **Rien ici n'est une décision.**

## A. Correspondance avec l'existant (pour `bmad-architecture`)

| FR | Point de départ dans le code | Écart constaté (`docs/analyse-projet.md`, `docs/strategie-refonte.md` §9) |
|---|---|---|
| FR-1 à FR-6 | Fiche `/galerie/[id]` | Pas de prix total, de délai, de certificat, de mise en situation, ni de boutons conseil ou visite |
| FR-7 | — | Aucun bouton WhatsApp |
| FR-10 | `/panier`, `src/middleware.ts` | Le panier et le checkout exigent une session |
| FR-11, FR-13 | `src/app/api/checkout/route.ts`, `src/app/api/webhooks/stripe/route.ts` | Les prix sont bien relus en base et le webhook est idempotent (à conserver) ; prix en `Float` (préférer des centimes entiers ou `Decimal`) ; `Order.artworkIds` en chaîne CSV |
| FR-12 | — | Aucune réservation, aucun contrôle de double vente |
| FR-13, FR-8, FR-9 | — | Pas d'e-mails transactionnels (Resend cité comme candidat, rien n'est choisi) |
| FR-16 | `src/data/*` | Encore importé par `components/sections/*` et `lib/utils/*` |
| FR-20, FR-21 | `/dashboard/artiste` (CRUD des œuvres) | Pas de champs de livraison par zone ni d'états de disponibilité détaillés |
| FR-27 | — | Aucune analytique |
| NFR-5 | Next.js 14.2.5 | Mise à jour de sécurité nécessaire |

Autres points :
- Le rôle n'est pas rafraîchi dans le JWT après un changement par un admin : l'utilisateur doit se reconnecter.
- Il n'existe ni tests ni CI. Le test de double vente (NFR-4) exigera au moins un test automatisé ciblé.

## B. Options de paiement étudiées — pour information, NON décidées

Source : `_bmad-output/planning-artifacts/research/technical-paiement-place-de-marche-art-exploitant-2026-10-24/research.md`.

**Contraintes relevées :**
- Stripe n'accepte pas les sociétés établies au Maroc.
- Le Stripe Connect transfrontalier en libre-service est limité aux États-Unis, au Royaume-Uni, à l'EEE, au Canada et à la Suisse.
- Global Payouts est réservé aux plateformes des États-Unis et du Royaume-Uni.
- Mangopay exige une société dans l'EEE ou au Royaume-Uni.

**Recommandation de l'étude :**
- Une société d'exploitation au Royaume-Uni (ou aux États-Unis) encaisse, conserve les fonds jusqu'à la livraison plus 14 jours, puis reverse 70 % à l'artiste.
- Le rail de reversement dépend du pays de l'artiste :
  - **A.** Stripe Connect pour les États-Unis, le Royaume-Uni, l'EEE, le Canada et la Suisse ;
  - **B.** Global Payouts pour le Maroc, l'Algérie, l'Égypte, les Émirats, etc. ;
  - **C.** PayPal ou Payoneer pour les autres pays ;
  - **D.** une liste d'attente pour les pays sans rail.
- Errancy Maroc garde la marque, la curation et l'équipe, et facture ses services à cette société.

**Option de démarrage (R4) :** pas de paiement intégré. Le premier contact passe par un conseil WhatsApp, puis l'œuvre est réservée et l'acheteur paie par un lien.

**Réserve de l'étude :** contrôle des changes marocain, et cas non documenté d'une plateforme marocaine qui reverse à des vendeurs étrangers. L'avis juridique et comptable est un **préalable bloquant**.

## C. Socle concurrentiel des fiches œuvres

Source : `_bmad-output/planning-artifacts/research/competitive-fiches-oeuvres-confiance-acheteur-2026-10-24/research.md`. Concurrents étudiés : Saatchi Art, Singulart, Artsy, Artmajeur et Massinart.

- **Ce que proposent les concurrents :**
  - livraison incluse et délai affiché ;
  - certificat ;
  - retour sous 14 jours ;
  - visualisation dans la pièce.
- **Délais observés :** 5 à 7 jours en national, 10 à 14 jours à l'international (Saatchi).
- **Commissions des concurrents :** 30 à 50 % chez Singulart, 35 à 40 % chez Saatchi. Les 30 % d'Errancy sont donc un argument pour recruter des artistes.
- **Motifs de déception chez les acheteurs :** couleurs différentes de l'écran, œuvres abîmées, retards, communication lente.
- **Différenciation possible pour Errancy :** couleurs fidèles, délais exacts, suivi humain par WhatsApp.
- **Données à revérifier en janvier 2027.**

## D. Alternative écartée

- **Migration vers Supabase ou changement de pile.** L'audit ne montre aucun bénéfice démontré, et la politique du dépôt interdit de remplacer la pile. Le PRD suppose qu'on améliore l'existant par étapes.
