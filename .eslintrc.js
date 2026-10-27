const EXCEPTIONS_PRISMA = require('./eslint/exceptions-prisma.cjs')

// Les chemins Next.js « [id] » ou « [slug] » sont des classes de caractères pour les globs : on les échappe.
const echapperGlob = (chemin) => chemin.replace(/[[\]]/g, '\\$&')

// AD-1 : seuls les modules métier et src/auth.ts accèdent à la base.
// Modules (AD-8) : `db` (lecture actuelle du catalogue, à migrer) et les modules prévus.
const MODULES_METIER = [
  'db',
  'catalogue',
  'curation',
  'disponibilite',
  'livraison',
  'commandes',
  'paiement',
  'demandes',
  'acces',
  'evenements',
  'notifications',
  'mesure',
  'reglages',
]

// Infrastructure autorisée : le client (src/lib/prisma.ts), son garde, la config de la CLI, et les tests,
// qui créent leurs bases jetables directement (tests/utils/base-jetable.ts).
const INFRASTRUCTURE = ['src/lib/prisma.ts', 'src/lib/garde-production.ts', 'prisma.config.ts', 'tests/**']

const IMPORTS_PRISMA = [
  '@/lib/prisma',
  '**/prisma', // ./prisma, ../prisma, ../../lib/prisma…
  '@/generated/prisma',
  '@/generated/prisma/**',
  '**/generated/prisma',
  '**/generated/prisma/**',
  '@prisma/client',
  '@prisma/client/**',
  '@prisma/adapter-pg',
  'pg',
]

module.exports = {
  extends: ['next/core-web-vitals'],
  overrides: [
    {
      files: ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
      excludedFiles: [
        ...MODULES_METIER.map((module) => `src/lib/${module}/**`),
        'src/auth.ts',
        ...INFRASTRUCTURE,
        ...EXCEPTIONS_PRISMA.map(echapperGlob),
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: IMPORTS_PRISMA,
                message:
                  "AD-1 : la base (Prisma, pg) est réservée aux modules métier (src/lib/<module>/) et à src/auth.ts. Passez par l'API publique d'un module.",
              },
            ],
          },
        ],
      },
    },
  ],
}
