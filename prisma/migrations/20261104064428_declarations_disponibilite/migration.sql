-- CreateEnum
CREATE TYPE "TypeDeclarationDisponibilite" AS ENUM ('vendue_ailleurs', 'retiree');

-- CreateTable
CREATE TABLE "DeclarationDisponibilite" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "type" "TypeDeclarationDisponibilite" NOT NULL,
    "userId" TEXT NOT NULL,
    "reservationInterrompue" BOOLEAN NOT NULL DEFAULT false,
    "annuleeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeclarationDisponibilite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeclarationDisponibilite_artworkId_createdAt_idx" ON "DeclarationDisponibilite"("artworkId", "createdAt");

-- AddForeignKey
ALTER TABLE "DeclarationDisponibilite" ADD CONSTRAINT "DeclarationDisponibilite_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
