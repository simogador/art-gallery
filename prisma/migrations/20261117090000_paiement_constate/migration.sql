-- Story 6.4 (FR-13, AD-8) : constat de paiement par l'équipe, incidents.
-- Migration additive : table Incident, colonnes facultatives de Paiement (auteur et date du constat),
-- index unique partiel (un seul paiement ouvert par passage). À appliquer par le porteur avant la fusion.

-- CreateEnum
CREATE TYPE "CauseIncident" AS ENUM ('montant_different', 'devise_differente', 'oeuvre_indisponible');

-- AlterTable
ALTER TABLE "Paiement" ADD COLUMN     "constateLe" TIMESTAMPTZ(3),
ADD COLUMN     "constatePar" TEXT;

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "paiementId" TEXT,
    "commandeId" TEXT,
    "cause" "CauseIncident" NOT NULL,
    "attenduCentimes" INTEGER,
    "recuCentimes" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "traiteLe" TIMESTAMPTZ(3),

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Incident_passageId_idx" ON "Incident"("passageId");

-- CreateIndex
CREATE INDEX "Incident_traiteLe_idx" ON "Incident"("traiteLe");

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_ouvert_par_passage" ON "Paiement"("passageId") WHERE ("etat" = 'ouvert');

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "PassageEnCaisse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_paiementId_fkey" FOREIGN KEY ("paiementId") REFERENCES "Paiement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE SET NULL ON UPDATE CASCADE;

