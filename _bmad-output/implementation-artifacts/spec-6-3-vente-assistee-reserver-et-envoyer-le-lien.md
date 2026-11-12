---
title: 'Story 6.3 — Vente assistée : réserver pour un acheteur et lui envoyer son lien'
created: '2026-11-11'
status: 'done'
baseline_commit: 'aadbae4'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-6-2-reservation-en-bloc-sans-double-vente.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Après un conseil ou une visite, l'équipe ne peut ni réserver une œuvre pour un acheteur identifié ni lui donner un lien vers sa commande (FR-12, FR-26, UJ-4). Le passage en caisse (6.1) et la réservation (6.2) n'ont encore ni appelant ni écran.

**Approach:**
- Sur `/dashboard/admin/commandes`, l'admin (seul acteur) saisit e-mail, nom, pays et œuvres : en une transaction, passage en caisse (`commandes`) puis réservation `vente_assistee` (`disponibilite`, échéance réglable, 48 h) ; tout ou rien.
- Un événement du catalogue déclenche l'e-mail à l'acheteur ; le jeton `commande_assistee` est émis à l'envoi (AD-14) et n'existe en clair que dans l'e-mail.
- `/commande/[jeton]` échange le jeton contre un cookie `httpOnly` puis redirige vers `/commande`, sans jeton : récapitulatif du passage, moyen de paiement transmis par l'équipe, Conseil WhatsApp. Sa propre réservation ne le bloque pas.

## Boundaries & Constraints

**Always:**
- Seul l'acteur `admin` (`acteurCourant`, rôle relu en base) pose la réservation, vérifié dans le module et par test.
- Coordonnées : e-mail, nom, pays seulement (l'adresse de livraison viendra au paiement).
- Le jeton vit autant que la réservation (échéance = celle de la réservation) ; non consommé par l'échange (le lien de l'e-mail se rouvre jusqu'à l'échéance) ; page sans jeton relue en base à chaque requête : réservation active et non échue, sinon « Ce lien n'est plus actif » et Conseil.
- Montants lus sur les lignes figées de la commande ; aucun total additionné hors `livraison`.
- Aucun e-mail ni adresse dans les journaux ; `LOT2_OUVERT` sans effet (AD-17).

**Never:**
- Libération, vue des réservations, rattachement à la demande (FR-28), renvoi du lien, lecture des commandes ou bascule d'`Order` (stories suivantes, `deferred-work.md`) ; paiement, constat (6.4) ; balayage, « Me prévenir » (6.7) ; panier public (Epic 7) ; `/api/checkout`, webhook Stripe ; `prisma db push`, `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Pose | admin, 2 œuvres disponibles, coordonnées valides | passage, commandes, 2 réservations `vente_assistee`, e-mail parti | — |
| Œuvre prise | l'une indisponible, non livrée ou invalide | rien écrit, message nommant l'œuvre | refus typé de 6.1 ou 6.2 |
| Non admin | visiteur, utilisateur, artiste | refus `acces_refuse`, rien écrit | — |
| E-mail non parti | prestataire en échec | réservation posée, jeton révoqué, message « L'e-mail n'est pas parti » | — |
| Lien valide | jeton actif | cookie, redirection, récapitulatif | — |
| Lien inactif | inconnu, périmé, réservation échue ou terminée | « Ce lien n'est plus actif », Conseil | message neutre, rien consommé |

</frozen-after-approval>

## Review Triage Log

