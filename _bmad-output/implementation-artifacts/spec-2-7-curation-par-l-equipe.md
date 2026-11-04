---
title: 'Story 2.7 — Curation par l''équipe'
type: 'feature'
created: '2026-11-04'
status: 'done'
route: 'dispatch'
baseline_commit: '02f8d9d5df8ed1485f966fcc57787602e46d635a'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-2-6-expedition-engagements-curation.md', '{project-root}/docs/migrations.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Depuis la story 2.6, les artistes envoient des œuvres en curation, mais l'équipe n'a aucun écran pour les relire : elles restent `en_curation` indéfiniment, et rien n'enregistre l'accord écrit signé que FR-16 exige avant toute publication (FR-25, FR-16).

**Approach:**
- File de curation en tête de `/dashboard/admin/oeuvres` : les œuvres `en_curation`, de la plus ancienne à la plus récente (date d'envoi), avec artiste, date d'envoi et mention « Accord signé » ou « Accord non signé ».
- `/dashboard/admin/oeuvres/[slug]` pour une œuvre en curation : récapitulatif complet en lecture seule (photos en grand, informations, dimensions et prix, offres par zone, visites, engagements) et la liste de contrôle — photos requises, fidélité des couleurs, champs complets, cohérence du prix et des zones.
- « Valider » : passe l'œuvre en `publiee` et `disponible` (visible sur le site). Refusé avec un message si l'artiste n'a pas d'accord signé enregistré.
- « Renvoyer à l'artiste » avec un commentaire obligatoire (10 à 1 000 caractères) : l'œuvre repasse en `brouillon` ; sur sa fiche de dépôt, l'artiste voit le commentaire de l'équipe en bandeau d'information (`role="status"`) jusqu'au prochain envoi. Aucun e-mail (epic 4).
- Chaque décision est conservée (œuvre, décision, commentaire, admin, date) ; écrite seulement par `curation`.
- Accord écrit : sur `/dashboard/admin/artistes`, l'équipe enregistre la date de signature de l'accord d'un artiste (ou l'efface) ; conservé par `curation` sur la fiche artiste.
- La bascule admin existante (`definirPublication`) refuse désormais une œuvre `en_curation` : la file est le seul chemin (reporté de 2.6).
- Migration additive appliquée par le porteur (`preview` puis production) : `Artist.accordSigneLe`, table des décisions de curation.

