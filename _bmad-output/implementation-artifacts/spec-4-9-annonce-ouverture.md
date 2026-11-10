---
title: 'Story 4.9 — Annonce de l''ouverture aux contacts de la maintenance'
type: 'feature'
created: '2026-11-10'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-4-1-emails-transactionnels.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Des personnes ont laissé leur e-mail sur la page de maintenance pour être prévenues de l'ouverture (FR-35, story 1.9) ; rien ne permet aujourd'hui de les prévenir, sauf l'export CSV et un envoi à la main.

**Approach:**
- Une page d'administration « Annoncer l'ouverture » : l'administrateur voit combien de contacts seront prévenus, confirme, et chacun reçoit une seule fois l'e-mail « Ouverture du site » (annonce et lien vers l'accueil), avec un lien de désinscription.
- Le bouton ne lève pas la maintenance et ne touche pas `robots.txt` : ces actes restent ceux du porteur, dans Vercel et dans le dépôt.

## Boundaries & Constraints

**Always:**
- Seul l'acteur `admin` (`acteurCourant()`, relu en base) déclenche l'annonce ; vérifié côté serveur et par test.
- Le consentement recueilli (« J'accepte qu'Errancy conserve mon e-mail pour me prévenir de l'ouverture, et seulement pour cela », `public/maintenance.html`) ne couvre que cette annonce : un seul e-mail par contact, aucun autre usage de la liste.
- Un second déclenchement n'écrit à aucun contact déjà prévenu ; il ne relance que ceux dont l'envoi a échoué. Un contact n'est considéré prévenu qu'après l'acceptation de son e-mail par le port d'envoi (4.1) : son adresse est alors supprimée de `InscriptionOuverture` (aucune colonne de date d'envoi) ; il ne reste donc dans la liste que les contacts à prévenir et ceux dont l'envoi a échoué.
- Confirmation en deux temps : la page affiche le nombre de contacts à prévenir, puis un second geste (« Envoyer à N personnes ») déclenche l'envoi ; résultat affiché : prévenus, échecs, restants.
- E-mail par le port `EnvoiCourriel` (4.1) : prestataire seulement en production, adaptateur « journal » ailleurs (AD-22) ; clé d'idempotence par contact ; envoi séquentiel, borné en durée ; adresse et contenu jamais dans les journaux ; un échec d'envoi n'interrompt pas les suivants.
- Contenu pur dans `notifications/contenus.ts`, textes dans `fr.courriels` (vouvoiement, annonce courte et lien vers l'accueil `urlAbsolue('/')`, pied de page et lien Conseil de la 4.4/4.1) : texte à relire par le porteur avant l'envoi réel ; rien d'inventé (ni date, ni prix, ni nombre d'œuvres).
- Lien de désinscription : jeton d'usage `desinscription` (AD-14, `src/lib/acces/jetons.ts` seulement, empreinte SHA-256, durée longue) ; `/auth/desinscription/[jeton]` (page publique, sans connexion, `Referrer-Policy: no-referrer`) confirme que l'adresse n'est plus gardée (elle est déjà supprimée après l'envoi ; elle est retirée si l'envoi avait échoué) ; un lien déjà utilisé ou périmé le dit sans erreur technique.
- Envoi d'essai (décision du porteur du 2026-11-10) : un bouton envoie le même e-mail à l'adresse de l'administrateur connecté seulement (lue en base), jamais à un contact, sans rien écrire dans la liste ; hors production il passe par le journal.
- Décisions du porteur du 2026-11-10 : l'adresse du contact est supprimée dès l'envoi accepté ; envoi d'essai proposé avant l'envoi réel.
- Textes dans `fr`, aucun texte en dur ; accessibilité de la page (focus, annonces, cibles de 44 px).

**Never:**
- Lever la maintenance, modifier `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/` ; envoyer à une autre liste que les contacts de la maintenance ; programmer l'envoi ou le répéter automatiquement.
- Migration autre qu'additive ; export ou suppression en masse nouveaux.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Ouverture de la page | admin, N contacts à prévenir | N affiché, aucun envoi | — |
| Envoi | admin confirme | un e-mail par contact, adresse supprimée dès l'envoi accepté, bilan affiché | échec d'un envoi : compté, les autres partent |
| Second déclenchement | contacts déjà prévenus (adresses supprimées) | aucun doublon ; seuls les échecs sont relancés | rien à envoyer : message clair |
| Aucun contact | liste vide | « Aucun contact à prévenir. », bouton absent | — |
| Accès interdit | visiteur, `user`, `artist` | redirection ; action refusée côté serveur | test |
| Désinscription | lien valide | contact retiré, page de confirmation | lien utilisé ou périmé : message neutre |
| Envoi d'essai | admin | e-mail à sa seule adresse, liste intacte | échec : message, rien d'autre |
| Hors production | préversion | adaptateur « journal », aucun envoi réel | — |
| Maintenance | levée ou non | le bouton ne la change pas | — |

</frozen-after-approval>

## Code Map

- `src/lib/demandes/` (`index.ts`, propriétaire de `InscriptionOuverture`) -- API : contacts à prévenir (nombre, liste), suppression après envoi accepté, retrait par désinscription ; `compterInscriptionsOuverture` existe.
- `src/lib/acces/jetons.ts` et `prisma/schema.prisma` -- usage `desinscription` ajouté à `UsageJeton` (migration additive : `ALTER TYPE … ADD VALUE`, aucune colonne) ; émission et consommation du jeton seulement par `acces`.
- `src/lib/notifications/` -- `annonce.ts` (envoi séquentiel, bilan), `contenus.ts` (`contenuOuverture`), `fr.courriels.ouverture` ; port et adaptateurs de la 4.1 inchangés.
- `src/app/dashboard/admin/ouverture/` (page, action serveur, confirmation en deux temps), `AdminNav`, carte « Inscrits à l'ouverture » de `/dashboard/admin` (lien vers la page).
- `src/app/auth/desinscription/[jeton]/` -- page publique de désinscription.
- `tests/annonce-ouverture.test.ts` (base réelle, adaptateur factice : un seul envoi par contact, relance des échecs, accès admin, désinscription, jeton périmé), `tests/navigateur/` si une interaction est ajoutée ; `AGENTS.md`, `docs/migrations.md`.

## Tasks & Acceptance

**Execution:**
- [ ] `prisma/` et `src/lib/acces/` -- usage `desinscription`, migration additive
- [ ] `src/lib/demandes/` et `src/lib/notifications/` -- contacts à prévenir, envoi, bilan, contenu de l'e-mail
- [ ] `src/app/dashboard/admin/ouverture/`, `src/app/auth/desinscription/`, `AdminNav`, `fr` -- pages
- [ ] tests (base réelle, navigateur), `AGENTS.md`, `docs/migrations.md`

**Acceptance Criteria:**
- Given des contacts consentants, when l'administrateur confirme l'annonce, then chacun reçoit une seule fois l'e-mail « Ouverture du site » avec un lien de désinscription, et la page affiche le bilan.
- Given un second déclenchement, when il a lieu, then aucun contact déjà prévenu ne reçoit un deuxième e-mail.
- Given le lien de désinscription, when on l'ouvre sans être connecté, then le contact est retiré et la page le confirme.
- Given le bouton, when on l'utilise, then la maintenance et `robots.txt` ne changent pas.

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Préversion : les comptes administrateur ne s'y connectent pas ; vérification par SQL et journal. En production, avant l'envoi réel : relire l'e-mail d'essai ; l'envoi réel est le geste du porteur, le jour de l'ouverture.
