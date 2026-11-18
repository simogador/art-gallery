---
title: 'Story 7.6 — Confirmation de commande'
type: 'feature'
created: '2026-11-18'
status: 'done'
baseline_commit: '7aade6f'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-7-4-recapitulatif-et-paiement-dans-une-zone-neutre.md', '{project-root}/_bmad-output/implementation-artifacts/spec-6-4-paiement-constate-et-confirmation.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Après son paiement, l'acheteur n'a nulle part où voir que ses commandes sont confirmées : l'actuelle `/confirmation` interroge directement Stripe (ancien flux, fermé avec le Lot 2) et ne sait rien des commandes par artiste ni du constat de paiement (FR-13, UJ-1, UXQ-9).

**Approach:**
- `/confirmation` est refaite (serveur, `force-dynamic`, `noindex`, hors mesure) et ne parle plus à aucun prestataire : elle relit, pour le passage de l'acheteur, l'état des commandes en base.
- Paiement constaté : « Merci, [nom] », une carte par commande numérotée (numéro, artiste, œuvres, délai, libellé « Confirmée »), « Suivre mes commandes » (lien vers la 7.7, inactif tant qu'elle n'existe pas), aucune proposition de compte. Une commande annulée est dite telle (« Annulée »), jamais « Confirmée ».
- Paiement pas encore constaté : « Nous avons bien reçu votre demande. La confirmation arrive par e-mail dès que votre paiement est constaté. », sans le mot « Confirmée » ; la page se met à jour d'elle-même quand le constat arrive (rafraîchissement du serveur toutes les 20 secondes pendant 10 minutes, arrêté dès la confirmation).
- Le panier du navigateur est vidé quand une commande est confirmée.

## Boundaries & Constraints

**Always:**
- Décision 1A : la page sert l'acheteur sans compte, par son cookie `passage` ; la vente assistée (cookie `commande`, `/commande`) reste telle quelle.
- Décision 2A : « Merci, [nom tel que saisi]. » (un seul champ « nom » existe), sans deviner le prénom.
- Le passage est retrouvé par le cookie `passage` (jeton `commande_publique`, 7.3), jamais par un identifiant fourni par le navigateur ; lecture seule, aucune écriture, aucun appel à un prestataire.
- « Confirmée » n'est affiché que pour une commande `confirmee` relue en base ; commande `en_attente_paiement` : en attente ; `annulee` : annulée ; sans lecture de l'état du prestataire.
- Montants, délais et numéros lus sur les lignes figées et les commandes ; aucun total additionné hors `livraison` ni dans un composant ; aucune coordonnée de l'artiste ; jamais d'e-mail ni d'adresse dans les journaux.
- Textes dans `fr` (règle `jsx-no-literals` sur `src/app/confirmation/`), aucune promesse de délai de remboursement ni de retour (OQ-2, OQ-4 ouvertes), aucune proposition de créer un compte.
- `LOT2_OUVERT` reste lu seulement par `lot2Ouvert()` : le code ne l'ouvre jamais.

