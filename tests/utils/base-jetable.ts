import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { Client } from 'pg'
import { ecritureInterdite } from '@/lib/garde-production'

// Base PostgreSQL jetable pour les tests (story 1.5) : créée sur le serveur de
// TEST_DATABASE_URL, migrée par les migrations du dépôt, puis supprimée.
// Jamais la base de production : refus si TEST_DATABASE_URL vise DATABASE_PRODUCTION_ID.

export interface BaseJetable {
  url: string
  supprimer: () => Promise<void>
}

function urlServeur(): string {
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL absente : indiquez un serveur PostgreSQL où créer des bases jetables (voir README, section « Tests »).',
    )
  }
  // Sans DATABASE_PRODUCTION_ID, ecritureInterdite avertit que la protection est inactive.
  if (ecritureInterdite({ DATABASE_PRODUCTION_ID: process.env.DATABASE_PRODUCTION_ID, DATABASE_URL: url })) {
    throw new Error('TEST_DATABASE_URL vise la base de production : refusé.')
  }
  return url
}

async function executer(urlServeur: string, sql: string) {
  const client = new Client({ connectionString: urlServeur })
  await client.connect()
  try {
    await client.query(sql)
  } finally {
    await client.end()
  }
}

export async function creerBaseJetable(): Promise<BaseJetable> {
  const serveur = urlServeur()
  const nom = `test_${Date.now()}_${randomBytes(4).toString('hex')}`
  const url = new URL(serveur)
  url.pathname = `/${nom}`

  await executer(serveur, `CREATE DATABASE "${nom}"`)
  const supprimer = () => executer(serveur, `DROP DATABASE IF EXISTS "${nom}" WITH (FORCE)`)

  try {
    // --no-install : jamais une autre version de Prisma que celle du dépôt.
    execFileSync('npx', ['--no-install', 'prisma', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: url.toString() },
      stdio: 'pipe',
      timeout: 90_000,
    })
  } catch (erreur) {
    await supprimer()
    throw erreur
  }

  return { url: url.toString(), supprimer }
}
