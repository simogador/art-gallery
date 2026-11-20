import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '@/lib/i18n'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 8.4 (FR-29, AD-9, AD-10, AD-15, AD-16) : livraison constatée. Base réelle ; envoi simulé (aucun vrai
// e-mail). Seuil d'assurance de la 8.2, source de la constatation, rejeu et appuis simultanés (un seul événement,
// un seul e-mail), AD-16 sur la VALEUR rendue (adresse et téléphone masqués après la livraison), aucune durée de
// retour dans l'e-mail ni sur /suivi.

type Envoye = { a: string; sujet: string; texte: string; html: string; cle: string }
const envoi = vi.hoisted(() => ({ envoyes: [] as Envoye[] }))
const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as Record<string, unknown> }))
const cookie = vi.hoisted(() => ({ suivi: undefined as string | undefined }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => acteur.courant }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({ cookies: () => ({ get: (nom: string) => (nom === 'suivi' && cookie.suivi ? { value: cookie.suivi } : undefined) }), headers: () => ({ get: () => null }) }))
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
const PREUVE = 'POD-SIGNATURE-4471'
const texteDe = (noeud: unknown): string =>
  renderToStaticMarkup(noeud as never)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')

describe('sans base : règles pures', () => {
  it('le délai de retour est un réglage : 14 jours (décision 1A)', async () => {
    const { DUREE_RETOUR_JOURS } = await import('@/lib/reglages')
    expect(DUREE_RETOUR_JOURS).toBe(14)
  })

  it('retourAvant : date de livraison + jours calendaires ; date illisible : null', async () => {
    const { retourAvant } = await import('@/lib/commandes/livraison-regles')
    expect(retourAvant(new Date('2026-11-20T10:00:00Z'), 14)?.toISOString()).toBe('2026-12-04T10:00:00.000Z')
    expect(retourAvant(new Date('invalide'), 14)).toBeNull()
  })

  it('sourcesPermises : au-dessus du seuil (8.2), seule la preuve ; sinon les trois ; autre devise : au-dessus', async () => {
    const { sourcesPermises } = await import('@/lib/commandes/livraison-regles')
    const seuil = { devise: 'EUR', centimes: 100000 }
    expect(sourcesPermises(100000, 'EUR', seuil)).toEqual(['acheteur', 'equipe_suivi', 'equipe_preuve'])
    expect(sourcesPermises(100001, 'EUR', seuil)).toEqual(['equipe_preuve'])
    expect(sourcesPermises(10, 'USD', seuil)).toEqual(['equipe_preuve'])
  })

  it('validerLivraison : source de l’équipe, preuve de 2 à 200 caractères, obligatoire au-dessus du seuil ou avec la source « preuve »', async () => {
    const { validerLivraison } = await import('@/lib/commandes/livraison-regles')
    expect(validerLivraison({ source: 'equipe_suivi', preuve: '' }, false)).toEqual({ ok: true, source: 'equipe_suivi', preuve: null })
    expect(validerLivraison({ source: 'equipe_suivi', preuve: '  AB  12 ' }, false)).toEqual({ ok: true, source: 'equipe_suivi', preuve: 'AB 12' })
    expect(validerLivraison({ source: 'equipe_preuve', preuve: '' }, false)).toMatchObject({ ok: false, erreurs: { preuve: 'requis' } })
    expect(validerLivraison({ source: 'acheteur', preuve: 'AB' }, false)).toMatchObject({ ok: false, code: 'invalide', erreurs: { source: 'invalide' } })
    expect(validerLivraison({ source: 'equipe_suivi', preuve: 'A' }, false)).toMatchObject({ ok: false, code: 'invalide', erreurs: { preuve: 'trop_court' } })
    expect(validerLivraison({ source: 'equipe_suivi', preuve: 'x'.repeat(201) }, false)).toMatchObject({ ok: false, erreurs: { preuve: 'trop_long' } })
    expect(validerLivraison({ source: 'equipe_suivi', preuve: PREUVE }, true)).toMatchObject({ ok: false, code: 'preuve_requise', erreurs: { source: 'preuve_requise' } })
    expect(validerLivraison({ source: 'equipe_preuve', preuve: '' }, true)).toMatchObject({ ok: false, code: 'preuve_requise', erreurs: { preuve: 'requis' } })
    expect(validerLivraison({ source: 'equipe_preuve', preuve: PREUVE }, true)).toEqual({ ok: true, source: 'equipe_preuve', preuve: PREUVE })
  })

  it('transitions : expediee → livree seulement ; rien ne sort de livree', async () => {
    const { transitionPermise, ETATS_COMMANDE } = await import('@/lib/commandes/etats')
    expect(ETATS_COMMANDE).toContain('livree')
    expect(transitionPermise('expediee', 'livree')).toBe(true)
    for (const de of ['en_attente_paiement', 'confirmee', 'prise_en_charge', 'annulee', 'historique', 'livree'] as const) expect(transitionPermise(de, 'livree'), de).toBe(false)
    for (const vers of ['confirmee', 'prise_en_charge', 'expediee', 'annulee'] as const) expect(transitionPermise('livree', vers), vers).toBe(false)
    expect(transitionPermise('expediee', 'annulee')).toBe(false)
  })

  it('événement CommandeLivree : charge = commandeId seulement ; relié à l’e-mail de l’acheteur', async () => {
    const { evenementValide } = await import('@/lib/evenements/catalogue')
    const { ABONNEMENTS } = await import('@/lib/abonnements')
    expect(evenementValide({ nom: 'CommandeLivree', charge: { commandeId: 'x' } })).toBe(true)
    expect(evenementValide({ nom: 'CommandeLivree', charge: { commandeId: 'x', preuve: 'y' } })).toBe(false)
    expect(ABONNEMENTS.CommandeLivree.map((a) => a.nom)).toEqual(['envoyerLivraisonCommande'])
  })

  it('frise : « Livrée » datée remplace la livraison prévue', async () => {
    const { construireFrise } = await import('@/lib/commandes/suivi-regles')
    const d = (j: number) => new Date(`2026-11-${j}T10:00:00Z`)
    const frise = construireFrise({
      etat: 'livree', creeeLe: d(10), constateLe: d(11), delaiMinJours: 5, delaiMaxJours: 9,
      priseEnChargeLe: d(12), expedieeLe: d(13), transporteur: 'DHL', numeroSuivi: 'AB12', livreeLe: d(20),
    })
    expect(frise.map((e) => e.cle)).toEqual(['recue', 'paiement', 'prise_en_charge', 'expediee', 'livree'])
    expect(frise[4]).toMatchObject({ faite: true, date: d(20), fin: null })
  })

  it('la migration ajoute la valeur avant `annulee` et cinq colonnes, sans donnée touchée', () => {
    const sql = readFileSync('prisma/migrations/20261126090000_livraison/migration.sql', 'utf8')
    expect(sql).toContain(`ADD VALUE 'livree' BEFORE 'annulee'`)
    for (const col of ['livreeLe', 'livraisonSource', 'livraisonPar', 'preuveLivraison', 'retourAvant']) expect(sql).toContain(`"${col}"`)
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|DROP)\b/)
  })

  it('dictionnaire : aucune durée de retour, gratuité, remboursement ni garantie dans l’e-mail ni sur /suivi (décision 2A)', () => {
    const json = JSON.stringify([fr.courriels.commande.livraison, fr.suivi.reception, fr.suivi.etats.livree, fr.suivi.frise.etapes.livree])
    expect(json).not.toMatch(/retour|rembours|gratuit|garanti|\d+ jours|devise/i)
  })
})

