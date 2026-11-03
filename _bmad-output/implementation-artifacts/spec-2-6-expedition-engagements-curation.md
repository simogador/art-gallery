---
title: 'Story 2.6 — Expédition par zone, engagements et envoi en curation'
type: 'feature'
created: '2026-11-03'
status: 'done'
route: 'dispatch'
baseline_commit: '5c4582905fa6c95db55078f3f3e2e74b78cee31e'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-2-5-deposer-une-oeuvre.md', '{project-root}/docs/migrations.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le formulaire de dépôt (2.5) laisse les sections 4. Expédition et 5. Engagements « À compléter » sans saisie possible, et aucune œuvre ne peut quitter le brouillon : l'équipe ne reçoit rien à valider et Errancy ne connaît ni frais ni délais par zone (FR-20, FR-4, AD-12).

**Approach:**
- Section 4. Expédition : pour chaque zone définie par l'équipe (`livraison`), frais en euros, délai de préparation et délai de transport minimal et maximal (en jours), ou case « Je ne livre pas cette zone » ; question « Acceptez-vous les visites en atelier ? » (oui / non). « Reprendre les zones de ma dernière œuvre » préremplit et enregistre la section depuis la dernière autre œuvre de l'artiste qui a des offres. Sans zone définie, le texte actuel de `SectionExpedition` reste affiché.
- Section 5. Engagements : trois cases — certificat d'authenticité signé, emballage conforme au guide Errancy, reprise d'une œuvre retournée dans son emballage d'origine.
- Complétude : la section 4 est complète quand chaque zone a une offre ou « je ne livre pas », au moins une zone est livrée et la visite en atelier est renseignée ; la section 5 quand les trois cases sont cochées. Au-dessus du bouton « Envoyer en curation », indisponible tant qu'il manque un élément : « Il manque N éléments pour envoyer : » avec un lien par élément, qui place le focus sur le champ concerné.
- Envoi : le serveur revérifie la complétude, passe l'œuvre de `brouillon` à `en_curation` (module `curation`, ligne verrouillée), retient la date d'envoi (ordre de la file en 2.7), puis l'artiste revient sur « Mes œuvres » où le badge « En curation » et un bandeau annoncent le délai de réponse de l'équipe (lu dans `reglages`). La page d'une œuvre en curation est en lecture seule (récapitulatif + délai), jamais l'ancien formulaire.
- Migration additive appliquée par le porteur (`preview` puis production) : sur `Artwork`, visites en atelier, trois engagements, date d'envoi en curation ; sur `OffreLivraison`, état « livrée ou non » avec frais et délais facultatifs quand la zone n'est pas livrée, et contraintes `CHECK` reportées de 2.3.

**Décisions du porteur (2026-11-03) :**
- Délai de réponse de la curation annoncé à l'artiste : « sous 7 jours » (`DELAI_REPONSE_CURATION_JOURS = 7` dans `reglages`).
- Spec gardée entière malgré sa longueur (expédition, engagements et envoi forment un seul parcours).

## Boundaries & Constraints

**Always:** offres écrites seulement par `livraison`, appelé par `curation` ; `publication` écrit seulement par `curation` ; montants en centimes via `prixEnCentimes`, délais en jours entiers (préparation 0 à 60, transport 1 à 90, minimum ≤ maximum, frais 0 à 10 000 €) ; enregistrement à la sortie du champ comme en 2.5 ; seul l'artiste propriétaire, et seulement en brouillon ; libellés visibles, erreurs reliées, cibles de 44 px, vouvoiement.

