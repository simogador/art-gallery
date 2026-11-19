---
title: 'Story 7.7 — Suivi des commandes par lien, sans compte'
type: 'feature'
created: '2026-11-18'
status: 'review'
baseline_commit: '9b669f0'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-7-6-confirmation-de-commande.md', '{project-root}/_bmad-output/implementation-artifacts/spec-6-3-vente-assistee-reserver-et-envoyer-le-lien.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'acheteur n'a aucun moyen durable de retrouver ses commandes : la confirmation (7.6) dépend d'un cookie propre à son navigateur et disparaît après 7 jours, et aucun e-mail ne le ramène vers elles (FR-15, AD-14).

**Approach:**
- Nouvel usage de jeton `suivi` (migration additive d'une valeur d'énumération), émis et vérifié seulement par `acces`, valeur en clair uniquement dans l'e-mail ; page publique `/suivi/[jeton]` (route d'échange) : le jeton valide est échangé contre un cookie `httpOnly`, puis redirection sans jeton vers `/suivi` avec `Referrer-Policy: no-referrer`, hors mesure.
- Les e-mails à l'acheteur (confirmation de commande, annulation) portent un lien de suivi émis au moment de l'envoi ; un échec d'envoi révoque le jeton.
- `/suivi` (serveur, `force-dynamic`, `noindex`) : toutes les commandes du passage, chacune avec sa frise d'états (étapes faites avec leurs dates réelles, date de livraison prévue), le minimum de données personnelles, Conseil WhatsApp avec le numéro de commande ; lien inconnu, périmé ou commandes closes : « Ce lien de suivi n'est plus actif : la commande est close. » avec Conseil, identique pour un jeton inconnu.
- Le bouton « Suivre mes commandes » de `/confirmation` (7.6) devient actif : une action serveur échange le jeton du navigateur (`commande_publique`) contre un jeton `suivi` et mène à `/suivi`.

## Boundaries & Constraints

