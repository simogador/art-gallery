---
title: 'Story 4.2 — Demande de sélection personnalisée'
type: 'feature'
created: '2026-11-10'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le visiteur qui ne sait pas par où commencer ne peut pas décrire son espace, ses goûts et son budget à l'équipe ; aucune demande n'est enregistrée ni accusée (FR-8, UX-DR44, repli de FR-7 tant qu'OQ-7 est ouverte).

**Approach:**
- Page `/conseil` (formulaire), atteinte depuis l'en-tête et le pied de page ; le module `demandes` enregistre la demande à l'état `nouvelle` et en reste le seul propriétaire.
- Un événement `DemandeSelectionRecue` déclenche l'e-mail « Accusé de demande » par un gestionnaire de `notifications` (un seul e-mail, même rejoué).

## Boundaries & Constraints

**Always:**
- Champs : espace (texte libre : pièce et mur), goûts (ambiances de la liste fermée de `curation/depot-regles`, plusieurs possibles, plus texte libre facultatif), budget (montant maximum en euros entiers), e-mail (obligatoire), téléphone (facultatif).
- Décisions du porteur du 2026-11-10 : délai de réponse annoncé = 48 heures (`reglages`, changer = une PR) ; alerte à l'équipe = un e-mail à `CONTACT_EQUIPE` à chaque demande, avec seulement le numéro de la demande et un lien vers l'administration (aucune donnée personnelle) ; un second gestionnaire du même événement l'envoie.
- Confirmation à l'écran : « Demande reçue. Nous vous répondons sous 48 heures. » ; même délai dans l'e-mail d'accusé.
- Formulaire : libellés visibles, validation à la sortie du champ et à l'envoi, message sous le champ fautif, résumé en tête s'il y en a plusieurs, saisie conservée, bouton « Envoi… » qui ignore les doubles appuis.
- Anti-abus : au-delà d'un seuil par IP ou par e-mail (fenêtre glissante, empreintes salées comme `inscrireOuverture`), refus sans message technique ; seuils dans `reglages`.
- Jamais d'adresse, de téléphone ni de texte saisi dans les journaux ni dans la charge de l'événement (id de la demande seulement) ; l'adresse est lue en base à l'envoi.
- Textes dans `fr` (vouvoiement, sans jargon), tous les e-mails se terminent par le pied de la 4.1 ; textes visibles de `/conseil` sous la règle `react/jsx-no-literals` ; test navigateur de l'interaction du formulaire.

**Never:**
- Prestataire ou SDK hors de l'adaptateur de la 4.1 ; migration autre qu'additive ; décider du numéro, des horaires ou du délai WhatsApp (OQ-7) ; file d'administration des demandes (story 4.6) ; mesure (story 4.8).
- Toucher à `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Envoi valide | tous les champs corrects | demande `nouvelle` enregistrée, confirmation avec délai, un e-mail d'accusé | — |
| Champs fautifs | e-mail ou budget invalide, espace vide | message sous chaque champ, résumé si plusieurs, saisie conservée | rien d'enregistré |
| Double appui | deux envois rapides | une seule demande, un seul e-mail | bouton « Envoi… » ; contrôle côté serveur |
| Trop d'envois | seuil dépassé (IP ou e-mail) | refus sans message technique, rien d'enregistré | message neutre « Réessayez un peu plus tard » |
| Événement rejoué | répartition répétée | un seul e-mail | réclamation déjà prise : rien |
| Envoi d'e-mail refusé | prestataire en échec (accusé ou alerte) | la demande reste enregistrée et confirmée à l'écran | échec journalisé (ids seulement) |
| Alerte à l'équipe | demande enregistrée | un e-mail à `CONTACT_EQUIPE` : numéro de la demande et lien vers l'administration, rien de personnel | rejeu : un seul e-mail |
| Hors production | local ou préversion | aucun envoi réel, ligne de journal sans adresse | — |
| Journaux et charges | lecture après envoi | ni adresse, ni téléphone, ni texte saisi | — |

</frozen-after-approval>

## Code Map

- `src/lib/demandes/index.ts`, `email.ts` -- module existant (maintenance, FR-35) : modèle des empreintes IP/e-mail (`empreinte`, `TentativeInscription`, `normaliserEmail`) à réutiliser avec un préfixe de clé distinct ; ajouter `enregistrerDemandeSelection`, règles pures de validation (`demandes/selection-regles.ts`) importables côté client.
- `prisma/schema.prisma` + migration additive -- table `DemandeSelection` (id, espace, goûts, précision, budgetCentimes, e-mail, téléphone, état `nouvelle|planifiee|faite|sans_suite`, `createdAt`) ; états déjà prévus pour 4.6.
- `src/lib/evenements/catalogue.ts`, `src/lib/abonnements.ts` -- événement `DemandeSelectionRecue` (charge `{ demandeId }`) ; `src/lib/notifications/{gestionnaires.ts,contenus.ts,index.ts}` -- gestionnaires `envoyerAccuseDemande` (contenu « Accusé de demande ») et `alerterEquipeDemande` (lien vers `/dashboard/admin` tant que la file de la 4.6 n'existe pas).
- `src/app/conseil/` (page, formulaire client, actions serveur), `src/components/layout/{Header,Footer}.tsx` -- liens « Contacter » et « Conseil » vers `/conseil` ; `src/lib/reglages/index.ts` -- délai de réponse, seuils ; `src/lib/i18n/fr.ts` -- textes `conseil` et `courriels.accuse`.
- `tests/demandes-selection.test.ts` (base réelle, adaptateur factice), `tests/navigateur/formulaire-conseil.test.tsx` ; `AGENTS.md`, `docs/migrations.md`.

## Tasks & Acceptance

**Execution:**
- [ ] `prisma/` -- table `DemandeSelection` et migration additive
- [ ] `src/lib/demandes/` -- règles de validation, enregistrement, limitation d'envois, événement
- [ ] `src/lib/notifications/`, `src/lib/evenements/`, `src/lib/abonnements.ts` -- accusé de demande
- [ ] `src/app/conseil/`, en-tête et pied de page, `reglages`, `fr` -- page, formulaire, liens, textes
- [ ] tests (base réelle et navigateur), `AGENTS.md`, `docs/migrations.md`

**Acceptance Criteria:**
- Given `/conseil` ouvert depuis n'importe quelle page, when le visiteur envoie un formulaire valide, then la demande est enregistrée à l'état `nouvelle`, l'écran affiche « Demande reçue. Nous vous répondons sous [délai]. » et un seul e-mail d'accusé part avec le délai.
- Given un champ fautif, when le visiteur envoie, then le message apparaît sous le champ (résumé en tête s'il y en a plusieurs), la saisie est conservée et le bouton ignore les doubles appuis.
- Given des envois répétés depuis une même IP ou pour un même e-mail, when le seuil est dépassé, then les envois suivants sont refusés sans message technique.
- Given une demande enregistrée, when l'événement est traité, then un seul e-mail d'alerte, sans donnée personnelle, part vers l'équipe.

## Verification

**Commands:**
- `npx eslint .` et les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Préversion : le formulaire s'affiche et enregistre une demande (vérification par SQL) ; l'adaptateur « journal » est actif, aucun e-mail réel.
