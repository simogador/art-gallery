---
title: 'Story 4.4 — Conseil WhatsApp contextualisé, avec repli'
type: 'feature'
created: '2026-11-10'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-4-3-demande-de-visite.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le visiteur qui hésite ne peut pas écrire à une personne d'Errancy depuis le site : aucun bouton Conseil WhatsApp, aucun délai de réponse annoncé (FR-7, UX-DR14, OQ-7).

**Approach:**
- Un bouton « Conseil WhatsApp » unique et réutilisable, avec sa sous-ligne de délai, sur la fiche, la page artiste, l'accueil, la galerie et le pied de page ; il ouvre WhatsApp avec un message prérempli (référence et lien de l'œuvre, ou nom de l'artiste).
- Réglages absents : même emplacement, mais le bouton ouvre la demande de conseil `/conseil` (story 4.2).

## Boundaries & Constraints

**Always:**
- Valeurs du porteur du 2026-11-10 (OQ-7) : réponse du lundi au vendredi, de 9 h à 18 h ; délai annoncé « moins de 2 heures pendant les horaires » ; numéro WhatsApp Business saisi par le porteur lui-même, jamais écrit dans la conversation, ni dans une PR, ni dans un journal. Horaires et délai vivent dans `src/lib/reglages` ; un changement = une PR.
- Calcul pur dans un module sans Prisma (`src/lib/conseil/`) : message prérempli, lien `wa.me`, état « dans les horaires / hors horaires » à partir d'un instant et d'un fuseau (par `heureMurale` de `i18n`, aucun `Intl` ailleurs). Sous-ligne : « Réponse en moins de 2 heures · lundi au vendredi, 9 h–18 h [fuseau] » ; hors horaires, « Réponse demain à partir de 9 h » (« lundi » le vendredi soir et le week-end). Textes dans `fr`, composant serveur, calculé à chaque requête.
- Message prérempli : fiche = référence (slug) et lien absolu de l'œuvre (`urlAbsolue`) ; page artiste = nom de l'artiste ; ailleurs = message général. Bouton nommé par son action (« Conseil WhatsApp sur [titre] »), ni vert ni logo en couleur, une seule action principale par écran.
- Repli (numéro absent) : le bouton garde sa place et mène à `/conseil`, avec le délai réellement tenu (`DELAI_REPONSE_DEMANDE_HEURES`, 48 heures), jamais celui de WhatsApp.
- Le pied des e-mails (`fr.courriels.pied`) ajoute le lien Conseil WhatsApp quand le numéro est réglé, sinon reste inchangé (promesse de la story 4.1).
- Aucune donnée personnelle dans les journaux ; aucun événement de mesure (story 4.8).

**Never:**
- Barre d'actions de la fiche (story 4.7), panier et suivi (Epic 6), mesure du clic (4.8), jours fériés, WhatsApp Business API ou envoi de messages par le site.
- Écrire le numéro dans le code, les tests, la spec ou les journaux ; toucher à `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Gestion d'erreur |
|----------|--------------|---------------------|------------------|
| Dans les horaires | numéro réglé, mardi 10 h | lien `wa.me` avec message ; « Réponse en moins de 2 heures · … » | — |
| Hors horaires | mardi 20 h / vendredi 19 h / samedi | « Réponse demain à partir de 9 h » / « … lundi à partir de 9 h » | — |
| Fiche, page artiste, autre page | message selon la page | slug et lien de l'œuvre / nom de l'artiste / message général | titre ou nom absent : message général |
| Numéro absent ou invalide | réglage vide, non numérique | bouton vers `/conseil`, délai de 48 heures | jamais d'erreur affichée |
| Pied d'e-mail | numéro réglé / absent | lien WhatsApp ajouté / pied inchangé | — |
| Caractères spéciaux | titre avec « & », accents, espaces | texte encodé, lien valide | — |

</frozen-after-approval>

## Open Questions

1. **Où saisir le numéro WhatsApp ?** — options : A) variable Vercel `WHATSAPP_NUMERO`, lue seulement par `src/lib/reglages` (le porteur la change sans PR, comme `LOT2_OUVERT`, recommandé) / B) constante dans `reglages` (le numéro entre dans le dépôt, un changement = une PR) / C) écran d'administration et table en base (changement en ligne, mais nouvelle table et migration).
2. **Que veut dire « GMT » pour les horaires ?** — options : A) GMT strict, UTC+0 toute l'année, y compris l'été (fuseau `Etc/GMT`) / B) heure de Londres, UTC+1 l'été (`Europe/London`) / C) un autre fuseau à préciser. Affiché au visiteur après les horaires.
3. **Faut-il un QR code sur ordinateur ?** — options : A) non : le lien `wa.me` ouvre WhatsApp Web ou propose lui-même le téléphone (aucune dépendance, recommandé) / B) oui : lien secondaire « Afficher le QR code » sur ordinateur, avec une nouvelle bibliothèque de QR code (le site ne peut pas savoir si l'ouverture a échoué).

## Code Map

- `src/lib/reglages/index.ts` -- ajouter horaires, délai, fuseau et lecture du numéro (selon la réponse 1) ; ne rien inventer.
- `src/lib/conseil/` (à créer, pur) -- `messageConseil`, `lienWhatsApp`, `etatConseil(maintenant)`, validation du numéro ; réutilise `heureMurale` et `urlAbsolue`.
- `src/components/ui/BoutonConseil.tsx` (serveur) -- bouton, sous-ligne, repli ; `fr.conseil` ou `fr.whatsapp` pour les textes.
- `src/app/galerie/[id]/ArtworkDetail.tsx`, `src/app/artistes/[id]/ArtistProfile.tsx`, `src/app/page.tsx`, `src/app/galerie/page.tsx`, `src/components/layout/Footer.tsx` -- emplacements ; le pied est un composant client : état reçu en props du layout.
- `src/lib/notifications/contenus.ts`, `src/lib/i18n/fr.ts` (`courriels.pied`) -- lien WhatsApp dans le pied.
- `tests/conseil.test.ts` (pur), `tests/navigateur/` si une interaction est ajoutée ; `AGENTS.md`, `docs/decisions-porteur.md`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/reglages/`, `src/lib/conseil/`, `fr` -- réglages, calculs purs et textes
- [ ] `src/components/ui/BoutonConseil.tsx` et cinq emplacements -- bouton avec repli
- [ ] `src/lib/notifications/` -- lien WhatsApp dans le pied des e-mails
- [ ] tests, `AGENTS.md`, `docs/decisions-porteur.md`

**Acceptance Criteria:**
- Given un numéro réglé et un instant dans les horaires, when le visiteur touche « Conseil WhatsApp sur [titre] » sur une fiche, then WhatsApp s'ouvre avec la référence et le lien de l'œuvre dans le message, et la sous-ligne annonce moins de 2 heures et les horaires.
- Given un instant hors horaires, when le bouton s'affiche, then il annonce la prochaine ouverture (« demain » ou « lundi » à 9 h).
- Given un numéro absent, when le bouton s'affiche, then il ouvre `/conseil` et annonce 48 heures.
- Given n'importe quel état, when on lit la page, le HTML ou les journaux, then le numéro n'apparaît que dans le lien du bouton.

## Verification

**Commands:**
- `npx eslint .`, les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …`, `npm test`, `npm run test:navigateur`, `npm run build` -- réussis

**Manual checks:**
- Préversion : sans numéro, le bouton mène à `/conseil` ; avec le numéro en variable Preview, le lien `wa.me` s'ouvre avec le bon message (essai par le porteur).
