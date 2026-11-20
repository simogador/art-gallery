import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '@/lib/i18n'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 8.3 (FR-26, AD-9, AD-10, AD-15, UJ-3) : commandes et alertes de l'équipe. Base réelle ; envoi simulé
// (aucun vrai e-mail). Preuves : échéance d'expédition posée à la confirmation, alertes de retard calculées à
// la lecture, lecture et annulation réservées à l'admin (relu en base), aucune donnée de l'acheteur dans la
// lecture, annulation avec motif (trace, remboursement unique de l'allocation, un événement, e-mails), rejeu
// et appuis simultanés.

type Envoye = { a: string; sujet: string; texte: string; html: string; cle: string }
const envoi = vi.hoisted(() => ({ envoyes: [] as Envoye[] }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => ({ type: 'visiteur' }) }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }), headers: () => ({ get: () => null }) }))
vi.mock('@/lib/notifications/choix', () => ({
  envoiActif: () => ({
    envoyer: async (c: Envoye) => {
      envoi.envoyes.push(c)
      return { ok: true }
    },
  }),
  choisirEnvoi: vi.fn(),
  envoiReel: () => false,
}))

const ADMIN = { type: 'admin', userId: 'admin-1' } as never
const ARTISTE_A = { type: 'artist', userId: 'user-a', artiste: { id: 'art-a', slug: 'art-a', name: 'Artiste A' } } as never
const USER = { type: 'user', userId: 'user-x' } as never
const VISITEUR = { type: 'visiteur' } as never
const EMAIL_ACHETEUR = 'claire.martin@exemple.test'
const ADRESSE = '12 rue des Lilas'
const TELEPHONE = '+33 6 12 34 56 78'
const MOTIF = 'Œuvre abîmée avant la remise au transporteur.'

