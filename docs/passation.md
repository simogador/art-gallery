# Passation du projet Errancy

Document écrit le 2026-11-16 pour un nouveau membre de l'équipe. Il dit où en est le projet, quels
accès demander, comment on travaille et ce qui reste à décider. La source de vérité de l'avancement est
`_bmad-output/implementation-artifacts/sprint-status.yaml` ; celle des règles de code est `AGENTS.md`.

## 1. Où en est le projet

Errancy est une place de marché d'art : les artistes vendent via le site, Errancy prend 30 %
(Next.js 14, TypeScript, Prisma 7 sur PostgreSQL Neon, NextAuth v5, Cloudinary, Resend, PostHog,
déployé sur Vercel).

- **Epics 1 à 4 : livrés.** Sécurité et intégration continue, catalogue et curation, pages publiques,
  demandes de conseil et de visite, « Me prévenir », mesure avec consentement, annonce de l'ouverture.
- **Epic 5 : à faire.** Mise à jour technique (Next 16, React 19, ESLint 9), `src/proxy.ts`, répartition
  des événements par `after()`.
- **Epic 6 : stories 6.1 à 6.6 livrées.** Commandes par artiste, réservation sans double vente, vente
  assistée par l'équipe, paiement constaté à la main, paiement tardif et incidents, vente ailleurs
  pendant une réservation. **Reste la 6.7** (balayage des réservations échues et priorité « Me prévenir »).
- **Epics 7 et 8 : à faire.** Pages de confiance, panier public, encaissement par un prestataire,
  suivi des commandes, puis la partie artiste et l'après-vente.

Le site est **en maintenance** et l'**achat en ligne est fermé**. Les ventes se font aujourd'hui en
**vente assistée** : l'équipe réserve les œuvres pour un acheteur depuis `/dashboard/admin/commandes`,
constate le paiement à la main et marque les remboursements effectués.

## 2. Ce qui n'est pas encore fait et qu'il faut savoir

- **Aucun e-mail de commande** : ni confirmation à l'acheteur, ni « Nouvelle commande » à l'artiste, ni
  alerte à l'équipe, ni message d'annulation ou de remboursement. L'équipe prévient l'acheteur elle-même
  (`deferred-work.md`). C'est une story à part, à écrire.
- **Aucun remboursement réel** : l'équipe rembourse à la main puis marque « effectué ».
- **Rien ne tourne tout seul** : les réservations échues et les commandes abandonnées ne sont fermées que
  par un nouvel événement ou par l'équipe. Le déclencheur automatique n'est pas choisi (AQ-2).
- **Les incidents n'ont pas d'écran de résolution** : ils restent affichés.
- `_bmad-output/implementation-artifacts/deferred-work.md` liste tout ce qui a été reporté, avec la raison.

## 3. Décisions encore ouvertes (ne pas les trancher dans le code)

Une décision structurante n'est prise que si elle figure dans `docs/decisions-porteur.md` ou dans un
document BMAD validé. Sinon, elle se pose comme question ouverte au porteur.

- **OQ-1** : montage de paiement et entité d'exploitation (bloque l'encaissement intégré, le
  remboursement réel et le reversement aux artistes).
