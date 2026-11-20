-- Story 8.5 (FR-30, FR-15, AD-9) : réclamation et retour. Migration additive : valeur `retournee` de
-- EtatCommande (avant `annulee`), deux colonnes de Commande, deux enums et deux tables. À appliquer par le
-- porteur avant la fusion (docs/migrations.md).

-- AlterEnum
ALTER TYPE "EtatCommande" ADD VALUE 'retournee' BEFORE 'annulee';

-- CreateEnum
CREATE TYPE "MotifReclamation" AS ENUM ('abimee', 'non_conforme', 'changement_avis');

-- CreateEnum
CREATE TYPE "EtatReclamation" AS ENUM ('ouverte', 'acceptee', 'refusee');

-- AlterTable
ALTER TABLE "Commande" ADD COLUMN     "retourRecuLe" TIMESTAMPTZ(3),
ADD COLUMN     "retourRecuPar" TEXT;

-- CreateTable
CREATE TABLE "Reclamation" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "motif" "MotifReclamation" NOT NULL,
    "description" TEXT NOT NULL,
    "etat" "EtatReclamation" NOT NULL DEFAULT 'ouverte',
    "motifRefus" TEXT,
    "decidePar" TEXT,
    "decideLe" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reclamation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoReclamation" (
    "id" TEXT NOT NULL,
    "reclamationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoReclamation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reclamation_commandeId_key" ON "Reclamation"("commandeId");

-- CreateIndex
CREATE INDEX "Reclamation_etat_idx" ON "Reclamation"("etat");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoReclamation_publicId_key" ON "PhotoReclamation"("publicId");

-- CreateIndex
CREATE INDEX "PhotoReclamation_reclamationId_idx" ON "PhotoReclamation"("reclamationId");

-- AddForeignKey
ALTER TABLE "Reclamation" ADD CONSTRAINT "Reclamation_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoReclamation" ADD CONSTRAINT "PhotoReclamation_reclamationId_fkey" FOREIGN KEY ("reclamationId") REFERENCES "Reclamation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
