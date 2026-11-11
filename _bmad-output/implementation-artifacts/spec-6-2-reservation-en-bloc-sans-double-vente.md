---
title: 'Story 6.2 — Réservation en bloc sans double vente'
type: 'feature'
created: '2026-11-11'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-6-1-passage-en-caisse-et-commandes.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Une œuvre ne passe à `reservee` que par une déclaration manuelle ; aucune ligne ne dit pour qui, jusqu'à quand ni pourquoi. Sans réservation atomique, deux acheteurs peuvent payer la même œuvre (FR-12, AD-7, NFR-4, cas 1 : achat simultané).

**Approach:**
- Le module `disponibilite` (seul propriétaire de l'axe disponibilité) réserve en bloc les œuvres d'un passage en caisse : une transaction, mise à jour conditionnelle `disponible` → `reservee` de toutes ou d'aucune, refus `oeuvre_indisponible` nommant l'œuvre.
- Chaque réservation est une ligne `Reservation` ; un index unique partiel garantit une réservation active par œuvre, même sans verrou applicatif.
- Une réservation échue est libérée (issue `expiree`) dans la transaction de la nouvelle ; la protection ne dépend pas du balayage (6.7).
- Un plafond de réservations simultanées par e-mail et par appareil, une durée de réservation au paiement (30 minutes), tous deux dans `reglages`.
- Aucun appelant ni écran : 6.3 réserve pour la vente assistée, l'achat public est l'Epic 7.

## Boundaries & Constraints

**Always:**
- Table `Reservation` écrite seulement par `disponibilite` (id de l'œuvre, id du passage en caisse sans clé étrangère vers un autre module, origine `paiement` | `vente_assistee` | `priorite`, échéance, issue vide tant qu'active, empreintes salées de l'e-mail et de l'appareil, jamais l'adresse) ; issues `expiree`, `liberee`, `confirmee`, `interrompue` (les trois dernières servent aux stories 6.3, 6.4 et 6.6) ; enum complet dès cette story (migration additive).
- Réserver exige une œuvre visible (`VISIBLE`) et disponible (`DISPONIBLE`) ; la réservation et le passage de l'axe à `reservee` sont dans la même transaction, l'événement `DisponibiliteChangee` est écrit avec elle (AD-11), répartition attendue après la transaction.
- Index unique partiel « une réservation active par œuvre » déclaré avec la préversion Prisma `partialIndexes` (présente dans les moteurs 7.10) ; un test de CI vérifie qu'il existe en base (`pg_indexes`).
- Une réservation échue est libérée dans la transaction de la nouvelle (issue `expiree`, œuvre redevenue disponible, événement) ; une réservation du même passage ne bloque pas ce passage (appel répété = succès, aucune seconde ligne).
- Libération et expiration ne remettent à `disponible` que si l'œuvre est encore `reservee` (mise à jour conditionnelle) : une œuvre déclarée vendue ailleurs ou retirée entre-temps n'est jamais écrasée.
- Le plafond refuse la réservation suivante avec un code explicite (`plafond_atteint`) ; durée et plafond sont des constantes de `reglages`, jamais codées ailleurs ; l'empreinte de l'appareil est fournie par l'appelant (valeur opaque), absente = pas de contrôle par appareil.
- Fonctions aval avec `tx` facultatif (AD-3) ; aucun contrôle d'acteur (l'appelant le fait, 6.3 : admin) ; un test de concurrence sur le vrai PostgreSQL prouve qu'exactement un de deux passages obtient l'œuvre.

**Never:**
- Écrire `Artwork.disponibilite` hors de `disponibilite` ; balayage, déclencheur planifié et priorité « Me prévenir » (6.7) ; commande, constat et confirmation (6.4) ; annulation de commande sur « vendue ailleurs » (6.6) ; écran, route, e-mail, jeton (6.3) ; prestataire de paiement (OQ-1 ouverte) ; `LOT2_OUVERT`, `/api/checkout` et le webhook Stripe inchangés ; `prisma db push`, `migrate deploy` en CI ou au build ; `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Réservation en bloc | 3 œuvres disponibles, un passage | 3 lignes actives, 3 œuvres `reservee`, 3 événements | — |
| Une œuvre indisponible | l'une est vendue, retirée, déjà réservée | rien réservé, refus `oeuvre_indisponible` avec son slug | transaction annulée |
| Simultané | deux passages, même œuvre, même instant | exactement un réussit, l'autre `oeuvre_indisponible` | index unique partiel |
| Réservation échue | échéance passée, nouvelle tentative | ancienne `expiree`, nouvelle réussit, une seule active | — |
| Même passage | appel répété | succès, aucune ligne en plus | — |
| Plafond | plafond atteint par e-mail ou par appareil | refus `plafond_atteint`, rien réservé | — |
| Déclaration entre-temps | œuvre `vendue_ailleurs` pendant la réservation | libération ou expiration n'y touchent pas | mise à jour conditionnelle |
| Index absent | migrations appliquées | l'index unique partiel existe | test de CI |

</frozen-after-approval>

## Open Questions

1. **Quelles valeurs pour le plafond de réservations simultanées, et à qui s'applique-t-il ?** — options : A) 3 œuvres réservées en même temps par e-mail et 3 par appareil, appliqué aux seules réservations d'origine `paiement` (l'équipe réserve sans limite en vente assistée) (recommandé) / B) plafond plus strict, 1 passage à la fois par e-mail et par appareil, à préciser / C) plafond identique pour la vente assistée : l'équipe est aussi limitée par e-mail de l'acheteur.
2. **Que voit le visiteur quand une réservation est échue mais pas encore libérée ?** — sans balayage (6.7, AQ-2 ouverte), l'œuvre reste affichée « réservée » jusqu'à la prochaine tentative de réservation ; options : A) accepter cet écart, la protection reste exacte (l'échue est libérée dès qu'une nouvelle réservation est tentée) ; la fiche n'est corrigée qu'au balayage (recommandé : aucun appelant public avant l'Epic 7, et la vente assistée a la vue admin de 6.3) / B) faire lire « disponible » aux pages publiques dès l'échéance passée : touche le catalogue, son cache de 60 s et les inscriptions « Me prévenir ».

## Code Map

- `prisma/schema.prisma` + migration additive -- `Reservation` (`@@index` partiel unique via `previewFeatures = ["partialIndexes"]` du générateur), enums `OrigineReservation` et `IssueReservation` ; ne pas toucher `Artwork` ni `PassageEnCaisse`.
- `src/lib/disponibilite/` -- nouveau fichier `reservation.ts` (`reserverOeuvres`, `libererReservation`, `liberer…echues`) exporté par `index.ts` ; parties pures (échéance, codes de refus, plafond) dans `etats.ts` ou `reservation-regles.ts` ; réutiliser `lireEtatVerrouille`, `ecrireEvenement`, `repartirApresValidation` (modèle : `marquerVendues`, qui verrouille par `FOR UPDATE ORDER BY slug`) ; verrouiller dans un ordre fixe pour éviter les verrous mortels.
- `src/lib/reglages/index.ts` -- `DUREE_RESERVATION_PAIEMENT_MINUTES` (30) et `PLAFONDS_RESERVATION` (selon la réponse 1).
- `src/lib/evenements/catalogue.ts`, `src/lib/abonnements.ts` -- pas de nouvel événement : `DisponibiliteChangee` existe déjà.
- `src/lib/commandes/` -- ne pas modifier ; 6.3 appellera `reserverOeuvres` après `creerPassageEnCaisse` (ajouter alors `tx` à celle-ci).
- `tests/reservation.test.ts` (base réelle : bloc, indisponible, simultané, échue, même passage, plafond, déclaration entre-temps, présence de l'index via `pg_indexes`), `tests/disponibilite.test.ts` (règle « aucun autre fichier n'écrit ces colonnes »), `docs/migrations.md`, `AGENTS.md`.

## Tasks & Acceptance

**Execution:**
- [ ] `prisma/` -- `Reservation`, enums, index unique partiel, migration additive
- [ ] `src/lib/disponibilite/` -- réserver en bloc, libérer, expirer, plafond
- [ ] `src/lib/reglages/` -- durée et plafond
- [ ] tests (base réelle, concurrence), `AGENTS.md`, `docs/migrations.md`

**Acceptance Criteria:**
- Given des œuvres disponibles d'un passage, when on les réserve, then toutes passent à `reservee` avec une ligne `Reservation` chacune, ou aucune si l'une manque (`oeuvre_indisponible`, œuvre nommée).
- Given deux passages qui réservent la même œuvre au même instant, when le test de concurrence s'exécute, then exactement un obtient la réservation.
- Given une réservation échue, when une nouvelle est tentée, then l'ancienne est `expiree` et la nouvelle réussit dans la même transaction.
- Given le plafond atteint, when on réserve, then `plafond_atteint` et rien n'est écrit.
- Given les migrations appliquées, when le test de CI lit `pg_indexes`, then l'index unique partiel est présent.

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Migration appliquée par le porteur (sauvegarde `sauvegarde-avant-6-2-…`, `preview`, production, avant la fusion) ; aucun écran à vérifier.
