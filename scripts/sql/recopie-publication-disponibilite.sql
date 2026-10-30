-- Story 2.2 (AD-20, temps 2) : recopie de "available" vers les deux axes de "Artwork".
-- À lancer par le porteur depuis l'éditeur SQL de Neon, après la migration
-- 20261030090000_publication_disponibilite : d'abord sur la branche `preview`, puis sur la
-- production, après une branche de sauvegarde datée (docs/migrations.md).
--
-- available = true  → publication 'publiee', disponibilite 'disponible'
-- available = false → publication 'publiee', disponibilite 'vendue'
--
-- Idempotent : ne remplit que des colonnes encore vides, n'écrase jamais une valeur présente ;
-- le relancer donne le même résultat. Ne modifie pas "available".

BEGIN;

UPDATE "Artwork"
SET "publication" = 'publiee'
WHERE "publication" IS NULL;

UPDATE "Artwork"
SET "disponibilite" = CASE WHEN "available" THEN 'disponible' ELSE 'vendue' END::"Disponibilite"
WHERE "disponibilite" IS NULL;

COMMIT;
