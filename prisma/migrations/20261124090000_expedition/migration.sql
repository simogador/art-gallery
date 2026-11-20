-- Story 8.2 (FR-22, FR-29) : l'artiste expédie et saisit le suivi. Migration additive : valeur `expediee` de
-- EtatCommande (avant `annulee`) et six colonnes de Commande. À appliquer par le porteur avant la fusion
-- (docs/migrations.md).

-- AlterEnum
ALTER TYPE "EtatCommande" ADD VALUE 'expediee' BEFORE 'annulee';

-- AlterTable
ALTER TABLE "Commande" ADD COLUMN     "transporteur" TEXT,
ADD COLUMN     "numeroSuivi" TEXT,
ADD COLUMN     "expedieeLe" TIMESTAMPTZ(3),
ADD COLUMN     "expedieePar" TEXT,
ADD COLUMN     "envoiAssure" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referenceAssurance" TEXT;
