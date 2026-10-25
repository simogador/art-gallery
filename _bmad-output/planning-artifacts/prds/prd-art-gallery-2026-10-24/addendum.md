---
title: "Addendum — PRD refonte d'Errancy"
created: 2026-10-24
updated: 2026-10-25
---

# Addendum au PRD — Refonte d'Errancy

Ce document rassemble ce qui sert aux étapes suivantes (UX, architecture) mais n'a pas sa place dans le PRD : correspondance avec le code existant, options de paiement étudiées, socle concurrentiel. **Rien ici n'est une décision**, sauf le rejet d'un changement de pile (§D), imposé par la politique du dépôt.

## A. Correspondance avec l'existant (pour `bmad-architecture`)

| FR | Point de départ dans le code | Écart constaté (`docs/analyse-projet.md`, `docs/strategie-refonte.md` §9) |
|---|---|---|
| FR-1 à FR-6 | Fiche `/galerie/[id]` | Pas de prix total, de délai, de certificat, de mise en situation, ni de boutons conseil ou visite |
| FR-7 | — | Aucun bouton WhatsApp |
| FR-10 | `/panier`, `src/middleware.ts` ; panier persistant côté navigateur (Zustand) | Le panier et le checkout exigent une session ; le panier ne signale pas une œuvre devenue indisponible |
| FR-11, FR-13 | `src/app/api/checkout/route.ts`, `src/app/api/webhooks/stripe/route.ts` | Les prix sont bien relus en base et le webhook est idempotent (à conserver) ; prix en `Float` (préférer des centimes entiers ou `Decimal`) ; `Order.artworkIds` en chaîne CSV |
| FR-12, FR-21 | `Artwork.available` (booléen) | Aucune réservation, aucun contrôle de double vente ; un booléen ne peut pas représenter les cinq états de disponibilité (FR-6) |
| FR-13, FR-22, FR-29, FR-32, FR-33 | `Order` | Montant en euros sans champ devise ; pas d'états après la confirmation (prise en charge, expédition, livraison, clôture) |
| FR-8, FR-9, FR-13, FR-15, FR-22, FR-31 | — | Pas d'e-mails transactionnels (Resend cité comme candidat, rien n'est choisi) |
| FR-16 | `src/data/*`, `prisma/seed.ts`, images Cloudinary | `src/data/*` est encore importé par `components/sections/*` et `lib/utils/*` ; le seed et les images importées (Wikimedia, MET) doivent être vérifiés pour les droits |
| FR-20, FR-21 | `/dashboard/artiste` (CRUD des œuvres) | Pas de champs de livraison par zone ni d'états de disponibilité détaillés |
| FR-27 | — | Aucune analytique |
| FR-34 | `Artist` ↔ `User`, `User.role` | Lien optionnel entre l'artiste et son compte, aucun parcours d'invitation ; contrôle du rôle typé `any` et non testé |
| FR-35 | Page de maintenance (`src/middleware.ts`) | Le formulaire « Me notifier » n'envoie rien |

Les autres FR (FR-15, FR-17 à FR-19, FR-23 à FR-26, FR-28, FR-30, FR-31) n'ont pas d'existant dans le code : ce sont des créations, sans écart à mesurer.
| NFR-5 | Next.js 14.2.5 | Mise à jour de sécurité nécessaire |

