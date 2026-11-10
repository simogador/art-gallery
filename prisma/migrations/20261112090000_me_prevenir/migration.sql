-- Story 4.5 : « Me prévenir » sur une œuvre réservée (FR-9). Migration additive : une valeur d'enum
-- (non utilisée dans cette migration) et une table.

-- AlterEnum
ALTER TYPE "UsageJeton" ADD VALUE 'desinscription_alerte';

-- CreateTable
CREATE TABLE "InscriptionPrevenir" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InscriptionPrevenir_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InscriptionPrevenir_artworkId_createdAt_idx" ON "InscriptionPrevenir"("artworkId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InscriptionPrevenir_artworkId_email_key" ON "InscriptionPrevenir"("artworkId", "email");

-- AddForeignKey
ALTER TABLE "InscriptionPrevenir" ADD CONSTRAINT "InscriptionPrevenir_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

