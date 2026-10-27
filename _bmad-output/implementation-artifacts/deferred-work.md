- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-correctifs-de-securite-et-node-24.md`
  summary: Décider si `engines.node` reste `>=22.12` ou devient borné (`24.x` ou `22.x || 24.x`).
  evidence: Vercel utilise `engines.node` en priorité sur le réglage Node du projet ; une plage ouverte `>=` peut suivre la plus récente version majeure proposée par Vercel. Par ailleurs `eslint-visitor-keys@5` (lint) exige `^22.13` : avertissement `EBADENGINE` sous 22.12.x. Valeur actuelle fixée par la décision du porteur du 2026-10-27, donc question à lui poser.
  resolution: Résolu le 2026-10-27 par le porteur : `engines.node` `24.x`, appliqué dans la story 1.1 (PR #7).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-migrations-alignees-sur-la-base-reelle.md`
  summary: Supprimer l'index redondant `Order_stripeSessionId_idx` (doublon de l'index unique `Order_stripeSessionId_key`) par une migration ultérieure.
  evidence: La ligne de base doit refléter la production telle quelle ; `@@index([stripeSessionId])` dans `schema.prisma` duplique `@unique`. À traiter avec l'éclatement d'`Order` (AR-10).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-interrupteur-lot-2.md`
  summary: Quand le Lot 2 est fermé, masquer « Ajouter au panier » / « Voir le panier » sur la fiche œuvre et offrir dans le panier un moyen de joindre l'équipe.
  evidence: Après la story 1.7, un visiteur peut encore remplir un panier sans pouvoir payer (`src/app/galerie/[id]/ArtworkDetail.tsx`) ; le message du panier n'a ni lien ni contact. Relève de la barre d'actions du Lot 1 (story 4.7) et du conseil (stories 4.2 à 4.4).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-9-contacts-maintenance.md`
  summary: Décider avec le porteur la durée de conservation et la purge des inscrits, le moyen de se désinscrire, les mentions de confidentialité du formulaire et une éventuelle double confirmation par e-mail (double opt-in).
  evidence: La story 1.9 enregistre l'e-mail et la date du consentement, sans désinscription ni purge ni lien de confidentialité (NFR-6, AQ-6). Une adresse peut être inscrite par un tiers sans double confirmation ; l'e-mail d'ouverture est prévu en story 4.9 (module notifications), qui pourra porter le lien de désinscription.
