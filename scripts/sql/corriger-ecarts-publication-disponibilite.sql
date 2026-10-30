-- Story 2.2 : correction ciblée des écarts listés par ecarts-publication-disponibilite.sql
-- (après la fusion, ou après un retour arrière). "available" fait foi, mais seulement là où il est
-- le seul renseignement fiable : ne corrige que ce qui est en désaccord, sans jamais toucher un
-- état que l'ancien code ne connaît pas (brouillon, en_curation, reservee, vendue_ailleurs, retiree).
--
--   1. axe publication vide          → 'publiee' (règle de la recopie) ;
--   2. axe disponibilite vide        → d'après available ('disponible' ou 'vendue') ;
--   3. œuvre publiée, disponible ou vendue, en désaccord avec available
--                                    → disponibilite d'après available.
--
-- Idempotent. Les écarts restants (par ex. un brouillon remis à available = true par l'ancien code)
-- restent listés par la requête d'écarts : à traiter à la main depuis l'administration.

BEGIN;

UPDATE "Artwork"
SET "publication" = 'publiee'
WHERE "publication" IS NULL;

UPDATE "Artwork"
SET "disponibilite" = CASE WHEN "available" THEN 'disponible' ELSE 'vendue' END::"Disponibilite"
WHERE "disponibilite" IS NULL;

UPDATE "Artwork"
SET "disponibilite" = CASE WHEN "available" THEN 'disponible' ELSE 'vendue' END::"Disponibilite"
WHERE "publication" = 'publiee'
  AND "disponibilite" IN ('disponible', 'vendue')
  AND "available" IS DISTINCT FROM ("disponibilite" = 'disponible');

COMMIT;
