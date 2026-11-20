import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'
import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr, formaterDate } from '@/lib/i18n'
import { URL_SITE } from '@/lib/reglages'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 7.7 (FR-15, AD-14) : suivi des commandes par lien, sans compte. Jeton `suivi` (empreinte seule en base,
// non consommé), échange en cookie `httpOnly`, lecture seule des commandes du passage (frise : dates réelles,
// livraison prévue), liens dans les e-mails de confirmation et d'annulation (émis à l'envoi, révoqués en cas
// d'échec), bouton de /confirmation. Base réelle ; envoi simulé (aucun vrai e-mail). Numéro WhatsApp factice.

type Envoye = { a: string; sujet: string; texte: string; html: string; cle: string }
const envoi = vi.hoisted(() => ({ envoyes: [] as Envoye[], resultat: { ok: true } as { ok: true } | { ok: false; code: 'indisponible' } }))
const hooks = vi.hoisted(() => ({
  emettre: null as null | (() => Promise<never>),
  abandonner: null as null | (() => Promise<never>),
  contenu: false,
  lanceEnvoi: false,
}))
const jar = vi.hoisted(() => ({ lus: {} as Record<string, string | undefined>, poses: [] as { nom: string; valeur: string; options: Record<string, unknown> }[] }))

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => ({ type: 'visiteur' }) }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => '/suivi' }))
vi.mock('@/lib/commandes/suivi', async (original) => {
  const m = await original<typeof import('@/lib/commandes/suivi')>()
  return {
    ...m,
    emettreLienSuiviDeCommande: (...a: Parameters<typeof m.emettreLienSuiviDeCommande>) => (hooks.emettre ? hooks.emettre() : m.emettreLienSuiviDeCommande(...a)),
    abandonnerLienSuivi: (...a: Parameters<typeof m.abandonnerLienSuivi>) => (hooks.abandonner ? hooks.abandonner() : m.abandonnerLienSuivi(...a)),
  }
})
vi.mock('@/lib/notifications/contenus', async (original) => {
  const m = await original<typeof import('@/lib/notifications/contenus')>()
  return {
    ...m,
    contenuCommandeConfirmee: (...a: Parameters<typeof m.contenuCommandeConfirmee>) => {
      if (hooks.contenu) throw new Error('contenu_casse')
      return m.contenuCommandeConfirmee(...a)
    },
  }
})
vi.mock('@/lib/notifications/choix', () => ({
  envoiActif: () => ({
    envoyer: async (c: Envoye) => {
      if (hooks.lanceEnvoi) throw new Error('envoi_leve')
      envoi.envoyes.push(c)
      return envoi.resultat
    },
  }),
  choisirEnvoi: vi.fn(),
  envoiReel: () => false,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (nom: string) => (jar.lus[nom] ? { value: jar.lus[nom] } : undefined),
    set: (nom: string, valeur: string, options: Record<string, unknown>) => jar.poses.push({ nom, valeur, options }),
  }),
  headers: () => ({ get: () => null }),
}))

const TELEPHONE = '+33 6 12 34 56 78'
const COORD = { email: 'claire.martin@exemple.test', nom: 'Claire Martin-Dupont', adresse: '12 rue des Lilas\n75011 Paris', telephone: TELEPHONE }
const ADMIN = { type: 'admin', userId: 'admin-1' } as never
const TOTAL = 208000
const JOUR = 24 * 3_600_000
const NUMERO_FACTICE = '+44 20 7946 0000'
const EXTRAIRE = /\/suivi\/([A-Za-z0-9_-]{43})/

const texteDe = (noeud: unknown): string =>
  renderToStaticMarkup(noeud as never)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom)
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(ts|tsx)$/.test(nom) ? [chemin] : []
  })
}

