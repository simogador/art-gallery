---
title: 'Story 4.6 — File des demandes de l''équipe'
type: 'feature'
created: '2026-11-10'
status: 'done'
baseline_commit: 'e1bbe1b7233eca66b2edb8eb45ef1eef40d9ce21'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-4-3-demande-de-visite.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les demandes de sélection (4.2) et de visite (4.3) sont enregistrées avec une promesse de réponse sous 48 heures, mais l'équipe n'a aucune page pour les lire ni les traiter : elle doit interroger la base en SQL, et les alertes mènent à l'accueil de l'administration (FR-25, FR-8, UX-DR42).

**Approach:**
- Page `/dashboard/admin/demandes` : une file unique des demandes de visite et de sélection, de la plus ancienne à la plus récente, avec type, œuvre concernée, date et état ; l'équipe change l'état (`nouvelle`, `planifiée`, `faite`, `sans suite`), avec qui et quand.
- Les alertes à l'équipe (4.2, 4.3) mènent désormais à cette page.

## Boundaries & Constraints

**Always:**
- Seul l'acteur `admin` (`acteurCourant()`) y accède, et seul lui change un état : vérifié côté serveur, dans le module `demandes` (lecture et écriture) et par un test ; jamais le rôle du jeton.
- Module `demandes` seul propriétaire des deux tables et de leurs états ; nouvelle API `src/lib/demandes/file.ts` ; règles pures (états, libellés, transitions libres entre les quatre états) importables côté client.
- Par défaut la file montre les demandes à traiter (`nouvelle`, `planifiee`) ; un lien « Voir les demandes traitées » ajoute `faite` et `sans_suite`. Aucune demande : « Aucune demande en attente. » ; chargement : lignes squelettes ; erreur : « Réessayer » (comme `src/app/galerie/`).
- Une visite affiche le titre de l'œuvre et son lien ; si l'œuvre a été supprimée (lien nul, décision du 2026-11-10), « Œuvre supprimée ». Les créneaux de visite s'affichent dans le fuseau du visiteur (`formaterDateHeure`, `jourSemaine`) ; la date de la demande par `formaterDate` de `i18n`.
- Textes dans `fr` (nouvelle clé), aucun texte en dur ; coordonnées jamais dans les journaux ni dans les alertes ; en-tête `no-store`, pas de cache.
- Les alertes (`alerterEquipeDemande`, `alerterEquipeVisite`) pointent vers `/dashboard/admin/demandes`, sans donnée personnelle.
- Décisions du porteur du 2026-11-10 : le changement d'état ne garde que le dernier changement, qui et quand, sur la demande elle-même (colonnes facultatives `etatChangePar`, identifiant de l'utilisateur, et `etatChangeLe` sur `DemandeSelection` et `DemandeVisite`, migration additive) ; les inscriptions « Me prévenir » restent hors de cette story (leur table viendra avec la story 4.5, qui ajoutera sa section à la file) ; l'e-mail et le téléphone du visiteur s'affichent directement dans la liste, à l'administrateur seulement.

