# Analyse du projet — Errancy (art-gallery)

> Document de connaissance projet (brownfield) pour les agents BMAD (`project_knowledge: docs/`).
> Rédigé le 2026-10-13 à partir de l'état de la branche principale (commit `3b25280`).

## 1. Résumé

Plateforme de galerie d'art contemporain « Errancy » : catalogue d'œuvres, artistes, expositions,
vente en ligne, espaces artiste et administrateur. Le site est **actuellement en mode
maintenance** en production (voir §5).

## 2. Stack technique

| Domaine | Choix |
|---|---|
| Framework | Next.js **14.2.5** (App Router), React 18, TypeScript 5 (strict, `tsc --noEmit` passe) |
| UI | Tailwind CSS 3 + `@tailwindcss/typography`, framer-motion, polices Cormorant Garamond / Inter |
| Base de données | PostgreSQL (Neon) via **Prisma 7.8** + `@prisma/adapter-pg` ; client généré dans `src/generated/prisma` (ignoré par git, généré au `postinstall`) |
| Auth | NextAuth **v5 beta** (`src/auth.ts`, `src/auth.config.ts`), stratégie JWT, Google + identifiants (bcryptjs), PrismaAdapter |
| Paiement | Aucun encaissement en ligne (ancien chemin Stripe supprimé, story 7.9) ; constat manuel, adaptateur en story 7.5 (OQ-1) |
| Images | Cloudinary (`src/lib/cloudinary.ts`, `/api/upload`), domaines autorisés dans `next.config.mjs` |
| État client | Zustand (`src/lib/store/cart.ts`) pour le panier |
| Hébergement | Vercel |

Commandes : `npm run dev | build | start | lint`. Prisma : `prisma.config.ts` lit `.env.local`.

## 3. Structure

```
src/app/                 Routes (App Router, URLs en français)
  page.tsx               Accueil — remplacé par une page de maintenance
  galerie/, artistes/, expositions/   Catalogue public (+ pages détail [id])
  panier/, confirmation/ Panier de slugs → commande sans compte → confirmation
  wishlist/              Placeholder (état vide uniquement, pas de modèle en base)
  auth/connexion|inscription   Formulaires + server actions (auth/actions.ts)
  dashboard/             Espace utilisateur ; /artiste (CRUD œuvres) ; /admin (artistes, œuvres, utilisateurs)
  api/                   checkout, webhooks/stripe, upload, artiste/oeuvres, admin/*
src/components/          layout (Header/Footer), sections (Hero, Gallery…), ui, dashboard
src/lib/db/              Accès Prisma + mappers DB → types UI (src/lib/types)
src/data/                Données statiques historiques (encore utilisées par sections/* et lib/utils/*)
prisma/                  schema, migrations (init, auth), seed.ts
scripts/upload-images.ts Import d'images Wikimedia/MET vers Cloudinary
src/middleware.ts        Maintenance + protège /dashboard, /wishlist, /panier ; contrôle des rôles
```

Modèles Prisma : `Artist` (lié optionnellement à un `User`), `Artwork`, `Exhibition`,
`ArtworkExhibition`, `User` (rôle texte : `user` | `artist` | `admin`), `Account`, `Session`,
`VerificationToken` (l'ancienne table `Order` est supprimée, story 7.9 ; commandes : `PassageEnCaisse`, `Commande`, `LigneCommande`, `Paiement`).

Rôles : `admin` → /dashboard/admin ; `artist` ou `admin` → /dashboard/artiste.

## 4. Flux principaux

- **Achat** (stories 6 et 7) : panier de slugs → `/commande/coordonnees` (passage et réservation) → `/commande/paiement` → constat de paiement par l'équipe (`traiterPaiementConstate`, les œuvres passent `vendue`) → `/confirmation` et `/suivi`. L'ancien chemin `POST /api/checkout` + webhook Stripe + table `Order` a été supprimé par la story 7.9.
- **Auth** : Google OAuth ou email/mot de passe ; le rôle est placé dans le JWT puis la session.

## 5. Constats et points d'attention (à traiter en priorité)

1. ✅ *Corrigé le 2026-10-23* — **Maintenance** : la réécriture `vercel.json` (qui bloquait
   toute l'app, API et webhook Stripe compris) est supprimée ; la vraie page d'accueil est
   restaurée. La maintenance est gérée dans `src/middleware.ts` : active en production Vercel
   sauf si `MAINTENANCE_MODE=off` (`on` la force partout) ; les préversions et le local montrent le
   vrai site ; les admins connectés et `/auth/*` passent ; page servie : `public/maintenance.html`
   (son formulaire « Me notifier » n'envoie rien). `public/robots.txt` interdit toujours
   l'indexation : à ouvrir au lancement.
2. ✅ *Corrigé le 2026-10-23* — **Middleware jamais exécuté** : il était à la racine alors que le
   projet utilise `src/` ; déplacé dans `src/middleware.ts`. Les callbacks `jwt`/`session` sont
   dans `src/auth.config.ts` (partagé avec le middleware) et la connexion par identifiants
   transmet le rôle. Reste : le rôle n'est pas rafraîchi dans le JWT après un changement par un
   admin (l'utilisateur doit se reconnecter).
3. **Panier** — le middleware exige une session pour `/panier` (panier non consultable
   anonymement) ; typage `any` sur la requête/rôle.
4. **Données statiques résiduelles** — `src/data/*` est encore importé par
   `components/sections/*` et `lib/utils/*` alors que les pages utilisent Prisma : risque
   d'incohérence entre accueil et catalogue.
5. **Wishlist** non implémentée (pas de modèle en base).
6. **Commerce** — prix en `Float` (préférer des centimes entiers ou `Decimal`) ; *(`Order` supprimée, story 7.9)* ; pas de contrôle de double vente si deux
   paiements concurrents portent sur la même œuvre.
7. **Qualité** — aucun test automatisé ni CI ; README minimal ; nombreux `as any`.
8. **Next.js 14.2.5** — version ancienne, à mettre à jour (correctifs de sécurité).

## 6. Variables d'environnement attendues

`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Placées dans `.env.local` (non versionné).

## 7. BMAD

BMAD Method v6.12.2 installé (`_bmad/`, skills dans `.claude/skills/bmad-*`), langue française.
Sorties : `_bmad-output/planning-artifacts` et `_bmad-output/implementation-artifacts`.
Point de départ suggéré : `bmad-help`, puis `bmad-prd` / `bmad-architecture` sur la base de ce
document, `bmad-create-epics-and-stories`, `bmad-sprint-planning`, et `bmad-agent-dev` pour
implémenter les stories. Feuille de route complète : `docs/strategie-refonte.md` ; décisions du
porteur : `docs/decisions-porteur.md`.
