import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '@/lib/i18n'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 8.2 (FR-22, AD-9, AD-15, AD-16, OQ-5) : l'artiste expédie et saisit le suivi. Base réelle ; envoi
// simulé (aucun vrai e-mail). Preuves sur la VALEUR rendue par le module (et la page) : adresse et téléphone
// jusqu'à l'expédition comprise, e-mail de l'acheteur jamais ; seuil d'assurance ; autre artiste et mauvais état
// sans fuite ; rejeu et appuis simultanés : un seul événement, un seul e-mail ; la référence d'assurance ne sort
// ni dans l'e-mail, ni dans l'événement, ni dans /suivi.

type Envoye = { a: string; sujet: string; texte: string; html: string; cle: string }
const envoi = vi.hoisted(() => ({ envoyes: [] as Envoye[] }))
const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as Record<string, unknown> }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => acteur.courant }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }), headers: () => ({ get: () => null }) }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
  usePathname: () => '/dashboard/artiste/commandes',
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
  redirect: (cible: string) => {
    throw new Error(`NEXT_REDIRECT:${cible}`)
  },
}))
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
const ARTISTE_B = { type: 'artist', userId: 'user-b', artiste: { id: 'art-b', slug: 'art-b', name: 'Artiste B' } } as never
const EMAIL_ACHETEUR = 'claire.martin@exemple.test'
const ADRESSE = '12 rue des Lilas\n75011 Paris'
const TELEPHONE = '+33 6 12 34 56 78'
const REFERENCE = 'ASSUR-SECRET-7788'
const texteDe = (noeud: unknown): string =>
  renderToStaticMarkup(noeud as never)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
const SAISIE = { transporteur: 'DHL Express', numeroSuivi: 'JD014600003SE', envoiAssure: false, referenceAssurance: '' }