describe('base : livraison constatée', () => {
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
    (await db.query(`SELECT etat::text AS etat, "livreeLe", "livraisonSource", "livraisonPar", "preuveLivraison", "retourAvant" FROM "Commande" WHERE numero = $1`, [numero])).rows[0]
  const SAISIE = { transporteur: 'DHL Express', numeroSuivi: 'JD014600003SE', envoiAssure: true, referenceAssurance: 'REF-ASSUR' }
  /** Commande expédiée (prix de l'œuvre de l'artiste A = `prixA`) et lien de suivi de son passage. */
  async function expediee(prixA: number) {
    const p = await preparer(prixA)
    const { marquerExpediee } = await import('@/lib/commandes')
    expect(await marquerExpediee(ARTISTE_A, p.numero, SAISIE)).toMatchObject({ ok: true })
    const { emettreJetonSuivi } = await import('@/lib/acces/suivi')
    const { prisma } = await import('@/lib/prisma')
    const { jeton } = await prisma.$transaction((tx) => emettreJetonSuivi(tx, p.passageId))
    envoi.envoyes.length = 0
    return { ...p, jeton }
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
    acteur.courant = { type: 'visiteur' }
    cookie.suivi = undefined
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


  it('acheteur, sous le seuil : livrée, source acheteur, fin du délai de retour = livraison + 14 jours, un événement sans donnée, e-mail « Livraison »', async () => {
    const { numero, jeton } = await expediee(60000)
    const { constaterLivraisonAcheteur } = await import('@/lib/commandes')
    expect(await constaterLivraisonAcheteur(jeton, numero)).toEqual({ ok: true, dejaLivree: false })
    const l = await ligneDe(numero)
    expect(l).toMatchObject({ etat: 'livree', livraisonSource: 'acheteur', livraisonPar: null, preuveLivraison: null })
    expect(l.livreeLe).toBeInstanceOf(Date)
    expect(new Date(l.retourAvant).getTime() - new Date(l.livreeLe).getTime()).toBe(14 * 24 * 3_600_000)
    expect(await compter('Evenement', `WHERE nom = 'CommandeLivree'`)).toBe(1)
    const charge = (await db.query(`SELECT charge FROM "Evenement" WHERE nom = 'CommandeLivree'`)).rows[0].charge
    expect(Object.keys(charge)).toEqual(['commandeId'])
    const mails = a(EMAIL_ACHETEUR)
    expect(mails).toHaveLength(1)
    expect(mails[0].sujet).toBe(fr.courriels.commande.livraison.sujet(numero))
    expect(mails[0].texte).toMatch(/\/suivi\/[A-Za-z0-9_-]{43}/)
    expect(mails[0].texte).not.toMatch(/retour|rembours|gratuit|garanti|jours/i)
    expect(envoi.envoyes).toHaveLength(1)
  })

  it('acheteur, au-dessus du seuil : `preuve_requise`, rien écrit, bouton non proposé ; sous le seuil il l’est', async () => {
    const haut = await expediee(150000)
    const { constaterLivraisonAcheteur, lireSuiviPassage } = await import('@/lib/commandes')
    expect(await constaterLivraisonAcheteur(haut.jeton, haut.numero)).toEqual({ ok: false, code: 'preuve_requise' })
    expect((await ligneDe(haut.numero)).etat).toBe('expediee')
    expect(await compter('Evenement', `WHERE nom = 'CommandeLivree'`)).toBe(0)
    const vueHaute = await lireSuiviPassage(haut.jeton)
    expect(vueHaute?.commandes.find((c) => c.numero === haut.numero)?.peutConfirmerReception).toBe(false)
    const { ListeSuivi } = await import('@/app/suivi/ListeSuivi')
    const html = texteDe(ListeSuivi({ commandes: vueHaute?.commandes ?? [], conseil: null }))
    expect(html).not.toContain(fr.suivi.reception.bouton)
    expect(html).toContain(fr.suivi.reception.parLEquipe)
  })

  it('acheteur, sous le seuil : la page propose « J’ai reçu l’œuvre » seulement pour une commande expédiée', async () => {
    const { numero, jeton } = await expediee(60000)
    const { lireSuiviPassage } = await import('@/lib/commandes')
    const { ListeSuivi } = await import('@/app/suivi/ListeSuivi')
    const vue = await lireSuiviPassage(jeton)
    const c = vue?.commandes.find((x) => x.numero === numero)
    expect(c?.peutConfirmerReception).toBe(true)
    expect(JSON.stringify(vue)).not.toMatch(/prixCentimes|Lilas|exemple\.test/)
    expect(texteDe(ListeSuivi({ commandes: vue?.commandes ?? [], conseil: null }))).toContain(fr.suivi.reception.bouton)
    // L'autre commande du passage (artiste B, non expédiée) ne le propose pas.
    expect(vue?.commandes.filter((x) => x.peutConfirmerReception)).toHaveLength(1)
  })

  it('équipe, sous le seuil : suivi du transporteur ou preuve (facultative avec le suivi), auteur retenu', async () => {
    const { numero } = await expediee(60000)
    const { enregistrerLivraison } = await import('@/lib/commandes')
    expect(await enregistrerLivraison(ADMIN, numero, { source: 'equipe_suivi', preuve: '' })).toEqual({ ok: true, dejaLivree: false })
    expect(await ligneDe(numero)).toMatchObject({ etat: 'livree', livraisonSource: 'equipe_suivi', livraisonPar: 'admin-1', preuveLivraison: null })
    const autre = (await db.query(`SELECT numero FROM "Commande" WHERE "artistId" = 'art-b'`)).rows[0].numero as string
    await db.query(`UPDATE "Commande" SET etat = 'expediee' WHERE numero = $1`, [autre])
    expect(await enregistrerLivraison(ADMIN, autre, { source: 'equipe_suivi', preuve: ` ${PREUVE} ` })).toEqual({ ok: true, dejaLivree: false })
    expect(await ligneDe(autre)).toMatchObject({ livraisonSource: 'equipe_suivi', preuveLivraison: PREUVE })
  })

  it('équipe, au-dessus du seuil : sur preuve seulement ; source suivi ou référence vide : `preuve_requise`, rien écrit', async () => {
    const { numero } = await expediee(150000)
    const { enregistrerLivraison } = await import('@/lib/commandes')
    expect(await enregistrerLivraison(ADMIN, numero, { source: 'equipe_suivi', preuve: PREUVE })).toMatchObject({ ok: false, code: 'preuve_requise', erreurs: { source: 'preuve_requise' } })
    expect(await enregistrerLivraison(ADMIN, numero, { source: 'equipe_suivi', preuve: '' })).toMatchObject({ ok: false, code: 'preuve_requise' })
    expect(await enregistrerLivraison(ADMIN, numero, { source: 'equipe_preuve', preuve: '  ' })).toMatchObject({ ok: false, code: 'preuve_requise', erreurs: { preuve: 'requis' } })
    expect((await ligneDe(numero)).etat).toBe('expediee')
    expect(await compter('Evenement', `WHERE nom = 'CommandeLivree'`)).toBe(0)
    expect(await enregistrerLivraison(ADMIN, numero, { source: 'equipe_preuve', preuve: PREUVE })).toEqual({ ok: true, dejaLivree: false })
    expect(await ligneDe(numero)).toMatchObject({ etat: 'livree', livraisonSource: 'equipe_preuve', livraisonPar: 'admin-1', preuveLivraison: PREUVE })
  })

  it('saisie invalide de l’équipe : `invalide` par champ, rien écrit', async () => {
    const { numero } = await expediee(60000)
    const { enregistrerLivraison } = await import('@/lib/commandes')
    expect(await enregistrerLivraison(ADMIN, numero, { source: 'autre', preuve: '' })).toMatchObject({ ok: false, code: 'invalide', erreurs: { source: 'invalide' } })
    expect(await enregistrerLivraison(ADMIN, numero, { source: 'equipe_suivi', preuve: 'x' })).toMatchObject({ ok: false, code: 'invalide', erreurs: { preuve: 'trop_court' } })
    expect(await enregistrerLivraison(ADMIN, numero, { source: 'equipe_suivi', preuve: 'x'.repeat(201) })).toMatchObject({ ok: false, code: 'invalide', erreurs: { preuve: 'trop_long' } })
    expect((await ligneDe(numero)).etat).toBe('expediee')
  })

  it('rejeu : succès sans effet, première date et première source intactes, aucun second événement ni e-mail', async () => {
    const { numero, jeton } = await expediee(60000)
    const { constaterLivraisonAcheteur, enregistrerLivraison } = await import('@/lib/commandes')
    await constaterLivraisonAcheteur(jeton, numero)
    const avant = await ligneDe(numero)
    envoi.envoyes.length = 0
    expect(await constaterLivraisonAcheteur(jeton, numero)).toEqual({ ok: true, dejaLivree: true })
    expect(await enregistrerLivraison(ADMIN, numero, { source: 'equipe_preuve', preuve: PREUVE })).toEqual({ ok: true, dejaLivree: true })
    expect(await ligneDe(numero)).toEqual(avant)
    expect(await compter('Evenement', `WHERE nom = 'CommandeLivree'`)).toBe(1)
    expect(envoi.envoyes).toHaveLength(0)
  })

  it('appuis simultanés (acheteur et équipe) : une seule livraison, un seul événement, un seul e-mail', async () => {
    const { numero, jeton } = await expediee(60000)
    const { constaterLivraisonAcheteur, enregistrerLivraison } = await import('@/lib/commandes')
    const res = await Promise.all([
      constaterLivraisonAcheteur(jeton, numero),
      constaterLivraisonAcheteur(jeton, numero),
      enregistrerLivraison(ADMIN, numero, { source: 'equipe_suivi', preuve: '' }),
    ])
    expect(res.every((r) => r.ok)).toBe(true)
    expect(res.filter((r) => r.ok && !r.dejaLivree)).toHaveLength(1)
    expect(await compter('Evenement', `WHERE nom = 'CommandeLivree'`)).toBe(1)
    expect(a(EMAIL_ACHETEUR)).toHaveLength(1)
  })

  it('mauvais état : en attente, confirmée, prise en charge, annulée : `etat_invalide`, rien écrit', async () => {
    const { numero, jeton, commandeId } = await expediee(60000)
    const { constaterLivraisonAcheteur, enregistrerLivraison } = await import('@/lib/commandes')
    for (const etat of ['en_attente_paiement', 'confirmee', 'prise_en_charge', 'annulee']) {
      await db.query(`UPDATE "Commande" SET etat = $2::"EtatCommande" WHERE id = $1`, [commandeId, etat])
      expect(await constaterLivraisonAcheteur(jeton, numero), etat).toEqual({ ok: false, code: 'etat_invalide' })
      expect(await enregistrerLivraison(ADMIN, numero, { source: 'equipe_suivi' }), etat).toEqual({ ok: false, code: 'etat_invalide' })
      expect((await ligneDe(numero)).etat).toBe(etat)
    }
    expect(await compter('Evenement', `WHERE nom = 'CommandeLivree'`)).toBe(0)
  })

  it('acheteur : commande d’un autre passage, numéro inconnu ou mal formé, jeton absent, mal formé, révoqué : `introuvable`, rien écrit', async () => {
    const { numero, jeton, commandeId } = await expediee(60000)
    await db.query(`INSERT INTO "PassageEnCaisse" (id, "paysLivraison", devise) VALUES ('passage-autre', 'FR', 'EUR')`)
    const { emettreJetonSuivi } = await import('@/lib/acces/suivi')
    const { prisma } = await import('@/lib/prisma')
    const autre = (await prisma.$transaction((tx) => emettreJetonSuivi(tx, 'passage-autre'))).jeton
    const { constaterLivraisonAcheteur } = await import('@/lib/commandes')
    const introuvable = { ok: false, code: 'introuvable' }
    expect(await constaterLivraisonAcheteur(autre, numero)).toEqual(introuvable)
    expect(await constaterLivraisonAcheteur(jeton, 'ERR-0000-0000')).toEqual(introuvable)
    expect(await constaterLivraisonAcheteur(jeton, '')).toEqual(introuvable)
    expect(await constaterLivraisonAcheteur(undefined, numero)).toEqual(introuvable)
    expect(await constaterLivraisonAcheteur('pas-un-jeton', numero)).toEqual(introuvable)
    await db.query(`UPDATE "Jeton" SET "revoqueLe" = now() WHERE usage = 'suivi'`)
    expect(await constaterLivraisonAcheteur(jeton, numero)).toEqual(introuvable)
    expect((await ligneDe(numero)).etat).toBe('expediee')
    expect(commandeId).toBeTruthy()
  })

  it('non admin pour l’équipe (artiste, user, visiteur) : `acces_refuse`', async () => {
    const { numero } = await expediee(60000)
    const { enregistrerLivraison } = await import('@/lib/commandes')
    for (const qui of [ARTISTE_A, { type: 'user', userId: 'u' }, { type: 'visiteur' }]) {
      expect(await enregistrerLivraison(qui as never, numero, { source: 'equipe_suivi' })).toEqual({ ok: false, code: 'acces_refuse' })
    }
    expect((await ligneDe(numero)).etat).toBe('expediee')
  })

  it('AD-16 : commande livrée lisible par son artiste sans adresse ni téléphone ; autre artiste : introuvable ; page, liste, bloc', async () => {
    const { numero, jeton } = await expediee(60000)
    const { constaterLivraisonAcheteur, commandeDeLArtiste, commandesDeLArtiste, nombreAPrendreEnCharge } = await import('@/lib/commandes')
    const avant = await commandeDeLArtiste(ARTISTE_A, numero)
    expect(avant.ok && avant.commande).toMatchObject({ adresse: ADRESSE, telephone: TELEPHONE })
    await constaterLivraisonAcheteur(jeton, numero)
    const lu = await commandeDeLArtiste(ARTISTE_A, numero)
    expect(lu.ok && lu.commande).toMatchObject({ etat: 'livree', prenom: 'Claire' })
    expect(lu.ok && 'adresse' in lu.commande).toBe(false)
    expect(lu.ok && 'telephone' in lu.commande).toBe(false)
    expect(lu.ok && lu.commande.livreeLe).toBeInstanceOf(Date)
    expect(JSON.stringify(lu)).not.toMatch(/Lilas|6 12 34|exemple\.test/)
    const liste = await commandesDeLArtiste(ARTISTE_A)
    expect(liste.ok && liste.commandes.map((c) => [c.numero, c.etat])).toEqual([[numero, 'livree']])
    expect(JSON.stringify(liste)).not.toMatch(/Lilas|6 12 34|exemple\.test/)
    expect(await nombreAPrendreEnCharge(ARTISTE_A)).toEqual({ ok: true, nombre: 0 })
    expect(await commandeDeLArtiste(ARTISTE_B, numero)).toEqual({ ok: false, code: 'introuvable' })

    acteur.courant = ARTISTE_A
    const { default: Page } = await import('@/app/dashboard/artiste/commandes/[numero]/page')
    const page = texteDe(await Page({ params: { numero } }))
    expect(page).toContain(fr.commandesArtiste.etats.livree)
    expect(page).toContain(fr.commandesArtiste.livraisonMasquee)
    expect(page).not.toMatch(/Lilas|6 12 34/)
    expect(page).not.toContain(fr.commandesArtiste.zoneNeutre.texte)
    expect(page).not.toContain(fr.commandesArtiste.action.prendre)
    expect(page).not.toContain(fr.commandesArtiste.expedition.marquer)
    const { default: PageListe } = await import('@/app/dashboard/artiste/commandes/page')
    expect(texteDe(await PageListe())).toContain(numero)
    const { BlocAExpedier } = await import('@/app/dashboard/artiste/commandes/BlocAExpedier')
    expect(texteDe(BlocAExpedier({ commandes: liste.ok ? liste.commandes : [] }))).not.toContain(numero)
  })

  it('une commande livrée ne peut plus être prise en charge, expédiée ni annulée par l’équipe', async () => {
    const { numero, jeton } = await expediee(60000)
    const { constaterLivraisonAcheteur, prendreEnCharge, marquerExpediee, annulerParLEquipe } = await import('@/lib/commandes')
    await constaterLivraisonAcheteur(jeton, numero)
    expect(await prendreEnCharge(ARTISTE_A, numero)).toEqual({ ok: false, code: 'etat_invalide' })
    expect(await marquerExpediee(ARTISTE_A, numero, SAISIE)).toEqual({ ok: false, code: 'etat_invalide' })
    expect(await annulerParLEquipe(ADMIN, numero, 'Un motif suffisamment long')).toMatchObject({ ok: false, code: 'etat_invalide' })
    expect((await ligneDe(numero)).etat).toBe('livree')
  })

  it('/suivi : étape « Livrée » datée à la place de la livraison prévue ; ni fin de délai de retour ni durée', async () => {
    const { numero, jeton } = await expediee(60000)
    const { constaterLivraisonAcheteur, lireSuiviPassage } = await import('@/lib/commandes')
    await constaterLivraisonAcheteur(jeton, numero)
    const suivi = await lireSuiviPassage(jeton)
    const c = suivi?.commandes.find((x) => x.numero === numero)
    expect(c?.etat).toBe('livree')
    expect(c?.peutConfirmerReception).toBe(false)
    expect(c?.etapes.map((e) => e.cle)).toEqual(['recue', 'paiement', 'prise_en_charge', 'expediee', 'livree'])
    expect(c?.etapes[4]).toMatchObject({ faite: true })
    expect(c?.etapes[4].date).toBeInstanceOf(Date)
    expect(JSON.stringify(suivi)).not.toMatch(/retourAvant|Lilas|exemple\.test/)
    const { ListeSuivi } = await import('@/app/suivi/ListeSuivi')
    const html = texteDe(ListeSuivi({ commandes: suivi?.commandes ?? [], conseil: null }))
    expect(html).toContain(fr.suivi.etats.livree)
    expect(html).not.toContain(fr.suivi.reception.bouton)
    expect(html).not.toMatch(/rembours|gratuit|garanti|14 jours|délai de retour/i)
  })

  it('/confirmation : une commande livrée reste « confirmée » ; « Modifier ma commande » refusé ; lien de suivi émis pour une annulation', async () => {
    const { numero, jeton, passageId, commandeId } = await expediee(60000)
    const { constaterLivraisonAcheteur, lireConfirmationPassage, annulerPassagePublic, ouvrirSuiviDuNavigateur } = await import('@/lib/commandes')
    await constaterLivraisonAcheteur(jeton, numero)
    const { emettreJetonCommandePublique } = await import('@/lib/acces/commande-publique')
    const { prisma } = await import('@/lib/prisma')
    const publique = await prisma.$transaction((tx) => emettreJetonCommandePublique(tx, passageId, new Date(Date.now() + 3_600_000)))
    const conf = await lireConfirmationPassage(publique)
    expect(conf?.commandes.find((c) => c.numero === numero)?.etat).toBe('confirmee')
    expect(await annulerPassagePublic(publique)).toEqual({ ok: false, code: 'etat_invalide' })
    const { emettreLienSuiviDeCommande } = await import('@/lib/commandes/suivi')
    expect(await emettreLienSuiviDeCommande(commandeId, { exigerCommandeVivante: true })).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(await ouvrirSuiviDuNavigateur(publique, undefined)).toMatchObject({ reutilise: false })
  })

  it('équipe : « Enregistrer la livraison » sur les expédiées (preuve exigée au-dessus du seuil) ; livrées avec date, source, preuve et fin de délai', async () => {
    const { numero } = await expediee(150000)
    const { commandesDeLEquipe, enregistrerLivraison } = await import('@/lib/commandes')
    const avant = await commandesDeLEquipe(ADMIN)
    expect(avant?.commandes.find((c) => c.numero === numero)).toMatchObject({ etat: 'expediee', livrable: true, preuveRequise: true, livraison: null })
    await enregistrerLivraison(ADMIN, numero, { source: 'equipe_preuve', preuve: PREUVE })
    const apres = await commandesDeLEquipe(ADMIN)
    const c = apres?.commandes.find((x) => x.numero === numero)
    expect(c).toMatchObject({ etat: 'livree', livrable: false, annulable: false, livraison: { source: 'equipe_preuve', preuve: PREUVE } })
    expect(c?.livraison?.le).toBeInstanceOf(Date)
    expect(c?.livraison?.retourAvant).toBeInstanceOf(Date)
    expect(JSON.stringify(apres)).not.toMatch(/Lilas|6 12 34|exemple\.test/)
    expect(await commandesDeLEquipe(ARTISTE_A)).toBeNull()
  })

  it('un événement retardé d’expédition ou de confirmation sur une commande déjà livrée envoie encore', async () => {
    const { numero, jeton, commandeId } = await expediee(60000)
    const { constaterLivraisonAcheteur } = await import('@/lib/commandes')
    await constaterLivraisonAcheteur(jeton, numero)
    envoi.envoyes.length = 0
    const { envoyerExpeditionCommande } = await import('@/lib/notifications')
    await envoyerExpeditionCommande({ id: 'evt-retard', nom: 'CommandeExpediee', version: 1, charge: { commandeId } } as never)
    expect(a(EMAIL_ACHETEUR)).toHaveLength(1)
  })

  it('action `confirmerReception` : cookie `suivi` → livrée ; rejeu « déjà » ; états et jetons refusés avec le bon message', async () => {
    const { confirmerReception } = await import('@/app/suivi/actions')
    const t = fr.suivi.reception
    const { numero, jeton, commandeId } = await expediee(60000)
    expect(await confirmerReception(numero)).toEqual({ ok: false, message: t.erreurs.introuvable }) // cookie absent
    cookie.suivi = jeton
    expect(await confirmerReception('ERR-0000-0000')).toEqual({ ok: false, message: t.erreurs.introuvable })
    await db.query(`UPDATE "Commande" SET etat = 'prise_en_charge' WHERE id = $1`, [commandeId])
    expect(await confirmerReception(numero)).toEqual({ ok: false, message: t.erreurs.etatInvalide })
    await db.query(`UPDATE "Commande" SET etat = 'expediee' WHERE id = $1`, [commandeId])
    expect(await confirmerReception(numero)).toEqual({ ok: true, message: t.reussi })
    expect((await ligneDe(numero)).etat).toBe('livree')
    expect(await confirmerReception(numero)).toEqual({ ok: true, message: t.deja })
  })

  it('action `confirmerReception` : au-dessus du seuil, message « l’équipe constate »', async () => {
    const { confirmerReception } = await import('@/app/suivi/actions')
    const { numero, jeton } = await expediee(150000)
    cookie.suivi = jeton
    expect(await confirmerReception(numero)).toEqual({ ok: false, message: fr.suivi.reception.erreurs.preuveRequise })
    expect((await ligneDe(numero)).etat).toBe('expediee')
  })

  it('action `actionEnregistrerLivraison` : réussite, rejeu, erreurs par champ, non-admin refusé', async () => {
    const { actionEnregistrerLivraison } = await import('@/app/dashboard/admin/commandes/actions')
    const t = fr.commandesEquipe.livraison
    const bas = await expediee(60000)
    acteur.courant = ARTISTE_A as never
    expect(await actionEnregistrerLivraison(bas.numero, 'equipe_suivi', '')).toEqual({ ok: false, message: t.refus.acces_refuse })
    acteur.courant = { type: 'visiteur' }
    expect(await actionEnregistrerLivraison(bas.numero, 'equipe_suivi', '')).toEqual({ ok: false, message: t.refus.acces_refuse })
    acteur.courant = ADMIN as never
    expect(await actionEnregistrerLivraison(bas.numero, 'equipe_suivi', 'x')).toEqual({ ok: false, message: t.erreurs.trop_court, champ: 'preuve' })
    expect(await actionEnregistrerLivraison(bas.numero, 'inconnue', '')).toEqual({ ok: false, message: t.erreurs.source, champ: 'source' })
    expect(await actionEnregistrerLivraison('ERR-0000-0000', 'equipe_suivi', '')).toEqual({ ok: false, message: t.refus.introuvable })
    expect(await actionEnregistrerLivraison(bas.numero, 'equipe_suivi', '')).toEqual({ ok: true, message: t.succes })
    expect(await actionEnregistrerLivraison(bas.numero, 'equipe_suivi', '')).toEqual({ ok: true, message: t.deja })
    expect(await actionEnregistrerLivraison(bas.numero, 'equipe_suivi', '')).not.toMatchObject({ ok: false })
  })

  it('action `actionEnregistrerLivraison` : au-dessus du seuil, source suivi → `preuve_requise` (champ source), preuve vide → champ preuve', async () => {
    const { actionEnregistrerLivraison } = await import('@/app/dashboard/admin/commandes/actions')
    const t = fr.commandesEquipe.livraison
    const { numero } = await expediee(150000)
    acteur.courant = ADMIN as never
    expect(await actionEnregistrerLivraison(numero, 'equipe_suivi', PREUVE)).toEqual({ ok: false, message: t.erreurs.preuve_requise, champ: 'source' })
    expect(await actionEnregistrerLivraison(numero, 'equipe_preuve', '')).toEqual({ ok: false, message: t.erreurs.requis, champ: 'preuve' })
    expect(await actionEnregistrerLivraison(numero, 'equipe_preuve', PREUVE)).toEqual({ ok: true, message: t.succes })
  })
})
