-- Story 2.1 : requête de contrôle, en lecture seule, à lancer après recopie-prix-dimensions.sql.
-- Liste les œuvres sans hauteur ou sans largeur en millimètres : dimensions illisibles (ou absentes),
-- jamais devinées. Story 2.10 : le formulaire d'édition ne préremplit plus l'ancien texte (champ vide
-- sans millimètres) ; recopier à la main la colonne "dimensions" affichée ici, avant la migration B
-- (suppression des anciennes colonnes), après laquelle cette requête échoue.
SELECT "slug", "title", "dimensions"
FROM "Artwork"
WHERE "hauteurMm" IS NULL OR "largeurMm" IS NULL
ORDER BY "slug";
