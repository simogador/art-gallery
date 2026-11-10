import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 3.4 (AD-11, AD-21, AR-9) : journal d'événements (écriture dans la transaction, réclamation
// atomique, répartition après validation) et cache étiqueté du catalogue.

const cache = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  options: [] as { tags?: string[]; revalidate?: number | false }[],
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: cache.revalidateTag,
  unstable_cache: (f: unknown, _cles: string[], options: { tags?: string[]; revalidate?: number | false }) => {
    cache.options.push(options)
    // Comme le vrai cache : la valeur passe par JSON (les dates reviennent en texte).
    return async (...a: unknown[]) => {
      const v = await (f as (...a: unknown[]) => Promise<unknown>)(...a)
      return v === undefined ? v : JSON.parse(JSON.stringify(v))
    }
  },
}))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }), headers: () => new Headers() }))

const ARTISTE = { type: 'artist', userId: 'utilisateur-1', artiste: { id: 'artiste-1', slug: 'mustapha-timija', name: 'Mustapha Timija' } }

describe('catalogue des événements (pur)', () => {
  it('seuls les noms du catalogue, avec deux ids, sont valides', async () => {
    const { evenementValide } = await import('@/lib/evenements/catalogue')
    expect(evenementValide({ nom: 'PublicationChangee', charge: { artworkId: 'a', artistId: 'b' } })).toBe(true)
    expect(evenementValide({ nom: 'DisponibiliteChangee', charge: { artworkId: 'a', artistId: 'b' } })).toBe(true)
    expect(evenementValide({ nom: 'InvitationEmise', charge: { invitationId: 'i' } })).toBe(true)
    expect(evenementValide({ nom: 'InvitationEmise', charge: { invitationId: 'i', email: 'x@y.z' } })).toBe(false)
    expect(evenementValide({ nom: 'OeuvreValidee', charge: { decisionId: 'd', artworkId: 'a', artistId: 'b' } })).toBe(true)
    expect(evenementValide({ nom: 'OeuvreRenvoyee', charge: { artworkId: 'a', artistId: 'b' } })).toBe(false)
    expect(evenementValide({ nom: 'OeuvreVendue', charge: { artworkId: 'a', artistId: 'b' } })).toBe(false)
    expect(evenementValide({ nom: 'toString', charge: { artworkId: 'a', artistId: 'b' } })).toBe(false)
    expect(evenementValide({ nom: 'PublicationChangee', charge: { artworkId: 'a' } })).toBe(false)
    // Aucune autre donnée (par exemple personnelle) dans la charge.
    expect(evenementValide({ nom: 'PublicationChangee', charge: { artworkId: 'a', artistId: 'b', email: 'x@y.z' } })).toBe(false)
  })
})

