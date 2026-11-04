import { renderToStaticMarkup } from 'react-dom/server'
import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  annulationAdmise,
  contactEquipeSeulement,
  dansLeDelai,
  declarationsPossibles,
  ecrireAEquipe,
  libelleEtat,
  libelleEtatArtiste,
  messageDeclaration,
  remiseEnVentePossible,
  type Disponibilite,
  type Publication,
} from '@/lib/disponibilite/etats'
import { DELAI_ANNULATION_DECLARATION_MINUTES } from '@/lib/reglages'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 2.8 (FR-21) : l'artiste tient la disponibilité de ses œuvres publiées — vendue ailleurs,
// retirée, annulation dans le délai, remise en vente (retour en curation), propriété, concurrence
// avec la curation, refus du checkout, fiche publique.

const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as Record<string, unknown> }))
const stripe = vi.hoisted(() => ({ creerSession: vi.fn() }))

// Le checkout exige une session (acheteur connecté).
vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'acheteur-1', email: 'acheteur@exemple.test' } })) }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('@/lib/acces', async (original) => ({
  ...(await original<typeof import('@/lib/acces')>()),
  acteurCourant: async () => acteur.courant,
}))
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({ checkout: { sessions: { create: stripe.creerSession } } }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, back: () => {} }),
  redirect: (url: string) => {
    throw new Error(`redirection:${url}`)
  },
  permanentRedirect: (url: string) => {
    throw new Error(`redirection-permanente:${url}`)
  },
  notFound: () => {
    throw new Error('introuvable')
  },
}))

const ADMIN = { type: 'admin', userId: 'admin-1' }
const ARTISTE = { type: 'artist', userId: 'utilisateur-1', artiste: { id: 'artiste-1', slug: 'mustapha-timija', name: 'Mustapha Timija' } }
const AUTRE_ARTISTE = { type: 'artist', userId: 'utilisateur-2', artiste: { id: 'artiste-2', slug: 'kara-walker', name: 'Kara Walker' } }
const VISITEUR = { type: 'visiteur' }
const TOUS = ['photos', 'couleurs', 'champs', 'prix_zones']

