import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '@/lib/i18n'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// E-mails de commande (FR-34, FR-25, FR-31) : confirmation, annulation, avis à l'artiste, alertes de
// l'équipe. Base réelle ; l'envoi est simulé (aucun vrai e-mail).

type Envoye = { a: string; sujet: string; texte: string; html: string; cle: string }
const envoi = vi.hoisted(() => ({ envoyes: [] as Envoye[], resultat: { ok: true } as { ok: true } | { ok: false; code: 'indisponible' } }))
const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as { type: string; userId?: string } }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => acteur.courant }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }), headers: () => ({ get: () => null }) }))
vi.mock('@/lib/notifications/choix', () => ({
  envoiActif: () => ({
    envoyer: async (c: Envoye) => {
      envoi.envoyes.push(c)
      return envoi.resultat
    },
  }),
  choisirEnvoi: vi.fn(),
  envoiReel: () => false,
}))

const ADMIN = { type: 'admin', userId: 'admin-1' } as never
const EMAIL_ACHETEUR = 'claire@exemple.test'
const SAISIE = { email: EMAIL_ACHETEUR, nom: 'Claire Martin', pays: 'FR', oeuvres: ['o1', 'o2'] }
const TOTAL = 208000

describe('base : e-mails de commande', () => {
  let base: BaseJetable
  let db: Client
  const a = (adresse: string) => envoi.envoyes.filter((e) => e.a === adresse)

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
    await oeuvre('o2', 'art-b')
    const { poserVenteAssistee } = await import('@/lib/commandes')
    const r = await poserVenteAssistee(ADMIN, SAISIE)
    if (!r.ok) throw new Error(`pose refusée : ${r.code}`)
    envoi.envoyes.length = 0 // le lien de la vente assistée n'est pas l'objet de ce test
    return r.passageId
  }

  const fait = (passageId: string) => ({
    passageId, source: 'constat_manuel', referenceExterne: 'VIR-1', montantCentimes: TOTAL, constatePar: 'admin-1', constateLe: new Date(),
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
    envoi.envoyes.length = 0
    envoi.resultat = { ok: true }
    for (const table of ['Incident', 'RemboursementCommande', 'Paiement', 'Jeton', 'Reservation', 'TraitementEvenement', 'Evenement', 'DeclarationDisponibilite', 'LigneCommande', 'Commande', 'CoordonneesAcheteur', 'PassageEnCaisse', 'OffreLivraison', 'ZonePays', 'Zone', 'Artwork', 'Artist', 'User']) {
      await db.query(`DELETE FROM "${table}"`)
    }
    // art-a a un compte (e-mail), art-b n'en a pas.
    await db.query(`INSERT INTO "User" (id, email, role, "updatedAt") VALUES ('user-a', 'artiste-a@exemple.test', 'artist', now())`)
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "accordSigneLe", "userId", "updatedAt")
       VALUES ('art-a', 'art-a', 'Artiste A', 'MA', 1980, 'Bio', '', now(), 'user-a', now())`,
    )
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "accordSigneLe", "updatedAt")
       VALUES ('art-b', 'art-b', 'Artiste B', 'MA', 1980, 'Bio', '', now(), now())`,
    )
    await db.query(`INSERT INTO "Zone" (id, nom, "updatedAt") VALUES ('zone-ue', 'Union européenne', now())`)
    await db.query(`INSERT INTO "ZonePays" ("codePays", "zoneId") VALUES ('FR', 'zone-ue')`)
  })

  it('commande confirmée : acheteur (une par commande), artiste avec compte, équipe ; sans coordonnées de l’acheteur chez les autres', async () => {
    const passage = await poser()
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    await traiterPaiementConstate(ADMIN, fait(passage))

    // Deux commandes (un artiste chacune) : deux e-mails à l'acheteur, chacun avec son numéro.
    const acheteur = a(EMAIL_ACHETEUR)
    expect(acheteur).toHaveLength(2)
    const numeros = (await db.query(`SELECT numero FROM "Commande"`)).rows.map((r) => r.numero as string)
    for (const n of numeros) expect(acheteur.some((e) => e.sujet === fr.courriels.commande.confirmee.sujet(n))).toBe(true)
    expect(acheteur.map((e) => e.texte).join('\n')).toMatch(/1.040/)

    // Artiste avec compte : un avis sobre ; l'artiste sans compte : rien.
    const artiste = a('artiste-a@exemple.test')
    expect(artiste).toHaveLength(1)
    expect(artiste[0].texte).toContain('Titre o1')
    expect(artiste[0].texte).not.toContain('Titre o2')
    expect(artiste[0].texte).toContain(fr.courriels.commande.artiste.suite)

    const equipe = a('contact@errancy.art')
    expect(equipe).toHaveLength(2)
    for (const e of [...artiste, ...equipe]) {
      for (const secret of [EMAIL_ACHETEUR, 'Claire', 'Martin']) {
        expect(e.texte).not.toContain(secret)
        expect(e.html).not.toContain(secret)
      }
    }
    expect(envoi.envoyes).toHaveLength(5)
  })

  it('rejeu des événements : aucun second e-mail', async () => {
    const passage = await poser()
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    await traiterPaiementConstate(ADMIN, fait(passage))
    const avant = envoi.envoyes.length
    const { repartir } = await import('@/lib/evenements')
    const ids = (await db.query(`SELECT id FROM "Evenement" WHERE nom IN ('CommandeConfirmee', 'CommandeAnnulee')`)).rows.map((r) => r.id as string)
    expect(ids).toHaveLength(2)
    await repartir(ids)
    expect(envoi.envoyes).toHaveLength(avant)
  })

  it('annulation par l’équipe sans paiement : acheteur (aucun débit) et équipe', async () => {
    await poser()
    const { annulerCommande } = await import('@/lib/commandes')
    const id = (await db.query(`SELECT id FROM "Commande" ORDER BY numero LIMIT 1`)).rows[0].id as string
    expect(await annulerCommande(ADMIN, id)).toMatchObject({ ok: true })
    const acheteur = a(EMAIL_ACHETEUR)
    expect(acheteur).toHaveLength(1)
    expect(acheteur[0].texte).toContain(fr.courriels.commande.annulee.aucunPaiement)
    expect(acheteur[0].texte).not.toContain('remboursement')
    const equipe = a('contact@errancy.art')
    expect(equipe).toHaveLength(1)
    expect(equipe[0].texte).not.toContain(EMAIL_ACHETEUR)
    expect(equipe[0].texte).not.toContain('Claire')
    expect(a('artiste-a@exemple.test')).toHaveLength(0)
  })

  it('annulation avec remboursement demandé : l’acheteur en est informé', async () => {
    const passage = await poser()
    // L'œuvre o2 est prise avant le constat : sa commande est annulée, le paiement est constaté, remboursement demandé.
    await db.query(`UPDATE "Artwork" SET disponibilite = 'retiree' WHERE slug = 'o2'`)
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    await traiterPaiementConstate(ADMIN, fait(passage))
    expect((await db.query(`SELECT etat::text AS e FROM "RemboursementCommande"`)).rows).toEqual([{ e: 'demande' }])
    const annulations = a(EMAIL_ACHETEUR).filter((e) => e.sujet.endsWith('annulée'))
    expect(annulations).toHaveLength(1)
    expect(annulations[0].texte).toContain(fr.courriels.commande.annulee.remboursementDemande(annulations[0].sujet.split(' ')[1]))
    expect(annulations[0].texte).not.toContain(fr.courriels.commande.annulee.aucunPaiement)
    expect(a(EMAIL_ACHETEUR).filter((e) => e.sujet.endsWith('confirmée'))).toHaveLength(1)
  })

  it('commande sans passage (historique) : aucun e-mail', async () => {
    await db.query(
      `INSERT INTO "Commande" (id, numero, etat, devise, "ordreHistoriqueId", "montantHistoriqueCentimes", "updatedAt")
       VALUES ('hist', 'ERR-HIST-0001', 'historique', 'EUR', 'ordre-1', 1000, now())`,
    )
    const { ecrireEvenement, repartir } = await import('@/lib/evenements')
    const { prisma } = await import('@/lib/prisma')
    const ids = await prisma.$transaction(async (tx) => [
      await ecrireEvenement(tx, { nom: 'CommandeConfirmee', charge: { commandeId: 'hist' } }),
      await ecrireEvenement(tx, { nom: 'CommandeAnnulee', charge: { commandeId: 'hist' } }),
    ])
    await repartir(ids.flat() as string[])
    expect(envoi.envoyes).toHaveLength(0)
  })

  it('échec d’envoi : l’événement reste traité, rien n’est renvoyé', async () => {
    const passage = await poser()
    envoi.resultat = { ok: false, code: 'indisponible' }
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    expect(await traiterPaiementConstate(ADMIN, fait(passage))).toMatchObject({ ok: true })
    const tentes = envoi.envoyes.length
    expect(tentes).toBe(5)
    expect(erreur).toHaveBeenCalled()
    erreur.mockRestore()
    envoi.resultat = { ok: true }
    const { repartir } = await import('@/lib/evenements')
    const ids = (await db.query(`SELECT id FROM "Evenement" WHERE nom = 'CommandeConfirmee'`)).rows.map((r) => r.id as string)
    await repartir(ids)
    expect(envoi.envoyes).toHaveLength(tentes)
  })

  it('annulation par vente ailleurs : l’acheteur lit « aucun paiement reçu », l’équipe est alertée', async () => {
    await poser()
    const { declarerDisponibilite } = await import('@/lib/disponibilite')
    acteur.courant = { type: 'artist', userId: 'user-a' }
    const r = await declarerDisponibilite({ type: 'artist', userId: 'user-a', artiste: { id: 'art-a' } } as never, 'o1', 'vendue_ailleurs')
    expect(r).toMatchObject({ ok: true })
    const acheteur = a(EMAIL_ACHETEUR)
    expect(acheteur).toHaveLength(1)
    expect(acheteur[0].sujet).toMatch(/annulée$/)
    expect(acheteur[0].texte).toContain(fr.courriels.commande.annulee.aucunPaiement)
    expect(a('contact@errancy.art')).toHaveLength(1)
  })

  it('événements périmés : confirmation d’une commande annulée et annulation d’une commande confirmée n’envoient rien', async () => {
    const passage = await poser()
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    await traiterPaiementConstate(ADMIN, fait(passage))
    envoi.envoyes.length = 0
    const confirmee = (await db.query(`SELECT id FROM "Commande" ORDER BY numero LIMIT 1`)).rows[0].id as string
    const { prisma } = await import('@/lib/prisma')
    const { ecrireEvenement, repartir } = await import('@/lib/evenements')
    const ids = await prisma.$transaction(async (tx) => [await ecrireEvenement(tx, { nom: 'CommandeAnnulee', charge: { commandeId: confirmee } })])
    await repartir(ids)
    expect(envoi.envoyes).toHaveLength(0)
    // Commande annulée : une confirmation périmée n'envoie rien non plus.
    await db.query(`UPDATE "Commande" SET etat = 'annulee' WHERE id = $1`, [confirmee])
    const ids2 = await prisma.$transaction(async (tx) => [await ecrireEvenement(tx, { nom: 'CommandeConfirmee', charge: { commandeId: confirmee } })])
    await repartir(ids2)
    expect(envoi.envoyes).toHaveLength(0)
  })

  it('contenus purs : remboursement effectué avec le numéro, singulier « 1 jour »', async () => {
    const { contenuCommandeAnnulee, contenuCommandeConfirmee } = await import('@/lib/notifications/contenus')
    const c = contenuCommandeAnnulee({ nom: 'Claire', numero: 'ERR-AAAA-BBBB', titres: ['T'], remboursement: 'effectue' })
    expect(c.texte).toContain(fr.courriels.commande.annulee.remboursementEffectue('ERR-AAAA-BBBB'))
    expect(c.texte).toContain('ERR-AAAA-BBBB a été remboursée')
    const v = contenuCommandeConfirmee({ nom: 'C', numero: 'ERR-1', lignes: [{ titre: 'T', totalCentimes: 100000, devise: 'EUR', delaiMinJours: 1, delaiMaxJours: 1 }] })
    expect(v.texte).toContain('estimé : 1 jour.')
    expect(v.texte).not.toContain('1 jours')
    expect(v.texte).toContain(fr.livraison.droitsNonInclus)
  })
})