describe('sans base : règles pures', () => {
  it('le seuil est un réglage : 1 000 € en EUR (décision 1A)', async () => {
    const { SEUIL_ASSURANCE } = await import('@/lib/reglages')
    expect(SEUIL_ASSURANCE).toEqual({ devise: 'EUR', centimes: 100000 })
  })

  it('assuranceRequise : strictement au-dessus du seuil ; autre devise ou prix illisible : au-dessus (prudence)', async () => {
    const { assuranceRequise } = await import('@/lib/commandes/expedition-regles')
    const seuil = { devise: 'EUR', centimes: 100000 }
    expect(assuranceRequise(100000, 'EUR', seuil)).toBe(false)
    expect(assuranceRequise(99999, 'eur', seuil)).toBe(false)
    expect(assuranceRequise(100001, 'EUR', seuil)).toBe(true)
    expect(assuranceRequise(5000, 'USD', seuil)).toBe(true)
    expect(assuranceRequise(null, 'EUR', seuil)).toBe(true)
    expect(assuranceRequise(Number.NaN, 'EUR', seuil)).toBe(true)
  })

  it('validerExpedition : requis, 2 à 60 caractères, espaces nettoyés ; assurance exigée au-dessus du seuil', async () => {
    const { validerExpedition } = await import('@/lib/commandes/expedition-regles')
    expect(validerExpedition({ transporteur: '  DHL   Express ', numeroSuivi: ' AB12 ' }, false)).toEqual({
      ok: true,
      valeur: { transporteur: 'DHL Express', numeroSuivi: 'AB12', envoiAssure: false, referenceAssurance: null },
    })
    const vide = validerExpedition({ transporteur: ' ', numeroSuivi: 'A' }, false)
    expect(vide).toEqual({ ok: false, erreurs: { transporteur: 'requis', numeroSuivi: 'trop_court' } })
    const long = validerExpedition({ transporteur: 'x'.repeat(61), numeroSuivi: 'x'.repeat(60) }, false)
    expect(long).toEqual({ ok: false, erreurs: { transporteur: 'trop_long' } })
    expect(validerExpedition({ ...SAISIE }, true)).toEqual({ ok: false, erreurs: { envoiAssure: 'assurance_requise', referenceAssurance: 'assurance_requise' } })
    expect(validerExpedition({ ...SAISIE, envoiAssure: true }, true)).toEqual({ ok: false, erreurs: { referenceAssurance: 'assurance_requise' } })
    expect(validerExpedition({ ...SAISIE, referenceAssurance: REFERENCE }, true)).toEqual({ ok: false, erreurs: { envoiAssure: 'assurance_requise' } })
    expect(validerExpedition({ ...SAISIE, envoiAssure: true, referenceAssurance: REFERENCE }, true)).toMatchObject({ ok: true, valeur: { envoiAssure: true, referenceAssurance: REFERENCE } })
    expect(validerExpedition({ ...SAISIE, envoiAssure: true, referenceAssurance: 'x'.repeat(61) }, true)).toEqual({ ok: false, erreurs: { referenceAssurance: 'trop_long' } })
  })

  it('transitions : prise_en_charge → expediee seulement ; rien ne sort de expediee', async () => {
    const { transitionPermise, ETATS_COMMANDE } = await import('@/lib/commandes/etats')
    expect(ETATS_COMMANDE).toContain('expediee')
    expect(transitionPermise('prise_en_charge', 'expediee')).toBe(true)
    for (const de of ['en_attente_paiement', 'confirmee', 'annulee', 'historique', 'expediee'] as const) expect(transitionPermise(de, 'expediee'), de).toBe(false)
    for (const vers of ['confirmee', 'prise_en_charge', 'annulee'] as const) expect(transitionPermise('expediee', vers), vers).toBe(false)
  })

  it('événement CommandeExpediee : charge = commandeId seulement ; relié à l’e-mail de l’acheteur', async () => {
    const { evenementValide } = await import('@/lib/evenements/catalogue')
    const { ABONNEMENTS } = await import('@/lib/abonnements')
    expect(evenementValide({ nom: 'CommandeExpediee', charge: { commandeId: 'x' } })).toBe(true)
    expect(evenementValide({ nom: 'CommandeExpediee', charge: { commandeId: 'x', referenceAssurance: 'y' } })).toBe(false)
    expect(ABONNEMENTS.CommandeExpediee.map((a) => a.nom)).toEqual(['envoyerExpeditionCommande'])
  })

  it('frise : étape « Expédiée » datée avec transporteur et numéro, entre la prise en charge et la livraison', async () => {
    const { construireFrise } = await import('@/lib/commandes/suivi-regles')
    const d = (j: number) => new Date(`2026-11-${j}T10:00:00Z`)
    const frise = construireFrise({
      etat: 'expediee', creeeLe: d(10), constateLe: d(11), delaiMinJours: 5, delaiMaxJours: 9,
      priseEnChargeLe: d(12), expedieeLe: d(13), transporteur: 'DHL', numeroSuivi: 'AB12',
    })
    expect(frise.map((e) => e.cle)).toEqual(['recue', 'paiement', 'prise_en_charge', 'expediee', 'livraison'])
    expect(frise[3]).toMatchObject({ faite: true, date: d(13), expedition: { transporteur: 'DHL', numeroSuivi: 'AB12' } })
    expect(frise[4].faite).toBe(false)
  })

  it('la migration ajoute la valeur avant `annulee` et six colonnes, sans donnée touchée', () => {
    const sql = readFileSync('prisma/migrations/20261124090000_expedition/migration.sql', 'utf8')
    expect(sql).toContain(`ADD VALUE 'expediee' BEFORE 'annulee'`)
    for (const col of ['transporteur', 'numeroSuivi', 'expedieeLe', 'expedieePar', 'envoiAssure', 'referenceAssurance']) expect(sql).toContain(`"${col}"`)
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|DROP)\b/)
  })

  it('dictionnaire : pas de montant ni de compte à rebours dans les textes d’expédition', () => {
    const json = JSON.stringify([fr.commandesArtiste.expedition, fr.courriels.commande.expedition])
    expect(json).not.toMatch(/compte à rebours|rembours|garanti|devise/i)
  })
})

