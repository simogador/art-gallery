---
title: 'Story 3.6 — Fiche œuvre : les quatre questions et les signes de sérieux'
type: 'feature'
created: '2026-11-07'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Sous la rangée Taille / Prix livré / Délai, la fiche garde trois onglets (Œuvre, Artiste, Provenance) dont le texte promet « Garantie galerie », « 14 jours pour retourner » et une assurance « 100 % », sans que rien de cela soit décidé (OQ-2, OQ-4). Le visiteur n'y trouve pas de réponse détaillée aux quatre questions (FR-5, UX-DR16).

**Approach:**
- Les trois onglets sont remplacés par quatre sections natives `details`/`summary`, dans l'ordre : « Ira-t-elle chez moi ? » (seule ouverte), « Combien au total ? », « Quand la recevrai-je ? », « Est-ce sérieux ? ».
- Les chiffres viennent des mêmes données que la rangée (`Artwork.prixLivre`, dimensions, `reglages`) ; aucun calcul dans un composant.
- « Est-ce sérieux ? » : histoire de l'œuvre, « Sélectionnée par Errancy », certificat si l'artiste s'y est engagé, résumé de la politique de retour sans durée ni gratuité, lien vers l'artiste.

## Boundaries & Constraints

**Always:**
- Décisions du porteur du 2026-11-07 : les trois onglets disparaissent (l'histoire passe dans « Est-ce sérieux ? ») ; « Sélectionnée par Errancy » s'affiche pour toute œuvre visible ; la mention du certificat seulement si `engagementCertificat` est vrai, sinon la ligne n'apparaît pas.
- État ouvert non mémorisé d'une fiche à l'autre (aucun `localStorage`, aucun état persistant).
- Chiffres identiques à la rangée (même source, mêmes formats de `i18n`).
- Textes dans `fr`, propriétés logiques, cibles 44 px, `summary` focalisable au clavier.
- Retour : aucune durée ni gratuité (OQ-2, OQ-4 ouvertes).
- Lien vers les pages de confiance : absent tant qu'elles ne sont pas publiées (Epic 7).

**Never:**
- « Garantie Errancy » ou « Garantie galerie », compte à rebours, prix barré, promesse d'assurance ou de délai de retour.
- Nom de prestataire de paiement, tutoiement, jargon technique.
- Toucher à la rangée, au carrousel, au panier, au formulaire de contact, à la fiche d'une œuvre vendue (3.7), aux métadonnées de référencement (3.8), à `MAINTENANCE_MODE`, `public/robots.txt`, `src/generated/prisma/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Arrivée | fiche d'une œuvre disponible | quatre sections dans l'ordre, seule la première ouverte | — |
| Œuvre déposée | `engagementCertificat` vrai | ligne « certificat d'authenticité signé par l'artiste » | — |
| Œuvre sans engagement | `engagementCertificat` faux | pas de ligne certificat | — |
| Pays livré | offre de la zone | total et délai identiques à la rangée, mention des droits et taxes | — |
| Pays non livré | `prixLivre` non livrée | « Pas de livraison vers [pays] » dans « Combien au total ? » et « Quand la recevrai-je ? » | — |
| Dimensions absentes | hauteur ou largeur nulle | « Ira-t-elle chez moi ? » : « — » sans orientation ni format | — |
| Autre fiche | on ouvre une autre fiche | seule la première section est ouverte, quel que soit l'état laissé avant | — |

</frozen-after-approval>

## Code Map

- `src/app/galerie/[id]/ArtworkDetail.tsx:17-30,46-48,230-275,372-480` -- `Tab`, `TABS`, `activeTab`, `TabOeuvre`, `TabArtiste`, `TabProvenance` et leur bloc à remplacer ; les icônes devenues inutiles sont à retirer ; panier, contact et rangée intacts.
- `src/app/galerie/[id]/RangeeFiche.tsx` -- source des textes de prix, délai et non-livraison à réutiliser, pas à recalculer.
- `src/lib/types/index.ts`, `src/lib/catalogue/mappers.ts` -- ajouter `Artwork.certificat` (lu de `engagementCertificat`, déjà en base : aucune migration) ; `description` = histoire courte.
- `src/lib/livraison/prix.ts` (`PrixLivre`), `src/lib/reglages/index.ts` (`orientationOeuvre`, `formatOeuvre`) -- données et règles pures.
- `src/lib/i18n/fr.ts` -- clé `fr.fiche.sections` ; `src/components/ui` : `DimensionsChoisies`, `PaysLivraison`.
- `tests/fiche.test.ts`, `tests/livraison.test.ts` -- cas de la matrice ; `tests/interface-accessible.test.ts` -- les nouveaux fichiers doivent passer.
- `DESIGN.md` `disclosure` -- `details`/`summary`, liseré fin, pas d'animation.

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/types/index.ts`, `src/lib/catalogue/mappers.ts` -- `Artwork.certificat`.
- [ ] `src/lib/i18n/fr.ts` -- titres, phrases des quatre sections, résumé du retour.
- [ ] `src/app/galerie/[id]/SectionsFiche.tsx` -- quatre `details`, première ouverte, contenu selon la matrice.
- [ ] `src/app/galerie/[id]/ArtworkDetail.tsx` -- retirer onglets et textes interdits, brancher `SectionsFiche`, lien vers l'artiste.
- [ ] `tests/fiche.test.ts` -- matrice, ordre, première ouverte seulement, absence des mots interdits.
- [ ] `AGENTS.md` -- règles des sections.

**Acceptance Criteria:**
- Given la fiche d'une œuvre disponible, when elle s'ouvre, then les quatre sections apparaissent dans l'ordre, seule la première ouverte.
- Given « Est-ce sérieux ? » ouverte, when le visiteur la lit, then il voit l'histoire, « Sélectionnée par Errancy », le certificat si l'artiste s'y est engagé, le résumé du retour sans durée ni gratuité et le lien vers l'artiste.
- Given le code de la fiche, when on le scanne, then aucun « Garantie », compte à rebours ni prix barré n'y figure.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

Texte du résumé de retour proposé (à relire par le porteur) : « Les conditions de retour vous sont communiquées avant toute commande. » Aucune durée, aucune gratuité, aucune promesse.

## Verification

**Commands:**
- `npx eslint .` et les trois `node scripts/verifier-exceptions-prisma.cjs origin/main …` -- aucune erreur, aucun ajout
- `npm test` et `npm run build` -- réussis

**Manual checks:**
- Préversion : fiche d'une œuvre de Kara Walker sur mobile (375 px) : sections, clavier, changement de pays, absence de la ligne certificat.
