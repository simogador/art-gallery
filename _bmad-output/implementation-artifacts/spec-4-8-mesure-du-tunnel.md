---
title: 'Story 4.8 — Mesure du tunnel avec consentement'
type: 'feature'
created: '2026-11-10'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-4-4-conseil-whatsapp.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le porteur ne sait pas ce qui fait vendre : aucune mesure du parcours du visiteur (vue d'une fiche, choix du pays, clic sur le Conseil WhatsApp, envoi d'une demande), alors que les objectifs se fixent après une première mesure (FR-27, AD-19, NFR-6).

**Approach:**
- Un module `mesure` : événements typés, adaptateur PostHog hébergé dans l'UE (décision du porteur du 2026-10-27, OQ-9) en production, adaptateur « journal » ailleurs ; appels faits côté serveur, aucun SDK dans le navigateur.
- Un choix de consentement non bloquant, conservé et modifiable ; sans consentement, aucun événement ne part.

## Boundaries & Constraints

**Always:**
- Module `src/lib/mesure/` (déjà dans `MODULES_METIER`) : liste typée unique des événements (`VueFiche`, `ChoixPays`, `ClicConseil`, `DemandeEnvoyee`, `AjoutPanier`, `DebutCommande`, `CommandeConfirmee`), chacun avec le slug de l'œuvre (si elle existe) et la source d'arrivée, jamais de donnée personnelle (ni e-mail, ni téléphone, ni texte saisi) ; port `Mesure`, adaptateur PostHog (appel HTTP sans SDK, hébergement UE, clé et adresse en variables Vercel, jamais dans le code), adaptateur « journal » (nom de l'événement seulement) ; PostHog seulement si `VERCEL_ENV=production` (AD-22). Aucun composant n'importe un prestataire ; le nom du prestataire n'est que dans son adaptateur (test).
- Seuls les événements dont l'action existe sont émis : vue de fiche, choix du pays, clic Conseil WhatsApp, envoi d'une demande (sélection ou visite). `AjoutPanier`, `DebutCommande` et `CommandeConfirmee` sont typés mais n'ont aucun émetteur avant les Epics 6 et 7.
- Consentement : choix proposé dans une bannière non bloquante (jamais de fenêtre surgissante), « Accepter » et « Refuser » également visibles ; choix conservé dans un cookie (un an) et modifiable par un lien du pied de page ; refus ou absence de choix = aucun événement et aucun cookie de mesure (test) ; le serveur relit le consentement à chaque événement.
- Seuls les taux de consentement et de refus sont comptés : un compteur par jour et par choix, sans identifiant (nouvelle table additive) ; un refus n'envoie rien au prestataire.
- Source d'arrivée : `utm_source` ou domaine du référent, lue à l'arrivée et gardée pour la session (seulement après consentement) ; jamais l'adresse complète.
- Aucune URL portant un jeton n'est mesurée (liste blanche de chemins : fiches, galerie, artistes, conseil, visite ; jamais `/auth/invitation`, `/dashboard`, `/api`) ; aucun événement des administrateurs ni des pages du tableau de bord.
- Une erreur de mesure ne fait jamais échouer l'action du visiteur ; aucune donnée personnelle dans les journaux ; textes dans `fr.mesure` (vouvoiement).
- Décisions du porteur du 2026-11-10 : le choix de consentement est proposé à tous les visiteurs, partout ; il se modifie par un lien « Gérer la mesure » du pied de page qui rouvre la bannière (la page Cookies de l'Epic 7 le reprendra) ; les événements d'un même visiteur sont reliés par un identifiant aléatoire dans un cookie, posé seulement après consentement et supprimé en cas de refus ou de retrait.
- Test navigateur de la bannière (choix, conservation, retrait) ; tests de base réelle du compteur et du refus.

**Never:**
- SDK de mesure dans le navigateur, cookie de mesure avant consentement, mesure des pages de confiance (Epic 7), tableau de bord de la mesure (le porteur lit PostHog), durée de conservation des données (réglage PostHog du porteur, hors code).
- Toucher à `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/` ; migration autre qu'additive.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Premier visiteur | aucun choix | bannière non bloquante, aucun événement | — |
| Accepte | clic « Accepter » | choix conservé, compteur « accepté » +1, événements envoyés | échec d'enregistrement : le choix reste appliqué |
| Refuse | clic « Refuser » | choix conservé, compteur « refusé » +1, aucun événement ni cookie de mesure | — |
| Modifie son choix | lien du pied de page | bannière rouverte, nouveau choix appliqué | — |
| Vue de fiche avec consentement | œuvre visible | `VueFiche` avec slug et source d'arrivée | prestataire en échec : rien ne casse |
| Chemin à jeton | `/auth/invitation/...`, tableau de bord | jamais mesuré, même avec consentement | — |
| Hors production | aperçu ou local | adaptateur « journal », aucun envoi réel | — |
| Clic Conseil WhatsApp | consentement donné | `ClicConseil` envoyé sans retarder l'ouverture de WhatsApp | échec : WhatsApp s'ouvre quand même |

</frozen-after-approval>

## Code Map

- `src/lib/mesure/` (à créer) -- catalogue typé, port, adaptateurs PostHog et journal, `choix.ts`, consentement (cookie, compteur), liste blanche de chemins ; modèle : `src/lib/notifications/` (port, adaptateur, journal, choix).
- `prisma/schema.prisma` + migration -- compteur des choix de consentement (jour, choix, nombre), additif.
- `src/app/api/mesure/` (à créer) -- événements du navigateur (clic Conseil) et choix de consentement ; relit le consentement côté serveur.
- `src/components/ui/ChoixMesure.tsx` (client), `src/app/layout.tsx`, `src/components/layout/Footer.tsx` -- bannière non bloquante, lien « Gérer la mesure ».
- Émetteurs : `src/app/galerie/[id]/page.tsx` (vue de fiche), `src/app/actions/pays.ts` (choix du pays), `src/app/conseil/actions.ts` et `src/app/galerie/[id]/visite/actions.ts` (demande envoyée), `src/components/ui/BoutonConseil.tsx` (clic).
- `src/lib/reglages/index.ts` -- variables PostHog (clé, adresse UE) ; `src/lib/i18n/fr.ts` (`fr.mesure`) ; `AGENTS.md`, `docs/migrations.md`.
- `tests/mesure.test.ts` (base réelle, refus, jetons, adaptateurs), `tests/navigateur/choix-mesure.test.tsx`.

## Tasks & Acceptance

**Execution:**
- [ ] `prisma/` -- compteur des choix et migration additive
- [ ] `src/lib/mesure/` et `reglages` -- catalogue, port, adaptateurs, consentement
- [ ] `src/app/api/mesure/`, `ChoixMesure`, layout, pied de page -- bannière et lien
- [ ] émetteurs (fiche, pays, demandes, clic Conseil)
- [ ] tests (base réelle, navigateur), `AGENTS.md`, `docs/migrations.md`

**Acceptance Criteria:**
- Given un premier visiteur, when il arrive, then une bannière non bloquante propose « Accepter » et « Refuser », et aucun événement ne part avant son choix.
- Given un visiteur qui accepte, when il ouvre une fiche ou touche « Conseil WhatsApp », then l'événement part avec le slug et la source d'arrivée, par l'adaptateur de production seulement en production.
- Given un visiteur qui refuse, when il navigue, then aucun événement ni cookie de mesure n'existent, vérifié par un test, et seul le compteur de refus augmente.
- Given une page à jeton ou du tableau de bord, when elle s'affiche, then elle n'est jamais mesurée.

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Préversion : bannière, choix conservé, lien du pied de page ; événements dans les journaux (adaptateur « journal »). En production, après ajout par le porteur de la clé PostHog (variable Vercel) : événements visibles dans PostHog UE.
