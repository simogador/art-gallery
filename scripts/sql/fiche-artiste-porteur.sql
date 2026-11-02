-- Story 2.4 : création de la fiche artiste du porteur (décision du 2026-11-02), hors code applicatif.
-- À lancer par le porteur depuis l'éditeur SQL de Neon, après avoir remplacé les valeurs entre < >.
-- La fiche est ensuite invitée depuis /dashboard/admin/artistes avec une adresse distincte du compte
-- admin (un compte n'a qu'un rôle). Le site étant en maintenance, la fiche n'est pas visible du public.
-- Idempotent : ne fait rien si le slug existe déjà.

INSERT INTO "Artist" ("id", "slug", "name", "nationality", "birthYear", "bio", "imageUrl", "active", "featured", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  '<slug-en-minuscules-sans-accent>',   -- ex. 'karim-benali' : adresse de la page /artistes/<slug>
  '<Prénom Nom>',
  '<Nationalité>',                      -- ex. 'Marocaine'
  <année de naissance>,                 -- ex. 1975 (sans guillemets)
  '<Courte biographie>',
  '',                                   -- photo : à ajouter plus tard depuis l'administration
  true,
  false,
  now()
)
ON CONFLICT ("slug") DO NOTHING
RETURNING "id", "slug", "name";
