---
title: 'Story 7.4 — Récapitulatif et paiement dans une zone neutre'
type: 'feature'
created: '2026-11-18'
status: 'done'
baseline_commit: 'cc4eb26'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-7-3-coordonnees-sans-compte-et-reservation-en-heure-fixe.md', '{project-root}/_bmad-output/implementation-artifacts/spec-6-4-paiement-constate-et-confirmation.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Après les coordonnées (7.3), l'acheteur dont les œuvres sont réservées n'a nulle part où voir un récapitulatif complet avant de payer, ni comment finaliser : l'écran dit seulement que le paiement « ouvrira prochainement » (FR-11, FR-14, AD-4). Aucun prestataire d'encaissement n'est décidé (OQ-1 ouverte).

**Approach:**
- Page `/commande/paiement` (serveur, `force-dynamic`, `noindex`, hors mesure) pour le passage de l'acheteur sans compte : pour chaque commande, le prix de chaque œuvre, les frais de livraison, le prix total, le délai total et l'artiste, lus sur les lignes figées (aucun montant additionné ni recalculé dans l'interface) ; le total général en clair avec « Droits et taxes d'import éventuels non inclus » ; la réservation rappelée en heure fixe ; un rappel sobre des conditions, sans durée de retour ni gratuité (OQ-2, OQ-4 ouvertes).
- Le port `Encaissement` (déjà défini en 6.4) gagne un point d'entrée « ouvrir un paiement » appelé par la page : sans adaptateur configuré (aujourd'hui), la page affiche une **zone neutre** hachurée, jamais interactive, sans formulaire, logo ni nom de prestataire, qui nomme ce qui n'est pas décidé (« Le moyen de paiement en ligne n'est pas encore ouvert ») et invite l'acheteur à finaliser avec l'équipe (Conseil WhatsApp, numéros de commande à communiquer) ; le constat manuel de la 6.4 s'applique. Avec un adaptateur (7.5), un Paiement `ouvert` est créé pour le passage au total recalculé par le serveur.
- Depuis `/commande/coordonnees`, « Continuer vers le paiement » mène à cette page.

## Boundaries & Constraints

**Always:**
- Décision 1A : rappel des conditions sobre (artiste vendeur, Errancy intermédiaire, aucune durée de retour ni « garantie »), sans lien tant que la 7.1 n'existe pas ; la 7.1 ajoutera les liens vers les pages de confiance.
- Décision 2A : `/commande/paiement` ne sert que le passage de l'acheteur sans compte (cookie `passage`) ; `/commande` (6.3) reste telle quelle pour la vente assistée.
- Décision 3A : aucun e-mail d'alerte à l'équipe ; l'acheteur écrit sur WhatsApp et l'équipe voit le passage dans « Réservations en cours » de `/dashboard/admin/commandes`.
- Page et action refusent tout passage public tant que `lot2Ouvert()` est faux (AD-17).
- Montants, frais, délais et totaux lus sur les lignes figées des commandes ou calculés par `livraison` ou par agrégat de la base ; jamais d'addition dans un composant ni dans la page ; le serveur ne débite jamais un montant différent du total recalculé.
- Le passage est retrouvé par le cookie `passage` (jeton `commande_publique`, 7.3), jamais par un identifiant du navigateur ; jeton absent, périmé, passage payé, annulé ou abandonné : message neutre et retour au panier.
- OQ-16 reste ouverte : un Paiement couvre tout le passage (décision 1A de la 6.4) ; aucun Paiement n'est créé sans adaptateur (la table exige une source et une référence externe).
- Aucun nom de prestataire hors `paiement/adaptateurs/` ; jamais d'e-mail ni d'adresse dans les journaux ; textes dans `fr` (règle `jsx-no-literals` sur `src/app/commande/paiement/`) ; formats par `i18n/formats` ; focus, cibles de 44 px et propriétés logiques du socle de l'Epic 3.
- `LOT2_OUVERT` reste lu seulement par `lot2Ouvert()` : le code ne l'ouvre jamais.

