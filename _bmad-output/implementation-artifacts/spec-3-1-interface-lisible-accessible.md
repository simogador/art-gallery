---
title: 'Story 3.1 — Une interface lisible et accessible partout'
type: 'feature'
created: '2026-11-05'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '49179ce0e89b359b331fc89913d4f740d34f41c5'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-art-gallery-2026-10-26/DESIGN.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'interface emploie l'or et `neutral-400` comme couleur de texte (contrastes 2,19:1 et 2,29:1, sous le seuil AA), un focus doré, aucun lien d'évitement, des champs en 14 px, des cibles tactiles sous 44 px, des directions physiques (`left`/`right`) et des animations (parallaxe, glissements, rebond infini) jamais coupées sous `prefers-reduced-motion` (UX-DR1 à UX-DR6, NFR-3).

**Approach:**
- `tailwind.config.ts` : palette et polices conservées ; jetons de `DESIGN.md` ajoutés (`heading-sm`, `body-strong`, `price-lg`, `label-caps`, `caption`, `button`, `input`, `spacing.touch-target` 2,75rem, `spacing.gutter-mobile` 1rem) ; animations réduites à `fade-in` 400 ms et `scale-in` 450 ms (plus `slide-up` de la feuille de confirmation, story 2.8).
- Socle global (`src/app/layout.tsx`, `src/styles/globals.css`) : lien d'évitement « Aller au contenu » vers `#contenu` posé sur l'élément principal de chaque page ; focus visible 2 px noir, décalage 2 px, jamais or ; `MotionConfig reducedMotion="user"` pour framer-motion et règle CSS `prefers-reduced-motion` (animations, `scroll-behavior`) ; `lang="fr"` vérifié.
- Primitives (`components/ui`, `components/layout`) : champs en 16 px, boutons et icônes à 44 × 44 px minimum, propriétés logiques seulement, plus de focus doré ; parallaxe et rebond infini de l'accueil retirés.
- Test `tests/interface-accessible.test.ts` (scan de `src/`, sans base) : interdit `text-gold*`, `.gold-text`, `text-neutral-400`/`-300`/`-200` sur fond clair et les classes physiques (`left-`, `right-`, `ml-`, `mr-`, `pl-`, `pr-`, `text-left`, `text-right`, `border-l`, `border-r`) ; vérifie lien d'évitement, focus et `lang`.

