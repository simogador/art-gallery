-- Story 2.2 : requête de contrôle, en lecture seule, à lancer juste après la fusion en production
-- (et à tout retour arrière). Entre la migration et la fusion, l'ancien code a pu créer des œuvres
-- sans les nouvelles colonnes, ou modifier "available" (bascule de l'administration, webhook de
-- paiement) sans elles ; la recopie n'écrase jamais, donc ces œuvres garderaient un état périmé.
--
-- Liste les œuvres :
--   - dont une des deux colonnes est vide (ni visibles ni disponibles pour le nouveau code) ;
--   - dont "available" diffère de « disponible » (publiée et disponible), seule valeur que le
--     nouveau code écrit en double dans "available" (src/lib/disponibilite).
-- Correction : scripts/sql/corriger-ecarts-publication-disponibilite.sql (ciblée, voir docs/migrations.md).
SELECT "slug", "title", "available", "publication", "disponibilite"
FROM "Artwork"
WHERE "publication" IS NULL
   OR "disponibilite" IS NULL
   OR "available" IS DISTINCT FROM ("publication" = 'publiee' AND "disponibilite" = 'disponible')
ORDER BY "slug";
