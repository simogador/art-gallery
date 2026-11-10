---
title: 'Story 4.5 — « Me prévenir » sur une œuvre réservée'
type: 'feature'
created: '2026-11-10'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-4-3-demande-de-visite.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le visiteur arrivé trop tard sur une œuvre réservée n'a que le Conseil WhatsApp : il ne peut pas laisser son e-mail pour être prévenu si l'œuvre redevient disponible (FR-9, inscription). La barre d'actions (4.7) et la file de l'équipe (4.6) attendent cette story.

**Approach:**
- Une inscription « Me prévenir » par œuvre réservée : page `/galerie/[id]/prevenir` (même modèle que la demande de visite), enregistrée par le module `demandes`, avec son ordre d'arrivée ; un e-mail de confirmation part avec un lien de désinscription sans connexion.
- La barre d'actions de la fiche propose « Me prévenir » pour une œuvre réservée, en plus du Conseil WhatsApp ; la file de l'équipe montre les inscriptions par œuvre (nombre et ordre).
- La notification quand l'œuvre redevient disponible, et la priorité, viennent avec les réservations (Epic 6) : cette story n'envoie rien de tel.

## Boundaries & Constraints

**Always:**
- Module `demandes` seul propriétaire de la table des inscriptions (nouvelle table additive : œuvre, e-mail normalisé, date d'arrivée ; unicité œuvre + e-mail) ; règles pures (validation de l'e-mail, textes d'erreur) dans `demandes/prevenir-regles.ts`, importables côté client ; messages dans `fr` (nouvelle clé), aucun texte en dur.
- Inscription possible seulement pour une œuvre visible (`VISIBLE`) à l'état `reservee` (prédicat de `disponibilite`, jamais de lecture directe de colonne) : sinon refus `oeuvre_indisponible` et la page répond 404 ; relue en base à l'inscription.
- Un e-mail déjà inscrit sur la même œuvre ne crée aucun doublon (contrainte d'unicité, insertion atomique), garde sa place d'arrivée, et reçoit le même écran ; aucune révélation d'une inscription existante autre que cet écran identique.
- Écran de réussite : « Nous vous écrirons si elle redevient disponible. » ; aucun autre usage de l'adresse (aucune annonce, aucune autre liste) ; aucune heure de fin de réservation montrée (jamais, ni en écran ni en e-mail).
- Anti-abus comme 4.2 et 4.3 : limites par IP et par e-mail (`LIMITES_INSCRIPTION_PREVENIR` de `reglages`, empreintes salées dans `TentativeInscription`), refus sans message technique, saisie invalide non comptée.
- Confirmation par e-mail (port `EnvoiCourriel`, 4.1, AD-22) : événement typé `InscriptionPrevenirRecue` (charge = id de l'inscription), gestionnaire `envoyerConfirmationPrevenir` dans `notifications` (un e-mail par événement même rejoué), contenu pur dans `contenus.ts`, textes dans `fr.courriels`, titre de l'œuvre et lien de désinscription ; jamais d'adresse dans les journaux.
- Lien de désinscription : jeton émis par `acces/jetons.ts` seulement (AD-14), valeur en clair seulement dans l'e-mail ; page publique `/auth/desinscription-alerte/[jeton]` (sans connexion, `Referrer-Policy: no-referrer`, `noindex`) qui retire l'inscription et le confirme ; lien utilisé, périmé ou mal formé : message neutre, sans erreur technique, sans accès à la base pour une valeur mal formée.
- Barre d'actions (4.7) : œuvre réservée = « Me prévenir » (lien vers `/galerie/[id]/prevenir`, action secondaire) + Conseil WhatsApp (principal) ; les autres états inchangés ; mise à jour de `fr.fiche.barre` et du paragraphe de la 4.7 dans `AGENTS.md`.
- File de l'équipe (4.6) : section « Me prévenir » de `/dashboard/admin/demandes` : par œuvre, nombre d'inscrits et ordre d'arrivée, admin seulement (`acteurCourant()`, vérifié dans le module), états vide, chargement et erreur existants conservés ; aucun changement d'état ni suppression par l'équipe.
- Test navigateur du formulaire (validation, saisie conservée, double appui) ; tests de base réelle (accès, doublon, ordre, anti-abus, désinscription, état non réservé) ; une œuvre `reservee` n'existant pas avant l'Epic 6, les tests posent l'état directement en base.

**Never:**
- Envoyer le moindre message au passage d'une œuvre de `reservee` à `disponible` (Epic 6, 6.7), priorité ou réservation d'un acheteur inscrit ; mesure de l'inscription (4.8 est close) ; durée de conservation chiffrée (à fixer avec les pages de confiance, Epic 7).
- Toucher à `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/` ; migration autre qu'additive ; coordonnées de l'artiste dans un écran ou un e-mail.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Inscription | œuvre réservée, e-mail valide | inscription et ordre enregistrés, écran de confirmation, e-mail avec lien de désinscription | e-mail non parti : l'inscription reste, journal sans adresse |
| Doublon | même e-mail, même œuvre | aucun doublon, ordre inchangé, même écran | — |
| Œuvre non réservée | disponible, vendue, retirée, invisible | page 404, action refusée `oeuvre_indisponible` | — |
| E-mail invalide | texte non conforme | message à la sortie du champ, rien enregistré ni compté | — |
| Trop d'envois | seuil par IP ou e-mail | refus `trop_de_demandes` sans détail technique | — |
| Désinscription | lien valide | inscription retirée, page de confirmation | lien utilisé, périmé, mal formé : message neutre |
| File de l'équipe | admin | inscrits par œuvre, nombre et ordre | accès refusé à visiteur, user, artist |
| Fiche réservée | barre d'actions | « Me prévenir » + Conseil WhatsApp, aucune heure de fin | — |

</frozen-after-approval>

## Open Questions

1. **Quel jeton pour le lien de désinscription ?** — options : A) un nouvel usage `desinscription_alerte` (migration additive d'une valeur d'enum) : la cible désigne sans ambiguïté l'inscription « Me prévenir », l'usage existant `desinscription` reste celui des contacts de maintenance (recommandé) / B) réutiliser `desinscription` avec une cible préfixée : pas de migration d'enum, mais une même valeur d'usage pour deux tables.
2. **Comment compter le rang d'arrivée ?** — options : A) calculé à l'affichage d'après la date d'arrivée (le plus ancien d'abord) : aucun nombre stocké, l'ordre est celui dont l'Epic 6 aura besoin pour la priorité ; si quelqu'un se désinscrit, les suivants avancent (recommandé) / B) numéro fixe enregistré à l'inscription : un numéro qui ne bouge jamais, avec des trous après les désinscriptions, et une colonne et un compteur à tenir sans conflit.
3. **Que deviennent les inscriptions quand l'œuvre est vendue ou retirée ?** — options : A) supprimées automatiquement au changement d'état (gestionnaire de l'événement `DisponibiliteChangee` existant) : elles ne servent plus et le consentement dit « seulement pour cela » (recommandé) / B) conservées sans limite en attendant les réservations (Epic 6) et la durée de conservation de l'Epic 7.

## Code Map

- `prisma/schema.prisma` + migration additive -- table des inscriptions « Me prévenir » (œuvre en `CASCADE`, e-mail normalisé, date d'arrivée, unicité œuvre + e-mail, index par œuvre et ordre) ; éventuelle valeur d'enum (réponse 1).
- `src/lib/demandes/prevenir.ts` et `prevenir-regles.ts` (à créer) -- `enregistrerInscriptionPrevenir`, désinscription, lecture pour l'équipe (admin seulement), réexport dans `index.ts` ; limites dans `reglages`.
- `src/lib/acces/` -- émission et consommation du jeton de désinscription (seul point d'entrée, AD-14).
- `src/lib/evenements/catalogue.ts`, `src/lib/abonnements.ts`, `src/lib/notifications/` -- événement `InscriptionPrevenirRecue`, gestionnaire, `contenuConfirmationPrevenir` ; suppression à la vente (selon la réponse 3).
- `src/app/galerie/[id]/prevenir/` (page serveur 404 hors œuvre réservée, `force-dynamic`, `noindex`, formulaire client sur le modèle de `/conseil` et `/visite`, action serveur), `src/app/auth/desinscription-alerte/[jeton]/`, `next.config.mjs` (en-tête de référent).
- `src/app/galerie/[id]/BarreActions.tsx`, `ArtworkDetail.tsx`, `fr.fiche.barre` -- « Me prévenir » pour l'état réservée.
- `src/app/dashboard/admin/demandes/` -- section « Me prévenir » ; `fr` ; `tests/prevenir.test.ts` (base réelle), `tests/navigateur/`, `tests/conseil-emplacements.test.ts` (barre) ; `AGENTS.md`, `docs/migrations.md`.

## Tasks & Acceptance

**Execution:**
- [ ] `prisma/` -- table des inscriptions et migration additive
- [ ] `src/lib/demandes/`, `acces`, `evenements`, `notifications` -- inscription, doublon, ordre, jeton, e-mail de confirmation
- [ ] `src/app/galerie/[id]/prevenir/`, `src/app/auth/desinscription-alerte/`, barre d'actions, section de la file, `fr`
- [ ] tests (base réelle, navigateur), `AGENTS.md`, `docs/migrations.md`

**Acceptance Criteria:**
- Given une œuvre réservée, when le visiteur laisse son e-mail, then l'inscription et son ordre sont enregistrés, l'écran dit « Nous vous écrirons si elle redevient disponible. » et un e-mail de confirmation avec lien de désinscription part.
- Given un e-mail déjà inscrit sur la même œuvre, when il s'inscrit de nouveau, then aucun doublon n'est créé et sa place ne change pas.
- Given le lien de désinscription, when il est ouvert sans être connecté, then l'inscription est retirée et la page le confirme.
- Given une œuvre non réservée, when on ouvre la page ou appelle l'action, then la page répond 404 et l'action refuse.
- Given une fiche réservée, when la barre s'affiche, then elle propose « Me prévenir » et Conseil WhatsApp, sans aucune heure de fin.

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Aucune œuvre ne peut être réservée avant l'Epic 6 : en préversion, vérification par SQL (état posé à la main sur une œuvre de test de la branche `preview` seulement, remis ensuite) ; jamais de changement d'état en production.
