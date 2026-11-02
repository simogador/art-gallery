-- CreateEnum
CREATE TYPE "UsageJeton" AS ENUM ('invitation');

-- CreateTable
CREATE TABLE "Jeton" (
    "id" TEXT NOT NULL,
    "empreinte" TEXT NOT NULL,
    "usage" "UsageJeton" NOT NULL,
    "cible" TEXT NOT NULL,
    "echeance" TIMESTAMP(3) NOT NULL,
    "consommeLe" TIMESTAMP(3),
    "revoqueLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Jeton_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "creeParId" TEXT,
    "accepteeLe" TIMESTAMP(3),
    "charteVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Jeton_empreinte_key" ON "Jeton"("empreinte");

-- CreateIndex
CREATE INDEX "Jeton_usage_cible_idx" ON "Jeton"("usage", "cible");

-- CreateIndex
CREATE INDEX "Invitation_artistId_idx" ON "Invitation"("artistId");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
