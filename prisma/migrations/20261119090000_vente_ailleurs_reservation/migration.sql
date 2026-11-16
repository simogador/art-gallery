-- Story 6.6 (FR-21, FR-31, NFR-4) : vente ailleurs pendant une réservation.
-- Migration additive : valeur `reservation_interrompue` de CauseIncident. À appliquer par le porteur
-- avant la fusion.

-- AlterEnum
ALTER TYPE "CauseIncident" ADD VALUE 'reservation_interrompue';