describe('base : journal et cache', () => {
  let base: BaseJetable
  let db: Client

  const compter = async (table: string) => Number((await db.query(`SELECT count(*) FROM "${table}"`)).rows[0].count)

  async function oeuvre(slug: string, publication = 'publiee', disponibilite = 'disponible') {
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes",
                              "hauteurMm", "largeurMm", publication, disponibilite, "artistId", "createdAt", "updatedAt")
       VALUES ('id-' || $1, $1, $1, 2024, 'Huile', 'Histoire', 'https://res.cloudinary.com/x/image/upload/a.jpg',
               95000, 600, 800, $2::"Publication", $3::"Disponibilite", 'artiste-1', now(), now())`,
      [slug, publication, disponibilite],
    )
  }

  beforeAll(async () => {
    base = await creerBaseJetable()
    process.env.DATABASE_URL = base.url
    db = new Client({ connectionString: base.url })
    await db.connect()
    await db.query(`INSERT INTO "User" (id, email, role, "updatedAt") VALUES ('utilisateur-1', 'mt@exemple.test', 'artist', now())`)
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt", "userId", "accordSigneLe")
       VALUES ('artiste-1', 'mustapha-timija', 'Mustapha Timija', 'MA', 1980, 'Bio', '', now(), 'utilisateur-1', '2026-11-01')`,
    )
  })

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$disconnect()
    await db?.end()
    await base?.supprimer()
  })

  beforeEach(async () => {
    cache.revalidateTag.mockReset()
    cache.options.length = 0
    await db.query('DELETE FROM "Evenement"')
    await db.query('DELETE FROM "Artwork"')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('transaction annulée : aucun événement en base', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { ecrireEvenement } = await import('@/lib/evenements')
    await expect(
      prisma.$transaction(async (tx) => {
        await ecrireEvenement(tx, { nom: 'PublicationChangee', charge: { artworkId: 'a', artistId: 'b' } })
        throw new Error('refus métier')
      }),
    ).rejects.toThrow('refus métier')
    expect(await compter('Evenement')).toBe(0)
  })

  it('événement inconnu : refusé à l’exécution, transaction annulée', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { ecrireEvenement } = await import('@/lib/evenements')
    await expect(
      prisma.$transaction(async (tx) => {
        await ecrireEvenement(tx, { nom: 'Inconnue', charge: { artworkId: 'a', artistId: 'b' } } as never)
      }),
    ).rejects.toThrow(/catalogue/)
    expect(await compter('Evenement')).toBe(0)
  })

  it('vendue ailleurs : événement écrit, puis étiquettes de l’œuvre, de l’artiste et du catalogue invalidées', async () => {
    const { declarerDisponibilite } = await import('@/lib/disponibilite')
    await oeuvre('nuit')
    const r = await declarerDisponibilite(ARTISTE as never, 'nuit', 'vendue_ailleurs')
    expect(r.ok).toBe(true)
    const evenements = (await db.query('SELECT nom, version, charge FROM "Evenement"')).rows
    expect(evenements).toEqual([
      { nom: 'DisponibiliteChangee', version: 1, charge: { artworkId: 'id-nuit', artistId: 'artiste-1' } },
    ])
    expect(cache.revalidateTag).toHaveBeenCalledTimes(3)
    expect(cache.revalidateTag.mock.calls.map((c) => c[0]).sort()).toEqual(['artiste:artiste-1', 'catalogue', 'oeuvre:id-nuit'])
    expect(await compter('TraitementEvenement')).toBe(1)
  })

  it('refus métier avant l’écriture : aucun événement', async () => {
    const { declarerDisponibilite } = await import('@/lib/disponibilite')
    await oeuvre('brouillon-x', 'brouillon')
    const r = await declarerDisponibilite(ARTISTE as never, 'brouillon-x', 'retiree')
    expect(r).toEqual({ ok: false, code: 'transition_interdite' })
    expect(await compter('Evenement')).toBe(0)
  })

  it('publication : validation par l’équipe écrit PublicationChangee puis le répartit', async () => {
    const { validerOeuvre, CONTROLES_CURATION } = await import('@/lib/curation')
    await oeuvre('en-attente', 'en_curation')
    const r = await validerOeuvre({ type: 'admin', userId: 'admin-1' } as never, 'en-attente', CONTROLES_CURATION.map((c) => c.code))
    expect(r).toEqual({ ok: true, slug: 'en-attente' })
    // Story 4.1 : la validation écrit aussi OeuvreValidee (e-mail de l'artiste), ids seulement.
    expect((await db.query('SELECT nom, charge FROM "Evenement" ORDER BY nom DESC')).rows).toEqual([
      { nom: 'PublicationChangee', charge: { artworkId: 'id-en-attente', artistId: 'artiste-1' } },
      { nom: 'OeuvreValidee', charge: { decisionId: expect.any(String), artworkId: 'id-en-attente', artistId: 'artiste-1' } },
    ])
    expect(cache.revalidateTag).toHaveBeenCalledTimes(3)
  })

  it('double traitement en parallèle : une seule réclamation, un seul effet', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { ecrireEvenement, repartir } = await import('@/lib/evenements')
    const id = await prisma.$transaction((tx) =>
      ecrireEvenement(tx, { nom: 'PublicationChangee', charge: { artworkId: 'nuit', artistId: 'artiste-1' } }),
    )
    await Promise.all([repartir([id]), repartir([id]), repartir([id])])
    expect(await compter('TraitementEvenement')).toBe(1)
    // Un seul passage du gestionnaire : trois étiquettes, une fois chacune.
    expect(cache.revalidateTag).toHaveBeenCalledTimes(3)
    await repartir([id])
    expect(cache.revalidateTag).toHaveBeenCalledTimes(3)
  })

  it('gestionnaire en échec : erreur journalisée sans donnée personnelle, action réussie', async () => {
    const { declarerDisponibilite } = await import('@/lib/disponibilite')
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
    cache.revalidateTag.mockImplementation(() => {
      throw new Error('revalidateTag a échoué pour mt@exemple.test')
    })
    await oeuvre('nuit')
    const r = await declarerDisponibilite(ARTISTE as never, 'nuit', 'retiree')
    expect(r.ok).toBe(true)
    expect(erreurs).toHaveBeenCalled()
    const journal = JSON.stringify(erreurs.mock.calls)
    expect(journal).toContain('gestionnaire en échec')
    expect(journal).not.toContain('exemple.test')
    expect(await compter('Evenement')).toBe(1)
  })

  it('lecture publique en cache : étiquettes de l’œuvre et de l’artiste, revalidate de 60 s au plus', async () => {
    const { getArtworkBySlug } = await import('@/lib/catalogue')
    await oeuvre('nuit')
    const a = await getArtworkBySlug('nuit')
    expect(a?.id).toBe('nuit')
    // Même étiquette que celle qu'invalide l'événement (id de l'œuvre, pas son slug).
    const options = cache.options.at(-1)
    expect(options?.tags).toEqual(expect.arrayContaining(['oeuvre:id-nuit', 'artiste:artiste-1', 'catalogue']))
    expect(options?.revalidate).toBeLessThanOrEqual(60)
    expect(options?.revalidate).toBeGreaterThan(0)
  })

  const journal = async () =>
    (await db.query('SELECT nom, charge FROM "Evenement" ORDER BY "createdAt", nom')).rows as { nom: string; charge: { artworkId: string } }[]

  it('répartition terminée avant le retour de l’action (Next 14 : sinon l’invalidation est perdue)', async () => {
    const { declarerDisponibilite } = await import('@/lib/disponibilite')
    await oeuvre('nuit')
    const promesse = declarerDisponibilite(ARTISTE as never, 'nuit', 'vendue_ailleurs')
    expect(cache.revalidateTag).not.toHaveBeenCalled()
    await promesse
    // Aucune attente supplémentaire : les étiquettes sont posées quand l'action se termine.
    expect(cache.revalidateTag).toHaveBeenCalledTimes(3)
  })

  it('bascules de l’équipe : definirPublication et definirDisponibilite écrivent et répartissent', async () => {
    const { definirPublication } = await import('@/lib/curation')
    const { definirDisponibilite } = await import('@/lib/disponibilite')
    const ADMIN = { type: 'admin', userId: 'admin-1' } as never
    await oeuvre('nuit')
    expect(await definirDisponibilite(ADMIN, 'nuit', false)).toEqual({ ok: true })
    expect(await definirPublication(ADMIN, 'nuit', false)).toEqual({ ok: true })
    expect(await journal()).toEqual([
      { nom: 'DisponibiliteChangee', charge: { artworkId: 'id-nuit', artistId: 'artiste-1' } },
      { nom: 'PublicationChangee', charge: { artworkId: 'id-nuit', artistId: 'artiste-1' } },
    ])
    expect(cache.revalidateTag).toHaveBeenCalledTimes(6)
  })

  it('refus rendu (non levé) dans la transaction : ni événement ni répartition', async () => {
    const { definirDisponibilite } = await import('@/lib/disponibilite')
    await oeuvre('nuit', 'publiee', 'vendue_ailleurs')
    expect(await definirDisponibilite({ type: 'admin', userId: 'admin-1' } as never, 'nuit', true)).toEqual({
      ok: false,
      code: 'transition_interdite',
    })
    expect(await compter('Evenement')).toBe(0)
    expect(cache.revalidateTag).not.toHaveBeenCalled()
  })

  it('annulation d’une déclaration et remise en vente (deux événements)', async () => {
    const { declarerDisponibilite, annulerDeclaration } = await import('@/lib/disponibilite')
    const { remettreEnVente } = await import('@/lib/curation')
    await oeuvre('nuit')
    expect((await declarerDisponibilite(ARTISTE as never, 'nuit', 'vendue_ailleurs')).ok).toBe(true)
    expect(await annulerDeclaration(ARTISTE as never, 'nuit')).toEqual({ ok: true })
    expect((await declarerDisponibilite(ARTISTE as never, 'nuit', 'retiree')).ok).toBe(true)
    await db.query('DELETE FROM "Evenement"')
    expect((await remettreEnVente(ARTISTE as never, 'nuit')).ok).toBe(true)
    expect((await journal()).map((e) => e.nom).sort()).toEqual(['DisponibiliteChangee', 'PublicationChangee'])
  })

  it('annulation : un événement DisponibiliteChangee de plus', async () => {
    const { declarerDisponibilite, annulerDeclaration } = await import('@/lib/disponibilite')
    await oeuvre('nuit')
    await declarerDisponibilite(ARTISTE as never, 'nuit', 'retiree')
    await annulerDeclaration(ARTISTE as never, 'nuit')
    expect((await journal()).map((e) => e.nom)).toEqual(['DisponibiliteChangee', 'DisponibiliteChangee'])
  })

  it('marquerVendues : un événement par œuvre réellement passée en vendue, aucun au rejeu', async () => {
    const { marquerVendues } = await import('@/lib/disponibilite')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await oeuvre('p-dispo')
    await oeuvre('p-reservee', 'publiee', 'reservee')
    await oeuvre('p-deja-vendue', 'publiee', 'vendue')
    await oeuvre('p-ailleurs', 'publiee', 'vendue_ailleurs')
    const slugs = ['p-dispo', 'p-reservee', 'p-deja-vendue', 'p-ailleurs']
    await marquerVendues(slugs)
    expect((await journal()).map((e) => e.charge.artworkId).sort()).toEqual(['id-p-dispo', 'id-p-reservee'])
    await marquerVendues(slugs)
    expect(await compter('Evenement')).toBe(2)
  })
})
