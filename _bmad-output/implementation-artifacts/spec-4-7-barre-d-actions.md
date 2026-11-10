---
title: 'Story 4.7 — Barre d''actions de la fiche (Lot 1)'
type: 'feature'
created: '2026-11-10'
status: 'done'
baseline_commit: '0d15b96768cd1d4f8ad3eee0987faa118951b20d'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-4-4-conseil-whatsapp.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Sur la fiche d'une œuvre, la demande de visite (4.3) n'est reliée à rien ; le Conseil WhatsApp (4.4) est posé au milieu d'anciens boutons non conformes (« Ajouter au panier » alors que le Lot 2 est fermé, « Prendre rendez-vous » dont le formulaire n'envoie rien) ; sur mobile, aucune action ne reste à portée de pouce (FR-6, UX-DR12, UX-DR13).

**Approach:**
- Une barre d'actions de la fiche : fixe en bas sur mobile, bloc collant en haut de la colonne d'informations dès `lg`, qui remplace les anciens boutons ; une seule action principale (le Conseil WhatsApp), les autres en secondaire.
- Elle relie la page de visite à la fiche ; « Acheter » est absent (et non grisé) tant que le Lot 2 est fermé.

## Boundaries & Constraints

**Always:**
- Actions par état (UX-DR12, `epic-4-context.md`) : disponible = Conseil WhatsApp (principal) + « Réserver une visite » (secondaire, lien vers `/galerie/[id]/visite`) ; pays non livré = même barre (visite conservée) ; vendue ou vendue ailleurs = Conseil WhatsApp + lien vers la page de l'artiste ; réservée = Conseil WhatsApp, sans heure de fin de réservation ; jamais plus d'une action principale à l'écran.
- Le bouton Conseil est `BoutonConseil` (4.4), rendu côté serveur et reçu en propriété ; il n'apparaît qu'une fois sur la fiche (la barre le remplace dans la page) ; le pied de page garde le sien.
- « Acheter » : absent tant que `lot2Ouvert()` est faux (lu par la page, jamais par un composant client) ; la fiche ne décide d'aucune réservation ni d'aucun achat.
- Mobile : barre fixe en bas (zone sûre de l'appareil respectée), contenu de la page dégagé en bas pour qu'elle ne cache rien ; masquée pendant la saisie dans un champ ; dès `lg`, bloc collant en haut de la colonne d'informations, jamais fixe.
- États de l'œuvre lus par un prédicat de `disponibilite` exposé dans le type d'affichage (aucune lecture directe de colonne) ; l'état « réservée » se distingue de « vendue » dans le type.
- Textes dans `fr` (`fr.fiche`), aucun texte en dur ; cibles d'au moins 44 × 44 px ; focus global conservé ; mouvement coupé sous `prefers-reduced-motion`.
- La page de visite devient joignable depuis la fiche (retrait de la mention « aucun lien avant la 4.7 » dans `AGENTS.md` et la spec 4.3).
- Décisions du porteur du 2026-11-10 : l'ancien bouton d'ajout au panier reste tel quel dans la barre seulement quand `lot2Ouvert()` est vrai (l'Epic 7 le refera) ; une œuvre réservée n'a que le Conseil WhatsApp tant que « Me prévenir » (4.5) n'existe pas, la 4.5 l'y ajoutera ; les boutons inactifs « Sauvegarder » et « Partager » sont retirés de la fiche.

**Never:**
- « Me prévenir » et ses inscriptions (4.5), mesure du clic (4.8), réservation et paiement (Epics 6 et 7), nouvelle migration ; bouton grisé ou durée de réservation montrée.
- Toucher à `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Disponible, mobile | Lot 2 fermé | barre fixe : Conseil WhatsApp (principal), « Réserver une visite » ; pas d'« Acheter » | — |
| Pays non livré | œuvre disponible | même barre, Conseil principal, visite proposée | — |
| Vendue ou vendue ailleurs | — | Conseil WhatsApp et « Découvrir [artiste] » ; aucune visite | — |
| Réservée | — | Conseil WhatsApp seul ; aucune heure de fin | — |
| Saisie dans un champ | focus dans un champ de saisie | barre masquée, réaffichée à la sortie | — |
| Écran `lg` et plus | — | bloc collant en haut de la colonne d'informations | — |
| Numéro WhatsApp absent | repli 4.4 | « Demander conseil » vers `/conseil`, même place | — |

</frozen-after-approval>

## Code Map

- `src/app/galerie/[id]/ArtworkDetail.tsx` -- à retirer : « Prendre rendez-vous », boutons « Sauvegarder » et « Partager », formulaire « Acquérir cette œuvre / M'alerter » (`Modal`, `handleContact`, qui n'envoie rien) ; à garder : le bouton d'ajout au panier, seulement Lot 2 ouvert ; à ajouter : la barre.
- `src/app/galerie/[id]/BarreActions.tsx` (client, à créer) -- barre fixe ou collante, masquée à la saisie ; reçoit `BoutonConseil` en propriété.
- `src/app/galerie/[id]/page.tsx` -- lit `lot2Ouvert()` et passe état, pays livré, bouton Conseil à la fiche.
- `src/lib/catalogue/mappers.ts`, `src/lib/types/index.ts`, `src/lib/disponibilite/etats.ts` -- distinguer « réservée » de « vendue » (`sold` reste), prédicat pur dans `disponibilite`.
- `src/lib/i18n/fr.ts` -- textes (`fr.fiche.barre`) ; `AGENTS.md`, spec 4.3 -- lien désormais posé.
- `tests/` -- rendu de la fiche par état (aucune réservation n'existe : états simulés), `tests/navigateur/barre-actions.test.tsx` (masquage à la saisie).

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/disponibilite/`, `catalogue/mappers`, `types` -- état « réservée » exposé
- [ ] `src/app/galerie/[id]/` -- barre d'actions, retrait des anciens boutons et du faux formulaire
- [ ] `fr`, `AGENTS.md` -- textes et documentation
- [ ] tests (rendu par état, navigateur), vérification manuelle sur mobile

**Acceptance Criteria:**
- Given une œuvre disponible et le Lot 2 fermé, when la fiche s'affiche sur mobile, then la barre fixe montre « Conseil WhatsApp » en principal et « Réserver une visite » en secondaire, sans « Acheter ».
- Given une œuvre vendue, réservée ou un pays non livré, when la barre s'affiche, then ses actions suivent la matrice.
- Given un champ en saisie ou un écran `lg`, when la fiche s'affiche, then la barre se masque à la saisie et devient un bloc collant dès `lg`.
- Given « Réserver une visite », when on la touche, then on arrive sur `/galerie/[id]/visite`.

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Préversion, sur téléphone ou en fenêtre étroite : barre fixe, lien de visite, aucune barre qui cache le contenu ; à partir de `lg`, bloc collant.

## Review Triage Log

| # | Source | Constat | Verdict | Route | Preuve / suite |
|---|--------|---------|---------|-------|----------------|
| 1 | Blind, Edge | Le dégagement `pb-52` est dans la page, le pied de page est en dehors : sur mobile la barre fixe cache le bas du pied de page ; 13 rem est une estimation | medium | patch | vérifié (`ArtworkDetail.tsx` ligne 88, `layout.tsx` ligne 81) ; la barre mesure sa hauteur et dégage le bas du document ; test navigateur |
| 2 | Verification Gap | Le passage de `lot2Ouvert()` de la page à la fiche n'est vérifié par aucun test | medium | patch | deux cas dans `tests/conseil-emplacements.test.ts` |
| 3 | Edge, Blind | Masquage à la saisie : clignote d'un champ à l'autre, état de départ faux si un champ a déjà le focus, `select` pris pour une saisie | medium | patch | `relatedTarget`, élément actif au montage, `select` exclu ; test navigateur |
| 4 | Edge | `fixed inset-x-0 bottom-0` restent sous `lg:sticky` | low | patch | `lg:bottom-auto lg:inset-x-auto` |
| 5 | Edge, Blind | Test « réservée sans lien artiste » qui passe à tort si le repère est absent | low | patch | assertion sur l'index trouvé |
| 6 | Edge, Blind | Lot 2 ouvert : le bouton d'achat et le Conseil sont tous deux principaux (« jamais plus d'une action principale ») | medium | defer | décision du porteur « tel quel » ; Lot 2 fermé en production ; hiérarchie de l'achat à refaire avec l'Epic 7 ; deferred-work.md |
| 7 | Blind | Une œuvre réservée garde le libellé « Vendue » | medium | defer | aucune réservation avant l'Epic 6 ; libellé « Réservée » à poser avec les réservations ; deferred-work.md |
| 8 | Edge | `BarreActions` dans un `motion.div` parent animé (transform) | false | rejet | le parent n'a que des variantes sans transformation ; la barre est hors des enfants animés |
| 9 | Edge | État déduit de `sold` : `reservee` facultatif devient « vendue » s'il manque | low | rejet | `mapArtwork` le pose toujours ; seules les œuvres visibles atteignent la fiche ; rendre le champ obligatoire toucherait chaque constructeur |
| 10 | Edge | `role="textbox"`, `contenteditable="plaintext-only"`, iframe non détectés | low | rejet | aucun champ de ce type sur la fiche |
| 11 | Edge | Retrait de « M'alerter » : œuvre réservée sans moyen de suivi | low | rejet | décision du porteur (Conseil seul jusqu'à la 4.5) |
| 12 | Blind | La barre est avant le contenu dans le DOM : l'ordre de lecture au clavier | low | rejet | compromis courant d'une barre collante ; à vérifier à la main |
| 13 | Blind | Textes en dur déplacés dans le bloc d'achat | low | rejet | `ArtworkDetail.tsx` est dans `exceptions-textes.cjs` ; ancien parcours d'achat refait en Epic 7 |
| 14 | Blind | Statuts de la spec et du suivi, apostrophes typographiques | false | rejet | l'étape de présentation passe le suivi à `review` ; apostrophes sans effet |
| 15 | Verification Gap | Mise en page vérifiée seulement par noms de classes | low | rejet | convention du dépôt (« mise en page réelle vérifiée à la main ») ; vérification sur la préversion |