**Décisions du porteur (2026-11-04) :**
- Liste de contrôle obligatoire : « Valider » reste indisponible tant que les quatre cases ne sont pas cochées ; le serveur refuse une validation sans les quatre (`controle_incomplet`) et la décision enregistre la liste cochée.
- Spec gardée entière malgré sa longueur (valider exige l'accord).

## Boundaries & Constraints

**Always:** admin seulement, acteur issu de `acteurCourant()` ; `publication` écrit seulement par `curation`, `disponibilite` seulement par `disponibilite` ; transitions sur la ligne verrouillée (`en_curation` → `publiee` ou `brouillon`, toute autre transition refusée) ; actions serveur ; résultats `{ ok, code }` et messages en français ; libellés visibles, erreurs reliées, cibles de 44 px.

**Never:** e-mail à l'artiste ; retrait d'une œuvre publiée (2.8) ; catalogue réel seul (2.9) ; modification du contenu de l'œuvre par l'équipe ; publication sans accord signé ; toucher `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`, les secrets ou les réglages Vercel/Neon.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| File | 3 œuvres envoyées le 1er, le 3 et le 2 | ordre 1er, 2, 3 ; brouillons et publiées absents | file vide : « Aucune œuvre à relire. » |
| Valider | accord signé, liste de contrôle cochée | `publiee` + `disponible`, décision enregistrée, visible sur le site | accord absent : `accord_absent`, rien n'est écrit |
| Renvoyer | commentaire de 40 caractères | `brouillon`, décision enregistrée, bandeau sur la fiche de dépôt | commentaire vide ou < 10 : erreur reliée au champ |
| Double décision | œuvre déjà validée ou renvoyée | — | `transition_interdite` |
| Accord | date du 2026-11-04 sur Mustapha Timija | « Accord signé le 4 novembre 2026 » | date future ou illisible : erreur reliée |
| Non admin | artiste ou visiteur | redirection, rien n'est écrit | `acces_refuse` |
| Bascule ancienne | `definirPublication` sur une œuvre en curation | refus | `transition_interdite` |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` -- `Artist.accordSigneLe DateTime?` ; modèle `DecisionCuration` (id, `artworkId` FK `CASCADE`, `decision` enum `valider`/`renvoyer`, `commentaire` texte facultatif, `adminId` facultatif, `createdAt`), index `(artworkId, createdAt)`.
- `src/lib/curation/index.ts` -- `definirPublication` (bascule admin, à refuser sur `en_curation`) ; y ajouter `curation.ts` ou `file.ts` : `fileDeCuration()`, `oeuvreACurer(slug)`, `validerOeuvre`, `renvoyerOeuvre`, `enregistrerAccord(acteur, artistId, date|null)`, `dernierRenvoi(artworkId)`.
- `src/lib/curation/depot.ts` -- `verrouillerOeuvre`/`lireOeuvreEnCuration` (2.6) à réutiliser pour le récapitulatif ; `relireDepot` doit porter le dernier commentaire de renvoi.
- `src/lib/disponibilite` -- `estEnCuration`, `champAvailable`, `lireEtatVerrouille` ; la validation garde `disponible` (posé au dépôt) et `available` vrai via `champAvailable`.
- `src/app/dashboard/artiste/oeuvres/depot/RecapitulatifCuration.tsx` -- modèle du récapitulatif à réutiliser côté admin (composant partagé ou variante).
- `src/app/dashboard/admin/oeuvres/page.tsx` et `[slug]/page.tsx` -- exceptions Prisma existantes ; la file et la page de curation passent par `curation` (n'ajouter aucun import Prisma).
- `src/app/dashboard/admin/artistes/page.tsx`, `actions.ts` -- ajouter l'accord signé.
- `src/app/dashboard/artiste/oeuvres/depot/FormulaireDepot.tsx` / `PageDepot.tsx` -- bandeau du commentaire de renvoi.
- `src/app/api/admin/oeuvres/[slug]/route.ts` -- appelle `definirPublication`.
- `tests/depot.test.ts`, `tests/disponibilite.test.ts` -- modèles.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` + `prisma/migrations/<horodatage>_curation/` -- colonne et table, `migrate dev --create-only` -- migration additive.
- [x] `src/lib/curation/` -- file, récapitulatif, valider, renvoyer, accord, dernier renvoi ; garde de `definirPublication` -- logique métier.
- [x] `src/app/dashboard/admin/oeuvres/` -- file en tête, page de curation avec liste de contrôle, valider, renvoyer -- interface admin.
- [x] `src/app/dashboard/admin/artistes/` -- date d'accord signé -- interface admin.
- [x] `src/app/dashboard/artiste/oeuvres/depot/` -- bandeau du commentaire de renvoi -- interface artiste.
- [x] `tests/curation.test.ts` -- matrice, ordre de la file, accès, bandeau.
- [x] `docs/migrations.md`, `AGENTS.md`, `deferred-work.md` (entrée `definirPublication` close) -- journal et repères.

**Acceptance Criteria:**
- Given une œuvre validée, when un visiteur consulte la galerie, then elle y figure comme les autres œuvres publiées.
- Given une œuvre renvoyée puis corrigée et renvoyée en curation, when l'équipe ouvre la file, then elle y figure avec sa nouvelle date d'envoi et le bandeau de l'artiste a disparu.

## Implementation Notes

- Migration `20261104060111_curation`, créée par `migrate dev --create-only` sur PostgreSQL local ; `migrate diff` : aucune différence. Énumération `TypeDecisionCuration` ; `DecisionCuration.controle` (`TEXT[]`) retient les points cochés (décision du porteur), aussi pour un renvoi ; `adminId` sans clé étrangère, comme `Invitation.creeParId`.
- `src/lib/curation/file.ts` (file, récapitulatif, valider, renvoyer, accord), `curation-regles.ts` (pur), `decisions.ts` (`dernierRenvoi`, lu par `lireLigne` de `depot.ts`, devenu exporté pour le récapitulatif admin). Ordre des refus de « Valider » : `acces_refuse`, `controle_incomplet` (avant la base), `introuvable`, `transition_interdite`, `accord_absent`. Lignes de l'œuvre et de l'artiste verrouillées ensemble (`FOR UPDATE` sur la jointure) : l'effacement concurrent de l'accord attend.
- Valider n'écrit pas l'axe disponibilité : il exige `disponible` (posée au dépôt), sinon `transition_interdite` ; `available` devient vraie via `champAvailable`.
- Bandeau de renvoi : dernière décision = renvoi, postérieure à `envoyeeEnCurationLe` ; il reste affiché pendant les corrections et disparaît au prochain envoi (la date d'envoi est mise à jour par `envoyerEnCuration`).
- Date d'accord : `AAAA-MM-JJ` stockée à minuit UTC ; « future » = après le jour en cours à UTC+14 (une signature datée du jour n'est jamais refusée, quel que soit le fuseau) ; avant 2000 = illisible.
- Récapitulatif partagé : `src/components/dashboard/RecapitulatifOeuvre.tsx` (cinq sections, `photosEnGrand` avec lien « Ouvrir en taille réelle ») utilisé par `RecapitulatifCuration` (artiste) et `PageCuration` (équipe).
- Liste des œuvres : bascule « Publiée / Brouillon » masquée pour une œuvre en curation (lien « Relire ») ; la route admin répond 409 avec un message propre à la file.
- Relecture (coordinateur) : `definirPublication` exige aussi, pour publier, l'accord signé (`accord_absent`) et refuse une œuvre passée par le dépôt (date d'envoi, décision ou photo de dépôt) sans validation en dernier lieu ; bascule masquée là où elle serait refusée (`basculesPublication`). Valider une œuvre en curation non disponible : code `indisponible` (lu par `estMarqueeDisponible`), file lue par le fragment `EN_CURATION`. Enregistrer l'accord sans date : « Choisissez une date. » (seule l'action « Effacer » efface), un seul état de formulaire. La page de curation montre le dernier renvoi (date, commentaire) même après un nouvel envoi. Migration modifiée en place (non appliquée) : `accordSigneLe` en `DATE`, `controle` non nul, `CHECK` du commentaire de renvoi (avec `COALESCE` : `char_length(NULL)` laisserait passer un renvoi sans commentaire) ; commentaire normalisé NFC avant comptage. Dates de ces écrans par `dateLisible` (Europe/Paris). Tests ajoutés : bascule, `CHECK`, décisions concurrentes, accord sans date.

