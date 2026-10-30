-- CreateEnum
CREATE TYPE "Publication" AS ENUM ('brouillon', 'en_curation', 'publiee');

-- CreateEnum
CREATE TYPE "Disponibilite" AS ENUM ('disponible', 'reservee', 'vendue', 'vendue_ailleurs', 'retiree');

-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "disponibilite" "Disponibilite",
ADD COLUMN     "publication" "Publication";

-- CreateIndex
CREATE INDEX "Artwork_publication_disponibilite_idx" ON "Artwork"("publication", "disponibilite");

