-- Story 2.2 : requête de contrôle, en lecture seule, à lancer après la recopie
-- (scripts/sql/recopie-publication-disponibilite.sql).
-- La recopie traduit tout available = false en `vendue`, alors qu'un admin a pu masquer ou retirer
-- une œuvre avec l'ancienne bascule sans qu'elle soit vendue. Liste les œuvres publiées et vendues
-- qu'aucune commande ne contient ("Order"."artworkIds" : slugs séparés par des virgules), pour que
-- le porteur les revoie une à une (dépublier, ou passer en disponible depuis l'administration).
SELECT a."slug", a."title", a."updatedAt"
FROM "Artwork" AS a
WHERE a."publication" = 'publiee'
  AND a."disponibilite" = 'vendue'
  AND NOT EXISTS (
    SELECT 1 FROM "Order" AS o
    WHERE a."slug" = ANY (string_to_array(o."artworkIds", ','))
  )
ORDER BY a."slug";
