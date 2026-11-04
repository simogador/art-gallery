import type { PrismaClient } from '@/generated/prisma/client'

// Une préversion ou un poste local n'écrit jamais dans la base de production (AD-22).
// La base de production est reconnue par son identifiant d'endpoint Neon
// (DATABASE_PRODUCTION_ID, ex. « ep-cool-name-123456 »), jamais par son URL.

const OPERATIONS_ECRITURE = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
  '$executeRaw',
  '$executeRawUnsafe',
  '$queryRaw',
  '$queryRawUnsafe',
  '$runCommandRaw',
])

export class EcritureProductionInterdite extends Error {
  readonly code = 'ecriture_production_interdite'

  constructor() {
    super(
      'Écriture refusée : cet environnement n’est pas la production mais DATABASE_URL vise la base de production.',
    )
    this.name = 'EcritureProductionInterdite'
  }
}

// « ep-xxx-pooler.region.aws.neon.tech » ou « EP-XXX » → « ep-xxx ».
function normaliser(hote: string): string | null {
  const premierSegment = hote.trim().toLowerCase().split('.')[0]
  return premierSegment.replace(/-pooler$/, '') || null
}

// Identifiant d'endpoint Neon tiré de l'hôte de l'URL de connexion.
export function identifiantBase(url: string | undefined): string | null {
  if (!url) return null
  try {
    return normaliser(new URL(url).hostname)
  } catch {
    return null
  }
}

let avertissementEmis = false

// DATABASE_URL vise-t-elle l'endpoint DATABASE_PRODUCTION_ID ? null si cette variable est absente.
function viseProduction(env: Record<string, string | undefined>): boolean | null {
  const idProduction = normaliser(env.DATABASE_PRODUCTION_ID ?? '')
  return idProduction === null ? null : identifiantBase(env.DATABASE_URL) === idProduction
}

export function ecritureInterdite(env: Record<string, string | undefined> = process.env): boolean {
  if (env.VERCEL_ENV === 'production') return false

  const vise = viseProduction(env)
  if (vise === null) {
    if (!avertissementEmis) {
      avertissementEmis = true
      console.warn(
        '[garde-production] DATABASE_PRODUCTION_ID absente : la protection contre l’écriture en production est inactive.',
      )
    }
    return false
  }

  return vise
}

export class AmorcageProductionInterdit extends Error {
  readonly code = 'amorcage_production_interdit'

  constructor() {
    super(
      'Amorçage refusé : la base visée est la production (VERCEL_ENV=production ou DATABASE_URL sur DATABASE_PRODUCTION_ID). Utilisez votre propre base ou branche Neon.',
    )
    this.name = 'AmorcageProductionInterdit'
  }
}

/**
 * Amorçage (`prisma db seed`, `npm run db:seed`, story 2.9) : refusé sur la production, même depuis l'environnement de
 * production (contrairement aux écritures de l'application), et dès que DATABASE_URL vise l'endpoint
 * DATABASE_PRODUCTION_ID.
 */
export function amorcageInterdit(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === 'production' || viseProduction(env) === true
}

// Client en lecture seule : toute écriture lève EcritureProductionInterdite.
export function interdireEcritures(client: PrismaClient): PrismaClient {
  return client.$extends({
    query: {
      $allOperations({ operation, args, query }) {
        if (OPERATIONS_ECRITURE.has(operation)) throw new EcritureProductionInterdite()
        return query(args)
      },
    },
  }) as unknown as PrismaClient
}
