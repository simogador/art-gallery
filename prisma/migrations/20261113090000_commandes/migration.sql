-- Story 6.1 : passage en caisse et commandes par artiste, aux montants figés (FR-10, AD-12, AR-10).
-- Migration additive : nouvelles tables seulement, la table "Order" n'est pas touchée (AD-20).
-- Les contraintes CHECK sont écrites à la main (Prisma ne les décrit pas).

-- CreateEnum
CREATE TYPE "EtatCommande" AS ENUM ('en_attente_paiement', 'confirmee', 'annulee', 'historique');

-- CreateEnum
CREATE TYPE "EtatPaiement" AS ENUM ('ouvert', 'constate', 'abandonne');

-- CreateTable
CREATE TABLE "PassageEnCaisse" (
    "id" TEXT NOT NULL,
    "paysLivraison" VARCHAR(2) NOT NULL,
    "devise" VARCHAR(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassageEnCaisse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoordonneesAcheteur" (
    "id" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "telephone" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoordonneesAcheteur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commande" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "passageId" TEXT,
    "artistId" TEXT,
    "etat" "EtatCommande" NOT NULL DEFAULT 'en_attente_paiement',
    "devise" VARCHAR(3) NOT NULL,
    "ordreHistoriqueId" TEXT,
    "montantHistoriqueCentimes" INTEGER,
    "slugsHistoriques" TEXT,
    "emailHistorique" TEXT,
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Commande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneCommande" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "artworkId" TEXT,
    "slug" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "prixCentimes" INTEGER NOT NULL,
    "fraisCentimes" INTEGER NOT NULL,
    "totalCentimes" INTEGER NOT NULL,
    "devise" VARCHAR(3) NOT NULL,
    "zoneId" TEXT NOT NULL,
    "zoneNom" TEXT NOT NULL,
    "delaiMinJours" INTEGER NOT NULL,
    "delaiMaxJours" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LigneCommande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paiement" (
    "id" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "referenceExterne" TEXT NOT NULL,
    "montantCentimes" INTEGER NOT NULL,
    "etat" "EtatPaiement" NOT NULL DEFAULT 'ouvert',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoordonneesAcheteur_passageId_key" ON "CoordonneesAcheteur"("passageId");

-- CreateIndex
CREATE UNIQUE INDEX "Commande_numero_key" ON "Commande"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Commande_ordreHistoriqueId_key" ON "Commande"("ordreHistoriqueId");

-- CreateIndex
CREATE INDEX "Commande_passageId_idx" ON "Commande"("passageId");

-- CreateIndex
CREATE INDEX "Commande_artistId_etat_idx" ON "Commande"("artistId", "etat");

-- CreateIndex
CREATE INDEX "LigneCommande_commandeId_idx" ON "LigneCommande"("commandeId");

-- CreateIndex
CREATE INDEX "LigneCommande_artworkId_idx" ON "LigneCommande"("artworkId");

-- CreateIndex
CREATE INDEX "Paiement_passageId_idx" ON "Paiement"("passageId");

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_source_referenceExterne_key" ON "Paiement"("source", "referenceExterne");

-- AddForeignKey
ALTER TABLE "CoordonneesAcheteur" ADD CONSTRAINT "CoordonneesAcheteur_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "PassageEnCaisse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "PassageEnCaisse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "PassageEnCaisse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Contraintes CHECK
-- Une commande est soit historique (recopie d'"Order" : ni passage ni artiste, montant et source), soit
-- une vraie commande (passage et artiste, aucune trace de l'ancienne table).
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_forme_check" CHECK (
  (
    "etat" = 'historique'
    AND "passageId" IS NULL AND "artistId" IS NULL
    AND "ordreHistoriqueId" IS NOT NULL AND "montantHistoriqueCentimes" IS NOT NULL
  ) OR (
    "etat" <> 'historique'
    AND "passageId" IS NOT NULL AND "artistId" IS NOT NULL
    AND "ordreHistoriqueId" IS NULL AND "montantHistoriqueCentimes" IS NULL
  )
);
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_devise_check" CHECK ("devise" ~ '^[A-Z]{3}$');
ALTER TABLE "PassageEnCaisse" ADD CONSTRAINT "PassageEnCaisse_devise_check" CHECK ("devise" ~ '^[A-Z]{3}$');
ALTER TABLE "PassageEnCaisse" ADD CONSTRAINT "PassageEnCaisse_pays_check" CHECK ("paysLivraison" ~ '^[A-Z]{2}$');
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_montants_check" CHECK (
  "prixCentimes" >= 0 AND "fraisCentimes" >= 0 AND "totalCentimes" = "prixCentimes" + "fraisCentimes"
);
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_delais_check" CHECK (
  "delaiMinJours" >= 0 AND "delaiMaxJours" >= "delaiMinJours"
);
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_devise_check" CHECK ("devise" ~ '^[A-Z]{3}$');
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_montant_check" CHECK ("montantCentimes" >= 0);
