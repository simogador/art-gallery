-- Story 6.5 (FR-13, NFR-4) : paiement tardif, abandon et remboursements.
-- Migration additive : valeur `commande_annulee` de CauseIncident, colonne facultative
-- Commande.abandonneLe, type EtatRemboursement et table RemboursementCommande (un remboursement
-- au plus par commande). À appliquer par le porteur avant la fusion.

-- AlterEnum
ALTER TYPE "CauseIncident" ADD VALUE 'commande_annulee';

-- CreateEnum
CREATE TYPE "EtatRemboursement" AS ENUM ('demande', 'effectue');

-- AlterTable
ALTER TABLE "Commande" ADD COLUMN     "abandonneLe" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "RemboursementCommande" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "paiementId" TEXT,
    "montantCentimes" INTEGER NOT NULL,
    "devise" VARCHAR(3) NOT NULL,
    "etat" "EtatRemboursement" NOT NULL DEFAULT 'demande',
    "effectuePar" TEXT,
    "effectueLe" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemboursementCommande_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RemboursementCommande_commandeId_key" ON "RemboursementCommande"("commandeId");

-- CreateIndex
CREATE INDEX "RemboursementCommande_etat_idx" ON "RemboursementCommande"("etat");

-- Un remboursement porte toujours un montant positif (CHECK écrit à la main, Prisma ne le décrit pas).
ALTER TABLE "RemboursementCommande" ADD CONSTRAINT "RemboursementCommande_montant_check" CHECK ("montantCentimes" > 0);

-- AddForeignKey
ALTER TABLE "RemboursementCommande" ADD CONSTRAINT "RemboursementCommande_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemboursementCommande" ADD CONSTRAINT "RemboursementCommande_paiementId_fkey" FOREIGN KEY ("paiementId") REFERENCES "Paiement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