**Always:**
- Décision 1A : transporteur, numéro de suivi et étapes d'expédition ne sont pas livrés à la 7.7 (aucune donnée ni écran avant l'Epic 8) ; la frise ne montre que les étapes connues (commande reçue, paiement constaté, annulée) et la date de livraison prévue.
- Décision 2A : le lien de suivi vaut 1 an (`DUREE_SUIVI_JOURS` de `reglages`, réduisible plus tard) ; la page dit « close » quand toutes les commandes sont annulées ou que le lien est périmé.
- Décision 3A : `/suivi` passe la maintenance comme `/commande` et `/confirmation` ; les deux décisions (`/confirmation` et `/suivi`) sont inscrites dans `docs/decisions-porteur.md` avec la date du jour.
- Jetons : seuls `acces` les créent et les vérifient (empreinte SHA-256, jamais la valeur en clair en base ni dans un journal) ; cible = id du passage ; échéance = `DUREE_SUIVI_JOURS` de `reglages` ; le jeton n'est pas consommé par l'échange (le lien de l'e-mail reste réutilisable jusqu'à l'échéance).
- Lecture seule : aucune écriture hors émission et révocation de jetons ; dates et états lus en base (commande, paiement constaté), jamais déduits côté client ; délais et montants lus sur les lignes figées, aucun total additionné hors `livraison`.
- Minimum de données personnelles : jamais l'adresse de livraison ni le téléphone ni les coordonnées de l'artiste ; au plus le nom de l'acheteur déjà utilisé par la 7.6 ; jamais d'e-mail ni de lien dans les journaux (ids seulement).
- Un jeton inconnu, périmé, révoqué ou mal formé donne la même page que des commandes closes, sans dire s'il a existé ; aucune écriture pour une valeur mal formée.
- Textes dans `fr` (règle `jsx-no-literals` sur `src/app/suivi/`), aucune promesse de délai de remboursement ni de retour (OQ-2, OQ-4 ouvertes), aucune proposition de compte (UXQ-9).
- `LOT2_OUVERT` reste lu seulement par `lot2Ouvert()` : le code ne l'ouvre jamais ; les liens de suivi concernent aussi les ventes assistées (indépendantes du Lot 2).

**Never:** transporteur et numéro de suivi saisis (aucune donnée ni écran avant l'Epic 8, voir décision plus bas) ; e-mails de prise en charge, d'expédition et de livraison (Epic 8) ; « Signaler un problème » (Epic 8) ; encaissement (7.5) ; `Order`, `/api/checkout`, webhook Stripe ; `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Lien valide | `/suivi/[jeton]` | cookie `httpOnly`, redirection sans jeton, `no-referrer`, hors mesure | — |
| Passage confirmé | commandes `confirmee` | une frise par commande : commande reçue (date réelle), paiement constaté (date réelle), livraison prévue (date calculée à partir du délai) | — |
| Passage mixte | une confirmée, une annulée | chaque commande à son état, annulée dite telle | — |
| Toutes closes | toutes `annulee` | « Ce lien de suivi n'est plus actif : la commande est close. » et Conseil | — |
| Jeton inconnu, périmé, révoqué | tout jeton non valide | même page que « close », sans rien indiquer de plus | aucune écriture |
| E-mail de confirmation | `CommandeConfirmee` | lien de suivi émis à l'envoi dans l'e-mail ; échec d'envoi : jeton révoqué | pas de nouvel essai (AQ-2 ouverte) |
| Depuis `/confirmation` | « Suivre mes commandes » | jeton `suivi` émis pour le passage du navigateur, cookie posé, redirection vers `/suivi` | cookie absent : message neutre |
| Lien transféré | quelqu'un d'autre ouvre le lien | mêmes données minimales, jamais l'adresse ni le téléphone | — |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` + migration additive -- valeur `suivi` de `UsageJeton` ; `docs/migrations.md`.
- `src/lib/acces/suivi.ts` (nouveau) -- émettre, lire et révoquer le jeton `suivi` via `jetons.ts` seulement.
- `src/lib/commandes/suivi.ts` (nouveau, lecture seule) -- commandes du passage avec frise (états, dates réelles lues sur la commande et le paiement constaté, livraison prévue), état « close ».
- `src/app/suivi/[jeton]/route.ts` (échange, `Referrer-Policy`, `Cache-Control: no-store`), `src/app/suivi/page.tsx` (serveur, `force-dynamic`, `noindex`), `loading.tsx`, `error.tsx`, textes `fr.suivi`, tests.
- `src/lib/notifications/` -- le lien de suivi dans `contenuCommandeConfirmee` et `contenuCommandeAnnulee`, émis dans le gestionnaire au moment de l'envoi, révoqué en cas d'échec ; `src/lib/conseil/` -- message avec le numéro de commande.
- `src/app/confirmation/SuivreCommandes.tsx` -- bouton actif et action serveur.
- `src/lib/reglages/index.ts` -- `DUREE_SUIVI_JOURS`, `passeLaMaintenance` (voir décisions) ; `cheminMesurable` n'en fait pas partie.
- Ne pas modifier : `/api/checkout`, webhook Stripe, `Order`, `traiterPaiementConstate`.

## Tasks & Acceptance

**Execution:**
- [x] migration `suivi`, module `acces/suivi`, lecture `commandes/suivi`, tests (base réelle)
- [x] route d'échange et page `/suivi`, textes `fr`, test navigateur et de rendu
- [x] liens dans les e-mails à l'acheteur (émission à l'envoi), bouton de `/confirmation`, Conseil avec numéro, `AGENTS.md`, `docs/migrations.md`

**Acceptance Criteria:**
- Given un lien `/suivi/[jeton]` valide, when il est ouvert, then le jeton est échangé contre un cookie `httpOnly`, l'URL est redirigée sans jeton avec `Referrer-Policy: no-referrer`, et la page est hors mesure.
- Given un e-mail de confirmation ou d'annulation, when il est envoyé, then il porte un lien de suivi émis à l'envoi (valeur en clair seulement dans l'e-mail) ; si l'envoi échoue, le jeton est révoqué.
- Given la page de suivi, when elle s'affiche, then chaque commande du passage a sa frise d'états avec les dates réelles des étapes faites et la date de livraison prévue, sans adresse ni téléphone, avec Conseil et le numéro de commande.
- Given des commandes closes, un jeton inconnu, périmé ou révoqué, when le lien est ouvert, then « Ce lien de suivi n'est plus actif : la commande est close. » apparaît, sans rien indiquer de plus.
- Given `/confirmation`, when l'acheteur touche « Suivre mes commandes », then il arrive sur son suivi.

## Implementation Notes

- Migration `20261121090000_suivi` (valeur `suivi` de `UsageJeton`, SHA-256 `78a706c7…eb408`), procédure, SQL et contrôle dans `docs/migrations.md` ; non appliquée à une base partagée.
- `acces/suivi.ts` : une nouvelle émission ne révoque PAS les liens précédents du passage (chaque e-mail garde son lien) ; un échec d'envoi révoque seulement le jeton émis (`revoquerJetonParValeur` ajouté à `jetons.ts`).
- Cookie `suivi` à `/suivi` (sert la page et la route d'échange). `lireSuiviPassage` rend `{ fermee: true, commandes: [] }` quand tout est annulé (la page close ne montre rien de plus) ; le nom de l'acheteur n'est pas rendu du tout.
- Date d'annulation : aucune colonne (ni `Commande.updatedAt` fiable) : étape « annulée » sans date. Livraison prévue = constat + délai figé en jours calendaires.
- Bouton `/confirmation` : l'action `ouvrirSuivi` pose le cookie et renvoie `{ ok }`, le client fait `router.push('/suivi')` (testable sans redirection serveur). Le lien `suivi` du navigateur est réutilisé s'il vise le même passage ; pas de limite par IP (documenté).
- Panne d'émission du jeton à l'envoi : l'e-mail part sans lien (la confirmation prime), journal d'ids.
- `messageConseil` étendu (`{ type: 'commande', numeros }`) ; `fr.confirmation.suivreAide` remplacé par `suivreEnCours` et `suivreErreur`.
- Corrections après relectures : e-mail d'annulation sans lien (aucun jeton émis) quand le passage n'a plus de commande vivante ; échange en panne = 503 neutre (jamais « close ») ; délai nul ou absent = inconnu (« au plus tard » si seul le minimum est nul) ; frise d'une annulée avec « Paiement constaté » si un paiement existe ; plafond de 20 liens actifs par passage pour `ouvrirSuivi` seulement (`PLAFOND_LIENS_SUIVI`) ; `secure` unique (`optionsCookieSuivi`, `NODE_ENV`) ; `role="list"`, plus de `aria-current` sur la livraison ni de `tabIndex` sur le `h1` ; `metadata.referrer` ; Conseil accordé au pluriel ; limites supplémentaires dans AGENTS.md. Le cas « composition qui renvoie null » n'est pas atteignable avec les deux contenus à lien (toujours non nuls) : seul « composition qui lève » est testé.
- Décision 3A inscrite dans `docs/decisions-porteur.md` (2026-11-18) ; `AGENTS.md` mis à jour (middleware, « Running », 7.3, 7.4, 7.6, nouveau paragraphe 7.7).

## Spec Change Log

## Review Triage Log

Passe 1 (trois relectures : aveugle, cas limites, lacunes de vérification).

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| E-mail d'annulation : lien de suivi menant à « close » quand toutes les commandes sont annulées | medium | patch | Aucun jeton émis ni lien écrit sans commande vivante ; lien conservé pour un passage mixte ; tests. |
| Panne de base pendant l'échange du lien : un lien valide affiché « close » | medium | patch | Route 503 neutre avec « Réessayer », sans cookie ni jeton dans le journal ; test. |
| Délai nul ou absent : « livraison prévue » le jour du paiement | medium | patch | Délai nul ou absent = inconnu, « au plus tard » si seul le minimum est nul ; tests. |
| Commande annulée après paiement constaté : l'étape de paiement omise | low | patch | « Paiement constaté » daté puis « Annulée » et « Écrivez-nous au sujet du remboursement », sans délai. |
| `ouvrirSuivi` sans limite : jetons émis sans fin si le cookie n'est pas renvoyé | medium | patch | `PLAFOND_LIENS_SUIVI` (20 actifs par passage), refus `trop_de_liens`, jamais pour les e-mails ; test. |
| Critère `secure` différent entre route et action ; frise sans `role="list"` ; `aria-current` à tort ; `h1` focalisable sans focus ; `metadata.referrer` ; Conseil au singulier | low | patch | Helper unique, accessibilité corrigée, parité testée, pluriel testé. |
| Tests manquants (échecs du gestionnaire, cookie d'un autre passage, lien transféré, texte réel de l'e-mail d'annulation, lien absolu) et scan de source redondant | medium | patch | Ajoutés ; scan « select/adresse » retiré. |
| Jeton révoqué quand l'envoi est accepté mais la réponse perdue : lien « close » | medium | defer | Révocation imposée par la spec ; limite documentée dans `AGENTS.md`. |
| Un seul cookie `suivi` par navigateur ; jetons non purgés ; jeton dans le chemin de la première requête ; dates en jours calendaires UTC et `constateLe` = saisie de l'équipe ; commande en attente jamais balayée | low | defer | Limites documentées (AD-14, 6.5, 6.7). |
| Mot « close » affiché aussi pour un lien simplement périmé | low | rejet | Texte imposé par la spec, à relire par le porteur. |
| Mocks de la suite, absence de test comportemental de la mesure, « composition qui renvoie null » inatteignable | low | rejet | Convention du dépôt, liste blanche de `cheminMesurable` ; cas inatteignable noté. |

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Migration appliquée par le porteur (sauvegarde, `preview`, production) avant la fusion ; préversion avec `LOT2_OUVERT=oui` dans la préversion seulement, jamais en production.
