-- Story 2.1 : requête de contrôle, en lecture seule, à lancer après recopie-prix-dimensions.sql.
-- Liste les œuvres dont l'ancien prix n'a pas été recopié en centimes : prix nul ou négatif,
-- plus de deux décimales, ou supérieur à 21 474 836,47 € (limite d'une colonne INTEGER).
-- À traiter à la main.
SELECT "slug", "title", "price"
FROM "Artwork"
WHERE "price" IS NOT NULL AND "prixCentimes" IS NULL
ORDER BY "slug";
