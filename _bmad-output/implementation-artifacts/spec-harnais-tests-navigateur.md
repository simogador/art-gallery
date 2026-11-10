---
title: 'Harnais de tests d''interactions dans un vrai navigateur'
type: 'chore'
created: '2026-11-10'
status: 'done'
route: 'dispatch'
baseline_commit: '2307b8c0e52e08d826e1341a390c41b95e00a75d'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-retro-2026-11-10.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le choix du pays, le carrousel (plein écran, zoom), l'envoi de photo d'un artiste et la bascule « Sélection de l'accueil » ne sont vérifiés qu'à la main en préversion (rétrospective de l'epic 3, action A2). Plusieurs garde-fous de `tests/` lisent le texte source des fichiers, ce qui casse à la moindre refonte sans prouver le comportement.

**Approach:** Ajouter un outil de test qui exécute ces composants dans un vrai navigateur, avec des actions serveur simulées, lancé par `npm run` et par la CI ; couvrir les quatre interactions ; remplacer par un test de comportement chaque garde-fou par lecture de source qui peut l'être.

## Boundaries & Constraints

**Always:**
- Décisions du porteur du 2026-11-10 : outil = mode navigateur de Vitest (Chromium piloté par Playwright), composants isolés, actions serveur simulées ; contrôle « Navigateur » ajouté à la CI à chaque PR (pas de test du site complet, ni de connexion factice).
- Aucun changement visible pour les visiteurs ni pour l'équipe ; aucune migration ; code de production touché seulement si un test révèle un défaut (alors signalé dans les notes).
- Les tests n'appellent ni Cloudinary, ni Stripe, ni la base de production ; l'envoi de photo est simulé.
- Les textes attendus viennent du dictionnaire `fr` (pas de chaînes recopiées).
- Les garde-fous d'`AGENTS.md` (listes d'exceptions, textes, interface) restent tenus.