describe('sans base : règles, dictionnaire, code', () => {
  it('la frise : étapes faites avec dates réelles, livraison prévue calculée, annulée sans date', async () => {
    const { construireFrise, ajouterJours } = await import('@/lib/commandes/suivi-regles')
    const creee = new Date('2026-11-02T10:00:00Z')
    const constate = new Date('2026-11-04T09:30:00Z')
    const confirmee = construireFrise({ etat: 'confirmee', creeeLe: creee, constateLe: constate, delaiMinJours: 8, delaiMaxJours: 12 })
    expect(confirmee.map((e) => e.cle)).toEqual(['recue', 'paiement', 'livraison'])
    expect(confirmee[0]).toMatchObject({ faite: true, date: creee })
    expect(confirmee[1]).toMatchObject({ faite: true, date: constate })
    expect(confirmee[2]).toMatchObject({ faite: false, date: new Date('2026-11-12T09:30:00Z'), fin: new Date('2026-11-16T09:30:00Z') })
    // Constat inconnu : pas de date inventée.
    const sansConstat = construireFrise({ etat: 'confirmee', creeeLe: creee, constateLe: null, delaiMinJours: 8, delaiMaxJours: 12 })
    expect(sansConstat[1]).toMatchObject({ faite: true, date: null })
    expect(sansConstat[2]).toMatchObject({ faite: false, date: null, fin: null })
    // En attente : paiement à venir, livraison sans date.
    const attente = construireFrise({ etat: 'en_attente_paiement', creeeLe: creee, constateLe: constate, delaiMinJours: 8, delaiMaxJours: 12 })
    expect(attente[1]).toMatchObject({ faite: false, date: null })
    expect(attente[2]).toMatchObject({ date: null, fin: null })
    // Annulée : reçue puis annulée, sans date.
    const annulee = construireFrise({ etat: 'annulee', creeeLe: creee, constateLe: null, delaiMinJours: 8, delaiMaxJours: 12 })
    expect(annulee.map((e) => e.cle)).toEqual(['recue', 'annulee'])
    expect(annulee[1]).toMatchObject({ faite: true, date: null })
    // Annulée après un paiement constaté (6.5) : le paiement figure entre « reçue » et « annulée ».
    const payee = construireFrise({ etat: 'annulee', creeeLe: creee, constateLe: constate, delaiMinJours: 8, delaiMaxJours: 12 })
    expect(payee.map((e) => e.cle)).toEqual(['recue', 'paiement', 'annulee'])
    expect(payee[1]).toMatchObject({ faite: true, date: constate })
    expect(payee[2]).toMatchObject({ faite: true, date: null })
    // Délai inconnu (0, null) : pas de date de livraison, étape à venir sans date.
    for (const [min, max] of [[0, 0], [null, null], [0, null], [null, 0]] as const) {
      expect(construireFrise({ etat: 'confirmee', creeeLe: creee, constateLe: constate, delaiMinJours: min, delaiMaxJours: max })[2]).toMatchObject({ faite: false, date: null, fin: null })
    }
    // Minimum nul, maximum positif : seule la borne utile.
    expect(construireFrise({ etat: 'confirmee', creeeLe: creee, constateLe: constate, delaiMinJours: 0, delaiMaxJours: 5 })[2]).toMatchObject({ date: null, fin: new Date('2026-11-09T09:30:00Z') })
    // Minimum positif, maximum absent : le minimum sert de borne unique.
    expect(construireFrise({ etat: 'confirmee', creeeLe: creee, constateLe: constate, delaiMinJours: 3, delaiMaxJours: 0 })[2]).toMatchObject({ date: new Date('2026-11-07T09:30:00Z'), fin: new Date('2026-11-07T09:30:00Z') })
    // Story 8.1 : prise en charge par l'artiste, étape faite et datée entre le paiement et la livraison.
    const priseLe = new Date('2026-11-05T08:00:00Z')
    const prise = construireFrise({ etat: 'prise_en_charge', creeeLe: creee, constateLe: constate, delaiMinJours: 8, delaiMaxJours: 12, priseEnChargeLe: priseLe })
    expect(prise.map((e) => e.cle)).toEqual(['recue', 'paiement', 'prise_en_charge', 'livraison'])
    expect(prise[1]).toMatchObject({ faite: true, date: constate })
    expect(prise[2]).toMatchObject({ faite: true, date: priseLe, fin: null })
    expect(prise[3]).toMatchObject({ faite: false, date: new Date('2026-11-12T09:30:00Z'), fin: new Date('2026-11-16T09:30:00Z') })
    expect(ajouterJours(creee, -1)).toBeNull()
    expect(ajouterJours(null, 3)).toBeNull()
    expect(ajouterJours(new Date('x'), 3)).toBeNull()
  })

  it('Conseil avec le numéro de commande (numéro WhatsApp factice) ; sans numéro : repli', async () => {
    const { messageConseil, boutonConseil } = await import('@/lib/conseil')
    expect(messageConseil({ type: 'commande', numeros: ['ERR-AAAA-BBBB'] })).toBe(fr.conseilWhatsApp.messages.commande(['ERR-AAAA-BBBB']))
    expect(messageConseil({ type: 'commande', numeros: ['ERR-AAAA-BBBB'] })).toContain('ma commande ERR-AAAA-BBBB')
    expect(messageConseil({ type: 'commande', numeros: ['ERR-A', 'ERR-B'] })).toContain('mes commandes ERR-A et ERR-B')
    expect(messageConseil({ type: 'commande', numeros: ['ERR-A', 'ERR-B', 'ERR-C'] })).toContain('mes commandes ERR-A, ERR-B et ERR-C')
    expect(messageConseil({ type: 'commande', numeros: ['ERR-AAAA-BBBB', ' ERR-CCCC-DDDD '] })).toContain('mes commandes ERR-AAAA-BBBB et ERR-CCCC-DDDD')
    expect(messageConseil({ type: 'commande', numeros: ['', '  '] })).toBe(fr.conseilWhatsApp.messages.general)
    const avec = boutonConseil({ numero: NUMERO_FACTICE, contexte: { type: 'commande', numeros: ['ERR-AAAA-BBBB'] }, maintenant: new Date() })
    expect(avec.mode).toBe('whatsapp')
    expect(decodeURIComponent(avec.href)).toContain('ERR-AAAA-BBBB')
    expect(boutonConseil({ numero: null, contexte: { type: 'commande', numeros: ['ERR-AAAA-BBBB'] }, maintenant: new Date() }).mode).toBe('repli')
  })

  it('maintenance : /suivi et /suivi/<jeton> passent, jamais un préfixe flou ; hors mesure', async () => {
    const { passeLaMaintenance, DUREE_SUIVI_JOURS } = await import('@/lib/reglages')
    expect(DUREE_SUIVI_JOURS).toBe(365)
    expect(passeLaMaintenance(null, '/suivi')).toBe(true)
    expect(passeLaMaintenance(null, '/suivi/abc')).toBe(true)
    expect(passeLaMaintenance(null, '/suivi-autre')).toBe(false)
    expect(passeLaMaintenance(null, '/suiviX/abc')).toBe(false)
    expect(passeLaMaintenance(null, '/panier')).toBe(false)
    const { cheminMesurable } = await import('@/lib/mesure/regles')
    expect(cheminMesurable('/suivi')).toBe(false)
    expect(cheminMesurable('/suivi/un-jeton')).toBe(false)
  })

  it('Referrer-Policy no-referrer aussi par next.config pour /suivi', async () => {
    const config = (await import('../next.config.mjs')).default as { headers: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]> }
    const regles = await config.headers()
    const regle = regles.find((r) => r.source === '/suivi/:path*')
    expect(regle?.headers).toEqual([{ key: 'Referrer-Policy', value: 'no-referrer' }])
  })

  it('page et module : ni Prisma dans l’interface, ni prestataire, ni formulaire, ni addition', () => {
    const SRC = path.join(__dirname, '..', 'src')
    const cibles = [
      ...fichiers(path.join(SRC, 'app', 'suivi')),
      path.join(SRC, 'app', 'confirmation', 'actions.ts'),
      path.join(SRC, 'lib', 'commandes', 'suivi.ts'),
      path.join(SRC, 'lib', 'commandes', 'suivi-regles.ts'),
      path.join(SRC, 'lib', 'acces', 'suivi.ts'),
    ]
    expect(cibles.length).toBeGreaterThan(6)
    const addition = /\.reduce\(|\bsum\(|\+=|\b(prix|frais|total)\w*\s*\+|\+\s*\w*\.?(prix|frais|total)/i
    const prestataire = /stripe|paypal|mollie|adyen|payplug|square|braintree|lemonway|session_id|<form|<input|<iframe/i
    for (const f of cibles) {
      const lignes = readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      expect(lignes.filter((l) => prestataire.test(l)), f).toEqual([])
      expect(lignes.filter((l) => addition.test(l)), f).toEqual([])
      if (f.includes(`${path.sep}app${path.sep}`)) expect(lignes.filter((l) => /@\/lib\/prisma|@\/generated|@prisma/.test(l)), f).toEqual([])
    }
    // La route d'échange et la page n'écrivent rien ; seul `acces` écrit des jetons.
    for (const f of [path.join(SRC, 'app', 'suivi', '[jeton]', 'route.ts'), path.join(SRC, 'app', 'suivi', 'page.tsx')]) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/(?<!cookies)\.(create|update|updateMany|delete|deleteMany|upsert)\(|\$executeRaw|emettre|revoquer/)
    }
    const source = readFileSync(path.join(SRC, 'lib', 'commandes', 'suivi.ts'), 'utf8')
    expect(source).not.toMatch(/\.(create|update|updateMany|delete|deleteMany|upsert)\(|\$executeRaw|\.jeton\./)
  })

  it('le suivi n’est dans aucune liste d’exceptions', () => {
    for (const f of ['eslint/exceptions-prisma.cjs', 'eslint/exceptions-textes.cjs', 'tests/exceptions-interface.cjs']) {
      expect(readFileSync(path.join(__dirname, '..', f), 'utf8'), f).not.toContain('src/app/suivi')
    }
  })

  it('dictionnaire : aucune promesse de délai de retour ou de remboursement, aucun compte, pas de mots interdits', () => {
    const json = JSON.stringify(fr.suivi)
    expect(json).not.toMatch(/garantie|gratuit|compte à rebours|créer un compte|inscri|devise|langue|r[ée]servation|disponibilit/i)
    // Le remboursement n'est évoqué que pour renvoyer vers l'équipe, sans délai ni promesse.
    expect(fr.suivi.frise.annuleePayee).toBe('Cette commande a été annulée. Écrivez-nous au sujet du remboursement.')
    expect(json.match(/rembours/gi)).toHaveLength(1)
    expect(fr.suivi.inactif.texte).toBe('Ce lien de suivi n’est plus actif : la commande est close.')
    expect(JSON.stringify(fr.courriels.commande.suivi)).not.toMatch(/rembours|garantie|jours/i)
  })
})

describe('base : jeton, lecture, page, e-mails, route, action', () => {
  let base: BaseJetable
  let db: Client
  const compter = async (table: string) => Number((await db.query(`SELECT count(*) FROM "${table}"`)).rows[0].count)

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
  async function poser(oeuvres: string[]) {
    const { poserPassagePublic } = await import('@/lib/commandes')
    const r = await poserPassagePublic({ coordonnees: COORD, pays: 'FR', oeuvres } as never)
    if (!r.ok) throw new Error('attendu')
    jar.lus.passage_acheteur = r.jeton
    return r as typeof r & { jeton: string; passageId: string }
  }
  async function constater(passageId: string, montant = TOTAL) {
    const { traiterPaiementConstate } = await import('@/lib/commandes')
    return traiterPaiementConstate(ADMIN, {
      passageId, source: 'constat_manuel', referenceExterne: 'VIR-1', montantCentimes: montant, constatePar: 'admin-1', constateLe: new Date(),
    } as never)
  }
  const commandeDe = async (slug: string) =>
    (await db.query(`SELECT c.id, c.numero FROM "Commande" c JOIN "LigneCommande" l ON l."commandeId" = c.id WHERE l.slug = $1`, [slug])).rows[0] as { id: string; numero: string }
  async function emettre(passageId: string): Promise<string> {
    const { emettreJetonSuivi } = await import('@/lib/acces/suivi')
    const { prisma } = await import('@/lib/prisma')
    return (await prisma.$transaction((tx) => emettreJetonSuivi(tx, passageId))).jeton
  }
  async function page() {
    const { default: Page } = await import('@/app/suivi/page')
    return texteDe(await Page())
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
    vi.stubEnv('LOT2_OUVERT', 'oui')
    vi.stubEnv('WHATSAPP_NUMERO', NUMERO_FACTICE)
    jar.lus = {}
    jar.poses = []
    envoi.envoyes.length = 0
    envoi.resultat = { ok: true }
    for (const table of ['TentativeInscription', 'Jeton', 'Incident', 'RemboursementCommande', 'Paiement', 'Reservation', 'TraitementEvenement', 'Evenement', 'DeclarationDisponibilite', 'LigneCommande', 'Commande', 'CoordonneesAcheteur', 'PassageEnCaisse', 'OffreLivraison', 'ZonePays', 'Zone', 'Artwork', 'Artist', 'User']) {
      await db.query(`DELETE FROM "${table}"`)
    }
    await db.query(`INSERT INTO "User" (id, email, role, "updatedAt") VALUES ('user-a', 'artiste-a@exemple.test', 'artist', now())`)
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "accordSigneLe", "userId", "updatedAt")
       VALUES ('art-a', 'art-a', 'Atelier A', 'MA', 1980, 'Bio', '', now(), 'user-a', now())`,
    )
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "accordSigneLe", "updatedAt")
       VALUES ('art-b', 'art-b', 'Atelier B', 'MA', 1980, 'Bio', '', now(), now())`,
    )
    await db.query(`INSERT INTO "Zone" (id, nom, "updatedAt") VALUES ('zone-ue', 'Union européenne', now())`)
    await db.query(`INSERT INTO "ZonePays" ("codePays", "zoneId") VALUES ('FR', 'zone-ue')`)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('jeton : valeur en clair jamais en base, cible = passage, un an, non consommé, plusieurs liens valables ensemble', async () => {
    await oeuvre('o1')
    const r = await poser(['o1'])
    const a = await emettre(r.passageId)
    const b = await emettre(r.passageId)
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const lignes = (await db.query(`SELECT empreinte, usage::text AS usage, cible, echeance, "consommeLe", "revoqueLe" FROM "Jeton" WHERE usage = 'suivi' ORDER BY "createdAt"`)).rows
    expect(lignes).toHaveLength(2)
    expect(lignes[0]).toMatchObject({ usage: 'suivi', cible: r.passageId, consommeLe: null, revoqueLe: null })
    expect(lignes[0].empreinte).toBe(createHash('sha256').update(a).digest('hex'))
    expect(JSON.stringify(lignes)).not.toContain(a)
    const jours = (new Date(lignes[0].echeance).getTime() - Date.now()) / JOUR
    expect(jours).toBeGreaterThan(364.9)
    expect(jours).toBeLessThan(365.1)
    const { lireSuiviPassage } = await import('@/lib/commandes')
    expect(await lireSuiviPassage(a)).not.toBeNull()
    expect(await lireSuiviPassage(a)).not.toBeNull() // lu deux fois : jamais consommé
    expect(await lireSuiviPassage(b)).not.toBeNull()
    expect((await db.query(`SELECT count(*) FROM "Jeton" WHERE usage = 'suivi'`)).rows[0].count).toBe('2')
  })

  it('jeton inconnu, mal formé, périmé, révoqué, d’un autre usage : tous null, sans écriture', async () => {
    await oeuvre('o1')
    const r = await poser(['o1'])
    const valable = await emettre(r.passageId)
    const revoque = await emettre(r.passageId)
    const { lireSuiviPassage, abandonnerLienSuivi } = await import('@/lib/commandes')
    await abandonnerLienSuivi(revoque)
    const avant = await db.query(`SELECT id, "revoqueLe", "consommeLe" FROM "Jeton" ORDER BY id`)
    const inconnu = 'A'.repeat(43)
    for (const mauvais of [undefined, '', 'abc', inconnu, `${valable}x`, revoque, 'é'.repeat(43), '../../etc']) {
      expect(await lireSuiviPassage(mauvais as string | undefined), String(mauvais)).toBeNull()
    }
    // Périmé : un an et un jour plus tard.
    expect(await lireSuiviPassage(valable, new Date(Date.now() + 366 * JOUR))).toBeNull()
    // Le jeton du navigateur (autre usage) n'ouvre pas le suivi.
    expect(await lireSuiviPassage(r.jeton)).toBeNull()
    expect((await db.query(`SELECT id, "revoqueLe", "consommeLe" FROM "Jeton" ORDER BY id`)).rows).toEqual(avant.rows)
  })

  it('commande confirmée : frise avec dates réelles et livraison prévue, jamais adresse, téléphone ni e-mail', async () => {
    await oeuvre('o1')
    await oeuvre('o2', 'art-b')
    const r = await poser(['o1', 'o2'])
    expect(await constater(r.passageId)).toMatchObject({ ok: true })
    const jeton = await emettre(r.passageId)
    const { lireSuiviPassage } = await import('@/lib/commandes')
    const suivi = await lireSuiviPassage(jeton)
    expect(suivi?.fermee).toBe(false)
    expect(suivi?.commandes.map((c) => c.artiste).sort()).toEqual(['Atelier A', 'Atelier B'])
    const constate = new Date((await db.query(`SELECT "constateLe" FROM "Paiement"`)).rows[0].constateLe)
    for (const c of suivi?.commandes ?? []) {
      expect(c).toMatchObject({ etat: 'confirmee', delaiMinJours: 8, delaiMaxJours: 12 })
      expect(c.numero).toMatch(/^ERR-/)
      const [recue, paiement, livraison] = c.etapes
      const cree = new Date((await db.query(`SELECT "createdAt" FROM "Commande" WHERE numero = $1`, [c.numero])).rows[0].createdAt)
      expect(recue).toMatchObject({ cle: 'recue', faite: true })
      expect(recue.date?.getTime()).toBe(cree.getTime())
      expect(paiement).toMatchObject({ cle: 'paiement', faite: true })
      expect(paiement.date?.getTime()).toBe(constate.getTime())
      expect(livraison.faite).toBe(false)
      expect(livraison.date?.getTime()).toBe(constate.getTime() + 8 * JOUR)
      expect(livraison.fin?.getTime()).toBe(constate.getTime() + 12 * JOUR)
    }
    const json = JSON.stringify(suivi)
    for (const secret of ['Lilas', '75011', TELEPHONE, '6 12 34', 'exemple.test', 'Claire', 'Martin']) expect(json).not.toContain(secret)
  })

  it('story 8.1 : commande prise en charge, étape « Prise en charge par l’artiste » faite et datée, l’autre inchangée', async () => {
    await oeuvre('o1')
    await oeuvre('o2', 'art-b')
    const r = await poser(['o1', 'o2'])
    await constater(r.passageId)
    const { prendreEnCharge } = await import('@/lib/commandes')
    const numero = (await commandeDe('o1')).numero
    expect(await prendreEnCharge({ type: 'artist', userId: 'user-a', artiste: { id: 'art-a', slug: 'art-a', name: 'Atelier A' } }, numero)).toMatchObject({ ok: true })
    jar.lus.suivi = await emettre(r.passageId)
    const texte = await page()
    const priseLe = new Date((await db.query(`SELECT "priseEnChargeLe" FROM "Commande" WHERE numero = $1`, [numero])).rows[0].priseEnChargeLe)
    expect(texte.match(new RegExp(fr.suivi.frise.etapes.prise_en_charge, 'g'))).toHaveLength(2) // libellé d'état + étape
    expect(texte).toContain(fr.suivi.etats.priseEnCharge)
    expect(texte).toContain(fr.suivi.frise.faite(formaterDate(priseLe)))
    expect(texte.match(new RegExp(fr.suivi.etats.confirmee, 'g'))).toHaveLength(1)
    expect(texte).not.toMatch(/Lilas|75011|6 12 34|exemple\.test|Claire|Martin/)
  })

  it('page : une frise accessible par commande, dates lisibles, Conseil avec le numéro, aucune adresse', async () => {
    await oeuvre('o1')
    await oeuvre('o2', 'art-b')
    const r = await poser(['o1', 'o2'])
    await constater(r.passageId)
    jar.lus.suivi = await emettre(r.passageId)
    const texte = await page()
    const constate = new Date((await db.query(`SELECT "constateLe" FROM "Paiement"`)).rows[0].constateLe)
    const du = formaterDate(new Date(constate.getTime() + 8 * JOUR))
    const au = formaterDate(new Date(constate.getTime() + 12 * JOUR))
    expect(texte).toContain(fr.suivi.titre)
    for (const n of [(await commandeDe('o1')).numero, (await commandeDe('o2')).numero]) expect(texte).toContain(n)
    expect(texte.match(new RegExp(fr.suivi.etats.confirmee, 'g'))).toHaveLength(2)
    expect(texte.match(new RegExp(fr.suivi.frise.etapes.recue, 'g'))).toHaveLength(2)
    expect(texte.match(new RegExp(fr.suivi.frise.etapes.paiement, 'g'))).toHaveLength(2)
    expect(texte).toContain(fr.suivi.frise.faite(formaterDate(constate)))
    expect(texte).toContain(fr.suivi.frise.prevue(du, au))
    expect(texte).toContain(fr.suivi.frise.estimation)
    expect(texte).toContain('Titre o1')
    expect(texte).not.toContain(fr.suivi.inactif.texte)
    // Lien transféré : mêmes données minimales, jamais adresse, téléphone, e-mail ni nom.
    expect(texte).not.toMatch(/Lilas|75011|6 12 34|exemple\.test|Claire|Martin|créer un compte|Se connecter/i)
    // Conseil : lien wa.me (numéro factice) dont le texte porte les numéros de commande.
    const { default: Page } = await import('@/app/suivi/page')
    const html = renderToStaticMarkup((await Page()) as never)
    const href = /href="(https:\/\/wa\.me\/[^"]+)"/.exec(html.replace(/&amp;/g, '&'))?.[1] ?? ''
    expect(href).toContain('44207946')
    expect(decodeURIComponent(href)).toContain((await commandeDe('o1')).numero)
    expect(decodeURIComponent(href)).toContain((await commandeDe('o2')).numero)
    // Structure : liste ordonnée par commande, étape courante marquée.
    expect(html.match(/<ol /g)).toHaveLength(2)
    // Rien n'est « en cours » pour la livraison prévue ; liste explicite pour les lecteurs d'écran.
    expect(html).not.toContain('aria-current')
    expect(html.match(/<ol role="list"/g)).toHaveLength(2)
    expect(html).not.toContain('tabindex')
  })

  it('en attente : paiement à venir, aucune date de livraison, jamais « Confirmée »', async () => {
    await oeuvre('o1')
    const r = await poser(['o1'])
    jar.lus.suivi = await emettre(r.passageId)
    const { lireSuiviPassage } = await import('@/lib/commandes')
    const suivi = await lireSuiviPassage(jar.lus.suivi)
    const [recue, paiement, livraison] = suivi!.commandes[0].etapes
    expect(recue.faite).toBe(true)
    expect(paiement).toMatchObject({ faite: false, date: null })
    expect(livraison).toMatchObject({ faite: false, date: null, fin: null })
    const texte = await page()
    expect(texte).toContain(fr.suivi.etats.enAttente)
    expect(texte).toContain(fr.suivi.attente)
    expect(texte).not.toContain(fr.suivi.etats.confirmee)
    expect(texte).not.toMatch(/Prévue/)
  })

  it('passage mixte : chaque commande à son état, l’annulée dite telle', async () => {
    await oeuvre('o1')
    await oeuvre('o2', 'art-b')
    const r = await poser(['o1', 'o2'])
    const { annulerCommande } = await import('@/lib/commandes')
    expect(await annulerCommande(ADMIN, (await commandeDe('o2')).id)).toMatchObject({ ok: true })
    expect(await constater(r.passageId)).toMatchObject({ ok: true })
    jar.lus.suivi = await emettre(r.passageId)
    const { lireSuiviPassage } = await import('@/lib/commandes')
    const suivi = await lireSuiviPassage(jar.lus.suivi)
    expect(suivi?.commandes.map((c) => c.etat).sort()).toEqual(['annulee', 'confirmee'])
    // Annulée avant le constat qui a couvert tout le passage (6.5) : le paiement figure sur sa frise.
    expect(suivi?.commandes.find((c) => c.etat === 'annulee')?.etapes.map((e) => e.cle)).toEqual(['recue', 'paiement', 'annulee'])
    const texte = await page()
    expect(texte).toContain(fr.suivi.etats.annulee)
    expect(texte).toContain(fr.suivi.etats.confirmee)
    expect(texte).toContain(fr.suivi.frise.annuleePayee)
    expect(texte).not.toContain(fr.suivi.inactif.texte)
    expect(texte).not.toMatch(/\d+ (jours?|heures?)\s+(pour|de) rembours|sous \d+ jours/i)
  })

  it('toutes annulées : suivi fermé, page « close » identique à celle d’un jeton inconnu', async () => {
    await oeuvre('o1')
    await oeuvre('o2', 'art-b')
    const r = await poser(['o1', 'o2'])
    const jeton = await emettre(r.passageId)
    await db.query(`UPDATE "Commande" SET etat = 'annulee'`)
    const { lireSuiviPassage } = await import('@/lib/commandes')
    expect(await lireSuiviPassage(jeton)).toEqual({ fermee: true, commandes: [] })
    jar.lus.suivi = jeton
    const close = await page()
    expect(close).toContain(fr.suivi.inactif.texte)
    expect(close).not.toMatch(/ERR-|Titre o1|Atelier/)
    for (const autre of [undefined, 'A'.repeat(43), 'abc']) {
      jar.lus.suivi = autre
      expect(await page()).toBe(close)
    }
    // Jeton révoqué ou périmé : la même page.
    jar.lus.suivi = await emettre(r.passageId)
    const { abandonnerLienSuivi } = await import('@/lib/commandes')
    await abandonnerLienSuivi(jar.lus.suivi)
    expect(await page()).toBe(close)
    const { default: Page } = await import('@/app/suivi/page')
    expect(renderToStaticMarkup((await Page()) as never)).toContain('https://wa.me/')
  })

  it('commande historique ou introuvable : pas de passage, pas de lien', async () => {
    await db.query(`INSERT INTO "Commande" (id, numero, etat, devise, "ordreHistoriqueId", "montantHistoriqueCentimes", "updatedAt") VALUES ('hist-1', 'ERR-HIST-0001', 'historique', 'EUR', 'ordre-1', 1000, now())`)
    const { emettreLienSuiviDeCommande } = await import('@/lib/commandes')
    expect(await emettreLienSuiviDeCommande('hist-1')).toBeNull()
    expect(await emettreLienSuiviDeCommande('inconnue')).toBeNull()
    expect(await compter('Jeton')).toBe(0)
  })

  it('e-mail de confirmation : lien de suivi émis à l’envoi, un par e-mail ; artiste et équipe sans lien', async () => {
    await oeuvre('o1')
    await oeuvre('o2', 'art-b')
    const r = await poser(['o1', 'o2'])
    expect(await constater(r.passageId)).toMatchObject({ ok: true })
    const acheteur = envoi.envoyes.filter((e) => e.a === COORD.email)
    expect(acheteur).toHaveLength(2)
    const jetons = acheteur.map((e) => EXTRAIRE.exec(e.texte)?.[1])
    expect(jetons.every(Boolean)).toBe(true)
    expect(new Set(jetons).size).toBe(2)
    for (const e of acheteur) {
      expect(e.texte).toContain(fr.courriels.commande.suivi.intro)
      expect(e.html).toContain('/suivi/')
    }
    const lignes = (await db.query(`SELECT empreinte, cible, "revoqueLe" FROM "Jeton" WHERE usage = 'suivi'`)).rows
    expect(lignes).toHaveLength(2)
    for (const j of jetons) {
      expect(lignes.some((l) => l.empreinte === createHash('sha256').update(j!).digest('hex') && l.cible === r.passageId && l.revoqueLe === null)).toBe(true)
    }
    expect(JSON.stringify(lignes)).not.toContain(jetons[0]!)
    // Les deux liens ouvrent le même suivi.
    const { lireSuiviPassage } = await import('@/lib/commandes')
    for (const j of jetons) expect((await lireSuiviPassage(j))?.commandes).toHaveLength(2)
    // Artiste et équipe : jamais de lien de suivi.
    const autres = envoi.envoyes.filter((e) => e.a !== COORD.email)
    expect(autres.length).toBeGreaterThanOrEqual(3)
    for (const e of autres) {
      expect(e.texte).not.toContain('/suivi/')
      expect(e.html).not.toContain('/suivi/')
    }
  })

  it('e-mail non parti : le jeton émis pour cet envoi est révoqué, le lien n’ouvre rien', async () => {
    await oeuvre('o1')
    const r = await poser(['o1'])
    envoi.resultat = { ok: false, code: 'indisponible' }
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await constater(r.passageId, 104000)).toMatchObject({ ok: true })
    const mail = envoi.envoyes.find((e) => e.a === COORD.email)
    const jeton = EXTRAIRE.exec(mail?.texte ?? '')?.[1]
    expect(jeton).toBeTruthy()
    const lignes = (await db.query(`SELECT "revoqueLe" FROM "Jeton" WHERE usage = 'suivi'`)).rows
    expect(lignes).toHaveLength(1)
    expect(lignes[0].revoqueLe).not.toBeNull()
    const { lireSuiviPassage } = await import('@/lib/commandes')
    expect(await lireSuiviPassage(jeton)).toBeNull()
    // Journal : ids seulement, ni adresse ni lien.
    const journal = JSON.stringify(erreurs.mock.calls)
    expect(journal).not.toContain(jeton!)
    expect(journal).not.toContain('exemple.test')
    erreurs.mockRestore()
  })

  it('e-mail d’annulation : lien absolu tant qu’il reste une commande vivante, sans promesse ; un échec ne révoque que son jeton', async () => {
    await oeuvre('o1')
    await oeuvre('o2', 'art-b')
    const r = await poser(['o1', 'o2'])
    const premier = await emettre(r.passageId) // lien d'un e-mail précédent : doit survivre
    envoi.resultat = { ok: false, code: 'indisponible' }
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { annulerCommande } = await import('@/lib/commandes')
    expect(await annulerCommande(ADMIN, (await commandeDe('o1')).id)).toMatchObject({ ok: true })
    erreurs.mockRestore()
    const echec = EXTRAIRE.exec(envoi.envoyes.find((e) => e.a === COORD.email && e.sujet.includes('annulée'))?.texte ?? '')?.[1]
    expect(echec).toBeTruthy()
    const { lireSuiviPassage } = await import('@/lib/commandes')
    expect(await lireSuiviPassage(echec)).toBeNull() // révoqué
    expect(await lireSuiviPassage(premier)).not.toBeNull() // l'autre lien survit
  })

  it('annulation avec une commande vivante : e-mail avec lien absolu du site, sans promesse de remboursement ni de délai', async () => {
    await oeuvre('o1')
    await oeuvre('o2', 'art-b')
    const r = await poser(['o1', 'o2'])
    const { annulerCommande } = await import('@/lib/commandes')
    expect(await annulerCommande(ADMIN, (await commandeDe('o1')).id)).toMatchObject({ ok: true })
    const mail = envoi.envoyes.find((e) => e.a === COORD.email && e.sujet.includes('annulée'))!
    expect(mail).toBeTruthy()
    const lien = /(https?:\/\/\S+\/suivi\/[A-Za-z0-9_-]{43})/.exec(mail.texte)?.[1] ?? ''
    expect(lien.startsWith(`${URL_SITE}/suivi/`)).toBe(true)
    expect(mail.html).toContain(`${URL_SITE}/suivi/`)
    expect(mail.texte).toContain(fr.courriels.commande.suivi.intro)
    expect(mail.texte).not.toMatch(/garantie|\b\d+ (jours?|heures?|semaines?)\b|sous \d|dans les \d/i)
    expect(mail.texte).not.toMatch(/rembours/i) // aucun paiement constaté : pas de remboursement évoqué
    for (const e of envoi.envoyes.filter((x) => x.a !== COORD.email)) expect(e.texte).not.toContain('/suivi/')
    void r
  })

  it('annulation de la seule commande vivante (passage clos) : e-mail sans lien et aucun jeton émis', async () => {
    await oeuvre('o1')
    await poser(['o1'])
    const { annulerCommande } = await import('@/lib/commandes')
    expect(await annulerCommande(ADMIN, (await commandeDe('o1')).id)).toMatchObject({ ok: true })
    const mail = envoi.envoyes.find((e) => e.a === COORD.email && e.sujet.includes('annulée'))
    expect(mail).toBeTruthy()
    expect(mail!.texte).not.toContain('/suivi/')
    expect(mail!.texte).not.toContain(fr.courriels.commande.suivi.intro)
    expect(mail!.html).not.toContain('/suivi/')
    expect((await db.query(`SELECT count(*) FROM "Jeton" WHERE usage = 'suivi'`)).rows[0].count).toBe('0')
  })

  it('annulation après un paiement constaté : e-mail réel sans délai ni garantie de remboursement', async () => {
    await oeuvre('o1')
    await oeuvre('o2', 'art-b')
    const r = await poser(['o1', 'o2'])
    const { annulerCommande } = await import('@/lib/commandes')
    expect(await annulerCommande(ADMIN, (await commandeDe('o2')).id)).toMatchObject({ ok: true })
    expect(await constater(r.passageId)).toMatchObject({ ok: true }) // o2 déjà annulée : remboursement demandé, o1 confirmée
    envoi.envoyes.length = 0
    const { envoyerAnnulationCommande } = await import('@/lib/notifications/gestionnaires')
    await db.query(`UPDATE "Commande" SET etat = 'annulee' WHERE id = $1`, [(await commandeDe('o1')).id]) // o1 aussi (relu à l'envoi)
    await envoyerAnnulationCommande({ id: 'ev-annul', nom: 'CommandeAnnulee', charge: { commandeId: (await commandeDe('o2')).id } } as never)
    const mail = envoi.envoyes.find((e) => e.a === COORD.email)!
    expect(mail.texte).toContain(fr.courriels.commande.annulee.remboursementDemande((await commandeDe('o2')).numero))
    expect(mail.texte).not.toMatch(/garantie|\b\d+ (jours?|heures?|semaines?)\b|sous \d|dans les \d|sera rembours/i)
    expect(mail.texte).not.toContain('/suivi/') // passage clos : pas de lien
  })

  it('gestionnaire : émission qui lève = e-mail sans lien ; envoi qui lève, composition qui lève = jeton révoqué ; révocation qui échoue = journal sans jeton', async () => {
    await oeuvre('o1')
    const r = await poser(['o1'])
    await constater(r.passageId, 104000)
    const commandeId = (await commandeDe('o1')).id
    const { envoyerConfirmationCommande } = await import('@/lib/notifications/gestionnaires')
    const evenement = { id: 'ev-test', nom: 'CommandeConfirmee', charge: { commandeId } } as never
    const reset = async () => {
      await db.query(`DELETE FROM "Jeton" WHERE usage = 'suivi'`)
      envoi.envoyes.length = 0
    }
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      // 1. L'émission lève : l'e-mail part SANS lien (la confirmation prime), journal sans jeton.
      await reset()
      hooks.emettre = async () => {
        throw new Error('emission_cassee')
      }
      await envoyerConfirmationCommande(evenement)
      hooks.emettre = null
      expect(envoi.envoyes).toHaveLength(1)
      expect(envoi.envoyes[0].texte).not.toContain('/suivi/')
      expect(erreurs.mock.calls.flat().join(' ')).toContain('lien de suivi non émis')

      // 2. L'adaptateur lève : il compte comme un échec, le jeton émis est révoqué.
      await reset()
      hooks.lanceEnvoi = true
      await envoyerConfirmationCommande(evenement)
      hooks.lanceEnvoi = false
      expect((await db.query(`SELECT "revoqueLe" FROM "Jeton" WHERE usage = 'suivi'`)).rows.map((l) => l.revoqueLe !== null)).toEqual([true])

      // 3. La composition lève (après l'émission) : le jeton est révoqué, l'erreur remonte.
      await reset()
      hooks.contenu = true
      await expect(envoyerConfirmationCommande(evenement)).rejects.toThrow('contenu_casse')
      hooks.contenu = false
      expect((await db.query(`SELECT "revoqueLe" FROM "Jeton" WHERE usage = 'suivi'`)).rows.map((l) => l.revoqueLe !== null)).toEqual([true])

      // 4. La révocation échoue : journalisée sans jeton ni adresse.
      await reset()
      erreurs.mockClear()
      envoi.resultat = { ok: false, code: 'indisponible' }
      hooks.abandonner = async () => {
        throw new Error('revocation_cassee')
      }
      await envoyerConfirmationCommande(evenement)
      hooks.abandonner = null
      envoi.resultat = { ok: true }
      const jeton = EXTRAIRE.exec(envoi.envoyes[0].texte)?.[1]
      expect(jeton).toBeTruthy()
      const journal = JSON.stringify(erreurs.mock.calls)
      expect(journal).toContain('lien de suivi non révoqué')
      expect(journal).not.toContain(jeton!)
      expect(journal).not.toContain('exemple.test')
    } finally {
      hooks.emettre = null
      hooks.abandonner = null
      hooks.contenu = false
      hooks.lanceEnvoi = false
      erreurs.mockRestore()
    }
  })

  it('route d’échange : cookie httpOnly, redirection sans jeton, en-têtes, jeton non consommé, aucune écriture pour une valeur mal formée', async () => {
    await oeuvre('o1')
    const r = await poser(['o1'])
    const jeton = await emettre(r.passageId)
    const { GET } = await import('@/app/suivi/[jeton]/route')
    const reponse = await GET(new NextRequest(`https://exemple.test/suivi/${jeton}`), { params: { jeton } })
    expect(reponse.status).toBe(303)
    expect(new URL(reponse.headers.get('location')!).pathname).toBe('/suivi')
    expect(reponse.headers.get('location')).not.toContain(jeton)
    expect(reponse.headers.get('referrer-policy')).toBe('no-referrer')
    expect(reponse.headers.get('cache-control')).toBe('no-store')
    const pose = reponse.headers.get('set-cookie') ?? ''
    expect(pose).toContain(`suivi=${jeton}`)
    expect(pose).toMatch(/httponly/i)
    expect(pose).toMatch(/samesite=lax/i)
    expect(pose).toContain('Path=/suivi')
    expect(pose).toMatch(/expires=/i)
    expect(pose).not.toMatch(/secure/i) // critère unique : NODE_ENV (ici « test »), voir le test de parité
    expect((await db.query(`SELECT "consommeLe" FROM "Jeton" WHERE usage = 'suivi'`)).rows[0].consommeLe).toBeNull()
    // Réutilisable.
    expect((await GET(new NextRequest(`https://exemple.test/suivi/${jeton}`), { params: { jeton } })).headers.get('set-cookie')).toContain(`suivi=${jeton}`)
    // Valeurs invalides : même redirection, aucun cookie posé, rien n'est écrit.
    const avant = await db.query(`SELECT id, "revoqueLe", "consommeLe" FROM "Jeton" ORDER BY id`)
    for (const mauvais of ['abc', 'A'.repeat(43), `${jeton}x`, '%2e%2e', 'é'.repeat(43)]) {
      const rep = await GET(new NextRequest(`https://exemple.test/suivi/${encodeURIComponent(mauvais)}`), { params: { jeton: mauvais } })
      expect(rep.status).toBe(303)
      expect(new URL(rep.headers.get('location')!).pathname).toBe('/suivi')
      expect(rep.headers.get('referrer-policy')).toBe('no-referrer')
      expect(rep.headers.get('set-cookie') ?? '').not.toContain(`suivi=${mauvais}`)
      expect(rep.headers.get('set-cookie') ?? '').not.toMatch(/suivi=[A-Za-z0-9_-]{5,}/)
    }
    expect((await db.query(`SELECT id, "revoqueLe", "consommeLe" FROM "Jeton" ORDER BY id`)).rows).toEqual(avant.rows)
    // Un cookie portant la valeur invalide est effacé ; celui d'un autre lien reste.
    const inconnu = 'B'.repeat(43)
    const efface = await GET(new NextRequest(`https://exemple.test/suivi/${inconnu}`, { headers: { cookie: `suivi=${inconnu}` } }), { params: { jeton: inconnu } })
    expect(efface.headers.get('set-cookie') ?? '').toMatch(/suivi=;|suivi=\s*;|Max-Age=0|expires=Thu, 01 Jan 1970/i)
    const garde = await GET(new NextRequest(`https://exemple.test/suivi/${inconnu}`, { headers: { cookie: `suivi=${jeton}` } }), { params: { jeton: inconnu } })
    expect(garde.headers.get('set-cookie') ?? '').not.toContain('suivi=')
  })

  it('« Suivre mes commandes » : passage dont toutes les commandes sont prises en charge (8.1) → ok, un cookie suivi', async () => {
    await oeuvre('o1')
    await oeuvre('o2', 'art-b')
    const r = await poser(['o1', 'o2'])
    await constater(r.passageId)
    await db.query(`UPDATE "Commande" SET etat = 'prise_en_charge', "priseEnChargeLe" = now() WHERE "passageId" = $1`, [r.passageId])
    const { ouvrirSuivi } = await import('@/app/confirmation/actions')
    expect(await ouvrirSuivi()).toEqual({ ok: true })
    expect(jar.poses.filter((c) => c.nom === 'suivi')).toHaveLength(1)
  })

  it('« Suivre mes commandes » : jeton suivi émis pour le passage du navigateur, cookie posé, réutilisé à l’appui suivant', async () => {
    await oeuvre('o1')
    await oeuvre('o2', 'art-b')
    const r = await poser(['o1', 'o2'])
    await constater(r.passageId)
    envoi.envoyes.length = 0
    await db.query(`DELETE FROM "Jeton" WHERE usage = 'suivi'`)
    const { ouvrirSuivi } = await import('@/app/confirmation/actions')
    expect(await ouvrirSuivi()).toEqual({ ok: true })
    expect(jar.poses).toHaveLength(1)
    const { nom, valeur, options } = jar.poses[0]
    expect(nom).toBe('suivi')
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/suivi' })
    expect(options.expires).toBeInstanceOf(Date)
    const lignes = (await db.query(`SELECT empreinte, cible FROM "Jeton" WHERE usage = 'suivi'`)).rows
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({ cible: r.passageId, empreinte: createHash('sha256').update(valeur).digest('hex') })
    const { lireSuiviPassage } = await import('@/lib/commandes')
    expect((await lireSuiviPassage(valeur))?.commandes).toHaveLength(2)
    // Second appui avec le cookie déjà posé : même lien, aucun jeton de plus.
    jar.lus.suivi = valeur
    expect(await ouvrirSuivi()).toEqual({ ok: true })
    expect(await compter('Jeton')).toBe(2) // commande_publique + suivi
    expect(jar.poses[1].valeur).toBe(valeur)
    // Un cookie `suivi` d'un autre passage n'est pas repris.
    jar.lus.suivi = 'A'.repeat(43)
    expect(await ouvrirSuivi()).toEqual({ ok: true })
    expect(jar.poses[2].valeur).not.toBe(valeur)
    expect(await compter('Jeton')).toBe(3)
  })

  it('« Suivre mes commandes » : cookie absent, jeton invalide, périmé ou révoqué = message neutre, rien écrit, aucun cookie', async () => {
    await oeuvre('o1')
    const r = await poser(['o1'])
    const { ouvrirSuivi } = await import('@/app/confirmation/actions')
    const avant = await compter('Jeton')
    for (const mauvais of [undefined, 'abc', 'A'.repeat(43)]) {
      jar.lus.passage_acheteur = mauvais
      expect(await ouvrirSuivi()).toEqual({ ok: false, code: 'invalide' })
    }
    // Un jeton suivi (autre usage) dans le cookie du passage n'ouvre rien.
    jar.lus.passage_acheteur = await emettre(r.passageId)
    expect(await ouvrirSuivi()).toEqual({ ok: false, code: 'invalide' })
    // Jeton du passage révoqué.
    jar.lus.passage_acheteur = r.jeton
    await db.query(`UPDATE "Jeton" SET "revoqueLe" = now() WHERE usage = 'commande_publique'`)
    expect(await ouvrirSuivi()).toEqual({ ok: false, code: 'invalide' })
    expect(jar.poses).toHaveLength(0)
    expect(await compter('Jeton')).toBe(avant + 1) // seul le jeton émis par ce test lui-même
  })

  it('cookie `suivi` : mêmes options pour la route et pour l’action, secure seulement en production', async () => {
    await oeuvre('o1')
    const r = await poser(['o1'])
    const jeton = await emettre(r.passageId)
    const { GET } = await import('@/app/suivi/[jeton]/route')
    const { ouvrirSuivi } = await import('@/app/confirmation/actions')
    const attributs = (set: string) => set.split(';').map((x) => x.trim().toLowerCase()).filter((x) => x && !x.startsWith('expires') && !x.startsWith('suivi=') && !x.startsWith('max-age'))
    for (const production of [false, true]) {
      vi.stubEnv('NODE_ENV', production ? 'production' : 'test')
      jar.poses = []
      jar.lus = { passage_acheteur: r.jeton }
      const route = await GET(new NextRequest(`https://exemple.test/suivi/${jeton}`), { params: { jeton } })
      const enTete = route.headers.get('set-cookie') ?? ''
      expect(/secure/i.test(enTete)).toBe(production)
      expect(await ouvrirSuivi()).toEqual({ ok: true })
      expect(jar.poses[0].options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/suivi', secure: production })
      // Mêmes attributs côté route (httponly, samesite, path, secure éventuel).
      const attendu = ['httponly', 'samesite=lax', 'path=/suivi', ...(production ? ['secure'] : [])].sort()
      expect(attributs(enTete).sort()).toEqual(attendu)
    }
    // Même sur un schéma http en production : le critère est celui de l'environnement, identique partout.
    const http = await GET(new NextRequest(`http://exemple.test/suivi/${jeton}`), { params: { jeton } })
    expect(/secure/i.test(http.headers.get('set-cookie') ?? '')).toBe(true)
  })

  it('panne de la base pendant l’échange : 503 neutre, ni cookie ni redirection vers « close », journal sans jeton', async () => {
    await oeuvre('o1')
    const r = await poser(['o1'])
    const jeton = await emettre(r.passageId)
    const { prisma } = await import('@/lib/prisma')
    const espion = vi.spyOn(prisma.jeton, 'findUnique').mockRejectedValue(new Error('base_indisponible'))
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const { GET } = await import('@/app/suivi/[jeton]/route')
      const reponse = await GET(new NextRequest(`https://exemple.test/suivi/${jeton}`, { headers: { cookie: `suivi=${jeton}` } }), { params: { jeton } })
      expect(reponse.status).toBe(503)
      expect(reponse.headers.get('location')).toBeNull()
      expect(reponse.headers.get('set-cookie')).toBeNull()
      expect(reponse.headers.get('cache-control')).toBe('no-store')
      expect(reponse.headers.get('referrer-policy')).toBe('no-referrer')
      const corps = await reponse.text()
      expect(corps).toContain(fr.suivi.echange.texte)
      expect(corps).toContain(fr.suivi.echange.reessayer)
      expect(corps).not.toContain(fr.suivi.inactif.texte)
      expect(corps).not.toContain(jeton)
      expect(JSON.stringify(erreurs.mock.calls)).not.toContain(jeton)
      expect(JSON.stringify(erreurs.mock.calls)).toContain('suivi_echange_echoue')
    } finally {
      espion.mockRestore()
      erreurs.mockRestore()
    }
  })

  it('cookie `suivi` d’un autre passage : conservé par un lien périmé ou mal formé, remplacé par un lien valide d’un second passage', async () => {
    await oeuvre('o1')
    await oeuvre('o2', 'art-b')
    const r1 = await poser(['o1'])
    const valide1 = await emettre(r1.passageId)
    const { poserPassagePublic } = await import('@/lib/commandes')
    const r2 = await poserPassagePublic({ coordonnees: { ...COORD, email: 'autre@exemple.test' }, pays: 'FR', oeuvres: ['o2'] } as never)
    if (!r2.ok) throw new Error('attendu')
    const valide2 = await emettre(r2.passageId)
    const { GET } = await import('@/app/suivi/[jeton]/route')
    const avecCookie = (jeton: string) => new NextRequest(`https://exemple.test/suivi/${jeton}`, { headers: { cookie: `suivi=${valide1}` } })
    for (const mauvais of ['abc', 'A'.repeat(43)]) {
      const rep = await GET(avecCookie(mauvais), { params: { jeton: mauvais } })
      expect(rep.headers.get('set-cookie') ?? '').not.toContain('suivi=')
    }
    // Périmé : jeton valable révoqué à la main par l'échéance.
    await db.query(`UPDATE "Jeton" SET echeance = now() - interval '1 day' WHERE empreinte = $1`, [createHash('sha256').update(valide2).digest('hex')])
    const perime = await GET(avecCookie(valide2), { params: { jeton: valide2 } })
    expect(perime.headers.get('set-cookie') ?? '').not.toContain('suivi=')
    // Un lien valide d'un second passage remplace le cookie (un seul cookie `suivi` par navigateur).
    const encore = await emettre(r2.passageId)
    const remplace = await GET(avecCookie(encore), { params: { jeton: encore } })
    expect(remplace.headers.get('set-cookie')).toContain(`suivi=${encore}`)
  })

  it('« Suivre mes commandes » : plafond de liens actifs par passage, refus neutre ; l’émission des e-mails n’est jamais refusée', async () => {
    await oeuvre('o1')
    const r = await poser(['o1'])
    const { PLAFOND_LIENS_SUIVI } = await import('@/lib/reglages')
    expect(PLAFOND_LIENS_SUIVI).toBe(20)
    for (let i = 0; i < PLAFOND_LIENS_SUIVI; i++) await emettre(r.passageId)
    const { ouvrirSuivi } = await import('@/app/confirmation/actions')
    jar.lus = { passage_acheteur: r.jeton }
    expect(await ouvrirSuivi()).toEqual({ ok: false, code: 'trop_de_liens' })
    expect(jar.poses).toHaveLength(0)
    expect((await db.query(`SELECT count(*) FROM "Jeton" WHERE usage = 'suivi'`)).rows[0].count).toBe(String(PLAFOND_LIENS_SUIVI))
    // Un lien révoqué ou échu ne compte pas.
    await db.query(`UPDATE "Jeton" SET "revoqueLe" = now() WHERE id = (SELECT id FROM "Jeton" WHERE usage = 'suivi' LIMIT 1)`)
    expect(await ouvrirSuivi()).toEqual({ ok: true })
    // Le plafond ne borne pas les e-mails : confirmation envoyée avec son lien au-delà du plafond.
    envoi.envoyes.length = 0
    await constater(r.passageId, 104000)
    const mail = envoi.envoyes.find((e) => e.a === COORD.email)
    expect(EXTRAIRE.exec(mail?.texte ?? '')?.[1]).toBeTruthy()
    // Cookie suivi du même passage déjà posé : aucun nouveau jeton même au plafond.
    const avant = (await db.query(`SELECT count(*) FROM "Jeton" WHERE usage = 'suivi'`)).rows[0].count
    jar.lus.suivi = jar.poses[0].valeur
    expect(await ouvrirSuivi()).toEqual({ ok: true })
    expect((await db.query(`SELECT count(*) FROM "Jeton" WHERE usage = 'suivi'`)).rows[0].count).toBe(avant)
  })
})