**Never:**
- E-mail au visiteur à un changement d'état ; calendrier, réponse par e-mail depuis la page, export ; suppression d'une demande ; durée de conservation ; mesure (4.8) ; barre d'actions (4.7).
- Toucher à `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/` ; migration autre qu'additive.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Ouverture | admin, demandes `nouvelle` et `planifiee` | file de la plus ancienne à la plus récente, type, œuvre, date, état | — |
| Aucune demande | file vide | « Aucune demande en attente. » | — |
| Erreur de lecture | base indisponible | message et « Réessayer », rien de technique | journal sans donnée personnelle |
| Changement d'état | admin choisit `faite` | état, auteur et date enregistrés ; la demande sort de la file | état inconnu ou demande absente : refus, rien changé |
| Accès interdit | visiteur, `user`, `artist` | redirection ; action serveur refusée | refus côté serveur, test |
| Œuvre supprimée | visite sans œuvre | « Œuvre supprimée » | — |
| Deux admins | même demande, deux changements | le dernier enregistré l'emporte | — |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` + migration -- `etatChangePar` et `etatChangeLe` facultatifs sur `DemandeSelection` et `DemandeVisite`, aucune autre modification.
- `src/lib/demandes/file.ts` (à créer) -- `fileDesDemandes(acteur, options)`, `changerEtatDemande(acteur, type, id, etat)` ; admin seulement ; règles pures dans `file-regles.ts` ; réexport dans `index.ts`.
- `src/app/dashboard/admin/demandes/` (`page.tsx`, `loading.tsx`, `error.tsx`, `actions.ts`, commande d'état en composant client sur le modèle de `BasculeSelection`) ; `src/components/dashboard/AdminNav.tsx` (entrée « Demandes »).
- `src/lib/notifications/gestionnaires.ts` -- lien des deux alertes ; `src/lib/i18n/fr.ts` -- textes.
- `tests/demandes-file.test.ts` (base réelle : accès, tri, état, auteur et date), `tests/navigateur/` pour la commande d'état ; `AGENTS.md`, `docs/migrations.md`.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/` -- suivi d'état et migration additive
- [x] `src/lib/demandes/` -- lecture de la file et changement d'état, admin seulement
- [x] `src/app/dashboard/admin/demandes/`, `AdminNav`, `fr` -- page, états vide, chargement, erreur
- [x] `src/lib/notifications/` -- lien des alertes
- [x] tests (base réelle, navigateur), `AGENTS.md`, `docs/migrations.md`

**Acceptance Criteria:**
- Given `/dashboard/admin/demandes`, when un admin l'ouvre, then il voit les demandes à traiter de la plus ancienne à la plus récente, avec type, œuvre, date et état.
- Given une demande, when il choisit `faite`, then l'état, l'auteur et la date sont enregistrés et la demande quitte la file.
- Given un visiteur, un `user` ou un `artist`, when il ouvre la page ou appelle l'action, then l'accès est refusé côté serveur.
- Given une alerte à l'équipe, when on ouvre son lien, then on arrive sur la file.

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Préversion : les comptes admin ne s'y connectent pas : vérifier par SQL (état, auteur, date) ; en production, après fusion, ouvrir la page avec un compte admin.

## Review Triage Log

| # | Source | Constat | Verdict | Route | Preuve / suite |
|---|--------|---------|---------|-------|----------------|
| 1 | Blind | Ambiances affichées avec leur code (« melancolique ») au lieu de leur libellé | medium | patch | `AMBIANCES` porte `code` et `libelle` (vérifié) ; libellés français affichés ; test |
| 2 | Verification Gap, Blind | La ligne « Dernier changement » n'est vérifiée dans aucun test de page (ni le repli « compte supprimé ») | medium | patch | deux cas de rendu à ajouter |
| 3 | Edge, Blind | Appel de l'action sans `try/catch` : une exception laisse l'administrateur sans retour | medium | patch | `CommandeEtat.tsx` ; test navigateur du cas d'exception |
| 4 | Blind | Boutons d'état identiques sur chaque ligne (« Marquer « Faite » »), sans nom de la demande | medium | patch | `aria-label` avec type et date de la demande |
| 5 | Edge, Blind | Texte « Enregistrement… » défini et jamais affiché | low | patch | affiché en `role="status"` pendant l'envoi |
| 6 | Edge | Auteur sans nom (chaîne vide) : « Dernier changement par , le … » | low | patch | `name?.trim() \|\| email` |
| 7 | Edge, Blind | `searchParams` typé en promesse (Next 14 : objet) ; séparateur « · » en dur au lieu de `SEPARATEUR` | low | patch | correction directe |
| 8 | Edge, Blind | Lectures sans limite (`traitees=1` charge toutes les demandes) | low | defer | volume faible aujourd'hui ; pagination à prévoir si la file grossit ; deferred-work.md |
| 9 | Edge, Blind | Changement vers l'état déjà en place ou deux administrateurs : le dernier l'emporte, l'auteur est écrasé | low | rejet | prévu par la spec (« le dernier enregistré l'emporte ») |
| 10 | Edge, Blind | Message « Aucune demande en attente. » dans la vue des demandes traitées | low | rejet | texte exact demandé par la spec |
| 11 | Edge | La ligne obsolète reste après « Cette demande n'existe plus » | low | rejet | un rechargement la retire ; correction = un appel de plus |
| 12 | Edge, Blind | Pas d'en-tête `no-store` explicite | false | rejet | `force-dynamic` : Next 14 envoie `no-store` pour une page dynamique |
| 13 | Verification Gap | Bouton « Réessayer » de `error.tsx` sans test | low | rejet | mince enveloppe, même pratique que les autres `error.tsx` du dépôt |
| 14 | Blind | Pas d'index sur `etat` et `createdAt` | false | rejet | `@@index([etat, createdAt])` existe sur les deux tables |
| 15 | Blind | Budget sans devise (`formaterMontant`) | false | rejet | euros par défaut ; le budget de sélection n'a pas de devise en base |
| 16 | Blind | Durée de conservation des données personnelles non décidée | medium | rejet | déjà ouverte (AGENTS.md, pages de confiance, Epic 7) |
| 17 | Blind | E-mail et téléphone sans lien `mailto:`/`tel:` ; étiquettes en 10 px | low | rejet | ajout hors spec ; même style que les écrans d'administration existants |
| 18 | Blind | Test d'alerte faible ; entrée `AdminNav`, `loading.tsx` non testées | low | rejet | les liens sont vérifiés dans les tests des stories 4.2 et 4.3 ; éléments minces |
| 19 | Blind | Statuts de la spec et du suivi, date de la migration (11 novembre) | false | rejet | l'étape de présentation passe le suivi à `review` ; la date ne sert qu'à l'ordre |

