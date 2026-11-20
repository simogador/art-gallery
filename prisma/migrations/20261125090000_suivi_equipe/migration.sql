-- Story 8.3 (FR-26, AD-10) : commandes et alertes de l'équipe. Migration additive : délai de préparation figé sur
-- les lignes, échéance d'expédition et trace d'annulation sur les commandes. À appliquer par le porteur avant la
-- fusion (docs/migrations.md).

-- AlterTable
ALTER TABLE "LigneCommande" ADD COLUMN     "preparationJours" INTEGER;

-- AlterTable
ALTER TABLE "Commande" ADD COLUMN     "expedieAvant" TIMESTAMPTZ(3),
ADD COLUMN     "annuleeLe" TIMESTAMPTZ(3),
ADD COLUMN     "annuleePar" TEXT,
ADD COLUMN     "motifAnnulation" TEXT;
