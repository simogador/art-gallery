---
title: 'Story 2.5 — Déposer une œuvre : photos, informations, dimensions et prix'
type: 'feature'
created: '2026-11-02'
status: 'done'
route: 'dispatch'
baseline_commit: 'df7afcb28418473fb36825588d63a01c61ffedc7'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md', '{project-root}/docs/migrations.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'artiste ne peut déposer une œuvre qu'avec l'ancien formulaire de démonstration : une seule image, dimensions en texte libre, ni histoire, ni ambiance, ni couleur dominante, et un texte qui promet une mise en ligne immédiate (FR-20, FR-1, FR-2).

**Approach:**
- `/dashboard/artiste/oeuvres/nouvelle` affiche le nouveau formulaire de dépôt sur une seule page : en tête « N sections sur 5 complètes », la liste des sections avec « Complet » / « À compléter » et l'indication « Brouillon enregistré » ; sections 1. Photos, 2. Informations, 3. Dimensions et prix ; sections 4. Expédition (zones en lecture seule, comme aujourd'hui) et 5. Engagements présentes mais « À compléter », leur saisie venant en 2.6.
- Photos : quatre cases légendées, une photo chacune — « Œuvre de face, lumière du jour », « Gros plan de la matière », « Mise en situation avec repère d'échelle » (obligatoires) et « Vidéo » (facultative). Ajout depuis l'appareil photo ou la galerie, « Remplacer » sur une case remplie. Le navigateur envoie le fichier directement à Cloudinary avec une signature fournie par le serveur (pas de transit par Vercel, limité à 4,5 Mo) ; le serveur vérifie la signature de la réponse Cloudinary avant d'enregistrer la photo. La photo de face alimente aussi l'ancienne colonne `imageUrl`.
- Informations : titre, technique, année, histoire courte (300 caractères au plus, colonne `description`), ambiance. Dimensions et prix : hauteur et largeur en cm (profondeur facultative), conversion en pouces et orientation affichées aussitôt, couleur dominante, prix de l'œuvre seule en euros ; stockage en millimètres et centimes par `champsPrix`/`champsDimensions` (double écriture jusqu'à 2.10).
- Brouillon : le premier enregistrement crée l'œuvre (`brouillon` + `disponible`, via `publicationInitiale`/`disponibiliteInitiale`) puis l'URL devient `/dashboard/artiste/oeuvres/[slug]` ; chaque champ est enregistré à sa sortie, validé à la sortie et jamais à chaque frappe ; une valeur refusée reste affichée avec son erreur reliée. Seul l'artiste propriétaire lit et modifie son brouillon, contrôle serveur couvert par un test.
- Migration additive (colonnes `ambiance`, `couleurDominante` ; table des photos), appliquée par le porteur (`preview` puis production, SQL, ligne `_prisma_migrations`, SHA-256).

**Décisions du porteur (2026-11-02) :**
- Listes fermées, modifiables plus tard dans le code : couleur dominante = Ocre, Bleu, Blanc, Vert, Rouge, Noir, Gris, Jaune, Multicolore ; ambiance = Calme, Lumineuse, Intense, Mélancolique, Joyeuse, Mystérieuse. Stockées en codes `snake_case` sans accent.
- Cloudinary : le porteur vérifie, guidé pas à pas, que les trois variables existent dans Vercel pour Preview et Production ; l'agent ne modifie aucun réglage.
- Spec gardée entière malgré sa longueur (photos et champs forment un seul formulaire).

## Boundaries & Constraints

**Always:** logique dans `src/lib/curation/` (propriétaire du descriptif, des dimensions et des photos) ; actions serveur pour les mutations ; acteur issu de `acteurCourant()` ; résultats `{ ok, code }` et messages en français au vouvoiement ; libellés visibles, `autocomplete` adapté (`off` sauf exceptions), cibles de 44 px, états jamais portés par la seule couleur ; le secret Cloudinary ne quitte jamais le serveur ; `public_id` imposé par le serveur sous `errancy/oeuvres/<id de l'œuvre>/`.

