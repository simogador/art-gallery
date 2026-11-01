import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CODES_PAYS, estCodePays, nomPays, paysSansZone } from '@/lib/livraison/pays'
import { messageRefusZone } from '@/lib/livraison/messages'
import { SectionExpedition } from '@/app/dashboard/artiste/oeuvres/nouvelle/SectionExpedition'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 2.3 (AD-12, OQ-5) : zones de livraison gérées par l'équipe.

const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as Record<string, unknown> }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => acteur.courant }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirection:${url}`)
  },
  notFound: () => {
    throw new Error('introuvable')
  },
}))

const SQL_ZONES_DEPART = readFileSync(path.resolve('scripts/sql/zones-depart.sql'), 'utf8')

const ADMIN = { type: 'admin', userId: 'admin' } as const
const ARTISTE = { type: 'artist', userId: 'u-artiste', artiste: { id: 'artiste-1', slug: 'artiste-1', name: 'Artiste Un' } } as const
const UE = 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'.split(' ')
const HORS_UE = 'GB CH LI NO IS AD MC SM VA AL BA ME MK RS XK MD UA GI FO JE GG IM TR'.split(' ')

describe('pays', () => {
  it('249 codes ISO 3166-1 alpha-2 plus XK, sans doublon, noms en français', () => {
    expect(CODES_PAYS).toHaveLength(250)
    expect(new Set(CODES_PAYS).size).toBe(250)
    expect(estCodePays('MA')).toBe(true)
    expect(estCodePays('ZZ')).toBe(false)
    expect(estCodePays('ma')).toBe(false)
    expect(nomPays('MA')).toBe('Maroc')
    expect(nomPays('DE')).toBe('Allemagne')
  })

  it('« Cocher tous les pays sans zone » : ni les pays des autres zones, ni ceux déjà cochés', () => {
    const ajout = paysSansZone({ FR: 'Union européenne', DE: 'Union européenne' }, new Set(['MA']))
    expect(ajout).toHaveLength(247)
    for (const c of ['FR', 'DE', 'MA']) expect(ajout).not.toContain(c)
    expect(ajout).toContain('RU')
    expect(paysSansZone({}, new Set(CODES_PAYS))).toEqual([])
  })

  it('messages de refus', () => {
    expect(messageRefusZone({ ok: false, code: 'zone_utilisee', offres: 1 })).toBe(
      'Cette zone est utilisée par 1 offre de livraison : elle ne peut pas être supprimée.',
    )
    expect(messageRefusZone({ ok: false, code: 'zone_utilisee', offres: 3 })).toContain('3 offres')
    expect(messageRefusZone({ ok: false, code: 'pays_deja_pris', pays: [{ code: 'FR', zone: 'Union européenne' }] })).toContain(
      'France (Union européenne)',
    )
  })
})

describe('section Expédition du dépôt', () => {
  it('sans zone : explique que les zones ne sont pas encore ouvertes, sans liste vide', () => {
    const html = renderToStaticMarkup(createElement(SectionExpedition, { zones: [] }))
    expect(html).toContain('Les zones de livraison ne sont pas encore ouvertes')
    expect(html).not.toContain('<ul')
  })

  it('avec des zones : les liste', () => {
    const html = renderToStaticMarkup(createElement(SectionExpedition, { zones: ['Maroc', 'Union européenne'] }))
    expect(html).toContain('Maroc')
    expect(html).toContain('Union européenne')
    expect(html).not.toContain('pas encore ouvertes')
  })
})

// Premier élément de l'arbre rendu dont le type est `type`.
function trouverElement(n: ReactNode, type: unknown): ReactElement | null {
  if (!isValidElement(n)) {
    if (!Array.isArray(n)) return null
    for (const enfant of n) {
      const r = trouverElement(enfant, type)
      if (r) return r
    }
    return null
  }
  if (n.type === type) return n
  return trouverElement((n.props as { children?: ReactNode }).children, type)
}

describe('base : zones de livraison', () => {
  let base: BaseJetable
  let db: Client

  const zones = async () =>
    (
      await db.query(
        `SELECT z.nom, array_agg(p."codePays" ORDER BY p."codePays") FILTER (WHERE p."codePays" IS NOT NULL) AS pays
         FROM "Zone" z LEFT JOIN "ZonePays" p ON p."zoneId" = z.id GROUP BY z.nom, z."createdAt" ORDER BY z."createdAt"`,
      )
    ).rows.map((r) => ({ nom: r.nom as string, pays: (r.pays ?? []) as string[] }))

  async function offre(zoneId: string) {
    await db.query(
      `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", "fraisCentimes", "preparationJours", "transportMinJours", "transportMaxJours", "updatedAt")
       VALUES (gen_random_uuid()::text, 'oeuvre-1', $1, 4500, 3, 5, 10, now())`,
      [zoneId],
    )
  }

  beforeAll(async () => {
    base = await creerBaseJetable()
    process.env.DATABASE_URL = base.url
    db = new Client({ connectionString: base.url })
    await db.connect()
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt")
       VALUES ('artiste-1', 'artiste-1', 'Artiste Un', 'MA', 1980, 'Bio', '', now())`,
    )
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, dimensions, description, "imageUrl", "artistId", "updatedAt")
       VALUES ('oeuvre-1', 'oeuvre-1', 'Titre', 2020, 'Huile', '10 × 10 cm', 'Description', '', 'artiste-1', now())`,
    )
  })

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$disconnect()
    await db?.end()
    await base?.supprimer()
  })

  beforeEach(async () => {
    acteur.courant = { type: 'visiteur' }
    await db.query('DELETE FROM "OffreLivraison"')
    await db.query('DELETE FROM "Zone"')
  })

  it('création par un admin ; pays enregistrés et lus triés par nom', async () => {
    const { creerZone, listerZones } = await import('@/lib/livraison')
    const r = await creerZone(ADMIN, { nom: '  Union   européenne ', pays: ['fr', 'DE', 'ES', 'DE'] })
    expect(r.ok).toBe(true)
    expect(await listerZones()).toEqual([
      { id: expect.any(String), nom: 'Union européenne', pays: ['DE', 'ES', 'FR'], offres: 0 },
    ])
  })

  it('hors admin : rien n’est écrit', async () => {
    const { creerZone, modifierZone, supprimerZone } = await import('@/lib/livraison')
    for (const a of [ARTISTE, { type: 'visiteur' } as const, { type: 'user', userId: 'u' } as const]) {
      expect(await creerZone(a, { nom: 'Maroc', pays: ['MA'] })).toEqual({ ok: false, code: 'acces_refuse' })
    }
    const cree = await creerZone(ADMIN, { nom: 'Maroc', pays: ['MA'] })
    if (!cree.ok) throw new Error('création')
    expect(await modifierZone(ARTISTE, cree.id, { nom: 'Autre', pays: [] })).toEqual({ ok: false, code: 'acces_refuse' })
    expect(await supprimerZone(ARTISTE, cree.id)).toEqual({ ok: false, code: 'acces_refuse' })
    expect(await zones()).toEqual([{ nom: 'Maroc', pays: ['MA'] }])
  })

  it('nom vide, trop long ou déjà pris (casse ignorée)', async () => {
    const { creerZone, modifierZone } = await import('@/lib/livraison')
    expect(await creerZone(ADMIN, { nom: '   ', pays: [] })).toEqual({ ok: false, code: 'nom_invalide' })
    expect(await creerZone(ADMIN, { nom: 'x'.repeat(61), pays: [] })).toEqual({ ok: false, code: 'nom_invalide' })
    await creerZone(ADMIN, { nom: 'Maroc', pays: ['MA'] })
    expect(await creerZone(ADMIN, { nom: 'maroc', pays: [] })).toEqual({ ok: false, code: 'nom_pris' })
    const autre = await creerZone(ADMIN, { nom: 'Europe', pays: [] })
    if (!autre.ok) throw new Error('création')
    expect(await modifierZone(ADMIN, autre.id, { nom: 'MAROC', pays: [] })).toEqual({ ok: false, code: 'nom_pris' })
    // Garder son propre nom (casse changée) est permis.
    expect((await modifierZone(ADMIN, autre.id, { nom: 'EUROPE', pays: [] })).ok).toBe(true)
  })

  it('pays inconnu', async () => {
    const { creerZone } = await import('@/lib/livraison')
    expect(await creerZone(ADMIN, { nom: 'Test', pays: ['MA', 'ZZ'] })).toEqual({
      ok: false,
      code: 'pays_inconnu',
      pays: ['ZZ'],
    })
    expect(await zones()).toEqual([])
  })

  it('pays d’une autre zone : refusé, avec le nom de cette zone', async () => {
    const { creerZone, modifierZone } = await import('@/lib/livraison')
    await creerZone(ADMIN, { nom: 'Union européenne', pays: ['FR', 'DE'] })
    const r = await creerZone(ADMIN, { nom: 'Europe hors UE', pays: ['GB', 'FR'] })
    expect(r).toEqual({ ok: false, code: 'pays_deja_pris', pays: [{ code: 'FR', zone: 'Union européenne' }] })
    if (r.ok) throw new Error('refus attendu')
    expect(messageRefusZone(r)).toContain('France (Union européenne)')
    const hors = await creerZone(ADMIN, { nom: 'Europe hors UE', pays: ['GB'] })
    if (!hors.ok) throw new Error('création')
    expect((await modifierZone(ADMIN, hors.id, { nom: 'Europe hors UE', pays: ['GB', 'DE'] })).ok).toBe(false)
    expect(await zones()).toEqual([
      { nom: 'Union européenne', pays: ['DE', 'FR'] },
      { nom: 'Europe hors UE', pays: ['GB'] },
    ])
  })

  it('un pays appartient au plus à une zone, même hors application (clé primaire)', async () => {
    const { creerZone } = await import('@/lib/livraison')
    const a = await creerZone(ADMIN, { nom: 'A', pays: ['MA'] })
    const b = await creerZone(ADMIN, { nom: 'B', pays: [] })
    if (!a.ok || !b.ok) throw new Error('création')
    await expect(db.query(`INSERT INTO "ZonePays" ("codePays", "zoneId") VALUES ('MA', $1)`, [b.id])).rejects.toThrow()
  })

  it('modification : nom et liste de pays remplacés', async () => {
    const { creerZone, modifierZone, lireZone } = await import('@/lib/livraison')
    const r = await creerZone(ADMIN, { nom: 'Amerique', pays: ['US', 'MX'] })
    if (!r.ok) throw new Error('création')
    expect(await modifierZone(ADMIN, r.id, { nom: 'Amérique du Nord', pays: ['US', 'CA'] })).toEqual({ ok: true, id: r.id })
    expect(await lireZone(r.id)).toEqual({ id: r.id, nom: 'Amérique du Nord', pays: ['CA', 'US'], offres: 0 })
    expect(await modifierZone(ADMIN, 'inconnue', { nom: 'X', pays: [] })).toEqual({ ok: false, code: 'introuvable' })
  })

  it('suppression d’une zone sans offre : ses pays redeviennent libres', async () => {
    const { creerZone, supprimerZone } = await import('@/lib/livraison')
    const r = await creerZone(ADMIN, { nom: 'Maroc', pays: ['MA'] })
    if (!r.ok) throw new Error('création')
    expect(await supprimerZone(ADMIN, r.id)).toEqual({ ok: true, id: r.id })
    expect(await zones()).toEqual([])
    expect((await db.query('SELECT count(*)::int AS n FROM "ZonePays"')).rows[0].n).toBe(0)
    expect(await supprimerZone(ADMIN, r.id)).toEqual({ ok: false, code: 'introuvable' })
  })

  it('suppression refusée quand une offre utilise la zone, et refusée aussi en SQL (RESTRICT)', async () => {
    const { creerZone, supprimerZone, listerZones } = await import('@/lib/livraison')
    const r = await creerZone(ADMIN, { nom: 'Maroc', pays: ['MA'] })
    if (!r.ok) throw new Error('création')
    await offre(r.id)
    const refus = await supprimerZone(ADMIN, r.id)
    expect(refus).toEqual({ ok: false, code: 'zone_utilisee', offres: 1 })
    if (refus.ok) throw new Error('refus attendu')
    expect(messageRefusZone(refus)).toBe('Cette zone est utilisée par 1 offre de livraison : elle ne peut pas être supprimée.')
    expect((await listerZones())[0].offres).toBe(1)
    await expect(db.query('DELETE FROM "Zone" WHERE id = $1', [r.id])).rejects.toThrow(/foreign key|violates/)
    expect(await zones()).toEqual([{ nom: 'Maroc', pays: ['MA'] }])
  })

  it('écritures concurrentes : la violation d’unicité est traduite selon la table (Prisma 7, adaptateur pg)', async () => {
    const { creerZone, refusSurConflit } = await import('@/lib/livraison')
    const { prisma } = await import('@/lib/prisma')
    const r = await creerZone(ADMIN, { nom: 'Maroc', pays: ['MA'] })
    if (!r.ok) throw new Error('création')
    const erreur = async (f: () => Promise<unknown>) => {
      try {
        await f()
      } catch (e) {
        return e
      }
      throw new Error('erreur attendue')
    }
    expect(refusSurConflit(await erreur(() => prisma.zone.create({ data: { nom: 'Maroc' } })))).toEqual({
      ok: false,
      code: 'nom_pris',
    })
    expect(
      refusSurConflit(await erreur(() => prisma.zonePays.create({ data: { codePays: 'MA', zoneId: r.id } }))),
    ).toEqual({ ok: false, code: 'pays_deja_pris', pays: [] })
    expect(refusSurConflit(new Error('autre'))).toBeNull()
  })

  it('pays pris par une autre zone pendant l’enregistrement : refus, jamais un succès sans le pays', async () => {
    const { creerZone, modifierZone } = await import('@/lib/livraison')
    const { prisma } = await import('@/lib/prisma')
    const a = await creerZone(ADMIN, { nom: 'A', pays: [] })
    const b = await creerZone(ADMIN, { nom: 'B', pays: [] })
    if (!a.ok || !b.ok) throw new Error('création')
    // Simule l'autre admin : la vérification ne voit rien, puis le pays est pris avant l'insertion.
    const original = prisma.$transaction.bind(prisma)
    const espion = vi.spyOn(prisma, '$transaction').mockImplementationOnce((async (f: (tx: unknown) => unknown) =>
      original(async (tx) => {
        const findMany = tx.zonePays.findMany.bind(tx.zonePays)
        let premier = true
        ;(tx.zonePays as { findMany: unknown }).findMany = async (args: unknown) => {
          if (premier) {
            premier = false
            await db.query(`INSERT INTO "ZonePays" ("codePays", "zoneId") VALUES ('TN', $1)`, [b.id])
            return []
          }
          return findMany(args as never)
        }
        return f(tx)
      })) as never)
    expect(await modifierZone(ADMIN, a.id, { nom: 'A', pays: ['TN'] })).toEqual({ ok: false, code: 'pays_deja_pris', pays: [] })
    espion.mockRestore()
    expect(await zones()).toEqual([
      { nom: 'A', pays: [] },
      { nom: 'B', pays: ['TN'] },
    ])
  })

  describe('pages de l’écran', () => {
    it('réservées à l’admin', async () => {
      const { default: Liste } = await import('@/app/dashboard/admin/zones/page')
      const { default: Nouvelle } = await import('@/app/dashboard/admin/zones/nouvelle/page')
      const { default: Zone } = await import('@/app/dashboard/admin/zones/[id]/page')
      for (const a of [ARTISTE, { type: 'visiteur' }, { type: 'user', userId: 'u' }]) {
        acteur.courant = a
        await expect(Liste()).rejects.toThrow('redirection:/dashboard')
        await expect(Nouvelle()).rejects.toThrow('redirection:/dashboard')
        await expect(Zone({ params: { id: 'x' } })).rejects.toThrow('redirection:/dashboard')
      }
      acteur.courant = ADMIN
      await expect(Zone({ params: { id: 'inconnue' } })).rejects.toThrow('introuvable')
    })

    it('modification : les pays de la zone restent cochables, ceux des autres zones sont grisés avec leur nom', async () => {
      const { creerZone } = await import('@/lib/livraison')
      const { default: Zone } = await import('@/app/dashboard/admin/zones/[id]/page')
      // Import dynamique : ZoneForm charge les actions, donc Prisma, après le choix de la base jetable.
      const { ZoneForm } = await import('@/app/dashboard/admin/zones/ZoneForm')
      const ue = await creerZone(ADMIN, { nom: 'Union européenne', pays: ['FR', 'DE'] })
      await creerZone(ADMIN, { nom: 'Maroc', pays: ['MA'] })
      if (!ue.ok) throw new Error('création')
      acteur.courant = ADMIN
      const form = trouverElement(await Zone({ params: { id: ue.id } }), ZoneForm)
      if (!form) throw new Error('formulaire absent')
      const props = form.props as { zone: { pays: string[] }; autresZones: Record<string, string>; listePays: { code: string }[] }
      expect(props.zone.pays).toEqual(['DE', 'FR'])
      expect(props.autresZones).toEqual({ MA: 'Maroc' })
      expect(props.listePays).toHaveLength(CODES_PAYS.length)
      expect(props.listePays.find((p) => p.code === 'MA')).toEqual({ code: 'MA', nom: 'Maroc' })
    })
  })

  describe('actions serveur de l’écran', () => {
    const formulaire = (nom: string, pays: string[]) => {
      const f = new FormData()
      f.set('nom', nom)
      for (const p of pays) f.append('pays', p)
      return f
    }

    it('création par un admin puis retour à la liste ; refus traduit hors admin', async () => {
      const { actionCreerZone } = await import('@/app/dashboard/admin/zones/actions')
      acteur.courant = ARTISTE
      expect(await actionCreerZone(null, formulaire('Maroc', ['MA']))).toEqual({
        ok: false,
        message: 'Seule l’équipe Errancy peut modifier les zones de livraison.',
      })
      acteur.courant = ADMIN
      await expect(actionCreerZone(null, formulaire('Maroc', ['MA']))).rejects.toThrow('redirection:/dashboard/admin/zones')
      expect(await zones()).toEqual([{ nom: 'Maroc', pays: ['MA'] }])
    })

    it('modification et suppression', async () => {
      const { creerZone } = await import('@/lib/livraison')
      const { actionModifierZone, actionSupprimerZone } = await import('@/app/dashboard/admin/zones/actions')
      const r = await creerZone(ADMIN, { nom: 'Maroc', pays: ['MA'] })
      if (!r.ok) throw new Error('création')
      acteur.courant = ADMIN
      expect(await actionModifierZone(r.id, null, formulaire('Maghreb', ['MA', 'TN']))).toEqual({
        ok: true,
        message: 'Zone enregistrée.',
      })
      await offre(r.id)
      expect(await actionSupprimerZone(r.id, null)).toEqual({
        ok: false,
        message: 'Cette zone est utilisée par 1 offre de livraison : elle ne peut pas être supprimée.',
      })
      await db.query('DELETE FROM "OffreLivraison"')
      await expect(actionSupprimerZone(r.id, null)).rejects.toThrow('redirection:/dashboard/admin/zones')
      expect(await zones()).toEqual([])
    })
  })

  it('le dépôt montre les zones aussitôt enregistrées', async () => {
    const { creerZone } = await import('@/lib/livraison')
    const { default: Page } = await import('@/app/dashboard/artiste/oeuvres/nouvelle/page')
    await db.query(`UPDATE "Artist" SET "userId" = NULL`)
    await db.query(`INSERT INTO "User" (id, email, role, "updatedAt") VALUES ('u-artiste', 'a@exemple.test', 'artist', now()) ON CONFLICT DO NOTHING`)
    await db.query(`UPDATE "Artist" SET "userId" = 'u-artiste' WHERE id = 'artiste-1'`)
    acteur.courant = ARTISTE

    const section = async () => {
      const el = trouverElement(await Page(), SectionExpedition)
      if (!el) throw new Error('section Expédition absente')
      return renderToStaticMarkup(el)
    }

    expect(await section()).toContain('pas encore ouvertes')
    await creerZone(ADMIN, { nom: 'Maroc', pays: ['MA'] })
    expect(await section()).toContain('Maroc')
  })

  it('zones-depart.sql, lancé deux fois : cinq zones selon la liste validée, RU et BY sans zone', async () => {
    await db.query(SQL_ZONES_DEPART)
    await db.query(SQL_ZONES_DEPART)
    const lues = await zones()
    expect(lues.map((z) => z.nom)).toEqual(['Maroc', 'Union européenne', 'Europe hors UE', 'Amérique du Nord', 'Reste du monde'])
    const par = Object.fromEntries(lues.map((z) => [z.nom, z.pays]))
    expect(par['Maroc']).toEqual(['MA'])
    expect(par['Union européenne']).toEqual([...UE].sort())
    expect(par['Europe hors UE']).toEqual([...HORS_UE].sort())
    expect(par['Amérique du Nord']).toEqual(['CA', 'US'])
    const reste = new Set(par['Reste du monde'])
    for (const c of ['GP', 'MQ', 'GF', 'RE', 'YT', 'MX', 'PR', 'VI', 'GU', 'CN', 'BR']) expect(reste.has(c), c).toBe(true)
    const attribues = lues.flatMap((z) => z.pays)
    expect(new Set(attribues).size).toBe(attribues.length)
    expect(attribues.sort()).toEqual(CODES_PAYS.filter((c) => c !== 'RU' && c !== 'BY').sort())

    // Relancé après des modifications dans l'administration : ne fait rien.
    await db.query(`UPDATE "Zone" SET nom = 'Maghreb' WHERE nom = 'Maroc'`)
    await db.query(`DELETE FROM "ZonePays" WHERE "codePays" = 'TR'`)
    await db.query(SQL_ZONES_DEPART)
    const apres = await zones()
    expect(apres.map((z) => z.nom)).toEqual(['Maghreb', 'Union européenne', 'Europe hors UE', 'Amérique du Nord', 'Reste du monde'])
    expect(apres.flatMap((z) => z.pays)).not.toContain('TR')
  })
})
