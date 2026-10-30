<!-- bmad:context -->
<!-- Verified 2026-10-24 against bcf911c. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## Errancy (art-gallery)

Place de marché d'art en ligne : les artistes vendent via le site, Errancy prend 30 %. Next.js 14 (App Router) + TypeScript, Prisma 7 sur PostgreSQL (Neon), NextAuth v5, Stripe, Cloudinary, déployé sur Vercel. Stratégie : `docs/strategie-refonte.md` ; décisions du porteur : `docs/decisions-porteur.md` ; état technique : `docs/analyse-projet.md` ; livrables BMAD : `_bmad-output/`.

## Policy

- Une décision produit ou technique structurante (pile, prestataire de paiement, modèle de données) n'est prise que si elle figure dans `docs/decisions-porteur.md` ou un document BMAD validé ; sinon, la poser comme question ouverte.
- Ne jamais remplacer la pile existante (ex. migration vers Supabase) : améliorer l'existant, migration progressive avec retour arrière.
- Ne jamais lever la maintenance ni ouvrir `public/robots.txt` dans le code : la maintenance se pilote par la variable Vercel `MAINTENANCE_MODE`.
- Ne jamais ouvrir l'achat en ligne (Lot 2) dans le code : il se pilote par la variable Vercel `LOT2_OUVERT` (`oui` = ouvert, sinon fermé), lue uniquement par `lot2Ouvert()` de `src/lib/reglages` (AD-17).
- Ne jamais modifier `src/generated/prisma/` : il est régénéré par `prisma generate` (lancé au `postinstall`).
- Ne jamais commiter de secrets : ils vont dans `.env.local` (ignoré par git).

## Where things are

- Middleware (maintenance, session sur les pages protégées) : `src/middleware.ts`. Il ne décide d'aucun accès par rôle.
- Accès par rôle (AD-15) : `acteurCourant()` de `src/lib/acces` relit le rôle en base et renvoie un acteur typé (`visiteur`, `user`, `artist` avec son artiste, `admin`). Toute page, layout ou route protégée l'utilise ; ne jamais décider d'un accès avec `session.user.role`, qui vient du jeton et peut être périmé.
- Auth : `src/auth.config.ts` est partagé avec le middleware (edge) — callbacks `jwt`/`session` ici, sans Prisma ni bcrypt ; les providers et l'adaptateur Prisma vont dans `src/auth.ts`.
- Paiement : `src/app/api/checkout/route.ts` (refusé tant que le Lot 2 est fermé ; prix relus en base, jamais ceux du client) et `src/app/api/webhooks/stripe/route.ts` (doit rester idempotent).
- Contacts de la page de maintenance (FR-35) : formulaire de `public/maintenance.html` → `POST /api/inscription-ouverture` → `src/lib/demandes` (tables `InscriptionOuverture`, `TentativeInscription`) ; export CSV admin sur `/api/admin/inscriptions-ouverture`. Jamais d'e-mail ni d'IP dans les journaux.
- Lecture du catalogue : module `src/lib/catalogue/` (API dans `index.ts`, `mappers.ts` vers `src/lib/types`) ; les composants client n'importent que `catalogue/conversions` ou `catalogue/mappers`, purs. `src/data/*` est de la démonstration à supprimer, n'y ajouter aucun nouvel usage.
- Prix et dimensions (AD-5, AD-20, story 2.1) : lire `Artwork.prixCentimes` (centimes entiers, `devise`) et `hauteurMm`/`largeurMm`/`profondeurMm`, jamais `price` (`Float`) ni `dimensions` (texte), sauf pour préremplir une dimension illisible. Toute écriture passe par `champsPrix`/`champsDimensions` de `catalogue/conversions`, qui alimentent anciennes et nouvelles colonnes jusqu'à la story 2.10.
- Publication et disponibilité (AD-6, AD-7, story 2.2) : deux axes de `Artwork`, `publication` (`brouillon`, `en_curation`, `publiee`) écrit seulement par `src/lib/curation`, et `disponibilite` (`disponible`, `reservee`, `vendue`, `vendue_ailleurs`, `retiree`) écrit seulement par `src/lib/disponibilite`. « Visible » et « disponible » ne se lisent que par les fragments (`VISIBLE`, `DISPONIBLE`) et prédicats (`estVisible`, `estDisponible`) de `disponibilite` ; la partie pure (`disponibilite/etats`) est importable côté client. Aucun autre fichier de `src/` ne lit ni n'écrit ces colonnes (un test le vérifie). `available` reste écrit, égal à « disponible » (`champAvailable`), jusqu'à la story 2.10 ; ne plus le lire.
- Accès à la base (AD-1) : seuls les modules métier `src/lib/<module>/` listés dans `.eslintrc.js` (`MODULES_METIER`) et `src/auth.ts` importent Prisma ou `pg` (`@/lib/prisma`, `@/generated/prisma*`, `@prisma/client`, `@prisma/adapter-pg`, `pg`), règle `no-restricted-imports` ; un nouveau module s'ajoute à `MODULES_METIER`. Les fichiers existants hors modules sont listés dans `eslint/exceptions-prisma.cjs` : cette liste ne fait que diminuer (la CI échoue sur tout ajout), on en retire un fichier quand il passe par un module.

