-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "engagementCertificat" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "engagementEmballage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "engagementReprise" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "envoyeeEnCurationLe" TIMESTAMP(3),
ADD COLUMN     "visitesAtelier" BOOLEAN;

-- AlterTable
ALTER TABLE "OffreLivraison" ADD COLUMN     "livree" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "fraisCentimes" DROP NOT NULL,
ALTER COLUMN "preparationJours" DROP NOT NULL,
ALTER COLUMN "transportMinJours" DROP NOT NULL,
ALTER COLUMN "transportMaxJours" DROP NOT NULL;

-- Contraintes de valeur des offres (reportées de la story 2.3), écrites à la main : Prisma ne les
-- décrit pas dans schema.prisma et `migrate diff` les ignore. La table est vide avant cette story.
ALTER TABLE "OffreLivraison"
ADD CONSTRAINT "OffreLivraison_frais_positifs" CHECK ("fraisCentimes" >= 0),
ADD CONSTRAINT "OffreLivraison_delais_positifs" CHECK ("preparationJours" >= 0 AND "transportMinJours" >= 0 AND "transportMaxJours" >= 0),
ADD CONSTRAINT "OffreLivraison_transport_ordonne" CHECK ("transportMinJours" <= "transportMaxJours"),
ADD CONSTRAINT "OffreLivraison_devise_iso" CHECK ("devise" ~ '^[A-Z]{3}$'),
ADD CONSTRAINT "OffreLivraison_livree_complete" CHECK (
  NOT "livree" OR ("fraisCentimes" IS NOT NULL AND "preparationJours" IS NOT NULL
                   AND "transportMinJours" IS NOT NULL AND "transportMaxJours" IS NOT NULL)
),
ADD CONSTRAINT "OffreLivraison_non_livree_vide" CHECK (
  "livree" OR ("fraisCentimes" IS NULL AND "preparationJours" IS NULL
               AND "transportMinJours" IS NULL AND "transportMaxJours" IS NULL)
);