describe('base : expédition par l’artiste', () => {
  let base: BaseJetable
  let db: Client
  const compter = async (table: string, where = '') => Number((await db.query(`SELECT count(*) FROM "${table}" ${where}`)).rows[0].count)
  const a = (adresse: string) => envoi.envoyes.filter((e) => e.a === adresse)

  async function oeuvre(slug: string, artiste: string, prix: number) {
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", devise,
         publication, disponibilite, "artistId", "updatedAt")
       VALUES ($1, $1, $2, 2024, 'Huile', 'D', 'https://res.cloudinary.com/x/p.jpg', $4, 'EUR', 'publiee', 'disponible', $3, now())`,
      [slug, `Titre ${slug}`, artiste, prix],
    )
    await db.query(
      `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", livree, "fraisCentimes", "preparationJours", "transportMinJours", "transportMaxJours", devise, "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'zone-ue', true, 4000, 3, 5, 9, 'EUR', now())`,
      [slug],
    )
  }

  /** Vente assistée de o1 (artiste A, `prixA`) et o2 (artiste B, 50 000), payée, puis prise en charge par A. */
  async function preparer(prixA: number, priseEnCharge = true): Promise<{ numero: string; commandeId: string; passageId: string }> {
    await oeuvre('o1', 'art-a', prixA)
    await oeuvre('o2', 'art-b', 50000)
    const { poserVenteAssistee, traiterPaiementConstate, prendreEnCharge } = await import('@/lib/commandes')
    const r = await poserVenteAssistee(ADMIN, { email: EMAIL_ACHETEUR, nom: 'Claire Martin-Dupont', pays: 'FR', oeuvres: ['o1', 'o2'] })
    if (!r.ok) throw new Error(`pose refusée : ${r.code}`)
    await db.query(`UPDATE "CoordonneesAcheteur" SET adresse = $2, telephone = $3 WHERE "passageId" = $1`, [r.passageId, ADRESSE, TELEPHONE])
    const total = Number((await db.query(`SELECT sum("totalCentimes") AS s FROM "LigneCommande" l JOIN "Commande" c ON c.id = l."commandeId" WHERE c."passageId" = $1`, [r.passageId])).rows[0].s)
    const c = await traiterPaiementConstate(ADMIN, { passageId: r.passageId, source: 'constat_manuel', referenceExterne: 'VIR-1', montantCentimes: total, constatePar: 'admin-1', constateLe: new Date() } as never)
    expect(c).toMatchObject({ ok: true, commandes: 2 })
    const ligne = (await db.query(`SELECT id, numero FROM "Commande" WHERE "artistId" = 'art-a'`)).rows[0]
    if (priseEnCharge) expect(await prendreEnCharge(ARTISTE_A, ligne.numero)).toMatchObject({ ok: true })
    envoi.envoyes.length = 0
    return { numero: ligne.numero as string, commandeId: ligne.id as string, passageId: r.passageId }
  }
  const ligneDe = async (numero: string) =>
    (await db.query(`SELECT etat::text AS etat, transporteur, "numeroSuivi", "expedieeLe", "expedieePar", "envoiAssure", "referenceAssurance" FROM "Commande" WHERE numero = $1`, [numero])).rows[0]

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

  it('sous le seuil : expédiée, auteur et date, un événement sans donnée, e-mail avec transporteur, numéro et lien de suivi', async () => {
    const { numero } = await preparer(60000)
    const { marquerExpediee, commandeDeLArtiste } = await import('@/lib/commandes')
    const avant = await commandeDeLArtiste(ARTISTE_A, numero)
    expect(avant.ok && avant.commande.assuranceRequise).toBe(false)
    expect(await marquerExpediee(ARTISTE_A, numero, SAISIE)).toEqual({ ok: true, dejaExpediee: false })
    const ligne = await ligneDe(numero)
    expect(ligne).toMatchObject({ etat: 'expediee', transporteur: 'DHL Express', numeroSuivi: 'JD014600003SE', expedieePar: 'user-a', envoiAssure: false, referenceAssurance: null })
    expect(ligne.expedieeLe).toBeInstanceOf(Date)
    expect(await compter('Evenement', `WHERE nom = 'CommandeExpediee'`)).toBe(1)
    const charge = (await db.query(`SELECT charge FROM "Evenement" WHERE nom = 'CommandeExpediee'`)).rows[0].charge
    expect(Object.keys(charge)).toEqual(['commandeId'])

    const mails = a(EMAIL_ACHETEUR)
    expect(mails).toHaveLength(1)
    expect(mails[0].sujet).toBe(fr.courriels.commande.expedition.sujet(numero))
    expect(mails[0].texte).toContain('DHL Express')
    expect(mails[0].texte).toContain('JD014600003SE')
    expect(mails[0].texte).toMatch(/\/suivi\/[A-Za-z0-9_-]{43}/)
    expect(envoi.envoyes).toHaveLength(1)
  })

  it('au-dessus du seuil : refus `assurance_requise` qui dit ce qui manque, rien écrit ; complet : expédiée avec la référence', async () => {
    const { numero } = await preparer(150000)
    const { marquerExpediee, commandeDeLArtiste } = await import('@/lib/commandes')
    const lu = await commandeDeLArtiste(ARTISTE_A, numero)
    expect(lu.ok && lu.commande.assuranceRequise).toBe(true)
    expect(await marquerExpediee(ARTISTE_A, numero, SAISIE)).toEqual({
      ok: false, code: 'assurance_requise', erreurs: { envoiAssure: 'assurance_requise', referenceAssurance: 'assurance_requise' },
    })
    expect(await marquerExpediee(ARTISTE_A, numero, { ...SAISIE, envoiAssure: true })).toEqual({
      ok: false, code: 'assurance_requise', erreurs: { referenceAssurance: 'assurance_requise' },
    })
    expect(await marquerExpediee(ARTISTE_A, numero, { ...SAISIE, referenceAssurance: REFERENCE })).toEqual({
      ok: false, code: 'assurance_requise', erreurs: { envoiAssure: 'assurance_requise' },
    })
    expect((await ligneDe(numero)).etat).toBe('prise_en_charge')
    expect(await compter('Evenement', `WHERE nom = 'CommandeExpediee'`)).toBe(0)
    expect(await marquerExpediee(ARTISTE_A, numero, { ...SAISIE, envoiAssure: true, referenceAssurance: REFERENCE })).toEqual({ ok: true, dejaExpediee: false })
    expect(await ligneDe(numero)).toMatchObject({ etat: 'expediee', envoiAssure: true, referenceAssurance: REFERENCE })
  })

  it('saisie incomplète : `invalide` par champ, rien écrit', async () => {
    const { numero } = await preparer(60000)
    const { marquerExpediee } = await import('@/lib/commandes')
    expect(await marquerExpediee(ARTISTE_A, numero, { ...SAISIE, transporteur: '', numeroSuivi: 'x' })).toEqual({
      ok: false, code: 'invalide', erreurs: { transporteur: 'requis', numeroSuivi: 'trop_court' },
    })
    expect(await marquerExpediee(ARTISTE_A, numero, { ...SAISIE, numeroSuivi: 'x'.repeat(61) })).toMatchObject({ ok: false, code: 'invalide' })
    expect((await ligneDe(numero)).etat).toBe('prise_en_charge')
    expect(await compter('Evenement', `WHERE nom = 'CommandeExpediee'`)).toBe(0)
  })

  it('rejeu : succès sans effet, la première saisie n’est jamais écrasée, aucun second événement ni e-mail', async () => {
    const { numero } = await preparer(60000)
    const { marquerExpediee } = await import('@/lib/commandes')
    await marquerExpediee(ARTISTE_A, numero, SAISIE)
    const avant = await ligneDe(numero)
    expect(await marquerExpediee(ARTISTE_A, numero, { ...SAISIE, transporteur: 'UPS', numeroSuivi: 'AUTRE-NUM' })).toEqual({ ok: true, dejaExpediee: true })
    expect(await ligneDe(numero)).toEqual(avant)
    expect(await compter('Evenement', `WHERE nom = 'CommandeExpediee'`)).toBe(1)
    expect(a(EMAIL_ACHETEUR)).toHaveLength(1)
  })

  it('deux appuis simultanés : une seule expédition, un seul événement, un seul e-mail', async () => {
    const { numero } = await preparer(60000)
    const { marquerExpediee } = await import('@/lib/commandes')
    const resultats = await Promise.all([marquerExpediee(ARTISTE_A, numero, SAISIE), marquerExpediee(ARTISTE_A, numero, SAISIE)])
    expect(resultats.map((r) => r.ok && r.dejaExpediee).sort()).toEqual([false, true])
    expect(await compter('Evenement', `WHERE nom = 'CommandeExpediee'`)).toBe(1)
    expect(a(EMAIL_ACHETEUR)).toHaveLength(1)
  })

  it('autre artiste, numéro inconnu ou mal formé : `introuvable`, rien écrit', async () => {
    const { numero } = await preparer(60000)
    const { marquerExpediee } = await import('@/lib/commandes')
    expect(await marquerExpediee(ARTISTE_B, numero, SAISIE)).toEqual({ ok: false, code: 'introuvable' })
    expect(await marquerExpediee(ARTISTE_A, 'ERR-AAAA-AAAA', SAISIE)).toEqual({ ok: false, code: 'introuvable' })
    expect(await marquerExpediee(ARTISTE_A, '', SAISIE)).toEqual({ ok: false, code: 'introuvable' })
    expect(await marquerExpediee(ARTISTE_A, 'x'.repeat(200), SAISIE)).toEqual({ ok: false, code: 'introuvable' })
    expect(await marquerExpediee({ type: 'artist', userId: 'user-z', artiste: null } as never, numero, SAISIE)).toEqual({ ok: false, code: 'introuvable' })
    expect((await ligneDe(numero)).etat).toBe('prise_en_charge')
  })

  it('non artiste (visiteur, user, admin) : `acces_refuse`', async () => {
    const { numero } = await preparer(60000)
    const { marquerExpediee } = await import('@/lib/commandes')
    for (const qui of [{ type: 'visiteur' }, { type: 'user', userId: 'user-a' }, ADMIN] as never[]) {
      expect(await marquerExpediee(qui, numero, SAISIE)).toEqual({ ok: false, code: 'acces_refuse' })
    }
    expect((await ligneDe(numero)).etat).toBe('prise_en_charge')
  })

  it('mauvais état : confirmée (pas encore prise en charge), en attente, annulée : `etat_invalide`', async () => {
    const { numero } = await preparer(60000, false)
    const { marquerExpediee } = await import('@/lib/commandes')
    expect(await marquerExpediee(ARTISTE_A, numero, SAISIE)).toEqual({ ok: false, code: 'etat_invalide' })
    await db.query(`UPDATE "Commande" SET etat = 'annulee' WHERE numero = $1`, [numero])
    expect(await marquerExpediee(ARTISTE_A, numero, SAISIE)).toEqual({ ok: false, code: 'etat_invalide' })
    await db.query(`UPDATE "Commande" SET etat = 'en_attente_paiement' WHERE numero = $1`, [numero])
    expect(await marquerExpediee(ARTISTE_A, numero, SAISIE)).toEqual({ ok: false, code: 'etat_invalide' })
    expect(await compter('Evenement', `WHERE nom = 'CommandeExpediee'`)).toBe(0)
  })

  it('AD-16 : adresse et téléphone encore lisibles après l’expédition ; e-mail de l’acheteur jamais ; liste et accueil', async () => {
    const { numero } = await preparer(60000)
    const { marquerExpediee, commandeDeLArtiste, commandesDeLArtiste, nombreAPrendreEnCharge } = await import('@/lib/commandes')
    await marquerExpediee(ARTISTE_A, numero, { ...SAISIE })
    const lu = await commandeDeLArtiste(ARTISTE_A, numero)
    expect(lu.ok && lu.commande).toMatchObject({
      etat: 'expediee', adresse: ADRESSE, telephone: TELEPHONE, prenom: 'Claire',
      expedition: { transporteur: 'DHL Express', numeroSuivi: 'JD014600003SE', envoiAssure: false, referenceAssurance: null },
    })
    expect(lu.ok && lu.commande.expedieeLe).toBeInstanceOf(Date)
    expect(JSON.stringify(lu)).not.toContain(EMAIL_ACHETEUR)
    const liste = await commandesDeLArtiste(ARTISTE_A)
    expect(liste.ok && liste.commandes.map((c) => [c.numero, c.etat])).toEqual([[numero, 'expediee']])
    expect(JSON.stringify(liste)).not.toMatch(/Lilas|6 12 34|exemple\.test/)
    expect(await nombreAPrendreEnCharge(ARTISTE_A)).toEqual({ ok: true, nombre: 0 })
    // L'autre artiste ne voit rien de cette commande.
    expect(await commandeDeLArtiste(ARTISTE_B, numero)).toEqual({ ok: false, code: 'introuvable' })
  })

  it('/suivi : étape « Expédiée » datée avec transporteur et numéro ; jamais la référence d’assurance', async () => {
    const { numero, passageId } = await preparer(150000)
    const { marquerExpediee } = await import('@/lib/commandes')
    await marquerExpediee(ARTISTE_A, numero, { ...SAISIE, envoiAssure: true, referenceAssurance: REFERENCE })
    const { emettreJetonSuivi } = await import('@/lib/acces/suivi')
    const { prisma } = await import('@/lib/prisma')
    const { jeton } = await prisma.$transaction((tx) => emettreJetonSuivi(tx, passageId))
    const { lireSuiviPassage } = await import('@/lib/commandes')
    const suivi = await lireSuiviPassage(jeton)
    const commande = suivi?.commandes.find((c) => c.numero === numero)
    expect(commande?.etat).toBe('expediee')
    const etape = commande?.etapes.find((e) => e.cle === 'expediee')
    expect(etape).toMatchObject({ faite: true, expedition: { transporteur: 'DHL Express', numeroSuivi: 'JD014600003SE' } })
    expect(etape?.date).toBeInstanceOf(Date)
    expect(JSON.stringify(suivi)).not.toContain(REFERENCE)
    // L'e-mail non plus.
    expect(JSON.stringify(a(EMAIL_ACHETEUR))).not.toContain(REFERENCE)
  })

  it('/confirmation : une commande expédiée reste « confirmée » ; « Modifier ma commande » refusé', async () => {
    const { numero, passageId } = await preparer(60000)
    const { marquerExpediee, lireConfirmationPassage, annulerPassagePublic } = await import('@/lib/commandes')
    await marquerExpediee(ARTISTE_A, numero, SAISIE)
    const { emettreJetonCommandePublique } = await import('@/lib/acces/commande-publique')
    const { prisma } = await import('@/lib/prisma')
    const emis = await prisma.$transaction((tx) => emettreJetonCommandePublique(tx, passageId, new Date(Date.now() + 3_600_000)))
    const jeton = typeof emis === 'string' ? emis : (emis as { jeton: string }).jeton
    const conf = await lireConfirmationPassage(jeton)
    expect(conf?.commandes.find((c) => c.numero === numero)?.etat).toBe('confirmee')
    expect(await annulerPassagePublic(jeton)).toEqual({ ok: false, code: 'etat_invalide' })
  })

  it('un événement retardé de « Prise en charge » ou de confirmation sur une commande déjà expédiée envoie encore', async () => {
    const { numero } = await preparer(60000)
    const { marquerExpediee } = await import('@/lib/commandes')
    await marquerExpediee(ARTISTE_A, numero, SAISIE)
    envoi.envoyes.length = 0
    const id = (await db.query(`SELECT id FROM "Commande" WHERE numero = $1`, [numero])).rows[0].id as string
    const { envoyerAvisCommandeArtiste } = await import('@/lib/notifications')
    await envoyerAvisCommandeArtiste({ id: 'evt-retard', nom: 'CommandeConfirmee', version: 1, charge: { commandeId: id } } as never)
    expect(a('artiste-a@exemple.test')).toHaveLength(1)
  })

  const tPage = fr.commandesArtiste

  async function pageCommande(numero: string): Promise<string> {
    acteur.courant = ARTISTE_A
    const { default: Page } = await import('@/app/dashboard/artiste/commandes/[numero]/page')
    return texteDe(await Page({ params: { numero } }))
  }
  async function pageListe(): Promise<string> {
    acteur.courant = ARTISTE_A
    const { default: Page } = await import('@/app/dashboard/artiste/commandes/page')
    return texteDe(await Page())
  }
  async function bloc(): Promise<string> {
    const { commandesDeLArtiste } = await import('@/lib/commandes')
    const { BlocAExpedier } = await import('@/app/dashboard/artiste/commandes/BlocAExpedier')
    const lu = await commandesDeLArtiste(ARTISTE_A)
    return texteDe(BlocAExpedier({ commandes: lu.ok ? lu.commandes : [] }))
  }
  const html = async (n: string) => {
    acteur.courant = ARTISTE_A
    const { default: Page } = await import('@/app/dashboard/artiste/commandes/[numero]/page')
    return renderToStaticMarkup((await Page({ params: { numero: n } })) as never)
  }

  it('rendu, commande confirmée : « Je prends en charge » seulement, ni formulaire d’expédition, ni adresse ; listée dans le bloc', async () => {
    const { numero } = await preparer(60000, false)
    const page = await pageCommande(numero)
    expect(page).toContain(tPage.action.prendre)
    expect(page).not.toContain(tPage.expedition.marquer)
    expect(page).not.toContain('Lilas')
    expect(await pageListe()).toContain(numero)
    expect(await bloc()).toContain(numero)
  })

  it('rendu, prise en charge : formulaire d’expédition, pas de bouton de prise en charge ; assurance seulement au-dessus du seuil', async () => {
    const bas = await preparer(60000)
    const pageBasse = await pageCommande(bas.numero)
    expect(pageBasse).toContain(tPage.expedition.marquer)
    expect(pageBasse).toContain(tPage.expedition.definitif)
    expect(pageBasse).not.toContain(tPage.action.prendre)
    expect(pageBasse).toContain('Lilas')
    expect(await html(bas.numero)).not.toContain('expedition-envoiAssure')
    expect(await bloc()).toContain(bas.numero)

    await db.query(`UPDATE "LigneCommande" SET "prixCentimes" = 150000, "totalCentimes" = 154000 WHERE "commandeId" = $1`, [bas.commandeId])
    const pageHaute = await html(bas.numero)
    expect(pageHaute).toContain('expedition-envoiAssure')
    expect(pageHaute).toContain('expedition-referenceAssurance')
  })

  it('rendu, commande expédiée : récapitulatif, plus de formulaire ni de bouton ; absente du bloc, présente dans la liste', async () => {
    const { numero } = await preparer(60000)
    const { marquerExpediee } = await import('@/lib/commandes')
    await marquerExpediee(ARTISTE_A, numero, SAISIE)
    const page = await pageCommande(numero)
    expect(page).toContain('DHL Express')
    expect(page).toContain('JD014600003SE')
    expect(page).toContain(tPage.expedition.fait.titre)
    expect(page).not.toContain(tPage.expedition.marquer)
    expect(page).not.toContain(tPage.action.prendre)
    expect(await pageListe()).toContain(numero)
    expect(await bloc()).not.toContain(numero)
  })

  it('lien de suivi d’une annulation : émis si la seule commande vivante du passage est expédiée', async () => {
    const { numero, commandeId, passageId } = await preparer(60000)
    const { marquerExpediee } = await import('@/lib/commandes')
    await marquerExpediee(ARTISTE_A, numero, SAISIE)
    await db.query(`UPDATE "Commande" SET etat = 'annulee' WHERE "passageId" = $1 AND id <> $2`, [passageId, commandeId])
    const { emettreLienSuiviDeCommande } = await import('@/lib/commandes/suivi')
    const jeton = await emettreLienSuiviDeCommande(commandeId, { exigerCommandeVivante: true })
    expect(typeof jeton).toBe('string')
  })

  it('« Suivre mes commandes » : un passage dont toutes les commandes sont expédiées s’ouvre', async () => {
    const { passageId } = await preparer(60000)
    await db.query(`UPDATE "Commande" SET etat = 'expediee' WHERE "passageId" = $1`, [passageId])
    const { emettreJetonCommandePublique } = await import('@/lib/acces/commande-publique')
    const { prisma } = await import('@/lib/prisma')
    const jeton = await prisma.$transaction((tx) => emettreJetonCommandePublique(tx, passageId, new Date(Date.now() + 3_600_000)))
    const { ouvrirSuiviDuNavigateur } = await import('@/lib/commandes/suivi')
    const r = await ouvrirSuiviDuNavigateur(jeton, undefined)
    expect(r).not.toBeNull()
    expect(r && 'jeton' in r).toBe(true)
  })
})
