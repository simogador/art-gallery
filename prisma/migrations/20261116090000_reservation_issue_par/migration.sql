-- Story 6.3 bis : auteur de la libération d'une réservation (FR-12, FR-26).
-- Migration additive : une colonne facultative, sans clé étrangère (identifiant de l'utilisateur).

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "issuePar" TEXT;