**Never:** encaissement et paiement en ligne (7.5, OQ-1) ; suivi par lien (7.7) ; e-mails de commande (déjà livrés) ; `Order`, `/api/checkout`, webhook Stripe ; `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Paiement constaté | commandes du passage `confirmee` | « Merci, [nom] », cartes « Confirmée », « Suivre mes commandes », panier vidé | — |
| Pas encore constaté | commandes `en_attente_paiement` | message d'attente par e-mail, jamais « Confirmée », mise à jour automatique | arrêt du rafraîchissement après 10 minutes, message conservé |
| Commande annulée | une ou toutes `annulee` | libellé « Annulée » et message neutre de l'équipe, jamais « Confirmée » | — |
| Passage mixte | une confirmée, une annulée | chaque carte à son état | — |
| Sans passage | pas de cookie, jeton périmé ou inconnu | message neutre et lien vers l'accueil | — |
| Ancien lien Stripe | `?session_id=…` | ignoré, mêmes règles que sans passage | aucun appel au prestataire |
| Lot 2 fermé | acheteur sans compte | message neutre (aucun passage public n'existe) | — |

</frozen-after-approval>

## Code Map

- `src/app/confirmation/page.tsx` -- refaite (plus de Stripe, plus de lecture directe de `prisma` : passer par `commandes`) ; `CartClearer.tsx` conservé ; client `MiseAJourAuto.tsx` (rafraîchissement) ; `loading.tsx`, `error.tsx` ; textes `fr.confirmation`.
- `src/lib/commandes/` -- lecture du passage de l'acheteur **y compris confirmé** (`lirePassagePublic` ignore aujourd'hui les commandes payées) : fonction de lecture seule rendant le nom de l'acheteur, les commandes (numéro, état, artiste, œuvres, délai) et l'état global.
- `src/lib/acces/commande-publique.ts` -- lecture du jeton (déjà lisible 7 jours après l'échéance).
- `eslint/exceptions-prisma.cjs`, `eslint/exceptions-textes.cjs`, `tests/exceptions-interface.cjs` -- retirer l'ancienne page si elle y figure.
- Ne pas modifier : `/api/checkout`, webhook Stripe, `Order`, `traiterPaiementConstate`.

## Tasks & Acceptance

**Execution:**
- [x] lecture seule du passage (commandes confirmées, en attente, annulées) dans `commandes`, tests (base réelle)
- [x] page `/confirmation`, mise à jour automatique, panier vidé, textes `fr`, test navigateur, `AGENTS.md`

**Acceptance Criteria:**
- Given un paiement constaté, when l'acheteur ouvre `/confirmation`, then « Merci, [nom] », chaque commande numérotée avec l'artiste, le délai et « Confirmée », et « Suivre mes commandes ».
- Given un paiement pas encore constaté, when la page s'ouvre, then elle dit que la confirmation arrive par e-mail, sans « Confirmée », et se met à jour quand le constat arrive.
- Given une commande annulée, when la page s'ouvre, then elle n'est jamais dite confirmée.
- Given la page, when elle est rendue, then aucun prestataire n'est appelé et aucun compte n'est proposé.

## Implementation Notes

- `lireConfirmationPassage(jeton)` (`src/lib/commandes/confirmation.ts`, lecture seule) : commandes `confirmee`, `en_attente_paiement` et `annulee` du passage du cookie ; prix, frais, total et délai par agrégat de la base ; `etatGlobal` (`confirmee`, `en_attente`, `annulee`, `mixte`). Page, composants (`CartesConfirmation`, `MiseAJourAuto`, `SuivreCommandes`, `loading`, `error`) et textes `fr.confirmation`.
- Cookie du passage : renommé `passage_acheteur`, chemin `/` (un cookie ne peut cibler `/commande` et `/confirmation` ; Next 14 ne garde qu'une entrée par nom, d'où le nouveau nom). `/confirmation` ajouté à `passeLaMaintenance` : **question ouverte à faire valider par le porteur**.
- Texte d'attente exact (rien ne prouve un paiement tenté) ; état « réservation échue » (lien « Retenter ma réservation », sans rafraîchissement) ; `CartClearer` ne retire que les œuvres confirmées ; rafraîchissement suspendu onglet caché ; « Suivre mes commandes » en `aria-disabled`.
- L'ancienne page Stripe est remplacée ; `tests/lot2.test.ts` adapté (plus de redirection ni d'appel au prestataire). Entrée retirée de `eslint/exceptions-prisma.cjs` ; `src/app/confirmation/**` ajouté aux surfaces de `jsx-no-literals`.
- Une commande `historique` n'a pas de passage : elle n'est jamais atteinte par le jeton.
- Limites : voir le paragraphe « Confirmation de commande » d'`AGENTS.md`.

## Spec Change Log

## Review Triage Log

Passe 1 (trois relectures : aveugle, cas limites, lacunes de vérification).

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Effacement de l'ancien chemin du cookie `passage` écrasé par la pose à `/` (un seul cookie par nom et par réponse dans Next 14) : deux cookies en conflit, passage périmé lu | high | patch | Nouveau nom `passage_acheteur` (chemin `/`), plus aucun effacement ; tests adaptés. |
| Annonce « confirmée » et focus quand la dernière commande en attente est annulée | medium | patch | Props `confirmee`/`annulee` ; annonce propre à chaque cas ; tests navigateur. |
| Texte « Nous avons bien reçu votre demande » alors qu'aucun paiement n'est prouvé ; réservation échue sans état propre | medium | patch | Texte exact (« pas encore confirmée »), état « réservation échue » sans promesse d'e-mail ni rafraîchissement. |
| `CartClearer` vidait tout le panier à chaque visite | medium | patch | Ne retire que les œuvres des commandes confirmées. |
| Titre « Merci » avec une commande en attente ; nom long ; message d'annulation qui promet un message de l'équipe ; bouton inactif non focalisable ; rafraîchissement onglet caché | low | patch | Corrigés et testés. |
| Tests : mise à jour automatique et panier vidé non prouvés au niveau page, tests tautologiques de `lot2.test.ts`, paiement tardif sur commande annulée de bout en bout, `loading`/`error` | medium | patch | Arbre de la page inspecté, assertions de texte, test avec `annulerCommande` et `traiterPaiementConstate`, tests navigateur. |
| `/api/checkout` pointe encore vers `/confirmation?session_id=` | medium | defer | Flux fermé, route inchangée jusqu'à la 7.9 ; limite documentée. |
| Confirmation introuvable après l'échéance + 7 jours ; second achat qui remplace le cookie | medium | defer | La 7.7 (lien de suivi durable) y répond ; limite documentée. |
| `/confirmation` passe la maintenance comme `/commande` | medium | defer | Décision du porteur à valider ; consignée comme question ouverte dans `AGENTS.md` et la PR. |
| Lot 2 fermé avec un passage payé affiche « ouvrira prochainement » ; commande cassée qui fait tomber toute la page | low | rejet | Prévu par la spec (aucun passage public sans Lot 2) ; erreur explicite avec « Réessayer », cohérente avec la 7.4. |
| Scan de source anti-addition jugé faible, test de dictionnaire par motif | low | rejet | Le test de `livraison` et les agrégats en base le prouvent. |

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Aucune migration. Préversion avec `LOT2_OUVERT=oui` dans la préversion seulement, jamais en production.
