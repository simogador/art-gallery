-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "devise" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "hauteurMm" INTEGER,
ADD COLUMN     "largeurMm" INTEGER,
ADD COLUMN     "prixCentimes" INTEGER,
ADD COLUMN     "profondeurMm" INTEGER;
