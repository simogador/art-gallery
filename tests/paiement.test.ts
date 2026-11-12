import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 6.4 (FR-13, AD-4, AD-8) : paiement constaté par l'équipe et confirmation idempotente. Base réelle.

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
const AUTRES = [{ type: 'visiteur' }, { type: 'user', userId: 'u1' }, { type: 'artist', userId: 'u2', artiste: null }] as never[]
const SAISIE = { email: 'claire@exemple.test', nom: 'Claire Martin', pays: 'FR', oeuvres: ['o1', 'o2'] }
// o1 : 100000 + 4000 ; o2 : 100000 + 4000 → 208000.
const TOTAL = 208000

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom)
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(ts|tsx)$/.test(nom) ? [chemin] : []
  })
}

describe('module paiement (pur)', () => {
  it('constat manuel : référence et montant contrôlés, qui, quand', async () => {
    const { constaterManuellement, lireReference } = await import('@/lib/paiement')
    expect(lireReference('  VIR-1 ')).toBe('VIR-1')
    for (const v of ['', '   ', 'a\nb', 'x'.repeat(121), 5, null]) expect(lireReference(v)).toBeNull()
    const quand = new Date('2026-11-12T10:00:00Z')
    expect(constaterManuellement({ passageId: 'p', reference: ' R1 ', montantCentimes: 5000, par: 'u', quand })).toEqual({
      passageId: 'p', source: 'constat_manuel', referenceExterne: 'R1', montantCentimes: 5000, constatePar: 'u', constateLe: quand,
    })
    for (const m of [0, -1, 1.5, '5', NaN]) expect(constaterManuellement({ passageId: 'p', reference: 'R', montantCentimes: m, par: 'u' })).toBeNull()
    expect(constaterManuellement({ passageId: 'p', reference: '', montantCentimes: 100, par: 'u' })).toBeNull()
  })

  it('aucun nom de prestataire de paiement dans les modules paiement et commandes hors adaptateurs/', () => {
    const SRC = path.join(__dirname, '..', 'src')
    const nom = /stripe|paypal|mollie|adyen|payplug|checkout\.com|square|braintree|lemonway/i
    const trouves = [path.join(SRC, 'lib', 'paiement'), path.join(SRC, 'lib', 'commandes')]
      .flatMap(fichiers)
      .filter((f) => !path.relative(SRC, f).split(path.sep).join('/').startsWith('lib/paiement/adaptateurs/'))
      .filter((f) => nom.test(readFileSync(f, 'utf8')))
    expect(trouves).toEqual([])
  })

  it('événements au catalogue : l’id seulement, sans gestionnaire d’e-mail', async () => {
    const { evenementValide } = await import('@/lib/evenements/catalogue')
    expect(evenementValide({ nom: 'PaiementConstate', charge: { paiementId: 'x' } })).toBe(true)
    expect(evenementValide({ nom: 'PaiementConstate', charge: { paiementId: 'x', montant: 1 } })).toBe(false)
    expect(evenementValide({ nom: 'CommandeConfirmee', charge: { commandeId: 'x' } })).toBe(true)
    expect(evenementValide({ nom: 'CommandeConfirmee', charge: { paiementId: 'x' } })).toBe(false)
    const { ABONNEMENTS } = await import('@/lib/abonnements')
    expect(ABONNEMENTS.PaiementConstate).toEqual([])
    expect(ABONNEMENTS.CommandeConfirmee).toEqual([])
    expect(evenementValide({ nom: 'CommandeAnnulee', charge: { commandeId: 'x' } })).toBe(true)
    expect(evenementValide({ nom: 'CommandeAnnulee', charge: { commandeId: 'x', email: 'a@b.c' } })).toBe(false)
    expect(ABONNEMENTS.CommandeAnnulee).toEqual([])
  })

  it('remboursement manuel : aucun appel externe, demande acceptée sans référence', async () => {
    const { remboursementManuel } = await import('@/lib/paiement')
    expect(await remboursementManuel.rembourser({ paiementId: 'p', montantCentimes: 100 })).toEqual({ ok: true })
  })
})

