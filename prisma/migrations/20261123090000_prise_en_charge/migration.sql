-- Story 8.1 (FR-22, AD-16) : l'artiste prend en charge ses commandes. Migration additive : valeur
-- `prise_en_charge` de EtatCommande (avant `annulee`), trois colonnes facultatives de Commande, puis
-- rattrapage de l'échéance des commandes déjà confirmées (constat du paiement du passage + 48 h,
-- `DUREE_PRISE_EN_CHARGE_HEURES`). À appliquer par le porteur avant la fusion (docs/migrations.md).

-- AlterEnum
ALTER TYPE "EtatCommande" ADD VALUE 'prise_en_charge' BEFORE 'annulee';

-- AlterTable
ALTER TABLE "Commande" ADD COLUMN     "priseEnChargeAvant" TIMESTAMPTZ(3),
ADD COLUMN     "priseEnChargeLe" TIMESTAMPTZ(3),
ADD COLUMN     "priseEnChargePar" TEXT;

-- Rattrapage : une commande confirmée reçoit l'échéance tirée du dernier paiement constaté de son passage.
UPDATE "Commande" c
SET "priseEnChargeAvant" = p."constateLe" + INTERVAL '48 hours'
FROM (
  SELECT "passageId", MAX("constateLe") AS "constateLe"
  FROM "Paiement"
  WHERE "etat" = 'constate' AND "constateLe" IS NOT NULL
  GROUP BY "passageId"
) p
WHERE c."passageId" = p."passageId" AND c."etat" = 'confirmee' AND c."priseEnChargeAvant" IS NULL;
