-- Story 8.4 (FR-29, FR-22, AD-9, AD-10) : livraison constatée. Migration additive : valeur `livree` de
-- EtatCommande (avant `annulee`) et cinq colonnes de Commande. À appliquer par le porteur avant la fusion
-- (docs/migrations.md).

-- AlterEnum
ALTER TYPE "EtatCommande" ADD VALUE 'livree' BEFORE 'annulee';

-- AlterTable
ALTER TABLE "Commande" ADD COLUMN     "livreeLe" TIMESTAMPTZ(3),
ADD COLUMN     "livraisonSource" TEXT,
ADD COLUMN     "livraisonPar" TEXT,
ADD COLUMN     "preuveLivraison" TEXT,
ADD COLUMN     "retourAvant" TIMESTAMPTZ(3);
