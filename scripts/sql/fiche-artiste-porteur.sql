-- Story 2.4 : création de la fiche artiste du porteur (décision du 2026-11-02), hors code applicatif.
-- À lancer par le porteur depuis l'éditeur SQL de Neon, après avoir remplacé les cinq valeurs entre < >
-- dans le bloc « valeurs » ci-dessous. Le script refuse de s'exécuter s'il reste un « < ».
-- La fiche est ensuite invitée depuis /dashboard/admin/artistes avec une adresse distincte du compte
-- admin (un compte n'a qu'un rôle). Le site étant en maintenance, la fiche n'est pas visible du public.
-- Idempotent : ne fait rien si le slug existe déjà.

DO $$
DECLARE
  -- valeurs
  v_slug  text := '<slug-en-minuscules-sans-accent>';  -- ex. 'karim-benali' : page /artistes/<slug>
  v_nom   text := '<Prénom Nom>';
  v_natio text := '<Nationalité>';                     -- ex. 'Marocaine'
  v_annee text := '<année de naissance>';              -- ex. '1975'
  v_bio   text := '<Courte biographie>';
BEGIN
  IF position('<' in v_slug || v_nom || v_natio || v_annee || v_bio) > 0 THEN
    RAISE EXCEPTION 'Complétez d''abord les valeurs entre < > du bloc « valeurs ».';
  END IF;
  INSERT INTO "Artist" ("id", "slug", "name", "nationality", "birthYear", "bio", "imageUrl", "active", "featured", "updatedAt")
  VALUES (gen_random_uuid()::text, v_slug, v_nom, v_natio, v_annee::int, v_bio, '', true, false, now())
  ON CONFLICT ("slug") DO NOTHING;
END
$$;

-- Contrôle (lecture seule) : la fiche et son compte (vide jusqu'à l'activation de l'invitation).
SELECT "slug", "name", "userId" FROM "Artist" ORDER BY "createdAt" DESC LIMIT 3;