## Spec Change Log

## Review Triage Log

| # | Constat (relecteur) | Verdict | Preuve | Suite |
|---|---|---|---|---|
| 1 | L'ancienne bascule publie un brouillon de dépôt (jamais envoyé ou renvoyé) sans accord ni liste de contrôle (3 relecteurs) | high | `definirPublication` ne refusait que `en_curation` | patch : accord exigé, œuvres déposées publiables seulement après une validation |
| 2 | Enregistrer l'accord sans champ date efface l'accord (cas limites) | medium | `validerDateAccord(null)` | patch : « Choisissez une date. » |
| 3 | Messages « enregistrée » et « effacée » affichés ensemble (cas limites, aveugle) | low | deux `useFormState` | patch : état partagé |
| 4 | Œuvre en curation non disponible : message « décision déjà prise » faux ; lecture littérale de « disponible » (cas limites, aveugle) | low | comparaison directe dans `file.ts` | patch : code `indisponible`, prédicats de `disponibilite`, fragment `EN_CURATION` |
| 5 | Échec de lecture de la file affiché comme file vide (cas limites) | low | `[]` par défaut | patch : message d'erreur |
| 6 | Aucun historique du renvoi sur la page de curation (aveugle) | medium | `renvoi: null` après un nouvel envoi | patch : dernier renvoi affiché |
| 7 | Pas de contrainte en base sur le commentaire de renvoi ; `controle` nullable ; date d'accord en horodatage (aveugle) | low | migration | patch : `CHECK` (avec `COALESCE`), `NOT NULL`, `DATE` |
| 8 | Fuseaux horaires différents selon les écrans (aveugle) | low | `RecapitulatifCuration` sans fuseau | patch : `dateLisible` en Europe/Paris |
| 9 | Verrou de ligne non testé en concurrence (vérification) | medium | tests séquentiels seulement | patch : 2 tests concurrents |
| 10 | Statut du suivi divergent (aveugle) | low | `in-progress` | patch |
| 11 | Erreur serveur du commentaire restée affichée après correction (cas limites) | low | disparaît au prochain envoi | rejeté |
| 12 | Bandeau de renvoi visible si envoi et renvoi à la même milliseconde (cas limites) | low | improbable | rejeté |
| 13 | Décisions supprimées en cascade avec l'œuvre (cas limites) | low | seule une œuvre publiée ou un brouillon peut être supprimé | defer |
| 14 | Listes de l'artiste sans mention « renvoyée » (aveugle) | low | badge « Brouillon » | defer |
| 15 | Puce 2.5 d'AGENTS.md obsolète (aveugle) | low | fichier de contexte des agents | defer (déjà inscrit) |

## Verification

**Commands:**
- `npx eslint .` -- aucune erreur
- `node scripts/verifier-exceptions-prisma.cjs origin/main` -- aucun ajout
- `npm test` -- tous verts
- `npm run build` -- réussi

**Manual checks:**
- Préversion : enregistrer l'accord de Kara Walker, valider puis renvoyer une œuvre, voir le bandeau côté artiste.