**Never:** encaissement réel, formulaire de carte, nom ou logo de prestataire (7.5, OQ-1) ; confirmation et suivi (7.6, 7.7) ; pages légales (7.1) ; ouverture d'« Acheter » (7.8) ; `Order`, `/api/checkout`, webhook Stripe ; `traiterPaiementConstate` inchangé ; `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Lot 2 fermé | visiteur ouvre `/commande/paiement` | « L'achat en ligne ouvrira prochainement » et lien vers le panier, rien d'autre | — |
| Passage valide | cookie `passage`, réservation en cours | récapitulatif par commande, total général, réservation en heure fixe, zone neutre, Conseil | — |
| Deux artistes | passage de deux commandes | deux cartes numérotées (numéro de commande), total « A + B » puis total, bandeau « 2 colis séparés » | — |
| Réservation échue | retour après l'échéance | phrase « a pris fin », renvoi vers `/commande/coordonnees` pour retenter | — |
| Sans passage | pas de cookie, jeton périmé ou commande payée ou annulée | message neutre, lien vers le panier | — |
| Adaptateur configuré (futur) | 7.5 | un Paiement `ouvert` au total du passage, jamais un autre montant | refus typé sans détail technique |
| Aucun adaptateur | aujourd'hui | zone neutre, aucun Paiement créé | — |

</frozen-after-approval>

## Code Map

- `src/app/commande/paiement/` -- page serveur, `loading.tsx`, `error.tsx`, composants d'affichage (réutiliser `RecapitulatifFige` et `ReservationHeureFixe` de `commande/coordonnees/`), textes `fr.paiementAcheteur`, test navigateur.
- `src/lib/paiement/` -- `ports.ts` : point d'entrée « ouvrir un paiement » du port `Encaissement` ; `index.ts` : adaptateur configuré ou `null` (aucun nom de prestataire hors `adaptateurs/`).
- `src/lib/commandes/` -- lecture du passage de l'acheteur pour la page (réutilise `lirePassagePublic`, `lireCommandesDuPassage`), création du Paiement ouvert au total par agrégat (seulement avec adaptateur).
- `src/app/commande/coordonnees/page.tsx`, `fr` -- remplacer « L'étape suivante ouvrira prochainement » par « Continuer vers le paiement ».
- Ne pas modifier : `/api/checkout`, webhook Stripe, `Order`, `traiterPaiementConstate`, états de commande.

## Tasks & Acceptance

**Execution:**
- [x] port `Encaissement` : « ouvrir un paiement », sans adaptateur aujourd'hui ; tests
- [x] page `/commande/paiement` : récapitulatif, total général, réservation en heure fixe, zone neutre, Conseil ; lien depuis les coordonnées ; textes `fr`, test navigateur, `AGENTS.md`

**Acceptance Criteria:**
- Given un passage réservé, when l'acheteur ouvre `/commande/paiement`, then il voit pour chaque commande le prix de chaque œuvre, les frais, le prix total, le délai, l'artiste, puis le total général avec la mention des droits, la réservation en heure fixe et un lien Conseil.
- Given aucun adaptateur d'encaissement, when la zone de paiement s'affiche, then elle est neutre (sans formulaire, logo ni nom de prestataire), nomme ce qui n'est pas décidé et invite à finaliser avec l'équipe ; aucun Paiement n'est créé.
- Given un adaptateur configuré, when le paiement s'ouvre, then un Paiement `ouvert` est créé au total du passage lu par agrégat, jamais à un autre montant.
- Given le Lot 2 fermé, un passage inconnu, périmé, payé ou annulé, when la page s'ouvre, then le message prévu apparaît et rien n'est créé.
- Given le code, when le test scanne `src/`, then aucun composant n'additionne prix et frais.

## Implementation Notes

