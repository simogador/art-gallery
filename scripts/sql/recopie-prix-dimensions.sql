-- Story 2.1 (AD-20, temps 2) : recopie des anciennes colonnes de "Artwork" vers les nouvelles.
-- À lancer par le porteur depuis l'éditeur SQL de Neon, après la migration
-- 20261029084432_prix_dimensions_exacts : d'abord sur la branche `preview`, puis sur la production,
-- après une branche de sauvegarde datée (docs/migrations.md).
--
-- Idempotent : ne remplit que des colonnes encore vides, n'écrase jamais une valeur présente ;
-- le relancer donne le même résultat. Ne modifie ni "price" ni "dimensions".
--
-- Dimensions : mêmes règles que lireDimensions() de src/lib/catalogue/conversions.ts
-- (tests/catalogue.test.ts vérifie l'accord). Une dimension illisible n'est jamais devinée :
-- elle reste vide et apparaît dans scripts/sql/dimensions-illisibles.sql.

BEGIN;

-- Prix : euros (Float) → centimes entiers, seulement s'ils tombent juste (au plus deux décimales)
-- et valent au moins 1 centime. Sinon (absent, nul, négatif, plus de deux décimales, au-delà
-- d'une colonne INTEGER) : laissé vide, jamais arrondi ; listé par prix-non-recopies.sql.
UPDATE "Artwork"
SET "prixCentimes" = ("price"::numeric * 100)::integer
WHERE "prixCentimes" IS NULL
  AND "price" IS NOT NULL
  AND "price"::numeric * 100 = trunc("price"::numeric * 100)
  AND "price"::numeric * 100 BETWEEN 1 AND 2147483647;

-- Dimensions : texte → millimètres entiers (hauteur, largeur, profondeur facultative).
WITH lues AS (
  SELECT
    id,
    regexp_match(
      "dimensions",
      '^[ \t\u00a0\u202f]*([0-9]{1,6}(?:[.,][0-9]+)?)[ \t\u00a0\u202f]*[xX×][ \t\u00a0\u202f]*([0-9]{1,6}(?:[.,][0-9]+)?)(?:[ \t\u00a0\u202f]*[xX×][ \t\u00a0\u202f]*([0-9]{1,6}(?:[.,][0-9]+)?))?[ \t\u00a0\u202f]*(cm|mm)[ \t\u00a0\u202f]*$'
    ) AS m
  FROM "Artwork"
  WHERE "hauteurMm" IS NULL AND "largeurMm" IS NULL AND "profondeurMm" IS NULL
),
converties AS (
  SELECT
    id,
    round(replace(m[1], ',', '.')::numeric * CASE m[4] WHEN 'cm' THEN 10 ELSE 1 END)::integer AS h,
    round(replace(m[2], ',', '.')::numeric * CASE m[4] WHEN 'cm' THEN 10 ELSE 1 END)::integer AS l,
    round(replace(m[3], ',', '.')::numeric * CASE m[4] WHEN 'cm' THEN 10 ELSE 1 END)::integer AS p
  FROM lues
  WHERE m IS NOT NULL
)
UPDATE "Artwork" AS a
SET "hauteurMm" = c.h, "largeurMm" = c.l, "profondeurMm" = c.p
FROM converties AS c
WHERE a.id = c.id
  AND c.h >= 1 AND c.l >= 1 AND (c.p IS NULL OR c.p >= 1);

COMMIT;
