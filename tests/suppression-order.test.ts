import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 7.9 (AD-20, temps 4) : l'ancienne table Order disparaît, le code qui la lisait aussi.

const fichiers = (dossier: string): string[] =>
  readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom)
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(ts|tsx)$/.test(nom) ? [chemin] : []
  })

describe('src/ ne nomme plus l’ancien modèle de commande', () => {
  const sources = fichiers('src')
    .filter((f) => !f.split(path.sep).join('/').startsWith('src/generated/'))
    .map((f) => ({ f, texte: readFileSync(f, 'utf8') }))

  it.each([
    ['prisma.order', /\bprisma\.order\b|\btx\.order\b/],
    ['table "Order"', /"Order"/],
    ['colonne Order.artworkIds', /\border\.artworkIds\b|\bOrder\.artworkIds\b|\bartworkIds\s*:\s*\{\s*(?:contains|in)\b/i],
    ['relation User.orders', /\borders\s*:\s*\{/],
    ['client du prestataire', /@\/lib\/stripe|from 'stripe'/],
  ])('%s', (_nom, motif) => {
    expect(sources.filter(({ texte }) => motif.test(texte)).map(({ f }) => f)).toEqual([])
  })

  it('aucune dépendance au prestataire dans package.json', () => {
    const paquet = JSON.parse(readFileSync('package.json', 'utf8'))
    expect(Object.keys({ ...paquet.dependencies, ...paquet.devDependencies })).not.toContain('stripe')
  })

  it('AGENTS.md ne décrit plus Order.artworkIds', () => {
    expect(readFileSync('AGENTS.md', 'utf8')).not.toMatch(/Order\.artworkIds|`Order` reste/)
  })
})

describe('migration de suppression de "Order" : garde sur les lignes', () => {
  let base: BaseJetable
  let db: Client
  let tableAbsenteApresMigrations = false
  const migration = readFileSync('prisma/migrations/20261122090000_suppression_order/migration.sql', 'utf8')

  // Recrée l'ancienne table à partir de la migration de ligne de base (la base jetable est déjà migrée).
  const baseOrder = readFileSync('prisma/migrations/20261027150000_ligne_de_base/migration.sql', 'utf8')
    .split(/;\s*\n/)
    .filter((instruction) => /"Order"/.test(instruction))
    .join(';\n') + ';'

  beforeAll(async () => {
    base = await creerBaseJetable()
    db = new Client({ connectionString: base.url })
    await db.connect()
    // État de la base juste après toutes les migrations du dépôt, avant que beforeEach ne recrée la table.
    tableAbsenteApresMigrations = (await db.query(`SELECT to_regclass('public."Order"') AS t`)).rows[0].t === null
  })

  afterAll(async () => {
    await db?.end()
    await base?.supprimer()
  })

  beforeEach(async () => {
    await db.query('DROP TABLE IF EXISTS "Order"')
    await db.query(baseOrder)
  })

  const existe = async () => (await db.query(`SELECT to_regclass('public."Order"') AS t`)).rows[0].t !== null

  it('les migrations du dépôt n’ont pas laissé de table "Order"', async () => {
    expect(tableAbsenteApresMigrations).toBe(true)
  })

  it('table vide : supprimée avec ses index et sa clé étrangère', async () => {
    await db.query(migration)
    expect(await existe()).toBe(false)
    expect((await db.query(`SELECT count(*)::int AS n FROM pg_indexes WHERE indexname LIKE 'Order\\_%'`)).rows[0].n).toBe(0)
  })

  it('table non vide : la migration échoue sans rien supprimer', async () => {
    await db.query(
      `INSERT INTO "Order" (id, "stripeSessionId", "artworkIds", amount, "updatedAt") VALUES ('o1', 'cs_1', 'a', 1, now())`,
    )
    await expect(db.query(migration)).rejects.toThrow(/recopie/)
    expect(await existe()).toBe(true)
    expect((await db.query('SELECT count(*)::int AS n FROM "Order"')).rows[0].n).toBe(1)
  })
})
