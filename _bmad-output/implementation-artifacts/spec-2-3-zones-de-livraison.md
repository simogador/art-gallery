---
title: 'Story 2.3 — Zones de livraison gérées par l''équipe'
type: 'feature'
created: '2026-10-31'
status: 'done'
route: 'dispatch'
baseline_commit: '3fef011435ba937110031b02f9245cb342e6c6c7'
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

- `prisma/schema.prisma` -- ajouter `Zone`, `ZonePays`, `OffreLivraison` (ids `cuid()` comme ailleurs ; relation `Artwork.offresLivraison`, cascade côté œuvre, `Restrict` côté zone). Migration `20261031004437_zones_livraison` générée contre le PostgreSQL local.
- `src/lib/livraison/` (déjà dans `MODULES_METIER` de `.eslintrc.js`) -- `pays.ts` pur (codes ISO, `nomPays` via `Intl.DisplayNames('fr')`, `estCodePays`), `index.ts` (lectures `listerZones`, `lireZone`, `paysAttribues` ; écritures avec `Acteur` : `creerZone`, `modifierZone`, `supprimerZone`). Conflit de clé primaire (`P2002`) → `pays_deja_pris`.
- `src/lib/acces` -- type `Acteur` ; modèle d'écriture : `src/lib/curation/index.ts` (`{ ok, code }`, refus hors admin).
- `src/app/dashboard/admin/zones/` -- `page.tsx` (liste), `actions.ts` (`'use server'`, `acteurCourant()`, `revalidatePath`), composant client de formulaire de zone ; gabarit visuel de `admin/artistes/page.tsx`. Garde de page comme `admin/artistes` (`acteurCourant`, redirection).
- `src/components/dashboard/AdminNav.tsx` -- entrée « Zones ».
- `src/app/dashboard/artiste/oeuvres/nouvelle/page.tsx` -- section Expédition (lecture `livraison`) ; ne pas toucher `ArtworkForm`.
- `tests/disponibilite.test.ts` -- modèle de test sur base jetable (`creerBaseJetable`, mocks `@/lib/acces`, `next/navigation`).

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` + `prisma/migrations/20261031004437_zones_livraison/` -- trois tables, sans écart (`migrate diff`).
- [x] `src/lib/livraison/pays.ts`, `src/lib/livraison/index.ts` -- module ci-dessus.
- [x] `src/app/dashboard/admin/zones/*`, `AdminNav.tsx` -- écran d'administration.
- [x] `src/app/dashboard/artiste/oeuvres/nouvelle/page.tsx` -- section Expédition.
- [x] `scripts/sql/zones-depart.sql` -- cinq zones, idempotent (`ON CONFLICT DO NOTHING`).
- [x] `tests/livraison.test.ts` -- matrice I/O sur base jetable ; `zones-depart.sql` lancé deux fois : chaque code de `pays.ts` attribué une fois au plus, selon la liste validée, `RU` et `BY` sans zone.
- [x] `docs/migrations.md` (story 2.3, journal) et `AGENTS.md` (où sont les zones).

**Acceptance Criteria:**
- Given une offre liée à une zone, when on supprime la zone directement en SQL, then PostgreSQL refuse (`RESTRICT`).
- Given la migration appliquée, when on revient au commit précédent, then le site fonctionne (tables ignorées).

## Implementation Notes

- Migration `20261031004437_zones_livraison` : SQL produit par `prisma migrate dev --create-only` contre une base locale (PostgreSQL 16) à jour ; migrations appliquées sur une base vide puis `migrate diff --exit-code` : aucun écart. Tables ajoutées seulement ; `Artwork` ne gagne qu'une relation (aucune colonne).
- `livraison/pays.ts` (pur) : 249 codes officiels + `XK` (Kosovo), noms par `Intl.DisplayNames('fr')`, `trierParNom`, `paysSansZone` (aide du bouton « Cocher tous les pays sans zone », testée). `livraison/messages.ts` (pur) : textes des refus.
- `livraison/index.ts` : `listerZones` (ordre de création, puis nom), `lireZone`, `attributionsPays`, `creerZone`, `modifierZone`, `supprimerZone`. Nom normalisé (espaces), unicité sans casse vérifiée dans la transaction (index unique simple en base ; l'expression `lower(nom)` n'est pas représentable dans `schema.prisma`). Conflits concurrents : `P2002` → `nom_pris` / `pays_deja_pris`, `P2003` à la suppression → `zone_utilisee`.
- Écran : `/dashboard/admin/zones` (liste, pays sans zone repliés), `/nouvelle`, `/[id]` (formulaire et suppression en deux temps) ; actions serveur dans `zones/actions.ts`, `revalidatePath` de l'écran et du dépôt ; pages `force-dynamic`. Message de résultat placé près du bouton « Enregistrer » (vérifié dans le navigateur : sinon hors de vue après la liste).
- Dépôt : `SectionExpedition.tsx` (fichier séparé pour être testé), lecture seule.
- `scripts/sql/zones-depart.sql` : généré une fois à partir de `pays.ts` (générateur non commité), contrôlé par le test ; lancé deux fois sur la base locale : 1 / 27 / 23 / 2 / 195, `RU` et `BY` sans zone.
- Vérification dans le navigateur (`next start` local, admin de test) : liste, case grisée « France — Union européenne », enregistrement, suppression en deux temps ; aucune erreur de console liée à l'écran.
- Liste d'exceptions Prisma inchangée (19) : `artiste/oeuvres/nouvelle/page.tsx` y figurait déjà.

## Review Triage Log

- `createMany(skipDuplicates)` : un pays pris entre la vérification et l'insertion est ignoré et l'enregistrement annonce un succès — medium : vrai (READ COMMITTED) ; patch (insertion des seuls nouveaux pays, sans `skipDuplicates`, donc P2002), test de concurrence.
- P2002 classé par `meta.target`, absent avec Prisma 7 + adaptateur pg : un conflit de nom est annoncé comme un conflit de pays — low : vrai (vérifié sur une vraie erreur : table dans `meta.driverAdapterError.cause.table`) ; patch (`refusSurConflit`), testé sur de vraies erreurs.
- Branche P2002 non testée (verification-gap) — vrai ; patch (tests ci-dessus).
- Filtre « autres zones » de la page `[id]` non testé ; une régression viderait la zone à l'enregistrement (verification-gap) — vrai ; patch (test des props de `ZoneForm`).
- Pages d'administration non testées (redirection hors admin, 404) — low : vrai ; patch (tests).
- `zones-depart.sql` « relançable sans risque » : relancé après un renommage, il recréerait une zone et réattribuerait des pays retirés — medium : vrai ; patch (bloc `DO`, n'agit que si `Zone` est vide), testé (relance après renommage sans effet) ; générateur commité (`scripts/generer-zones-depart.ts`).
- Liste des pays triée par l'ICU du navigateur à l'hydratation, différente possible de celle de Node — low : vrai (noms `Intl.DisplayNames` variables selon la version d'ICU) ; patch (liste nommée et triée par le serveur, passée en prop).
- Expression des accents écrite avec des caractères combinants invisibles — low : vrai (octets vérifiés) ; patch (`\u0300-\u036f`).
- Type des refus dupliqué dans `messages.ts`, longueur 60 écrite trois fois — low : vrai (un nouveau code ne serait pas signalé par le compilateur) ; patch (type et constante dans `messages.ts`).
- Nom sans normalisation Unicode (é composé / décomposé) — low : vrai ; patch (`normalize('NFC')`).
- Zone supprimée pendant une modification : P2025/P2003 non traduit (erreur 500) — low : vrai ; patch (`introuvable`).
- Double clic sur « Confirmer la suppression » : second envoi, message « n'existe plus » — low : vrai ; patch (bouton en attente).
- Unicité sans casse vérifiée par l'application seulement, course « Maroc » / « maroc » — low : vrai mais deux admins au même instant, et l'index sur `lower(nom)` n'est pas représentable dans `schema.prisma` (écart `migrate diff`) ; rejeté.
- « Cocher tous les pays sans zone » coche aussi RU et BY — low : vrai ; comportement voulu par la spec (rien n'est enregistré avant « Enregistrer », l'admin décoche) ; rejeté, signalé au porteur.
- Case grisée (donnée périmée) retirée en silence à l'enregistrement — low : la page exclut la zone éditée de `autresZones` (testé) ; ne survient qu'avec une page périmée pendant une modification concurrente ; rejeté.
- Après P2003, offre supprimée avant le recomptage : « 0 offre » — low : fenêtre de quelques millisecondes ; rejeté.
- `lireZone` et le dépôt lisent toutes les zones et leurs pays — low : 5 zones, 250 lignes ; rejeté.
- Ids `gen_random_uuid()` dans le SQL au lieu de `cuid()` — low : colonne texte sans format imposé, aucune lecture n'en dépend ; rejeté.
- Journal de `docs/migrations.md` sans entrée 2.3 — false : le journal consigne une application faite ; il sera rempli après celle du porteur, comme pour 2.1 et 2.2.
- `OffreLivraison` sans contraintes `CHECK` (frais négatifs, min > max, devise) — medium : vrai, mais la table n'est écrite qu'à partir de la story 2.6 ; defer.

## Verification

**Commands:**
- `npx eslint .` ; `node scripts/verifier-exceptions-prisma.cjs origin/main` -- OK, liste inchangée.
- `npx tsc --noEmit` ; `npm test` -- tout passe.
- Migrations sur base vide puis `prisma migrate diff --exit-code` -- aucun écart.
- `npm run build` -- succès.
