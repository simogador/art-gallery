-- Story 6.2 : réservation en bloc sans double vente (FR-12, AD-7, NFR-4).
-- Migration additive : table "Reservation" et ses types ; aucune table existante modifiée.
-- L'index unique partiel "Reservation_active_par_oeuvre" garantit une réservation active par œuvre.

-- CreateEnum
CREATE TYPE "OrigineReservation" AS ENUM ('paiement', 'vente_assistee', 'priorite');

-- CreateEnum
CREATE TYPE "IssueReservation" AS ENUM ('expiree', 'liberee', 'confirmee', 'interrompue');

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "origine" "OrigineReservation" NOT NULL,
    "echeance" TIMESTAMPTZ(3) NOT NULL,
    "issue" "IssueReservation",
    "issueLe" TIMESTAMPTZ(3),
    "empreinteEmail" TEXT,
    "empreinteAppareil" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reservation_passageId_idx" ON "Reservation"("passageId");

-- CreateIndex
CREATE INDEX "Reservation_empreinteEmail_idx" ON "Reservation"("empreinteEmail");

-- CreateIndex
CREATE INDEX "Reservation_empreinteAppareil_idx" ON "Reservation"("empreinteAppareil");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_active_par_oeuvre" ON "Reservation"("artworkId") WHERE ("issue" IS NULL);

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

