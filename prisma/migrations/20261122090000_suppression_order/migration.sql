-- Story 7.9 (AD-20, temps 4) : suppression de l'ancienne table "Order".
-- Garde : la migration refuse de supprimer la table si elle contient des lignes. Recopier d'abord les
-- anciennes commandes, puis vider la table à la main (voir docs/migrations.md, section « Story 7.9 »).
DO $$
DECLARE
  nombre bigint;
BEGIN
  IF to_regclass('public."Order"') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM "Order"' INTO nombre;
    IF nombre > 0 THEN
      RAISE EXCEPTION 'La table "Order" contient % ligne(s) : recopier les anciennes commandes puis vider la table avant de la supprimer (docs/migrations.md, story 7.9).', nombre;
    END IF;
  END IF;
END
$$;

-- DropForeignKey
ALTER TABLE IF EXISTS "Order" DROP CONSTRAINT IF EXISTS "Order_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "Order";