Passe 1 (trois relecteurs : aveugle, cas limites, lacunes de vérification).

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Lien ouvert avec un jeton inconnu ou périmé, ou panne de la base : le cookie d'une commande encore valable est effacé | medium | patch | `route.ts` supprime le cookie dans tous les cas d'échec. Corrigé : rien n'est touché en cas de panne, le cookie n'est supprimé que s'il porte le jeton refusé. |
| Panne de la base sur `/commande` : message « lien inactif » | medium | patch | Le `catch` confond panne et lien inactif. Message distinct (« Nous n'avons pas pu charger votre commande »). |
| Action `actionPoserVenteAssistee` et `lireIdentifiants` sans test qui les exécute | medium | patch | Le test navigateur simule l'action, le test serveur appelle le module. Tests ajoutés (durée, séparateurs, refus, non-admin). |
| Commentaire et `AGENTS.md` : « un échec de préparation révoque le lien » | low | patch | `preparerLienVenteAssistee` est avant le `try` ; si elle lève, sa transaction est annulée et aucun jeton n'existe : rien à révoquer. Textes corrigés. |
| Adresse de la fiche collée en entier au lieu de l'identifiant | low | patch | `lireIdentifiants` ne retient que le dernier segment du chemin. |
| `revalidatePath` sans données qui changent, commentaire de `next.config.mjs` déplacé | low | patch | Suppression directe ; commentaire remis à sa place ; test d'en-tête `/commande` ajouté comme pour les autres liens. |
| Œuvres bloquées si l'e-mail n'est pas parti (ni renvoi ni libération) | medium | defer | Conséquence connue du découpage décidé par le porteur le 2026-11-11 (1B) ; libération et renvoi sont déjà dans `deferred-work.md`. |
| Lien envoyé à une mauvaise adresse : aucune révocation possible par l'équipe | medium | defer | Même découpage : la révocation viendra avec la libération (noté). |
| Page de l'acheteur : une œuvre libérée ensuite resterait listée | low | defer | Aucune libération partielle n'existe avant la story suivante ; à traiter avec elle. |
| `/commande` inaccessible pendant la maintenance | medium | question au porteur | Décision de maintenance du porteur ; aucun code ne la lève (règle du projet). |
| Page `/dashboard/admin/commandes` : redirection d'un non-admin sans test | low | defer | L'écriture reste refusée par le module (testé) ; seule la visibilité de la page n'est pas figée. |
| Doublons de slugs réservés | false | rejet | `reserverOeuvres` dédoublonne (`new Set`, ligne 131). |
| E-mail brut passé à la réservation | false | rejet | `reserverOeuvres` normalise l'e-mail avant l'empreinte. |
| Conflit de numéro dans la transaction de l'appelant, prix lu avant le verrou, `envoye` dérivé d'un jeton, rejeu qui révoque le lien, limite de débit de la route, `lienActifDuPassage` qui lève | low | rejet | Cas rares ou sans dommage nommé ; chaque correction ajoute des gardes ou une surface (retour d'envoi enregistré, savepoint). |
| Pas de total général sur la page de l'acheteur | low | rejet | Choix délibéré : aucun montant ne s'additionne hors de `livraison` (règle d'AD-12). |
| Liste de tous les pays, focus après erreur, icône, nom de route, validation locale des bornes d'heures | low | rejet | Cosmétique ; le serveur revérifie tout. |
| `AGENTS.md` long, journal de migration sans ligne « appliquée » | low | rejet | Même format que les stories précédentes ; la ligne « appliquée » s'ajoute après l'application par le porteur. |
| Nom `lireCommandeAssistee` du Code Map, rollback d'une libération d'échue après refus | low | rejet | Texte de la spec non figé ; le rollback est le comportement de 6.2 (tout ou rien). |

## Code Map

- `src/lib/commandes/passage.ts` : `creerPassageEnCaisse` reçoit `tx` facultatif (AD-3) ; `src/lib/disponibilite/reservation.ts` : `reserverOeuvres(…, tx)` rend les ids d'événements, répartis après la transaction. Nouveau `src/lib/commandes/vente-assistee.ts` : `poserVenteAssistee(acteur, saisie)`, `lireCommandeAssistee(jeton)`.
- `prisma/schema.prisma` + migration additive : valeur `commande_assistee` de `UsageJeton` ; `src/lib/acces/` : `commande-assistee.ts` (émission, lecture, révocation, sur le modèle de `lien-invitation.ts`).
- `src/lib/evenements/catalogue.ts`, `src/lib/abonnements.ts`, `src/lib/notifications/` : événement `VenteAssisteePosee` (`{ passageId }`), gestionnaire relié par `via`, contenu pur dans `contenus.ts`, textes `fr.courriels`.
- `src/lib/reglages/index.ts` : `DUREE_RESERVATION_VENTE_ASSISTEE_HEURES` (48).
- `src/app/dashboard/admin/commandes/` (formulaire, pays de `livraison/pays`), entrée de `AdminNav` ; `src/app/commande/[jeton]/` et `src/app/commande/` ; `Referrer-Policy: no-referrer` dans `next.config.mjs` ; hors liste de `cheminMesurable`.
- Ne pas modifier : `lot2Ouvert()`, `/api/checkout`, webhook Stripe, `Order`. Tests : `tests/vente-assistee.test.ts` (base réelle), `tests/navigateur/`, `docs/migrations.md`, `AGENTS.md`.

## Tasks & Acceptance

**Execution:**
- [x] migration `UsageJeton.commande_assistee`, réglage de durée, `tx` de `creerPassageEnCaisse`
- [x] `poserVenteAssistee`, événement, gestionnaire d'envoi, jeton émis à l'envoi
- [x] page `/commande/[jeton]` puis `/commande`, formulaire admin, textes `fr`
- [x] tests, `AGENTS.md`, `docs/migrations.md`

**Acceptance Criteria:**
- Given l'admin et des œuvres disponibles, when il pose la réservation, then passage, commandes et réservations `vente_assistee` (échéance 48 h) sont écrits ensemble, ou rien si une œuvre manque.
- Given un autre acteur, when il tente la pose, then `acces_refuse` et rien n'est écrit.
- Given la pose réussie, when l'e-mail part, then le lien porte un jeton `commande_assistee` dont seule l'empreinte est en base, et un échec d'envoi révoque le jeton.
- Given un lien actif, when l'acheteur l'ouvre, then cookie `httpOnly`, redirection vers une URL sans jeton, récapitulatif des lignes figées et réservation en heure fixe.
- Given un lien inconnu, échu ou dont la réservation est terminée, when on l'ouvre, then « Ce lien n'est plus actif ».

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Migration appliquée par le porteur (sauvegarde, `preview`, production) avant la fusion ; ouvrir le lien en préversion (aucun e-mail réel hors production : lire le lien par SQL ou test).
