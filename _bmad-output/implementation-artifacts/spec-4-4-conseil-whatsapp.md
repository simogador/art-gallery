---
title: 'Story 4.4 — Conseil WhatsApp contextualisé, avec repli'
type: 'feature'
created: '2026-11-10'
status: 'done'
baseline_commit: 'a744c77728ebcdd30d0a93545c85dd2c2ef6a14b'
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
- Décisions du porteur du 2026-11-10 (OQ-7) : réponse du lundi au vendredi, de 9 h à 18 h, heure de Londres (`Europe/London`, UTC+1 l'été, jamais « GMT » affiché seul) ; délai annoncé « moins de 2 heures pendant les horaires » ; horaires et délai vivent dans `src/lib/reglages` (un changement = une PR). Numéro WhatsApp Business : variable Vercel `WHATSAPP_NUMERO`, lue seulement par `src/lib/reglages` (comme `LOT2_OUVERT`), saisie par le porteur lui-même, jamais écrite dans la conversation, une PR, un test ni un journal.
- Calcul pur dans un module sans Prisma (`src/lib/conseil/`) : message prérempli, lien `wa.me`, état « dans les horaires / hors horaires » à partir d'un instant et d'un fuseau (par `heureMurale` de `i18n`, aucun `Intl` ailleurs ; fuseau `Europe/London` géré, heure d'été comprise). Sous-ligne : « Réponse en moins de 2 heures · lundi au vendredi, 9 h–18 h [fuseau] » ; hors horaires, « Réponse demain à partir de 9 h » (« lundi » le vendredi soir et le week-end). Textes dans `fr`, composant serveur, calculé à chaque requête.
- Message prérempli : fiche = référence (slug) et lien absolu de l'œuvre (`urlAbsolue`) ; page artiste = nom de l'artiste ; ailleurs = message général. Bouton nommé par son action (« Conseil WhatsApp sur [titre] »), ni vert ni logo en couleur, une seule action principale par écran.
- Repli (numéro absent) : le bouton garde sa place et mène à `/conseil`, avec le délai réellement tenu (`DELAI_REPONSE_DEMANDE_HEURES`, 48 heures), jamais celui de WhatsApp.
- Le pied des e-mails (`fr.courriels.pied`) ajoute le lien Conseil WhatsApp quand le numéro est réglé, sinon reste inchangé (promesse de la story 4.1).
- Aucune donnée personnelle dans les journaux ; aucun événement de mesure (story 4.8).

**Never:**
- Barre d'actions de la fiche (story 4.7), panier et suivi (Epic 6), mesure du clic (4.8), jours fériés, WhatsApp Business API ou envoi de messages par le site.
- QR code et nouvelle bibliothèque : sur ordinateur, le lien `wa.me` ouvre WhatsApp Web ou propose lui-même le téléphone (décision du porteur) ; écrire le numéro dans le code, les tests, la spec ou les journaux ; toucher à `public/robots.txt`, `MAINTENANCE_MODE`, `src/generated/prisma/`.

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

## Code Map

- `src/lib/reglages/index.ts` -- ajouter horaires, délai, fuseau et lecture du numéro (lecture de `WHATSAPP_NUMERO`, jamais de valeur par défaut) ; ne rien inventer.
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

## Review Triage Log

| # | Source | Constat | Verdict | Route | Preuve / suite |
|---|--------|---------|---------|-------|----------------|
| 1 | Verification Gap, Edge, Blind | Le lien WhatsApp « conseil pour choisir une œuvre » est ajouté aussi aux alertes internes à l'équipe (`assembler` commun) | medium | patch | vérifié dans `contenus.ts` ; les alertes de demande et de visite n'ont pas de lien ; test sur tous les gabarits |
| 2 | Verification Gap, Blind | Le placement du bouton (fiche, page artiste, accueil, galerie, pied) n'est vérifié par aucun test ; l'accueil ne vérifie qu'un `section` vide | medium | patch | tests de rendu des pages et du pied (contexte œuvre, nom de l'artiste, bouton dans la section) |
| 3 | Edge | Pied d'e-mail testé sur un seul gabarit | low | patch | fusionné avec le constat 1 (tous les gabarits, numéro réglé et absent) |
| 4 | Blind, Edge | Clé `fr.conseilWhatsApp.delai` jamais utilisée | low | patch | suppression directe |
| 5 | Edge, Blind | « Réponse demain à partir de 9 h » sans fuseau (le visiteur de la diaspora lit son heure locale) | medium | defer | le texte exact figure dans la partie gelée de la spec ; ajouter « heure de Londres » à décider avec le porteur ; deferred-work.md |
| 6 | Blind | Le bouton envoie le visiteur, avec le titre et le lien de l'œuvre, à WhatsApp (Meta) : aucune mention de tiers | medium | defer | pages de confiance et confidentialité de l'Epic 7 ; deferred-work.md |
| 7 | Edge, Blind | Deux boutons sur la même page (page et pied) ; « une seule action principale » | low | rejet | la spec place le bouton sur ces pages **et** dans le pied ; le bouton du pied est secondaire, sans l'œuvre dans son nom |
| 8 | Blind | Pas de focus visible sur le pied noir | false | rejet | le pied porte déjà la classe `fond-sombre` (focus clair) |
| 9 | Edge, Blind | Bouton affiché sur une œuvre vendue | false | rejet | `epic-4-context.md` : vendue = Conseil WhatsApp + lien artiste |
| 10 | Edge | « Moins de 2 heures » annoncé jusqu'à 18 h | low | rejet | le porteur a dit « moins de 2 heures pendant les horaires » |
| 11 | Edge, Blind | Numéro sans indicatif accepté s'il a 8 à 15 chiffres ; repli silencieux sur un numéro invalide | low | rejet | le porteur essaie le lien sur la préversion avant la production (contrôle manuel de la spec) ; un journal ou une alerte serait un ajout |
| 12 | Edge | Jours fériés | low | rejet | hors périmètre déclaré (« Never ») |
| 13 | Edge | Composant serveur dans une frontière client ou page statique | false | rejet | le composant n'est importé que par des fichiers serveur et passé en propriété ; le layout lit déjà des cookies |
| 14 | Edge | Titre très long dans le message | low | rejet | les titres de dépôt sont bornés ; WhatsApp tronque lui-même |
| 15 | Blind | Texte des horaires non lié à `CONSEIL_HORAIRES` | low | rejet | un changement d'horaires est une PR qui touche les deux ; la comparaison coûte plus que le risque |
| 16 | Blind | Minuit, changement d'heure, fuseau illisible non testés | low | rejet | `heureMurale` impose `h23` ; l'heure d'été est testée ; branche de repli prudente |
| 17 | Blind | Statut de la spec et du suivi différents | false | rejet | l'étape de présentation passe le suivi à `review` |
| 18 | Edge, Blind | Bouton de repli du pied sur `/conseil` pointe sur la page courante ; section nommée sans titre visible ; section vide sur `/galerie` | low | rejet | sans effet gênant ; correction = branches en plus |

