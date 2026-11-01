// Story 2.3 : génère scripts/sql/zones-depart.sql (liste validée par le porteur le 2026-10-31).
// Usage : npx tsx scripts/generer-zones-depart.ts > scripts/sql/zones-depart.sql

import { CODES_PAYS, trierParNom } from '../src/lib/livraison/pays'

const UE = 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'.split(' ')
const HORS_UE = 'GB CH LI NO IS AD MC SM VA AL BA ME MK RS XK MD UA GI FO JE GG IM TR'.split(' ')
const AN = ['US', 'CA']
const SANS = ['RU', 'BY']
const pris = new Set(['MA', ...UE, ...HORS_UE, ...AN, ...SANS])
for (const c of pris) if (!CODES_PAYS.includes(c)) throw new Error(c)
const RDM = CODES_PAYS.filter((c) => !pris.has(c))
const zones: [string, string[]][] = [
  ['Maroc', ['MA']],
  ['Union européenne', UE],
  ['Europe hors UE', HORS_UE],
  ['Amérique du Nord', AN],
  ['Reste du monde', RDM],
]

const tableau = (codes: string[]) => {
  const t = trierParNom(codes).map((c) => `'${c}'`)
  const out: string[] = []
  for (let i = 0; i < t.length; i += 14) out.push('      ' + t.slice(i, i + 14).join(', '))
  return out.join(',\n')
}

const sql = `-- Story 2.3 : zones de livraison de départ (OQ-5, décision du porteur du 2026-10-31).
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
${zones.map(([n], i) => `    ('${n}', ${i})`).join(',\n')}
  ) AS z(nom, rang);

  INSERT INTO "ZonePays" ("codePays", "zoneId")
  SELECT p.code, zo."id"
  FROM (
${zones
  .map(([n, codes]) => `    -- ${n} (${codes.length} pays)\n    SELECT '${n}' AS nom, unnest(ARRAY[\n${tableau(codes)}\n    ]) AS code`)
  .join('\n    UNION ALL\n')}
  ) AS p
  JOIN "Zone" zo ON zo."nom" = p.nom;
END
$$;

-- Contrôle (lecture seule) : nombre de pays par zone. Attendu après un premier lancement :
${zones.map(([n, c]) => `--   ${n} : ${c.length}`).join('\n')}
SELECT z."nom", count(p."codePays") AS pays
FROM "Zone" z LEFT JOIN "ZonePays" p ON p."zoneId" = z."id"
GROUP BY z."nom", z."createdAt"
ORDER BY z."createdAt";
`
process.stdout.write(sql)
console.error(zones.map(([n, c]) => `${n}: ${c.length}`).join(' · '))
