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
    for (const table of ['Incident', 'Paiement', 'Jeton', 'Reservation', 'TraitementEvenement', 'Evenement', 'DeclarationDisponibilite', 'LigneCommande', 'Commande', 'CoordonneesAcheteur', 'PassageEnCaisse', 'OffreLivraison', 'ZonePays', 'Zone', 'Artwork', 'Artist']) {
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

  it('œuvre vendue ailleurs entre-temps : rien confirmé (aucune œuvre vendue), incident oeuvre_indisponible', async () => {
    const passage = await poser()
    await db.query(`UPDATE "Artwork" SET disponibilite = 'vendue_ailleurs' WHERE slug = 'o2'`)
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    const r = await traiterPaiementConstate(ADMIN, fait(passage))
    expect(r).toMatchObject({ ok: false, code: 'refuse', cause: 'oeuvre_indisponible', slug: 'o2' })
    expect(await etat('o1')).toBe('reservee')
    expect(await etat('o2')).toBe('vendue_ailleurs')
    expect(await compter('Commande', `WHERE etat = 'confirmee'`)).toBe(0)
    expect(await compter('Reservation', `WHERE issue = 'confirmee'`)).toBe(0)
    expect(await compter('Paiement', `WHERE etat = 'constate'`)).toBe(0)
    expect(await compter('Incident', `WHERE cause = 'oeuvre_indisponible'`)).toBe(1)
  })

  it('œuvre réservée par un autre passage : refusée, rien n’est écrasé', async () => {
    const passage = await poser()
    // Réservation de ce passage libérée, puis une autre en cours par un autre passage.
    await db.query(`UPDATE "Reservation" SET issue = 'liberee', "issueLe" = now() WHERE "artworkId" = 'o1'`)
    await db.query(
      `INSERT INTO "Reservation" (id, "artworkId", "passageId", origine, echeance) VALUES ('r-autre', 'o1', 'autre-passage', 'paiement', now() + interval '1 hour')`,
    )
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: false, code: 'refuse', cause: 'oeuvre_indisponible', slug: 'o1' })
    expect(await etat('o1')).toBe('reservee')
    expect(await compter('Reservation', `WHERE id = 'r-autre' AND issue IS NULL`)).toBe(1)
  })

  it('passage inconnu ou sans commande en attente, entrées invalides : refus, rien écrit', async () => {
    const passage = await poser()
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, fait('inconnu'))).toEqual({ ok: false, code: 'introuvable' })
    for (const m of [0, -5, 1.5, NaN]) expect(await traiterPaiementConstate(ADMIN, fait(passage, { montantCentimes: m }))).toEqual({ ok: false, code: 'invalide' })
    expect(await traiterPaiementConstate(ADMIN, fait(passage, { referenceExterne: '  ' }))).toEqual({ ok: false, code: 'invalide' })
    await db.query(`UPDATE "Commande" SET etat = 'annulee'`)
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

  it('œuvre dépubliée ou artiste désactivé / sans accord : refusée sous le verrou, rien vendu', async () => {
    const passage = await poser()
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    await db.query(`UPDATE "Artwork" SET publication = 'brouillon' WHERE slug = 'o1'`)
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: false, code: 'refuse', cause: 'oeuvre_indisponible', slug: 'o1' })
    await db.query(`UPDATE "Artwork" SET publication = 'publiee' WHERE slug = 'o1'`)
    await db.query(`UPDATE "Artist" SET active = false WHERE id = 'art-b'`)
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: false, code: 'refuse', cause: 'oeuvre_indisponible', slug: 'o2' })
    await db.query(`UPDATE "Artist" SET active = true, "accordSigneLe" = NULL WHERE id = 'art-b'`)
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: false, code: 'refuse', cause: 'oeuvre_indisponible', slug: 'o2' })
    expect(await etat('o1')).toBe('reservee')
    expect(await compter('Commande', `WHERE etat = 'confirmee'`)).toBe(0)
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
    // Œuvre non vendable : rejeu, un seul incident pour cette cause.
    await db.query(`UPDATE "Artwork" SET disponibilite = 'retiree' WHERE slug = 'o2'`)
    await traiterPaiementConstate(ADMIN, fait(passage))
    await traiterPaiementConstate(ADMIN, fait(passage))
    expect(await compter('Incident', `WHERE cause = 'oeuvre_indisponible'`)).toBe(1)
    expect(await compter('Incident')).toBe(3)
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

  it('ligne sans œuvre (artworkId nul) : incident oeuvre_indisponible avec le slug, rien vendu', async () => {
    const passage = await poser()
    await db.query(`UPDATE "LigneCommande" SET "artworkId" = NULL WHERE slug = 'o2'`)
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: false, code: 'refuse', cause: 'oeuvre_indisponible', slug: 'o2' })
    expect(await etat('o1')).toBe('reservee')
    expect(await etat('o2')).toBe('reservee')
    expect(await compter('Commande', `WHERE etat = 'confirmee'`)).toBe(0)
    expect(await compter('Incident', `WHERE cause = 'oeuvre_indisponible'`)).toBe(1)
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
