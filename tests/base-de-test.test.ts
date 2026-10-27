import { readdirSync } from 'node:fs'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Condition des futurs tests de double vente (NFR-4) : deux transactions sur la base
// de test sont réellement concurrentes, sur deux connexions distinctes.

async function pid(client: Client): Promise<number> {
  return (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
}

// Attend que PostgreSQL déclare `bloquee` en attente d'un verrou tenu par `bloquante`.
async function attendreBlocage(observateur: Client, bloquee: number, bloquante: number) {
  for (let essai = 0; essai < 50; essai++) {
    const { rows } = await observateur.query('SELECT pg_blocking_pids($1) AS pids', [bloquee])
    if ((rows[0].pids as number[]).includes(bloquante)) return
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`La connexion ${bloquee} n'a jamais attendu la connexion ${bloquante}.`)
}

describe('base de test', () => {
  let base: BaseJetable
  let a: Client
  let b: Client
  let observateur: Client

  beforeAll(async () => {
    base = await creerBaseJetable()
    a = new Client({ connectionString: base.url })
    b = new Client({ connectionString: base.url })
    observateur = new Client({ connectionString: base.url })
    await Promise.all([a.connect(), b.connect(), observateur.connect()])
    // Table propre au test : indépendante des évolutions du schéma métier.
    await a.query('CREATE TABLE verrou_test (id int PRIMARY KEY)')
    await a.query('INSERT INTO verrou_test (id) VALUES (1)')
  })

  afterAll(async () => {
    await Promise.all([a?.end(), b?.end(), observateur?.end()])
    await base?.supprimer()
  })

  it('applique toutes les migrations du dépôt', async () => {
    const attendues = readdirSync('prisma/migrations', { withFileTypes: true }).filter((e) => e.isDirectory()).length
    const { rows } = await a.query(
      'SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
    )
    expect(rows[0].n).toBe(attendues)
  })

  it('ouvre deux connexions distinctes', async () => {
    expect(await pid(a)).not.toBe(await pid(b))
  })

  it('fait attendre la seconde transaction tant que la première tient le verrou', async () => {
    const verrouiller = (client: Client) => client.query('SELECT id FROM verrou_test WHERE id = 1 FOR UPDATE')
    const [pidA, pidB] = [await pid(a), await pid(b)]
    let aOuverte = false
    let bOuverte = false

    try {
      await a.query('BEGIN')
      aOuverte = true
      await verrouiller(a)

      await b.query('BEGIN')
      bOuverte = true
      const verrouB = verrouiller(b)
      verrouB.catch(() => {}) // évite un rejet non géré si une assertion échoue avant l'attente

      await attendreBlocage(observateur, pidB, pidA)

      await a.query('COMMIT')
      aOuverte = false
      expect((await verrouB).rowCount).toBe(1)
      await b.query('COMMIT')
      bOuverte = false
    } finally {
      if (aOuverte) await a.query('ROLLBACK')
      if (bOuverte) await b.query('ROLLBACK')
    }
  })
})
