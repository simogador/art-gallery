import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 4.9 : hors production, l'adaptateur « journal » répond « ok » sans rien envoyer ; l'annonce est donc
// refusée (aucune adresse supprimée, aucun jeton, aucun appel HTTP). `choix.ts` n'est pas simulé ici.

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }), headers: () => new Headers() }))

const ADMIN = { type: 'admin', userId: 'admin-1' }

describe('annonce hors production', () => {
  let base: BaseJetable
  let db: Client

  beforeAll(async () => {
    delete process.env.VERCEL_ENV
    base = await creerBaseJetable()
    process.env.DATABASE_URL = base.url
    db = new Client({ connectionString: base.url })
    await db.connect()
    await db.query(`INSERT INTO "User" (id, email, role, "updatedAt") VALUES ('admin-1', 'equipe@exemple.test', 'admin', now())`)
    await db.query(`INSERT INTO "InscriptionOuverture" (id, email, "consentementLe") VALUES ('c1', 'alice@exemple.test', now())`)
  })

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$disconnect()
    await db?.end()
    await base?.supprimer()
  })

  it('refus « hors_production » : adresse gardée, aucun jeton, aucun appel HTTP, aucun journal d\'envoi', async () => {
    const { annoncerOuverture, envoiReel } = await import('@/lib/notifications')
    const http = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    const infos = vi.spyOn(console, 'info').mockImplementation(() => {})
    expect(envoiReel()).toBe(false)
    expect(await annoncerOuverture(ADMIN as never, { pause: 0 })).toEqual({ ok: false, code: 'hors_production' })
    expect((await db.query(`SELECT count(*)::int AS n FROM "InscriptionOuverture"`)).rows[0].n).toBe(1)
    expect((await db.query(`SELECT count(*)::int AS n FROM "Jeton"`)).rows[0].n).toBe(0)
    expect(http).not.toHaveBeenCalled()
    expect(infos).not.toHaveBeenCalled()
  })

  it('l\'essai reste possible, signale qu\'il n\'est pas réel (journal), sans rien écrire', async () => {
    const { envoyerEssaiOuverture } = await import('@/lib/notifications')
    const infos = vi.spyOn(console, 'info').mockImplementation(() => {})
    expect(await envoyerEssaiOuverture(ADMIN as never)).toEqual({ ok: true, reel: false })
    expect(infos).toHaveBeenCalledTimes(1)
    expect((await db.query(`SELECT count(*)::int AS n FROM "InscriptionOuverture"`)).rows[0].n).toBe(1)
    const { fr } = await import('@/lib/i18n')
    expect(fr.ouverture.essai.horsProduction).toBe('Essai non envoyé : hors production, rien ne part (le contenu est dans le journal).')
  })

  it('envoiReel : vrai seulement en production Vercel, comme le choix du prestataire', async () => {
    const { envoiReel } = await import('@/lib/notifications/choix')
    expect(envoiReel({ VERCEL_ENV: 'production' })).toBe(true)
    expect(envoiReel({ VERCEL_ENV: 'preview' })).toBe(false)
    expect(envoiReel({})).toBe(false)
  })
})