describe('sans base : règles pures', () => {
  it('alertesDeRetard : deux alertes distinctes, calculées à la lecture ; sans échéance, aucune', async () => {
    const { alertesDeRetard } = await import('@/lib/commandes/suivi-equipe-regles')
    const maintenant = new Date('2026-11-20T12:00:00Z')
    const passee = new Date('2026-11-19T12:00:00Z')
    const future = new Date('2026-11-22T12:00:00Z')
    expect(alertesDeRetard({ etat: 'confirmee', priseEnChargeAvant: passee, expedieAvant: future }, maintenant)).toEqual(['prise_en_charge_en_retard'])
    expect(alertesDeRetard({ etat: 'confirmee', priseEnChargeAvant: future, expedieAvant: passee }, maintenant)).toEqual(['expedition_en_retard'])
    expect(alertesDeRetard({ etat: 'confirmee', priseEnChargeAvant: passee, expedieAvant: passee }, maintenant)).toEqual(['prise_en_charge_en_retard', 'expedition_en_retard'])
    // Prise en charge faite : seule l'expédition peut être en retard ; expédiée ou annulée : plus d'alerte.
    expect(alertesDeRetard({ etat: 'prise_en_charge', priseEnChargeAvant: passee, expedieAvant: passee }, maintenant)).toEqual(['expedition_en_retard'])
    expect(alertesDeRetard({ etat: 'expediee', priseEnChargeAvant: passee, expedieAvant: passee }, maintenant)).toEqual([])
    expect(alertesDeRetard({ etat: 'annulee', priseEnChargeAvant: passee, expedieAvant: passee }, maintenant)).toEqual([])
    // Commande ancienne : pas d'échéance d'expédition, donc pas d'alerte.
    expect(alertesDeRetard({ etat: 'prise_en_charge', priseEnChargeAvant: null, expedieAvant: null }, maintenant)).toEqual([])
  })

  it('validerMotif : de 10 à 500 caractères, espaces de bord retirés', async () => {
    const { validerMotif } = await import('@/lib/commandes/suivi-equipe-regles')
    expect(validerMotif(undefined)).toEqual({ ok: false, erreur: 'obligatoire' })
    expect(validerMotif('   ')).toEqual({ ok: false, erreur: 'obligatoire' })
    expect(validerMotif('court')).toEqual({ ok: false, erreur: 'trop_court' })
    expect(validerMotif(' ' + 'x'.repeat(9) + ' ')).toEqual({ ok: false, erreur: 'trop_court' })
    expect(validerMotif('x'.repeat(10))).toEqual({ ok: true, motif: 'x'.repeat(10) })
    expect(validerMotif('x'.repeat(500))).toMatchObject({ ok: true })
    expect(validerMotif('x'.repeat(501))).toEqual({ ok: false, erreur: 'trop_long' })
  })

  it('transitions : confirmee et prise_en_charge → annulee ; jamais expediee ni annulee', async () => {
    const { transitionPermise } = await import('@/lib/commandes/etats')
    expect(transitionPermise('confirmee', 'annulee')).toBe(true)
    expect(transitionPermise('prise_en_charge', 'annulee')).toBe(true)
    for (const de of ['expediee', 'annulee', 'historique'] as const) expect(transitionPermise(de, 'annulee'), de).toBe(false)
  })

  it('CommandeAnnulee : relié à l’acheteur, à l’artiste et à l’équipe', async () => {
    const { ABONNEMENTS } = await import('@/lib/abonnements')
    expect(ABONNEMENTS.CommandeAnnulee.map((a) => a.nom)).toEqual(['envoyerAnnulationCommande', 'envoyerAnnulationCommandeArtiste', 'alerterEquipeCommande'])
  })

  it('e-mail à l’acheteur : un paiement reçu ne dit jamais « aucun paiement »', async () => {
    const { contenuCommandeAnnulee } = await import('@/lib/notifications/contenus')
    const base = { nom: 'Claire', numero: 'ERR-AAAA-BBBB', titres: ['Titre'], remboursement: null }
    expect(contenuCommandeAnnulee({ ...base, paiementRecu: true }).texte).not.toContain('aucun paiement')
    expect(contenuCommandeAnnulee({ ...base, paiementRecu: true }).texte).toContain('ERR-AAAA-BBBB')
    expect(contenuCommandeAnnulee(base).texte).toContain('aucun paiement')
  })

  it('e-mail à l’artiste : numéro, titres et motif, aucun montant', async () => {
    const { contenuCommandeAnnuleeArtiste } = await import('@/lib/notifications/contenus')
    const c = contenuCommandeAnnuleeArtiste({ artiste: 'Artiste A', numero: 'ERR-AAAA-BBBB', titres: ['Titre un'], motif: MOTIF })
    expect(c.texte).toContain('ERR-AAAA-BBBB')
    expect(c.texte).toContain('Titre un')
    expect(c.texte).toContain(MOTIF)
    expect(c.texte).not.toMatch(/€|\d\s?EUR/)
  })

  it('la migration est additive : une colonne de ligne, quatre de commande, rien modifié', () => {
    const sql = readFileSync('prisma/migrations/20261125090000_suivi_equipe/migration.sql', 'utf8')
    for (const col of ['preparationJours', 'expedieAvant', 'annuleeLe', 'annuleePar', 'motifAnnulation']) expect(sql).toContain(`"${col}"`)
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|DROP)\b/)
  })

  it('dictionnaire : le motif n’est pas promis à l’acheteur', () => {
    expect(fr.commandesEquipe.annulation.motifAide).toContain('l’acheteur ne le lit pas')
    expect(JSON.stringify(fr.commandesEquipe)).not.toMatch(/devise|compte à rebours/i)
  })
})

