-- Story 6.1 : recopie des anciennes commandes ("Order") dans le nouveau modèle (AD-20, temps 1 et 2).
-- À lancer par le porteur seulement, depuis l'éditeur SQL de Neon : branche de sauvegarde datée
-- (« sauvegarde-avant-6-1-… »), puis `preview`, puis production, APRÈS la migration
-- 20261113090000_commandes. Jamais par le build ni la CI.
--
-- Chaque ancien "Order" devient UNE commande « historique » : total (en centimes), devise, slugs
-- (liste séparée par des virgules), e-mail et identifiants Stripe tels qu'ils étaient ; aucune ligne
-- figée, aucun passage en caisse, aucun artiste, et hors des sommes dues (état `historique`).
-- Aucune valeur inventée : un numéro lisible est la seule valeur produite.
--
-- Idempotent : une commande n'est créée que pour un "Order" qui n'a pas encore la sienne
-- ("ordreHistoriqueId") ; relancé, le script ne duplique rien et les deux contrôles ci-dessous
-- (avant / après) donnent le même résultat. "Order" n'est pas modifiée : elle reste en lecture pour
-- le retour arrière (sa suppression est la story 7.9).
--
-- Contrôle : les lignes « avant » et « apres » doivent donner le même nombre de commandes et la même
-- somme en centimes. Retour arrière de la recopie : DELETE FROM "Commande" WHERE etat = 'historique';

SELECT 'avant' AS moment, count(*) AS commandes, coalesce(sum(round(amount * 100)), 0)::bigint AS centimes
FROM "Order";

DO $$
DECLARE
  ancien RECORD;
  essai integer;
  nouveau_numero text;
  alphabet constant text := 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
BEGIN
  FOR ancien IN
    SELECT o.* FROM "Order" o
    WHERE NOT EXISTS (SELECT 1 FROM "Commande" c WHERE c."ordreHistoriqueId" = o.id)
    ORDER BY o."createdAt", o.id
  LOOP
    essai := 0;
    LOOP
      essai := essai + 1;
      -- « ERR- » + huit caractères sans lettres ambiguës, comme le générateur de l'application.
      nouveau_numero := 'ERR-'
        || (SELECT string_agg(substr(alphabet, 1 + floor(random() * 30)::integer, 1), '') FROM generate_series(1, 4))
        || '-'
        || (SELECT string_agg(substr(alphabet, 1 + floor(random() * 30)::integer, 1), '') FROM generate_series(1, 4));
      INSERT INTO "Commande" (
        "id", "numero", "etat", "devise", "ordreHistoriqueId", "montantHistoriqueCentimes", "slugsHistoriques",
        "emailHistorique", "stripeSessionId", "stripePaymentIntentId", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text, nouveau_numero, 'historique', upper(ancien.currency), ancien.id,
        round(ancien.amount * 100)::integer, ancien."artworkIds", ancien."customerEmail",
        ancien."stripeSessionId", ancien."stripePaymentIntentId", ancien."createdAt", now()
      )
      ON CONFLICT ("numero") DO NOTHING;
      EXIT WHEN FOUND;  -- ligne insérée ; sinon le numéro existait déjà : on en tire un autre
      IF essai >= 50 THEN
        RAISE EXCEPTION 'Aucun numéro de commande libre trouvé pour une ancienne commande.';
      END IF;
    END LOOP;
  END LOOP;
END
$$;

SELECT 'apres' AS moment, count(*) AS commandes, coalesce(sum("montantHistoriqueCentimes"), 0)::bigint AS centimes
FROM "Commande" WHERE etat = 'historique';
