-- AlterTable
ALTER TABLE "DemandeSelection" ADD COLUMN     "etatChangeLe" TIMESTAMPTZ(3),
ADD COLUMN     "etatChangePar" TEXT;

-- AlterTable
ALTER TABLE "DemandeVisite" ADD COLUMN     "etatChangeLe" TIMESTAMPTZ(3),
ADD COLUMN     "etatChangePar" TEXT;
