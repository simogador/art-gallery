import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CODES_PAYS, estCodePays, nomPays, paysSansZone } from '@/lib/livraison/pays'
import { messageRefusZone } from '@/lib/livraison/messages'
import { calculerPrixLivre, comparerPrixLivre, cookiePays, lirePays, totalLivre, type OffreAPrix } from '@/lib/livraison/prix'
import { formaterMontant, fr } from '@/lib/i18n'
import { PaysLivraison } from '@/components/ui/PaysLivraison'
import { SectionExpedition } from '@/app/dashboard/artiste/oeuvres/depot/SectionExpedition'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 2.3 (AD-12, OQ-5) : zones de livraison gérées par l'équipe.

const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as Record<string, unknown> }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => acteur.courant }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
// Story 3.4 : unstable_cache en passe-plat (pas de cache dans les tests), revalidateTag espionné.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
// Story 3.3 : cookie `pays` lu par la fiche et la galerie, posé par l'action du choix du pays.
const jar = vi.hoisted(() => ({ valeurs: new Map<string, string>(), poses: [] as unknown[] }))
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (nom: string) => (jar.valeurs.has(nom) ? { name: nom, value: jar.valeurs.get(nom) } : undefined),
    set: (c: unknown) => jar.poses.push(c),
  }),
  headers: () => new Headers(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
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
  const rien = () => undefined
  const props = (zones: { id: string; nom: string }[], repriseDisponible = false) => ({
    zones, saisies: {}, erreurs: {}, repriseDisponible, onSaisie: rien, onSortie: rien, onNonLivree: rien, onReprendre: rien,
  })

  it('sans zone : explique que les zones ne sont pas encore ouvertes, sans liste vide', () => {
    const html = renderToStaticMarkup(createElement(SectionExpedition, props([])))
    expect(html).toContain('Les zones de livraison ne sont pas encore ouvertes')
    expect(html).not.toContain('<ul')
  })

  it('avec des zones : frais, délais et « Je ne livre pas » par zone, libellés reliés', () => {
    const html = renderToStaticMarkup(createElement(SectionExpedition, props([{ id: 'z1', nom: 'Maroc' }, { id: 'z2', nom: 'Union européenne' }])))
    expect(html).toContain('Maroc')
    expect(html).toContain('Union européenne')
    expect(html).not.toContain('pas encore ouvertes')
    expect(html.match(/Je ne livre pas cette zone/g)).toHaveLength(2)
    for (const id of ['depot-zone-z1-frais', 'depot-zone-z1-preparation', 'depot-zone-z1-transportMin', 'depot-zone-z1-transportMax', 'depot-zone-z2-nonLivree']) {
      expect(html).toContain(`for="${id}"`)
      expect(html).toContain(`id="${id}"`)
    }
    expect(html).not.toMatch(/gratuit|garantie/i)
  })

  it('« Reprendre les zones de ma dernière œuvre » seulement si une autre œuvre a des offres', () => {
    const zones = [{ id: 'z1', nom: 'Maroc' }]
    expect(renderToStaticMarkup(createElement(SectionExpedition, props(zones)))).not.toContain('Reprendre')
    expect(renderToStaticMarkup(createElement(SectionExpedition, props(zones, true)))).toContain('Reprendre les zones de ma dernière œuvre')
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
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "artistId", "updatedAt")
       VALUES ('oeuvre-1', 'oeuvre-1', 'Titre', 2020, 'Huile', 'Description', '', 'artiste-1', now())`,
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

  describe('offres d’une œuvre (story 2.6)', () => {
    const inserer = (valeurs: string) =>
      db.query(
        `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", livree, "fraisCentimes", "preparationJours", "transportMinJours", "transportMaxJours", devise, "updatedAt")
         SELECT gen_random_uuid()::text, 'oeuvre-1', id, ${valeurs}, now() FROM "Zone" LIMIT 1`,
      )

    it('contraintes CHECK en base : frais et délais positifs, min ≤ max, devise ISO, valeurs présentes si livrée', async () => {
      const { creerZone } = await import('@/lib/livraison')
      await creerZone(ADMIN, { nom: 'Maroc', pays: ['MA'] })
      for (const [valeurs, contrainte] of [
        [`true, -1, 3, 2, 5, 'EUR'`, 'OffreLivraison_frais_positifs'],
        [`true, 2500, -1, 2, 5, 'EUR'`, 'OffreLivraison_delais_positifs'],
        [`true, 2500, 3, 6, 5, 'EUR'`, 'OffreLivraison_transport_ordonne'],
        [`true, 2500, 3, 2, 5, 'euro'`, 'OffreLivraison_devise_iso'],
        [`true, NULL, 3, 2, 5, 'EUR'`, 'OffreLivraison_livree_complete'],
        [`true, 2500, 3, NULL, 5, 'EUR'`, 'OffreLivraison_livree_complete'],
        [`false, 2500, NULL, NULL, NULL, 'EUR'`, 'OffreLivraison_non_livree_vide'],
        [`false, NULL, NULL, 2, 5, 'EUR'`, 'OffreLivraison_non_livree_vide'],
      ] as const) {
        await expect(inserer(valeurs), contrainte).rejects.toMatchObject({ constraint: contrainte })
      }
      await inserer(`false, NULL, NULL, NULL, NULL, 'EUR'`)
      await db.query('DELETE FROM "OffreLivraison"')
      await inserer(`true, 0, 0, 2, 2, 'EUR'`)
      expect((await db.query('SELECT count(*)::int AS n FROM "OffreLivraison"')).rows[0].n).toBe(1)
    })

    it('enregistrerOffre, offresDeLOeuvre et recopierOffres', async () => {
      const { creerZone, enregistrerOffre, offresDeLOeuvre, recopierOffres, derniereOeuvreAvecOffres } = await import('@/lib/livraison')
      const { prisma } = await import('@/lib/prisma')
      const maroc = await creerZone(ADMIN, { nom: 'Maroc', pays: ['MA'] })
      const monde = await creerZone(ADMIN, { nom: 'Reste du monde', pays: ['US'] })
      if (!maroc.ok || !monde.ok) throw new Error('zones')
      await db.query(
        `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "artistId", "updatedAt")
         VALUES ('oeuvre-2', 'oeuvre-2', 'Titre 2', 2021, 'Huile', 'D', '', 'artiste-1', now()) ON CONFLICT DO NOTHING`,
      )
      const livree = { livree: true, fraisCentimes: 2500, preparationJours: 3, transportMinJours: 2, transportMaxJours: 5 }
      expect(await enregistrerOffre(prisma, 'oeuvre-1', maroc.id, livree)).toBe(true)
      // Non livrée : frais et délais vides, quelles que soient les valeurs transmises.
      expect(await enregistrerOffre(prisma, 'oeuvre-1', monde.id, { ...livree, livree: false })).toBe(true)
      expect(await enregistrerOffre(prisma, 'oeuvre-1', 'zone-inconnue', livree)).toBe(false)
      expect(await offresDeLOeuvre(prisma, 'oeuvre-1')).toEqual([
        { zoneId: maroc.id, ...livree },
        { zoneId: monde.id, livree: false, fraisCentimes: null, preparationJours: null, transportMinJours: null, transportMaxJours: null },
      ])
      expect(await derniereOeuvreAvecOffres(prisma, 'artiste-1', 'oeuvre-2')).toBe('oeuvre-1')
      expect(await derniereOeuvreAvecOffres(prisma, 'artiste-1', 'oeuvre-1')).toBeNull()
      expect(await recopierOffres(prisma, 'oeuvre-1', 'oeuvre-2')).toBe(2)
      expect(await offresDeLOeuvre(prisma, 'oeuvre-2')).toEqual(await offresDeLOeuvre(prisma, 'oeuvre-1'))
      // null retire l'offre.
      await enregistrerOffre(prisma, 'oeuvre-2', maroc.id, null)
      expect((await offresDeLOeuvre(prisma, 'oeuvre-2')).map((o) => o.zoneId)).toEqual([monde.id])
      await db.query(`DELETE FROM "Artwork" WHERE id = 'oeuvre-2'`)
    })

    it('derniereOeuvreAvecOffres : la plus récente de deux œuvres aux offres différentes', async () => {
      const { creerZone, enregistrerOffre, offresDeLOeuvre, recopierOffres, derniereOeuvreAvecOffres } = await import('@/lib/livraison')
      const { prisma } = await import('@/lib/prisma')
      const maroc = await creerZone(ADMIN, { nom: 'Maroc', pays: ['MA'] })
      if (!maroc.ok) throw new Error('zone')
      for (const [id, decalage] of [['ancienne', '-2 days'], ['recente', '-1 day'], ['cible', '0 day']] as const) {
        await db.query(
          `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "artistId", "createdAt", "updatedAt")
           VALUES ($1, $1, $1, 2021, 'Huile', 'D', '', 'artiste-1', now() + $2::interval, now())`,
          [id, decalage],
        )
      }
      const offre = (frais: number) => ({ livree: true, fraisCentimes: frais, preparationJours: 3, transportMinJours: 2, transportMaxJours: 5 })
      await enregistrerOffre(prisma, 'ancienne', maroc.id, offre(1000))
      await enregistrerOffre(prisma, 'recente', maroc.id, offre(2000))
      expect(await derniereOeuvreAvecOffres(prisma, 'artiste-1', 'cible')).toBe('recente')
      expect(await derniereOeuvreAvecOffres(prisma, 'artiste-1', 'recente')).toBe('ancienne')
      await recopierOffres(prisma, 'recente', 'cible')
      expect((await offresDeLOeuvre(prisma, 'cible'))[0].fraisCentimes).toBe(2000)
      await db.query(`DELETE FROM "Artwork" WHERE id IN ('ancienne', 'recente', 'cible')`)
    })
  })

  it('le dépôt montre les zones aussitôt enregistrées', async () => {
    const { creerZone } = await import('@/lib/livraison')
    const { default: Page } = await import('@/app/dashboard/artiste/oeuvres/nouvelle/page')
    await db.query(`UPDATE "Artist" SET "userId" = NULL`)
    await db.query(`INSERT INTO "User" (id, email, role, "updatedAt") VALUES ('u-artiste', 'a@exemple.test', 'artist', now()) ON CONFLICT DO NOTHING`)
    await db.query(`UPDATE "Artist" SET "userId" = 'u-artiste' WHERE id = 'artiste-1'`)
    acteur.courant = ARTISTE

    // Story 2.5 : la page rend PageDepot, qui passe les zones au formulaire de dépôt (2.6 : saisie par zone).
    const { PageDepot } = await import('@/app/dashboard/artiste/oeuvres/depot/PageDepot')
    const { FormulaireDepot } = await import('@/app/dashboard/artiste/oeuvres/depot/FormulaireDepot')
    const section = async () => {
      const page = await Page()
      const formulaire = trouverElement(PageDepot(page.props as Parameters<typeof PageDepot>[0]), FormulaireDepot)
      if (!formulaire) throw new Error('formulaire de dépôt absent')
      return renderToStaticMarkup(formulaire)
    }

    expect(await section()).toContain('pas encore ouvertes')
    const maroc = await creerZone(ADMIN, { nom: 'Maroc', pays: ['MA'] })
    expect(await section()).toContain('Maroc')

    // Story 2.6 : « Reprendre les zones de ma dernière œuvre » seulement si une autre œuvre a des offres.
    expect(await section()).not.toContain('Reprendre les zones de ma dernière œuvre')
    if (!maroc.ok) throw new Error('zone')
    await offre(maroc.id)
    expect(await section()).toContain('Reprendre les zones de ma dernière œuvre')
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

  describe('base : prix livré (story 3.3)', () => {
    const F = '\u202f'

    async function oeuvre(slug: string, prixCentimes: number | null, publication = 'publiee', devise = 'EUR') {
      await db.query(
        `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", devise, "hauteurMm", "largeurMm",
           publication, disponibilite, "artistId", "updatedAt")
         VALUES ($1, $1, $1, 2024, 'Huile sur toile', 'Description', '', $2, $3, 610, 760, $4::"Publication", 'disponible', 'artiste-prix', now())`,
        [slug, prixCentimes, devise, publication],
      )
    }
    async function offre(slug: string, zoneId: string, valeurs: string) {
      await db.query(
        `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", livree, "fraisCentimes", "preparationJours", "transportMinJours", "transportMaxJours", devise, "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, ${valeurs}, now())`,
        [slug, zoneId],
      )
    }

    // Imbriqué dans « base : zones de livraison » (même base jetable, un seul client Prisma) : le
    // beforeEach parent vide zones et offres, recréées ici avant chaque test.
    beforeAll(async () => {
      await db.query(
        `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "accordSigneLe", "updatedAt")
         VALUES ('artiste-prix', 'artiste-prix', 'Artiste Prix', 'MA', 1980, 'Bio', '', now(), now())`,
      )
      await oeuvre('livree', 145000)
      await oeuvre('moins-chere', 50000)
      await oeuvre('sans-prix', null)
      await oeuvre('autre-devise', 80000)
      await oeuvre('brouillon', 10000, 'brouillon')
    })

    afterAll(async () => {
      await db.query(`DELETE FROM "Artwork" WHERE "artistId" = 'artiste-prix'`)
      await db.query(`DELETE FROM "Artist" WHERE id = 'artiste-prix'`)
    })

    beforeEach(async () => {
      jar.valeurs.clear()
      jar.poses.length = 0
      const zone = async (nom: string, pays: string[]) => {
        const id = `zone-${nom}`
        await db.query(`INSERT INTO "Zone" (id, nom, "updatedAt") VALUES ($1, $1, now())`, [id])
        for (const p of pays) await db.query(`INSERT INTO "ZonePays" ("codePays", "zoneId") VALUES ($1, $2)`, [p, id])
        return id
      }
      const ue = await zone('ue', ['FR', 'DE'])
      const amerique = await zone('amerique', ['CA', 'US'])
      const maroc = await zone('maroc', ['MA'])
      await offre('livree', ue, `true, 4000, 3, 5, 9, 'EUR'`)
      await offre('livree', amerique, `false, NULL, NULL, NULL, NULL, 'EUR'`)
      await offre('moins-chere', ue, `true, 2500, 2, 2, 4, 'EUR'`)
      await offre('moins-chere', amerique, `true, 9000, 2, 7, 14, 'EUR'`)
      await offre('moins-chere', maroc, `true, 0, 0, 2, 2, 'EUR'`)
      await offre('sans-prix', ue, `true, 4000, 3, 5, 9, 'EUR'`)
      await offre('autre-devise', ue, `true, 4000, 3, 5, 9, 'USD'`)
      await offre('brouillon', ue, `true, 4000, 3, 5, 9, 'EUR'`)
    })

    const lire = async (slug: string) =>
      (await db.query(`SELECT id, "prixCentimes", devise FROM "Artwork" WHERE slug = $1`, [slug])).rows[0] as {
        id: string
        prixCentimes: number | null
        devise: string
      }

    it('matrice : livrée, zone non livrée, sans offre, pays sans zone, sans prix, devise différente', async () => {
      const { prixLivre } = await import('@/lib/livraison')
      expect(await prixLivre(await lire('livree'), 'FR')).toEqual({
        livree: true, totalCentimes: 149000, devise: 'EUR', fraisCentimes: 4000, delaiMinJours: 8, delaiMaxJours: 12,
      })
      expect(await prixLivre(await lire('livree'), 'CA')).toEqual({ livree: false, raison: 'non_livree' })
      expect(await prixLivre(await lire('livree'), 'MA')).toEqual({ livree: false, raison: 'non_livree' })
      expect(await prixLivre(await lire('livree'), 'RU')).toEqual({ livree: false, raison: 'pas_de_zone' })
      expect(await prixLivre(await lire('sans-prix'), 'FR')).toEqual({ livree: false, raison: 'sans_prix' })
      expect(await prixLivre(await lire('autre-devise'), 'FR')).toEqual({ livree: false, raison: 'devise_differente' })
    })

    it('les deux formes (par œuvre et SQL) donnent le même résultat pour chaque œuvre visible et chaque pays', async () => {
      const { prixLivre, prixLivresPourPays } = await import('@/lib/livraison')
      const visibles = (await db.query(`SELECT slug FROM "Artwork" WHERE publication = 'publiee' ORDER BY slug`)).rows.map((r) => r.slug as string)
      expect(visibles).toHaveLength(4)
      for (const pays of ['FR', 'DE', 'CA', 'US', 'MA', 'RU']) {
        const sql = await prixLivresPourPays(pays)
        // Œuvres visibles seulement (le brouillon n'y est pas).
        expect([...sql.keys()].sort(), pays).toEqual([...visibles].sort())
        for (const slug of visibles) {
          const o = await lire(slug)
          expect(sql.get(o.id), `${slug} ${pays}`).toEqual(await prixLivre(o, pays))
        }
      }
      expect((await prixLivresPourPays('FR')).get('moins-chere')).toMatchObject({ totalCentimes: 52500, delaiMinJours: 4, delaiMaxJours: 6 })
      expect((await prixLivresPourPays('MA')).get('moins-chere')).toMatchObject({ totalCentimes: 50000, delaiMinJours: 2, delaiMaxJours: 2 })
      expect(await prixLivresPourPays('FR', [])).toEqual(new Map())
    })

    it('base de production en lecture seule (préversion) : SQL brut refusé, même résultat œuvre par œuvre', async () => {
      const { prixLivresPourPays } = await import('@/lib/livraison')
      const { prisma } = await import('@/lib/prisma')
      const { EcritureProductionInterdite } = await import('@/lib/garde-production')
      const attendu = await prixLivresPourPays('FR')
      const espion = vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new EcritureProductionInterdite())
      expect(await prixLivresPourPays('FR')).toEqual(attendu)
      espion.mockRestore()
    })

    it('client réellement en lecture seule (DATABASE_URL sur DATABASE_PRODUCTION_ID) : même résultat sans SQL brut', async () => {
      const { prixLivresPourPays } = await import('@/lib/livraison')
      const attendu = await prixLivresPourPays('FR')
      const globale = globalThis as unknown as { prisma?: unknown }
      const original = globale.prisma
      const env = { id: process.env.DATABASE_PRODUCTION_ID, vercel: process.env.VERCEL_ENV }
      // Même point d'injection que l'application : @/lib/prisma crée un client protégé
      // (interdireEcritures) quand DATABASE_URL vise DATABASE_PRODUCTION_ID.
      process.env.DATABASE_PRODUCTION_ID = new URL(base.url).hostname
      delete process.env.VERCEL_ENV
      delete globale.prisma
      vi.resetModules()
      try {
        const { prisma: protege } = await import('@/lib/prisma')
        await expect(protege.$queryRaw`SELECT 1`).rejects.toMatchObject({ code: 'ecriture_production_interdite' })
        const livraison = await import('@/lib/livraison')
        for (const pays of ['FR', 'CA', 'MA', 'RU']) {
          expect(await livraison.prixLivresPourPays(pays), pays).toEqual(await prixLivresPourPays(pays))
        }
        expect(await livraison.prixLivresPourPays('FR')).toEqual(attendu)
        await protege.$disconnect()
      } finally {
        globale.prisma = original
        if (env.id === undefined) delete process.env.DATABASE_PRODUCTION_ID
        else process.env.DATABASE_PRODUCTION_ID = env.id
        if (env.vercel !== undefined) process.env.VERCEL_ENV = env.vercel
        vi.resetModules()
      }
    })

    it('fiche sans cookie : prix livré France, délai et mention des droits', async () => {
      const { default: Fiche } = await import('@/app/galerie/[id]/page')
      const html = renderToStaticMarkup(await Fiche({ params: { id: 'livree' } }))
      expect(html).toContain('Prix livré')
      expect(html).toContain(formaterMontant(149000))
      expect(html).toContain(`1${F}490${F}€`)
      // Story 3.5 : case Délai de la rangée (« 8 à 12 jours »).
      expect(html).toContain('8 à 12 jours')
      // Mention dans le bloc principal, pas seulement sur les œuvres proches.
      const principal = html.slice(0, html.indexOf('Vous pourriez aimer'))
      expect(principal).toContain('8 à 12 jours')
      expect(principal).toContain('Droits et taxes d’import éventuels non inclus')
      expect(html).toContain('Livraison\u00a0: France')
      expect(html).not.toContain(`1${F}450${F}€`)
    })

    it('fiche, cookie `pays=CA` : pas de livraison vers le Canada ; cookie invalide : France', async () => {
      const { default: Fiche } = await import('@/app/galerie/[id]/page')
      jar.valeurs.set('pays', 'CA')
      const html = renderToStaticMarkup(await Fiche({ params: { id: 'livree' } }))
      // Bloc principal (avant les œuvres proches, elles livrées au Canada) : ni prix, ni délai, ni mention.
      const principal = html.slice(0, html.indexOf('Vous pourriez aimer'))
      // Story 3.5 : case Prix livré de la rangée.
      expect(principal).toContain('Pas de livraison vers Canada')
      expect(principal).toContain('Artiste Prix ne livre pas encore Canada.')
      expect(principal).not.toContain('Droits et taxes')
      expect(principal).not.toContain('8 à 12 jours')
      expect(html).toContain(`590${F}€`)
      jar.valeurs.set('pays', 'ZZ')
      expect(renderToStaticMarkup(await Fiche({ params: { id: 'livree' } }))).toContain('8 à 12 jours')
    })

    it('galerie : chaque œuvre porte son prix livré vers le pays du cookie', async () => {
      const { default: Galerie } = await import('@/app/galerie/page')
      const { lireGalerie } = await import('@/lib/catalogue')
      jar.valeurs.set('pays', 'US')
      const lue = await lireGalerie('US', {})
      const par = Object.fromEntries(lue.oeuvres.map((a) => [a.id, a.prixLivre]))
      expect(par['moins-chere']).toMatchObject({ livree: true, totalCentimes: 59000, delaiMinJours: 9, delaiMaxJours: 16 })
      expect(par['livree']).toEqual({ livree: false, raison: 'non_livree' })
      expect(par['brouillon']).toBeUndefined()
      const html = renderToStaticMarkup(await Galerie({ searchParams: {} }))
      expect(html).toContain('prix livré États-Unis')
      expect(html).toContain(`590${F}€`)
      expect(html).toContain('Livrée sous 9 à 16 jours')
      expect(html).toContain('Pas de livraison vers ce pays (États-Unis)')
      const carte = (slug: string) => {
        const debut = html.indexOf(`>${slug}</h2>`)
        return html.slice(debut, html.indexOf('</article>', debut))
      }
      expect(carte('moins-chere')).toContain('Droits et taxes d’import éventuels non inclus')
      expect(carte('livree')).not.toContain('Droits et taxes')
      expect(carte('sans-prix')).toContain('—')
      expect(carte('sans-prix')).not.toContain('Pas de livraison')
    })

    it('choix du pays : cookie `pays` posé pour un code valide, rien sinon', async () => {
      const { choisirPaysLivraison } = await import('@/app/actions/pays')
      expect(await choisirPaysLivraison('ZZ')).toEqual({ ok: false })
      expect(await choisirPaysLivraison(42)).toEqual({ ok: false })
      expect(jar.poses).toEqual([])
      expect(await choisirPaysLivraison('CA')).toEqual({ ok: true, code: 'CA', nom: 'Canada' })
      expect(jar.poses).toEqual([cookiePays('CA')])
      expect(fr.livraison.recalcules('Canada')).toBe('Prix et délais recalculés\u00a0: Canada')
    })
  })
})


/* ── Story 3.3 : prix livré ─────────────────────────────────────────────── */

describe('prix livré : règle pure', () => {
  const oeuvre = { prixCentimes: 145000, devise: 'EUR' }
  const offre: OffreAPrix = {
    livree: true, fraisCentimes: 4000, devise: 'EUR', preparationJours: 3, transportMinJours: 5, transportMaxJours: 9,
  }

  it('livrée : total = prix + frais, délai = préparation + transport', () => {
    expect(calculerPrixLivre(oeuvre, true, offre)).toEqual({
      livree: true, totalCentimes: 149000, devise: 'EUR', fraisCentimes: 4000, delaiMinJours: 8, delaiMaxJours: 12,
    })
    expect(fr.livraison.delai(8, 12)).toBe('Livrée sous 8 à 12 jours')
    expect(fr.livraison.delai(1, 1)).toBe('Livrée sous 1 jour')
    expect(fr.livraison.pasDeLivraison('Canada')).toBe('Pas de livraison vers ce pays (Canada)')
    expect(fr.livraison.droitsNonInclus).toBe('Droits et taxes d’import éventuels non inclus')
  })

  it('non livrée : sans prix, pays sans zone, sans offre, zone non livrée, devise différente', () => {
    expect(calculerPrixLivre({ prixCentimes: null, devise: 'EUR' }, true, offre)).toEqual({ livree: false, raison: 'sans_prix' })
    expect(calculerPrixLivre(oeuvre, false, null)).toEqual({ livree: false, raison: 'pas_de_zone' })
    expect(calculerPrixLivre(oeuvre, true, null)).toEqual({ livree: false, raison: 'non_livree' })
    const nonLivree = { ...offre, livree: false, fraisCentimes: null, preparationJours: null, transportMinJours: null, transportMaxJours: null }
    expect(calculerPrixLivre(oeuvre, true, nonLivree)).toEqual({ livree: false, raison: 'non_livree' })
    expect(calculerPrixLivre(oeuvre, true, { ...offre, devise: 'USD' })).toEqual({ livree: false, raison: 'devise_differente' })
    // Casse ignorée.
    expect(calculerPrixLivre({ ...oeuvre, devise: 'eur' }, true, offre)).toMatchObject({ livree: true, devise: 'EUR' })
  })

  it('cookie `pays` : absent ou invalide → FR ; un an sur tout le site', () => {
    expect(lirePays(undefined)).toBe('FR')
    expect(lirePays('')).toBe('FR')
    expect(lirePays('ZZ')).toBe('FR')
    expect(lirePays('<script>')).toBe('FR')
    expect(lirePays('CA')).toBe('CA')
    expect(lirePays(' ca ')).toBe('CA')
    expect(cookiePays('CA')).toEqual({
      name: 'pays', value: 'CA', path: '/', maxAge: 365 * 24 * 60 * 60, sameSite: 'lax', httpOnly: true, secure: false,
    })
  })

  it('tri sur le prix livré : croissant et décroissant, non livrées et sans prix en dernier', () => {
    const livree = (totalCentimes: number) => ({
      prixLivre: { livree: true as const, totalCentimes, devise: 'EUR', fraisCentimes: 0, delaiMinJours: 1, delaiMaxJours: 2 },
    })
    const oeuvres = [
      { id: 'non-livree', prixLivre: { livree: false as const, raison: 'non_livree' as const } },
      { id: 'chere', ...livree(300000) },
      { id: 'sans-prix', prixLivre: { livree: false as const, raison: 'sans_prix' as const } },
      { id: 'abordable', ...livree(50000) },
      { id: 'sans-calcul' },
      { id: 'moyenne', ...livree(120000) },
    ]
    const trier = (sens: 1 | -1) => [...oeuvres].sort((a, b) => comparerPrixLivre(a, b, sens)).map((o) => o.id)
    expect(trier(1).slice(0, 3)).toEqual(['abordable', 'moyenne', 'chere'])
    expect(trier(-1).slice(0, 3)).toEqual(['chere', 'moyenne', 'abordable'])
    for (const sens of [1, -1] as const) {
      expect(new Set(trier(sens).slice(3))).toEqual(new Set(['non-livree', 'sans-prix', 'sans-calcul']))
    }
    expect(totalLivre(livree(42))).toBe(42)
    expect(totalLivre({ prixLivre: { livree: false, raison: 'pas_de_zone' } })).toBeNull()
  })

  it('composant PaysLivraison : pays affiché, « Modifier » fermé, zone aria-live', () => {
    const html = renderToStaticMarkup(createElement(PaysLivraison, { code: 'FR', nom: 'France' }))
    expect(html).toContain('Livraison\u00a0: France')
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*>Modifier<\/button>/)
    expect(html).toContain('aria-live="polite"')
    expect(html).not.toContain('<select')
  })

  it('aucune addition de prix ou de frais hors du module livraison (src/)', () => {
    const SRC = path.resolve(__dirname, '../src')
    const fichiers = (dossier: string): string[] =>
      readdirSync(dossier).flatMap((nom) => {
        const chemin = path.join(dossier, nom)
        return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(ts|tsx)$/.test(nom) ? [chemin] : []
      })
    // Une ligne qui additionne des frais, ou qui additionne à/avec prixCentimes ou totalCentimes.
    const addition = /\b(frais\w*|prixCentimes|totalCentimes)\b[^;\n]*\+|\+[^;\n]*\b(frais\w*|prixCentimes|totalCentimes)\b/i
    const trouves = fichiers(SRC)
      .filter((f) => !['generated/', 'lib/livraison/'].some((a) => path.relative(SRC, f).split(path.sep).join('/').startsWith(a)))
      .flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .filter((ligne) => !/^\s*(\/\/|\*|\/\*)/.test(ligne) && addition.test(ligne))
          .map((ligne) => `${f}: ${ligne.trim()}`),
      )
    expect(trouves).toEqual([])
  })
})
