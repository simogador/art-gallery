---
title: 'Story 2.4 — Invitation et premier accès de l''artiste'
type: 'feature'
created: '2026-11-02'
status: 'done'
route: 'dispatch'
baseline_commit: '285b6f5b932ddd542564fe658aea1b51ca3ade21'
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
- [x] `prisma/schema.prisma` + migration `20261102013809_invitations_artistes` -- deux tables, sans écart.
- [x] `src/lib/acces/jetons.ts`, `invitations.ts`, `index.ts` -- module.
- [x] `src/lib/reglages/index.ts` -- réglages.
- [x] `src/app/dashboard/admin/artistes/*` -- invitation.
- [x] `src/app/auth/invitation/*` -- ouverture et activation.
- [x] Espace artiste -- navigation et pages vides.
- [x] `tests/invitations.test.ts` -- matrice I/O, dont double envoi concurrent et cloisonnement.
- [x] `docs/migrations.md` (story 2.4) et `AGENTS.md` (jetons et invitations).
- [x] `scripts/sql/fiche-artiste-porteur.sql` -- modèle de création de la fiche du porteur (valeurs à compléter), hors code applicatif.

**Acceptance Criteria:**
- Given la base, when on lit `Jeton`, then aucune valeur en clair n'y figure.
- Given la migration appliquée, when on revient au commit précédent, then le site fonctionne (tables ignorées).

## Implementation Notes

- Migration `20261102013809_invitations_artistes` : produite par `prisma migrate dev --create-only` contre PostgreSQL 16 local ; enum `UsageJeton`, tables `Jeton` (empreinte unique, index `usage, cible`) et `Invitation` (cascade sur `Artist`). Aucune colonne ajoutée aux tables existantes.
- `acces/jetons.ts` : `randomBytes(32)` en base64url (43 caractères, format vérifié avant toute lecture), empreinte SHA-256 hexadécimale ; `consommerJeton` = mise à jour conditionnelle (`consommeLe` et `revoqueLe` nuls, échéance future), donc un seul gagnant sous deux envois simultanés (testé).
- `acces/invitations.ts` : e-mail normalisé (minuscules) ; refus `deja_relie`, `email_utilise`, `email_invalide`, `introuvable`, `acces_refuse`. Réinvitation : révoque les jetons des invitations non acceptées de l'artiste. Activation : contrôles de saisie, puis une transaction (consommation, création du `User` `artist`, rattachement conditionnel `userId IS NULL`, charte datée et versionnée) ; toute erreur annule la consommation (e-mail pris entre-temps → `email_utilise`, jeton toujours valable, testé).
- Charte provisoire dans `acces/charte.ts` (7 articles, version `2026-11-02-provisoire`) ; durée (7 jours) et `CONTACT_EQUIPE` dans `reglages`.
- Admin : `InvitationArtiste` sous chaque artiste sans compte (« Inviter » / « Renvoyer une invitation », invitation en attente affichée), lien construit sur l'origine de la requête (`x-forwarded-host`/`host`, `x-forwarded-proto`), montré une fois avec « Copier ».
- `/auth/invitation/[jeton]` (GET, 303) : cookie `invitation` httpOnly, `Secure` en https, `SameSite=Lax`, chemin `/auth/invitation`, expire à l'échéance ; lien invalide → cookie effacé. `Referrer-Policy: no-referrer` posé par la route et par `next.config.mjs` (`/auth/invitation` et sous-chemins) ; `referrer` aussi dans les métadonnées de la page. Constantes du cookie dans `cookie.ts` et vue « lien expiré » dans `LienExpire.tsx` (Next.js n'admet que ses propres exports dans `route.ts` et `page.tsx`).
- Activation : `signIn('credentials')` vers `/dashboard/artiste` après effacement du cookie ; en cas d'échec de connexion, message « Votre accès est créé. Connectez-vous… ».
- Espace artiste : `DashboardNav` à quatre onglets texte, `aria-current`, basse sous `lg` (bordure haute 2 px sur l'onglet courant), latérale à partir de `lg` ; accueil réduit au bloc « Mes œuvres » (total exact ; les anciens compteurs « disponibles / vendues » et le chiffre d'affaires ne portaient que sur les 5 œuvres récentes et sont retirés) ; pages vides `commandes` et `paiements`.
- `scripts/sql/fiche-artiste-porteur.sql` : modèle à compléter, idempotent (`ON CONFLICT (slug) DO NOTHING`).
- Vérification dans le navigateur (`next start` local) : invitation par l'admin, ouverture du lien sur mobile (URL nettoyée, `no-referrer` sur les deux réponses), erreur de charte reliée au champ, création de l'accès et arrivée sur l'accueil (4 onglets, « Accueil » courant), page Commandes, second usage du lien → « Ce lien d'invitation a expiré. ». Aucune erreur de console.
- Liste d'exceptions Prisma inchangée (19) ; les nouveaux fichiers passent par `acces`.