**Never:** curation par l'équipe ni accord signé (2.7) ; affichage public du prix livré (epic 3) ; mention de gratuité, de garantie ou de durée de retour ; modification d'une œuvre en curation ou publiée par l'artiste ; écriture des offres depuis l'interface sans `livraison` ; toucher `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`, les secrets ou les réglages Vercel/Neon.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Zone livrée | Maroc : 25 €, préparation 3, transport 2 à 5 | offre 2 500 centimes, 3, 2, 5 | min > max, négatif, hors bornes : erreur reliée, rien écrit |
| Zone refusée | « Je ne livre pas » sur Reste du monde | offre « non livrée », frais et délais vides | — |
| Aucune zone livrée | toutes refusées | section 4 « À compléter » : « Livrez au moins une zone » | envoi refusé |
| Reprendre | dernière œuvre avec 5 offres | les 5 offres recopiées et enregistrées | aucune œuvre antérieure : bouton absent |
| Envoi incomplet | gros plan manquant | bouton indisponible, lien « Gros plan de la matière » | requête forcée : `depot_incomplet`, reste brouillon |
| Envoi complet | tout rempli | `en_curation`, date d'envoi, retour à « Mes œuvres » avec le délai | double envoi : `transition_interdite` |
| Autre artiste | slug d'autrui | 404, rien écrit | `acces_refuse` |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` -- `Artwork` : `visitesAtelier Boolean?`, `engagementCertificat`, `engagementEmballage`, `engagementReprise` (`Boolean @default(false)`), `envoyeeEnCurationLe DateTime?` ; `OffreLivraison` : `livree Boolean @default(true)`, `fraisCentimes`/`preparationJours`/`transportMinJours`/`transportMaxJours` facultatifs ; migration à la main avec `CHECK` (frais ≥ 0, délais ≥ 0, min ≤ max, devise sur 3 lettres, valeurs présentes si `livree`). Prisma ignore les `CHECK` : vérifier que le job « Migrations » (`migrate diff`) reste vert.
- `src/lib/livraison/index.ts` -- `listerZones()` existe ; ajouter `offresDeLOeuvre(tx, artworkId)`, `enregistrerOffre(tx, artworkId, zoneId, saisie)`, `recopierOffres(tx, deId, versId)` (appelés par `curation`, pas d'acteur : contrôle fait par `verrouillerDepot`).
- `src/lib/curation/depot-regles.ts` -- `etatSections` (sections 4 et 5 aujourd'hui figées « À compléter »), `DonneesDepot`, `validerChamp`, `LIBELLES_CHAMPS` : étendre avec offres, visites, engagements ; liste des éléments manquants avec l'id du champ ciblé.
- `src/lib/curation/depot.ts` -- `verrouillerDepot`, `enregistrerChamp`, `relireDepot` à réutiliser ; ajouter enregistrement d'une offre, reprise, `envoyerEnCuration(acteur, slug)`.
- `src/lib/disponibilite/etats.ts` -- `estBrouillon` ; type `Publication` (`en_curation` existe déjà).
- `src/lib/reglages/index.ts` -- ajouter le délai de réponse de la curation.
- `src/app/dashboard/artiste/oeuvres/depot/` -- `FormulaireDepot.tsx` (prop `expedition` aujourd'hui en lecture seule), `actions.ts`, `PageDepot.tsx` ; `../nouvelle/SectionExpedition.tsx` à remplacer par la saisie (garder son texte sans zone).
- `src/app/dashboard/artiste/oeuvres/[slug]/page.tsx` -- `en_curation` → récapitulatif en lecture seule ; `publiee` → ancienne page.
- `src/app/dashboard/artiste/oeuvres/page.tsx` -- bandeau après envoi (`?envoyee=1`) avec le délai.
- `src/app/api/artiste/oeuvres/[slug]/route.ts` -- PUT : refuser `brouillon` et `en_curation` (reporté de 2.5).
- `tests/depot.test.ts`, `tests/livraison.test.ts` -- modèles.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` + `prisma/migrations/<horodatage>_expedition_engagements/` -- colonnes, `CHECK`, `migrate dev --create-only` puis ajout des `CHECK` à la main -- migration additive.
- [x] `src/lib/livraison/` -- lecture, écriture et recopie des offres d'une œuvre -- propriétaire des offres.
- [x] `src/lib/curation/depot-regles.ts`, `depot.ts`, `index.ts` -- règles et complétude des sections 4 et 5, éléments manquants, reprise, envoi en curation -- logique métier.
- [x] `src/lib/reglages/index.ts` -- délai de réponse de la curation -- réglable.
- [x] `src/app/dashboard/artiste/oeuvres/depot/` -- sections 4 et 5, liste « Il manque N éléments », bouton d'envoi -- interface.
- [x] Pages `[slug]` et `oeuvres`, route PUT -- lecture seule en curation, bandeau, refus.
- [x] `tests/depot.test.ts`, `tests/livraison.test.ts` -- matrice, `CHECK` en base, propriété.
- [x] `docs/migrations.md`, `AGENTS.md`, `deferred-work.md` (entrée `CHECK` close) -- journal et repères.

**Acceptance Criteria:**
- Given un artiste sans zone ouverte par l'équipe, when il ouvre la section 4, then il lit l'explication au lieu d'une liste vide et l'envoi reste impossible.
- Given « Il manque N éléments », when l'artiste suit un lien, then le focus est placé sur le champ concerné.
- Given une œuvre en curation, when l'artiste ouvre sa page, then il voit un récapitulatif en lecture seule et le délai, sans aucun champ modifiable.

## Implementation Notes

- Migration `20261103100532_expedition_engagements`, créée par `migrate dev --create-only` sur PostgreSQL local, puis six `CHECK` ajoutés à la main (`OffreLivraison_frais_positifs`, `_delais_positifs`, `_transport_ordonne`, `_devise_iso`, `_livree_complete`, `_non_livree_vide`) ; `migrate diff` : aucune différence. Les bornes métier (frais ≤ 10 000 €, préparation ≤ 60, transport 1 à 90) restent dans `depot-regles.ts`, pas en base.
- Une zone s'enregistre quand ses quatre valeurs sont valides (une offre livrée est toujours complète) ; partiellement remplie, rien n'est écrit et la zone l'indique. Quatre champs vidés : offre retirée. Décocher « Je ne livre pas » avec une saisie incomplète retire l'offre non livrée. Frais de 0 € acceptés (sans mention de gratuité).
- « Reprendre les zones » recopie les offres seulement (pas les visites en atelier), depuis l'œuvre la plus récemment créée de l'artiste qui a des offres, quel que soit son état ; elle remplace les offres déjà saisies (confirmation demandée dans le navigateur s'il y en a). Sans brouillon, elle le crée.
- Visites en atelier et engagements passent par `enregistrerChamp` (saisies « oui » / « non ») ; `available` reste écrite (fausse) à l'envoi via `champAvailable`.
- `SectionExpedition` déplacée de `nouvelle/` vers `depot/` (composant contrôlé) ; texte sans zone conservé.

## Spec Change Log

## Review Triage Log

| # | Constat (relecteur) | Verdict | Preuve | Suite |
|---|---|---|---|---|
| 1 | Zone enregistrée puis vidée en partie : anciens frais envoyés en curation (cas limites, vérification) | medium | `sortieZone` n'écrivait rien sur une saisie partielle | patch : offre retirée, message à la zone |
| 2 | Décocher « Je ne livre pas » avec des champs invalides laisse la zone non livrée en base (cas limites) | medium | retour anticipé de `sortieZone` | patch |
| 3 | Erreur d'une zone non livrée invisible (cas limites, aveugle) | medium | erreur portée par le champ `frais` masqué | patch : erreur à la zone, case rétablie |
| 4 | Lien « Il manque » sans cible quand la case est cochée localement (cas limites, aveugle) | low | `depot-zone-<id>-frais` absent du DOM | patch : repli sur la case |
| 5 | Suppression d'une œuvre en curation par l'artiste (aveugle, cas limites) | medium | `DELETE` non gardé | patch : 409 + test |
| 6 | Aucune contrainte « non livrée = valeurs vides » en base (aveugle) | low | seul `livree_complete` existait | patch : `CHECK` + test |
| 7 | Zone ajoutée par l'équipe après le chargement : refus au message générique (cas limites) | low | `depot_incomplet` | patch : « rechargez la page » |
| 8 | Message « 10000 » (aveugle) | low | format | patch |
| 9 | « Modifier » sur une œuvre en curation (aveugle) | low | `aria-label` | patch : « Voir » |
| 10 | Tests : choix de la dernière œuvre, bouton de reprise sur `/nouvelle` (vérification) | medium | aucun cas à deux candidates | patch : 3 tests |
| 11 | Statut du suivi divergent (aveugle) | low | `in-progress` contre `in-review` | patch |
| 12 | Course entre le contrôle de l'ancien PUT et sa mise à jour (aveugle) | low | l'artiste modifierait son œuvre à l'instant où il l'envoie | rejeté |
| 13 | Bascule admin `definirPublication` depuis `en_curation` (aveugle) | low | admin seulement ; la file de curation est la story 2.7 | defer |
| 14 | `AGENTS.md` : la puce 2.5 contredit la puce 2.6 (aveugle) | low | fichier de contexte des agents | defer |
| 15 | Logique client des zones non testée (vérification) | low | Vitest sans DOM | defer, vérification manuelle en préversion |
| 16 | Œuvres sans offre pour une zone créée plus tard (aveugle) | maybe-false | dépend des zones ajoutées par l'équipe | defer |
| 17 | Verrou exclusif pour une lecture, requête de reprise à chaque enregistrement (aveugle) | low | performance sans effet visible | rejeté |
| 18 | Date d'envoi sans fuseau horaire (aveugle) | low | fuseau à choisir (artistes partout) | rejeté |
| 19 | Bandeau `?envoyee=1` affichable à la main (aveugle) | low | sans effet sur les données | rejeté |
| 20 | Modification pendant l'envoi, confirmation de reprise avec saisie non enregistrée, zone supprimée entre deux écritures (cas limites) | low | rares ; le serveur revérifie | rejeté |

## Verification

**Commands:**
- `npx eslint .` -- aucune erreur
- `node scripts/verifier-exceptions-prisma.cjs origin/main` -- aucun ajout
- `npm test` -- tous verts
- `npm run build` -- réussi

**Manual checks:**
- Préversion : remplir les zones et engagements, reprendre les zones d'une autre œuvre, envoyer, voir « En curation » et le délai.
