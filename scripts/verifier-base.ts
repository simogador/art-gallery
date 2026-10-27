import { config } from 'dotenv'
config({ path: '.env.local' })

import { ecritureInterdite } from '../src/lib/garde-production'

// Lancé avant les commandes Prisma qui écrivent (migrate deploy sur votre base, seed) : refuse la base de production
// hors production (AD-22).
if (ecritureInterdite()) {
  console.error(
    'Refusé : DATABASE_URL vise la base de production (DATABASE_PRODUCTION_ID). Utilisez votre propre base ou branche Neon.',
  )
  process.exit(1)
}
