/*
  Warnings:

  - You are about to drop the column `available` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `dimensions` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Artwork` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Artwork" DROP COLUMN "available",
DROP COLUMN "dimensions",
DROP COLUMN "price";
