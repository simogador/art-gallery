import { createHash } from 'node:crypto'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'
import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '@/lib/i18n'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 6.3 (FR-12, FR-26, UJ-4) : vente assistée. L'admin réserve pour un acheteur (passage en caisse
// puis réservation `vente_assistee`, tout ou rien), le lien part par e-mail (jeton émis à l'envoi,
// seule son empreinte en base), la page /commande le rouvre. Base réelle.

type Envoye = { a: string; sujet: string; texte: string; html: string; cle: string }
const envoi = vi.hoisted(() => ({
  envoyes: [] as { a: string; sujet: string; texte: string; html: string; cle: string }[],
  resultat: { ok: true } as { ok: true } | { ok: false; code: 'refuse' | 'indisponible' | 'non_configure' },
}))
const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as { type: string; userId?: string } }))
const cookie = vi.hoisted(() => ({ valeur: undefined as string | undefined }))

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => acteur.courant }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({
  cookies: () => ({ get: (nom: string) => (nom === 'commande' && cookie.valeur ? { value: cookie.valeur } : undefined) }),
  headers: () => ({ get: () => null }),
}))

const ADMIN = { type: 'admin', userId: 'admin-1' } as never
const AUTRES = [
  { type: 'visiteur' },
  { type: 'user', userId: 'u1' },
  { type: 'artist', userId: 'u2', artiste: null },
] as never[]

const texteDe = (noeud: unknown): string =>
  renderToStaticMarkup(noeud as never)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')

const SAISIE = { email: ' Claire.Martin@Exemple.TEST ', nom: 'Claire Martin', pays: 'FR', oeuvres: ['o1', 'o2'] }

describe('règles pures', () => {
  it('événement au catalogue : l’id du passage seulement ; chemin hors mesure', async () => {
    const { evenementValide } = await import('@/lib/evenements/catalogue')
    expect(evenementValide({ nom: 'VenteAssisteePosee', charge: { passageId: 'p1' } })).toBe(true)
    expect(evenementValide({ nom: 'VenteAssisteePosee', charge: { passageId: 'p1', email: 'a@b.test' } })).toBe(false)
    const { cheminMesurable } = await import('@/lib/mesure/regles')
    expect(cheminMesurable('/commande')).toBe(false)
    expect(cheminMesurable('/commande/abc')).toBe(false)
  })

  it('e-mail : échéance en heure fixe, lien, jamais de compte à rebours', async () => {
    const { contenuVenteAssistee } = await import('@/lib/notifications/contenus')
    const c = contenuVenteAssistee({ nom: 'Claire', lien: 'https://exemple.test/commande/x', echeance: new Date('2026-11-13T10:00:00Z') })
    expect(c.sujet).toBe(fr.courriels.venteAssistee.sujet)
    expect(c.texte).toContain('https://exemple.test/commande/x')
    expect(c.texte).toContain('13 novembre 2026')
    expect(c.html).toContain('href="https://exemple.test/commande/x"')
  })
})

describe('lireIdentifiants', () => {
  it('lignes, virgules, points-virgules, doublons, chemin et URL collés', async () => {
    const { lireIdentifiants } = await import('@/lib/commandes/vente-assistee-regles')
    expect(lireIdentifiants('a\nb, c;a')).toEqual(['a', 'b', 'c'])
    expect(lireIdentifiants('  \n ')).toEqual([])
    expect(lireIdentifiants('/galerie/mon-oeuvre')).toEqual(['mon-oeuvre'])
    expect(lireIdentifiants('https://www.errancy.art/galerie/mon-oeuvre?pays=FR#photos')).toEqual(['mon-oeuvre'])
    expect(lireIdentifiants('/galerie/mon-oeuvre/\nmon-oeuvre, /galerie/autre#x')).toEqual(['mon-oeuvre', 'autre'])
  })

  it('next.config : Referrer-Policy no-referrer pour /commande/:path*', async () => {
    const { default: config } = await import('../next.config.mjs')
    const regle = (await config.headers!()).find((r: { source: string }) => r.source === '/commande/:path*')
    expect(regle?.headers).toContainEqual({ key: 'Referrer-Policy', value: 'no-referrer' })
  })
})

