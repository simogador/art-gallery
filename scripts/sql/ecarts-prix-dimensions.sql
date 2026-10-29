-- Story 2.1 : requête de contrôle, en lecture seule, à lancer juste après la fusion en production.
-- Entre la migration et la fusion, l'ancien code a pu modifier "price" ou "dimensions" sans les
-- nouvelles colonnes ; la recopie n'écrase jamais, donc ces œuvres gardent des valeurs périmées
-- (le paiement facturerait un "prixCentimes" ancien). Liste les œuvres dont les nouvelles colonnes
-- ne correspondent pas aux anciennes, avec les mêmes règles que recopie-prix-dimensions.sql.
-- Correction : voir docs/migrations.md (vider les nouvelles colonnes de ces œuvres, relancer la recopie).
WITH attendues AS (
  SELECT
    "slug", "title", "price", "prixCentimes", "dimensions", "hauteurMm", "largeurMm", "profondeurMm",
    CASE
      WHEN "price" IS NOT NULL
        AND "price"::numeric * 100 = trunc("price"::numeric * 100)
        AND "price"::numeric * 100 BETWEEN 1 AND 2147483647
      THEN ("price"::numeric * 100)::integer
    END AS centimes,
    regexp_match(
      "dimensions",
      '^[ \t\u00a0\u202f]*([0-9]{1,6}(?:[.,][0-9]+)?)[ \t\u00a0\u202f]*[xX×][ \t\u00a0\u202f]*([0-9]{1,6}(?:[.,][0-9]+)?)(?:[ \t\u00a0\u202f]*[xX×][ \t\u00a0\u202f]*([0-9]{1,6}(?:[.,][0-9]+)?))?[ \t\u00a0\u202f]*(cm|mm)[ \t\u00a0\u202f]*$'
    ) AS m
  FROM "Artwork"
),
calculees AS (
  SELECT
    *,
    round(replace(m[1], ',', '.')::numeric * CASE m[4] WHEN 'cm' THEN 10 ELSE 1 END)::integer AS h,
    round(replace(m[2], ',', '.')::numeric * CASE m[4] WHEN 'cm' THEN 10 ELSE 1 END)::integer AS l,
    round(replace(m[3], ',', '.')::numeric * CASE m[4] WHEN 'cm' THEN 10 ELSE 1 END)::integer AS p
  FROM attendues
),
lues AS (
  SELECT
    *,
    (m IS NOT NULL AND h >= 1 AND l >= 1 AND (p IS NULL OR p >= 1)) AS lisible
  FROM calculees
)
SELECT "slug", "title", "price", "prixCentimes", "dimensions", "hauteurMm", "largeurMm", "profondeurMm"
FROM lues
WHERE
  -- Prix : différent de l'ancien (prix effacé ou modifié) ; un prix non recopiable reste à
  -- prix-non-recopies.sql s'il n'a jamais été recopié.
  ("prixCentimes" IS NOT NULL AND "prixCentimes" IS DISTINCT FROM centimes)
  OR ("prixCentimes" IS NULL AND centimes IS NOT NULL)
  -- Dimensions lisibles : millimètres absents ou différents.
  OR (lisible AND ("hauteurMm", "largeurMm", "profondeurMm") IS DISTINCT FROM (h, l, p))
  -- Dimensions devenues illisibles : millimètres d'une ancienne valeur.
  OR (NOT lisible AND ("hauteurMm" IS NOT NULL OR "largeurMm" IS NOT NULL OR "profondeurMm" IS NOT NULL))
ORDER BY "slug";
