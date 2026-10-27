import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'
import { ecritureInterdite, interdireEcritures } from '@/lib/garde-production'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const client = new PrismaClient({ adapter } as any)
  return ecritureInterdite() ? interdireEcritures(client) : client
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
