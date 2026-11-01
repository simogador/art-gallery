-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZonePays" (
    "codePays" VARCHAR(2) NOT NULL,
    "zoneId" TEXT NOT NULL,

    CONSTRAINT "ZonePays_pkey" PRIMARY KEY ("codePays")
);

-- CreateTable
CREATE TABLE "OffreLivraison" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "fraisCentimes" INTEGER NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "preparationJours" INTEGER NOT NULL,
    "transportMinJours" INTEGER NOT NULL,
    "transportMaxJours" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffreLivraison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Zone_nom_key" ON "Zone"("nom");

-- CreateIndex
CREATE INDEX "ZonePays_zoneId_idx" ON "ZonePays"("zoneId");

-- CreateIndex
CREATE INDEX "OffreLivraison_zoneId_idx" ON "OffreLivraison"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "OffreLivraison_artworkId_zoneId_key" ON "OffreLivraison"("artworkId", "zoneId");

-- AddForeignKey
ALTER TABLE "ZonePays" ADD CONSTRAINT "ZonePays_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffreLivraison" ADD CONSTRAINT "OffreLivraison_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffreLivraison" ADD CONSTRAINT "OffreLivraison_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
