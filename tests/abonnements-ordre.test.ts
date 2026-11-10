import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// `notifications` → `demandes` → `evenements` → `abonnements` → `notifications` est un cycle d'imports :
// les gestionnaires de `notifications` sont donc résolus à la répartition (import différé), pas à
// l'évaluation de `abonnements.ts`. Ces tests le prouvent pour chaque ordre de chargement plausible,
// puis de bout en bout pour la confirmation « Me prévenir ».

const envoyes = vi.hoisted(() => [] as { a: string; sujet: string }[])
vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }), headers: () => new Headers() }))
vi.mock('@/lib/notifications/choix', () => ({
  envoiActif: () => ({ envoyer: async (c: { a: string; sujet: string }) => (envoyes.push(c), { ok: true }) }),
  choisirEnvoi: vi.fn(),
  envoiReel: () => false,
}))

const ORDRES = ['@/lib/notifications', '@/lib/demandes', '@/lib/evenements', '@/lib/abonnements', '@/lib/notifications/gestionnaires']

let base: BaseJetable
let db: Client
beforeAll(async () => {
  base = await creerBaseJetable()
  process.env.DATABASE_URL = base.url
  process.env.AUTH_SECRET = 'secret-de-test'
  db = new Client({ connectionString: base.url })
  await db.connect()
  await db.query(`INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "accordSigneLe", "updatedAt") VALUES ('a', 'a', 'A', 'MA', 1980, 'B', '', now(), now())`)
  await db.query(
    `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", devise, "hauteurMm", "largeurMm", publication, disponibilite, "artistId", "updatedAt")
     VALUES ('o', 'o', 'Titre o', 2024, 'Huile', 'D', 'https://res.cloudinary.com/x/p.jpg', 1000, 'EUR', 610, 760, 'publiee', 'reservee', 'a', now())`,
  )
})
afterAll(async () => {
  const { prisma } = await import('@/lib/prisma')
  await prisma.$disconnect()
  await db?.end()
  await base?.supprimer()
})


describe('abonnements : aucun ordre de chargement ne casse les gestionnaires', () => {
  it.each(ORDRES)('chargement de %s en premier : chaque gestionnaire relié existe et chaque abonnement est une fonction', async (premier) => {
    vi.resetModules()
    await import(premier)
    const { ABONNEMENTS, GESTIONNAIRES_DE_NOTIFICATIONS } = await import('@/lib/abonnements')
    const notifications = (await import('@/lib/notifications')) as unknown as Record<string, unknown>
    const abonnements = Object.values(ABONNEMENTS).flat()
    expect(abonnements.length).toBeGreaterThanOrEqual(10)
    for (const a of abonnements) expect(typeof a.gestionnaire, a.nom).toBe('function')
    expect(GESTIONNAIRES_DE_NOTIFICATIONS.size).toBeGreaterThanOrEqual(8)
    for (const nom of GESTIONNAIRES_DE_NOTIFICATIONS) expect(typeof notifications[nom], nom).toBe('function')
  })
})

describe('bout en bout : confirmation d’inscription, quel que soit l’ordre de chargement', () => {
  it.each(ORDRES)('%s chargé en premier : l’inscription déclenche bien l’e-mail', async (premier) => {
    vi.resetModules()
    envoyes.length = 0
    await db.query('DELETE FROM "InscriptionPrevenir"')
    await import(premier)
    const { enregistrerInscriptionPrevenir } = await import('@/lib/demandes')
    const email = `x-${ORDRES.indexOf(premier)}@exemple.test`
    expect(await enregistrerInscriptionPrevenir({ email }, { ip: null, slug: 'o' })).toEqual({ ok: true })
    expect(envoyes).toEqual([expect.objectContaining({ a: email, sujet: 'Nous vous prévenons pour « Titre o »' })])
    // Et la suppression à la vente passe par le même chemin différé.
    await db.query(`UPDATE "Artwork" SET disponibilite = 'vendue' WHERE id = 'o'`)
    const { ecrireEvenement, repartirApresValidation } = await import('@/lib/evenements')
    const { prisma } = await import('@/lib/prisma')
    const id = await prisma.$transaction((tx) => ecrireEvenement(tx, { nom: 'DisponibiliteChangee', charge: { artworkId: 'o', artistId: 'a' } }))
    await repartirApresValidation([id])
    expect((await db.query('SELECT count(*)::int AS n FROM "InscriptionPrevenir"')).rows[0].n).toBe(0)
    await db.query(`UPDATE "Artwork" SET disponibilite = 'reservee' WHERE id = 'o'`)
  })
})
