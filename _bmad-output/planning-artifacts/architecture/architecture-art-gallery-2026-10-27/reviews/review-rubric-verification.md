---
type: review
target: ../ARCHITECTURE-SPINE.md
lenses: [grille-du-bon-spine, verification-de-la-realite]
date: '2026-10-27'
reviewer: agent relecteur (Claude)
---

# Relecture du spine : grille et vérification de la réalité

## Verdict

Le spine est solide : il ferme les vraies zones de divergence (propriété des données, double vente, frontière de paiement compatible avec OQ-1 et OQ-16, outbox, acteur) et garde OQ-1 et OQ-16 ouvertes comme demandé. Il n'est **pas encore prêt à lier les epics**, pour trois raisons. (1) La pile Node et outillage annoncée est fausse ou périmée au 2026-10-27. (2) Le mécanisme qui doit faire respecter AD-1 disparaît avec Next.js 16. (3) L'enveloppe opérationnelle des migrations ignore un écart réel entre `schema.prisma` et l'historique `prisma/migrations`.

## Méthode et preuves

- Code lu : `package.json`, `package-lock.json`, `.eslintrc.json`, `src/middleware.ts`, `src/auth.config.ts`, `src/lib/stripe.ts`, `prisma/schema.prisma`, `prisma/migrations/*`, `prisma.config.ts`, `next.config.mjs`, la liste des fichiers qui importent Prisma, et `docs/decisions-porteur.md`.
- Commandes `npm view` lancées le 2026-10-27 sur next, next-auth, prisma, vitest, framer-motion, eslint-config-next, @auth/prisma-adapter, posthog-js, stripe et eslint.
- Documentation officielle Next.js 16.4.3 lue dans le paquet npm (`dist/docs`), car nextjs.org n'était pas joignable depuis le bac à sable : `upgrading/version-16.md` et `functions/after.md`.
- Recherches web sur Vercel (cron, versions de Node), Neon (fenêtre de restauration), Prisma 7.4 (index partiels) et Auth.js avec `proxy.ts`. vercel.com, nextjs.org et endoflife.date n'étaient pas joignables directement ; les constats qui ne reposent que sur la recherche web sont marqués « (web) ».

## Constats prioritaires