describe('base : commandes et annulation par l’équipe', () => {
  let base: BaseJetable
  let db: Client
  const compter = async (table: string, where = '') => Number((await db.query(`SELECT count(*) FROM "${table}" ${where}`)).rows[0].count)
  const a = (adresse: string) => envoi.envoyes.filter((e) => e.a === adresse)

  async function oeuvre(slug: string, artiste: string, prix: number, preparation = 3) {
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", devise,
         publication, disponibilite, "artistId", "updatedAt")
       VALUES ($1, $1, $2, 2024, 'Huile', 'D', 'https://res.cloudinary.com/x/p.jpg', $4, 'EUR', 'publiee', 'disponible', $3, now())`,
      [slug, `Titre ${slug}`, artiste, prix],
    )
    await db.query(
      `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", livree, "fraisCentimes", "preparationJours", "transportMinJours", "transportMaxJours", devise, "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'zone-ue', true, 4000, $2, 5, 9, 'EUR', now())`,
      [slug, preparation],
    )
  }

  /** Vente assistée de o1 (artiste A) et o2 (artiste B), payée à `constateLe`. */
  async function preparer(opts: { payer?: boolean; constateLe?: Date } = {}) {
    await oeuvre('o1', 'art-a', 60000, 3)
    await oeuvre('o2', 'art-b', 50000, 6)
    const { poserVenteAssistee, traiterPaiementConstate } = await import('@/lib/commandes')
    const r = await poserVenteAssistee(ADMIN, { email: EMAIL_ACHETEUR, nom: 'Claire Martin-Dupont', pays: 'FR', oeuvres: ['o1', 'o2'] })
    if (!r.ok) throw new Error(`pose refusée : ${r.code}`)
    await db.query(`UPDATE "CoordonneesAcheteur" SET adresse = $2, telephone = $3 WHERE "passageId" = $1`, [r.passageId, ADRESSE, TELEPHONE])
    if (opts.payer !== false) {
      const total = Number((await db.query(`SELECT sum("totalCentimes") AS s FROM "LigneCommande" l JOIN "Commande" c ON c.id = l."commandeId" WHERE c."passageId" = $1`, [r.passageId])).rows[0].s)
      const c = await traiterPaiementConstate(ADMIN, { passageId: r.passageId, source: 'constat_manuel', referenceExterne: 'VIR-1', montantCentimes: total, constatePar: 'admin-1', constateLe: opts.constateLe ?? new Date() } as never)
      expect(c).toMatchObject({ ok: true, commandes: 2 })
    }
    const ligne = (await db.query(`SELECT id, numero FROM "Commande" WHERE "artistId" = 'art-a'`)).rows[0]
    envoi.envoyes.length = 0
    return { numero: ligne.numero as string, commandeId: ligne.id as string, passageId: r.passageId as string }
  }
  const ligneDe = async (numero: string) =>
    (await db.query(`SELECT etat::text AS etat, "annuleeLe", "annuleePar", "motifAnnulation", "expedieAvant", "priseEnChargeAvant" FROM "Commande" WHERE numero = $1`, [numero])).rows[0]

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
    envoi.envoyes.length = 0
    for (const table of ['Incident', 'RemboursementCommande', 'Paiement', 'Jeton', 'Reservation', 'TraitementEvenement', 'Evenement', 'DeclarationDisponibilite', 'LigneCommande', 'Commande', 'CoordonneesAcheteur', 'PassageEnCaisse', 'OffreLivraison', 'ZonePays', 'Zone', 'Artwork', 'Artist', 'User']) {
      await db.query(`DELETE FROM "${table}"`)
    }
    await db.query(`INSERT INTO "User" (id, email, role, "updatedAt") VALUES ('user-a', 'artiste-a@exemple.test', 'artist', now()), ('user-b', 'artiste-b@exemple.test', 'artist', now())`)
    for (const [id, user] of [['art-a', 'user-a'], ['art-b', 'user-b']]) {
      await db.query(
        `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "accordSigneLe", "userId", "updatedAt")
         VALUES ($1, $1, $2, 'MA', 1980, 'Bio', '', now(), $3, now())`,
        [id, id === 'art-a' ? 'Artiste A' : 'Artiste B', user],
      )
    }
    await db.query(`INSERT INTO "Zone" (id, nom, "updatedAt") VALUES ('zone-ue', 'Union européenne', now())`)
    await db.query(`INSERT INTO "ZonePays" ("codePays", "zoneId") VALUES ('FR', 'zone-ue')`)
  })
  afterEach(() => vi.unstubAllEnvs())

  it('la ligne fige le délai de préparation ; la confirmation pose l’échéance d’expédition = constat + plus long délai', async () => {
    const constateLe = new Date('2026-11-20T10:00:00Z')
    const { numero } = await preparer({ constateLe })
    const lignes = (await db.query(`SELECT slug, "preparationJours" FROM "LigneCommande" ORDER BY slug`)).rows
    expect(lignes).toEqual([{ slug: 'o1', preparationJours: 3 }, { slug: 'o2', preparationJours: 6 }])
    expect((await ligneDe(numero)).expedieAvant.toISOString()).toBe('2026-11-23T10:00:00.000Z')
    const autre = (await db.query(`SELECT "expedieAvant" FROM "Commande" WHERE "artistId" = 'art-b'`)).rows[0]
    expect(autre.expedieAvant.toISOString()).toBe('2026-11-26T10:00:00.000Z')
  })

  it('lecture réservée à l’admin : artiste, utilisateur et visiteur reçoivent null', async () => {
    await preparer()
    const { commandesDeLEquipe } = await import('@/lib/commandes')
    expect(await commandesDeLEquipe(ARTISTE_A)).toBeNull()
    expect(await commandesDeLEquipe(USER)).toBeNull()
    expect(await commandesDeLEquipe(VISITEUR)).toBeNull()
    const vue = await commandesDeLEquipe(ADMIN)
    expect(vue?.commandes).toHaveLength(2)
    expect(vue?.commandes[0]).toMatchObject({ etat: 'confirmee', annulable: true })
  })

  it('la lecture ne contient ni adresse, ni téléphone, ni e-mail, ni nom de l’acheteur', async () => {
    await preparer()
    const { commandesDeLEquipe } = await import('@/lib/commandes')
    const json = JSON.stringify(await commandesDeLEquipe(ADMIN))
    for (const interdit of [EMAIL_ACHETEUR, ADRESSE, TELEPHONE, 'Claire', 'Martin']) expect(json).not.toContain(interdit)
  })

  it('retards calculés à la lecture : deux alertes distinctes ; commande ancienne sans échéance d’expédition : aucune alerte', async () => {
    const { numero } = await preparer()
    await db.query(`UPDATE "Commande" SET "priseEnChargeAvant" = now() - interval '1 hour' WHERE numero = $1`, [numero])
    await db.query(`UPDATE "Commande" SET "expedieAvant" = now() - interval '1 hour' WHERE "artistId" = 'art-b'`)
    const { commandesDeLEquipe } = await import('@/lib/commandes')
    const vue = await commandesDeLEquipe(ADMIN)
    expect(vue?.alertes.priseEnCharge).toEqual([numero])
    expect(vue?.alertes.expedition).toHaveLength(1)
    const ancienne = (await db.query(`SELECT numero FROM "Commande" WHERE "artistId" = 'art-b'`)).rows[0].numero
    await db.query(`UPDATE "Commande" SET "expedieAvant" = NULL WHERE numero = $1`, [ancienne])
    const apres = await commandesDeLEquipe(ADMIN)
    expect(apres?.alertes.expedition).toEqual([])
    expect(apres?.commandes.find((c) => c.numero === ancienne)?.alertes).toEqual([])
  })

  it('annulation : annulée, trace (qui, quand, motif), remboursement de l’allocation demandé, un événement, e-mails', async () => {
    const { numero, commandeId } = await preparer()
    const { annulerParLEquipe } = await import('@/lib/commandes')
    expect(await annulerParLEquipe(ADMIN, numero, MOTIF)).toEqual({ ok: true, dejaAnnulee: false })
    expect(await ligneDe(numero)).toMatchObject({ etat: 'annulee', annuleePar: 'admin-1', motifAnnulation: MOTIF })
    expect((await ligneDe(numero)).annuleeLe).toBeInstanceOf(Date)
    const allocation = Number((await db.query(`SELECT sum("totalCentimes") AS s FROM "LigneCommande" WHERE "commandeId" = $1`, [commandeId])).rows[0].s)
    const r = (await db.query(`SELECT "montantCentimes", etat::text AS etat, "paiementId" FROM "RemboursementCommande" WHERE "commandeId" = $1`, [commandeId])).rows
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ montantCentimes: allocation, etat: 'demande' })
    const paiement = (await db.query(`SELECT id FROM "Paiement" WHERE etat = 'constate'`)).rows[0].id
    expect(r[0].paiementId).toBe(paiement)
    expect(await compter('Evenement', `WHERE nom = 'CommandeAnnulee'`)).toBe(1)
    const charge = (await db.query(`SELECT charge FROM "Evenement" WHERE nom = 'CommandeAnnulee'`)).rows[0].charge
    expect(Object.keys(charge)).toEqual(['commandeId'])
    // L'autre commande du passage reste confirmée ; l'œuvre reste vendue (8.7).
    expect((await db.query(`SELECT etat::text AS etat FROM "Commande" WHERE "artistId" = 'art-b'`)).rows[0].etat).toBe('confirmee')
    expect((await db.query(`SELECT disponibilite::text AS d FROM "Artwork" WHERE slug = 'o1'`)).rows[0].d).toBe('vendue')

    const acheteur = a(EMAIL_ACHETEUR)
    expect(acheteur).toHaveLength(1)
    expect(acheteur[0].texte).toContain(numero)
    expect(acheteur[0].texte).not.toContain('aucun paiement')
    expect(acheteur[0].texte).not.toContain(MOTIF)
    const artiste = a('artiste-a@exemple.test')
    expect(artiste).toHaveLength(1)
    expect(artiste[0].sujet).toBe(fr.courriels.commande.annuleeArtiste.sujet(numero))
    expect(artiste[0].texte).toContain(MOTIF)
    for (const interdit of [EMAIL_ACHETEUR, ADRESSE, TELEPHONE]) expect(artiste[0].texte).not.toContain(interdit)
    expect(a('artiste-b@exemple.test')).toHaveLength(0)
  })

  it('une commande prise en charge est annulable aussi', async () => {
    const { numero } = await preparer()
    const { prendreEnCharge, annulerParLEquipe } = await import('@/lib/commandes')
    expect(await prendreEnCharge(ARTISTE_A, numero)).toMatchObject({ ok: true })
    expect(await annulerParLEquipe(ADMIN, numero, MOTIF)).toEqual({ ok: true, dejaAnnulee: false })
    expect((await ligneDe(numero)).etat).toBe('annulee')
  })

  it('motif absent ou court : `motif_invalide`, rien écrit', async () => {
    const { numero } = await preparer()
    const { annulerParLEquipe } = await import('@/lib/commandes')
    expect(await annulerParLEquipe(ADMIN, numero, '')).toEqual({ ok: false, code: 'motif_invalide', erreur: 'obligatoire' })
    expect(await annulerParLEquipe(ADMIN, numero, 'trop cour')).toEqual({ ok: false, code: 'motif_invalide', erreur: 'trop_court' })
    expect((await ligneDe(numero)).etat).toBe('confirmee')
    expect(await compter('RemboursementCommande')).toBe(0)
    expect(await compter('Evenement', `WHERE nom = 'CommandeAnnulee'`)).toBe(0)
  })

  it('mauvais état : expédiée, en attente de paiement et historique donnent `etat_invalide` ; inconnue : `introuvable`', async () => {
    const { numero } = await preparer()
    const { prendreEnCharge, marquerExpediee, annulerParLEquipe } = await import('@/lib/commandes')
    await prendreEnCharge(ARTISTE_A, numero)
    await marquerExpediee(ARTISTE_A, numero, { transporteur: 'DHL Express', numeroSuivi: 'JD014600003SE', envoiAssure: false, referenceAssurance: '' })
    expect(await annulerParLEquipe(ADMIN, numero, MOTIF)).toEqual({ ok: false, code: 'etat_invalide' })
    expect((await ligneDe(numero)).etat).toBe('expediee')

    await db.query(`INSERT INTO "Commande" (id, numero, etat, devise, "ordreHistoriqueId", "montantHistoriqueCentimes", "updatedAt") VALUES ('h1', 'ERR-HHHH-HHHH', 'historique', 'EUR', 'ordre-h1', 1000, now())`)
    expect(await annulerParLEquipe(ADMIN, 'ERR-HHHH-HHHH', MOTIF)).toEqual({ ok: false, code: 'etat_invalide' })
    expect(await annulerParLEquipe(ADMIN, 'ERR-ZZZZ-ZZZZ', MOTIF)).toEqual({ ok: false, code: 'introuvable' })
    expect(await compter('RemboursementCommande')).toBe(0)
  })

  it('en attente de paiement (aucun paiement constaté) : `etat_invalide`, annulerCommande reste le geste', async () => {
    const { numero } = await preparer({ payer: false })
    const { annulerParLEquipe } = await import('@/lib/commandes')
    expect(await annulerParLEquipe(ADMIN, numero, MOTIF)).toEqual({ ok: false, code: 'etat_invalide' })
    expect((await ligneDe(numero)).etat).toBe('en_attente_paiement')
  })

  it('non admin : `acces_refuse`, rien écrit (artiste, utilisateur, visiteur)', async () => {
    const { numero } = await preparer()
    const { annulerParLEquipe } = await import('@/lib/commandes')
    for (const acteur of [ARTISTE_A, USER, VISITEUR]) expect(await annulerParLEquipe(acteur, numero, MOTIF)).toEqual({ ok: false, code: 'acces_refuse' })
    expect((await ligneDe(numero)).etat).toBe('confirmee')
    expect(await compter('RemboursementCommande')).toBe(0)
  })

  it('rejeu : succès sans effet, un seul remboursement, un seul événement, un seul e-mail par destinataire', async () => {
    const { numero } = await preparer()
    const { annulerParLEquipe } = await import('@/lib/commandes')
    await annulerParLEquipe(ADMIN, numero, MOTIF)
    expect(await annulerParLEquipe(ADMIN, numero, 'Un autre motif, assez long.')).toEqual({ ok: true, dejaAnnulee: true })
    expect((await ligneDe(numero)).motifAnnulation).toBe(MOTIF)
    expect(await compter('RemboursementCommande')).toBe(1)
    expect(await compter('Evenement', `WHERE nom = 'CommandeAnnulee'`)).toBe(1)
    expect(a(EMAIL_ACHETEUR)).toHaveLength(1)
  })

  it('deux annulations simultanées : un seul remboursement, un seul événement', async () => {
    const { numero } = await preparer()
    const { annulerParLEquipe } = await import('@/lib/commandes')
    const [r1, r2] = await Promise.all([annulerParLEquipe(ADMIN, numero, MOTIF), annulerParLEquipe(ADMIN, numero, MOTIF)])
    expect([r1, r2].every((r) => r.ok)).toBe(true)
    expect([r1, r2].filter((r) => r.ok && !r.dejaAnnulee)).toHaveLength(1)
    expect(await compter('RemboursementCommande')).toBe(1)
    expect(await compter('Evenement', `WHERE nom = 'CommandeAnnulee'`)).toBe(1)
  })

  it('la section liste les annulées après paiement avec remboursement et motif', async () => {
    const { numero } = await preparer()
    const { annulerParLEquipe, commandesDeLEquipe } = await import('@/lib/commandes')
    await annulerParLEquipe(ADMIN, numero, MOTIF)
    const vue = await commandesDeLEquipe(ADMIN)
    const c = vue?.commandes.find((x) => x.numero === numero)
    expect(c).toMatchObject({ etat: 'annulee', annulable: false, remboursement: { etat: 'demande' }, annulation: { motif: MOTIF } })
    expect(vue?.alertes.priseEnCharge).not.toContain(numero)
  })

  const totalDuPassage = async (passageId: string) =>
    Number((await db.query(`SELECT sum(l."totalCentimes") AS s FROM "LigneCommande" l JOIN "Commande" c ON c.id = l."commandeId" WHERE c."passageId" = $1`, [passageId])).rows[0].s)

  it('une commande annulée en attente est absente de la lecture ; annulée après un paiement tardif (remboursement, sans annuleeLe), présente', async () => {
    const { numero, commandeId, passageId } = await preparer({ payer: false })
    const { annulerCommande, traiterPaiementConstate, commandesDeLEquipe } = await import('@/lib/commandes')
    expect(await annulerCommande(ADMIN, commandeId)).toMatchObject({ ok: true })
    expect((await commandesDeLEquipe(ADMIN))?.commandes.map((c) => c.numero)).not.toContain(numero)
    const r = await traiterPaiementConstate(ADMIN, { passageId, source: 'constat_manuel', referenceExterne: 'VIR-9', montantCentimes: await totalDuPassage(passageId), constatePar: 'admin-1', constateLe: new Date() } as never)
    expect(r).toMatchObject({ ok: true, annulees: 1 })
    expect((await ligneDe(numero)).annuleeLe).toBeNull()
    const c = (await commandesDeLEquipe(ADMIN))?.commandes.find((x) => x.numero === numero)
    expect(c).toMatchObject({ etat: 'annulee', remboursement: { etat: 'demande' } })
  })

  it('e-mail à l’acheteur : paiement constaté sans remboursement → « paiement reçu », jamais « aucun paiement »', async () => {
    const { numero, commandeId } = await preparer()
    const { annulerParLEquipe } = await import('@/lib/commandes')
    await annulerParLEquipe(ADMIN, numero, MOTIF)
    await db.query(`DELETE FROM "RemboursementCommande" WHERE "commandeId" = $1`, [commandeId])
    envoi.envoyes.length = 0
    const { envoyerAnnulationCommande } = await import('@/lib/notifications/gestionnaires')
    await envoyerAnnulationCommande({ id: 'ev-sans-remb', nom: 'CommandeAnnulee', charge: { commandeId } } as never)
    const mails = a(EMAIL_ACHETEUR)
    expect(mails).toHaveLength(1)
    expect(mails[0].texte).toContain(fr.courriels.commande.annulee.paiementRecu(numero))
    expect(mails[0].texte).not.toContain(fr.courriels.commande.annulee.aucunPaiement)
  })

  it.each([[null], [0]])('délai de préparation %s : commande confirmée, aucune échéance d’expédition', async (jours) => {
    const { numero, passageId } = await preparer({ payer: false })
    await db.query(`UPDATE "LigneCommande" SET "preparationJours" = $1`, [jours])
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, { passageId, source: 'constat_manuel', referenceExterne: 'VIR-2', montantCentimes: await totalDuPassage(passageId), constatePar: 'admin-1', constateLe: new Date() } as never)).toMatchObject({ ok: true, commandes: 2 })
    expect(await ligneDe(numero)).toMatchObject({ etat: 'confirmee', expedieAvant: null })
  })

  it('annulerParLEquipe : annulée sans trace de l’équipe → `etat_invalide` ; avec la trace → `dejaAnnulee`', async () => {
    const { numero, commandeId } = await preparer({ payer: false })
    const { annulerCommande, annulerParLEquipe } = await import('@/lib/commandes')
    await annulerCommande(ADMIN, commandeId)
    expect(await annulerParLEquipe(ADMIN, numero, MOTIF)).toEqual({ ok: false, code: 'etat_invalide' })
    await db.query(`UPDATE "Commande" SET "annuleeLe" = now() WHERE id = $1`, [commandeId])
    expect(await annulerParLEquipe(ADMIN, numero, MOTIF)).toEqual({ ok: true, dejaAnnulee: true })
  })

  it('plafond de la liste à expédier : `tronque` vrai au-delà, faux sinon ; les expédiées ne l’évincent pas', async () => {
    await preparer()
    const { commandesDeLEquipe } = await import('@/lib/commandes')
    expect((await commandesDeLEquipe(ADMIN))?.tronque).toBe(false)
    const court = await commandesDeLEquipe(ADMIN, new Date(), 1)
    expect(court?.tronque).toBe(true)
    expect(court?.commandes.filter((c) => c.etat === 'confirmee')).toHaveLength(1)
  })
})
