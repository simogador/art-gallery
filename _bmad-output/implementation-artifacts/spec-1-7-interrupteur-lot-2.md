---
title: 'Story 1.7 — Interrupteur du Lot 2 et fermeture du chemin d’achat actuel'
type: 'feature'
created: '2026-10-27'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le chemin d'achat actuel (`POST /api/checkout`, bouton du panier, appel Stripe de la confirmation) est ouvert : une œuvre peut être vendue sans réservation avant le Lot 2 (AR-5, AD-17).

**Approach:** Créer le module `reglages` (`src/lib/reglages/`) avec une seule fonction qui dit si le Lot 2 est ouvert, d'après une variable d'environnement Vercel ; absente ou fermée → fermé. Lot 2 fermé : `POST /api/checkout` refuse sans créer de session de paiement, le panier n'affiche plus le bouton de paiement, `confirmation/page.tsx` n'appelle plus le prestataire. Lot 2 ouvert : comportement actuel inchangé (retour arrière possible). Tests des deux états ; la PR décrit comment le porteur ouvre ou ferme le Lot 2 dans Vercel. Ne touche ni `MAINTENANCE_MODE`, ni `robots.txt`, ni `src/generated/prisma/`, ni aucun secret, ni les réglages Vercel.

</frozen-after-approval>

## Implementation Notes

- Variable : `LOT2_OUVERT`, ouverte uniquement si elle vaut `oui` (casse et espaces ignorés), sur le modèle de `MAINTENANCE_MODE` ; le nom n'était fixé par aucun document. Fonction : `lot2Ouvert(env = process.env)` dans `src/lib/reglages/index.ts`.
- `src/app/api/checkout/route.ts` : 403 `{ error, code: 'lot2_ferme' }` avant toute autre étape (ni authentification, ni base, ni Stripe).
- `src/app/panier/page.tsx` lit `lot2Ouvert()` côté serveur et le passe à `CartContent` (`achatOuvert`) ; fermé, le bouton est remplacé par un message.
- `src/app/confirmation/page.tsx` : fermé, redirection vers `/panier` avant `getStripe()`.
- Le webhook Stripe n'est pas modifié : sans session créée, il ne reçoit rien de nouveau ; il reste l'exception d'AD-4.
- `tests/lot2.test.ts` (7 tests) : valeurs de la variable ; fermé (variable vide ou absente) → 403 sans session, y compris pour un visiteur non connecté, et confirmation sans appel au prestataire ; ouvert → session créée et prestataire interrogé (auth, Prisma et Stripe simulés). Mutation vérifiée : sans le verrou, le test échoue. `vitest.config.mts` compile le JSX (`oxc.jsx.runtime: automatic`), `tsconfig` gardant `jsx: preserve` pour Next.
- AGENTS.md : règle « ne jamais ouvrir le Lot 2 dans le code » et mention dans « Paiement ».
- AGENTS.md dit aussi comment ouvrir le Lot 2 en local (`LOT2_OUVERT=oui` dans `.env.local`).
- Vérifié : 25 tests, `tsc --noEmit`, `npx eslint .`, liste d'exceptions (23, aucun ajout), `npm run build`.
- Les stories 1.2 à 1.6 restent en `review` (réglages du porteur non confirmés).

## Review Triage Log

- `sprint-status.yaml` rendu invalide (indentation) par ma commande `sed` — high : vrai ; corrigé, YAML relu.
- Description de la PR pour le porteur absente — false à ce stade : elle accompagne la PR (environnements concernés, redéploiement nécessaire).
- Nom et valeur de la variable non consignés comme décision — low : AD-17 (spine validé) fixe le principe d'une variable Vercel ; le nom est un détail d'implémentation, consigné ici et dans AGENTS.md, et signalé au porteur dans la PR ; rejeté.
- « Ajouter au panier » encore affiché, panier sans contact — medium : vrai, hors critères de la story ; différé vers la barre d'actions du Lot 1 (story 4.7) et le conseil (stories 4.2 à 4.4).
- Confirmation masquée pour un paiement fait avant la fermeture — low : imposé par le critère (« n'appelle plus le prestataire ») ; le webhook enregistre toujours la commande ; signalé dans la PR ; rejeté.
- 403 affiché comme erreur dans un panier déjà ouvert — low : le message est clair ; rejeté.
- Tests : variable absente et refus avant authentification — low : ajoutés. Rendu du panier non testé — low : vérification dans la préversion ; rejeté.
- Mocks partagés sans `resetModules` — low : `lot2Ouvert()` est lue à chaque appel ; mock d'auth réinitialisé avant chaque test ; rejeté pour le reste.
- Pas de `.env.example` — low : ouverture locale documentée dans AGENTS.md ; rejeté.