| # | Gravité | Constat | Correction |
|---|---|---|---|
| 1 | **critical** | **Historique de migrations en écart avec le schéma.** `prisma/migrations` ne contient que `init` et `add_auth_models`. Le modèle `Order` (commit 92259ed) et `Artist.userId` sont dans `schema.prisma` mais dans aucune migration : ils ont été poussés hors de Migrate (probablement `db push`). Le spine ne dit pas non plus qui lance `prisma migrate deploy`, ni quand : `postinstall` ne fait que `prisma generate`, et rien ne s'exécute au build Vercel. AD-20 (quatre temps, chacun réversible) ne peut pas s'appliquer tel quel : le premier `migrate dev` sur une branche Neon signalera une dérive ou proposera une réinitialisation. | Ajouter à AD-20 : un premier temps « ligne de base » (`prisma migrate diff` vers une migration marquée appliquée par `migrate resolve --applied` sur la production) et un point d'application unique et explicite de `migrate deploy` (étape CI ou geste manuel du porteur, jamais au `postinstall`). |
| 2 | **high** | **Pile Node et outillage fausse.** « Node ≥ 20.9 » est périmé : Node 20 est en fin de vie depuis le 2026-04-30 et Vercel refuse les nouveaux déploiements en Node 20 depuis le 2026-10-01 (web, changelog Vercel). Prisma 7.10.1 exige `^20.19 \|\| ^22.12 \|\| >=24`. Vitest 5.0.5 exige `node ^22.12 \|\| ^24 \|\| >=26` et `@types/node ^22 \|\| >=24`, alors que le projet est en `@types/node ^20.14` : `npm i -D vitest@5` échouera en conflit de dépendances (ERESOLVE). | Stack : Node **24.x LTS** (minimum 22.12), `engines.node` dans `package.json`, réglage Node du projet Vercel et `@types/node` alignés ; à faire dans l'epic qui installe la CI, avant Vitest. |
| 3 | **high** | **AD-1 et AD-23 reposent sur un outil qui disparaît.** La règle `no-restricted-imports` vit dans `.eslintrc.json` et passe par `npm run lint` = `next lint`. AGENTS.md compte aussi sur l'échec du build Vercel en cas d'erreur ESLint. Avec Next.js 16, `next lint` est supprimé, `next build` ne lance plus le lint, et `eslint-config-next@16` exige ESLint ≥ 9 en configuration plate (« flat config »). Le projet est en ESLint 8.57, sans support. Le Deferred « Montée vers Next.js 16 » n'en dit rien. Après cette montée, AD-1 ne serait donc plus vérifié que si la CI existe et bloque la fusion. En outre, la règle telle qu'écrite ne vise que les alias `@/lib/prisma` et `@/generated/prisma` : un import relatif (`../../generated/prisma`) la contourne. | AD-1 : motifs `**/generated/prisma*` et `**/lib/prisma` en plus des alias ; AD-23 : `eslint .` lancé comme vérification **obligatoire** de la PR ; Deferred Next 16 : ajouter « migration vers ESLint 9+ en configuration plate et `next-lint-to-eslint-cli` ». |
| 4 | **high** | **Le graphe de dépendances (AD-3) bloque des cas réels.** `notifications` ne pointe que vers `evenements`. Or la charge utile d'un événement ne contient que des ids, jamais de données personnelles. Un gestionnaire d'e-mail ne peut donc pas lire l'adresse du destinataire ni le récapitulatif : il est interdit d'importer `commandes`, `demandes` ou `catalogue`. Deux agents contourneront différemment, l'un en mettant des données personnelles dans la charge utile, l'autre en ajoutant un import interdit. Même problème pour les jetons de désinscription (FR-9) : `demandes` ne pointe pas vers `acces`, qui est pourtant seul à créer les jetons (AD-14). Le type Acteur, lui, est utilisé par `curation`, `disponibilite` et `demandes` sans arête vers `acces`. | Ajouter au diagramme `NOT → CMD, DEM, CAT, ACC` (lecture seule ; ni `commandes`, ni `demandes`, ni `acces` n'appellent `notifications`, donc pas de cycle) et `DEM → ACC`, et dire que le *type* Acteur est importable par tous les modules (ou le placer dans `src/lib/types`). |
| 5 | **medium** | **« Répartir juste après la réponse » (AD-11) n'a pas de mécanisme fixé.** `after()` n'existe qu'à partir de Next 15.1 (stable). Sous Next 14, une promesse lancée sans attente est coupée par Vercel quand la réponse part. Une story utilisera `await` (réponse lente), une autre une promesse lancée sans attente (perte silencieuse). | AD-11 : une seule fonction `evenements.repartirApresReponse()` qui appelle `waitUntil` de `@vercel/functions` sous Next 14 et `after()` sous Next 16. Le balayage reste le filet de sécurité. |
| 6 | **medium** | **Le Deferred sur l'index partiel peut faire diverger deux unités, et `prisma@latest` est une RC.** Avec un index créé par SQL brut dans la migration, Prisma Migrate a longtemps proposé de supprimer les index partiels absents du schéma comme une dérive (correctif moteur #5790, version de sortie non confirmée, web). Une migration ultérieure générée par un agent pourrait donc supprimer en silence le garde-fou anti-double-vente d'AD-7. Par ailleurs, le dist-tag npm `latest` de `prisma` pointe sur **8.0.0-rc.27** (`prev` = 7.10.1) : un agent qui tape `npm i prisma@latest` installe une RC. | Trancher : préversion `partialIndexes` (Prisma ≥ 7.4, l'index est alors décrit dans le schéma) + un test CI qui vérifie que l'index existe ; épingler `prisma`, `@prisma/client` et `@prisma/adapter-pg` en `~7.10` et interdire `@latest`. |

## A. Grille du bon spine

### A.1 Les vraies zones de divergence sont-elles fixées ?

Oui pour l'essentiel : AD-2 (propriétaire unique), AD-6 et AD-7 (deux axes d'état, réservation conditionnelle), AD-4 (paiement couvrant de 1 à N commandes), AD-9 (table de transitions), AD-11 (outbox), AD-15 (acteur, rôle relu en base) et AD-5 (formats). Zones encore ouvertes à la divergence :

- **Graphe de dépendances incomplet** : constat 4.
- **Mécanisme de répartition après réponse** : constat 5.
- **AD-21, mécanisme d'invalidation non fixé.** `revalidatePath` ou étiquettes (`revalidateTag`) ? Qui l'appelle (le module après validation de la transaction, ou un gestionnaire d'événement) ? Sous Next 16, `revalidateTag(tag)` à un argument est obsolète : la forme à deux arguments (`'max'`) sert l'ancienne page pendant la revalidation (stale-while-revalidate), ce qui ne correspond pas à « invalide aussitôt ». Il faut `updateTag` (actions serveur seulement) ou un profil d'expiration immédiate. *Correction* : fixer « étiquettes `oeuvre:<id>` et `artiste:<id>` ; une seule fonction `catalogue.invaliderOeuvre()` appelée par `disponibilite` et `curation` après validation » et noter l'équivalent Next 16 dans le Deferred.
- **AD-12, la « version requête » du prix total** (filtre de la galerie) est une seconde mise en œuvre de la même règle, sans garde-fou. *Correction* : les deux implémentations vivent dans `livraison`, et un test de parité porte sur un jeu de pays et d'œuvres.
- **AD-7, expiration paresseuse contre condition de la mise à jour.** La règle écrit `WHERE disponibilite = 'disponible'` mais dit aussi que la réservation échue est libérée dans la même transaction. Sans ordre explicite (libérer les réservations échues des œuvres visées, *puis* faire la mise à jour conditionnelle), un agent écrira la seule mise à jour et refusera une œuvre dont la réservation a expiré. *Correction* : préciser l'ordre dans la Rule, ou une condition `disponible OR (reservee AND echeance < now())`.
- **AD-8, référence externe du constat manuel.** La contrainte d'unicité sur la « référence externe » suppose qu'il y en ait une ; pour un virement constaté à la main, elle peut manquer. *Correction* : clé d'idempotence = (source, référence) avec une référence générée par `constat-manuel` si l'équipe n'en saisit pas.
- **Cloudinary** n'a ni module propriétaire ni port (`src/lib/cloudinary.ts` existe ; route `api/upload`). Les photos (FR-2) sont attribuées à `curation`, mais rien ne dit si l'upload est signé côté serveur ou direct depuis le navigateur, ni qui transforme les images (NFR-1). *Correction* : rattacher `cloudinary.ts` à `curation/adaptateurs/` et fixer la règle d'upload (signée, côté serveur).
- **Anti-abus des réservations publiques.** AD-7 plafonne les réservations par e-mail ou par appareil, ce qui se contourne trivialement. Un robot peut bloquer tout le catalogue par tranches de 30 minutes. Rien ne fixe de limitation de débit ou de défi (« challenge ») sur le passage en caisse, les demandes et « Me prévenir ». *Correction* : décider ou différer explicitement, avec un déclencheur « avant ouverture du Lot 2 ».

### A.2 Chaque Rule empêche-t-elle réellement la divergence annoncée ?

- AD-1 : oui, à condition de corriger le constat 3 (imports relatifs, survie après Next 16). La liste d'exceptions « qui ne fait que diminuer » est vérifiable mécaniquement. Notez qu'il y a **21** fichiers hors `src/lib` et `src/auth.ts` qui importent Prisma (le memlog dit 22) : à recompter quand la liste sera écrite.
- AD-4 : la Rule « aucun nom de prestataire hors adaptateurs » est déjà contredite par le schéma existant : `Order.stripeSessionId` et `stripePaymentIntentId`, `src/lib/stripe.ts`. Ce n'est pas bloquant (AD-20 migrera), mais il faut lister ces éléments comme exceptions connues, sinon un agent conclura que la règle ne vaut pas.
- AD-9 : la table de transitions n'a ni chemin pour un colis perdu ou détruit (`expediee` → ?), ni chemin pour un remboursement partiel sans retour depuis `livree` (FR-31 « total ou partiel », FR-30 « œuvre abîmée »). Une commande `en_attente_paiement` → `annulee` sans paiement n'atteint jamais `close`. Il faut soit l'accepter explicitement (état final), soit ajouter la transition, sinon deux epics trancheront chacun de leur côté.
- AD-15, AD-16, AD-14 : applicables et vérifiables par tests.
- AD-17 : applicable. Noter qu'une variable Vercel ne change qu'au redéploiement : c'est cohérent avec « geste du porteur ».
- AD-23 : « vrai PostgreSQL jetable » ne dit pas lequel (conteneur de service GitHub Actions, ou branche Neon éphémère). Deux epics de test pourraient diverger. *Correction* : fixer le conteneur `postgres` de GitHub Actions, gratuit et sans secret.

### A.3 Le Deferred laisse-t-il deux unités diverger ?

- **Index partiel** : oui (constat 6).
- **Montée vers Next.js 16** : la ligne est juste pour `proxy.ts` et `revalidateTag`, mais elle oublie le lint (constat 3) et le fait que `proxy` tourne **uniquement** en runtime Node.js. La séparation edge `auth.config.ts` / `auth.ts` devient optionnelle, et un agent pourrait la « simplifier » en contredisant AGENTS.md. À mentionner.
- **Observabilité** : acceptable, avec son déclencheur (« avant le Lot 2 »).
- **Conservation et purge des données personnelles** : acceptable, mais elle repose sur le balayage, dont la fréquence dépend d'AQ-2.
- Les autres lignes ne créent pas de divergence.

### A.4 Technologie actuelle : voir la partie B.

### A.5 Ratifie-t-il le code existant ?

Globalement oui : `src/middleware.ts`, la séparation `auth.config.ts` / `auth.ts`, l'adaptateur `@prisma/adapter-pg`, Zustand pour le panier, le mode maintenance par `MAINTENANCE_MODE`, les URL françaises. Deux contradictions assumées, mais à rendre visibles :

- l'identification de l'œuvre par **id** dans les commandes (avec instantané du slug) contredit AGENTS.md (« `Order.artworkIds` = slugs ») : c'est noté `[ASSUMPTION]` dans le memlog, mais le spine ne dit pas que AGENTS.md doit être amendé par l'epic de migration (il le dit pour la CI et Next 16 ; même traitement ici) ;
- AD-13 retire `/panier` des routes protégées (`PROTECTED` dans `src/middleware.ts`) : c'est correct, à garder comme tâche explicite.

### A.6 Couverture du PRD

Toutes les FR et NFR sont rattachées dans la Capability Map. Trous :

- **NFR-1** : le PRD demande que l'architecture confirme « LCP < 2,5 s ». Le spine n'en dit rien (ni confirmé, ni différé), et seul AD-21 est cité. Il manque une règle sur les images (`next/image` avec chargeur Cloudinary ou transformations Cloudinary, tailles, chargement différé).
- **FR-29** « le suivi du transporteur indique la livraison » : aucune intégration transporteur n'est décidée ni différée. Si c'est manuel au MVP, il faut le dire.
- **FR-9** « délai de priorité » entre inscrits : dépend du balayage. Sur Hobby, une fois par jour, la règle est inapplicable (voir AQ-2).
- **NFR-6** « transfert des adresses à des artistes hors UE » et **régions d'hébergement** (Neon, fonctions Vercel) : non décidés, non différés.
- **NFR-2** (métadonnées, sitemap, canoniques) : pas de règle sur la fonction unique de métadonnées et de sitemap. C'est mineur, mais c'est une divergence classique entre fiche et page artiste.

### A.7 Enveloppe opérationnelle

| Dimension | État dans le spine | Remarque |
|---|---|---|
| Environnements | Décidé (AD-22) + AQ-3 | Correct. |
| Application des migrations | **Absente** | Constat 1. |
| Sauvegarde et restauration | Affirmé (« restauration à un instant donné ») | Neon Free : fenêtre de **6 h** seulement (web, docs Neon 2026) ; Launch 7 jours, Scale 30 jours. La « période de vérification » d'AD-20 dépasse 6 h : il faut décider le plan Neon ou le mettre en question ouverte. |
| Plan Vercel | AQ-2 | Les conditions Hobby interdisent l'usage commercial : une place de marché qui vend des œuvres est un usage commercial, donc **Pro sera de toute façon requis avant l'ouverture au public**. AQ-2 devrait l'énoncer ainsi, et la question restante est « quand ». Cron Hobby : une fois par jour, déclenchement à ±59 min (confirmé, web) ; le nombre de tâches Hobby varie selon les sources (2 par compte dans la doc de 2025, 100 par projet dans des sources tierces de 2026) : à revérifier. |
| Version de Node | Fausse | Constat 2. |
| Protection de `api/balayage` | Non précisée | Fixer un en-tête secret (`CRON_SECRET`, comme le fait Vercel Cron) et sa vérification dans un seul endroit. |
| Régions et localisation des données | Absente | Ajouter une question ouverte (UE recommandée, cohérente avec PostHog UE). |
| Prestataire d'e-mail | AQ-1 | Correct. |
| Observabilité | Différée | Correct. |
| Domaine, DNS, rotation des secrets | Absents | Mineur ; à différer explicitement. |

### A.8 Justification hors du spine

C'est globalement respecté. Quelques fragments de justification restent dans les Rules : AD-15 « ce qui satisfait FR-34 sans reconnexion », AD-17 « ce qui laisse OQ-12 possible sans la trancher », AD-7 « la protection ne dépend jamais de son passage ». Ils sont mineurs et peuvent rester s'ils servent de consigne ; sinon, les déplacer dans le memlog.

### A.9 OQ-1 et OQ-16

Elles restent bien **ouvertes**. AD-4 est compatible avec les deux variantes, l'adaptateur `stripe-checkout` est ratifié sans être choisi, et Remboursement et Reversement restent manuels. Conforme à la consigne.

### A.10 Respect de la politique du dépôt

- **OQ-9 (PostHog UE)** est présentée comme « tranchée par le porteur », mais `docs/decisions-porteur.md` §4 laisse toujours « Outil de mesure souhaité : … » vide. La politique d'AGENTS.md exige qu'une décision structurante figure dans ce fichier ou dans un document BMAD *validé* (le spine est `status: draft`). *Correction* : reporter le choix dans `decisions-porteur.md` (ou valider le spine) avant l'epic mesure.
- État Git : le memlog annonce une branche `architecture/errancy` créée depuis `origin/main` ; la copie locale est sur `ux/specification-ux-errancy`, et le dossier `architecture/` n'est pas suivi. C'est à régulariser au moment du commit.

## B. Vérification de la réalité

| Affirmation du spine ou du memlog | Vérifié | Résultat |
|---|---|---|
| Next.js 14.2.35 dernier correctif de la branche 14 | npm (`next-14` = 14.2.35, publié le 2025-12-11) | **Exact.** |
| Next.js 16.4.3 au 2026-10-27 | npm (`latest` = 16.4.3, publié le 2026-10-23) | **Exact.** Noter que 15.5.28 (`backport`, 2026-10-14) est encore maintenue : c'est une marche intermédiaire possible, non évoquée. |
| Next 16 : Node ≥ 20.9 | npm `engines` et guide officiel | Exact pour Next, mais **insuffisant pour la pile** (constat 2). |
| Next 16 : `middleware.ts` → `proxy.ts` | Guide officiel 16.4.3 | **Exact.** En plus : le runtime edge n'est **pas** pris en charge dans `proxy` (Node.js seulement) ; le nom d'export recommandé est `proxy`, même avec un export par défaut. |
| Next 16 : `revalidateTag` à adapter | Guide officiel | **Exact** : deuxième argument (profil `cacheLife`) requis ; la forme à un argument est obsolète et provoque une erreur TypeScript ; `updateTag` (actions serveur) pour lire sa propre écriture aussitôt. Impact sur AD-21 (voir A.1). |
| Next 16 et lint | Guide officiel | **Non mentionné dans le spine** : `next lint` supprimé, build sans lint, ESLint ≥ 9 pour `eslint-config-next@16` (constat 3). |
| NextAuth 5.0.0-beta.32 | npm (`beta` = 5.0.0-beta.32, publié le 2026-07-20) | **Exact.** Pairs : `next ^14 \|\| ^15 \|\| ^16`, `react ^18.2 \|\| ^19`, donc compatible avec Next 16. Lockfile actuel en beta.31 : la mise à jour est à faire. |
| NextAuth v5 avec `proxy.ts` (export par défaut) | Web (blogs, pas de doc Auth.js officielle trouvée) | **Plausible, non confirmé officiellement.** La doc Auth.js montre encore `export { auth as middleware }`. À valider par une préversion dans l'epic Next 16, ce que le memlog prévoit déjà. |
| Prisma 7.10.1 stable, 8 en RC | npm | **Exact**, mais `latest` = **8.0.0-rc.27** (piège, constat 6). `engines` : `^20.19 \|\| ^22.12 \|\| >=24`. |
| Index partiels en préversion depuis 7.4 | npm (7.4.0 publié le 2026-02-11) + blog et changelog Prisma (web) | **Exact** : `previewFeatures = ["partialIndexes"]`, `where: raw(...)` ou forme objet, avec prise en charge par Migrate. |
| `@auth/prisma-adapter` avec Prisma 7 | npm (2.11.3, pair `@prisma/client >=2.26 … >=6`) | Accepté par la plage. Fonctionne dans le code actuel (Prisma 7.8), mais n'est pas déclaré pour 7 : à surveiller. |
| Vitest 5.0.5 | npm (`latest` = 5.0.5, publié le 2026-10-15) | **Exact**, mais exige Node ≥ 22.12, `@types/node` ≥ 22 et Vite 6 à 8 (constat 2). |
| framer-motion 11 avec React 19 | npm | **À préciser** : 11.0 à 11.11 ont un pair `react ^18` seulement ; 11.18.2 (celle du lockfile) accepte `^18 \|\| ^19`. Écrire « 11.18.x (minimum pour React 19) ». La branche courante est 12.x (`latest` = 12.6.0). |
| PostHog UE | Memlog (posthog.com/eu) ; npm posthog-js 1.438.24 | Cohérent (instance UE séparée, consentement requis). Le SDK est à épingler dans l'epic, comme prévu. Décision à reporter dans `decisions-porteur.md` (A.10). |
| Vercel Hobby : tâche planifiée au plus quotidienne, usage non commercial | Web | **Exact** (une fois par jour, ±59 min). Le nombre de tâches est incertain selon les sources. La clause non commerciale rend Pro obligatoire pour une place de marché (A.7). |
| Stripe 22.x installé | `package.json` ^22.1.1 ; npm 23.0.1 | Exact. `src/lib/stripe.ts` force `apiVersion: '2026-04-22.dahlia' as any` : à garder dans l'adaptateur. |
| Neon : restauration à un instant donné | Web (docs Neon) | **Dépend du plan** : 6 h en Free (A.7). |
| ESLint | npm (`latest` 10.13.0, `maintenance` 9.39.5) ; projet en 8.57 | ESLint 8 n'est plus maintenu ; la montée est forcée par Next 16. |

## Autres remarques (faible gravité)

- Stack : « TypeScript 5.x (strict) » ; Next 16 exige ≥ 5.1 (le projet est en ^5.5 : OK).
- Les Conventions disent « Modèles Prisma existants inchangés jusqu'à leur migration », mais le nommage français des nouveaux modèles (par exemple `Reservation` contre `Artwork`) donnera un schéma mixte anglais et français. C'est acceptable, à condition de le dire explicitement pour éviter qu'un agent renomme l'existant.
- Le diagramme de l'Interface n'a pas d'arête vers `reglages` (AD-17 veut que l'interface le consulte) ni vers `livraison` (prix sur la fiche). Le tableau des couches l'autorise, mais le diagramme et le tableau devraient dire la même chose.
- `Exhibition` et `ArtworkExhibition` ne figurent dans aucune ligne d'AD-2 : il faut les rattacher à `catalogue` (lecture seule) ou les dire « en l'état » comme `/expositions`.

## Sources

- [Guide de passage à Next.js 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (lu dans le paquet next@16.4.3 `dist/docs`)
- [Prisma ORM v7.4 : index partiels](https://www.prisma.io/blog/prisma-orm-v7-4-query-caching-partial-indexes-and-major-performance-improvements), [changelog Prisma 2026-02-11](https://www.prisma.io/changelog/2026-02-11), [fonctionnalités non prises en charge par Migrate](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/unsupported-database-features), [issue #14651](https://github.com/prisma/prisma/issues/14651)
- [Vercel : dépréciation de Node.js 20](https://vercel.com/changelog/node-js-20-is-being-deprecated), [versions de Node.js sur Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [cron : usage et tarifs](https://docs.vercel.com/docs/cron-jobs/usage-and-pricing), [limites Vercel](https://vercel.com/docs/limits)
- [Neon : fenêtre d'historique](https://neon.com/docs/postgres/backup-restore/history-window)
- [Guide de migration de l'authentification vers proxy.ts (Medium)](https://medium.com/@securestartkit/next-js-proxy-ts-auth-migration-guide-ff7489ec8735), [Auth0 : nouveautés de Next.js 16](https://auth0.com/blog/whats-new-nextjs-16/)
- `npm view` (2026-10-27) : next, next-auth, prisma, vitest, framer-motion, eslint-config-next, @auth/prisma-adapter, posthog-js, stripe, eslint