describe('règles pures', () => {
  const e = (publication: Publication | null, disponibilite: Disponibilite | null) => ({ publication, disponibilite })

  it('déclarations proposées seulement sur une œuvre publiée, disponible ou réservée', () => {
    expect(declarationsPossibles(e('publiee', 'disponible'))).toEqual(['vendue_ailleurs', 'retiree'])
    expect(declarationsPossibles(e('publiee', 'reservee'))).toEqual(['vendue_ailleurs', 'retiree'])
    for (const [p, d] of [
      ['publiee', 'vendue'], ['publiee', 'vendue_ailleurs'], ['publiee', 'retiree'],
      ['brouillon', 'disponible'], ['en_curation', 'disponible'], [null, null],
    ] as const) {
      expect(declarationsPossibles(e(p, d)), `${p}/${d}`).toEqual([])
    }
    expect(contactEquipeSeulement(e('publiee', 'vendue'))).toBe(true)
    expect(contactEquipeSeulement(e('publiee', 'disponible'))).toBe(false)
    expect(remiseEnVentePossible(e('publiee', 'retiree'))).toBe(true)
    expect(remiseEnVentePossible(e('publiee', 'vendue_ailleurs'))).toBe(false)
    expect(remiseEnVentePossible(e('brouillon', 'retiree'))).toBe(false)
  })

  it('badge artiste : « Publiée » pour une œuvre publiée et disponible ; « Disponible » ailleurs (administration)', () => {
    expect(libelleEtatArtiste(e('publiee', 'disponible'))).toBe('Publiée')
    expect(libelleEtat(e('publiee', 'disponible'))).toBe('Disponible')
    expect(libelleEtatArtiste(e('publiee', 'vendue_ailleurs'))).toBe('Vendue ailleurs')
  })

  it('« Écrire à l’équipe » : vendue, ou vendue ailleurs qui ne s’annule plus', () => {
    expect(ecrireAEquipe('vendue', false)).toBe(true)
    expect(ecrireAEquipe('vendue_ailleurs', false)).toBe(true)
    expect(ecrireAEquipe('vendue_ailleurs', true)).toBe(false)
    expect(ecrireAEquipe('retiree', false)).toBe(false)
    expect(ecrireAEquipe('disponible', false)).toBe(false)
  })

  it('annulation : non annulée, sans réservation interrompue, état inchangé, dans le délai', () => {
    const le = new Date('2026-11-04T09:12:00Z')
    const d = { type: 'retiree' as const, le, reservationInterrompue: false, annuleeLe: null }
    expect(annulationAdmise(d, e('publiee', 'retiree'))).toBe(true)
    expect(annulationAdmise(d, e('publiee', 'disponible'))).toBe(false)
    expect(annulationAdmise(d, e('en_curation', 'disponible'))).toBe(false)
    expect(annulationAdmise({ ...d, annuleeLe: le }, e('publiee', 'retiree'))).toBe(false)
    expect(annulationAdmise({ ...d, reservationInterrompue: true }, e('publiee', 'retiree'))).toBe(false)
    expect(DELAI_ANNULATION_DECLARATION_MINUTES).toBe(15)
    expect(dansLeDelai(d, new Date('2026-11-04T09:27:00Z'), 15)).toBe(true)
    expect(dansLeDelai(d, new Date('2026-11-04T09:27:01Z'), 15)).toBe(false)
  })

  it('bandeau : heure de Paris, « 10 h 12 »', () => {
    expect(messageDeclaration('vendue_ailleurs', new Date('2026-11-04T09:12:00Z'))).toBe('Vendue ailleurs à 10 h 12.')
    expect(messageDeclaration('retiree', new Date('2026-07-04T07:05:00Z'))).toBe('Retirée de la vente à 9 h 05.')
  })
})

