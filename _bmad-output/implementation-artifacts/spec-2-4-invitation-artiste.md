---
title: 'Story 2.4 — Invitation et premier accès de l''artiste'
type: 'feature'
created: '2026-11-02'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md', '{project-root}/docs/migrations.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un artiste sélectionné ne peut pas entrer dans son espace : aucun compte n'est relié à une fiche artiste sans manipulation en base (FR-34, AD-14).

**Approach:**
- `acces` émet et vérifie des jetons (table `Jeton` générique d'AD-14 : empreinte SHA-256 unique, usage `invitation`, cible, échéance, consommation) ; table `Invitation` (artiste, e-mail, date et version de la charte acceptée). Valeur en clair : 32 octets aléatoires, jamais stockée ni journalisée.
- `/dashboard/admin/artistes` : « Inviter » sur un artiste sans compte, saisie de l'e-mail ; le lien (`<origine de la requête>/auth/invitation/<jeton>`) s'affiche une seule fois pour un envoi manuel. Une nouvelle invitation révoque la précédente non utilisée. Échéance lue dans `reglages` (7 jours par défaut, UXQ-8).
- `GET /auth/invitation/[jeton]` : jeton valide → cookie `httpOnly` (`Secure`, `SameSite=Lax`, chemin `/auth/invitation`, durée = échéance), redirection vers `/auth/invitation` sans jeton ; `Referrer-Policy: no-referrer` sur les deux. Page : e-mail prérempli en lecture seule, mot de passe (8 caractères au moins) et confirmation, case « J'accepte la charte artiste » avec le texte de la charte. À l'envoi, en une transaction : compte `artist` créé, rattaché à la fiche, charte enregistrée, jeton consommé ; puis connexion et arrivée sur `/dashboard/artiste`.
- Jeton inconnu, expiré, consommé ou révoqué : « Ce lien d'invitation a expiré. » et « Écrire à l'équipe ».
- Espace artiste : `artist-tabbar` (Accueil, Œuvres, Commandes, Paiements ; basse sur mobile, latérale à partir de `lg`, `aria-current`). Accueil réduit au bloc « Mes œuvres » ; Commandes et Paiements affichent un état vide (Lot 2).
- Migration appliquée par le porteur (SQL, ligne `_prisma_migrations`, SHA-256), `preview` puis production avant la fusion.

**Décisions du porteur (2026-11-02) :**
- Charte artiste : l'agent rédige une charte courte, provisoire et versionnée (`CHARTE_ARTISTE_VERSION`) à partir des engagements déjà décidés (œuvre originale et authentique, photos fidèles, disponibilité tenue à jour, emballage soigné, expédition dans les délais annoncés, reprise en cas de retour, commission de 30 %) ; le porteur la relit dans la PR.
- Validité de l'invitation : 7 jours.
- « Écrire à l'équipe » : `mailto:contact@errancy.art`, adresse lue dans `reglages`.
- Fiche artiste du porteur : hors story ; l'agent fournit un SQL qui la crée, et le porteur s'invite avec une seconde adresse (un compte n'a qu'un rôle).

## Boundaries & Constraints

**Always:** jetons créés et vérifiés seulement par `acces` ; comparaison par empreinte ; usage unique, y compris sous deux envois simultanés (consommation conditionnelle) ; aucun jeton, e-mail ni mot de passe dans les journaux ; mot de passe haché par bcrypt comme l'inscription ; droits vérifiés dans le module à partir de `acteurCourant()` ; liste d'exceptions Prisma qui ne grossit pas.

**Never:** envoi d'e-mail (epic 4) ; création d'une fiche artiste ; accord signé et publication (2.7) ; blocs « À expédier » et « Ce qu'on vous doit » (Lot 2) ; jetons `suivi`, `desinscription`, `commande_assistee` (autres epics) ; `MAINTENANCE_MODE`, `robots.txt`, `src/generated/prisma/`, secrets ; migration appliquée sur une base partagée par l'agent.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Invitation | admin, artiste sans compte, e-mail valide | lien affiché une fois ; seule l'empreinte en base | N/A |
| Hors admin | artiste, visiteur | rien n'est créé | `acces_refuse` |
| Artiste déjà relié | fiche avec `userId` | refus | `deja_relie` |
| E-mail déjà utilisé | un `User` a cet e-mail | refus, message explicite | `email_utilise` |
| Réinvitation | nouvelle invitation | l'ancien lien ne marche plus | N/A |
| Ouverture valide | `/auth/invitation/<jeton>` | cookie posé, redirection sans jeton, `no-referrer` | N/A |
| Lien invalide | inconnu, expiré, consommé, révoqué | « Ce lien d'invitation a expiré. » + « Écrire à l'équipe » | N/A |
| Activation | mot de passe valide, charte cochée | `User` `artist` relié à la fiche, charte datée, jeton consommé, connecté | N/A |
| Saisie invalide | mot de passe court ou différent, charte non cochée | erreur reliée au champ, rien n'est créé | message |
| Double envoi | deux activations simultanées | un seul compte | `invalide` pour la seconde |
| Cloisonnement | artiste A sur l'œuvre de B (API ou page) | refusé côté serveur | 404 |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` -- ajouter `Jeton` (`id`, `empreinte` unique, `usage` enum `UsageJeton` = `invitation` pour l'instant, `cible`, `echeance`, `consommeLe?`, `revoqueLe?`, `createdAt`) et `Invitation` (`id`, `artistId` → `Artist` cascade, `email`, `creeParId?`, `accepteeLe?`, `charteVersion?`, `createdAt`). `User`/`Artist` inchangés (relation seulement). Migration générée contre PostgreSQL local.
- `src/lib/acces/` (dans `MODULES_METIER`) -- nouveau `jetons.ts` (`emettreJeton`, `verifierJeton`, `consommerJeton`, `revoquerJetons`, empreinte `crypto.createHash('sha256')`, `randomBytes(32).toString('base64url')`) et `invitations.ts` (`inviterArtiste(acteur, artistId, email)`, `lireInvitation(jeton)`, `activerInvitation(jeton, { motDePasse, charteAcceptee })`), exportés par `index.ts`. bcrypt comme `src/app/auth/actions.ts` (`register`).
- `src/lib/reglages/index.ts` -- `DUREE_INVITATION_JOURS`, `CHARTE_ARTISTE_VERSION`, `CONTACT_EQUIPE` (`contact@errancy.art`) ; texte de la charte dans un fichier pur `src/lib/acces/charte.ts` (affiché par la page d'activation).
- `src/app/dashboard/admin/artistes/page.tsx` -- colonne « Accès » : relié (e-mail) ou bouton « Inviter » (composant client + action serveur, lien affiché une fois avec « Copier »). Reste lu par Prisma (déjà dans les exceptions) ; les écritures passent par `acces`.
- `src/app/auth/invitation/[jeton]/route.ts` (GET, cookie, redirection), `src/app/auth/invitation/page.tsx`, `actions.ts`, formulaire client ; `next.config` ou en-têtes de réponse pour `Referrer-Policy`. Le middleware laisse passer `/auth` en maintenance.
- `src/components/dashboard/DashboardNav.tsx`, `src/app/dashboard/artiste/layout.tsx`, `page.tsx`, nouvelles `commandes/page.tsx` et `paiements/page.tsx`.
- Cloisonnement : `src/app/api/artiste/oeuvres/[slug]/route.ts` (`getArtistArtwork`), `catalogue/espace-artiste.ts` (`oeuvreAEditer`) -- déjà filtrés par artiste ; à couvrir par un test.
- Tests sur base jetable : modèle `tests/livraison.test.ts` (mocks `@/lib/acces` partiels, `next/navigation`, `next/headers`).

## Tasks & Acceptance

**Execution:**
- [ ] `prisma/schema.prisma` + migration `<horodatage>_invitations_artistes` -- deux tables, sans écart.
- [ ] `src/lib/acces/jetons.ts`, `invitations.ts`, `index.ts` -- module.
- [ ] `src/lib/reglages/index.ts` -- réglages.
- [ ] `src/app/dashboard/admin/artistes/*` -- invitation.
- [ ] `src/app/auth/invitation/*` -- ouverture et activation.
- [ ] Espace artiste -- navigation et pages vides.
- [ ] `tests/invitations.test.ts` -- matrice I/O, dont double envoi concurrent et cloisonnement.
- [ ] `docs/migrations.md` (story 2.4) et `AGENTS.md` (jetons et invitations).
- [ ] `scripts/sql/fiche-artiste-porteur.sql` -- modèle de création de la fiche du porteur (valeurs à compléter), hors code applicatif.

**Acceptance Criteria:**
- Given la base, when on lit `Jeton`, then aucune valeur en clair n'y figure.
- Given la migration appliquée, when on revient au commit précédent, then le site fonctionne (tables ignorées).

## Verification

**Commands:**
- `npx eslint .` ; `node scripts/verifier-exceptions-prisma.cjs origin/main` -- OK, liste inchangée.
- `npx tsc --noEmit` ; `npm test` -- tout passe.
- Migrations sur base vide puis `prisma migrate diff --exit-code` -- aucun écart.
- `npm run build` -- succès.
