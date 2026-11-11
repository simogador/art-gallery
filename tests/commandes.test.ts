import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '@/lib/i18n'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 6.1 (FR-10, AD-12, AR-10) : passage en caisse, commandes par artiste aux montants figés,
// numéro lisible, coordonnées de l'acheteur, recopie idempotente de l'ancienne table Order. Base réelle.

describe('règles pures', () => {
  it('numéro lisible : forme ERR-XXXX-XXXX, alphabet sans caractères ambigus', async () => {
    const { genererNumero, FORME_NUMERO, ALPHABET_NUMERO } = await import('@/lib/commandes/numero')
    for (const interdit of ['0', '1', 'I', 'L', 'O', 'U']) expect(ALPHABET_NUMERO).not.toContain(interdit)
    const numeros = new Set(Array.from({ length: 300 }, () => genererNumero()))
    for (const n of numeros) expect(n).toMatch(FORME_NUMERO)
    expect(numeros.size).toBeGreaterThan(290)
    expect('ERR-7K4M-9Q2X').toMatch(FORME_NUMERO)
  })

  it('table de transitions : création en attente, confirmée ou annulée ne bougent plus, une annulée n’est jamais confirmée', async () => {
    const { ETAT_INITIAL, transitionPermise } = await import('@/lib/commandes/etats')
    expect(ETAT_INITIAL).toBe('en_attente_paiement')
    expect(transitionPermise('en_attente_paiement', 'confirmee')).toBe(true)
    expect(transitionPermise('en_attente_paiement', 'annulee')).toBe(true)
    expect(transitionPermise('annulee', 'confirmee')).toBe(false)
    expect(transitionPermise('confirmee', 'annulee')).toBe(false)
    expect(transitionPermise('historique', 'confirmee')).toBe(false)
  })

  it('coordonnées : e-mail normalisé, nom requis, champs facultatifs, corps quelconque sans exception', async () => {
    const { validerCoordonnees } = await import('@/lib/commandes/coordonnees-regles')
    expect(validerCoordonnees({ email: ' Claire.Martin@Exemple.TEST ', nom: '  Claire   Martin ', adresse: ' 1 rue X ', telephone: '+33 6 12 34 56 78' })).toEqual({
      ok: true,
      valeur: { email: 'claire.martin@exemple.test', nom: 'Claire Martin', adresse: '1 rue X', telephone: '+33 6 12 34 56 78' },
    })
    expect(validerCoordonnees({ email: 'a@b.test', nom: 'A' })).toEqual({
      ok: true,
      valeur: { email: 'a@b.test', nom: 'A', adresse: null, telephone: null },
    })
    expect(validerCoordonnees({ email: 'nope', nom: ' ', telephone: 'abc' })).toEqual({
      ok: false,
      erreurs: { email: fr.commandes.erreurs.emailInvalide, nom: fr.commandes.erreurs.nomManquant, telephone: fr.commandes.erreurs.telephoneInvalide },
    })
    for (const corps of [null, undefined, 42, 'x', [], { email: 3, nom: {} }]) expect(validerCoordonnees(corps).ok).toBe(false)
  })
})