**Never:**
- Remplacer ou retirer les tests Vitest existants qui exercent le serveur sur un vrai PostgreSQL.
- Ajouter un chemin de connexion factice ou une route réservée aux tests dans le code de production.
- Toucher à `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Choix du pays | saisie, sélection au clavier, validation | action appelée avec le code ISO, liste annoncée, rafraîchissement demandé | erreur de l'action affichée |
| Carrousel | boutons, flèches du clavier, compteur | compteur « 2/4 » à jour, jamais de défilement automatique | une seule photo : ni compteur ni boutons |
| Plein écran | ouverture, zoom, Échap | `<dialog>` ouvert puis fermé, focus rendu au déclencheur | — |
| Envoi de photo artiste | fichier valide, trop lourd, type refusé | envoi puis enregistrement appelés ; refus lisible sans appel | échec d'envoi : message « Envoi impossible », ancienne photo conservée |
| Sélection de l'accueil | bascule marquer / démarquer | action appelée avec le slug et l'état voulu, résultat annoncé | refus de l'action affiché |

</frozen-after-approval>

## Code Map

- `src/components/ui/PaysLivraison.tsx` -- choix du pays (`choisirPaysLivraison` de `src/app/actions/pays.ts`, `useRouter`) ; actions et routeur à simuler.
- `src/app/galerie/[id]/CarrouselPhotos.tsx` -- défilement natif, compteur, `<dialog>` plein écran avec zoom.
- `src/app/dashboard/admin/artistes/FicheArtiste.tsx` et `src/components/dashboard/envoiCloudinary.ts` -- envoi signé puis enregistrement ; réseau simulé.
- `src/app/dashboard/admin/oeuvres/page.tsx` (`actionSelection`) -- bascule « Sélection de l'accueil » ; à isoler dans un composant testable si elle n'en a pas.
- `vitest.config.mts`, `package.json`, `.github/workflows/ci.yml` -- configuration, scripts et CI (`npm test` reste inchangé).
- `tests/*.test.ts` utilisant `readFileSync` (31 usages ; `accueil`, `fiche`, `galerie`, `interface-accessible`, `i18n`) -- garde-fous par lecture de source à convertir en tests de comportement quand c'est possible ; ne pas toucher aux scans de `interface-accessible` et `i18n`, qui sont des règles de dépôt, pas des garde-fous de comportement.
- `AGENTS.md` (« Running and verifying ») -- documenter la commande.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, `vitest.config.mts` -- outil de test navigateur, script dédié -- mode navigateur de Vitest (Chromium via Playwright), script `test:navigateur`, `npm test` inchangé
- [x] `tests/navigateur/*.test.tsx` -- un fichier par interaction de la matrice
- [x] `tests/*.test.ts` -- remplacer les gardes par lecture de source qui ont un équivalent de comportement
- [x] `.github/workflows/ci.yml` -- job « Navigateur » (installe Chromium) à chaque PR vers `main`
- [x] `AGENTS.md` -- commande et règle d'usage

**Acceptance Criteria:**
- Given le dépôt propre, when on lance la commande du harnais, then les cinq scénarios de la matrice passent dans Chromium sans réseau externe.
- Given un défaut introduit dans l'une des quatre interactions, when la commande tourne, then un test échoue.
- Given `npm test`, `npx eslint .` et `npm run build`, when on les lance, then ils réussissent comme avant.

## Implementation Notes

## Review Triage Log

| # | Constat (relecteurs) | Verdict | Preuve | Suite |
|---|---|---|---|---|
| 1 | « Panier » du menu mobile : le test par lecture de source a été supprimé, le rendu statique n'ouvre jamais le menu (`useState(false)`), donc plus rien ne garde le lien tant que le Lot 2 est fermé (V, B, E) | high | `Header.tsx:60`, aucun test ne clique « Menu » | patch : test navigateur du menu ouvert, Lot 2 fermé puis ouvert |
| 2 | « Jamais de défilement automatique » : attente fixe de 1,5 s, une minuterie plus longue passerait (V, B, E) | medium | test du carrousel | patch : espionner `setInterval` et `setTimeout` pendant l'affichage en plus de l'attente |
| 3 | AGENTS.md : la règle de fusion et le paragraphe de `ci.yml` ignorent le contrôle « Navigateur » ; les entrées 3.10 et 3.11 décrivent encore l'ancienne bascule ; limites du harnais (styles injectés, pas de repli sans JavaScript de la bascule) non dites (B) | medium | `AGENTS.md` | patch (tâche AGENTS.md de la spec) |
| 4 | Un cinquième scénario manque (B) | false | la matrice a cinq lignes : choix du pays, carrousel et plein écran (un fichier), envoi de photo, sélection ; quatre fichiers les couvrent | rejeté |
| 5 | Bascule de sélection : sans JavaScript elle ne fait plus rien ; bandeau déplacé et bouton grisé pendant l'envoi (B, E, V) | low | écran réservé aux administrateurs ; bandeau de même style et de même place (`page.tsx`), priorité de la décision inchangée (`??` avant) ; l'isolation en composant testable est prévue par le Code Map | rejeté, limite consignée dans AGENTS.md (#3) |
| 6 | Erreur non redirigée de l'action de sélection non gérée (E) | low | même comportement que l'ancien formulaire | rejeté |
| 7 | Textes en dur « Aucune photo », « Envoi en cours… » dans `PhotoArtiste.tsx` (B) | false | recopiés tels quels de `FicheArtiste.tsx` (avant la story) ; écran d'administration hors des surfaces de la règle | rejeté |
| 8 | Listes d'exceptions ou `tsconfig`/ESLint cassés par les nouveaux fichiers (B) | false | ESLint 0 erreur, `npm test` (scan d'interface compris) et build verts | rejeté |
| 9 | Playwright en `^`, `--no-sandbox` en local, pas de cache des navigateurs en CI (B, E) | low | `package-lock.json` fige 1.65.0 ; l'environnement tourne en root ; coût de téléchargement sans effet sur le résultat | rejeté |
| 10 | Test du middleware : `next-auth` simulé, modules en cache, variables vides (B, E, V) | low | le garde remplacé n'était qu'une lecture de source ; le nouveau test exécute le middleware | rejeté |
| 11 | Détails des tests : sélecteurs couplés, tautologie sur une constante, saisie rapide de deux fichiers, annonce `aria-live` par re-rendu, CSS de test injecté (V, E) | low | sans risque pour le comportement protégé ; CSS injecté consigné (#3) | rejeté |

## Verification

**Commands:**
- `npm run` script du harnais, `npm test`, `npx eslint .`, `npm run build` -- réussis