## Running and verifying

- Avant de pousser : `npx eslint .`, `node scripts/verifier-exceptions-prisma.cjs origin/main` puis `npm run build`, comme la CI — Vercel échoue sur la moindre erreur ESLint.
- Sans `DATABASE_URL`, `npm run build` réussit mais affiche des `DatabaseNotReachable` Prisma : ce n'est pas un échec.
- `next start` en local exige `AUTH_SECRET` et `AUTH_TRUST_HOST=true`.
- Le Lot 2 est fermé par défaut, donc `/panier` n'a pas de bouton de paiement : pour tester le chemin d'achat actuel en local, mettre `LOT2_OUVERT=oui` dans `.env.local`.
- La CLI Prisma lit `.env.local` (via `prisma.config.ts`), pas `.env`.
- Migrations (`docs/migrations.md`) : tout changement de `schema.prisma` s'accompagne d'une migration commitée. `prisma migrate deploy` sur la production n'est lancé que par le porteur, jamais dans le build Vercel ni en CI ; `prisma db push` est proscrit sur toute base partagée.
- CI : `.github/workflows/ci.yml` lance, sous Node 24, `npm ci`, `npx eslint .` puis `npm run build` à chaque PR vers `main`, sans aucun secret ; le job « Migrations » applique toutes les migrations sur un PostgreSQL vide et échoue si `prisma migrate diff` trouve un écart avec `schema.prisma` ; le job « Tests » lance `npm test`. Une PR dont l'un de ces checks (« Lint et build », « Migrations », « Tests ») est rouge ne doit pas être fusionnée ; le blocage automatique dépend de la règle de protection de `main`, réglée par le porteur dans GitHub.
- Tests : Vitest (`npm test`, fichiers `tests/**/*.test.ts`), sur un vrai PostgreSQL. `tests/utils/base-jetable.ts` crée une base jetable sur le serveur de `TEST_DATABASE_URL`, la migre avec les migrations du dépôt puis la supprime ; ne jamais tester contre une base partagée. Vérifier aussi à la main dans la préversion Vercel de la PR.

## Conventions that differ from defaults

- Textes d'interface et URL en français (`/galerie`, `/artistes`, `/panier`, `/auth/connexion`).
- Rôles = chaînes `user` | `artist` | `admin` sur `User.role`.
- Une œuvre est identifiée par son `slug` dans le panier, le checkout et les commandes (`Order.artworkIds` = slugs séparés par des virgules).

## Known pitfalls

- Un `middleware.ts` à la racine est ignoré car le projet utilise `src/` : il doit rester dans `src/middleware.ts`.
- Une apostrophe brute dans du texte JSX français casse le build (`react/no-unescaped-entities`) : écrire `&apos;`.
- Après un changement de rôle par un admin, le JWT garde l'ancien rôle. Les accès n'en dépendent plus (rôle relu en base par `acces`), sauf le passage des admins pendant la maintenance, décidé en edge par le middleware à partir du jeton : un nouvel admin doit se reconnecter pour voir le site en maintenance, et un admin rétrogradé la contourne encore jusqu'à l'expiration de son jeton.

<!-- /bmad:context -->
