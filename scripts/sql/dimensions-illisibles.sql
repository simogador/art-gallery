-- Story 2.1 : requête de contrôle, en lecture seule, à lancer après recopie-prix-dimensions.sql.
-- Liste les œuvres sans hauteur ou sans largeur en millimètres : dimensions illisibles (ou absentes),
-- à saisir à la main depuis le formulaire d'édition, qui préremplit l'ancien texte. Jamais devinées.
SELECT "slug", "title", "dimensions"
FROM "Artwork"
WHERE "hauteurMm" IS NULL OR "largeurMm" IS NULL
ORDER BY "slug";