- Port : `Encaissement.ouvrir?` facultatif (absent du constat manuel), type `EncaissementOuvrable` ; `adaptateurEncaissement()` (`paiement/selecteur.ts`) renvoie `null`. `lireRecapitulatifPaiement` (`commandes/paiement-acheteur.ts`) lit commandes en attente, agrégats par commande (`groupBy`, `_sum`, `_max`) et total dans une seule transaction ; une commande sans ligne lève une erreur (état de panne de la page).
- `ouvrirPaiement(jeton, { adaptateur? })` : n'est appelée par AUCUNE page (aucune écriture dans un rendu GET ; la 7.5 l'appellera depuis une action serveur de l'acheteur). Appel de l'adaptateur hors transaction, puis revérification sous le verrou (réservation non échue, commandes en attente, total égal sinon `total_change`) ; Paiement ouvert d'une autre source ou d'un autre montant : `paiement_deja_ouvert`, jamais écrasé. Appels simultanés d'un même processus : un seul appel à l'adaptateur. Session prestataire éventuellement orpheline si la transaction échoue après l'appel : limite pour la 7.5.
- Page `/commande/paiement` : lecture seule. États dans l'ordre Lot 2 fermé, panne, passage inactif (avec lien vers `/commande` si le cookie `commande` est présent), puis un seul arbre pour récapitulatif et échu : `ReservationHeureFixe` garde son instance, annonce la bascule « a pris fin » (région `status`) et prend le focus. Délai nul, artiste absent : lignes masquées ; commande sans œuvre : message neutre. Classe `.zone-neutre` dans `globals.css`.
- `/commande/coordonnees` (état 4) : « Continuer vers le paiement ». Aucune migration, aucun e-mail, aucun événement ; middleware inchangé (test ajouté).
- Points douteux : textes (conditions, zone neutre, phrase sur la réservation) à relire par le porteur ; pas de « Modifier ma commande » sur la page de paiement.

## Spec Change Log

## Review Triage Log

Passe 1 (trois relectures : aveugle, cas limites, lacunes de vérification).

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Écriture dans un rendu GET : `ouvrirPaiement` appelé à chaque affichage (prefetch du lien, rechargement, minuteur) | medium | patch | Appel retiré de la page ; test qui prouve qu'aucun Paiement n'est créé à l'affichage ; la 7.5 le déclenchera par une action de l'acheteur. |
| Appel au prestataire sous le verrou du passage ; Paiement ouvert d'une autre source (constat manuel) ou d'un autre montant écrasé, session prestataire orpheline | medium | patch | Appel hors transaction, réservation, commandes et total revérifiés sous verrou (`total_change`), refus `paiement_deja_ouvert` sans écrasement ; adaptateur appelé une seule fois en appels simultanés (assertion explicite). |
| Lecture incohérente affichée « Aucune commande à payer » ; lectures séparées ; commande annulée non filtrée | medium | patch | Une transaction, filtre sur l'état, erreur `recapitulatif_incoherent` menant à la panne avec « Réessayer ». |
| « 0 jour », « Artiste : » vide, commande sans œuvre | low | patch | Lignes masquées, message neutre pour une commande sans œuvre. |
| Textes qui promettent plus que la décision (« dès réception », « jusqu'à la livraison »), clé morte | medium | patch | Reformulés ; phrase sur la fin de la réservation ajoutée, à relire par le porteur. |
| Cookie de la vente assistée sans passage : renvoi vers le panier inutile ; focus et annonce à l'échéance | low | patch | Lien vers `/commande` ; bascule annoncée et focus sur la phrase, testés. |
| Tests manquants (somme multi-lignes et délais, `error.tsx`, panne, lien Conseil réel, mesure, état échu, cas limites d'`ouvrirPaiement`) et documentation | medium | patch | Ajoutés ; `AGENTS.md`, dictionnaire et spec alignés. |
| Règlement reçu après l'échéance de 30 minutes (parcours WhatsApp) : chemin de la 6.5, œuvre éventuellement prise | medium | defer | Décision du porteur à prendre avant d'ouvrir le Lot 2 ; consigné dans `AGENTS.md`. |
| Passage de deux commandes dont une seule réservation est terminée : `echue` reste faux | low | defer | La commande à œuvre prise est annulée par la 6.6 ou au constat (6.5) ; limite documentée. |
| « Modifier ma commande » laissera un Paiement ouvert orphelin avec un adaptateur | medium | defer | À fermer par `annulerPassagePublic` à la 7.5 ; limite documentée. |
| Scan de source anti-addition faible, test du dictionnaire par texte, test de couleur, niveaux de titres, « Modifier ma commande » sur la page de paiement | low | rejet | Le test de `livraison` et les agrégats en base le prouvent ; aucun dommage nommé. |

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Aucune migration. Préversion avec `LOT2_OUVERT=oui` dans la préversion seulement, jamais en production.
