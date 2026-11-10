---
title: 'Story 4.5 — « Me prévenir » sur une œuvre réservée'
type: 'feature'
created: '2026-11-10'
baseline_commit: 'c84a7f0b4248268b5a17b18aefa1dbc971060ab7'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-4-3-demande-de-visite.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le visiteur arrivé trop tard sur une œuvre réservée n'a que le Conseil WhatsApp : il ne peut pas laisser son e-mail pour être prévenu si l'œuvre redevient disponible (FR-9, inscription). La barre d'actions (4.7) et la file de l'équipe (4.6) attendent cette story.

**Approach:**
- Une inscription « Me prévenir » par œuvre réservée : page `/galerie/[id]/prevenir` (même modèle que la demande de visite), enregistrée par le module `demandes`, avec son ordre d'arrivée (calculé d'après la date d'arrivée, le plus ancien d'abord, départage par id ; aucun numéro stocké ; si un inscrit se retire, les suivants avancent) ; un e-mail de confirmation part avec un lien de désinscription sans connexion.
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
- Lien de désinscription : jeton d'usage `desinscription_alerte` (nouvelle valeur d'`UsageJeton`, migration additive ; l'usage `desinscription` reste celui des contacts de la maintenance), cible = id de l'inscription, émis par `acces/jetons.ts` seulement (AD-14), valeur en clair seulement dans l'e-mail ; page publique `/auth/desinscription-alerte/[jeton]` (sans connexion, `Referrer-Policy: no-referrer`, `noindex`) qui retire l'inscription et le confirme ; lien utilisé, périmé ou mal formé : message neutre, sans erreur technique, sans accès à la base pour une valeur mal formée.
- Quand l'œuvre passe à `vendue`, `vendue_ailleurs` ou `retiree`, ses inscriptions sont supprimées par un gestionnaire de l'événement `DisponibiliteChangee` existant (état relu en base, ids seulement dans les journaux, une œuvre qui redevient disponible ou réservée ne supprime rien).
- Décisions du porteur du 2026-11-10 : usage de jeton dédié ; ordre calculé ; suppression des inscriptions à la vente ou au retrait.
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
| Œuvre vendue ou retirée | changement d'état | inscriptions supprimées, aucun e-mail | échec du gestionnaire : journalisé (ids), le `revalidate` de 60 s rattrape l'affichage, la suppression est rejouable |
| Désinscription | lien valide | inscription retirée, page de confirmation | lien utilisé, périmé, mal formé : message neutre |
| File de l'équipe | admin | inscrits par œuvre, nombre et ordre | accès refusé à visiteur, user, artist |
| Fiche réservée | barre d'actions | « Me prévenir » + Conseil WhatsApp, aucune heure de fin | — |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` + migration additive -- table des inscriptions « Me prévenir » (œuvre en `CASCADE`, e-mail normalisé, date d'arrivée, unicité œuvre + e-mail, index par œuvre et ordre) et valeur d'enum `desinscription_alerte`.
- `src/lib/demandes/prevenir.ts` et `prevenir-regles.ts` (à créer) -- `enregistrerInscriptionPrevenir`, désinscription, lecture pour l'équipe (admin seulement), réexport dans `index.ts` ; limites dans `reglages`.
- `src/lib/acces/` -- émission et consommation du jeton de désinscription (seul point d'entrée, AD-14).
- `src/lib/evenements/catalogue.ts`, `src/lib/abonnements.ts`, `src/lib/notifications/` -- événement `InscriptionPrevenirRecue`, gestionnaire, `contenuConfirmationPrevenir` ; gestionnaire de suppression à la vente ou au retrait (abonné à `DisponibiliteChangee`).
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

## Review Triage Log

| # | Source | Constat | Verdict | Route | Preuve / suite |
|---|--------|---------|---------|-------|----------------|
| 1 | Edge | Cycle d'imports `notifications → demandes → evenements → abonnements → notifications` : selon l'ordre de chargement, des gestionnaires restent `undefined` dans `ABONNEMENTS` (aucun e-mail ni suppression, seul un `console.error`) | high | patch | reproduit par un test jetable ; le cycle existait déjà via `annonce.ts` (4.9) mais était inoffensif, la 4.5 l'a rendu nuisible ; `abonnements.ts` relie les gestionnaires par import différé (`via`) ; `tests/abonnements-ordre.test.ts` pour chaque ordre de chargement |
| 2 | Blind, Edge | Course vente/inscription : une inscription peut rester sur une œuvre vendue (aucun verrou sur l'œuvre) | medium | patch | verrou partagé (`FOR SHARE`) sur l'œuvre avant de relire l'état ; refus `oeuvre_indisponible` ; test |
| 3 | Blind | « Un lien de désinscription figure dans l'e-mail de confirmation » est faux pour un e-mail déjà inscrit ou un envoi échoué | medium | patch | texte reformulé avec l'adresse de contact ; test |
| 4 | Blind, Edge | Section de l'équipe : une erreur de lecture fait tomber toute la file des demandes ; tri redondant | low | patch | `inscriptions_indisponibles`, message dans la section ; test |
| 5 | Blind, Verification Gap | `inputMode="email"` absent ; `aria-describedby`, non-mesure de `/prevenir`, échec du gestionnaire de suppression, vente réelle, barre réservée avec Lot 2 ouvert non testés | low | patch | tests ajoutés |
| 6 | Blind | La promesse « Nous vous écrirons si elle redevient disponible » n'est tenue qu'avec l'Epic 6 | medium | rejet | texte exact validé par le porteur (critère d'acceptation de la story) ; l'écran n'est atteignable qu'avec l'état `reservee`, posé par l'Epic 6 ; consigné dans AGENTS.md |
| 7 | Edge | « Annuler » une déclaration « vendue ailleurs » ou « retirée » ne rétablit pas les inscriptions supprimées | medium | defer | décision du porteur sur la suppression (3A) ; attendre la fin du délai d'annulation à décider ; limite consignée ; deferred-work.md |
| 8 | Blind, Edge | Pas de double confirmation de l'adresse : un tiers peut recevoir une confirmation (limites 10 par IP et 5 par e-mail et par heure) | medium | defer | choix de produit (double opt-in) ; deferred-work.md |
| 9 | Edge | Suppression à la vente échouée : aucun balayage (AQ-2 ouverte) | low | defer | même règle que les autres gestionnaires ; consigné |
| 10 | Blind, Edge | Lien consommé en GET (scanners de messagerie) | low | rejet | même limite que la 4.9 ; l'inscription se refait en un geste |
| 11 | Blind, Edge | Limites non atomiques, alias `+tag`, rotation d'IP, oracle temporel du doublon, œuvre dépubliée gardant ses inscrits, cache de 60 s sur la page | low | rejet | limites héritées des stories 4.2 et 4.3 ; le serveur revérifie à l'envoi |
| 12 | Verification Gap | `docs/migrations.md` non mis à jour ; test navigateur non lancé par le relecteur | false | rejet | le journal s'écrit après application par le porteur ; le test navigateur passe en local (81) et en CI |
| 13 | Edge, Verification Gap | Pendant la maintenance, `/auth/desinscription-alerte/*` est réécrit vers la page de maintenance | low | rejet | aucune inscription n'existe pendant la maintenance ; même cas que la 4.9 |

