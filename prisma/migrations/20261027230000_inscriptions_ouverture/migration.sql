-- CreateTable
CREATE TABLE "InscriptionOuverture" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "consentementLe" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InscriptionOuverture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TentativeInscription" (
    "id" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativeInscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InscriptionOuverture_email_key" ON "InscriptionOuverture"("email");

-- CreateIndex
CREATE INDEX "TentativeInscription_cle_createdAt_idx" ON "TentativeInscription"("cle", "createdAt");

-- CreateIndex
CREATE INDEX "TentativeInscription_createdAt_idx" ON "TentativeInscription"("createdAt");