**Never:** envoi en curation, saisie des zones et engagements (2.6) ; modification des œuvres déjà publiées par le nouveau formulaire (elles gardent l'ancienne page jusqu'à 2.7/2.8) ; lecture de `price`, `dimensions` ou `available` ; publication ou visibilité publique d'un brouillon ; toucher `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`, les secrets ou les réglages Vercel/Neon.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Premier champ | formulaire vide, titre saisi puis quitté | brouillon créé, URL `/oeuvres/[slug]`, « Brouillon enregistré » | échec réseau : « Non enregistré, réessayez », saisie conservée |
| Photo | image de 8 Mo dans la case gros plan | envoi direct à Cloudinary, vignette + « Remplacer » | type non image/vidéo ou > 20 Mo (image) / 100 Mo (vidéo) : refus avant envoi |
| Signature falsifiée | réponse Cloudinary modifiée côté client | photo non enregistrée | `signature_invalide` |
| Dimensions | 60 × 80 cm | « 23,6 × 31,5 in · paysage » ; 600 et 800 mm | 0, négatif ou > 1 000 cm : erreur reliée au champ |
| Prix | « 1 250,50 » | 125 050 centimes | illisible : `MESSAGE_PRIX_INVALIDE` |
| Autre artiste | slug d'une œuvre d'autrui | 404, aucune écriture | `acces_refuse` |
| Œuvre publiée | slug d'une œuvre `publiee` | ancienne page d'édition | écriture du dépôt refusée (`transition_interdite`) |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` -- `Artwork` : ajouter `ambiance String?`, `couleurDominante String?`, relation `photos` ; nouveau modèle `PhotoOeuvre` (id, `artworkId` FK `CASCADE`, `type` enum `TypePhoto` {`face_lumiere_du_jour`, `gros_plan`, `mise_en_situation`, `video`}, `url`, `publicId`, `largeur?`, `hauteur?`, dates ; unique `(artworkId, type)`).
- `src/lib/curation/index.ts` -- module propriétaire ; `publicationInitiale()` à réutiliser. Y ajouter `depot.ts` (créer brouillon, enregistrer un champ, lire le dépôt de l'artiste, état des sections) et `photos.ts` (signature, vérification, enregistrement).
- `src/lib/curation/depot-regles.ts` (nouveau, pur) -- listes, limites, validation par champ, complétude des sections, pouces et orientation ; importable côté client.
- `src/lib/cloudinary.ts` -- configuration existante ; `cloudinary.utils.api_sign_request` pour signer, `cloudinary.utils.verifyNotificationSignature`/calcul SHA-1 de `public_id`+`version` pour vérifier.
- `src/lib/catalogue/conversions.ts` -- `champsPrix`, `champsDimensions`, `prixEnCentimes` : seules voies d'écriture du prix et des dimensions. Pour des cm saisis séparément, construire `"<h> × <l> cm"` ou ajouter une fonction dédiée dans ce fichier.
- `src/lib/disponibilite` -- `disponibiliteInitiale`, `estRecopiee` ; seul lecteur de `publication`/`disponibilite` (test d'isolement) : exposer un prédicat `estBrouillon` si le dépôt doit le lire.
- `src/app/dashboard/artiste/oeuvres/nouvelle/page.tsx` -- remplacer `ArtworkForm` par le nouveau formulaire ; sortir le fichier des exceptions Prisma.
- `src/app/dashboard/artiste/oeuvres/[slug]/page.tsx` -- brouillon → nouveau formulaire ; sinon ancienne page inchangée.
- `src/app/dashboard/artiste/oeuvres/nouvelle/SectionExpedition.tsx` -- réutilisé tel quel.
- `src/app/api/artiste/oeuvres/route.ts` (POST) -- n'est plus appelé : le supprimer et le retirer de `eslint/exceptions-prisma.cjs`. `ArtworkForm` garde son mode `edit`.
- `src/lib/catalogue/espace-artiste.ts` -- `oeuvreAEditer(userId, slug)` : modèle de contrôle de propriété.
- `tests/utils/base-jetable.ts`, `tests/invitations.test.ts` -- modèles de tests (mock `next-auth`).

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` + `prisma/migrations/<horodatage>_depot_oeuvre/` -- colonnes et table photos, `migrate dev --create-only` sur PostgreSQL local -- migration additive.
- [x] `src/lib/curation/depot-regles.ts` -- règles pures (listes, limites : titre 120, technique 120, histoire 300, année 1900 à l'année courante, 1 à 10 000 mm) -- partagées client/serveur.
- [x] `src/lib/curation/depot.ts`, `photos.ts`, `index.ts` -- API du dépôt, propriété vérifiée, brouillon seulement, slug provisoire `brouillon-<8 caractères>` recalculé depuis le titre tant que l'œuvre est en brouillon -- logique métier.
- [x] `src/app/dashboard/artiste/oeuvres/depot/` (composants client `FormulaireDepot`, `CasePhoto`, actions serveur) -- interface et enregistrement à la sortie du champ.
- [x] Pages `nouvelle` et `[slug]`, suppression du POST, `eslint/exceptions-prisma.cjs` -- branchement.
- [x] `tests/depot.test.ts` -- matrice ci-dessus, propriété, signature, brouillon seul.
- [x] `docs/migrations.md`, `AGENTS.md`, `sprint-status.yaml` -- journal et repères.

**Acceptance Criteria:**
- Given un artiste connecté, when il ouvre `/dashboard/artiste/oeuvres/nouvelle`, then il voit une page unique avec les cinq sections, la progression et l'état de chaque section.
- Given une case photo remplie, when il touche « Remplacer », then la nouvelle photo remplace l'ancienne dans la même case.
- Given un brouillon, when un visiteur ou un autre artiste en demande la fiche publique ou la page de dépôt, then il obtient une 404.
- Given une erreur serveur à l'enregistrement d'un champ, when l'artiste corrige, then sa saisie n'a jamais été effacée.

## Implementation Notes

- Migration `20261102212219_depot_oeuvre`, créée par `migrate dev --create-only` sur PostgreSQL local ; `migrate diff` : aucune différence.
- `Artwork.year` reste obligatoire (migration additive) : un brouillon sans année porte `0` (`ANNEE_NON_RENSEIGNEE`), relu comme « non renseignée » ; les autres colonnes obligatoires de l'ancien schéma sont des textes vides.
- Envoi signé : la signature couvre `public_id` (chemin complet `errancy/oeuvres/<id>/<case>-<8 hex>`, unique à chaque envoi) et `timestamp`. `folder` est renvoyé pour information mais jamais posté à Cloudinary : en mode « dossiers fixes », `folder` + un `public_id` déjà préfixé doublerait le chemin. Vérification : signature `sha1(public_id=…&version=…+secret)` en temps constant, `public_id` conforme à l'œuvre et à la case, `resource_type` (image, ou vidéo pour la case Vidéo) et `secure_url` égale à l'adresse de cette ressource (non couverte par la signature). La photo remplacée est supprimée de Cloudinary au mieux, après l'écriture.
- Slug : `slugifier(titre)` unique (`-2`, `-3`…) ; `nouvelle` est réservé (il masquerait la page de dépôt). Titre vidé : slug conservé. Le client sérialise ses enregistrements (file) et met l'adresse à jour par `history.replaceState`, sans recharger le formulaire.
- Orientation : `ECART_CARRE = 0` (carrée seulement à hauteur = largeur), réglable dans `depot-regles.ts`.
- `publicationInitiale` est désormais dans `curation/depot.ts` (réexportée par `curation`). `ArtworkForm` perd son mode `create` (sa route POST est supprimée).

## Spec Change Log

## Review Triage Log

| # | Constat (relecteur) | Verdict | Preuve | Suite |
|---|---|---|---|---|
| 1 | Taille et format contrôlés seulement dans le navigateur (aveugle, cas limites) | medium | la signature ne couvrait que `public_id` et `timestamp` | patch : `allowed_formats` signé, `format`/`bytes` vérifiés |
| 2 | HEIC enregistré en `.heic`, illisible par les navigateurs (aveugle) | medium | URL brute copiée dans `PhotoOeuvre.url` et `imageUrl` | patch : extension `.jpg` |
| 3 | Envoi bloqué « en cours » sur abandon ou délai (cas limites) | low | ni `onabort` ni `ontimeout` | patch |
| 4 | Slug suffixé conservé après un titre préfixe (aveugle, vérification) | low | « Nuit 2024 » → « Nuit » gardait `nuit-2024` | patch + test |
| 5 | Aucun moyen de supprimer un brouillon (aveugle) | medium | les brouillons n'atteignent plus le bouton de `ArtworkForm` | patch : `DeleteButton` existant |
| 6 | Titre d'onglet « Modifier brouillon-xxxx » (aveugle) | low | `generateMetadata` | patch |
| 7 | Liste admin : titre vide et « 0 · » (vérification, cas limites) | low | `admin/oeuvres/page.tsx` | patch |
| 8 | Tests manquants : `actionPreparerEnvoi`, « Sans titre », photo sur œuvre publiée (vérification, aveugle) | medium | aucune occurrence dans `tests/` | patch : 5 tests |
| 9 | Statuts du suivi et de la spec divergents (aveugle) | low | `in-progress` contre `in-review` | patch |
| 10 | `verrouillerDepot` lit les colonnes d'état hors de `disponibilite` (aveugle) | false | le test d'isolement autorise `src/lib/curation/` | rejeté |
| 11 | Signature SHA-256 non gérée (cas limites) | low | compte et SDK en SHA-1 par défaut, aucun réglage contraire | rejeté |
| 12 | Collision de slug concurrente non rattrapée (3 relecteurs) | low | deux brouillons au même titre à la même seconde ; l'artiste réessaie | rejeté |
| 13 | Choix d'ambiance non réessayable après échec (cas limites) | low | rare (échec réseau) ; choisir une autre valeur puis revenir | rejeté |
| 14 | Brouillon créé avant la fin de l'envoi, ou en double sur réponse perdue (aveugle, cas limites) | low | rare ; supprimable désormais (n° 5) | rejeté |
| 15 | Fichiers Cloudinary orphelins (refus, onglet fermé, suppression d'œuvre) (aveugle, cas limites) | low | aucun nettoyage hors « Remplacer » et refus de format | defer |
| 16 | Ancien `PUT /api/artiste/oeuvres/[slug]` accepte encore un brouillon (aveugle) | low | requête forgée par l'artiste sur son propre brouillon | defer |
| 17 | Brouillon antérieur à 2.5 avec `imageUrl` sans `PhotoOeuvre` (cas limites) | maybe-false | dépend de brouillons existants en production | defer |
| 18 | File d'enregistrement du client non testée (vérification) | low | pas d'environnement DOM dans Vitest | defer, vérification manuelle en préversion |
| 19 | Limite image 20 Mo contre 10 Mo du plan gratuit Cloudinary (aveugle) | maybe-false | dépend du plan du compte | question au porteur |
| 20 | Visiteur redirigé vers la connexion au lieu d'une 404 (cas limites) | low | aucune fuite : il ne voit rien du brouillon | rejeté |
| 21 | Rafraîchissement complet et verrou à chaque lecture (aveugle, vérification) | low | performance, sans effet visible | rejeté |
| 22 | `SectionExpedition` dans le dossier `nouvelle` (aveugle) | low | rangement | rejeté |

## Design Notes

Envoi signé : l'action serveur reçoit `{ slug, type }`, vérifie la propriété et renvoie `{ cloudName, apiKey, timestamp, publicId, folder, signature }` ; le client poste le fichier sur `https://api.cloudinary.com/v1_1/<cloud>/auto/upload`, puis renvoie `{ public_id, version, signature, secure_url, resource_type }` à une seconde action qui recalcule `sha1("public_id=…&version=…" + secret)` et vérifie que `public_id` est celui qu'elle a imposé.

## Verification

**Commands:**
- `npx eslint .` -- aucune erreur
- `node scripts/verifier-exceptions-prisma.cjs origin/main` -- liste en baisse
- `npm test` -- tous verts
- `npm run build` -- réussi

**Manual checks:**
- Préversion : déposer une œuvre depuis un téléphone, recharger la page, retrouver toutes les valeurs.