describe('base : paiement constaté', () => {
  let base: BaseJetable
  let db: Client
  const compter = async (table: string, where = '') => Number((await db.query(`SELECT count(*) FROM "${table}" ${where}`)).rows[0].count)
  const etat = async (slug: string) => (await db.query(`SELECT disponibilite::text AS d FROM "Artwork" WHERE slug = $1`, [slug])).rows[0].d as string

  async function oeuvre(slug: string, artiste = 'art-a') {
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
    await oeuvre('o2', 'art-b')
    const { poserVenteAssistee } = await import('@/lib/commandes')
    const r = await poserVenteAssistee(ADMIN, SAISIE)
    if (!r.ok) throw new Error(`pose refusée : ${r.code}`)
    return r.passageId
  }

  const fait = (passageId: string, surcharge: Record<string, unknown> = {}) => ({
    passageId,
    source: 'constat_manuel',
    referenceExterne: 'VIR-1',
    montantCentimes: TOTAL,
    constatePar: 'admin-1',
    constateLe: new Date(),
    ...surcharge,
  })

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
    acteur.courant = { type: 'visiteur' }
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

  it.each([0, 1, 2])('acteur non admin (%#) : acces_refuse, rien écrit', async (i) => {
    const passage = await poser()
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(AUTRES[i], fait(passage))).toEqual({ ok: false, code: 'acces_refuse' })
    expect(await compter('Paiement')).toBe(0)
    expect(await compter('Incident')).toBe(0)
    expect(await compter('Commande', `WHERE etat = 'confirmee'`)).toBe(0)
    expect(await etat('o1')).toBe('reservee')
  })

  it('constat valide : paiement constaté, œuvres vendues, réservations confirmées, commandes confirmées, événements', async () => {
    const passage = await poser()
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    const r = await traiterPaiementConstate(ADMIN, fait(passage))
    expect(r).toMatchObject({ ok: true, commandes: 2, dejaConstate: false })

    const p = (await db.query(`SELECT etat::text AS etat, source, "referenceExterne", "montantCentimes", "constatePar", "constateLe" FROM "Paiement"`)).rows
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({ etat: 'constate', source: 'constat_manuel', referenceExterne: 'VIR-1', montantCentimes: TOTAL, constatePar: 'admin-1' })
    expect(p[0].constateLe).toBeInstanceOf(Date)
    expect(await etat('o1')).toBe('vendue')
    expect(await etat('o2')).toBe('vendue')
    const res = (await db.query(`SELECT issue::text AS issue FROM "Reservation"`)).rows
    expect(res).toHaveLength(2)
    for (const l of res) expect(l.issue).toBe('confirmee')
    expect(await compter('Commande', `WHERE etat = 'confirmee'`)).toBe(2)
    expect(await compter('Commande', `WHERE etat = 'en_attente_paiement'`)).toBe(0)
    expect(await compter('Incident')).toBe(0)

    const evts = (await db.query(`SELECT nom, charge FROM "Evenement" WHERE nom IN ('PaiementConstate', 'CommandeConfirmee') ORDER BY nom`)).rows
    expect(evts.filter((e) => e.nom === 'PaiementConstate')).toEqual([{ nom: 'PaiementConstate', charge: { paiementId: (r as { paiementId: string }).paiementId } }])
    expect(evts.filter((e) => e.nom === 'CommandeConfirmee')).toHaveLength(2)
    expect(await compter('Evenement', `WHERE nom = 'DisponibiliteChangee'`)).toBeGreaterThanOrEqual(4)
  })

  it('même constat rejoué, ou autre référence pour un passage déjà constaté : rien ne change', async () => {
    const passage = await poser()
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    await traiterPaiementConstate(ADMIN, fait(passage))
    const avant = [await compter('Evenement'), await compter('Paiement'), await compter('Incident')]
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: true, dejaConstate: true })
    expect(await traiterPaiementConstate(ADMIN, fait(passage, { referenceExterne: 'VIR-2' }))).toMatchObject({ ok: true, dejaConstate: true })
    expect([await compter('Evenement'), await compter('Paiement'), await compter('Incident')]).toEqual(avant)
    expect(await compter('Paiement', `WHERE etat = 'constate'`)).toBe(1)
  })

  it('deux constats simultanés : un seul vend', async () => {
    const passage = await poser()
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    const rs = await Promise.all([
      traiterPaiementConstate(ADMIN, fait(passage)),
      traiterPaiementConstate(ADMIN, fait(passage, { referenceExterne: 'VIR-2' })),
      traiterPaiementConstate(ADMIN, fait(passage)),
    ])
    expect(rs.every((r) => r.ok)).toBe(true)
    expect(rs.filter((r) => r.ok && !r.dejaConstate)).toHaveLength(1)
    expect(await compter('Paiement', `WHERE etat = 'constate'`)).toBe(1)
    expect(await compter('Paiement')).toBe(1)
    expect(await compter('Evenement', `WHERE nom = 'PaiementConstate'`)).toBe(1)
    expect(await compter('Commande', `WHERE etat = 'confirmee'`)).toBe(2)
  })

  it('montant différent : rien confirmé, incident montant_different, paiement resté ouvert', async () => {
    const passage = await poser()
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    const r = await traiterPaiementConstate(ADMIN, fait(passage, { montantCentimes: TOTAL - 1 }))
    expect(r).toMatchObject({ ok: false, code: 'refuse', cause: 'montant_different' })
    expect(await compter('Commande', `WHERE etat = 'confirmee'`)).toBe(0)
    expect(await etat('o1')).toBe('reservee')
    expect(await compter('Reservation', `WHERE issue IS NOT NULL`)).toBe(0)
    expect(await compter('Paiement', `WHERE etat = 'ouvert'`)).toBe(1)
    const incidents = (await db.query(`SELECT cause::text AS cause, "attenduCentimes", "recuCentimes", "traiteLe", "paiementId" FROM "Incident"`)).rows
    expect(incidents).toHaveLength(1)
    expect(incidents[0]).toMatchObject({ cause: 'montant_different', attenduCentimes: TOTAL, recuCentimes: TOTAL - 1, traiteLe: null })
    expect(incidents[0].paiementId).not.toBeNull()
    expect(await compter('Evenement', `WHERE nom = 'PaiementConstate'`)).toBe(0)

    // Le même refus rejoué n'écrit pas un second incident ; le bon montant ensuite confirme.
    await traiterPaiementConstate(ADMIN, fait(passage, { montantCentimes: TOTAL - 1 }))
    expect(await compter('Incident')).toBe(1)
    expect(await traiterPaiementConstate(ADMIN, fait(passage, { referenceExterne: 'VIR-2' }))).toMatchObject({ ok: true, dejaConstate: false })
    expect(await compter('Paiement')).toBe(1)
    expect(await compter('Commande', `WHERE etat = 'confirmee'`)).toBe(2)
  })

  it('devise différente : rien confirmé, incident devise_differente', async () => {
    const passage = await poser()
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    const r = await traiterPaiementConstate(ADMIN, fait(passage, { devise: 'usd' }))
    expect(r).toMatchObject({ ok: false, code: 'refuse', cause: 'devise_differente' })
    expect(await compter('Incident', `WHERE cause = 'devise_differente'`)).toBe(1)
    expect(await compter('Commande', `WHERE etat = 'confirmee'`)).toBe(0)
    expect(await etat('o2')).toBe('reservee')
  })

  const commandeDe = async (slug: string) =>
    (await db.query(`SELECT c.id, c.etat::text AS etat FROM "Commande" c JOIN "LigneCommande" l ON l."commandeId" = c.id WHERE l.slug = $1`, [slug])).rows[0] as { id: string; etat: string }

  it('œuvre vendue ailleurs : seule sa commande est annulée (remboursement et incident), l’autre est confirmée', async () => {
    const passage = await poser()
    await db.query(`UPDATE "Artwork" SET disponibilite = 'vendue_ailleurs' WHERE slug = 'o2'`)
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    const r = await traiterPaiementConstate(ADMIN, fait(passage))
    expect(r).toMatchObject({ ok: true, commandes: 1, annulees: 1, dejaConstate: false })
    expect(await etat('o1')).toBe('vendue')
    expect(await etat('o2')).toBe('vendue_ailleurs')
    const c1 = await commandeDe('o1')
    const c2 = await commandeDe('o2')
    expect([c1.etat, c2.etat]).toEqual(['confirmee', 'annulee'])
    expect(await compter('Paiement', `WHERE etat = 'constate'`)).toBe(1)
    const remb = (await db.query(`SELECT "commandeId", "montantCentimes", devise, etat::text AS etat, "effectuePar", "paiementId" FROM "RemboursementCommande"`)).rows
    expect(remb).toHaveLength(1)
    expect(remb[0]).toMatchObject({ commandeId: c2.id, montantCentimes: 104000, devise: 'EUR', etat: 'demande', effectuePar: null })
    expect(remb[0].paiementId).not.toBeNull()
    const inc = (await db.query(`SELECT cause::text AS cause, "commandeId", "attenduCentimes", "recuCentimes" FROM "Incident"`)).rows
    expect(inc).toEqual([{ cause: 'oeuvre_indisponible', commandeId: c2.id, attenduCentimes: 104000, recuCentimes: TOTAL }])
    expect(await compter('Evenement', `WHERE nom = 'CommandeAnnulee'`)).toBe(1)
    expect(await compter('Evenement', `WHERE nom = 'CommandeConfirmee'`)).toBe(1)
    expect((await db.query(`SELECT issue::text AS issue FROM "Reservation" WHERE "artworkId" = 'o1'`)).rows[0].issue).toBe('confirmee')
    expect((await db.query(`SELECT issue::text AS issue FROM "Reservation" WHERE "artworkId" = 'o2'`)).rows[0].issue).toBe('liberee')

    // Rejeu : aucun second remboursement ni incident.
    const avant = [await compter('Evenement'), await compter('RemboursementCommande'), await compter('Incident')]
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: true, dejaConstate: true })
    expect(await traiterPaiementConstate(ADMIN, fait(passage, { referenceExterne: 'VIR-2' }))).toMatchObject({ ok: true, dejaConstate: true })
    expect([await compter('Evenement'), await compter('RemboursementCommande'), await compter('Incident')]).toEqual(avant)
  })

  it('œuvre réservée par un autre passage : sa commande est annulée, la réservation de l’autre n’est pas écrasée', async () => {
    const passage = await poser()
    // Réservation de ce passage libérée, puis une autre en cours par un autre passage.
    await db.query(`UPDATE "Reservation" SET issue = 'liberee', "issueLe" = now() WHERE "artworkId" = 'o1'`)
    await db.query(
      `INSERT INTO "Reservation" (id, "artworkId", "passageId", origine, echeance) VALUES ('r-autre', 'o1', 'autre-passage', 'paiement', now() + interval '1 hour')`,
    )
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: true, commandes: 1, annulees: 1 })
    expect((await commandeDe('o1')).etat).toBe('annulee')
    expect((await commandeDe('o2')).etat).toBe('confirmee')
    expect(await etat('o1')).toBe('reservee')
    expect(await etat('o2')).toBe('vendue')
    expect(await compter('Reservation', `WHERE id = 'r-autre' AND issue IS NULL`)).toBe(1)
    expect(await compter('RemboursementCommande')).toBe(1)
    expect(await compter('Incident', `WHERE cause = 'oeuvre_indisponible'`)).toBe(1)
  })

  it('toutes les œuvres prises : toutes les commandes annulées et remboursées, paiement constaté, rien vendu', async () => {
    const passage = await poser()
    await db.query(`UPDATE "Artwork" SET disponibilite = 'retiree'`)
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: true, commandes: 0, annulees: 2 })
    expect(await compter('Commande', `WHERE etat = 'annulee'`)).toBe(2)
    expect(await compter('RemboursementCommande')).toBe(2)
    expect((await db.query(`SELECT sum("montantCentimes")::int AS s FROM "RemboursementCommande"`)).rows[0].s).toBe(TOTAL)
    expect(await compter('Paiement', `WHERE etat = 'constate'`)).toBe(1)
    expect(await etat('o1')).toBe('retiree')
  })

  it('paiement tardif, œuvres libres (réservation échue, avant l’abandon) : commandes confirmées, œuvres vendues', async () => {
    const passage = await poser()
    await db.query(`UPDATE "Reservation" SET echeance = now() - interval '1 day'`)
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: true, commandes: 2, annulees: 0 })
    expect(await compter('Commande', `WHERE etat = 'confirmee'`)).toBe(2)
    expect(await compter('RemboursementCommande')).toBe(0)
    expect(await compter('Incident')).toBe(0)
  })

  it('échéance d’abandon dépassée : cette commande est annulée (œuvre libérée, remboursement, incident), les autres confirmées', async () => {
    const passage = await poser()
    const c1 = await commandeDe('o1')
    await db.query(`UPDATE "Commande" SET "abandonneLe" = now() - interval '1 hour' WHERE id = $1`, [c1.id])
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: true, commandes: 1, annulees: 1 })
    expect((await commandeDe('o1')).etat).toBe('annulee')
    expect((await commandeDe('o2')).etat).toBe('confirmee')
    expect(await etat('o1')).toBe('disponible')
    expect(await etat('o2')).toBe('vendue')
    expect(await compter('Incident', `WHERE cause = 'commande_annulee' AND "commandeId" = '${c1.id}'`)).toBe(1)
    expect(await compter('RemboursementCommande', `WHERE "commandeId" = '${c1.id}' AND "montantCentimes" = 104000`)).toBe(1)
  })

  it('commande sans échéance d’abandon (ancienne) : jamais jugée abandonnée', async () => {
    const passage = await poser()
    await db.query(`UPDATE "Commande" SET "abandonneLe" = NULL`)
    await db.query(`UPDATE "Reservation" SET echeance = now() - interval '30 days'`)
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: true, commandes: 2, annulees: 0 })
  })

  it('commande déjà annulée par l’équipe : jamais confirmée, remboursement et incident ; les autres confirmées', async () => {
    const passage = await poser()
    const { annulerCommande, traiterPaiementConstate } = await import('@/lib/commandes')
    const c2 = await commandeDe('o2')
    expect(await annulerCommande(ADMIN, c2.id)).toEqual({ ok: true, dejaAnnulee: false })
    expect(await compter('RemboursementCommande')).toBe(0)
    // Le montant reste celui du passage entier : la commande annulée en fait partie.
    expect(await traiterPaiementConstate(ADMIN, fait(passage, { montantCentimes: 5000 }))).toMatchObject({ ok: false, code: 'refuse', cause: 'montant_different' })
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: true, commandes: 1, annulees: 1 })
    expect((await commandeDe('o2')).etat).toBe('annulee')
    expect((await commandeDe('o1')).etat).toBe('confirmee')
    expect(await compter('RemboursementCommande', `WHERE "commandeId" = '${c2.id}'`)).toBe(1)
    expect(await compter('Incident', `WHERE cause = 'commande_annulee' AND "commandeId" = '${c2.id}'`)).toBe(1)
    expect(await etat('o2')).toBe('disponible')
    // Un seul remboursement par commande : contrainte en base.
    await expect(
      db.query(`INSERT INTO "RemboursementCommande" (id, "commandeId", "montantCentimes", devise) VALUES ('dup', $1, 1, 'EUR')`, [c2.id]),
    ).rejects.toThrow()
  })

  it('toutes les commandes annulées par l’équipe puis paiement reçu : remboursées, jamais confirmées', async () => {
    const passage = await poser()
    const { annulerCommande, traiterPaiementConstate } = await import('@/lib/commandes')
    await annulerCommande(ADMIN, (await commandeDe('o1')).id)
    await annulerCommande(ADMIN, (await commandeDe('o2')).id)
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: true, commandes: 0, annulees: 2 })
    expect(await compter('Commande', `WHERE etat = 'confirmee'`)).toBe(0)
    expect(await compter('RemboursementCommande')).toBe(2)
    expect(await compter('Incident', `WHERE cause = 'commande_annulee'`)).toBe(2)
  })

  it('l’échéance d’abandon est posée à la création (7 jours après la réservation de 48 h) et l’expiration de la réservation n’annule rien', async () => {
    await poser()
    const lignes = (await db.query(`SELECT extract(epoch FROM ("abandonneLe" - now())) / 86400 AS jours FROM "Commande"`)).rows
    for (const l of lignes) expect(Number(l.jours)).toBeGreaterThan(8.9)
    for (const l of lignes) expect(Number(l.jours)).toBeLessThan(9.1)
    const { libererReservationsEchues } = await import('@/lib/disponibilite')
    await db.query(`UPDATE "Reservation" SET echeance = now() - interval '1 hour'`)
    await libererReservationsEchues()
    expect(await compter('Commande', `WHERE etat = 'en_attente_paiement'`)).toBe(2)
  })

  it('passage inconnu ou sans commande, entrées invalides : refus, rien écrit', async () => {
    const passage = await poser()
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, fait('inconnu'))).toEqual({ ok: false, code: 'introuvable' })
    for (const m of [0, -5, 1.5, NaN]) expect(await traiterPaiementConstate(ADMIN, fait(passage, { montantCentimes: m }))).toEqual({ ok: false, code: 'invalide' })
    expect(await traiterPaiementConstate(ADMIN, fait(passage, { referenceExterne: '  ' }))).toEqual({ ok: false, code: 'invalide' })
    await db.query(`DELETE FROM "LigneCommande"`)
    await db.query(`DELETE FROM "Commande"`)
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toEqual({ ok: false, code: 'invalide' })
    expect(await compter('Paiement')).toBe(0)
    expect(await compter('Incident')).toBe(0)
  })

  it('une référence déjà utilisée par un autre passage : invalide', async () => {
    const passage = await poser()
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    await traiterPaiementConstate(ADMIN, fait(passage))
    await db.query(`UPDATE "Artwork" SET disponibilite = 'disponible'`)
    const { poserVenteAssistee } = await import('@/lib/commandes')
    const r2 = await poserVenteAssistee(ADMIN, { ...SAISIE, email: 'autre@exemple.test' })
    expect(r2.ok).toBe(true)
    if (!r2.ok) return
    expect(await traiterPaiementConstate(ADMIN, fait(r2.passageId))).toEqual({ ok: false, code: 'invalide' })
  })

  it('un seul paiement ouvert par passage (index partiel)', async () => {
    const passage = await poser()
    await db.query(`INSERT INTO "Paiement" (id, "passageId", source, "referenceExterne", "montantCentimes", "updatedAt") VALUES ('pa1', $1, 's', 'a', 1, now())`, [passage])
    await expect(
      db.query(`INSERT INTO "Paiement" (id, "passageId", source, "referenceExterne", "montantCentimes", "updatedAt") VALUES ('pa2', $1, 's', 'b', 1, now())`, [passage]),
    ).rejects.toThrow()
  })

  it('lectures de l’équipe : admin seulement, total en agrégat, incidents', async () => {
    const passage = await poser()
    const { commandesEnAttenteDeLEquipe, incidentsDeLEquipe, traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await commandesEnAttenteDeLEquipe(AUTRES[1])).toBeNull()
    expect(await incidentsDeLEquipe(AUTRES[2])).toBeNull()
    const attente = await commandesEnAttenteDeLEquipe(ADMIN)
    expect(attente).toHaveLength(1)
    expect(attente![0]).toMatchObject({ passageId: passage, totalCentimes: TOTAL, devise: 'EUR', acheteur: { nom: 'Claire Martin', email: 'claire@exemple.test' } })
    expect(attente![0].commandes).toHaveLength(2)
    await traiterPaiementConstate(ADMIN, fait(passage, { montantCentimes: 1 }))
    expect(await incidentsDeLEquipe(ADMIN)).toMatchObject([{ cause: 'montant_different', attenduCentimes: TOTAL, recuCentimes: 1 }])
    await traiterPaiementConstate(ADMIN, fait(passage))
    expect(await commandesEnAttenteDeLEquipe(ADMIN)).toEqual([])
  })

  it.each([
    ['œuvre dépubliée', `UPDATE "Artwork" SET publication = 'brouillon' WHERE slug = 'o1'`, 'o1'],
    ['artiste désactivé', `UPDATE "Artist" SET active = false WHERE id = 'art-b'`, 'o2'],
    ['artiste sans accord', `UPDATE "Artist" SET "accordSigneLe" = NULL WHERE id = 'art-b'`, 'o2'],
  ])('%s entre la pose et le constat : sa commande est annulée sous le verrou, rien d’autre vendu', async (_nom, sql, slug) => {
    const passage = await poser()
    await db.query(sql)
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: true, commandes: 1, annulees: 1 })
    expect((await commandeDe(slug)).etat).toBe('annulee')
    expect(await etat(slug)).not.toBe('vendue')
    expect(await compter('RemboursementCommande')).toBe(1)
  })

  it('paiement connu ni ouvert ni constaté : invalide, rien repris', async () => {
    const passage = await poser()
    await db.query(`INSERT INTO "Paiement" (id, "passageId", source, "referenceExterne", "montantCentimes", etat, "updatedAt") VALUES ('pa-ab', $1, 'constat_manuel', 'VIR-1', 5, 'abandonne', now())`, [passage])
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toEqual({ ok: false, code: 'invalide' })
    expect((await db.query(`SELECT etat::text AS etat, "montantCentimes" FROM "Paiement" WHERE id = 'pa-ab'`)).rows[0]).toEqual({ etat: 'abandonne', montantCentimes: 5 })
  })

  it('montant au-delà de 2 147 483 647 centimes : invalide ; adaptateur et lecture du total en bigint', async () => {
    const passage = await poser()
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, fait(passage, { montantCentimes: 2147483648 }))).toEqual({ ok: false, code: 'invalide' })
    const { constaterManuellement } = await import('@/lib/paiement')
    expect(constaterManuellement({ passageId: passage, reference: 'R', montantCentimes: 2147483648, par: 'u' })).toBeNull()
    expect(constaterManuellement({ passageId: passage, reference: 'R', montantCentimes: 2147483647, par: 'u' })).not.toBeNull()
    expect(await compter('Paiement')).toBe(0)
  })

  it('incident non traité de même cause : mis à jour avec la dernière tentative, un seul par cause', async () => {
    const passage = await poser()
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    await traiterPaiementConstate(ADMIN, fait(passage, { montantCentimes: 100 }))
    await traiterPaiementConstate(ADMIN, fait(passage, { montantCentimes: 200, referenceExterne: 'VIR-2' }))
    const lignes = (await db.query(`SELECT "recuCentimes", "attenduCentimes" FROM "Incident"`)).rows
    expect(lignes).toEqual([{ recuCentimes: 200, attenduCentimes: TOTAL }])
    // Devise : rejeu, un seul incident pour cette cause.
    await traiterPaiementConstate(ADMIN, fait(passage, { devise: 'USD' }))
    await traiterPaiementConstate(ADMIN, fait(passage, { devise: 'USD' }))
    expect(await compter('Incident', `WHERE cause = 'devise_differente'`)).toBe(1)
    expect(await compter('Incident')).toBe(2)
  })

  it('réservation d’un autre passage échue : fermée expiree, œuvre vendue', async () => {
    const passage = await poser()
    await db.query(`UPDATE "Reservation" SET issue = 'liberee', "issueLe" = now() WHERE "artworkId" = 'o1'`)
    await db.query(`INSERT INTO "Reservation" (id, "artworkId", "passageId", origine, echeance) VALUES ('r-echue', 'o1', 'autre-passage', 'paiement', now() - interval '1 hour')`)
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: true, dejaConstate: false })
    expect(await etat('o1')).toBe('vendue')
    expect((await db.query(`SELECT issue::text AS issue FROM "Reservation" WHERE id = 'r-echue'`)).rows[0].issue).toBe('expiree')
  })

  it('réservation du passage libérée (œuvre disponible) : constat accepté, œuvre vendue, aucune réservation propre confirmée', async () => {
    const passage = await poser()
    const { libererReservation } = await import('@/lib/disponibilite')
    await libererReservation(passage)
    expect(await etat('o1')).toBe('disponible')
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: true, dejaConstate: false })
    expect(await etat('o1')).toBe('vendue')
    expect(await etat('o2')).toBe('vendue')
    expect(await compter('Reservation', `WHERE issue = 'confirmee'`)).toBe(0)
  })

  it('réservation du passage échue mais non balayée : constat accepté', async () => {
    const passage = await poser()
    await db.query(`UPDATE "Reservation" SET echeance = now() - interval '1 hour'`)
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: true, dejaConstate: false })
    expect(await etat('o1')).toBe('vendue')
    expect(await compter('Reservation', `WHERE issue = 'confirmee'`)).toBe(2)
  })

  it('ligne sans œuvre (artworkId nul) : sa commande est annulée et remboursée, l’autre confirmée', async () => {
    const passage = await poser()
    await db.query(`UPDATE "LigneCommande" SET "artworkId" = NULL WHERE slug = 'o2'`)
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: true, commandes: 1, annulees: 1 })
    expect(await etat('o1')).toBe('vendue')
    expect((await commandeDe('o2')).etat).toBe('annulee')
    expect(await compter('Incident', `WHERE cause = 'oeuvre_indisponible'`)).toBe(1)
  })

  it('« Annuler la commande » : admin seulement, œuvres libérées, sans remboursement, rejouable, refus typés', async () => {
    const passage = await poser()
    const { annulerCommande } = await import('@/lib/commandes')
    const c1 = await commandeDe('o1')
    for (const a of AUTRES) expect(await annulerCommande(a, c1.id)).toEqual({ ok: false, code: 'acces_refuse' })
    expect((await commandeDe('o1')).etat).toBe('en_attente_paiement')
    expect(await annulerCommande(ADMIN, '')).toEqual({ ok: false, code: 'invalide' })
    expect(await annulerCommande(ADMIN, 'inconnue')).toEqual({ ok: false, code: 'introuvable' })

    expect(await annulerCommande(ADMIN, c1.id)).toEqual({ ok: true, dejaAnnulee: false })
    expect((await commandeDe('o1')).etat).toBe('annulee')
    expect(await etat('o1')).toBe('disponible')
    expect(await etat('o2')).toBe('reservee')
    const res = (await db.query(`SELECT issue::text AS issue, "issuePar" FROM "Reservation" WHERE "artworkId" = 'o1'`)).rows[0]
    expect(res).toEqual({ issue: 'liberee', issuePar: 'admin-1' })
    expect(await compter('RemboursementCommande')).toBe(0)
    expect(await compter('Incident')).toBe(0)
    expect(await compter('Evenement', `WHERE nom = 'CommandeAnnulee' AND charge->>'commandeId' = '${c1.id}'`)).toBe(1)

    const avant = await compter('Evenement')
    expect(await annulerCommande(ADMIN, c1.id)).toEqual({ ok: true, dejaAnnulee: true })
    expect(await compter('Evenement')).toBe(avant)

    // Une commande confirmée ne s'annule pas ici.
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    await traiterPaiementConstate(ADMIN, fait(passage))
    const c2 = await commandeDe('o2')
    expect(c2.etat).toBe('confirmee')
    expect(await annulerCommande(ADMIN, c2.id)).toEqual({ ok: false, code: 'etat_invalide' })
    expect(await etat('o2')).toBe('vendue')
  })

  it('« Annuler la commande » : une œuvre déclarée vendue ailleurs entre-temps n’est jamais écrasée', async () => {
    await poser()
    const { annulerCommande } = await import('@/lib/commandes')
    await db.query(`UPDATE "Artwork" SET disponibilite = 'vendue_ailleurs' WHERE slug = 'o1'`)
    expect(await annulerCommande(ADMIN, (await commandeDe('o1')).id)).toEqual({ ok: true, dejaAnnulee: false })
    expect(await etat('o1')).toBe('vendue_ailleurs')
  })

  it('remboursements : lecture admin seulement, « Marquer comme effectué » avec auteur et date, rejeu sans effet', async () => {
    const passage = await poser()
    await db.query(`UPDATE "Artwork" SET disponibilite = 'retiree' WHERE slug = 'o2'`)
    const { traiterPaiementConstate, remboursementsDeLEquipe, marquerRemboursementEffectue, incidentsDeLEquipe } = await import('@/lib/commandes')
    await traiterPaiementConstate(ADMIN, fait(passage))
    expect(await remboursementsDeLEquipe(AUTRES[1])).toBeNull()
    const liste = await remboursementsDeLEquipe(ADMIN)
    expect(liste).toHaveLength(1)
    expect(liste![0]).toMatchObject({ montantCentimes: 104000, devise: 'EUR', acheteur: { nom: 'Claire Martin', email: 'claire@exemple.test' } })
    expect(liste![0].commandeNumero).toMatch(/^ERR-/)
    const incidents = await incidentsDeLEquipe(ADMIN)
    expect(incidents).toMatchObject([{ cause: 'oeuvre_indisponible', commandeNumero: liste![0].commandeNumero }])

    const id = liste![0].id
    for (const a of AUTRES) expect(await marquerRemboursementEffectue(a, id)).toEqual({ ok: false, code: 'acces_refuse' })
    expect(await marquerRemboursementEffectue(ADMIN, '')).toEqual({ ok: false, code: 'invalide' })
    expect(await marquerRemboursementEffectue(ADMIN, 'inconnu')).toEqual({ ok: false, code: 'introuvable' })
    expect(await compter('RemboursementCommande', `WHERE etat = 'demande'`)).toBe(1)

    expect(await marquerRemboursementEffectue(ADMIN, id)).toEqual({ ok: true, dejaEffectue: false })
    const ligne = (await db.query(`SELECT etat::text AS etat, "effectuePar", "effectueLe" FROM "RemboursementCommande"`)).rows[0]
    expect(ligne).toMatchObject({ etat: 'effectue', effectuePar: 'admin-1' })
    expect(ligne.effectueLe).toBeInstanceOf(Date)
    const date = ligne.effectueLe
    expect(await marquerRemboursementEffectue(ADMIN, id)).toEqual({ ok: true, dejaEffectue: true })
    expect((await db.query(`SELECT "effectueLe" FROM "RemboursementCommande"`)).rows[0].effectueLe).toEqual(date)
    expect(await remboursementsDeLEquipe(ADMIN)).toEqual([])
  })

  it('actions : annuler une commande et marquer un remboursement, messages lisibles', async () => {
    const passage = await poser()
    const { actionAnnulerCommande, actionMarquerRemboursementEffectue, actionConstaterPaiement } = await import('@/app/dashboard/admin/commandes/actions')
    const { fr } = await import('@/lib/i18n')
    const c1 = await commandeDe('o1')
    acteur.courant = AUTRES[1] as never
    expect(await actionAnnulerCommande(c1.id)).toEqual({ ok: false, message: fr.paiement.annulation.refus.acces_refuse })
    acteur.courant = ADMIN
    expect(await actionAnnulerCommande('inconnue')).toEqual({ ok: false, message: fr.paiement.annulation.refus.introuvable })
    expect(await actionAnnulerCommande(c1.id)).toEqual({ ok: true, message: fr.paiement.annulation.succes })
    expect(await actionAnnulerCommande(c1.id)).toEqual({ ok: true, message: fr.paiement.annulation.dejaAnnulee })
    expect(await actionConstaterPaiement(passage, 'R1', '2080')).toEqual({ ok: true, message: fr.paiement.succesTardif(1, 1) })
    const id = (await db.query(`SELECT id FROM "RemboursementCommande"`)).rows[0].id as string
    expect(await actionMarquerRemboursementEffectue(id)).toEqual({ ok: true, message: fr.paiement.remboursements.succes })
    expect(await actionMarquerRemboursementEffectue(id)).toEqual({ ok: true, message: fr.paiement.remboursements.dejaEffectue })
    expect(await actionMarquerRemboursementEffectue('x')).toEqual({ ok: false, message: fr.paiement.remboursements.refus.introuvable })
    acteur.courant = AUTRES[0] as never
    expect(await actionMarquerRemboursementEffectue(id)).toEqual({ ok: false, message: fr.paiement.remboursements.refus.acces_refuse })
  })

  it('deux totaux acceptés : en attente seul (annulées ni confirmées ni remboursées) ou avec les annulées', async () => {
    const passage = await poser()
    const { annulerCommande, traiterPaiementConstate, commandesEnAttenteDeLEquipe } = await import('@/lib/commandes')
    const c2 = await commandeDe('o2')
    await annulerCommande(ADMIN, c2.id)
    const lu = await commandesEnAttenteDeLEquipe(ADMIN)
    expect(lu![0]).toMatchObject({ totalCentimes: 104000, totalAvecAnnuleesCentimes: TOTAL })
    expect(await traiterPaiementConstate(ADMIN, fait(passage, { montantCentimes: 5 }))).toMatchObject({ ok: false, code: 'refuse', cause: 'montant_different' })
    expect(await traiterPaiementConstate(ADMIN, fait(passage, { montantCentimes: 104000 }))).toMatchObject({ ok: true, commandes: 1, annulees: 0 })
    expect((await commandeDe('o1')).etat).toBe('confirmee')
    expect((await commandeDe('o2')).etat).toBe('annulee')
    expect(await compter('RemboursementCommande')).toBe(0)
    expect(await compter('Incident', `WHERE cause = 'commande_annulee'`)).toBe(0)
  })

  it('échéance d’abandon toujours après la réservation de vente assistée (336 h)', async () => {
    await oeuvre('o1', 'art-a')
    await oeuvre('o2', 'art-b')
    const { poserVenteAssistee } = await import('@/lib/commandes')
    const r = await poserVenteAssistee(ADMIN, { ...SAISIE, heures: 336 })
    if (!r.ok) throw new Error(r.code)
    const lignes = (await db.query(`SELECT "abandonneLe" FROM "Commande"`)).rows
    for (const l of lignes) expect(l.abandonneLe.getTime()).toBeGreaterThan(r.echeance.getTime() + 6.9 * 86400000)
    const { abandonApres } = await import('@/lib/commandes/passage')
    const maintenant = new Date('2026-11-12T10:00:00Z')
    const echeance = new Date('2026-12-30T10:00:00Z')
    expect(abandonApres(echeance, maintenant).getTime()).toBe(echeance.getTime() + 7 * 86400000)
    expect(abandonApres(undefined, maintenant).getTime()).toBe(maintenant.getTime() + 7 * 86400000)
  })

  it('page de l’acheteur : une commande annulée n’est plus listée ; aucune restante : lien inactif', async () => {
    const passage = await poser()
    const { annulerCommande, preparerLienVenteAssistee, lireRecapitulatifAssiste } = await import('@/lib/commandes')
    const lien = await preparerLienVenteAssistee(passage)
    expect(lien).not.toBeNull()
    expect((await lireRecapitulatifAssiste(lien!.jeton))!.commandes).toHaveLength(2)
    await annulerCommande(ADMIN, (await commandeDe('o2')).id)
    const recap = await lireRecapitulatifAssiste(lien!.jeton)
    expect(recap!.commandes).toHaveLength(1)
    expect(recap!.commandes[0].lignes.map((l) => l.slug)).toEqual(['o1'])
    await annulerCommande(ADMIN, (await commandeDe('o1')).id)
    expect(await lireRecapitulatifAssiste(lien!.jeton)).toBeNull()
  })

  it('remboursement de 0 centime refusé en base ; demanderRemboursement n’en crée pas', async () => {
    const passage = await poser()
    const c1 = await commandeDe('o1')
    await expect(
      db.query(`INSERT INTO "RemboursementCommande" (id, "commandeId", "montantCentimes", devise) VALUES ('zero', $1, 0, 'EUR')`, [c1.id]),
    ).rejects.toThrow()
    await db.query(`DELETE FROM "LigneCommande" WHERE "commandeId" = $1`, [c1.id])
    const { prisma } = await import('@/lib/prisma')
    const { demanderRemboursement } = await import('@/lib/commandes/annulation')
    const r = await prisma.$transaction((tx) => demanderRemboursement(tx, { id: c1.id }, 'pa', 'EUR'))
    expect(r).toMatchObject({ id: null, montantCentimes: 0, nouveau: false })
    expect(await compter('RemboursementCommande')).toBe(0)
    expect(passage).toBeTruthy()
  })

  it('libererReservation avec artworkIds : ne libère que ces œuvres, jamais une vendue ailleurs ou retirée', async () => {
    const passage = await poser()
    await oeuvre('o3', 'art-a')
    await db.query(`INSERT INTO "Reservation" (id, "artworkId", "passageId", origine, echeance) VALUES ('r3', 'o3', $1, 'vente_assistee', now() + interval '1 day')`, [passage])
    await db.query(`UPDATE "Artwork" SET disponibilite = 'reservee' WHERE slug = 'o3'`)
    const { libererReservation } = await import('@/lib/disponibilite')
    // o3 déclarée retirée entre-temps : fermée mais jamais écrasée.
    await db.query(`UPDATE "Artwork" SET disponibilite = 'retiree' WHERE slug = 'o3'`)
    const r = await libererReservation(passage, { artworkIds: ['o1', 'o3'] })
    expect(r.liberees).toBe(2)
    expect(await etat('o1')).toBe('disponible')
    expect(await etat('o3')).toBe('retiree')
    expect(await etat('o2')).toBe('reservee')
    expect(await compter('Reservation', `WHERE "artworkId" = 'o2' AND issue IS NULL`)).toBe(1)
  })

  it('rejeu d’un constat qui a créé incident et remboursement : aucun second', async () => {
    const passage = await poser()
    await db.query(`UPDATE "Artwork" SET disponibilite = 'retiree' WHERE slug = 'o1'`)
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    await traiterPaiementConstate(ADMIN, fait(passage))
    const avant = [await compter('Incident'), await compter('RemboursementCommande'), await compter('Evenement')]
    expect(avant.slice(0, 2)).toEqual([1, 1])
    await traiterPaiementConstate(ADMIN, fait(passage))
    await traiterPaiementConstate(ADMIN, fait(passage, { referenceExterne: 'VIR-9' }))
    expect([await compter('Incident'), await compter('RemboursementCommande'), await compter('Evenement')]).toEqual(avant)
  })

  it('frontière de l’abandon : abandonneLe == constateLe est abandonnée, une milliseconde plus tard non', async () => {
    const passage = await poser()
    const quand = new Date('2026-11-12T10:00:00.000Z')
    await db.query(`UPDATE "Commande" SET "abandonneLe" = $1 WHERE id = $2`, [quand, (await commandeDe('o1')).id])
    await db.query(`UPDATE "Commande" SET "abandonneLe" = $1 WHERE id = $2`, [new Date(quand.getTime() + 1), (await commandeDe('o2')).id])
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, fait(passage, { constateLe: quand }))).toMatchObject({ ok: true, commandes: 1, annulees: 1 })
    expect((await commandeDe('o1')).etat).toBe('annulee')
    expect((await commandeDe('o2')).etat).toBe('confirmee')
  })

  it('annulation et constat en parallèle : résultat cohérent, jamais une œuvre vendue pour une commande annulée', async () => {
    for (let i = 0; i < 3; i++) {
      await db.query(`DELETE FROM "Incident"`)
      for (const t of ['RemboursementCommande', 'Paiement', 'Jeton', 'Reservation', 'TraitementEvenement', 'Evenement', 'LigneCommande', 'Commande', 'CoordonneesAcheteur', 'PassageEnCaisse', 'OffreLivraison', 'Artwork']) await db.query(`DELETE FROM "${t}"`)
      const passage = await poser()
      const c1 = await commandeDe('o1')
      const { annulerCommande, traiterPaiementConstate } = await import('@/lib/commandes')
      const [a, c] = await Promise.all([annulerCommande(ADMIN, c1.id), traiterPaiementConstate(ADMIN, fait(passage))])
      expect(c.ok || (!c.ok && c.code === 'refuse')).toBe(true)
      const apres = await commandeDe('o1')
      const o1 = await etat('o1')
      if (apres.etat === 'annulee') expect(o1).not.toBe('vendue')
      if (apres.etat === 'confirmee') {
        expect(o1).toBe('vendue')
        expect(a).toEqual({ ok: false, code: 'etat_invalide' })
      }
      expect(await compter('Commande', `WHERE etat = 'en_attente_paiement'`)).toBe(c.ok ? 0 : 2 - (apres.etat === 'annulee' ? 1 : 0))
    }
  })

  it('action serveur : montant en euros, référence, refus lisibles', async () => {
    const passage = await poser()
    const { actionConstaterPaiement } = await import('@/app/dashboard/admin/commandes/actions')
    const { fr } = await import('@/lib/i18n')
    acteur.courant = AUTRES[1] as never
    expect(await actionConstaterPaiement(passage, 'R1', '2 080')).toEqual({ ok: false, message: fr.paiement.refus.acces_refuse })
    acteur.courant = ADMIN
    expect(await actionConstaterPaiement(passage, 'R1', 'abc')).toEqual({ ok: false, message: fr.paiement.erreurs.montant })
    expect(await actionConstaterPaiement(passage, '  ', '2080')).toEqual({ ok: false, message: fr.paiement.erreurs.reference })
    for (const m of ['0', '-5', '99999999999']) expect(await actionConstaterPaiement(passage, 'R1', m)).toEqual({ ok: false, message: fr.paiement.erreurs.montant })
    expect(await actionConstaterPaiement(passage, 'R1', '2079,99')).toMatchObject({ ok: false, message: fr.paiement.refus.montant_different })
    expect(await actionConstaterPaiement(passage, 'R1', '2080,00')).toEqual({ ok: true, message: fr.paiement.succes(2) })
    expect(await actionConstaterPaiement(passage, 'R1', '2080,00')).toEqual({ ok: true, message: fr.paiement.dejaConstate })
  })
})
