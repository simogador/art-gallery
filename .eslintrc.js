const EXCEPTIONS_PRISMA = require('./eslint/exceptions-prisma.cjs')
const EXCEPTIONS_TEXTES = require('./eslint/exceptions-textes.cjs')

// Les chemins Next.js « [id] » ou « [slug] » sont des classes de caractères pour les globs : on les échappe.
const echapperGlob = (chemin) => chemin.replace(/[[\]]/g, '\\$&')

// AD-1 : seuls les modules métier et src/auth.ts accèdent à la base.
// Modules (AD-8) : `catalogue` (lectures du catalogue, ex-src/lib/db depuis la story 2.1) et les modules prévus.
const MODULES_METIER = [
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

// Story 3.2 (AD-18) : surfaces de l'epic 3 (accueil, galerie, fiche, artistes, en-tête, pied de page,
// bascule d'unité, pays de livraison) sans texte visible en dur ; les textes viennent du dictionnaire (src/lib/i18n/fr.ts).
const SURFACES_TEXTES = [
  'src/app/page.tsx',
  'src/components/sections/**/*.tsx',
  'src/app/galerie/**/*.tsx',
  'src/app/artistes/**/*.tsx',
  'src/components/layout/**/*.tsx',
  'src/components/ui/UniteToggle.tsx',
  'src/components/ui/PaysLivraison.tsx',
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
    {
      // Fichiers refaits par les stories 3.5 à 3.11 : exemptés par une liste qui ne fait que diminuer
      // (eslint/exceptions-textes.cjs, contrôlée en CI comme eslint/exceptions-prisma.cjs).
      files: SURFACES_TEXTES,
      excludedFiles: EXCEPTIONS_TEXTES.map(echapperGlob),
      rules: {
        'react/jsx-no-literals': [
          'error',
          {
            // Chaînes entre accolades comprises ; les attributs (classes, href…) ne sont pas visés.
            noStrings: true,
            ignoreProps: true,
            // Ponctuation seule, sans texte à traduire.
            allowedStrings: ['·', '—', '×', '/', ',', '(', ')'],
          },
        ],
      },
    },
  ],
}