**Décision du porteur (2026-11-05) : socle maintenant, pages au fil de leur refonte.**
- Corrigés dans cette story : socle global, `components/ui`, `components/layout`, panier, liste de souhaits, confirmation, connexion, inscription, invitation, pages des expositions (`app/expositions/**`, refaites par aucune story de l'epic 3), espaces artiste et administration.
- Exceptions du test, dans une liste qui ne fait que diminuer (fichier dédié, contrôlé comme `eslint/exceptions-prisma.cjs`) : `src/components/sections/**` et `src/app/page.tsx` (accueil, story 3.10), `src/app/galerie/**` (fiche et galerie, stories 3.5 à 3.9), `src/app/artistes/**` (story 3.11). Chaque story qui refait une de ces pages la retire de la liste. Le lien d'évitement, le focus, `MotionConfig` et la règle CSS de mouvement réduit valent aussi pour ces pages (socle global) ; la parallaxe et le rebond de l'accueil sont retirés malgré l'exception.

## Boundaries & Constraints

**Always:** couleurs de remplacement de `DESIGN.md` (texte secondaire `neutral-600`, plus clair permis `neutral-500` jamais sur `neutral-200` ; sur fond noir, blanc ou `neutral-200`) ; l'or reste permis en décor (filets, fonds, bordures) ; textes en français.

**Never:** changer la palette, les polices ou la mise en page des pages au-delà de l'accessibilité ; ajouter un mode sombre ; toucher `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`, les secrets ou les réglages Vercel/Neon.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clavier | première tabulation sur une page publique | lien « Aller au contenu » visible, mène à `#contenu` | — |
| Focus | tout élément focalisable | contour noir 2 px, décalage 2 px | — |
| Mouvement réduit | `prefers-reduced-motion: reduce` | aucune animation ni défilement doux | — |
| Régression | une classe interdite ajoutée dans `src/` | le test échoue en nommant le fichier | — |

</frozen-after-approval>

## Code Map

- `tailwind.config.ts` -- `fontSize` (seuls les `display-*`, sans `fontWeight` : ajouter 600 d'après `DESIGN.md`), `keyframes`/`animation` (`fade-in` avec translateY 8 px → opacité seule ; retirer `slide-in`, `fade-out` si inutilisé), `spacing`.
- `src/styles/globals.css:6-34,45,74,77-81,93` -- variables dupliquées, `scroll-smooth`, focus doré `:focus-visible` (→ noir), `.gold-text`.
- `src/app/layout.tsx:58` -- `lang="fr"` déjà posé ; aucun lien d'évitement ; `<main>` présent seulement sur 4 pages : poser `id="contenu"` (ou un `<main id="contenu">` commun dans le layout, en retirant les `<main>` imbriqués).
- `src/components/ui/{Input,Button,Modal,Card}.tsx` -- `Input` `text-sm` sans hauteur minimale, icônes `left-3`/`right-3`, hint `neutral-400` ; `Button` `sm` ≈ 32 px, `icon` ; `Modal` `focus-visible:outline-gold`.
- `src/components/layout/{Header,Footer}.tsx` -- `fixed left-0 right-0`, tiroir `right-0 border-l`, `focus-visible:outline-gold` (:135, :282), `hover:translate-x` (Footer:183).
- `src/components/sections/Hero.tsx:67-72,262` -- parallaxe `useScroll`/`useTransform`, rebond `repeat: Infinity`.
- `src/app/dashboard/{admin,artiste}/layout.tsx` -- `pr-8 border-r`, `md:pl-10`.
- Formulaires en 14 px : `auth/connexion/LoginForm.tsx:210`, `RegisterForm`, `AccordArtiste`, `InvitationArtiste`, `DecisionCuration`, `ZoneForm` ; déjà conformes : `FormulaireDepot.tsx:668`, `SectionExpedition.tsx:96` (`min-h-[44px] text-base`).
- Modèle de scan : `tests/anciennes-colonnes.test.ts:19-23` (helper `fichiers()`), sans `base-jetable`.

## Tasks & Acceptance

**Execution:**
- [ ] `tailwind.config.ts`, `src/styles/globals.css` -- jetons, focus, mouvement réduit, animations.
- [ ] `src/app/layout.tsx` et pages -- lien d'évitement, `#contenu`, `MotionConfig`.
- [ ] `src/components/ui/*`, `src/components/layout/*`, Hero -- champs, cibles, directions logiques, mouvements.
- [ ] Pages corrigées et liste d'exceptions selon la décision du porteur.
- [ ] `tests/interface-accessible.test.ts` -- matrice et scan.
- [ ] `AGENTS.md` -- règles d'interface (couleurs de texte, focus, directions, mouvement).

**Acceptance Criteria:**
- Given `tailwind.config.ts`, when la story est livrée, then palette et polices sont inchangées et les neuf jetons existent avec les valeurs de `DESIGN.md`.
- Given l'accueil, la galerie et une fiche, when on agrandit à 200 % (fenêtre de 640 px), then aucun défilement horizontal.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npx eslint .` -- aucune erreur
- `node scripts/verifier-exceptions-prisma.cjs origin/main` -- aucun ajout
- `npm test` -- tous verts
- `npm run build` -- réussi

**Manual checks:**
- Préversion : tabulation au clavier sur l'accueil, la galerie, une fiche et le panier ; zoom 200 % sans défilement horizontal ; réglage système « réduire les animations ».
