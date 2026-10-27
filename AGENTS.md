<!-- bmad:context -->
<!-- Verified 2026-10-24 against bcf911c. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## Errancy (art-gallery)

Place de marché d'art en ligne : les artistes vendent via le site, Errancy prend 30 %. Next.js 14 (App Router) + TypeScript, Prisma 7 sur PostgreSQL (Neon), NextAuth v5, Stripe, Cloudinary, déployé sur Vercel. Stratégie : `docs/strategie-refonte.md` ; décisions du porteur : `docs/decisions-porteur.md` ; état technique : `docs/analyse-projet.md` ; livrables BMAD : `_bmad-output/`.

## Policy

- Une décision produit ou technique structurante (pile, prestataire de paiement, modèle de données) n'est prise que si elle figure dans `docs/decisions-porteur.md` ou un document BMAD validé ; sinon, la poser comme question ouverte.
- Ne jamais remplacer la pile existante (ex. migration vers Supabase) : améliorer l'existant, migration progressive avec retour arrière.
- Ne jamais lever la maintenance ni ouvrir `public/robots.txt` dans le code : la maintenance se pilote par la variable Vercel `MAINTENANCE_MODE`.
- Ne jamais modifier `src/generated/prisma/` : il est régénéré par `prisma generate` (lancé au `postinstall`).
- Ne jamais commiter de secrets : ils vont dans `.env.local` (ignoré par git).

## Where things are

- Middleware (maintenance, accès par rôle) : `src/middleware.ts`.
- Auth : `src/auth.config.ts` est partagé avec le middleware (edge) — callbacks `jwt`/`session` ici, sans Prisma ni bcrypt ; les providers et l'adaptateur Prisma vont dans `src/auth.ts`.
- Paiement : `src/app/api/checkout/route.ts` (prix relus en base, jamais ceux du client) et `src/app/api/webhooks/stripe/route.ts` (doit rester idempotent).
- Lecture du catalogue : `src/lib/db/` + `mappers.ts` vers `src/lib/types` ; `src/data/*` est de la démonstration à supprimer, n'y ajouter aucun nouvel usage.

## Running and verifying

- Avant de pousser : `npx eslint .` puis `npm run build`, comme la CI — Vercel échoue sur la moindre erreur ESLint.
- Sans `DATABASE_URL`, `npm run build` réussit mais affiche des `DatabaseNotReachable` Prisma : ce n'est pas un échec.
- `next start` en local exige `AUTH_SECRET` et `AUTH_TRUST_HOST=true`.
- La CLI Prisma lit `.env.local` (via `prisma.config.ts`), pas `.env`.
- CI : `.github/workflows/ci.yml` lance, sous Node 24, `npm ci`, `npx eslint .` puis `npm run build` à chaque PR vers `main`, sans aucun secret. Une PR dont ce check (« Lint et build ») est rouge ne doit pas être fusionnée ; le blocage automatique dépend de la règle de protection de `main`, réglée par le porteur dans GitHub.
- Il n'existe pas encore de tests : vérifier aussi à la main dans la préversion Vercel de la PR.

## Conventions that differ from defaults

- Textes d'interface et URL en français (`/galerie`, `/artistes`, `/panier`, `/auth/connexion`).
- Rôles = chaînes `user` | `artist` | `admin` sur `User.role`.
- Une œuvre est identifiée par son `slug` dans le panier, le checkout et les commandes (`Order.artworkIds` = slugs séparés par des virgules).

## Known pitfalls

- Un `middleware.ts` à la racine est ignoré car le projet utilise `src/` : il doit rester dans `src/middleware.ts`.
- Une apostrophe brute dans du texte JSX français casse le build (`react/no-unescaped-entities`) : écrire `&apos;`.
- Après un changement de rôle par un admin, le JWT garde l'ancien rôle : l'utilisateur doit se reconnecter.

<!-- /bmad:context -->