describe('base : passage en caisse et commandes', () => {
  let base: BaseJetable
  let db: Client
  const compter = async (table: string) => Number((await db.query(`SELECT count(*) FROM "${table}"`)).rows[0].count)
  const ACHETEUR = { email: 'Claire.Martin@Exemple.test', nom: 'Claire Martin', adresse: '12 rue des Arts, 75003 Paris', telephone: '+33 6 12 34 56 78' }

  async function oeuvre(slug: string, options: { artiste?: string; prix?: number | null; devise?: string; publication?: string; dispo?: string; frais?: number | null } = {}) {
    const { artiste = 'art-a', prix = 100000, devise = 'EUR', publication = 'publiee', dispo = 'disponible', frais = 4000 } = options
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", devise,
         publication, disponibilite, "artistId", "updatedAt")
       VALUES ($1, $1, $2, 2024, 'Huile', 'D', 'https://res.cloudinary.com/x/p.jpg', $3, $4, $5::"Publication", $6::"Disponibilite", $7, now())`,
      [slug, `Titre ${slug}`, prix, devise, publication, dispo, artiste],
    )
    if (frais !== null) {
      await db.query(
        `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", livree, "fraisCentimes", "preparationJours", "transportMinJours", "transportMaxJours", devise, "updatedAt")
         VALUES (gen_random_uuid()::text, $1, 'zone-ue', true, $2, 3, 5, 9, $3, now())`,
        [slug, frais, devise.toUpperCase()],
      )
    }
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
    for (const table of ['Paiement', 'LigneCommande', 'Commande', 'CoordonneesAcheteur', 'PassageEnCaisse', 'Order', 'OffreLivraison', 'ZonePays', 'Zone', 'Artwork', 'Artist']) {
      await db.query(`DELETE FROM "${table}"`)
    }
    for (const [id, accord] of [['art-a', 'now()'], ['art-b', 'now()'], ['art-sans-accord', 'NULL']]) {
      await db.query(
        `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "accordSigneLe", "updatedAt")
         VALUES ($1, $1, $1, 'MA', 1980, 'Bio', '', ${accord}, now())`,
        [id],
      )
    }
    await db.query(`INSERT INTO "Zone" (id, nom, "updatedAt") VALUES ('zone-ue', 'Union européenne', now())`)
    await db.query(`INSERT INTO "ZonePays" ("codePays", "zoneId") VALUES ('FR', 'zone-ue')`)
  })

  afterEach(() => vi.restoreAllMocks())

  const tables = ['PassageEnCaisse', 'CoordonneesAcheteur', 'Commande', 'LigneCommande']
  const rienEcrit = async () => {
    for (const t of tables) expect(await compter(t), t).toBe(0)
  }

  it('deux artistes : un passage, deux commandes en attente, trois lignes figées, deux numéros distincts', async () => {
    await oeuvre('a-1', { artiste: 'art-a', prix: 150000, frais: 4000 })
    await oeuvre('a-2', { artiste: 'art-a', prix: 80000, frais: 2500 })
    await oeuvre('b-1', { artiste: 'art-b', prix: 20000, frais: 1500 })
    const { creerPassageEnCaisse, FORME_NUMERO } = await import('@/lib/commandes')
    const r = await creerPassageEnCaisse({ pays: 'fr', oeuvres: ['a-1', 'b-1', 'a-2', 'a-1'], coordonnees: ACHETEUR })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.commandes).toHaveLength(2)
    expect(r.commandes.map((c) => [c.artistId, c.lignes])).toEqual([['art-a', 2], ['art-b', 1]])
    expect(new Set(r.commandes.map((c) => c.numero)).size).toBe(2)
    for (const c of r.commandes) expect(c.numero).toMatch(FORME_NUMERO)

    expect(await compter('PassageEnCaisse')).toBe(1)
    expect(await compter('LigneCommande')).toBe(3)
    const passage = (await db.query(`SELECT "paysLivraison", devise FROM "PassageEnCaisse"`)).rows[0]
    expect(passage).toEqual({ paysLivraison: 'FR', devise: 'EUR' })
    const etats = (await db.query(`SELECT DISTINCT etat::text FROM "Commande"`)).rows
    expect(etats).toEqual([{ etat: 'en_attente_paiement' }])
    const coord = (await db.query(`SELECT email, nom, adresse, telephone FROM "CoordonneesAcheteur"`)).rows[0]
    expect(coord).toEqual({ email: 'claire.martin@exemple.test', nom: 'Claire Martin', adresse: ACHETEUR.adresse, telephone: ACHETEUR.telephone })
    const ligne = (await db.query(`SELECT * FROM "LigneCommande" WHERE slug = 'a-1'`)).rows[0]
    expect(ligne).toMatchObject({
      artworkId: 'a-1', titre: 'Titre a-1', prixCentimes: 150000, fraisCentimes: 4000, totalCentimes: 154000, devise: 'EUR',
      zoneId: 'zone-ue', zoneNom: 'Union européenne', delaiMinJours: 8, delaiMaxJours: 12,
    })
    // Aucun compte créé pour l'acheteur.
    expect(await compter('User')).toBe(0)
  })

  it('montants figés : tarif, offre, slug ou titre modifiés ensuite, la commande relue est inchangée', async () => {
    await oeuvre('a-1', { prix: 150000, frais: 4000 })
    const { creerPassageEnCaisse, lireCommande } = await import('@/lib/commandes')
    const r = await creerPassageEnCaisse({ pays: 'FR', oeuvres: ['a-1'], coordonnees: ACHETEUR })
    if (!r.ok) throw new Error('refus inattendu')
    const avant = await lireCommande(r.commandes[0].id)
    await db.query(`UPDATE "Artwork" SET "prixCentimes" = 999999, slug = 'autre-slug', title = 'Autre titre' WHERE id = 'a-1'`)
    await db.query(`UPDATE "OffreLivraison" SET "fraisCentimes" = 9999, "preparationJours" = 40`)
    await db.query(`UPDATE "Zone" SET nom = 'Renommée'`)
    const apres = await lireCommande(r.commandes[0].id)
    expect(apres).toEqual(avant)
    expect(apres?.lignes[0]).toMatchObject({ slug: 'a-1', titre: 'Titre a-1', prixCentimes: 150000, fraisCentimes: 4000, totalCentimes: 154000, zoneNom: 'Union européenne', delaiMinJours: 8 })
  })

  it('œuvre supprimée plus tard : la ligne reste, sans lien, avec slug et titre', async () => {
    await oeuvre('a-1')
    const { creerPassageEnCaisse, lireCommande } = await import('@/lib/commandes')
    const r = await creerPassageEnCaisse({ pays: 'FR', oeuvres: ['a-1'], coordonnees: ACHETEUR })
    if (!r.ok) throw new Error('refus inattendu')
    await db.query(`DELETE FROM "Artwork" WHERE id = 'a-1'`)
    const c = await lireCommande(r.commandes[0].id)
    expect(c?.lignes[0]).toMatchObject({ artworkId: null, slug: 'a-1', titre: 'Titre a-1', totalCentimes: 104000 })
  })

  it.each([
    ['brouillon', { publication: 'brouillon' }],
    ['retirée', { dispo: 'retiree' }],
    ['artiste sans accord', { artiste: 'art-sans-accord' }],
    ['sans prix', { prix: null }],
  ])('œuvre non visible ou sans prix (%s) : refus oeuvre_indisponible, rien d’écrit', async (_nom, options) => {
    await oeuvre('bonne')
    await oeuvre('mauvaise', options)
    const { creerPassageEnCaisse } = await import('@/lib/commandes')
    const r = await creerPassageEnCaisse({ pays: 'FR', oeuvres: ['bonne', 'mauvaise'], coordonnees: ACHETEUR })
    expect(r).toEqual({ ok: false, code: 'oeuvre_indisponible', slug: 'mauvaise' })
    await rienEcrit()
    // Slug inconnu : même refus.
    expect(await creerPassageEnCaisse({ pays: 'FR', oeuvres: ['inconnue'], coordonnees: ACHETEUR })).toEqual({ ok: false, code: 'oeuvre_indisponible', slug: 'inconnue' })
  })

  it('œuvre non livrée : refus non_livree avec la raison de livraison, rien d’écrit', async () => {
    await oeuvre('bonne')
    await oeuvre('sans-offre', { frais: null })
    await oeuvre('refusee', { frais: null })
    await db.query(
      `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", livree, devise, "updatedAt") VALUES (gen_random_uuid()::text, 'refusee', 'zone-ue', false, 'EUR', now())`,
    )
    await oeuvre('devise-offre', { frais: null })
    await db.query(
      `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", livree, "fraisCentimes", "preparationJours", "transportMinJours", "transportMaxJours", devise, "updatedAt")
       VALUES (gen_random_uuid()::text, 'devise-offre', 'zone-ue', true, 1000, 1, 2, 3, 'USD', now())`,
    )
    const { creerPassageEnCaisse } = await import('@/lib/commandes')
    const essai = (pays: string, slug: string) => creerPassageEnCaisse({ pays, oeuvres: ['bonne', slug], coordonnees: ACHETEUR })
    expect(await essai('JP', 'bonne')).toEqual({ ok: false, code: 'non_livree', slug: 'bonne', raison: 'pas_de_zone' })
    expect(await essai('FR', 'sans-offre')).toEqual({ ok: false, code: 'non_livree', slug: 'sans-offre', raison: 'non_livree' })
    expect(await essai('FR', 'refusee')).toEqual({ ok: false, code: 'non_livree', slug: 'refusee', raison: 'non_livree' })
    expect(await essai('FR', 'devise-offre')).toEqual({ ok: false, code: 'non_livree', slug: 'devise-offre', raison: 'devise_differente' })
    expect(await essai('', 'bonne')).toMatchObject({ ok: false, code: 'non_livree' })
    await rienEcrit()
  })

  it('devises mélangées : refus devise_differente, rien d’écrit', async () => {
    await oeuvre('en-euro')
    await oeuvre('en-dollar', { devise: 'USD' })
    const { creerPassageEnCaisse } = await import('@/lib/commandes')
    expect(await creerPassageEnCaisse({ pays: 'FR', oeuvres: ['en-euro', 'en-dollar'], coordonnees: ACHETEUR })).toEqual({ ok: false, code: 'devise_differente' })
    await rienEcrit()
  })

  it('liste vide et coordonnées invalides : refus typés, message par champ, rien d’écrit', async () => {
    await oeuvre('a-1')
    const { creerPassageEnCaisse } = await import('@/lib/commandes')
    expect(await creerPassageEnCaisse({ pays: 'FR', oeuvres: [], coordonnees: ACHETEUR })).toEqual({ ok: false, code: 'liste_vide' })
    expect(await creerPassageEnCaisse({ pays: 'FR', oeuvres: ['a-1'], coordonnees: { email: 'x', nom: '' } })).toEqual({
      ok: false,
      code: 'coordonnees_invalides',
      erreurs: { email: fr.commandes.erreurs.emailInvalide, nom: fr.commandes.erreurs.nomManquant },
    })
    await rienEcrit()
  })

  it('collision de numéro : un nouveau numéro est tiré, un seul passage est créé', async () => {
    await oeuvre('a-1')
    await oeuvre('b-1', { artiste: 'art-b' })
    const { creerPassageEnCaisse } = await import('@/lib/commandes')
    const premier = await creerPassageEnCaisse({ pays: 'FR', oeuvres: ['a-1'], coordonnees: ACHETEUR })
    if (!premier.ok) throw new Error('refus inattendu')
    const pris = premier.commandes[0].numero
    const suite = ['ERR-AAAA-BBBB', 'ERR-CCCC-DDDD']
    const tires: string[] = []
    const generateur = () => {
      const n = tires.length === 0 ? pris : tires.length === 1 ? pris : suite.shift()!
      tires.push(n)
      return n
    }
    const second = await creerPassageEnCaisse({ pays: 'FR', oeuvres: ['b-1'], coordonnees: ACHETEUR }, { generateur })
    if (!second.ok) throw new Error('refus inattendu')
    expect(second.commandes[0].numero).toBe('ERR-AAAA-BBBB')
    expect(tires.slice(0, 2)).toEqual([pris, pris])
    expect(await compter('PassageEnCaisse')).toBe(2)
    expect(await compter('Commande')).toBe(2)
    // Le numéro est unique en base, même hors application.
    await expect(
      db.query(`UPDATE "Commande" SET numero = $1 WHERE numero = 'ERR-AAAA-BBBB'`, [pris]),
    ).rejects.toThrow(/Commande_numero_key/)
  })

  it('atomicité : un échec en cours d’écriture (seconde commande) ne laisse ni passage, ni coordonnées, ni commande', async () => {
    await oeuvre('a-1')
    await oeuvre('b-1', { artiste: 'art-b' })
    await db.query(`CREATE FUNCTION refuser_b() RETURNS trigger AS $$ BEGIN
      IF NEW."artistId" = 'art-b' THEN RAISE EXCEPTION 'echec_test'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql`)
    await db.query(`CREATE TRIGGER refuser_b BEFORE INSERT ON "Commande" FOR EACH ROW EXECUTE FUNCTION refuser_b()`)
    try {
      const { creerPassageEnCaisse } = await import('@/lib/commandes')
      await expect(creerPassageEnCaisse({ pays: 'FR', oeuvres: ['a-1', 'b-1'], coordonnees: ACHETEUR })).rejects.toThrow()
      await rienEcrit()
    } finally {
      await db.query(`DROP TRIGGER refuser_b ON "Commande"`)
      await db.query(`DROP FUNCTION refuser_b()`)
    }
  })

  it('devise d’œuvre en minuscules : lignes écrites en majuscules', async () => {
    await oeuvre('bas', { devise: 'eur' })
    const { creerPassageEnCaisse } = await import('@/lib/commandes')
    const r = await creerPassageEnCaisse({ pays: 'FR', oeuvres: ['bas'], coordonnees: ACHETEUR })
    expect(r.ok).toBe(true)
    expect((await db.query(`SELECT devise FROM "LigneCommande"`)).rows).toEqual([{ devise: 'EUR' }])
  })

  it('contraintes en base : total = prix + frais, commande historique ou liée à un passage et un artiste', async () => {
    await oeuvre('a-1')
    const { creerPassageEnCaisse } = await import('@/lib/commandes')
    const r = await creerPassageEnCaisse({ pays: 'FR', oeuvres: ['a-1'], coordonnees: ACHETEUR })
    if (!r.ok) throw new Error('refus inattendu')
    await expect(db.query(`UPDATE "LigneCommande" SET "totalCentimes" = 1`)).rejects.toThrow(/LigneCommande_montants_check/)
    await expect(db.query(`UPDATE "Commande" SET "artistId" = NULL`)).rejects.toThrow(/Commande_forme_check/)
    await expect(
      db.query(`INSERT INTO "Paiement" (id, "passageId", source, "referenceExterne", "montantCentimes", "updatedAt") SELECT 'p1', id, 'constat-manuel', 'R1', 100, now() FROM "PassageEnCaisse"`),
    ).resolves.toBeDefined()
    await expect(
      db.query(`INSERT INTO "Paiement" (id, "passageId", source, "referenceExterne", "montantCentimes", "updatedAt") SELECT 'p2', id, 'constat-manuel', 'R1', 100, now() FROM "PassageEnCaisse"`),
    ).rejects.toThrow(/Paiement_source_referenceExterne_key/)
  })

  it('aucune adresse e-mail dans les journaux', async () => {
    await oeuvre('a-1')
    const bruit = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'info')]
    const { creerPassageEnCaisse } = await import('@/lib/commandes')
    await creerPassageEnCaisse({ pays: 'FR', oeuvres: ['a-1'], coordonnees: ACHETEUR })
    await creerPassageEnCaisse({ pays: 'FR', oeuvres: ['a-1'], coordonnees: { ...ACHETEUR, email: 'mauvais' } })
    expect(JSON.stringify(bruit.map((b) => b.mock.calls))).not.toMatch(/exemple\.test|Claire/i)
  })

  describe('recopie des anciennes commandes (script SQL)', () => {
    const script = readFileSync('scripts/sql/recopier-anciennes-commandes.sql', 'utf8')
    const lancer = async () => {
      const resultats = (await db.query(script)) as unknown as { rows: { moment: string; commandes: string; centimes: string }[] }[]
      return resultats.filter((r) => r.rows.length).map((r) => r.rows[0])
    }
    const ancien = (id: string, montant: number, devise: string, slugs: string, email: string | null) =>
      db.query(
        `INSERT INTO "Order" (id, "stripeSessionId", "stripePaymentIntentId", "artworkIds", amount, currency, "customerEmail", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, '2026-09-01T10:00:00Z', now())`,
        [id, `cs_${id}`, `pi_${id}`, slugs, montant, devise, email],
      )

    it('chaque Order devient une commande historique ; rejouée, aucun doublon et même contrôle', async () => {
      await ancien('o1', 1450.5, 'eur', 'nuit-bleue,aube', 'a@exemple.test')
      await ancien('o2', 320, 'eur', 'cap', null)
      await ancien('o3', 0.1, 'usd', 'x', 'c@exemple.test')

      const premier = await lancer()
      expect(premier).toEqual([
        { moment: 'avant', commandes: '3', centimes: '177060' },
        { moment: 'apres', commandes: '3', centimes: '177060' },
      ])
      const commande = (await db.query(`SELECT * FROM "Commande" WHERE "ordreHistoriqueId" = 'o1'`)).rows[0]
      expect(commande).toMatchObject({
        etat: 'historique', devise: 'EUR', montantHistoriqueCentimes: 145050, slugsHistoriques: 'nuit-bleue,aube',
        emailHistorique: 'a@exemple.test', stripeSessionId: 'cs_o1', stripePaymentIntentId: 'pi_o1', passageId: null, artistId: null,
      })
      expect(commande.createdAt.toISOString()).toBe('2026-09-01T10:00:00.000Z')
      const { FORME_NUMERO } = await import('@/lib/commandes/numero')
      for (const { numero } of (await db.query(`SELECT numero FROM "Commande"`)).rows) expect(numero).toMatch(FORME_NUMERO)
      expect(await compter('LigneCommande')).toBe(0)

      const second = await lancer()
      expect(second).toEqual(premier)
      expect(await compter('Commande')).toBe(3)
      // Un nouvel Order n'ajoute que lui-même.
      await ancien('o4', 10, 'eur', 'y', null)
      expect((await lancer())[1]).toEqual({ moment: 'apres', commandes: '4', centimes: '178060' })
      expect(await compter('Commande')).toBe(4)
      // L'ancienne table n'a pas bougé.
      expect(await compter('Order')).toBe(4)
    })
  })
})
