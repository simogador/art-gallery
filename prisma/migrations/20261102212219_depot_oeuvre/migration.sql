-- CreateEnum
CREATE TYPE "TypePhoto" AS ENUM ('face_lumiere_du_jour', 'gros_plan', 'mise_en_situation', 'video');

-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "ambiance" TEXT,
ADD COLUMN     "couleurDominante" TEXT;

-- CreateTable
CREATE TABLE "PhotoOeuvre" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "type" "TypePhoto" NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "largeur" INTEGER,
    "hauteur" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoOeuvre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhotoOeuvre_artworkId_type_key" ON "PhotoOeuvre"("artworkId", "type");

-- AddForeignKey
ALTER TABLE "PhotoOeuvre" ADD CONSTRAINT "PhotoOeuvre_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
