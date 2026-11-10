-- CreateEnum
CREATE TYPE "EtatDemande" AS ENUM ('nouvelle', 'planifiee', 'faite', 'sans_suite');

-- CreateTable
CREATE TABLE "DemandeSelection" (
    "id" TEXT NOT NULL,
    "espace" TEXT NOT NULL,
    "ambiances" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "precision" TEXT,
    "budgetCentimes" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT,
    "etat" "EtatDemande" NOT NULL DEFAULT 'nouvelle',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "DemandeSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemandeSelection_etat_createdAt_idx" ON "DemandeSelection"("etat", "createdAt");

-- CreateIndex
CREATE INDEX "DemandeSelection_email_createdAt_idx" ON "DemandeSelection"("email", "createdAt");
