-- CreateEnum
CREATE TYPE "TypeVisite" AS ENUM ('distance', 'atelier');

-- CreateTable
CREATE TABLE "DemandeVisite" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT,
    "type" "TypeVisite" NOT NULL,
    "creneaux" TIMESTAMPTZ(3)[],
    "fuseau" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT,
    "etat" "EtatDemande" NOT NULL DEFAULT 'nouvelle',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DemandeVisite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemandeVisite_etat_createdAt_idx" ON "DemandeVisite"("etat", "createdAt");

-- CreateIndex
CREATE INDEX "DemandeVisite_email_createdAt_idx" ON "DemandeVisite"("email", "createdAt");

-- CreateIndex
CREATE INDEX "DemandeVisite_artworkId_idx" ON "DemandeVisite"("artworkId");

-- AddForeignKey
ALTER TABLE "DemandeVisite" ADD CONSTRAINT "DemandeVisite_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