Autres points :
- Le rôle n'est pas rafraîchi dans le JWT après un changement par un admin : l'utilisateur doit se reconnecter (écart avec l'hypothèse de FR-34, qui demande précisément de le corriger : à traiter par `bmad-architecture`).
- Il n'existe ni tests ni CI. Le test de double vente (NFR-4) exigera au moins un test automatisé ciblé.
- La maintenance est pilotée par la variable Vercel `MAINTENANCE_MODE` ; `public/robots.txt` est fermé. Les deux restent des actes du porteur (NFR-2, OQ-15).
- `/wishlist` est une page vide réservée aux comptes connectés : hors MVP.

## B. Options de paiement étudiées — pour information, NON décidées

Ces éléments alimentent la question ouverte OQ-1 du PRD (§10) ; aucune option n'est retenue. Source : `_bmad-output/planning-artifacts/research/technical-paiement-place-de-marche-art-exploitant-2026-10-24/research.md`.

**Contraintes relevées :**
- Stripe n'accepte pas les sociétés établies au Maroc.
- Le Stripe Connect transfrontalier en libre-service est limité aux États-Unis, au Royaume-Uni, à l'EEE, au Canada et à la Suisse.
- Global Payouts est réservé aux plateformes des États-Unis et du Royaume-Uni.
- Mangopay exige une société dans l'EEE ou au Royaume-Uni.

**Recommandation de l'étude :**
- Une société d'exploitation au Royaume-Uni (ou aux États-Unis) encaisse, conserve les fonds jusqu'à la livraison plus 14 jours, puis reverse 70 % à l'artiste.
- Le rail de reversement dépend du pays de l'artiste (versement par paliers) :
  - **palier A :** Stripe Connect pour les États-Unis, le Royaume-Uni, l'EEE, le Canada et la Suisse ;
  - **palier B :** Global Payouts pour les pays qu'il couvre (Maroc, Algérie, Égypte, Émirats, etc.) ;
  - **palier C :** PayPal ou Payoneer pour les autres pays ;
  - **palier D :** une liste d'attente pour les pays sans rail.
- Errancy Maroc garde la marque, la curation et l'équipe, et facture ses services à cette société.

**Option de démarrage (R4, liée à OQ-12) :** pas de paiement intégré. Le premier contact passe par un conseil WhatsApp, puis l'œuvre est réservée et l'acheteur paie par un lien.

**Réserves de l'étude :**
- contrôle des changes marocain (« liberté surveillée », banque agréée) ;
- circulaire 2/2026 sur la vigilance envers les holdings offshore ;
- fiscalité et facturation des services entre Errancy Maroc et la société d'exploitation ;
- exception pour les startups labellisées (plafond d'environ 10 MDH par an), non vérifiée ;
- cas non documenté d'une plateforme marocaine qui reverse à des vendeurs étrangers ;
- acceptation de l'usage « place de marché d'art » par Stripe, et liste à jour des pays couverts par Global Payouts ;
- vérification d'identité (KYC) des artistes et fiscalité de leurs versements, qui dépendent du rail retenu ;
- le palier D (liste d'attente) contredit la décision du porteur « artistes de tous pays ».

L'avis juridique et comptable est un **préalable bloquant**. Plusieurs sources n'ont été lues que par extraits. **Données à revérifier en janvier 2027.**

## C. Socle concurrentiel des fiches œuvres

Source : `_bmad-output/planning-artifacts/research/competitive-fiches-oeuvres-confiance-acheteur-2026-10-24/research.md`. Concurrents étudiés : Saatchi Art, Singulart, Artsy, Artmajeur et Massinart.

- **Ce que proposent les concurrents :**
  - livraison incluse et délai affiché ;
  - certificat ;
  - retour sous 14 jours ;
  - visualisation dans la pièce.
- **Délais observés :** 5 à 7 jours en national, 10 à 14 jours à l'international, chez Saatchi.
- **Commissions des concurrents :** 30 à 50 % chez Singulart, 35 à 40 % chez Saatchi. Les 30 % d'Errancy sont donc un argument pour recruter des artistes.
- **Motifs de déception chez les acheteurs :** couleurs différentes de l'écran, œuvres abîmées, retards, communication lente.
- **Conseil humain chez les concurrents :** ils en proposent déjà (chat, formulaire, téléphone, conseillers). Le canal WhatsApp avec délai annoncé est absent chez eux : la différenciation est plausible, à confirmer par la mesure.
- **Différenciation possible pour Errancy :** couleurs fidèles, délais exacts, suivi humain par WhatsApp avant et après la vente.
- **Questions laissées ouvertes par l'étude :** politique de retour de Singulart (14 ou 30 jours) ; préférence réelle de la diaspora pour WhatsApp ; données de marché récentes (une recherche « user-voice » est possible).
- **Données à revérifier en janvier 2027.**

## D. Alternative écartée

- **Migration vers Supabase ou changement de pile.** L'audit ne montre aucun bénéfice, et la politique du dépôt interdit de remplacer la pile. Le PRD suppose qu'on améliore l'existant par étapes.
