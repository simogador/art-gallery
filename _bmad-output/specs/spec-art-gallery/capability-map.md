# Correspondance des capacités — Errancy

Chaque CAP de `SPEC.md` est reliée à ses exigences (`prd.md`), aux règles d'architecture qui la gouvernent (`ARCHITECTURE-SPINE.md`), à son lot et à ses surfaces (`EXPERIENCE.md`, Architecture de l'information). Les identifiants FR, NFR, AD et OQ sont ceux des documents d'origine.

| CAP | FR / NFR | AD | Lot | Surfaces |
|---|---|---|---|---|
| CAP-1 | FR-1 à FR-6, NFR-1, NFR-2, NFR-3 | AD-5, AD-6, AD-12, AD-17, AD-18, AD-21 | 1 (« Acheter » en 2) | `/galerie/[id]` |
| CAP-2 | FR-7, FR-8 | AD-11, AD-16, AD-19 | 1 | fiche, `/galerie/[id]/visite`, `/conseil`, `/artistes/[id]`, pied de page |
| CAP-3 | FR-9 | AD-7 (origine `priorite`), AD-11, AD-14 | 1 (inscription), effet avec CAP-11 | fiche (état Réservée) |
| CAP-4 | FR-16 à FR-19, NFR-2 | AD-6, AD-12, AD-18, AD-21 | 1 | `/`, `/galerie`, `/artistes`, `/artistes/[id]` |
| CAP-5 | FR-34, NFR-5 | AD-14, AD-15 | 1 | `/auth/invitation/[jeton]`, `/auth/connexion`, `/dashboard/admin/artistes` |
| CAP-6 | FR-20, FR-25 | AD-2, AD-6, AD-12 | 1 | `/dashboard/artiste/oeuvres/nouvelle`, `/dashboard/artiste/oeuvres/[slug]`, `/dashboard/admin/oeuvres` |
| CAP-7 | FR-21 | AD-7, AD-11, AD-21 | 1 (annulation de réservation avec CAP-11) | `/dashboard/artiste/oeuvres` |
| CAP-8 | FR-27, FR-28, NFR-6 | AD-19 | FR-27 en 1, FR-28 en 2 | toutes les surfaces publiques ; `/dashboard/admin/commandes` |
| CAP-9 | FR-35 | AD-11 | 1 | page de maintenance (`src/middleware.ts`) |
| CAP-10 | FR-10, FR-11 | AD-4, AD-12, AD-13 | 2 | `/panier`, `/commande/coordonnees` |
| CAP-11 | FR-12, NFR-4 | AD-7, AD-10 | 2 (ou 1 si OQ-12) | `/panier`, `/dashboard/admin/commandes` |
| CAP-12 | FR-13, NFR-4 | AD-4, AD-8 | 2 (ou 1 si OQ-12) | `/confirmation`, notification du prestataire |
| CAP-13 | FR-14 | AD-4 | 2 — bloqué par OQ-1 | `/commande/paiement` (zone neutre) |
| CAP-14 | FR-15, NFR-6 | AD-10, AD-14, AD-16 | 2 | `/suivi/[jeton]` |
| CAP-15 | FR-22 | AD-9, AD-16 | 2 | `/dashboard/artiste/commandes` (+ `/[numero]`) |
| CAP-16 | FR-29, FR-30, FR-31, FR-33 | AD-4, AD-8, AD-9, AD-10, AD-24 | 2 ; moyen de rembourser bloqué par OQ-1 | `/suivi/[jeton]`, `/dashboard/admin/commandes` |
| CAP-17 | FR-32 | AD-4, AD-24 | 2 ; calcul selon OQ-3, versement selon OQ-1 | `/dashboard/artiste/paiements`, `/dashboard/admin/commandes` |
| CAP-18 | FR-26 | AD-7, AD-9, AD-10, AD-15 | 2 (ou 1 si OQ-12) | `/dashboard/admin/commandes`, `/dashboard/admin/demandes` |
| CAP-19 | FR-23, FR-24 | AD-18 | 2 ; contenu selon OQ-1, OQ-2, OQ-4, OQ-5 | `/livraison`, `/retours`, `/authenticite`, `/cgv`, `/mentions-legales`, `/confidentialite`, `/cookies` |
| CAP-20 | NFR-4, NFR-5, NFR-7 | AD-1, AD-20, AD-22, AD-23 | avant tout epic fonctionnel | — (outillage, CI, migrations) |

NFR-8 (langue et devise) et AD-18 s'appliquent à toutes les CAP. AD-2, AD-3, AD-11 et AD-15 s'appliquent à toute CAP qui écrit des données.
