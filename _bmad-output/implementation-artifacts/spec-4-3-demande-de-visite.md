---
title: 'Story 4.3 — Demande de visite à distance ou en atelier'
type: 'feature'
created: '2026-11-10'
status: 'ready-for-dev'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-4-2-demande-de-selection.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le visiteur qui hésite devant une œuvre chère ne peut pas demander à la voir avant de se décider : aucune demande de visite n'est enregistrée ni accusée (FR-8, UJ-4, UX-DR44).

**Approach:**
- Page `/galerie/[id]/visite` : type de visite (à distance, ou en atelier si l'artiste l'accepte), deux ou trois créneaux dans le fuseau de l'appareil, coordonnées ; le module `demandes` enregistre la demande rattachée à l'œuvre, à l'état `nouvelle`.
- Un événement `DemandeVisiteRecue` déclenche, comme à la 4.2, l'accusé au visiteur et l'alerte à l'équipe (un seul e-mail chacun, même rejoué).

## Boundaries & Constraints

**Always:**
- Décisions du porteur du 2026-11-10 : délai de réponse annoncé pour une visite = 48 heures, la valeur unique `DELAI_REPONSE_DEMANDE_HEURES` déjà utilisée pour la sélection ; aucun lien vers la page sur la fiche avant la story 4.7 (la page n'est joignable que par son adresse).
- Mêmes règles, limites et mécanismes que la story 4.2 (formulaire, validation, anti-abus par IP et e-mail avec empreintes salées, doublon, e-mails par gestionnaires, journaux et charges en identifiants seulement) ; alerte à l'équipe à `CONTACT_EQUIPE` avec le numéro et un lien vers l'administration, sans donnée personnelle (décision du porteur du 2026-11-10 pour les demandes, reprise ici).
- « En atelier » n'est proposé que si `Artwork.visitesAtelier` vaut vrai (story 2.6), lu par `catalogue` et exposé dans le type d'affichage ; refus côté serveur si la demande en atelier vise une œuvre dont l'artiste ne l'accepte pas.
- Page réservée à une œuvre visible et disponible (`estVisible`/`estDisponible`) ; œuvre inconnue, non visible, vendue, réservée ou retirée : 404. Le pays de livraison n'entre pas en compte (visite conservée pour un pays non livré).
- Créneaux : deux ou trois, distincts, dans le futur et à 90 jours au plus ; saisis par le visiteur dans le fuseau de l'appareil, enregistrés en UTC avec le fuseau IANA de l'appareil (validé), affichés dans ce fuseau (écran, accusé) ; jamais le fuseau de Paris imposé (UXQ-10, hypothèse retenue).
- Les coordonnées de l'artiste n'apparaissent jamais (écran, e-mails, alerte) ; la visite est organisée par l'équipe Errancy ; aucun mot sur le canal de la visite, sa durée ni sa gratuité (OQ-8 ouverte).
- Confirmation à l'écran : « Demande reçue. Nous vous répondons sous [délai]. » ; textes dans `fr`, vouvoiement ; champs : e-mail obligatoire, téléphone facultatif ; test navigateur de l'interaction.

**Never:**
- Barre d'actions de la fiche (story 4.7) ; file d'administration des demandes (4.6) ; réservation de l'œuvre pour le visiteur (Epic 6) ; mesure (4.8).
- Prestataire ou SDK hors de l'adaptateur de la 4.1 ; migration autre qu'additive ; toucher à `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Visite à distance | deux créneaux valides, e-mail | demande `nouvelle` rattachée à l'œuvre, confirmation avec délai, un accusé, une alerte | — |
| Visite en atelier | œuvre dont l'artiste accepte | même chose, type « en atelier » | — |
| Atelier refusé | artiste n'accepte pas (ou non renseigné) | option absente de l'écran | refus serveur sans enregistrement |
| Créneaux fautifs | moins de 2, plus de 3, doublons, passé, au-delà de 90 jours, illisible | message sous le champ, résumé en tête, saisie conservée | rien d'enregistré |
| Œuvre non disponible | vendue, réservée, retirée, brouillon, inconnue | 404 | refus serveur |
| Double appui | deux envois identiques | une seule demande | « Envoi… » ; contrôle serveur |
| Trop d'envois | seuil dépassé (IP ou e-mail) | refus sans message technique | message neutre |
| Événement rejoué | répartition répétée | un seul accusé, une seule alerte | réclamation déjà prise : rien |
| E-mail refusé | prestataire en échec | demande enregistrée et confirmée | échec journalisé (ids seulement) |
| Journaux et charges | lecture après envoi | ni adresse, ni téléphone, ni créneaux, ids seulement | — |

</frozen-after-approval>

## Code Map

- `src/lib/demandes/` (`index.ts`, `selection.ts`, `selection-regles.ts` de la 4.2) -- modèle à suivre : limites par empreintes (`TentativeInscription`, clés `visite-ip`/`visite-email`), doublon sous verrou consultatif (`$executeRaw`), événement dans la transaction puis `repartirApresValidation` ; ajouter `visite.ts` (`enregistrerDemandeVisite`) et `visite-regles.ts` (règles pures : type, créneaux, fuseau, coordonnées ; partagées avec le formulaire).
- `prisma/schema.prisma` + migration additive -- type `TypeVisite` (`distance`, `atelier`) et table `DemandeVisite` (rattachée à `Artwork`, créneaux en UTC, fuseau, e-mail, téléphone, état `EtatDemande` déjà créé à la 4.2).
- `src/lib/catalogue/` (`artworks.ts`, `mappers.ts`), `src/lib/types/index.ts` -- exposer `visitesAtelier` dans le type d'affichage `Artwork` ; l'écran lit `getArtworkBySlug` (œuvre visible), refuse une œuvre `sold`.
- `src/lib/evenements/catalogue.ts`, `src/lib/abonnements.ts`, `src/lib/notifications/{gestionnaires.ts,contenus.ts,index.ts}` -- événement `DemandeVisiteRecue` (charge `{ demandeId }`), gestionnaires `envoyerAccuseVisite` (titre de l'œuvre, type, créneaux dans le fuseau du visiteur, délai) et `alerterEquipeVisite`.
- `src/app/galerie/[id]/visite/` (page, formulaire client, actions serveur), `src/lib/reglages/index.ts`, `src/lib/i18n/fr.ts`, `.eslintrc.js` (`SURFACES_TEXTES`) -- page, textes `fr.visite` et `fr.courriels`, limites.
- `tests/demandes-visite.test.ts` (base réelle, adaptateur factice), `tests/navigateur/formulaire-visite.test.tsx` ; `AGENTS.md`, `docs/migrations.md`.

## Tasks & Acceptance

**Execution:**
- [ ] `prisma/` -- type `TypeVisite`, table `DemandeVisite` et migration additive
- [ ] `src/lib/demandes/`, `src/lib/catalogue/`, `src/lib/types` -- règles pures, enregistrement, limites, exposition de `visitesAtelier`
- [ ] `src/lib/notifications/`, `src/lib/evenements/`, `src/lib/abonnements.ts` -- accusé de visite et alerte à l'équipe
- [ ] `src/app/galerie/[id]/visite/`, `reglages`, `fr` -- page, formulaire, textes
- [ ] tests (base réelle et navigateur), `AGENTS.md`, `docs/migrations.md`

**Acceptance Criteria:**
- Given `/galerie/[id]/visite` d'une œuvre disponible, when le visiteur choisit le type de visite et propose deux ou trois créneaux, then « En atelier » n'est proposé que si l'artiste accepte les visites et les créneaux s'affichent dans le fuseau de l'appareil.
- Given une demande valide, when elle est enregistrée, then elle est rattachée à l'œuvre à l'état `nouvelle`, l'écran affiche « Demande reçue. Nous vous répondons sous [délai]. », un seul accusé part et une alerte sans donnée personnelle part vers l'équipe.
- Given une étape de la demande, when on lit l'écran ou les e-mails, then les coordonnées de l'artiste n'apparaissent jamais.

## Verification

**Commands:**
- `npx eslint .` et les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Préversion : la page s'affiche pour une œuvre disponible, enregistre une demande (vérification par SQL) ; l'adaptateur « journal » est actif, aucun e-mail réel.