- **OQ-16** : un paiement partiel, ou qui ne couvre qu'une partie des commandes d'un passage, reste refusé.
- **OQ-3** : assiette de la commission.
- **OQ-2 et OQ-4** : garanties, durée et gratuité du retour (rien de tel n'est affiché).
- **AQ-2** : déclencheur du balayage et des rejeux (plan Vercel Pro ou déclencheur externe planifié) ;
  nécessaire avant la story 6.7.

## 4. Accès à demander, et qui les donne

Seul le porteur donne ces accès. Ne jamais envoyer un secret par message ou par e-mail : utiliser un
gestionnaire de mots de passe partagé.

| Service | Rôle conseillé | Remarque |
|---|---|---|
| GitHub `simogador/art-gallery` | Write | La branche `main` doit exiger une PR et les quatre checks. |
| Vercel (projet `errancy`) | Member ou Developer | Voit les préversions. Les variables de production restent au porteur. |
| Neon | Lecture et SQL | Les migrations de production restent un acte du porteur, sauf délégation écrite. |
| Cloudinary, Resend, PostHog, Stripe | Au besoin | Stripe sert au code historique ; l'achat reste fermé. |
| Domaine et DNS | Au besoin | |

Variables d'environnement connues (noms seulement) : `DATABASE_URL`, `AUTH_SECRET`, `MAINTENANCE_MODE`,
`LOT2_OUVERT`, `RESEND_API_KEY`, `WHATSAPP_NUMERO`, `MESURE_CLE`, `MESURE_ADRESSE`, plus celles de Stripe et
de Cloudinary. Elles vivent dans Vercel (production et préversion) et, en local, dans `.env.local`, jamais
commité.

## 5. Comment on travaille

Une story = une branche = une PR, avec ce déroulé (méthode BMAD, skill `bmad-build`) :

1. Une spec courte est rédigée, avec les questions ouvertes ; le porteur répond puis approuve.
2. L'implémentation est faite dans la spec, puis relue par trois relectures indépendantes ; le tri est
   consigné dans la spec (`Review Triage Log`).
3. Vérifications locales avant de pousser : `npx eslint .`, les trois
   `node scripts/verifier-exceptions-prisma.cjs origin/main` (avec `tests/exceptions-interface.cjs` et
   `eslint/exceptions-textes.cjs`), `npm test`, `npm run test:navigateur`, `npm run build`.
4. Un seul commit, une PR en brouillon, la CI (« Lint et build », « Migrations », « Tests », « Navigateur »)
   doit être verte.
5. Si la story change `schema.prisma`, le porteur applique la migration à la main (voir ci-dessous) avant
   la fusion.
6. Après la fusion, une petite PR de suivi passe la story à `done` et ajoute la ligne du journal de
   migration dans `docs/migrations.md`.

## 6. Appliquer une migration (acte du porteur)

Jamais dans le build Vercel, jamais en CI, jamais `prisma db push` sur une base partagée.

1. Dans Neon, créer une branche de sauvegarde de la production, par exemple `sauvegarde-avant-6-7-AAAA-MM-JJ`
   (la limite est de 10 branches : supprimer la plus ancienne si besoin).
2. Dans l'éditeur SQL de Neon, sur la branche **preview** : exécuter le SQL de la migration, puis l'ajout de
   la ligne dans `_prisma_migrations` (identifiant, empreinte SHA-256 du fichier, nom, dates, une étape).
3. Contrôler en lecture seule (existence des tables, colonnes ou valeurs, une seule ligne de migration).
4. Vérifier la préversion de la PR.
5. Répéter sur la branche **production**, puis fusionner la PR.

Les empreintes et contrôles de chaque migration sont dans `docs/migrations.md`.

## 6 bis. Vérifier une préversion

Les préversions sont en maintenance comme le site. Il faut ouvrir l'adresse **propre au déploiement**
(bouton « Visit » du déploiement dans Vercel, du type `errancy-xxxxxxxxx-…vercel.app`), pas l'alias de
branche qui renvoie vers la production. Aller sur `/auth/connexion` de cette adresse, se connecter avec un
compte administrateur, puis ouvrir la page à vérifier. Ne rien constater ni annuler sur des données réelles.

## 7. Règles à ne pas enfreindre

- Ne jamais lever la maintenance ni toucher `public/robots.txt` ou `MAINTENANCE_MODE` : ce sont des actes du
  porteur.
- Ne jamais ouvrir l'achat en ligne : il se pilote par `LOT2_OUVERT`, lu seulement par `lot2Ouvert()`.
- Ne jamais modifier `src/generated/prisma/` (régénéré par `prisma generate`).
- Ne jamais commiter de secret ; jamais d'adresse e-mail ni d'IP dans les journaux.
- Ne jamais remplacer la pile existante.
- Une PR dont un check est rouge ne se fusionne pas.

## 8. À lire en premier

1. `AGENTS.md` : règles et description de chaque module, story par story.
2. `docs/decisions-porteur.md` : décisions déjà prises.
3. `docs/strategie-refonte.md` et `docs/analyse-projet.md`.
4. `docs/migrations.md` : historique et procédure des migrations.
5. `_bmad-output/implementation-artifacts/sprint-status.yaml` et `deferred-work.md`.
6. `_bmad-output/planning-artifacts/` : PRD, architecture, UX, épics.
7. `_bmad-output/implementation-artifacts/` : une spec par story livrée, avec les décisions et la revue.

## 9. Pièges connus

- Un `middleware.ts` à la racine est ignoré : il doit rester dans `src/middleware.ts`.
- Une apostrophe brute dans du texte JSX français casse le build : écrire `&apos;`.
- Sans `DATABASE_URL`, `npm run build` réussit mais affiche des erreurs Prisma : ce n'est pas un échec.
- Les tests tournent sur un vrai PostgreSQL (`TEST_DATABASE_URL`) ; ne jamais les lancer contre une base partagée.
- Après un changement de rôle, un administrateur doit se reconnecter pour voir le site en maintenance.

## 10. Travailler avec Claude

L'historique d'une session ne se transmet pas. La mémoire du projet est dans `AGENTS.md` et
`_bmad-output/`, que Claude lit au démarrage. Pour une nouvelle story, lancer le skill `bmad-build` en
indiquant la story visée.
