---
title: 'Story 2.3 — Zones de livraison gérées par l''équipe'
type: 'feature'
created: '2026-10-31'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md', '{project-root}/docs/migrations.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les artistes devront fixer frais et délais par zone (story 2.6, AD-12), mais aucune zone n'existe : il faut que l'équipe puisse les définir sans code (OQ-5, décision du 2026-10-31 : Maroc, Union européenne, Europe hors UE, Amérique du Nord, Reste du monde).

**Approach:**
- Module `livraison` : tables `Zone` (nom unique) et `ZonePays` (code ISO 3166-1 alpha-2 en clé primaire, donc un pays dans au plus une zone), plus la table `OffreLivraison` d'AD-12 (œuvre, zone, frais en centimes, devise, préparation, transport min/max ; unique par œuvre et zone ; zone en `RESTRICT`), vide jusqu'à la story 2.6 mais qui garantit en base qu'une zone utilisée ne se supprime pas.
- Écran `/dashboard/admin/zones` (lien « Zones » dans la navigation admin) : liste des zones avec leurs pays, création, renommage, choix des pays (liste filtrable, noms français), bouton « Cocher tous les pays sans zone » (coche dans le formulaire, rien n'est enregistré avant « Enregistrer »), suppression. Mutations par actions serveur, réservées à l'acteur `admin` (vérifié dans le module).
- Formulaire de dépôt actuel (`/dashboard/artiste/oeuvres/nouvelle`) : section « Expédition » en lecture seule qui liste les zones ouvertes, ou explique qu'aucune zone n'est encore ouverte ; la saisie par zone viendra en 2.6.
- `scripts/sql/zones-depart.sql` : crée les cinq zones et leurs pays, idempotent, lancé par le porteur depuis Neon. Liste validée par le porteur le 2026-10-31 : Maroc = `MA` ; Union européenne = les 27 États membres ; Europe hors UE = `GB CH LI NO IS AD MC SM VA AL BA ME MK RS XK MD UA GI FO JE GG IM TR` ; Amérique du Nord = `US CA` ; Reste du monde = tous les autres codes, dont l'outre-mer français et le Mexique, **sauf `RU` et `BY`**, dans aucune zone (livraison impossible).
- Migration appliquée par le porteur (SQL, ligne `_prisma_migrations`, empreinte SHA-256), `preview` puis production avant la fusion.

## Boundaries & Constraints

**Always:** codes pays validés contre la liste du module ; un pays déjà pris par une autre zone est refusé avec le nom de cette zone ; résultats `{ ok, code }` et messages en français ; changement visible au rechargement suivant (aucun cache) ; liste d'exceptions Prisma qui ne grossit pas.

**Never:** saisie des offres ou calcul du prix total (2.6, 3.3) ; cookie `pays` ; zones codées en dur dans `src/` ; migration appliquée sur une base partagée par l'agent ; `MAINTENANCE_MODE`, `robots.txt`, `src/generated/prisma/`, secrets.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Création | admin, nom « Maroc », pays `MA` | zone enregistrée, listée | N/A |
| Hors admin | artiste ou visiteur | rien n'est écrit | `acces_refuse` |
| Nom vide ou déjà pris | « » ou « Maroc » existant (casse ignorée) | refus | `nom_invalide` / `nom_pris` |
| Pays inconnu | `ZZ` | refus | `pays_inconnu` |
| Pays d'une autre zone | `FR` déjà dans « Union européenne » | refus, message citant la zone | `pays_deja_pris` |
| Modification | nouveau nom, pays retirés et ajoutés | liste remplacée en une transaction | N/A |
| Pays sans zone | bouton « Cocher tous les pays sans zone » | cases cochées dans le formulaire, enregistrées seulement à « Enregistrer » | N/A |
| Suppression | zone sans offre | supprimée avec ses pays | N/A |
| Suppression refusée | zone avec ≥ 1 offre | « Cette zone est utilisée par N offre(s)… » | `zone_utilisee` |
| Dépôt sans zone | aucune zone | « Les zones de livraison ne sont pas encore ouvertes… » | N/A |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` -- ajouter `Zone`, `ZonePays`, `OffreLivraison` (ids `cuid()` comme ailleurs ; relation `Artwork.offresLivraison`, cascade côté œuvre, `Restrict` côté zone). Migration `<horodatage>_zones_livraison` générée contre le PostgreSQL local.
- `src/lib/livraison/` (déjà dans `MODULES_METIER` de `.eslintrc.js`) -- `pays.ts` pur (codes ISO, `nomPays` via `Intl.DisplayNames('fr')`, `estCodePays`), `index.ts` (lectures `listerZones`, `lireZone`, `paysAttribues` ; écritures avec `Acteur` : `creerZone`, `modifierZone`, `supprimerZone`). Conflit de clé primaire (`P2002`) → `pays_deja_pris`.
- `src/lib/acces` -- type `Acteur` ; modèle d'écriture : `src/lib/curation/index.ts` (`{ ok, code }`, refus hors admin).
- `src/app/dashboard/admin/zones/` -- `page.tsx` (liste), `actions.ts` (`'use server'`, `acteurCourant()`, `revalidatePath`), composant client de formulaire de zone ; gabarit visuel de `admin/artistes/page.tsx`. Garde de page comme `admin/artistes` (`acteurCourant`, redirection).
- `src/components/dashboard/AdminNav.tsx` -- entrée « Zones ».
- `src/app/dashboard/artiste/oeuvres/nouvelle/page.tsx` -- section Expédition (lecture `livraison`) ; ne pas toucher `ArtworkForm`.
- `tests/disponibilite.test.ts` -- modèle de test sur base jetable (`creerBaseJetable`, mocks `@/lib/acces`, `next/navigation`).

## Tasks & Acceptance

**Execution:**
- [ ] `prisma/schema.prisma` + `prisma/migrations/<horodatage>_zones_livraison/` -- trois tables, sans écart (`migrate diff`).
- [ ] `src/lib/livraison/pays.ts`, `src/lib/livraison/index.ts` -- module ci-dessus.
- [ ] `src/app/dashboard/admin/zones/*`, `AdminNav.tsx` -- écran d'administration.
- [ ] `src/app/dashboard/artiste/oeuvres/nouvelle/page.tsx` -- section Expédition.
- [ ] `scripts/sql/zones-depart.sql` -- cinq zones, idempotent (`ON CONFLICT DO NOTHING`).
- [ ] `tests/livraison.test.ts` -- matrice I/O sur base jetable ; `zones-depart.sql` lancé deux fois : chaque code de `pays.ts` attribué une fois au plus, selon la liste validée, `RU` et `BY` sans zone.
- [ ] `docs/migrations.md` (story 2.3, journal) et `AGENTS.md` (où sont les zones).

**Acceptance Criteria:**
- Given une offre liée à une zone, when on supprime la zone directement en SQL, then PostgreSQL refuse (`RESTRICT`).
- Given la migration appliquée, when on revient au commit précédent, then le site fonctionne (tables ignorées).

## Verification

**Commands:**
- `npx eslint .` ; `node scripts/verifier-exceptions-prisma.cjs origin/main` -- OK, liste inchangée.
- `npx tsc --noEmit` ; `npm test` -- tout passe.
- Migrations sur base vide puis `prisma migrate diff --exit-code` -- aucun écart.
- `npm run build` -- succès.