describe('base : vente assistée', () => {
  let base: BaseJetable
  let db: Client
  const compter = async (table: string, where = '') => Number((await db.query(`SELECT count(*) FROM "${table}" ${where}`)).rows[0].count)

  async function oeuvre(slug: string, options: { artiste?: string; dispo?: string; frais?: number | null; prix?: number; devise?: string } = {}) {
    const { artiste = 'art-a', dispo = 'disponible', frais = 4000, prix = 100000, devise = 'EUR' } = options
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", devise,
         publication, disponibilite, "artistId", "updatedAt")
       VALUES ($1, $1, $2, 2024, 'Huile', 'D', 'https://res.cloudinary.com/x/p.jpg', $3, $6, 'publiee', $4::"Disponibilite", $5, now())`,
      [slug, `Titre ${slug}`, prix, dispo, artiste, devise],
    )
    if (frais !== null) {
      await db.query(
        `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", livree, "fraisCentimes", "preparationJours", "transportMinJours", "transportMaxJours", devise, "updatedAt")
         VALUES (gen_random_uuid()::text, $1, 'zone-ue', true, $2, 3, 5, 9, $3, now())`,
        [slug, frais, devise],
      )
    }
  }
  const etat = async (slug: string) => (await db.query(`SELECT disponibilite::text AS d FROM "Artwork" WHERE slug = $1`, [slug])).rows[0].d as string
  const rienEcrit = async () => {
    for (const t of ['PassageEnCaisse', 'CoordonneesAcheteur', 'Commande', 'LigneCommande', 'Reservation', 'Jeton', 'Evenement']) {
      expect(await compter(t), t).toBe(0)
    }
    expect(envoi.envoyes).toHaveLength(0)
  }
  const jetonDuMail = () => /\/commande\/([A-Za-z0-9_-]{43})/.exec(envoi.envoyes[0]?.texte ?? '')?.[1]

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
    envoi.resultat = { ok: true }
    cookie.valeur = undefined
    acteur.courant = { type: 'visiteur' }
    for (const table of ['Jeton', 'Reservation', 'TraitementEvenement', 'Evenement', 'DeclarationDisponibilite', 'LigneCommande', 'Commande', 'CoordonneesAcheteur', 'PassageEnCaisse', 'OffreLivraison', 'ZonePays', 'Zone', 'Artwork', 'Artist']) {
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

  it('durée en heures : bornes de reglages, défaut 48 h', async () => {
    const { heuresValides } = await import('@/lib/commandes')
    const { DUREE_RESERVATION_VENTE_ASSISTEE_HEURES, LIMITES_RESERVATION_VENTE_ASSISTEE_HEURES } = await import('@/lib/reglages')
    expect(DUREE_RESERVATION_VENTE_ASSISTEE_HEURES).toBe(48)
    expect(heuresValides(48)).toBe(48)
    expect(heuresValides(LIMITES_RESERVATION_VENTE_ASSISTEE_HEURES.min)).toBe(1)
    for (const v of [0, -1, 1.5, 100000, '48', null, NaN]) expect(heuresValides(v)).toBeNull()
  })

  it.each([0, 1, 2])('acteur non admin (%#) : acces_refuse, rien écrit, aucun e-mail', async (i) => {
    await oeuvre('o1')
    await oeuvre('o2')
    const { poserVenteAssistee } = await import('@/lib/commandes')
    expect(await poserVenteAssistee(AUTRES[i], SAISIE)).toEqual({ ok: false, code: 'acces_refuse' })
    await rienEcrit()
    expect(await etat('o1')).toBe('disponible')
  })

  it('pose : passage, commandes par artiste, réservations vente_assistee à 48 h, e-mail avec lien, jeton en empreinte seule', async () => {
    await oeuvre('o1', { artiste: 'art-a' })
    await oeuvre('o2', { artiste: 'art-b' })
    const { poserVenteAssistee } = await import('@/lib/commandes')
    const t0 = new Date()
    const r = await poserVenteAssistee(ADMIN, SAISIE, t0)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.envoye).toBe(true)
    expect(r.commandes).toHaveLength(2)
    expect(r.echeance.getTime()).toBe(t0.getTime() + 48 * 3_600_000)

    expect(await compter('PassageEnCaisse')).toBe(1)
    expect(await compter('Commande', `WHERE etat = 'en_attente_paiement'`)).toBe(2)
    const reservations = (await db.query(`SELECT origine::text AS origine, issue, echeance FROM "Reservation" ORDER BY "artworkId"`)).rows
    expect(reservations).toHaveLength(2)
    for (const l of reservations) {
      expect(l.origine).toBe('vente_assistee')
      expect(l.issue).toBeNull()
      expect(new Date(l.echeance).getTime()).toBe(r.echeance.getTime())
    }
    expect(await etat('o1')).toBe('reservee')
    expect(await etat('o2')).toBe('reservee')
    const coord = (await db.query(`SELECT email, nom, adresse FROM "CoordonneesAcheteur"`)).rows[0]
    expect(coord).toEqual({ email: 'claire.martin@exemple.test', nom: 'Claire Martin', adresse: null })

    // L'événement ne porte que l'id du passage.
    const evt = (await db.query(`SELECT charge FROM "Evenement" WHERE nom = 'VenteAssisteePosee'`)).rows
    expect(evt).toEqual([{ charge: { passageId: r.passageId } }])

    // E-mail : un seul, à l'adresse normalisée, avec un lien portant le jeton ; seule l'empreinte est en base.
    expect(envoi.envoyes).toHaveLength(1)
    expect(envoi.envoyes[0].a).toBe('claire.martin@exemple.test')
    const jeton = jetonDuMail()
    expect(jeton).toBeTruthy()
    const jetons = (await db.query(`SELECT empreinte, usage::text AS usage, cible, echeance, "consommeLe", "revoqueLe" FROM "Jeton"`)).rows
    expect(jetons).toHaveLength(1)
    expect(jetons[0].usage).toBe('commande_assistee')
    expect(jetons[0].cible).toBe(r.passageId)
    expect(jetons[0].empreinte).toBe(createHash('sha256').update(jeton!).digest('hex'))
    expect(JSON.stringify(jetons)).not.toContain(jeton!)
    expect(new Date(jetons[0].echeance).getTime()).toBe(r.echeance.getTime())
    expect(jetons[0].revoqueLe).toBeNull()
  })

  it('durée réglable à la pose ; durée hors bornes refusée sans rien écrire', async () => {
    await oeuvre('o1')
    const { poserVenteAssistee } = await import('@/lib/commandes')
    expect(await poserVenteAssistee(ADMIN, { ...SAISIE, oeuvres: ['o1'], heures: 0 })).toEqual({ ok: false, code: 'invalide' })
    await rienEcrit()
    const t0 = new Date()
    const r = await poserVenteAssistee(ADMIN, { ...SAISIE, oeuvres: ['o1'], heures: 72 }, t0)
    expect(r.ok && r.echeance.getTime()).toBe(t0.getTime() + 72 * 3_600_000)
  })

  it.each([
    ['vendue', { dispo: 'vendue' }, { code: 'oeuvre_indisponible', slug: 'o2' }],
    ['déjà réservée', { dispo: 'reservee' }, { code: 'oeuvre_indisponible', slug: 'o2' }],
    ['non livrée', { frais: null }, { code: 'non_livree', slug: 'o2', raison: expect.anything() }],
  ])('une œuvre %s : rien écrit, refus nommant l’œuvre', async (_nom, options, attendu) => {
    await oeuvre('o1')
    await oeuvre('o2', options)
    const { poserVenteAssistee } = await import('@/lib/commandes')
    expect(await poserVenteAssistee(ADMIN, SAISIE)).toMatchObject({ ok: false, ...attendu })
    await rienEcrit()
    expect(await etat('o1')).toBe('disponible')
  })

  it('refus de la réservation après le passage (réservée par un autre passage non échu) : le passage est annulé aussi', async () => {
    await oeuvre('o1')
    await oeuvre('o2')
    const { poserVenteAssistee } = await import('@/lib/commandes')
    expect((await poserVenteAssistee(ADMIN, { ...SAISIE, oeuvres: ['o2'] })).ok).toBe(true)
    envoi.envoyes.length = 0
    const avant = await compter('PassageEnCaisse')
    expect(await poserVenteAssistee(ADMIN, { ...SAISIE, email: 'autre@exemple.test' })).toMatchObject({ ok: false, code: 'oeuvre_indisponible', slug: 'o2' })
    expect(await compter('PassageEnCaisse')).toBe(avant)
    expect(await etat('o1')).toBe('disponible')
    expect(envoi.envoyes).toHaveLength(0)
  })

  it('coordonnées invalides, liste vide : refus typés, rien écrit', async () => {
    await oeuvre('o1')
    const { poserVenteAssistee } = await import('@/lib/commandes')
    const r = await poserVenteAssistee(ADMIN, { ...SAISIE, email: 'nope', nom: ' ', oeuvres: ['o1'] })
    expect(r).toMatchObject({ ok: false, code: 'coordonnees_invalides', erreurs: { email: expect.any(String), nom: expect.any(String) } })
    expect(await poserVenteAssistee(ADMIN, { ...SAISIE, oeuvres: [] })).toEqual({ ok: false, code: 'liste_vide' })
    await rienEcrit()
  })

  it('e-mail non parti : réservation posée, jeton révoqué, envoye faux', async () => {
    await oeuvre('o1')
    envoi.resultat = { ok: false, code: 'refuse' }
    const { poserVenteAssistee, lireLienVenteAssistee } = await import('@/lib/commandes')
    const r = await poserVenteAssistee(ADMIN, { ...SAISIE, oeuvres: ['o1'] })
    expect(r.ok && r.envoye).toBe(false)
    expect(await etat('o1')).toBe('reservee')
    expect(await compter('Reservation', 'WHERE issue IS NULL')).toBe(1)
    expect(await compter('Jeton', 'WHERE "revoqueLe" IS NOT NULL')).toBe(1)
    // Le lien (qui n'est parti nulle part) n'ouvre rien.
    expect(await lireLienVenteAssistee(jetonDuMail()!)).toBeNull()
  })

  it('adaptateur qui lève : traité comme un échec d’envoi', async () => {
    await oeuvre('o1')
    const choix = await import('@/lib/notifications/choix')
    const spy = vi.spyOn(choix, 'envoiActif').mockImplementation(() => ({ envoyer: async () => { throw new Error('panne') } }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { poserVenteAssistee } = await import('@/lib/commandes')
    const r = await poserVenteAssistee(ADMIN, { ...SAISIE, oeuvres: ['o1'] })
    spy.mockRestore()
    expect(r.ok && r.envoye).toBe(false)
    expect(await compter('Jeton', 'WHERE "revoqueLe" IS NOT NULL')).toBe(1)
  })

  it('lien actif : cookie httpOnly, redirection sans jeton, jeton non consommé, récapitulatif des lignes figées', async () => {
    await oeuvre('o1', { artiste: 'art-a', prix: 150000, frais: 4000 })
    await oeuvre('o2', { artiste: 'art-b', prix: 20000, frais: 1500 })
    const { poserVenteAssistee } = await import('@/lib/commandes')
    const r = await poserVenteAssistee(ADMIN, SAISIE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const jeton = jetonDuMail()!

    const { GET } = await import('@/app/commande/[jeton]/route')
    const reponse = await GET(new NextRequest(`https://exemple.test/commande/${jeton}`), { params: { jeton } })
    expect(reponse.status).toBe(303)
    expect(reponse.headers.get('location')).toBe('https://exemple.test/commande')
    expect(reponse.headers.get('location')).not.toContain(jeton)
    expect(reponse.headers.get('referrer-policy')).toBe('no-referrer')
    const pose = reponse.headers.get('set-cookie') ?? ''
    expect(pose).toContain(`commande=${jeton}`)
    expect(pose.toLowerCase()).toContain('httponly')
    expect(pose).toContain('Path=/commande')
    expect(await compter('Jeton', 'WHERE "consommeLe" IS NOT NULL')).toBe(0)

    // Le lien se rouvre ; un changement de prix ensuite n'altère pas le récapitulatif (lignes figées).
    await db.query(`UPDATE "Artwork" SET "prixCentimes" = 999900, slug = 'renomme' WHERE slug = 'o1'`)
    cookie.valeur = jeton
    const page = (await import('@/app/commande/page')).default
    const texte = texteDe(await page())
    expect(texte).toContain(fr.commande.titre)
    expect(texte).toContain('Titre o1')
    expect(texte).toContain('Titre o2')
    expect(texte).toContain('1 500 €')
    expect(texte).toContain('1 540 €')
    expect(texte).not.toContain('9 999')
    expect(texte).toContain(fr.commande.droitsNonInclus)
    expect(texte).toContain(fr.commande.paiement)
    expect(texte).toContain('jusqu’au')
    expect(texte).not.toContain(fr.commande.inactif.titre)
    // Rouvert une seconde fois : toujours valable.
    const encore = await GET(new NextRequest(`https://exemple.test/commande/${jeton}`), { params: { jeton } })
    expect(encore.headers.get('set-cookie') ?? '').toContain(`commande=${jeton}`)
  })

  it('lien inactif : inconnu, mal formé, échu, réservation terminée → « Ce lien n’est plus actif », aucun cookie', async () => {
    await oeuvre('o1')
    const { poserVenteAssistee, lireLienVenteAssistee } = await import('@/lib/commandes')
    const r = await poserVenteAssistee(ADMIN, { ...SAISIE, oeuvres: ['o1'] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const jeton = jetonDuMail()!
    const { GET } = await import('@/app/commande/[jeton]/route')
    const page = (await import('@/app/commande/page')).default

    for (const mauvais of ['x'.repeat(43), 'court', '']) {
      const rep = await GET(new NextRequest(`https://exemple.test/commande/${mauvais || 'vide'}`), { params: { jeton: mauvais } })
      expect(rep.status).toBe(303)
      // Aucun cookie de jeton n'est posé : au plus la suppression d'un éventuel cookie existant.
      expect(rep.headers.get('set-cookie') ?? '').toMatch(/^(commande=;.*)?$/)
      cookie.valeur = mauvais || undefined
      expect(texteDe(await page())).toContain(fr.commande.inactif.titre)
    }

    // Échu : après l'échéance, ni lecture ni page.
    const apres = new Date(r.echeance.getTime() + 1000)
    expect(await lireLienVenteAssistee(jeton, apres)).toBeNull()
    expect(await lireLienVenteAssistee(jeton, new Date(r.echeance.getTime() - 1000))).not.toBeNull()

    // Réservation terminée (libérée) : le lien ne donne plus rien, rien n'est consommé.
    const { libererReservation } = await import('@/lib/disponibilite')
    await libererReservation(r.passageId)
    cookie.valeur = jeton
    expect(texteDe(await page())).toContain(fr.commande.inactif.titre)
    const rep = await GET(new NextRequest(`https://exemple.test/commande/${jeton}`), { params: { jeton } })
    expect(rep.headers.get('set-cookie') ?? '').not.toContain(`commande=${jeton}`)
    expect(await compter('Jeton', 'WHERE "consommeLe" IS NOT NULL')).toBe(0)
  })

  it('même événement rejoué : un seul e-mail', async () => {
    await oeuvre('o1')
    const { poserVenteAssistee } = await import('@/lib/commandes')
    const r = await poserVenteAssistee(ADMIN, { ...SAISIE, oeuvres: ['o1'] })
    expect(r.ok).toBe(true)
    const { repartirApresValidation } = await import('@/lib/evenements')
    const ids = (await db.query(`SELECT id FROM "Evenement" WHERE nom = 'VenteAssisteePosee'`)).rows.map((x) => x.id as string)
    await repartirApresValidation(ids)
    expect(envoi.envoyes).toHaveLength(1)
  })

  it('aucun e-mail ni lien dans les journaux', async () => {
    await oeuvre('o1')
    envoi.resultat = { ok: false, code: 'refuse' }
    const espions = (['log', 'info', 'warn', 'error'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
    const { poserVenteAssistee } = await import('@/lib/commandes')
    await poserVenteAssistee(ADMIN, { ...SAISIE, oeuvres: ['o1'] })
    const sortie = JSON.stringify(espions.flatMap((e) => e.mock.calls))
    for (const e of espions) e.mockRestore()
    expect(sortie).not.toContain('exemple.test')
    expect(sortie).not.toContain('/commande/')
  })

  it('route : jeton inconnu, le cookie d’une autre commande valable reste ; le cookie portant ce jeton est effacé', async () => {
    const { GET } = await import('@/app/commande/[jeton]/route')
    const inconnu = 'y'.repeat(43)
    const autre = new NextRequest(`https://exemple.test/commande/${inconnu}`, { headers: { cookie: `commande=${'z'.repeat(43)}` } })
    expect((await GET(autre, { params: { jeton: inconnu } })).headers.get('set-cookie')).toBeNull()
    const meme = new NextRequest(`https://exemple.test/commande/${inconnu}`, { headers: { cookie: `commande=${inconnu}` } })
    expect((await GET(meme, { params: { jeton: inconnu } })).headers.get('set-cookie') ?? '').toMatch(/^commande=;/)
  })

  it('route : panne de la base, aucun cookie touché ; page : message de panne, pas « lien inactif »', async () => {
    const commandes = await import('@/lib/commandes')
    const lire = vi.spyOn(commandes, 'lireLienVenteAssistee').mockRejectedValue(new Error('panne'))
    const recap = vi.spyOn(commandes, 'lireRecapitulatifAssiste').mockRejectedValue(new Error('panne'))
    const { GET } = await import('@/app/commande/[jeton]/route')
    const jeton = 'y'.repeat(43)
    const rep = await GET(new NextRequest(`https://exemple.test/commande/${jeton}`, { headers: { cookie: `commande=${jeton}` } }), { params: { jeton } })
    expect(rep.status).toBe(303)
    expect(rep.headers.get('set-cookie')).toBeNull()
    cookie.valeur = jeton
    const texte = texteDe(await (await import('@/app/commande/page')).default())
    lire.mockRestore()
    recap.mockRestore()
    expect(texte).toContain(fr.commande.panne)
    expect(texte).not.toContain(fr.commande.inactif.titre)
  })

  describe('actionPoserVenteAssistee', () => {
    const saisie = { email: 'claire@exemple.test', nom: 'Claire', pays: 'FR', oeuvres: 'o1', heures: '' }
    const action = async () => (await import('@/app/dashboard/admin/commandes/actions')).actionPoserVenteAssistee

    it('heures vides : 48 h ; liste « a\nb, c;a » séparée et dédoublonnée', async () => {
      acteur.courant = { type: 'admin', userId: 'admin-1' }
      for (const s of ['a', 'b', 'c']) await oeuvre(s)
      const t0 = Date.now()
      const r = await (await action())({ ...saisie, oeuvres: 'a\nb, c;a' })
      expect(r.ok).toBe(true)
      expect(await compter('Reservation')).toBe(3)
      const echeance = new Date((await db.query(`SELECT echeance FROM "Reservation" LIMIT 1`)).rows[0].echeance).getTime()
      expect(Math.abs(echeance - (t0 + 48 * 3_600_000))).toBeLessThan(60_000)
    })

    it.each(['abc', '0'])('heures « %s » : refus invalide, rien écrit', async (heures) => {
      acteur.courant = { type: 'admin', userId: 'admin-1' }
      await oeuvre('o1')
      expect(await (await action())({ ...saisie, heures })).toEqual({ ok: false, message: fr.venteAssistee.refus.invalide })
      await rienEcrit()
    })

    it('devises différentes : texte monnaies_differentes', async () => {
      acteur.courant = { type: 'admin', userId: 'admin-1' }
      await oeuvre('o1')
      await oeuvre('o2', { devise: 'USD' })
      expect(await (await action())({ ...saisie, oeuvres: 'o1 o2' })).toEqual({ ok: false, message: fr.venteAssistee.refus.monnaies_differentes })
      await rienEcrit()
    })

    it('acteur non admin : acces_refuse, rien écrit', async () => {
      acteur.courant = { type: 'user', userId: 'u1' }
      await oeuvre('o1')
      expect(await (await action())(saisie)).toEqual({ ok: false, message: fr.venteAssistee.refus.acces_refuse })
      await rienEcrit()
    })
  })
})
