import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 6.2 (FR-12, AD-7, NFR-4) : réservation en bloc sans double vente. Base réelle.

describe('règles pures', () => {
  it('échéance exclue, plafond, durée et plafond de reglages', async () => {
    const { estEchue, echeanceApres, plafondDepasse } = await import('@/lib/disponibilite/reservation-regles')
    const { DUREE_RESERVATION_PAIEMENT_MINUTES, PLAFONDS_RESERVATION } = await import('@/lib/reglages')
    const t = new Date('2026-11-11T10:00:00Z')
    expect(estEchue(t, t)).toBe(true)
    expect(estEchue(new Date(t.getTime() + 1), t)).toBe(false)
    expect(echeanceApres(t, 30).toISOString()).toBe('2026-11-11T10:30:00.000Z')
    expect(plafondDepasse(2, 1, 3)).toBe(false)
    expect(plafondDepasse(2, 2, 3)).toBe(true)
    expect(DUREE_RESERVATION_PAIEMENT_MINUTES).toBe(30)
    expect(PLAFONDS_RESERVATION).toEqual({ parEmail: 3, parAppareil: 3 })
  })
})

describe('base : réservation', () => {
  let base: BaseJetable
  let db: Client
  const T0 = new Date('2026-11-11T10:00:00Z')
  const apres = (minutes: number) => new Date(T0.getTime() + minutes * 60_000)

  async function oeuvre(slug: string, options: { publication?: string; dispo?: string; artiste?: string } = {}) {
    const { publication = 'publiee', dispo = 'disponible', artiste = 'art-a' } = options
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", devise,
         publication, disponibilite, "artistId", "updatedAt")
       VALUES ($1, $1, $1, 2024, 'Huile', 'D', 'https://res.cloudinary.com/x/p.jpg', 100000, 'EUR', $2::"Publication", $3::"Disponibilite", $4, now())`,
      [slug, publication, dispo, artiste],
    )
  }
  const etat = async (slug: string) => (await db.query(`SELECT disponibilite::text AS d FROM "Artwork" WHERE slug = $1`, [slug])).rows[0].d as string
  const lignes = async (slug?: string) =>
    (await db.query(`SELECT "artworkId", "passageId", origine::text AS origine, issue::text AS issue, "empreinteEmail", "empreinteAppareil" FROM "Reservation" ${slug ? `WHERE "artworkId" = '${slug}'` : ''} ORDER BY "createdAt", id`)).rows
  const evenements = async () => Number((await db.query(`SELECT count(*) FROM "Evenement"`)).rows[0].count)

  beforeAll(async () => {
    base = await creerBaseJetable()
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
    for (const table of ['Reservation', 'TraitementEvenement', 'Evenement', 'DeclarationDisponibilite', 'Artwork', 'Artist']) {
      await db.query(`DELETE FROM "${table}"`)
    }
    for (const [id, accord] of [['art-a', 'now()'], ['art-sans-accord', 'NULL']]) {
      await db.query(
        `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "accordSigneLe", "updatedAt")
         VALUES ($1, $1, $1, 'MA', 1980, 'Bio', '', ${accord}, now())`,
        [id],
      )
    }
  })

  it('en bloc : trois œuvres, trois lignes actives, trois œuvres réservées, trois événements', async () => {
    for (const s of ['o1', 'o2', 'o3']) await oeuvre(s)
    const { reserverOeuvres } = await import('@/lib/disponibilite')
    const r = await reserverOeuvres({ passageId: 'p1', slugs: ['o1', 'o2', 'o3'], origine: 'paiement', email: 'A@b.test', maintenant: T0 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.reservations).toHaveLength(3)
    expect(r.reservations[0].echeance.toISOString()).toBe(apres(30).toISOString())
    for (const s of ['o1', 'o2', 'o3']) expect(await etat(s)).toBe('reservee')
    const l = await lignes()
    expect(l).toHaveLength(3)
    expect(l.every((x) => x.issue === null && x.passageId === 'p1' && x.origine === 'paiement')).toBe(true)
    expect(await evenements()).toBe(3)
    // Jamais l'adresse en clair.
    expect(JSON.stringify(l)).not.toContain('b.test')
    expect(l[0].empreinteEmail).toMatch(/^reservation-email:/)
  })

  it.each([
    ['vendue', { dispo: 'vendue' }],
    ['retirée', { dispo: 'retiree' }],
    ['déjà réservée', { dispo: 'reservee' }],
    ['non publiée', { publication: 'en_curation' }],
    ['artiste sans accord', { artiste: 'art-sans-accord' }],
  ])('une œuvre %s : rien réservé, refus nommant le slug', async (_n, options) => {
    await oeuvre('bon')
    await oeuvre('mauvais', options)
    const { reserverOeuvres } = await import('@/lib/disponibilite')
    const r = await reserverOeuvres({ passageId: 'p1', slugs: ['bon', 'mauvais'], origine: 'vente_assistee', echeance: apres(2880), maintenant: T0 })
    expect(r).toEqual({ ok: false, code: 'oeuvre_indisponible', slug: 'mauvais' })
    expect(await etat('bon')).toBe('disponible')
    expect(await lignes()).toHaveLength(0)
    expect(await evenements()).toBe(0)
  })

  it('slug inconnu, liste vide, échéance manquante hors paiement : refus typés', async () => {
    await oeuvre('o1')
    const { reserverOeuvres } = await import('@/lib/disponibilite')
    expect(await reserverOeuvres({ passageId: 'p', slugs: ['o1', 'absent'], origine: 'paiement' })).toEqual({ ok: false, code: 'oeuvre_indisponible', slug: 'absent' })
    expect(await reserverOeuvres({ passageId: 'p', slugs: [], origine: 'paiement' })).toEqual({ ok: false, code: 'liste_vide' })
    expect(await reserverOeuvres({ passageId: 'p', slugs: ['o1'], origine: 'vente_assistee' })).toEqual({ ok: false, code: 'invalide' })
    expect(await lignes()).toHaveLength(0)
  })

  it('simultané : deux passages, même œuvre, exactement un réussit', async () => {
    await oeuvre('rare')
    const { reserverOeuvres } = await import('@/lib/disponibilite')
    for (let i = 0; i < 5; i++) {
      await db.query(`DELETE FROM "Reservation"`)
      await db.query(`UPDATE "Artwork" SET disponibilite = 'disponible'`)
      const resultats = await Promise.all(
        ['pa', 'pb', 'pc'].map((p) => reserverOeuvres({ passageId: `${p}${i}`, slugs: ['rare'], origine: 'paiement' })),
      )
      expect(resultats.filter((r) => r.ok)).toHaveLength(1)
      for (const r of resultats.filter((r) => !r.ok)) expect(r).toEqual({ ok: false, code: 'oeuvre_indisponible', slug: 'rare' })
      expect((await lignes('rare')).filter((l) => l.issue === null)).toHaveLength(1)
      expect(await etat('rare')).toBe('reservee')
    }
  })

  it('simultané en bloc croisé : pas de verrou mortel, tout ou rien', async () => {
    await oeuvre('x1')
    await oeuvre('x2')
    const { reserverOeuvres } = await import('@/lib/disponibilite')
    const [a, b] = await Promise.all([
      reserverOeuvres({ passageId: 'pa', slugs: ['x1', 'x2'], origine: 'paiement' }),
      reserverOeuvres({ passageId: 'pb', slugs: ['x2', 'x1'], origine: 'paiement' }),
    ])
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
    expect(await lignes()).toHaveLength(2)
  })

  it('échue : l’ancienne devient expirée, la nouvelle réussit, une seule active', async () => {
    await oeuvre('o1')
    const { reserverOeuvres } = await import('@/lib/disponibilite')
    expect((await reserverOeuvres({ passageId: 'p1', slugs: ['o1'], origine: 'paiement', maintenant: T0 })).ok).toBe(true)
    // Pas encore échue : refus.
    expect(await reserverOeuvres({ passageId: 'p2', slugs: ['o1'], origine: 'paiement', maintenant: apres(29) })).toEqual({ ok: false, code: 'oeuvre_indisponible', slug: 'o1' })
    const r = await reserverOeuvres({ passageId: 'p2', slugs: ['o1'], origine: 'paiement', maintenant: apres(31) })
    expect(r.ok).toBe(true)
    const l = await lignes('o1')
    expect(l.map((x) => [x.passageId, x.issue])).toEqual([['p1', 'expiree'], ['p2', null]])
    expect(await etat('o1')).toBe('reservee')
  })

  it('même passage : appel répété = succès, aucune ligne en plus', async () => {
    await oeuvre('o1')
    const { reserverOeuvres } = await import('@/lib/disponibilite')
    await reserverOeuvres({ passageId: 'p1', slugs: ['o1'], origine: 'paiement', maintenant: T0 })
    const n = await evenements()
    const r = await reserverOeuvres({ passageId: 'p1', slugs: ['o1'], origine: 'paiement', maintenant: apres(5) })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.reservations[0].nouvelle).toBe(false)
    expect(await lignes()).toHaveLength(1)
    expect(await evenements()).toBe(n)
  })

  it('même passage rappelé après l’échéance : nouvelle échéance, une seule ligne active', async () => {
    await oeuvre('o1')
    const { reserverOeuvres } = await import('@/lib/disponibilite')
    await reserverOeuvres({ passageId: 'p1', slugs: ['o1'], origine: 'paiement', maintenant: T0 })
    const r = await reserverOeuvres({ passageId: 'p1', slugs: ['o1'], origine: 'paiement', maintenant: apres(31) })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.reservations[0]).toMatchObject({ nouvelle: true, echeance: apres(61) })
    const l = await lignes('o1')
    expect(l.map((x) => x.issue)).toEqual(['expiree', null])
    expect(await etat('o1')).toBe('reservee')
  })

  it('même passage dont l’œuvre a été déclarée vendue ailleurs : refus', async () => {
    await oeuvre('o1')
    const { reserverOeuvres } = await import('@/lib/disponibilite')
    await reserverOeuvres({ passageId: 'p1', slugs: ['o1'], origine: 'paiement', maintenant: T0 })
    await db.query(`UPDATE "Artwork" SET disponibilite = 'vendue_ailleurs'`)
    expect(await reserverOeuvres({ passageId: 'p1', slugs: ['o1'], origine: 'paiement', maintenant: apres(5) })).toEqual({ ok: false, code: 'oeuvre_indisponible', slug: 'o1' })
  })

  it('sans tx, la répartition a lieu : un TraitementEvenement par événement', async () => {
    await oeuvre('o1')
    await oeuvre('o2')
    const { reserverOeuvres } = await import('@/lib/disponibilite')
    await reserverOeuvres({ passageId: 'p1', slugs: ['o1', 'o2'], origine: 'paiement' })
    expect(await evenements()).toBe(2)
    const n = Number((await db.query(`SELECT count(DISTINCT t."evenementId") FROM "TraitementEvenement" t`)).rows[0].count)
    expect(n).toBe(2)
  })

  describe('plafond', () => {
    it('par e-mail : la quatrième est refusée, rien n’est écrit', async () => {
      for (const s of ['o1', 'o2', 'o3', 'o4', 'o5']) await oeuvre(s)
      const { reserverOeuvres } = await import('@/lib/disponibilite')
      expect((await reserverOeuvres({ passageId: 'p1', slugs: ['o1', 'o2'], origine: 'paiement', email: 'a@b.test', maintenant: T0 })).ok).toBe(true)
      expect(await reserverOeuvres({ passageId: 'p2', slugs: ['o3', 'o4'], origine: 'paiement', email: ' A@B.test ', maintenant: T0 })).toEqual({ ok: false, code: 'plafond_atteint' })
      expect(await etat('o3')).toBe('disponible')
      expect(await lignes()).toHaveLength(2)
      expect((await reserverOeuvres({ passageId: 'p3', slugs: ['o3'], origine: 'paiement', email: 'a@b.test', maintenant: T0 })).ok).toBe(true)
      // Autre e-mail : pas limité.
      expect((await reserverOeuvres({ passageId: 'p4', slugs: ['o4'], origine: 'paiement', email: 'c@d.test', maintenant: T0 })).ok).toBe(true)
    })

    it('même passage rappelé : 4 œuvres au total refusées, les mêmes 2 acceptées', async () => {
      for (const s of ['o1', 'o2', 'o3', 'o4']) await oeuvre(s)
      const { reserverOeuvres } = await import('@/lib/disponibilite')
      const base = { passageId: 'p1', origine: 'paiement' as const, email: 'a@b.test', maintenant: T0 }
      expect((await reserverOeuvres({ ...base, slugs: ['o1', 'o2'] })).ok).toBe(true)
      expect((await reserverOeuvres({ ...base, slugs: ['o1', 'o2'] })).ok).toBe(true)
      expect(await reserverOeuvres({ ...base, slugs: ['o1', 'o2', 'o3', 'o4'] })).toEqual({ ok: false, code: 'plafond_atteint' })
      expect(await lignes()).toHaveLength(2)
    })

    it('e-mail ou appareil blancs : pas d’empreinte, pas de plafond partagé', async () => {
      for (const s of ['o1', 'o2', 'o3', 'o4']) await oeuvre(s)
      const { reserverOeuvres } = await import('@/lib/disponibilite')
      for (const [i, s] of ['o1', 'o2', 'o3', 'o4'].entries()) {
        expect((await reserverOeuvres({ passageId: `p${i}`, slugs: [s], origine: 'paiement', email: '   ', appareil: '  ', maintenant: T0 })).ok).toBe(true)
      }
      expect((await lignes()).every((l) => l.empreinteEmail === null && l.empreinteAppareil === null)).toBe(true)
    })

    it('par appareil, et absent = pas de contrôle', async () => {
      for (const s of ['o1', 'o2', 'o3', 'o4']) await oeuvre(s)
      const { reserverOeuvres } = await import('@/lib/disponibilite')
      expect((await reserverOeuvres({ passageId: 'p1', slugs: ['o1', 'o2', 'o3'], origine: 'paiement', email: 'a@b.test', appareil: 'tel-1', maintenant: T0 })).ok).toBe(true)
      expect(await reserverOeuvres({ passageId: 'p2', slugs: ['o4'], origine: 'paiement', email: 'z@z.test', appareil: 'tel-1', maintenant: T0 })).toEqual({ ok: false, code: 'plafond_atteint' })
      expect((await reserverOeuvres({ passageId: 'p3', slugs: ['o4'], origine: 'paiement', email: 'z@z.test', maintenant: T0 })).ok).toBe(true)
    })

    it('une réservation échue ne compte plus ; la vente assistée n’est pas limitée', async () => {
      for (const s of ['o1', 'o2', 'o3', 'o4', 'o5']) await oeuvre(s)
      const { reserverOeuvres } = await import('@/lib/disponibilite')
      await reserverOeuvres({ passageId: 'p1', slugs: ['o1', 'o2', 'o3'], origine: 'paiement', email: 'a@b.test', maintenant: T0 })
      expect((await reserverOeuvres({ passageId: 'p2', slugs: ['o4'], origine: 'paiement', email: 'a@b.test', maintenant: apres(31) })).ok).toBe(true)
      const r = await reserverOeuvres({ passageId: 'p3', slugs: ['o5'], origine: 'vente_assistee', echeance: apres(3000), email: 'a@b.test', maintenant: apres(31) })
      expect(r.ok).toBe(true)
    })

    it('deux passages simultanés du même e-mail : le plafond tient', async () => {
      for (const s of ['o1', 'o2', 'o3', 'o4']) await oeuvre(s)
      const { reserverOeuvres } = await import('@/lib/disponibilite')
      const [a, b] = await Promise.all([
        reserverOeuvres({ passageId: 'pa', slugs: ['o1', 'o2'], origine: 'paiement', email: 'a@b.test' }),
        reserverOeuvres({ passageId: 'pb', slugs: ['o3', 'o4'], origine: 'paiement', email: 'a@b.test' }),
      ])
      expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
      expect(await lignes()).toHaveLength(2)
    })
  })

  describe('libération', () => {
    it('libererReservation : œuvres disponibles, issue liberee, idempotent', async () => {
      await oeuvre('o1')
      const { reserverOeuvres, libererReservation } = await import('@/lib/disponibilite')
      await reserverOeuvres({ passageId: 'p1', slugs: ['o1'], origine: 'paiement', maintenant: T0 })
      expect((await libererReservation('p1', { maintenant: apres(1) })).liberees).toBe(1)
      expect(await etat('o1')).toBe('disponible')
      expect((await lignes('o1'))[0].issue).toBe('liberee')
      expect((await libererReservation('p1')).liberees).toBe(0)
      // Elle peut être reprise.
      expect((await reserverOeuvres({ passageId: 'p2', slugs: ['o1'], origine: 'paiement' })).ok).toBe(true)
    })

    it('libererReservationsEchues : seulement les échues', async () => {
      await oeuvre('o1')
      await oeuvre('o2')
      const { reserverOeuvres, libererReservationsEchues } = await import('@/lib/disponibilite')
      await reserverOeuvres({ passageId: 'p1', slugs: ['o1'], origine: 'paiement', maintenant: T0 })
      await reserverOeuvres({ passageId: 'p2', slugs: ['o2'], origine: 'paiement', maintenant: apres(20) })
      expect((await libererReservationsEchues(apres(31))).liberees).toBe(1)
      expect(await etat('o1')).toBe('disponible')
      expect(await etat('o2')).toBe('reservee')
      expect((await lignes('o1'))[0].issue).toBe('expiree')
    })

    it('œuvre déclarée vendue ailleurs ou retirée entre-temps : jamais écrasée', async () => {
      await oeuvre('o1')
      await oeuvre('o2')
      const { reserverOeuvres, libererReservation, libererReservationsEchues } = await import('@/lib/disponibilite')
      await reserverOeuvres({ passageId: 'p1', slugs: ['o1', 'o2'], origine: 'paiement', maintenant: T0 })
      await db.query(`UPDATE "Artwork" SET disponibilite = 'vendue_ailleurs' WHERE slug = 'o1'`)
      await db.query(`UPDATE "Artwork" SET disponibilite = 'retiree' WHERE slug = 'o2'`)
      await libererReservationsEchues(apres(31))
      expect(await etat('o1')).toBe('vendue_ailleurs')
      expect(await etat('o2')).toBe('retiree')
      expect((await lignes()).every((l) => l.issue === 'expiree')).toBe(true)
      await libererReservation('p1')
      expect(await etat('o1')).toBe('vendue_ailleurs')
    })

    it('réservation échue d’une œuvre déclarée entre-temps : la nouvelle est refusée', async () => {
      await oeuvre('o1')
      const { reserverOeuvres } = await import('@/lib/disponibilite')
      await reserverOeuvres({ passageId: 'p1', slugs: ['o1'], origine: 'paiement', maintenant: T0 })
      await db.query(`UPDATE "Artwork" SET disponibilite = 'vendue_ailleurs'`)
      expect(await reserverOeuvres({ passageId: 'p2', slugs: ['o1'], origine: 'paiement', maintenant: apres(31) })).toEqual({ ok: false, code: 'oeuvre_indisponible', slug: 'o1' })
      expect(await etat('o1')).toBe('vendue_ailleurs')
      expect((await lignes('o1'))[0].issue).toBeNull()
    })
  })

  it('avec tx : l’appelant dispose des événements et annule tout par sa transaction', async () => {
    await oeuvre('o1')
    const { prisma } = await import('@/lib/prisma')
    const { reserverOeuvres } = await import('@/lib/disponibilite')
    await expect(
      prisma.$transaction(async (tx) => {
        const r = await reserverOeuvres({ passageId: 'p1', slugs: ['o1'], origine: 'paiement' }, tx)
        expect(r.ok && r.evenements).toHaveLength(1)
        throw new Error('annule')
      }),
    ).rejects.toThrow('annule')
    expect(await etat('o1')).toBe('disponible')
    expect(await lignes()).toHaveLength(0)
  })

  it('index unique partiel présent en base, et un second actif est refusé par la base', async () => {
    const idx = (await db.query(`SELECT indexdef FROM pg_indexes WHERE tablename = 'Reservation' AND indexname = 'Reservation_active_par_oeuvre'`)).rows
    expect(idx).toHaveLength(1)
    expect(idx[0].indexdef).toMatch(/UNIQUE/)
    expect(idx[0].indexdef).toMatch(/WHERE/)
    await oeuvre('o1')
    const ins = (issue: string | null) =>
      db.query(`INSERT INTO "Reservation" (id, "artworkId", "passageId", origine, echeance, issue) VALUES (gen_random_uuid()::text, 'o1', 'p', 'paiement', now(), $1::"IssueReservation")`, [issue])
    await ins('expiree')
    await ins('liberee')
    await ins(null)
    await expect(ins(null)).rejects.toThrow(/Reservation_active_par_oeuvre/)
  })
})