describe('base : disponibilité tenue par l’artiste', () => {
  let base: BaseJetable
  let db: Client

  const etat = async (slug: string) =>
    (
      await db.query(
        `SELECT publication::text AS publication, disponibilite::text AS disponibilite, "envoyeeEnCurationLe"
         FROM "Artwork" WHERE slug = $1`,
        [slug],
      )
    ).rows[0]
  const declarations = async () =>
    (
      await db.query(
        `SELECT a.slug, d.type::text AS type, d."userId", d."reservationInterrompue", d."annuleeLe", d."createdAt"
         FROM "DeclarationDisponibilite" d JOIN "Artwork" a ON a.id = d."artworkId" ORDER BY d."createdAt"`,
      )
    ).rows

  async function oeuvre(slug: string, publication: Publication, disponibilite: Disponibilite, artiste = 'artiste-1') {
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes",
                              "hauteurMm", "largeurMm", publication, disponibilite, "artistId", "createdAt", "updatedAt")
       VALUES ($1, $1, $1, 2024, 'Huile', 'Histoire', 'https://res.cloudinary.com/x/image/upload/a.jpg',
               95000, 600, 800, $2::"Publication", $3::"Disponibilite", $4, now(), now())`,
      [slug, publication, disponibilite, artiste],
    )
  }

  const dispo = () => import('@/lib/disponibilite')

  beforeAll(async () => {
    base = await creerBaseJetable()
    process.env.DATABASE_URL = base.url
    db = new Client({ connectionString: base.url })
    await db.connect()
    await db.query(
      `INSERT INTO "User" (id, email, role, "updatedAt")
       VALUES ('admin-1', 'admin@exemple.test', 'admin', now()),
              ('utilisateur-1', 'mt@exemple.test', 'artist', now()),
              ('utilisateur-2', 'kw@exemple.test', 'artist', now())`,
    )
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt", "userId", "accordSigneLe")
       VALUES ('artiste-1', 'mustapha-timija', 'Mustapha Timija', 'MA', 1980, 'Bio', '', now(), 'utilisateur-1', '2026-11-01'),
              ('artiste-2', 'kara-walker', 'Kara Walker', 'US', 1969, 'Bio', '', now(), 'utilisateur-2', '2026-11-01')`,
    )
  })

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$disconnect()
    await db?.end()
    await base?.supprimer()
  })

  beforeEach(async () => {
    acteur.courant = VISITEUR
    await db.query('DELETE FROM "Artwork"')
  })

  describe('matrice', () => {
    it('vendue ailleurs : état, déclaration enregistrée avec son heure', async () => {
      const { declarerDisponibilite } = await dispo()
      await oeuvre('nuit', 'publiee', 'disponible')
      const avant = Date.now()
      const r = await declarerDisponibilite(ARTISTE as never, 'nuit', 'vendue_ailleurs')
      if (!r.ok) throw new Error(r.code)
      expect(r.declaration).toMatchObject({ type: 'vendue_ailleurs', reservationInterrompue: false, annuleeLe: null })
      expect(r.declaration.le.getTime()).toBeGreaterThanOrEqual(avant - 1000)
      expect(await etat('nuit')).toMatchObject({ publication: 'publiee', disponibilite: 'vendue_ailleurs' })
      expect(await declarations()).toMatchObject([
        { slug: 'nuit', type: 'vendue_ailleurs', userId: 'utilisateur-1', reservationInterrompue: false, annuleeLe: null },
      ])
    })

    it('retirer : `retiree`, la fiche publique redirige (301) vers la page de l’artiste', async () => {
      const { declarerDisponibilite } = await dispo()
      await oeuvre('aube', 'publiee', 'disponible')
      // Story 2.9 : la redirection suppose une page artiste publique (une autre œuvre visible).
      await oeuvre('autre-visible', 'publiee', 'disponible')
      expect(await declarerDisponibilite(ARTISTE as never, 'aube', 'retiree')).toMatchObject({ ok: true })
      expect(await etat('aube')).toMatchObject({ publication: 'publiee', disponibilite: 'retiree' })
      const { default: Fiche } = await import('@/app/galerie/[id]/page')
      await expect(Fiche({ params: { id: 'aube' } })).rejects.toThrow('redirection-permanente:/artistes/mustapha-timija')
    })

    it('réservée : la déclaration retient qu’elle a interrompu une réservation, et ne s’annule pas', async () => {
      const { annulerDeclaration, declarerDisponibilite } = await dispo()
      await oeuvre('reservee', 'publiee', 'reservee')
      expect(await declarerDisponibilite(ARTISTE as never, 'reservee', 'vendue_ailleurs')).toMatchObject({ ok: true })
      expect(await declarations()).toMatchObject([{ reservationInterrompue: true }])
      expect(await annulerDeclaration(ARTISTE as never, 'reservee')).toEqual({ ok: false, code: 'transition_interdite' })
      expect(await etat('reservee')).toMatchObject({ disponibilite: 'vendue_ailleurs' })
    })

    it('annuler : de nouveau disponible, déclaration marquée annulée ; une seconde fois : transition_interdite', async () => {
      const { annulerDeclaration, declarerDisponibilite } = await dispo()
      await oeuvre('nuit', 'publiee', 'disponible')
      await declarerDisponibilite(ARTISTE as never, 'nuit', 'vendue_ailleurs')
      expect(await annulerDeclaration(ARTISTE as never, 'nuit')).toEqual({ ok: true })
      expect(await etat('nuit')).toMatchObject({ publication: 'publiee', disponibilite: 'disponible' })
      const [d] = await declarations()
      expect(d.annuleeLe).not.toBeNull()
      expect(await annulerDeclaration(ARTISTE as never, 'nuit')).toEqual({ ok: false, code: 'transition_interdite' })
      expect(await etat('nuit')).toMatchObject({ disponibilite: 'disponible' })
    })

    it('annuler sans déclaration ou après un changement d’état : transition_interdite', async () => {
      const { annulerDeclaration, declarerDisponibilite } = await dispo()
      const { remettreEnVente } = await import('@/lib/curation')
      await oeuvre('jamais', 'publiee', 'disponible')
      expect(await annulerDeclaration(ARTISTE as never, 'jamais')).toEqual({ ok: false, code: 'transition_interdite' })
      await oeuvre('remise', 'publiee', 'disponible')
      await declarerDisponibilite(ARTISTE as never, 'remise', 'retiree')
      expect(await remettreEnVente(ARTISTE as never, 'remise')).toMatchObject({ ok: true })
      expect(await annulerDeclaration(ARTISTE as never, 'remise')).toEqual({ ok: false, code: 'transition_interdite' })
      expect(await etat('remise')).toMatchObject({ publication: 'en_curation', disponibilite: 'disponible' })
      // La déclaration « retirée » est close par la remise en vente : elle n'est plus en vigueur.
      const [close] = await declarations()
      expect(close).toMatchObject({ slug: 'remise', type: 'retiree' })
      expect(close.annuleeLe).not.toBeNull()
    })

    it('annuler après 15 minutes : delai_depasse, rien n’est écrit', async () => {
      const { annulerDeclaration, declarerDisponibilite } = await dispo()
      await oeuvre('tard', 'publiee', 'disponible')
      await declarerDisponibilite(ARTISTE as never, 'tard', 'retiree')
      await db.query(`UPDATE "DeclarationDisponibilite" SET "createdAt" = now() - interval '16 minutes'`)
      expect(await annulerDeclaration(ARTISTE as never, 'tard')).toEqual({ ok: false, code: 'delai_depasse' })
      expect(await etat('tard')).toMatchObject({ disponibilite: 'retiree' })
      expect((await declarations())[0].annuleeLe).toBeNull()
    })

    it('œuvre vendue : ni « Vendue ailleurs » ni retrait, requête forcée refusée ; lien vers l’équipe', async () => {
      const { declarerDisponibilite } = await dispo()
      await oeuvre('vendue', 'publiee', 'vendue')
      for (const type of ['vendue_ailleurs', 'retiree']) {
        expect(await declarerDisponibilite(ARTISTE as never, 'vendue', type)).toEqual({ ok: false, code: 'transition_interdite' })
      }
      expect(await etat('vendue')).toMatchObject({ disponibilite: 'vendue' })
      expect(await declarations()).toEqual([])
      const { oeuvresDeLArtiste } = await import('@/lib/catalogue')
      const [o] = (await oeuvresDeLArtiste('utilisateur-1'))!.oeuvres
      expect(o).toMatchObject({ declarations: [], contactEquipe: true, remiseEnVente: false })
    })

    it.each([
      ['brouillon' as const, 'disponible' as const],
      ['en_curation' as const, 'disponible' as const],
      ['publiee' as const, 'vendue_ailleurs' as const],
      ['publiee' as const, 'retiree' as const],
    ])('œuvre %s / %s : transition_interdite', async (publication, disponibilite) => {
      const { declarerDisponibilite } = await dispo()
      await oeuvre('x', publication, disponibilite)
      expect(await declarerDisponibilite(ARTISTE as never, 'x', 'retiree')).toEqual({ ok: false, code: 'transition_interdite' })
      expect(await etat('x')).toMatchObject({ publication, disponibilite })
    })

    it('type inconnu : transition_interdite ; œuvre inconnue : introuvable', async () => {
      const { declarerDisponibilite } = await dispo()
      await oeuvre('x', 'publiee', 'disponible')
      expect(await declarerDisponibilite(ARTISTE as never, 'x', 'vendue')).toEqual({ ok: false, code: 'transition_interdite' })
      expect(await declarerDisponibilite(ARTISTE as never, 'inconnue', 'retiree')).toEqual({ ok: false, code: 'introuvable' })
      expect(await etat('x')).toMatchObject({ disponibilite: 'disponible' })
    })

    it('remettre en vente : en curation, disponible, nouvelle date d’envoi, dans la file ; l’équipe la revalide', async () => {
      const { remettreEnVente, fileDeCuration, validerOeuvre } = await import('@/lib/curation')
      await oeuvre('retiree', 'publiee', 'retiree')
      const avant = Date.now()
      expect(await remettreEnVente(ARTISTE as never, 'retiree')).toEqual({ ok: true, slug: 'retiree' })
      const e = await etat('retiree')
      expect(e).toMatchObject({ publication: 'en_curation', disponibilite: 'disponible' })
      expect(new Date(e.envoyeeEnCurationLe).getTime()).toBeGreaterThanOrEqual(avant - 1000)
      expect(await declarations()).toEqual([])
      const file = await fileDeCuration(ADMIN as never)
      expect(file.ok && file.file.map((o) => o.slug)).toEqual(['retiree'])
      expect(await validerOeuvre(ADMIN as never, 'retiree', TOUS)).toMatchObject({ ok: true })
      expect(await etat('retiree')).toMatchObject({ publication: 'publiee', disponibilite: 'disponible' })
    })

    it.each([
      ['publiee' as const, 'disponible' as const],
      ['publiee' as const, 'vendue_ailleurs' as const],
      ['brouillon' as const, 'retiree' as const],
    ])('remettre en vente une œuvre %s / %s : transition_interdite', async (publication, disponibilite) => {
      const { remettreEnVente } = await import('@/lib/curation')
      await oeuvre('x', publication, disponibilite)
      expect(await remettreEnVente(ARTISTE as never, 'x')).toEqual({ ok: false, code: 'transition_interdite' })
      expect(await etat('x')).toMatchObject({ publication, disponibilite })
    })
  })

  describe('propriété', () => {
    it('œuvre d’un autre artiste : acces_refuse, rien n’est écrit', async () => {
      const { annulerDeclaration, declarerDisponibilite, dernieresDeclarations } = await dispo()
      const { remettreEnVente } = await import('@/lib/curation')
      await oeuvre('a-kara', 'publiee', 'disponible', 'artiste-2')
      await oeuvre('retiree-kara', 'publiee', 'retiree', 'artiste-2')
      expect(await declarerDisponibilite(ARTISTE as never, 'a-kara', 'retiree')).toEqual({ ok: false, code: 'acces_refuse' })
      expect(await remettreEnVente(ARTISTE as never, 'retiree-kara')).toEqual({ ok: false, code: 'acces_refuse' })
      expect(await declarerDisponibilite(AUTRE_ARTISTE as never, 'a-kara', 'retiree')).toMatchObject({ ok: true })
      expect(await annulerDeclaration(ARTISTE as never, 'a-kara')).toEqual({ ok: false, code: 'acces_refuse' })
      expect((await dernieresDeclarations(ARTISTE as never, ['a-kara'])).size).toBe(0)
      expect(await etat('a-kara')).toMatchObject({ disponibilite: 'retiree' })
      expect(await etat('retiree-kara')).toMatchObject({ publication: 'publiee', disponibilite: 'retiree' })
      expect(await declarations()).toHaveLength(1)
    })

    it.each([['admin', ADMIN], ['visiteur', VISITEUR], ['artiste sans fiche', { ...ARTISTE, artiste: null }]])(
      '%s : acces_refuse',
      async (_nom, qui) => {
        const { annulerDeclaration, declarerDisponibilite } = await dispo()
        const { remettreEnVente } = await import('@/lib/curation')
        await oeuvre('x', 'publiee', 'disponible')
        expect(await declarerDisponibilite(qui as never, 'x', 'retiree')).toEqual({ ok: false, code: 'acces_refuse' })
        expect(await annulerDeclaration(qui as never, 'x')).toEqual({ ok: false, code: 'acces_refuse' })
        expect(await remettreEnVente(qui as never, 'x')).toEqual({ ok: false, code: 'acces_refuse' })
        expect(await etat('x')).toMatchObject({ disponibilite: 'disponible' })
      },
    )
  })

  describe('concurrence (ligne verrouillée)', () => {
    it('deux déclarations simultanées : une seule passe, une seule déclaration', async () => {
      const { declarerDisponibilite } = await dispo()
      await oeuvre('double', 'publiee', 'disponible')
      for (let i = 0; i < 5; i++) {
        await db.query('DELETE FROM "DeclarationDisponibilite"')
        await db.query(`UPDATE "Artwork" SET disponibilite = 'disponible' WHERE slug = 'double'`)
        const resultats = await Promise.all([
          declarerDisponibilite(ARTISTE as never, 'double', 'vendue_ailleurs'),
          declarerDisponibilite(ARTISTE as never, 'double', 'retiree'),
        ])
        expect(resultats.filter((r) => r.ok)).toHaveLength(1)
        expect(resultats.filter((r) => !r.ok)).toEqual([{ ok: false, code: 'transition_interdite' }])
        const [d] = await declarations()
        expect(await declarations()).toHaveLength(1)
        expect(await etat('double')).toMatchObject({ disponibilite: d.type })
      }
    })

    it('déclaration pendant la validation de curation : jamais d’état incohérent', async () => {
      const { declarerDisponibilite } = await dispo()
      const { validerOeuvre } = await import('@/lib/curation')
      for (let i = 0; i < 5; i++) {
        await db.query('DELETE FROM "Artwork"')
        await oeuvre('en-file', 'en_curation', 'disponible')
        const [validation, declaration] = await Promise.all([
          validerOeuvre(ADMIN as never, 'en-file', TOUS),
          declarerDisponibilite(ARTISTE as never, 'en-file', 'retiree'),
        ])
        expect(validation).toMatchObject({ ok: true })
        const e = await etat('en-file')
        if (declaration.ok) {
          // La validation est passée la première : l'œuvre publiée a été retirée ensuite.
          expect(e).toMatchObject({ publication: 'publiee', disponibilite: 'retiree' })
          expect(await declarations()).toHaveLength(1)
        } else {
          expect(declaration).toEqual({ ok: false, code: 'transition_interdite' })
          expect(e).toMatchObject({ publication: 'publiee', disponibilite: 'disponible' })
          expect(await declarations()).toEqual([])
        }
      }
    })

    it('remise en vente pendant une validation : la validation ne publie que ce qui est en curation', async () => {
      const { validerOeuvre, remettreEnVente } = await import('@/lib/curation')
      for (let i = 0; i < 5; i++) {
        await db.query('DELETE FROM "Artwork"')
        await oeuvre('retiree', 'publiee', 'retiree')
        const [remise, validation] = await Promise.all([
          remettreEnVente(ARTISTE as never, 'retiree'),
          validerOeuvre(ADMIN as never, 'retiree', TOUS),
        ])
        expect(remise).toMatchObject({ ok: true })
        const e = await etat('retiree')
        if (validation.ok) expect(e).toMatchObject({ publication: 'publiee', disponibilite: 'disponible' })
        else {
          expect(validation).toEqual({ ok: false, code: 'transition_interdite' })
          expect(e).toMatchObject({ publication: 'en_curation', disponibilite: 'disponible' })
        }
      }
    })
  })

  describe('site public et paiement', () => {
    beforeEach(() => {
      vi.stubEnv('LOT2_OUVERT', 'oui')
      stripe.creerSession.mockReset().mockResolvedValue({ url: 'https://paiement.exemple.test/s' })
    })
    afterEach(() => vi.unstubAllEnvs())

    const payer = async (slug: string) => {
      const { POST } = await import('@/app/api/checkout/route')
      return POST(
        new Request('http://localhost/api/checkout', { method: 'POST', body: JSON.stringify({ items: [{ id: slug }] }) }) as never,
      )
    }

    it.each(['vendue_ailleurs', 'retiree'])('après « %s », le checkout refuse l’œuvre', async (type) => {
      const { declarerDisponibilite } = await dispo()
      await oeuvre('payable', 'publiee', 'disponible')
      expect((await payer('payable')).status).toBe(200)
      stripe.creerSession.mockClear()
      await declarerDisponibilite(ARTISTE as never, 'payable', type)
      const reponse = await payer('payable')
      expect(reponse.status).toBe(400)
      expect((await reponse.json()).error).toContain("n'est plus disponible")
      expect(stripe.creerSession).not.toHaveBeenCalled()
    })

    it('vendue ailleurs : la fiche reste affichée, marquée vendue (pas de panier)', async () => {
      const { declarerDisponibilite } = await dispo()
      const { getArtworkBySlug } = await import('@/lib/catalogue')
      await oeuvre('ailleurs', 'publiee', 'disponible')
      await declarerDisponibilite(ARTISTE as never, 'ailleurs', 'vendue_ailleurs')
      expect(await getArtworkBySlug('ailleurs')).toMatchObject({ id: 'ailleurs', sold: true })
      const { default: Fiche, revalidate } = await import('@/app/galerie/[id]/page')
      expect(revalidate).toBeLessThanOrEqual(60)
      await expect(Fiche({ params: { id: 'ailleurs' } })).resolves.toBeTruthy()
    })
  })

  describe('écran « Mes œuvres »', () => {
    const page = async (searchParams: Record<string, string> = {}) => {
      const { default: Page } = await import('@/app/dashboard/artiste/oeuvres/page')
      return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(searchParams) }))
    }

    it('badges, choix selon l’état, lien vers l’équipe, remise en vente', async () => {
      acteur.courant = ARTISTE
      await oeuvre('a-publiee', 'publiee', 'disponible')
      await oeuvre('b-vendue', 'publiee', 'vendue')
      await oeuvre('c-retiree', 'publiee', 'retiree')
      await oeuvre('d-brouillon', 'brouillon', 'disponible')
      const html = await page()
      for (const libelle of ['Publiée', 'Vendue', 'Retirée', 'Brouillon']) expect(html).toContain(libelle)
      expect(html.match(/Changer la disponibilité/g)).toHaveLength(1)
      expect(html.match(/Remettre en vente/g)).toHaveLength(1)
      expect(html).toContain('Écrire à l&#x27;équipe')
      expect(html).toContain('mailto:contact@errancy.art')
      expect(html).not.toContain('role="status"')
    })

    it('après une déclaration : bandeau avec l’heure et un seul « Annuler » ; après annulation : bandeau', async () => {
      const { declarerDisponibilite } = await dispo()
      acteur.courant = ARTISTE
      await oeuvre('nuit', 'publiee', 'disponible')
      await declarerDisponibilite(ARTISTE as never, 'nuit', 'vendue_ailleurs')
      const html = await page({ declaration: 'nuit' })
      expect(html).toMatch(/role="status"[^>]*>.*Vendue ailleurs à \d{1,2} h \d{2}\./)
      expect(html.match(/>Annuler</g)).toHaveLength(1)
      expect(html).not.toContain('Annuler (jusqu’à')

      // Sans le bandeau, « Annuler » reste proposé sur la ligne dans le délai (pas de lien vers l'équipe).
      const sansBandeau = await page()
      expect(sansBandeau).toContain('Annuler (jusqu’à')
      expect(sansBandeau).not.toContain('Écrire à l&#x27;équipe')
      expect(html).not.toContain('Écrire à l&#x27;équipe')

      // Au-delà du délai : plus d'« Annuler », ni dans le bandeau ni sur la ligne.
      await db.query(`UPDATE "DeclarationDisponibilite" SET "createdAt" = now() - interval '16 minutes'`)
      const tard = await page({ declaration: 'nuit' })
      expect(tard).toContain('Vendue ailleurs à')
      expect(tard).not.toContain('Annuler (jusqu’à')
      // Bandeau sans « Annuler » (le seul « Annuler » restant est celui de la feuille fermée).
      expect(tard).toMatch(/role="status"[^>]*><p[^>]*>Vendue ailleurs à [^<]*<\/p><\/div>/)
      // Plus d'« Annuler » : « Écrire à l'équipe » le remplace.
      expect(tard).toContain('Écrire à l&#x27;équipe')

      // Annulation (dans le délai) : bandeau de confirmation.
      await oeuvre('aube', 'publiee', 'disponible')
      await declarerDisponibilite(ARTISTE as never, 'aube', 'retiree')
      const { annulerDeclaration } = await dispo()
      expect(await annulerDeclaration(ARTISTE as never, 'aube')).toEqual({ ok: true })
      expect(await page({ annulee: 'aube' })).toMatch(/role="status".*Déclaration annulée : « aube » est de nouveau en vente\./)
    })

    it('fiche de l’œuvre : bandeau et un seul « Annuler » après une déclaration ; bandeau après annulation', async () => {
      const { declarerDisponibilite, annulerDeclaration } = await dispo()
      const { default: Fiche } = await import('@/app/dashboard/artiste/oeuvres/[slug]/page')
      const fiche = async (slug: string, searchParams: Record<string, string> = {}) =>
        renderToStaticMarkup(await Fiche({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(searchParams) }))
      acteur.courant = ARTISTE
      await oeuvre('nuit', 'publiee', 'disponible')

      const avant = await fiche('nuit')
      expect(avant).toContain('Changer la disponibilité')
      expect(avant).not.toContain('role="status"')

      await declarerDisponibilite(ARTISTE as never, 'nuit', 'vendue_ailleurs')
      const apres = await fiche('nuit', { declaration: '1' })
      expect(apres).toMatch(/role="status".*Vendue ailleurs à \d{1,2} h \d{2}\./)
      expect(apres.match(/>Annuler</g)).toHaveLength(1)
      expect(apres).not.toContain('Annuler (jusqu’à')
      expect(apres).not.toContain('Changer la disponibilité')

      expect(await annulerDeclaration(ARTISTE as never, 'nuit')).toEqual({ ok: true })
      const annulee = await fiche('nuit', { annulee: '1' })
      expect(annulee).toMatch(/role="status".*Déclaration annulée : l&#x27;œuvre est de nouveau en vente\./)
      expect(annulee).toContain('Changer la disponibilité')
    })

    it('liste vide : état vide prévu', async () => {
      acteur.courant = ARTISTE
      expect(await page()).toContain('Aucune œuvre')
    })

    it('actions serveur : redirection avec le bandeau, refus en message', async () => {
      const { actionDeclarer, actionAnnulerDeclaration, actionRemettreEnVente } = await import(
        '@/app/dashboard/artiste/oeuvres/disponibilite/actions'
      )
      acteur.courant = ARTISTE
      await oeuvre('nuit', 'publiee', 'disponible')
      await expect(actionDeclarer('nuit', 'retiree', 'liste')).rejects.toThrow('redirection:/dashboard/artiste/oeuvres?declaration=nuit')
      await expect(actionAnnulerDeclaration('nuit', 'fiche')).rejects.toThrow('redirection:/dashboard/artiste/oeuvres/nuit?annulee=1')
      expect(await actionRemettreEnVente('nuit')).toMatchObject({ ok: false, code: 'transition_interdite' })
      acteur.courant = AUTRE_ARTISTE
      const refus = await actionDeclarer('nuit', 'retiree', 'liste')
      expect(refus).toMatchObject({ ok: false, code: 'acces_refuse', message: 'Cette œuvre n’est pas accessible depuis votre compte.' })
    })
  })
})
