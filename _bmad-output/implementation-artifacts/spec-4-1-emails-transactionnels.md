---
title: 'Story 4.1 — E-mails transactionnels fiables'
type: 'feature'
created: '2026-11-10'
status: 'ready-for-dev'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'équipe envoie à la main le lien d'invitation d'un artiste (montré une seule fois à l'écran) et ne prévient pas l'artiste du résultat de curation de son œuvre ; aucun e-mail ne part du site (FR-34, FR-25, AD-11, AQ-1, UX-DR44).

**Approach:**
- Un module `notifications` avec un port d'envoi d'e-mail, un adaptateur pour le prestataire choisi par le porteur et un adaptateur « journal » hors production.
- Trois événements (invitation émise, œuvre validée, œuvre renvoyée) déclenchent l'e-mail par un gestionnaire ; un même événement traité deux fois ne produit qu'un e-mail ; le jeton d'invitation est émis au moment de l'envoi et n'existe en clair que dans l'e-mail.

## Boundaries & Constraints

**Always:**
- Décisions du porteur du 2026-11-10 : prestataire = Resend, région UE (AQ-1) ; expéditeur « Errancy <contact@errancy.art> », réponses reçues à la même adresse (`CONTACT_EQUIPE`) ; chaque e-mail se termine par « Une question ? Écrivez-nous à contact@errancy.art » (le lien Conseil WhatsApp s'ajoute avec la story 4.4) ; si l'envoi échoue, l'écran de l'équipe le dit (« L'e-mail n'est pas parti ») et permet de relancer l'invitation, sans jamais montrer le lien en clair (AD-14).
- Aucun nom de prestataire ni SDK hors de l'adaptateur et des variables d'environnement ; clé d'API dans une variable Vercel, jamais dans le dépôt.
- Hors production (local, préversion), jamais de vrai envoi : adaptateur « journal » (ids seulement, jamais d'adresse).
- Contenu : dictionnaire `fr`, vouvoiement, sans jargon ; charges d'événements et journaux : identifiants seulement.
- Réclamation atomique de `TraitementEvenement` avant tout envoi (story 3.4) ; événements déclarés au catalogue, reliés dans `abonnements.ts`, testés.

**Never:**
- Remplacer le lien d'invitation, la durée (`DUREE_INVITATION_JOURS`) ni la charte de la story 2.4 ; migration autre qu'additive ; balayage des échecs (AQ-2 ouverte).
- Toucher à `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Invitation | l'admin invite un artiste | e-mail « Invitation » (lien « Créer mon accès », durée) ; jeton émis à l'envoi | envoi refusé : « L'e-mail n'est pas parti », invitation relançable, lien jamais montré |
| Œuvre validée | « Valider » par l'équipe | e-mail « Résultat de curation » : œuvre publiée | — |
| Œuvre renvoyée | « Renvoyer » avec commentaire | e-mail avec le commentaire de l'équipe | — |
| Événement traité deux fois | répartition puis rejeu | un seul e-mail | réclamation déjà prise : rien |
| Hors production | local ou préversion | aucun envoi réel ; ligne de journal (ids) | — |
| Journaux et charges | lecture après envoi | ni adresse ni téléphone, identifiants seulement | — |

</frozen-after-approval>

## Code Map

- `src/lib/acces/invitations.ts` (`inviterArtiste`, jeton émis et rendu à l'admin) et `src/app/dashboard/admin/artistes/{actions.ts,InvitationArtiste.tsx}` -- invitation actuelle, lien montré une fois ; l'émission passe au gestionnaire.
- `src/lib/curation/file.ts` (`validerOeuvre`, `renvoyerOeuvre`), `decisions.ts` -- ajouter l'écriture d'événements dans la transaction puis `repartirApresValidation`.
- `src/lib/evenements/{catalogue.ts,index.ts}`, `src/lib/abonnements.ts`, table `TraitementEvenement` -- nouveaux événements, gestionnaires, réclamation atomique.
- `src/lib/notifications/` (nouveau ; déjà dans `MODULES_METIER` de `.eslintrc.js`) -- port, adaptateurs, contenus ; `src/lib/reglages/index.ts` (`CONTACT_EQUIPE`) ; `src/lib/i18n/fr.ts` -- textes.
- `tests/` -- matrice sur base réelle avec adaptateur factice ; `AGENTS.md`, `docs/decisions-porteur.md`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/notifications/` -- port d'envoi, adaptateur du prestataire, adaptateur « journal », choix par environnement
- [ ] `src/lib/evenements/catalogue.ts`, `src/lib/abonnements.ts` -- événements d'invitation et de curation, gestionnaires
- [ ] `src/lib/acces/invitations.ts`, `src/lib/curation/file.ts`, écrans admin -- émission d'événements, jeton émis à l'envoi
- [ ] `src/lib/i18n/fr.ts` -- textes des trois e-mails
- [ ] `tests/notifications.test.ts` -- matrice ; `AGENTS.md`, `docs/`

**Acceptance Criteria:**
- Given une invitation, une validation ou un renvoi, when l'action réussit, then un seul e-mail part (jamais deux, même après rejeu).
- Given un environnement hors production, when un e-mail devrait partir, then rien n'est envoyé et seul un journal sans adresse est écrit.
- Given le code, when on cherche le nom du prestataire, then il n'est que dans son adaptateur et les variables d'environnement.

## Implementation Notes

## Design Notes

Décisions prises sans question : l'événement d'invitation ne porte que l'id de l'invitation ; l'adresse est lue en base au moment de l'envoi ; l'e-mail du résultat de curation est envoyé à l'adresse du compte de l'artiste.

## Verification

**Commands:**
- `npx eslint .` et les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Préversion : l'adaptateur « journal » est actif (aucun e-mail réel) ; l'envoi réel se vérifie en production avec le prestataire choisi.