## Review Triage Log

- En production sous maintenance, l'artiste activé est redirigé vers `/dashboard/artiste`, réécrit en page de maintenance (deux relecteurs) — high : vrai (`middleware.ts` ne laissait passer que `admin`) ; intent gap posé au porteur, qui a décidé (2026-11-02) de laisser les artistes accéder à leur seul espace ; patch (`passeLaMaintenance`, testée).
- Garde « fiche reliée après l'invitation » non testée (verification-gap) — vrai ; patch (test).
- Effacement du cookie non vérifié (route) et chemin ignoré par la simulation (action) (verification-gap) — vrai ; patch (assertions sur `Set-Cookie` et sur le chemin).
- Repli `AuthError` après création du compte non testé, formulaire laissé affiché (deux relecteurs) — medium : vrai ; patch (état `cree`, lien « Se connecter », test).
- Pages Commandes et Paiements absentes du test de rôle par page (verification-gap) — vrai ; patch (`tests/acces.test.ts`).
- Session déjà ouverte remplacée sans avertissement (le porteur s'invitera depuis son navigateur admin) — medium : vrai ; patch (avertissement sur la page, testé).
- Deux invitations simultanées du même artiste laissent deux liens valables — low : vrai (lecture sans verrou) ; patch (`SELECT … FOR UPDATE` sur la fiche).
- Même adresse invitée pour deux artistes : la seconde activation échoue après envoi — low : vrai ; patch (refus `email_invite_ailleurs`, testé).
- Mot de passe au-delà de 72 octets tronqué par bcrypt sans le dire — low : vrai ; patch (`mot_de_passe_long`, testé).
- Longueur minimale écrite en dur dans le formulaire et le message — low : vrai ; patch (`acces/regles.ts`, pur).
- `x-forwarded-host` / `x-forwarded-proto` à valeurs multiples : lien affiché une fois malformé — low : vrai ; patch (première valeur, testé).
- Copie dans le presse-papiers sans repli (http, permission refusée) — low : vrai ; patch (sélection et message).
- « Invitation envoyée » alors qu'aucun e-mail n'est envoyé — low : vrai ; patch (« Lien créé pour… »).
- Refus « Écrivez à l'équipe » sans adresse — low : vrai ; patch (adresse dans le message).
- Version de la charte non liée à son texte — low : vrai ; patch (test qui épingle l'empreinte du texte avec la version).
- Article « reprise » renvoyant à des conditions de retour non publiées (OQ-2/OQ-4 ouvertes) — low : vrai ; patch (conditions « communiquées avant l'ouverture des ventes en ligne »), à relire par le porteur.
- Jeton présent dans le chemin de la première requête, donc dans les journaux de l'hébergeur — low : vrai, inhérent à AD-14 (lien dans l'URL) ; commentaire corrigé, atténué par l'usage unique et l'échéance.
- Règle d'en-tête en double dans `next.config.mjs` — low : vrai (`:path*` couvre zéro segment) ; patch.
- Modèle SQL de la fiche exécutable à moitié rempli — low : vrai ; patch (bloc `DO` qui refuse tant qu'il reste un « < », répété en local).
- Aucune copie archivée du texte accepté, pas de relecture de la charte dans l'espace artiste — medium : vrai, mais la charte est provisoire et le texte versionné est dans git ; defer.
- Jetons orphelins ou échus jamais purgés, `cible` et `creeParId` sans clé étrangère — low : vrai ; defer (nettoyage avec le balayage d'AD-11).
- Agrégat `chiffreAffairesCentimes` encore calculé alors que l'accueil ne l'affiche plus ; lien « Voir mon profil public » retiré — low : l'agrégat sert les tests de 2.1/2.2 et reviendra avec « Ce qu'on vous doit » (Lot 2) ; le retrait du lien suit le critère (bloc « Mes œuvres » seul) ; rejeté.
- Artiste désactivé invitable — low : choix de l'admin (réactivation prévue) ; rejeté.
- Ids `gen_random_uuid()` dans le modèle SQL — low : colonne texte sans format imposé ; rejeté.

## Verification

**Commands:**
- `npx eslint .` ; `node scripts/verifier-exceptions-prisma.cjs origin/main` -- OK, liste inchangée.
- `npx tsc --noEmit` ; `npm test` -- tout passe.
- Migrations sur base vide puis `prisma migrate diff --exit-code` -- aucun écart.
- `npm run build` -- succès.
