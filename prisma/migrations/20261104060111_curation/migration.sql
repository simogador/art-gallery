-- CreateEnum
CREATE TYPE "TypeDecisionCuration" AS ENUM ('valider', 'renvoyer');

-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "accordSigneLe" DATE;

-- CreateTable
CREATE TABLE "DecisionCuration" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "decision" "TypeDecisionCuration" NOT NULL,
    "commentaire" TEXT,
    "controle" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionCuration_pkey" PRIMARY KEY ("id"),
    -- Écrite à la main (Prisma ne décrit pas les CHECK) : un renvoi porte un commentaire de 10 à 1 000 caractères (COALESCE : un commentaire NULL est refusé).
    CONSTRAINT "DecisionCuration_renvoi_commente" CHECK ("decision" <> 'renvoyer' OR char_length(COALESCE("commentaire", '')) BETWEEN 10 AND 1000)
);

-- CreateIndex
CREATE INDEX "DecisionCuration_artworkId_createdAt_idx" ON "DecisionCuration"("artworkId", "createdAt");

-- AddForeignKey
ALTER TABLE "DecisionCuration" ADD CONSTRAINT "DecisionCuration_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
