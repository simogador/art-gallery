-- CreateTable
CREATE TABLE "Evenement" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "charge" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evenement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraitementEvenement" (
    "evenementId" TEXT NOT NULL,
    "gestionnaire" TEXT NOT NULL,
    "traiteLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraitementEvenement_pkey" PRIMARY KEY ("evenementId","gestionnaire")
);

-- AddForeignKey
ALTER TABLE "TraitementEvenement" ADD CONSTRAINT "TraitementEvenement_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "Evenement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
