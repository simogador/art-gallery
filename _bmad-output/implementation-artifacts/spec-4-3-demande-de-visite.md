---
title: 'Story 4.3 — Demande de visite à distance ou en atelier'
type: 'feature'
created: '2026-11-10'
status: 'done'
baseline_commit: 'ba9cd17ce658f1ad49ce110bafba6d9be06c19f2'
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
- `prisma/schema.prisma` + migration additive -- type `TypeVisite` (`distance`, `atelier`) et table `DemandeVisite` (rattachée à `Artwork` par un `artworkId` facultatif en `ON DELETE SET NULL` : la demande survit à la suppression de l’œuvre, décision du porteur du 2026-11-10 ; créneaux en UTC, fuseau, e-mail, téléphone, état `EtatDemande` déjà créé à la 4.2).
- `src/lib/catalogue/` (`artworks.ts`, `mappers.ts`), `src/lib/types/index.ts` -- exposer `visitesAtelier` dans le type d'affichage `Artwork` ; l'écran lit `getArtworkBySlug` (œuvre visible), refuse une œuvre `sold`.
- `src/lib/evenements/catalogue.ts`, `src/lib/abonnements.ts`, `src/lib/notifications/{gestionnaires.ts,contenus.ts,index.ts}` -- événement `DemandeVisiteRecue` (charge `{ demandeId }`), gestionnaires `envoyerAccuseVisite` (titre de l'œuvre, type, créneaux dans le fuseau du visiteur, délai) et `alerterEquipeVisite`.
- `src/app/galerie/[id]/visite/` (page, formulaire client, actions serveur), `src/lib/reglages/index.ts`, `src/lib/i18n/fr.ts`, `.eslintrc.js` (`SURFACES_TEXTES`) -- page, textes `fr.visite` et `fr.courriels`, limites.
- `tests/demandes-visite.test.ts` (base réelle, adaptateur factice), `tests/navigateur/formulaire-visite.test.tsx` ; `AGENTS.md`, `docs/migrations.md`.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/` -- type `TypeVisite`, table `DemandeVisite` et migration additive
- [x] `src/lib/demandes/`, `src/lib/catalogue/`, `src/lib/types` -- règles pures, enregistrement, limites, exposition de `visitesAtelier`
- [x] `src/lib/notifications/`, `src/lib/evenements/`, `src/lib/abonnements.ts` -- accusé de visite et alerte à l'équipe
- [x] `src/app/galerie/[id]/visite/`, `reglages`, `fr` -- page, formulaire, textes
- [x] tests (base réelle et navigateur), `AGENTS.md`, `docs/migrations.md`

**Acceptance Criteria:**
- Given `/galerie/[id]/visite` d'une œuvre disponible, when le visiteur choisit le type de visite et propose deux ou trois créneaux, then « En atelier » n'est proposé que si l'artiste accepte les visites et les créneaux s'affichent dans le fuseau de l'appareil.
- Given une demande valide, when elle est enregistrée, then elle est rattachée à l'œuvre à l'état `nouvelle`, l'écran affiche « Demande reçue. Nous vous répondons sous [délai]. », un seul accusé part et une alerte sans donnée personnelle part vers l'équipe.
- Given une étape de la demande, when on lit l'écran ou les e-mails, then les coordonnées de l'artiste n'apparaissent jamais.

## Verification

**Commands:**
- `npx eslint .` et les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Préversion : la page s'affiche pour une œuvre disponible, enregistre une demande (vérification par SQL) ; l'adaptateur « journal » est actif, aucun e-mail réel.

## Spec Change Log

- 2026-11-10 (relecture, constat 3) : une œuvre supprimée effaçait ses demandes de visite (`ON DELETE CASCADE`). Décision du porteur : garder la demande, sans lien vers l'œuvre (`artworkId` facultatif, `ON DELETE SET NULL`). Modifié : Code Map (ci-dessous). État évité : demandes de visiteurs perdues avant toute réponse. KEEP : tout le reste de l'implémentation (module `demandes`, règles, formulaire, e-mails, tests) est conservé tel quel.

## Review Triage Log

| # | Source | Constat | Verdict | Route | Preuve / suite |
|---|--------|---------|---------|-------|----------------|
| 1 | Verification Gap | L'option `jourSemaine` n'est jamais vérifiée par un texte littéral (les tests comparent la fonction à elle-même) | medium | patch | essai : « mardi 17 novembre 2026 » ; assertion littérale à ajouter dans `tests/i18n.test.ts` |
| 2 | Verification Gap | La correction d'heure d'été de `heureMuraleEnUtc` n'est testée que là où elle rend null | medium | patch | essai : `2026-03-29T01:30` Paris → `00:30Z` ; assertions à ajouter |
| 3 | Blind | `ON DELETE CASCADE` : une œuvre supprimée (route `DELETE` de l'artiste, œuvre publiée comprise) efface les demandes des visiteurs | medium | patch (après décision du porteur) | `src/app/api/artiste/oeuvres/[slug]/route.ts:96` ; porteur : garder la demande → `SET NULL` |
| 4 | Blind, Edge | Les traces d'envoi sont comptées avant le contrôle de doublon et hors du verrou : un renvoi absorbé ou un échec de base consomme le quota | low | rejet | même mécanisme que la 4.2 (spec : « mêmes mécanismes ») ; double appui déjà bloqué côté écran ; correction = déplacer le comptage dans la transaction (complexité) pour un cas rare |
| 5 | Blind, Edge | Œuvre réservée ou vendue entre la relecture et l'écriture : demande enregistrée quand même | low | rejet | fenêtre de quelques millisecondes ; l'équipe traite la demande (4.6) ; garde supplémentaire = complexité |
| 6 | Blind | Aucune contrainte `CHECK` sur le nombre de créneaux ni `NOT NULL` | low | rejet | le module `demandes` est seul écrivain et valide 2 à 3 créneaux ; Prisma n'écrit jamais null dans une liste |
| 7 | Blind | L'équipe ne peut pas lire une demande sans SQL ; l'alerte ne dit ni l'œuvre ni le type | low | rejet | hors intention : la file est la story 4.6 (« Never ») ; contenu de l'alerte décidé par le porteur (numéro et lien) |
| 8 | Blind | Couplages : `lireTelephone` lié aux limites de la sélection, `empreinte` recopiée, valeurs de limites répétées | low | rejet | partage voulu ; aucun appelant ne diverge aujourd'hui ; même forme que la 4.2 |
| 9 | Blind, Edge | Heure répétée au passage à l'heure d'hiver choisie sans le dire (Paris : seconde occurrence, Montréal : première) | low | rejet | vérifié par essai ; créneau entre 1 h et 3 h du matin une nuit par an : rare ; correction = nouvelle règle et message |
| 10 | Blind | « En atelier » lu dans le cache (60 s) par la page, en direct par le serveur ; double lecture de l'œuvre (métadonnées et page) | low | rejet | `visitesAtelier` ne change presque jamais après publication ; le serveur fait foi avec un message sous le champ ; lecture en cache (`enCache`) |
| 11 | Blind | Statut `in-progress` dans `sprint-status.yaml` contre `in-review` dans la spec | false | rejet | la présentation (étape 5) passe la story à `review` |
| 12 | Blind | Test de page qui parcourt l'arbre JSX à la main | low | rejet | fragile mais vérifie bien le 404 et l'option atelier ; pas de lecture du texte source |
| 13 | Blind | `min` du sélecteur = minute en cours, que la règle refuse (« à venir ») | low | patch | correction directe : minute suivante |
| 14 | Blind | Liens du résumé vers les groupes et refus `invalide` sur les créneaux non testés en navigateur | low | rejet | même mécanisme que `/conseil` (testé à la 4.2) ; refus `invalide` sous un champ déjà testé (atelier) |
| 15 | Blind | Nom brut du fuseau affiché (« fuseau America/Montreal ») | low | rejet | lisible et exact ; la spec demande l'affichage dans le fuseau de l'appareil |
| 16 | Edge | Créneau accepté dans quelques minutes alors que la réponse arrive sous 48 heures | low | rejet | conforme à la spec (« dans le futur ») ; l'équipe propose d'autres créneaux ; un délai minimal serait une décision du porteur (signalée) |
| 17 | Edge | Envoi avant que le fuseau soit lu (hydratation lente) | false | rejet | sans hydratation, `onSubmit` n'est pas branché ; après, l'effet qui lit le fuseau s'exécute avant toute interaction possible |

