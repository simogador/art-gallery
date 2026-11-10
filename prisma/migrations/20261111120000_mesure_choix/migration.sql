-- CreateEnum
CREATE TYPE "ChoixMesure" AS ENUM ('accepte', 'refuse');

-- CreateTable
CREATE TABLE "CompteurChoixMesure" (
    "jour" DATE NOT NULL,
    "choix" "ChoixMesure" NOT NULL,
    "nombre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompteurChoixMesure_pkey" PRIMARY KEY ("jour","choix")
);

