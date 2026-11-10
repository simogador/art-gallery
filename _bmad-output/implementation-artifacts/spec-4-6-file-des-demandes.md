---
title: 'Story 4.6 — File des demandes de l''équipe'
type: 'feature'
created: '2026-11-10'
status: 'draft'
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

## Open Questions

1. **Que garder du changement d'état ?** — options : A) seulement le dernier : qui et quand, sur la demande (deux colonnes ajoutées à chaque table, simple, recommandé) / B) tout l'historique : une table qui garde chaque changement (comme les décisions de curation), plus lourde.
2. **Que faire des inscriptions « Me prévenir » ?** — le texte de la story les demande, mais leur table n'existe pas (story 4.5 non faite, aucune œuvre ne peut être réservée avant l'Epic 6). Options : A) les laisser de côté : la section s'ajoutera avec la 4.5 (recommandé) / B) faire la 4.5 avant la 4.6 / C) créer ici la table et une section vide.
3. **Où afficher l'e-mail et le téléphone du visiteur ?** — options : A) directement dans la liste, l'équipe répond sans clic (recommandé) / B) seulement dans une demande ouverte, un clic de plus, moins de données à l'écran.

## Code Map

- `prisma/schema.prisma` + migration -- colonnes de suivi d'état sur `DemandeSelection` et `DemandeVisite` (selon la réponse 1), aucune autre modification.
- `src/lib/demandes/file.ts` (à créer) -- `fileDesDemandes(acteur, options)`, `changerEtatDemande(acteur, type, id, etat)` ; admin seulement ; règles pures dans `file-regles.ts` ; réexport dans `index.ts`.
- `src/app/dashboard/admin/demandes/` (`page.tsx`, `loading.tsx`, `error.tsx`, `actions.ts`, commande d'état en composant client sur le modèle de `BasculeSelection`) ; `src/components/dashboard/AdminNav.tsx` (entrée « Demandes »).
- `src/lib/notifications/gestionnaires.ts` -- lien des deux alertes ; `src/lib/i18n/fr.ts` -- textes.
- `tests/demandes-file.test.ts` (base réelle : accès, tri, état, auteur et date), `tests/navigateur/` pour la commande d'état ; `AGENTS.md`, `docs/migrations.md`.

## Tasks & Acceptance

**Execution:**
- [ ] `prisma/` -- suivi d'état et migration additive
- [ ] `src/lib/demandes/` -- lecture de la file et changement d'état, admin seulement
- [ ] `src/app/dashboard/admin/demandes/`, `AdminNav`, `fr` -- page, états vide, chargement, erreur
- [ ] `src/lib/notifications/` -- lien des alertes
- [ ] tests (base réelle, navigateur), `AGENTS.md`, `docs/migrations.md`

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
