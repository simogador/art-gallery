import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 6.6 (FR-21, FR-31, NFR-4) : vente ailleurs pendant une réservation. Base réelle.

const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as { type: string; userId?: string } }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => acteur.courant }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }), headers: () => ({ get: () => null }) }))
vi.mock('@/lib/notifications/choix', () => ({
  envoiActif: () => ({ envoyer: async () => ({ ok: true }) }),
  choisirEnvoi: vi.fn(),
  envoiReel: () => false,
}))

const ADMIN = { type: 'admin', userId: 'admin-1' } as never
const ARTISTE_A = { type: 'artist', userId: 'user-a', artiste: { id: 'art-a' } } as never
const ARTISTE_B = { type: 'artist', userId: 'user-b', artiste: { id: 'art-b' } } as never
// o1 et o3 : artiste a ; o2 : artiste b ; 104000 chacune (prix + frais) → 312000.
const SAISIE = { email: 'claire@exemple.test', nom: 'Claire Martin', pays: 'FR', oeuvres: ['o1', 'o3', 'o2'] }
const TOTAL = 312000

describe('base : vente ailleurs pendant une réservation', () => {
  let base: BaseJetable
  let db: Client
  const compter = async (table: string, where = '') => Number((await db.query(`SELECT count(*) FROM "${table}" ${where}`)).rows[0].count)
  const etat = async (slug: string) => (await db.query(`SELECT disponibilite::text AS d FROM "Artwork" WHERE slug = $1`, [slug])).rows[0].d as string
  const issue = async (slug: string) =>
    (await db.query(`SELECT r.issue::text AS i FROM "Reservation" r JOIN "Artwork" a ON a.id = r."artworkId" WHERE a.slug = $1`, [slug])).rows[0]?.i as string | null
  const etatCommande = async (slug: string) =>
    (await db.query(`SELECT c.etat::text AS e FROM "Commande" c JOIN "LigneCommande" l ON l."commandeId" = c.id JOIN "Artwork" a ON a.id = l."artworkId" WHERE a.slug = $1`, [slug])).rows[0].e as string

  async function oeuvre(slug: string, artiste: string) {
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", devise,
         publication, disponibilite, "artistId", "updatedAt")
       VALUES ($1, $1, $2, 2024, 'Huile', 'D', 'https://res.cloudinary.com/x/p.jpg', 100000, 'EUR', 'publiee', 'disponible', $3, now())`,
      [slug, `Titre ${slug}`, artiste],
    )
    await db.query(
      `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", livree, "fraisCentimes", "preparationJours", "transportMinJours", "transportMaxJours", devise, "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'zone-ue', true, 4000, 3, 5, 9, 'EUR', now())`,
      [slug],
    )
  }

  async function poser(): Promise<string> {
    await oeuvre('o1', 'art-a')
    await oeuvre('o3', 'art-a')
    await oeuvre('o2', 'art-b')
    const { poserVenteAssistee } = await import('@/lib/commandes')
    const r = await poserVenteAssistee(ADMIN, SAISIE)
    if (!r.ok) throw new Error(`pose refusée : ${r.code}`)
    return r.passageId
  }

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
    for (const table of ['Incident', 'RemboursementCommande', 'Paiement', 'Jeton', 'Reservation', 'TraitementEvenement', 'Evenement', 'DeclarationDisponibilite', 'LigneCommande', 'Commande', 'CoordonneesAcheteur', 'PassageEnCaisse', 'OffreLivraison', 'ZonePays', 'Zone', 'Artwork', 'Artist']) {
      await db.query(`DELETE FROM "${table}"`)
    }
    for (const id of ['art-a', 'art-b']) {
      await db.query(
        `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "accordSigneLe", "updatedAt")
         VALUES ($1, $1, $1, 'MA', 1980, 'Bio', '', now(), now())`,
        [id],
      )
    }
    await db.query(`INSERT INTO "Zone" (id, nom, "updatedAt") VALUES ('zone-ue', 'Union européenne', now())`)
    await db.query(`INSERT INTO "ZonePays" ("codePays", "zoneId") VALUES ('FR', 'zone-ue')`)
  })

  it.each(['vendue_ailleurs', 'retiree'])('déclaration « %s » sur œuvre réservée : réservation interrompue, œuvre dans l’état déclaré, événement', async (type) => {
    const passage = await poser()
    const { declarerDisponibilite } = await import('@/lib/disponibilite')
    expect(await declarerDisponibilite(ARTISTE_A, 'o1', type)).toMatchObject({ ok: true, declaration: { reservationInterrompue: true } })
    expect(await etat('o1')).toBe(type)
    expect(await issue('o1')).toBe('interrompue')
    const ev = (await db.query(`SELECT charge FROM "Evenement" WHERE nom = 'ReservationAnnulee'`)).rows
    const o1 = (await db.query(`SELECT id FROM "Artwork" WHERE slug = 'o1'`)).rows[0].id
    expect(ev).toEqual([{ charge: { passageId: passage, artworkId: o1 } }])
  })

  it('commande de plusieurs œuvres annulée en entier, autres réservations libérées, autre artiste intact, incident écrit', async () => {
    await poser()
    const { declarerDisponibilite } = await import('@/lib/disponibilite')
    await declarerDisponibilite(ARTISTE_A, 'o1', 'vendue_ailleurs')
    expect(await etatCommande('o1')).toBe('annulee')
    expect(await etatCommande('o3')).toBe('annulee')
    expect(await etat('o1')).toBe('vendue_ailleurs')
    expect(await etat('o3')).toBe('disponible')
    expect(await issue('o3')).toBe('liberee')
    expect(await etatCommande('o2')).toBe('en_attente_paiement')
    expect(await etat('o2')).toBe('reservee')
    expect(await issue('o2')).toBeNull()
    const inc = (await db.query(`SELECT cause::text AS cause, "paiementId" FROM "Incident"`)).rows
    expect(inc).toEqual([{ cause: 'reservation_interrompue', paiementId: null }])
    expect(await compter('RemboursementCommande')).toBe(0)
    expect(await compter('Evenement', `WHERE nom = 'CommandeAnnulee'`)).toBe(1)
  })

  it('une autre œuvre du lot déjà retirée n’est jamais écrasée par la libération', async () => {
    await poser()
    const { declarerDisponibilite } = await import('@/lib/disponibilite')
    await declarerDisponibilite(ARTISTE_A, 'o3', 'retiree')
    await declarerDisponibilite(ARTISTE_A, 'o1', 'vendue_ailleurs')
    expect(await etat('o3')).toBe('retiree')
    expect(await etat('o1')).toBe('vendue_ailleurs')
    expect(await compter('Incident')).toBe(1)
  })

  it('rejeu du gestionnaire ou de l’événement : un seul incident, une seule annulation', async () => {
    const passage = await poser()
    const { declarerDisponibilite } = await import('@/lib/disponibilite')
    await declarerDisponibilite(ARTISTE_A, 'o1', 'vendue_ailleurs')
    const { annulerSuiteReservationAnnulee } = await import('@/lib/commandes')
    const o1 = (await db.query(`SELECT id FROM "Artwork" WHERE slug = 'o1'`)).rows[0].id
    await annulerSuiteReservationAnnulee({ id: 'x', version: 1, nom: 'ReservationAnnulee', charge: { passageId: passage, artworkId: o1 } })
    const { repartir } = await import('@/lib/evenements')
    const idEv = (await db.query(`SELECT id FROM "Evenement" WHERE nom = 'ReservationAnnulee'`)).rows[0].id
    await repartir([idEv])
    expect(await compter('Incident')).toBe(1)
    expect(await compter('Evenement', `WHERE nom = 'CommandeAnnulee'`)).toBe(1)
  })

  it('commande déjà confirmée ou déjà annulée : le gestionnaire ne change rien', async () => {
    const passage = await poser()
    const { annulerCommande, annulerSuiteReservationAnnulee } = await import('@/lib/commandes')
    const o2 = (await db.query(`SELECT id FROM "Artwork" WHERE slug = 'o2'`)).rows[0].id
    const c2 = (await db.query(`SELECT c.id FROM "Commande" c JOIN "LigneCommande" l ON l."commandeId" = c.id WHERE l."artworkId" = $1`, [o2])).rows[0].id
    await annulerCommande(ADMIN, c2)
    const avant = await compter('Evenement')
    await annulerSuiteReservationAnnulee({ id: 'x', version: 1, nom: 'ReservationAnnulee', charge: { passageId: passage, artworkId: o2 } })
    expect(await compter('Incident')).toBe(0)
    expect(await compter('Evenement')).toBe(avant)
    // Confirmée : aucune annulation.
    await db.query(`UPDATE "Commande" SET etat = 'confirmee' WHERE id = $1`, [(await db.query(`SELECT c.id FROM "Commande" c JOIN "LigneCommande" l ON l."commandeId" = c.id WHERE l."artworkId" = (SELECT id FROM "Artwork" WHERE slug = 'o1')`)).rows[0].id])
    const o1 = (await db.query(`SELECT id FROM "Artwork" WHERE slug = 'o1'`)).rows[0].id
    await annulerSuiteReservationAnnulee({ id: 'y', version: 1, nom: 'ReservationAnnulee', charge: { passageId: passage, artworkId: o1 } })
    expect(await etatCommande('o1')).toBe('confirmee')
    expect(await compter('Incident')).toBe(0)
  })

  it('paiement constaté ensuite : remboursement et incident pour la commande annulée, jamais de vente ; les autres sont confirmées', async () => {
    const passage = await poser()
    const { declarerDisponibilite } = await import('@/lib/disponibilite')
    await declarerDisponibilite(ARTISTE_A, 'o1', 'vendue_ailleurs')
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    const r = await traiterPaiementConstate(ADMIN, { passageId: passage, source: 'constat_manuel', referenceExterne: 'VIR-1', montantCentimes: TOTAL, constatePar: 'admin-1', constateLe: new Date() })
    expect(r).toMatchObject({ ok: true, commandes: 1, annulees: 1 })
    expect(await etat('o1')).toBe('vendue_ailleurs')
    expect(await etat('o3')).toBe('disponible')
    expect(await etat('o2')).toBe('vendue')
    expect(await etatCommande('o1')).toBe('annulee')
    expect((await db.query(`SELECT "montantCentimes", etat::text AS etat FROM "RemboursementCommande"`)).rows).toEqual([{ montantCentimes: 208000, etat: 'demande' }])
    expect(await compter('Incident', `WHERE cause = 'commande_annulee'`)).toBe(1)
    expect(await compter('Incident', `WHERE cause = 'reservation_interrompue'`)).toBe(1)
  })

  it('gestionnaire non exécuté (limite c) : déclaration et réservation interrompue tiennent, la commande reste en attente, l’équipe l’annule', async () => {
    await poser()
    const { declarerDisponibilite } = await import('@/lib/disponibilite')
    await declarerDisponibilite(ARTISTE_A, 'o1', 'vendue_ailleurs')
    // État laissé par un gestionnaire qui n'a pas tourné : on défait ses effets à la main.
    await db.query(`DELETE FROM "Incident"`)
    await db.query(`UPDATE "Commande" SET etat = 'en_attente_paiement'`)
    await db.query(`UPDATE "Reservation" SET issue = NULL, "issueLe" = NULL WHERE "artworkId" = (SELECT id FROM "Artwork" WHERE slug = 'o3')`)
    await db.query(`UPDATE "Artwork" SET disponibilite = 'reservee' WHERE slug = 'o3'`)
    expect(await etat('o1')).toBe('vendue_ailleurs')
    expect(await issue('o1')).toBe('interrompue')
    expect(await etatCommande('o1')).toBe('en_attente_paiement')
    expect(await compter('Incident', `WHERE cause = 'reservation_interrompue'`)).toBe(0)

    const { annulerCommande } = await import('@/lib/commandes')
    const c1 = (await db.query(`SELECT c.id FROM "Commande" c JOIN "LigneCommande" l ON l."commandeId" = c.id JOIN "Artwork" a ON a.id = l."artworkId" WHERE a.slug = 'o1'`)).rows[0].id
    expect(await annulerCommande(ADMIN, c1)).toMatchObject({ ok: true })
    expect(await etatCommande('o1')).toBe('annulee')
    expect(await etat('o1')).toBe('vendue_ailleurs')
    expect(await etat('o3')).toBe('disponible')
  })

  it('œuvre non réservée : aucun événement ReservationAnnulee', async () => {
    await oeuvre('o1', 'art-a')
    const { declarerDisponibilite } = await import('@/lib/disponibilite')
    expect(await declarerDisponibilite(ARTISTE_A, 'o1', 'vendue_ailleurs')).toMatchObject({ ok: true, declaration: { reservationInterrompue: false } })
    expect(await compter('Evenement', `WHERE nom = 'ReservationAnnulee'`)).toBe(0)
  })

  it('œuvre d’un autre artiste : refus, réservation et commande intactes', async () => {
    await poser()
    const { declarerDisponibilite } = await import('@/lib/disponibilite')
    expect(await declarerDisponibilite(ARTISTE_B, 'o1', 'vendue_ailleurs')).toEqual({ ok: false, code: 'acces_refuse' })
    expect(await etat('o1')).toBe('reservee')
    expect(await issue('o1')).toBeNull()
    expect(await compter('Evenement', `WHERE nom = 'ReservationAnnulee'`)).toBe(0)
  })

  it('bandeau de l’artiste : déclaration non annulable, texte de l’épic', async () => {
    await poser()
    const { declarerDisponibilite, derniereDeclaration } = await import('@/lib/disponibilite')
    await declarerDisponibilite(ARTISTE_A, 'o1', 'vendue_ailleurs')
    const d = await derniereDeclaration(ARTISTE_A, 'o1')
    expect(d).toMatchObject({ reservationInterrompue: true, annulable: false })
    const { fr } = await import('@/lib/i18n')
    expect(fr.declarationReservee.bandeau).toBe(
      'Un acheteur avait réservé cette œuvre. L’équipe Errancy le prévient et s’occupe d’un éventuel remboursement. Vous n’avez rien à faire.',
    )
  })
})

describe('catalogue et abonnements', () => {
  it('ReservationAnnulee : ids seulement, un gestionnaire de commandes', async () => {
    const { evenementValide } = await import('@/lib/evenements/catalogue')
    expect(evenementValide({ nom: 'ReservationAnnulee', charge: { passageId: 'p', artworkId: 'a' } })).toBe(true)
    expect(evenementValide({ nom: 'ReservationAnnulee', charge: { passageId: 'p', artworkId: 'a', email: 'x@y.z' } })).toBe(false)
    expect(evenementValide({ nom: 'ReservationAnnulee', charge: { passageId: 'p' } })).toBe(false)
    const { ABONNEMENTS } = await import('@/lib/abonnements')
    expect(ABONNEMENTS.ReservationAnnulee.map((a) => a.nom)).toEqual(['annulerSuiteReservationAnnulee'])
  })
})
