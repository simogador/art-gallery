import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { normaliserEmail } from '@/lib/demandes/email'
import { LIMITES_INSCRIPTION_OUVERTURE } from '@/lib/reglages'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 1.9 (FR-35) : contacts de la page de maintenance.

const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as { type: string } }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => acteur.courant }))

describe('normaliserEmail', () => {
  it('normalise et refuse les adresses invalides', () => {
    expect(normaliserEmail('  Marie@Exemple.FR ')).toBe('marie@exemple.fr')
    expect(normaliserEmail('pas-une-adresse')).toBeNull()
    expect(normaliserEmail('a@b')).toBeNull()
    expect(normaliserEmail(42)).toBeNull()
    expect(normaliserEmail(`${'a'.repeat(250)}@exemple.fr`)).toBeNull()
    expect(normaliserEmail(`${'a'.repeat(65)}@exemple.fr`)).toBeNull()
    expect(normaliserEmail('a@b..fr')).toBeNull()
    expect(normaliserEmail('"x"@exemple.fr')).toBeNull()
    expect(normaliserEmail('a,b@exemple.fr')).toBeNull()
  })
})

describe('inscription à l’ouverture', () => {
  let base: BaseJetable
  let db: Client
  const inscrits = async () => (await db.query('SELECT email FROM "InscriptionOuverture" ORDER BY email')).rows

  beforeAll(async () => {
    base = await creerBaseJetable()
    // Le client Prisma de l'application lit DATABASE_URL à son premier import.
    process.env.DATABASE_URL = base.url
    db = new Client({ connectionString: base.url })
    await db.connect()
  })

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$disconnect()
    await db?.end()
    await base?.supprimer()
  })

  beforeEach(async () => {
    acteur.courant = { type: 'visiteur' }
    await db.query('DELETE FROM "InscriptionOuverture"')
    await db.query('DELETE FROM "TentativeInscription"')
  })

  it('enregistre l’e-mail et la date du consentement, sans doublon', async () => {
    const { inscrireOuverture } = await import('@/lib/demandes')
    expect(await inscrireOuverture({ email: 'Marie@Exemple.fr', consentement: true, ip: '1.1.1.1' })).toEqual({ ok: true })
    expect(await inscrireOuverture({ email: 'marie@exemple.fr ', consentement: true, ip: '2.2.2.2' })).toEqual({ ok: true })

    const { rows } = await db.query('SELECT email, "consentementLe" FROM "InscriptionOuverture"')
    expect(rows).toHaveLength(1)
    expect(rows[0].email).toBe('marie@exemple.fr')
    expect(rows[0].consentementLe).toBeInstanceOf(Date)
  })

  it('n’enregistre rien sans consentement ou avec un e-mail invalide', async () => {
    const { inscrireOuverture } = await import('@/lib/demandes')
    expect(await inscrireOuverture({ email: 'a@exemple.fr', consentement: false, ip: '1.1.1.1' })).toEqual({
      ok: false,
      code: 'consentement_manquant',
    })
    expect(await inscrireOuverture({ email: 'invalide', consentement: true, ip: '1.1.1.1' })).toEqual({
      ok: false,
      code: 'email_invalide',
    })
    expect(await inscrits()).toEqual([])
  })

  it('limite les envois par adresse IP', async () => {
    const { inscrireOuverture } = await import('@/lib/demandes')
    for (let i = 0; i < LIMITES_INSCRIPTION_OUVERTURE.parIp; i++) {
      await inscrireOuverture({ email: `p${i}@exemple.fr`, consentement: true, ip: '9.9.9.9' })
    }
    expect(await inscrireOuverture({ email: 'encore@exemple.fr', consentement: true, ip: '9.9.9.9' })).toEqual({
      ok: false,
      code: 'trop_de_demandes',
    })
    expect(await inscrireOuverture({ email: 'autre@exemple.fr', consentement: true, ip: '8.8.8.8' })).toEqual({ ok: true })
  })

  it('limite les envois pour un même e-mail, quelle que soit l’IP', async () => {
    const { inscrireOuverture } = await import('@/lib/demandes')
    for (let i = 0; i < LIMITES_INSCRIPTION_OUVERTURE.parEmail; i++) {
      await inscrireOuverture({ email: 'cible@exemple.fr', consentement: false, ip: `10.0.0.${i}` })
    }
    expect(await inscrireOuverture({ email: 'cible@exemple.fr', consentement: true, ip: '10.0.0.99' })).toEqual({
      ok: false,
      code: 'trop_de_demandes',
    })
  })

  it('compte les envois sans IP sous une clé commune', async () => {
    const { inscrireOuverture } = await import('@/lib/demandes')
    for (let i = 0; i < LIMITES_INSCRIPTION_OUVERTURE.parIp; i++) {
      await inscrireOuverture({ email: `n${i}@exemple.fr`, consentement: true, ip: null })
    }
    expect(await inscrireOuverture({ email: 'n-final@exemple.fr', consentement: true, ip: null })).toEqual({
      ok: false,
      code: 'trop_de_demandes',
    })
  })

  it('lève la limite une fois la fenêtre passée, et purge les anciennes traces', async () => {
    const { inscrireOuverture } = await import('@/lib/demandes')
    for (let i = 0; i < LIMITES_INSCRIPTION_OUVERTURE.parIp; i++) {
      await inscrireOuverture({ email: `f${i}@exemple.fr`, consentement: true, ip: '4.4.4.4' })
    }
    await db.query(`UPDATE "TentativeInscription" SET "createdAt" = now() - interval '2 hours'`)
    expect(await inscrireOuverture({ email: 'apres@exemple.fr', consentement: true, ip: '4.4.4.4' })).toEqual({ ok: true })
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM "TentativeInscription" WHERE "createdAt" < now() - interval '1 hour'`,
    )
    expect(rows[0].n).toBe(0)
  })

  it('ne stocke ni IP ni e-mail en clair dans les tentatives', async () => {
    const { inscrireOuverture } = await import('@/lib/demandes')
    await inscrireOuverture({ email: 'secret@exemple.fr', consentement: true, ip: '7.7.7.7' })
    const { rows } = await db.query('SELECT cle FROM "TentativeInscription"')
    expect(rows.length).toBe(2)
    for (const { cle } of rows) {
      expect(cle).toMatch(/^(ip|email):[0-9a-f]{64}$/)
      expect(cle).not.toContain('secret')
      expect(cle).not.toContain('7.7.7.7')
    }
  })

  describe('route POST /api/inscription-ouverture', () => {
    const envoyer = async (corps: string, entetes: Record<string, string> = {}) => {
      const { POST } = await import('@/app/api/inscription-ouverture/route')
      return POST(
        new Request('http://localhost/api/inscription-ouverture', {
          method: 'POST',
          headers: { host: 'localhost', 'x-forwarded-for': '5.5.5.5', ...entetes },
          body: corps,
        }) as never,
      )
    }

    it('répond par des messages clairs', async () => {
      const sansConsentement = await envoyer(JSON.stringify({ email: 'a@exemple.fr', consentement: false }))
      expect(sansConsentement.status).toBe(400)
      expect(await sansConsentement.json()).toMatchObject({ code: 'consentement_manquant' })

      const valide = await envoyer(JSON.stringify({ email: 'a@exemple.fr', consentement: true }))
      expect(valide.status).toBe(200)
      expect(await valide.json()).toMatchObject({ ok: true })
    })

    it('refuse un corps invalide ou un envoi depuis un autre site', async () => {
      for (const corps of ['pas du json', 'null', '[]']) {
        const reponse = await envoyer(corps)
        expect(reponse.status).toBe(400)
        expect(await reponse.json()).toMatchObject({ code: 'requete_invalide' })
      }
      const ailleurs = await envoyer(JSON.stringify({ email: 'b@exemple.fr', consentement: true }), {
        origin: 'https://autre-site.exemple',
      })
      expect(ailleurs.status).toBe(403)
      expect(await inscrits()).toEqual([])
    })

    it('ne journalise jamais l’e-mail, même en cas d’erreur', async () => {
      const { prisma } = await import('@/lib/prisma')
      const panne = vi
        .spyOn(prisma.tentativeInscription, 'count')
        .mockRejectedValueOnce(new Error('échec pour journal@exemple.fr'))
      const journal = vi.spyOn(console, 'error').mockImplementation(() => {})

      const reponse = await envoyer(JSON.stringify({ email: 'journal@exemple.fr', consentement: true }))
      expect(reponse.status).toBe(503)
      expect(journal).toHaveBeenCalled()
      for (const appel of journal.mock.calls) expect(JSON.stringify(appel)).not.toContain('journal@exemple.fr')

      journal.mockRestore()
      panne.mockRestore()
    })
  })

  describe('export des inscrits', () => {
    it('n’exporte la liste qu’aux admins, en CSV lisible par Excel', async () => {
      const { inscrireOuverture } = await import('@/lib/demandes')
      await inscrireOuverture({ email: 'export@exemple.fr', consentement: true, ip: '6.6.6.6' })
      const { GET } = await import('@/app/api/admin/inscriptions-ouverture/route')

      acteur.courant = { type: 'user' }
      expect((await GET()).status).toBe(403)

      acteur.courant = { type: 'admin' }
      const reponse = await GET()
      expect(reponse.status).toBe(200)
      expect(reponse.headers.get('content-type')).toContain('text/csv')
      const octets = new Uint8Array(await reponse.arrayBuffer())
      expect([...octets.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]) // BOM UTF-8 (text() l'enlèverait)
      const csv = new TextDecoder().decode(octets)
      expect(csv.startsWith('email,consentement_le\r\n')).toBe(true)
      expect(csv).toContain('"export@exemple.fr","')
      expect(csv.endsWith('\r\n')).toBe(true)
    })

    it('neutralise une formule de tableur', async () => {
      await db.query(`INSERT INTO "InscriptionOuverture" (id, email, "consentementLe") VALUES ('f', '-2+3@exemple.fr', now())`)
      const { GET } = await import('@/app/api/admin/inscriptions-ouverture/route')
      acteur.courant = { type: 'admin' }
      expect(await (await GET()).text()).toContain(`"'-2+3@exemple.fr"`)
    })
  })
})
