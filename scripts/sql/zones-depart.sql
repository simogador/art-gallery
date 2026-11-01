-- Story 2.3 : zones de livraison de départ (OQ-5, décision du porteur du 2026-10-31).
-- À lancer par le porteur depuis l'éditeur SQL de Neon (preview, puis production), APRÈS la
-- migration 20261031004437_zones_livraison.
-- N'agit que sur une base SANS AUCUNE zone : dès qu'une zone existe (script déjà lancé, ou zones
-- créées dans l'administration), il ne fait rien et l'indique. Relancer le script ne peut donc
-- jamais défaire une modification faite depuis l'administration.
-- Russie (RU) et Biélorussie (BY) ne sont dans aucune zone : livraison impossible.
-- Fichier généré par scripts/generer-zones-depart.ts ; tests/livraison.test.ts vérifie la liste.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Zone") THEN
    RAISE NOTICE 'Des zones existent déjà : rien n''est fait. Modifiez-les depuis /dashboard/admin/zones.';
    RETURN;
  END IF;

  INSERT INTO "Zone" ("id", "nom", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, z.nom, now() + z.rang * interval '1 millisecond', now()
  FROM (VALUES
    ('Maroc', 0),
    ('Union européenne', 1),
    ('Europe hors UE', 2),
    ('Amérique du Nord', 3),
    ('Reste du monde', 4)
  ) AS z(nom, rang);

  INSERT INTO "ZonePays" ("codePays", "zoneId")
  SELECT p.code, zo."id"
  FROM (
    -- Maroc (1 pays)
    SELECT 'Maroc' AS nom, unnest(ARRAY[
      'MA'
    ]) AS code
    UNION ALL
    -- Union européenne (27 pays)
    SELECT 'Union européenne' AS nom, unnest(ARRAY[
      'DE', 'AT', 'BE', 'BG', 'CY', 'HR', 'DK', 'ES', 'EE', 'FI', 'FR', 'GR', 'HU', 'IE',
      'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'SE', 'CZ'
    ]) AS code
    UNION ALL
    -- Europe hors UE (23 pays)
    SELECT 'Europe hors UE' AS nom, unnest(ARRAY[
      'AL', 'AD', 'BA', 'VA', 'GI', 'GG', 'IM', 'FO', 'IS', 'JE', 'XK', 'LI', 'MK', 'MD',
      'MC', 'ME', 'NO', 'GB', 'SM', 'RS', 'CH', 'TR', 'UA'
    ]) AS code
    UNION ALL
    -- Amérique du Nord (2 pays)
    SELECT 'Amérique du Nord' AS nom, unnest(ARRAY[
      'CA', 'US'
    ]) AS code
    UNION ALL
    -- Reste du monde (195 pays)
    SELECT 'Reste du monde' AS nom, unnest(ARRAY[
      'AF', 'ZA', 'DZ', 'AO', 'AI', 'AQ', 'AG', 'SA', 'AR', 'AM', 'AW', 'AU', 'AZ', 'BS',
      'BH', 'BD', 'BB', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BW', 'BR', 'BN', 'BF', 'BI', 'KH',
      'CM', 'CV', 'CL', 'CN', 'CO', 'KM', 'CG', 'CD', 'KP', 'KR', 'CR', 'CI', 'CU', 'CW',
      'DJ', 'DM', 'EG', 'AE', 'EC', 'ER', 'SZ', 'ET', 'FJ', 'GA', 'GM', 'GE', 'GS', 'GH',
      'GD', 'GL', 'GP', 'GU', 'GT', 'GN', 'GQ', 'GW', 'GY', 'GF', 'HT', 'HN', 'BV', 'CX',
      'NF', 'AX', 'KY', 'CC', 'CK', 'HM', 'FK', 'MP', 'MH', 'UM', 'PN', 'SB', 'TC', 'VG',
      'VI', 'IN', 'ID', 'IQ', 'IR', 'IL', 'JM', 'JP', 'JO', 'KZ', 'KE', 'KG', 'KI', 'KW',
      'RE', 'LA', 'LS', 'LB', 'LR', 'LY', 'MG', 'MY', 'MW', 'MV', 'ML', 'MQ', 'MU', 'MR',
      'YT', 'MX', 'FM', 'MN', 'MS', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NI', 'NE', 'NG', 'NU',
      'NC', 'NZ', 'OM', 'UG', 'UZ', 'PK', 'PW', 'PA', 'PG', 'PY', 'BQ', 'PE', 'PH', 'PF',
      'PR', 'QA', 'HK', 'MO', 'CF', 'DO', 'RW', 'EH', 'BL', 'KN', 'MF', 'SX', 'PM', 'VC',
      'SH', 'LC', 'SV', 'WS', 'AS', 'ST', 'SN', 'SC', 'SL', 'SG', 'SO', 'SD', 'SS', 'LK',
      'SR', 'SJ', 'SY', 'TJ', 'TW', 'TZ', 'TD', 'TF', 'IO', 'PS', 'TH', 'TL', 'TG', 'TK',
      'TO', 'TT', 'TN', 'TM', 'TV', 'UY', 'VU', 'VE', 'VN', 'WF', 'YE', 'ZM', 'ZW'
    ]) AS code
  ) AS p
  JOIN "Zone" zo ON zo."nom" = p.nom;
END
$$;

-- Contrôle (lecture seule) : nombre de pays par zone. Attendu après un premier lancement :
--   Maroc : 1
--   Union européenne : 27
--   Europe hors UE : 23
--   Amérique du Nord : 2
--   Reste du monde : 195
SELECT z."nom", count(p."codePays") AS pays
FROM "Zone" z LEFT JOIN "ZonePays" p ON p."zoneId" = z."id"
GROUP BY z."nom", z."createdAt"
ORDER BY z."createdAt";
