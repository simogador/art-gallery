import { createHash } from 'node:crypto'
import { renderToStaticMarkup } from 'react-dom/server'
import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '@/lib/i18n'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 7.3 (FR-10, FR-12, UX-DR37) : coordonnées sans compte et réservation affichée en heure fixe.
// Le passage et la réservation de 30 minutes se créent en une transaction (tout ou rien), le navigateur
// est rattaché à son passage par un jeton `commande_publique` (empreinte seule en base), l'échéance se
// retente, un passage posé par l'équipe est repris sans nouvelle réservation. Base réelle.

type Envoye = { a: string; sujet: string; texte: string; html: string; cle: string }
const envoi = vi.hoisted(() => ({ envoyes: [] as { a: string; sujet: string; texte: string; html: string; cle: string }[] }))
const jar = vi.hoisted(() => ({ lus: {} as Record<string, string | undefined>, poses: [] as { nom: string; valeur: string; options: Record<string, unknown> }[] }))

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => ({ type: 'visiteur' }) }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }), usePathname: () => '/commande/coordonnees' }))
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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (nom: string) => (jar.lus[nom] ? { value: jar.lus[nom] } : undefined),
    set: (nom: string, valeur: string, options: Record<string, unknown>) => {
      jar.poses.push({ nom, valeur, options })
      jar.lus[nom] = valeur
    },
  }),
  headers: () => ({ get: () => null }),
}))

const ADMIN = { type: 'admin', userId: 'admin-1' } as never
const COORD = { email: ' Claire.Martin@Exemple.TEST ', nom: 'Claire  Martin', adresse: '12 rue des Lilas\n75011 Paris', telephone: '+33 6 12 34 56 78' }
const MIN = 60_000

const texteDe = (noeud: unknown): string =>
  renderToStaticMarkup(noeud as never)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')

describe('règles pures', () => {
  it('adresse obligatoire sur demande seulement ; téléphone facultatif', async () => {
    const { validerCoordonnees, erreurChampCoordonnees, lireEntreeCoordonnees } = await import('@/lib/commandes/coordonnees-regles')
    const base = { email: 'a@b.test', nom: 'A', adresse: '', telephone: '' }
    expect(validerCoordonnees(base).ok).toBe(true)
    const r = validerCoordonnees(base, { adresseObligatoire: true })
    expect(r).toEqual({ ok: false, erreurs: { adresse: fr.commandes.erreurs.adresseManquante } })
    expect(erreurChampCoordonnees('adresse', lireEntreeCoordonnees({ ...base, adresse: '   ' }), { adresseObligatoire: true })).toBe(fr.commandes.erreurs.adresseManquante)
    expect(validerCoordonnees({ ...base, adresse: '1 rue X' }, { adresseObligatoire: true }).ok).toBe(true)
  })

  it('phrases de la réservation : heure fixe, sans compte à rebours', () => {
    expect(fr.coordonnees.reservee('15 h 42')).toBe('Œuvres réservées pour vous jusqu’à 15 h 42.')
    expect(fr.coordonnees.terminee('15 h 42')).toBe('Votre réservation a pris fin à 15 h 42.')
    expect(fr.coordonnees.sansCompte).toBe('Pas besoin de créer un compte : vous suivrez vos commandes grâce au lien envoyé par e-mail.')
  })
})

describe('base : coordonnées et réservation publique', () => {
  let base: BaseJetable
  let db: Client
  const compter = async (table: string, where = '') => Number((await db.query(`SELECT count(*) FROM "${table}" ${where}`)).rows[0].count)

  async function oeuvre(slug: string, options: { artiste?: string; dispo?: string; frais?: number | null } = {}) {
    const { artiste = 'art-a', dispo = 'disponible', frais = 4000 } = options
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", devise,
         publication, disponibilite, "artistId", "updatedAt")
       VALUES ($1, $1, $2, 2024, 'Huile', 'D', 'https://res.cloudinary.com/x/p.jpg', 100000, 'EUR', 'publiee', $3::"Disponibilite", $4, now())`,
      [slug, `Titre ${slug}`, dispo, artiste],
    )
    if (frais !== null) {
      await db.query(
        `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", livree, "fraisCentimes", "preparationJours", "transportMinJours", "transportMaxJours", devise, "updatedAt")
         VALUES (gen_random_uuid()::text, $1, 'zone-ue', true, $2, 3, 5, 9, 'EUR', now())`,
        [slug, frais],
      )
    }
  }
  const etat = async (slug: string) => (await db.query(`SELECT disponibilite::text AS d FROM "Artwork" WHERE slug = $1`, [slug])).rows[0].d as string
  const rienEcrit = async () => {
    for (const t of ['PassageEnCaisse', 'CoordonneesAcheteur', 'Commande', 'LigneCommande', 'Reservation', 'Jeton']) {
      expect(await compter(t), t).toBe(0)
    }
  }
  const saisie = (oeuvres: string[], extra: Record<string, unknown> = {}) => ({ coordonnees: COORD, pays: 'FR', oeuvres, ...extra })
  const poser = async (oeuvres: string[], extra: Record<string, unknown> = {}, maintenant?: Date) => {
    const { poserPassagePublic } = await import('@/lib/commandes')
    return poserPassagePublic(saisie(oeuvres, extra) as never, maintenant)
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
    envoi.envoyes.length = 0
    jar.lus = {}
    jar.poses.length = 0
    for (const table of ['TentativeInscription', 'Jeton', 'Reservation', 'TraitementEvenement', 'Evenement', 'DeclarationDisponibilite', 'LigneCommande', 'Commande', 'CoordonneesAcheteur', 'PassageEnCaisse', 'OffreLivraison', 'ZonePays', 'Zone', 'Artwork', 'Artist']) {
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

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('Lot 2 fermé (AD-17)', () => {
    it.each(['', 'non', 'OUI-peut-etre'])('LOT2_OUVERT=%j : refus « ferme », rien créé, aucun cookie', async (valeur) => {
      vi.stubEnv('LOT2_OUVERT', valeur)
      await oeuvre('o1')
      expect(await poser(['o1'])).toEqual({ ok: false, code: 'ferme' })
      const { envoyerCoordonnees, reprendreReservation } = await import('@/app/commande/coordonnees/actions')
      expect(await envoyerCoordonnees(['o1'], COORD)).toEqual({ ok: false, code: 'ferme' })
      expect(await reprendreReservation()).toEqual({ ok: false, code: 'ferme' })
      await rienEcrit()
      expect(jar.poses).toHaveLength(0)
      expect(await etat('o1')).toBe('disponible')
    })

    it('page : message d’ouverture prochaine, lien vers le panier, aucun formulaire', async () => {
      vi.stubEnv('LOT2_OUVERT', '')
      const page = (await import('@/app/commande/coordonnees/page')).default
      const html = renderToStaticMarkup((await page()) as never)
      const texte = texteDe(await page())
      expect(texte).toContain(fr.coordonnees.ferme.titre)
      expect(texte).toContain(fr.coordonnees.ferme.texte)
      expect(html).toContain('href="/panier"')
      expect(html).not.toContain('<form')
      expect(html).not.toContain('<input')
    })
  })

  describe('création du passage et réservation', () => {
    it('envoi valide : passage, une commande par artiste, réservations « paiement » de 30 min, œuvres réservées, jeton en empreinte', async () => {
      await oeuvre('o1', { artiste: 'art-a' })
      await oeuvre('o2', { artiste: 'art-b' })
      const t0 = new Date()
      const r = await poser(['o1', 'o2'], {}, t0)
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.reprise).toBe(false)
      expect(r.commandes).toHaveLength(2)
      expect(r.echeance.getTime()).toBe(t0.getTime() + 30 * MIN)

      expect(await compter('PassageEnCaisse')).toBe(1)
      expect(await compter('Commande', `WHERE etat = 'en_attente_paiement'`)).toBe(2)
      const reservations = (await db.query(`SELECT origine::text AS origine, issue, echeance FROM "Reservation"`)).rows
      expect(reservations).toHaveLength(2)
      for (const l of reservations) {
        expect(l.origine).toBe('paiement')
        expect(l.issue).toBeNull()
        expect(new Date(l.echeance).getTime()).toBe(r.echeance.getTime())
      }
      expect(await etat('o1')).toBe('reservee')
      expect(await etat('o2')).toBe('reservee')
      // Coordonnées normalisées, adresse conservée, jamais dans User.
      const c = (await db.query(`SELECT email, nom, adresse, telephone FROM "CoordonneesAcheteur"`)).rows[0]
      expect(c).toEqual({ email: 'claire.martin@exemple.test', nom: 'Claire Martin', adresse: '12 rue des Lilas\n75011 Paris', telephone: '+33 6 12 34 56 78' })
      expect(await compter('User')).toBe(0)
      // Jeton : seule l'empreinte, usage commande_publique, cible = passage, échéance = celle de la réservation.
      expect(r.jeton).toMatch(/^[A-Za-z0-9_-]{43}$/)
      const jetons = (await db.query(`SELECT empreinte, usage::text AS usage, cible, echeance, "revoqueLe" FROM "Jeton"`)).rows
      expect(jetons).toHaveLength(1)
      expect(jetons[0]).toMatchObject({ usage: 'commande_publique', cible: r.passageId, revoqueLe: null })
      expect(jetons[0].empreinte).toBe(createHash('sha256').update(r.jeton!).digest('hex'))
      expect(new Date(jetons[0].echeance).getTime()).toBe(r.echeance.getTime())
      expect(JSON.stringify(jetons)).not.toContain(r.jeton!)
      // Montants relus en base : prix + frais figés ; aucun e-mail n'est envoyé.
      const ligne = (await db.query(`SELECT "prixCentimes", "fraisCentimes", "totalCentimes" FROM "LigneCommande" WHERE slug = 'o1'`)).rows[0]
      expect(ligne).toEqual({ prixCentimes: 100000, fraisCentimes: 4000, totalCentimes: 104000 })
      expect(envoi.envoyes).toHaveLength(0)
    })

    it('coordonnées invalides (e-mail, nom, adresse vide) : erreurs par champ, saisie refusée, rien écrit', async () => {
      await oeuvre('o1')
      const r = await poser(['o1'], { coordonnees: { email: 'nope', nom: ' ', adresse: '  ', telephone: 'abc' } })
      expect(r).toMatchObject({
        ok: false,
        code: 'coordonnees_invalides',
        erreurs: { email: expect.any(String), nom: expect.any(String), adresse: fr.commandes.erreurs.adresseManquante, telephone: expect.any(String) },
      })
      await rienEcrit()
      expect(await etat('o1')).toBe('disponible')
    })

    it('téléphone facultatif ; liste vide refusée', async () => {
      await oeuvre('o1')
      const r = await poser(['o1'], { coordonnees: { ...COORD, telephone: '' } })
      expect(r.ok).toBe(true)
      expect((await db.query(`SELECT telephone FROM "CoordonneesAcheteur"`)).rows[0].telephone).toBeNull()
      expect(await poser([])).toEqual({ ok: false, code: 'liste_vide' })
    })

    it.each([
      ['vendue', { dispo: 'vendue' }, { code: 'oeuvre_indisponible', slug: 'o2' }],
      ['réservée par un autre', { dispo: 'reservee' }, { code: 'oeuvre_indisponible', slug: 'o2' }],
      ['retirée', { dispo: 'retiree' }, { code: 'oeuvre_indisponible', slug: 'o2' }],
      ['non livrée', { frais: null }, { code: 'non_livree', slug: 'o2' }],
    ])('une œuvre %s : rien créé ni réservé, œuvre nommée', async (_nom, options, attendu) => {
      await oeuvre('o1')
      await oeuvre('o2', options)
      expect(await poser(['o1', 'o2'])).toMatchObject({ ok: false, ...attendu })
      await rienEcrit()
      expect(await etat('o1')).toBe('disponible')
    })

    it('réservée par un autre passage non échu (course) : tout annulé, l’autre réservation intacte', async () => {
      await oeuvre('o1')
      await oeuvre('o2')
      expect((await poser(['o2'], { coordonnees: { ...COORD, email: 'autre@exemple.test' } })).ok).toBe(true)
      expect(await poser(['o1', 'o2'])).toMatchObject({ ok: false, code: 'oeuvre_indisponible', slug: 'o2' })
      expect(await compter('PassageEnCaisse')).toBe(1)
      expect(await compter('Reservation')).toBe(1)
      expect(await etat('o1')).toBe('disponible')
    })

    it('plafond par e-mail (3) : la quatrième œuvre est refusée sans détail technique, rien réservé de plus', async () => {
      for (const s of ['o1', 'o2', 'o3', 'o4']) await oeuvre(s)
      expect((await poser(['o1', 'o2', 'o3'])).ok).toBe(true)
      // Autre navigateur (sans cookie), même e-mail.
      expect(await poser(['o4'])).toEqual({ ok: false, code: 'plafond_atteint' })
      expect(await compter('PassageEnCaisse')).toBe(1)
      expect(await compter('Reservation')).toBe(3)
      expect(await etat('o4')).toBe('disponible')
      const { envoyerCoordonnees } = await import('@/app/commande/coordonnees/actions')
      expect(await envoyerCoordonnees(['o4'], COORD)).toEqual({ ok: false, code: 'plafond_atteint' })
    })

    it('double appel : avec le cookie, le passage réservé est repris (un seul passage) ; en simultané, un seul réussit', async () => {
      await oeuvre('o1')
      const premier = await poser(['o1'])
      expect(premier.ok && premier.jeton).toBeTruthy()
      if (!premier.ok) return
      const second = await poser(['o1'], { jeton: premier.jeton })
      expect(second).toMatchObject({ ok: true, reprise: true, passageId: premier.passageId })
      expect(second.ok && second.jeton).toBeUndefined()
      expect(await compter('PassageEnCaisse')).toBe(1)
      expect(await compter('Reservation')).toBe(1)

      await db.query(`DELETE FROM "Jeton"; DELETE FROM "Reservation"; DELETE FROM "LigneCommande"; DELETE FROM "Commande"; DELETE FROM "CoordonneesAcheteur"; DELETE FROM "PassageEnCaisse"; UPDATE "Artwork" SET disponibilite = 'disponible'`)
      const [a, b] = await Promise.all([poser(['o1']), poser(['o1'])])
      expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
      expect(await compter('PassageEnCaisse')).toBe(1)
      expect(await compter('Reservation', 'WHERE issue IS NULL')).toBe(1)
    })

    it('action : cookie httpOnly du passage posé une fois, pays lu dans le cookie, double appel sans second passage', async () => {
      await oeuvre('o1')
      jar.lus.pays = 'FR'
      const { envoyerCoordonnees } = await import('@/app/commande/coordonnees/actions')
      expect(await envoyerCoordonnees(['o1', 42, 'o1'], COORD)).toEqual({ ok: true })
      expect(jar.poses).toHaveLength(1)
      const { nom, valeur, options } = jar.poses[0]
      expect(nom).toBe('passage')
      expect(valeur).toMatch(/^[A-Za-z0-9_-]{43}$/)
      expect(options).toMatchObject({ httpOnly: true, path: '/commande', sameSite: 'lax' })
      expect((options.expires as Date).getTime()).toBeGreaterThan(Date.now() + 29 * MIN)
      expect(await envoyerCoordonnees(['o1'], COORD)).toEqual({ ok: true })
      expect(jar.poses).toHaveLength(1)
      expect(await compter('PassageEnCaisse')).toBe(1)
      expect(await envoyerCoordonnees(['o1'], { ...COORD, adresse: '' })).toMatchObject({ ok: false, code: 'invalide' })
    })

    it('action : refus nommant l’œuvre, sans détail technique', async () => {
      await oeuvre('o1', { dispo: 'vendue' })
      const { envoyerCoordonnees } = await import('@/app/commande/coordonnees/actions')
      expect(await envoyerCoordonnees(['o1'], COORD)).toEqual({ ok: false, code: 'oeuvre_indisponible', slug: 'o1' })
      expect(await envoyerCoordonnees(['inconnue'], COORD)).toEqual({ ok: false, code: 'oeuvre_indisponible', slug: 'inconnue' })
      expect(jar.poses).toHaveLength(0)
    })

    it('aucun e-mail ni adresse dans les journaux', async () => {
      await oeuvre('o1')
      const journal: string[] = []
      for (const n of ['log', 'info', 'warn', 'error'] as const) vi.spyOn(console, n).mockImplementation((...a: unknown[]) => void journal.push(JSON.stringify(a)))
      const { envoyerCoordonnees } = await import('@/app/commande/coordonnees/actions')
      await envoyerCoordonnees(['o1'], COORD)
      await envoyerCoordonnees(['o1'], { ...COORD, email: 'x' })
      const tout = journal.join('\n')
      expect(tout).not.toContain('exemple.test')
      expect(tout).not.toContain('rue des Lilas')
    })
  })

  describe('jeton et lecture du passage', () => {
    it('lirePassagePublic : lignes figées, échéance, jamais de recalcul ; jeton inconnu, mal formé ou révoqué : null', async () => {
      await oeuvre('o1')
      const t0 = new Date()
      const r = await poser(['o1'], {}, t0)
      if (!r.ok) throw new Error('attendu')
      const { lirePassagePublic, oublierPassagePublic } = await import('@/lib/commandes')
      await db.query(`UPDATE "Artwork" SET "prixCentimes" = 999900 WHERE slug = 'o1'`)
      const lu = await lirePassagePublic(r.jeton, t0)
      expect(lu).toMatchObject({ passageId: r.passageId, pays: 'FR', echue: false, adresseRenseignee: true })
      expect(lu?.echeance.getTime()).toBe(t0.getTime() + 30 * MIN)
      expect(lu?.commandes[0].lignes[0]).toMatchObject({ slug: 'o1', prixCentimes: 100000, totalCentimes: 104000 })
      expect(await lirePassagePublic(undefined)).toBeNull()
      expect(await lirePassagePublic('court')).toBeNull()
      expect(await lirePassagePublic('A'.repeat(43))).toBeNull()
      await oublierPassagePublic(r.passageId)
      expect(await lirePassagePublic(r.jeton, t0)).toBeNull()
    })

    it('un jeton d’un autre usage ne rouvre pas le passage', async () => {
      await oeuvre('o1')
      const r = await poser(['o1'])
      if (!r.ok) throw new Error('attendu')
      await db.query(`UPDATE "Jeton" SET usage = 'commande_assistee'`)
      const { lirePassagePublic } = await import('@/lib/commandes')
      expect(await lirePassagePublic(r.jeton)).toBeNull()
    })

    it('jeton consommé ou trop ancien (échu depuis plus de la durée d’abandon) : null', async () => {
      await oeuvre('o1')
      const t0 = new Date()
      const r = await poser(['o1'], {}, t0)
      if (!r.ok) throw new Error('attendu')
      const { lirePassagePublic } = await import('@/lib/commandes')
      expect(await lirePassagePublic(r.jeton, new Date(t0.getTime() + 6 * 24 * 3_600_000))).not.toBeNull()
      expect(await lirePassagePublic(r.jeton, new Date(t0.getTime() + 8 * 24 * 3_600_000))).toBeNull()
      await db.query(`UPDATE "Jeton" SET "consommeLe" = now()`)
      expect(await lirePassagePublic(r.jeton, t0)).toBeNull()
    })
  })

  describe('échéance et retentative', () => {
    /* ── corrections de relecture : voir aussi les blocs suivants ── */
    it('après l’échéance : « échue », puis « Continuer » retente le même passage (30 min de plus, nouveau jeton)', async () => {
      await oeuvre('o1')
      await oeuvre('o2', { artiste: 'art-b' })
      const t0 = new Date()
      const r = await poser(['o1', 'o2'], {}, t0)
      if (!r.ok) throw new Error('attendu')
      const { lirePassagePublic, reprendrePassagePublic } = await import('@/lib/commandes')
      const apres = new Date(t0.getTime() + 31 * MIN)
      const echu = await lirePassagePublic(r.jeton, apres)
      expect(echu?.echue).toBe(true)
      expect(echu?.echeance.getTime()).toBe(t0.getTime() + 30 * MIN)

      const reprise = await reprendrePassagePublic(r.jeton, apres)
      expect(reprise).toMatchObject({ ok: true, reprise: false })
      if (!reprise.ok) return
      expect(reprise.echeance.getTime()).toBe(apres.getTime() + 30 * MIN)
      // Même passage, mêmes commandes : rien de nouveau, sauf les réservations.
      expect(await compter('PassageEnCaisse')).toBe(1)
      expect(await compter('Commande')).toBe(2)
      expect(await compter('Reservation', `WHERE issue = 'expiree'`)).toBe(2)
      expect(await compter('Reservation', 'WHERE issue IS NULL')).toBe(2)
      expect(await etat('o1')).toBe('reservee')
      // Ancien jeton révoqué, nouveau jeton à la nouvelle échéance.
      expect(await lirePassagePublic(r.jeton, apres)).toBeNull()
      const neuf = await lirePassagePublic(reprise.jeton, apres)
      expect(neuf).toMatchObject({ passageId: r.passageId, echue: false })
      expect(neuf?.echeance.getTime()).toBe(apres.getTime() + 30 * MIN)
      expect(await compter('Jeton', 'WHERE "revoqueLe" IS NULL')).toBe(1)
    })

    it('réservation déjà libérée par le balayage : retentée de même', async () => {
      await oeuvre('o1')
      const t0 = new Date()
      const r = await poser(['o1'], {}, t0)
      if (!r.ok) throw new Error('attendu')
      const { libererReservationsEchues } = await import('@/lib/disponibilite')
      await libererReservationsEchues(new Date(t0.getTime() + 31 * MIN))
      expect(await etat('o1')).toBe('disponible')
      const { lirePassagePublic, reprendrePassagePublic } = await import('@/lib/commandes')
      const apres = new Date(t0.getTime() + 32 * MIN)
      expect((await lirePassagePublic(r.jeton, apres))?.echue).toBe(true)
      expect(await reprendrePassagePublic(r.jeton, apres)).toMatchObject({ ok: true })
      expect(await etat('o1')).toBe('reservee')
      expect(await compter('PassageEnCaisse')).toBe(1)
    })

    it('œuvre prise entre-temps : rien n’est réservé, l’œuvre est nommée, l’état est inchangé', async () => {
      await oeuvre('o1')
      await oeuvre('o2')
      const t0 = new Date(Date.now() - 40 * MIN)
      const r = await poser(['o1', 'o2'], {}, t0)
      if (!r.ok) throw new Error('attendu')
      const apres = new Date(t0.getTime() + 31 * MIN)
      // Un autre acheteur prend o2 après l'échéance.
      expect((await poser(['o2'], { coordonnees: { ...COORD, email: 'autre@exemple.test' } }, apres)).ok).toBe(true)
      const avant = await compter('Reservation')
      const { reprendrePassagePublic } = await import('@/lib/commandes')
      expect(await reprendrePassagePublic(r.jeton, new Date(apres.getTime() + MIN))).toEqual({ ok: false, code: 'oeuvre_indisponible', slug: 'o2' })
      expect(await compter('Reservation')).toBe(avant)
      // Rien n'a bougé : la réservation échue de o1 n'est pas libérée (tout ou rien), le jeton reste le même.
      expect(await compter('Reservation', `WHERE issue = 'expiree'`)).toBe(1)
      expect(await etat('o1')).toBe('reservee')
      expect(await compter('Jeton', `WHERE "revoqueLe" IS NULL AND cible = '${r.passageId}'`)).toBe(1)
      // L'action le dit sans détail technique.
      jar.lus.passage = r.jeton
      const { reprendreReservation } = await import('@/app/commande/coordonnees/actions')
      expect(await reprendreReservation()).toEqual({ ok: false, code: 'oeuvre_indisponible', slug: 'o2' })
    })

    it('réservation encore active : « Continuer » est un double appui, rien de plus', async () => {
      await oeuvre('o1')
      const t0 = new Date()
      const r = await poser(['o1'], {}, t0)
      if (!r.ok) throw new Error('attendu')
      const { reprendrePassagePublic } = await import('@/lib/commandes')
      expect(await reprendrePassagePublic(r.jeton, new Date(t0.getTime() + 5 * MIN))).toMatchObject({ ok: true, reprise: true })
      expect(await compter('Reservation')).toBe(1)
      expect(await compter('Jeton')).toBe(1)
    })

    it('jeton inconnu : invalide ; commande annulée entre-temps : invalide, rien réservé', async () => {
      await oeuvre('o1')
      const { reprendrePassagePublic } = await import('@/lib/commandes')
      expect(await reprendrePassagePublic('A'.repeat(43))).toEqual({ ok: false, code: 'invalide' })
      const t0 = new Date()
      const r = await poser(['o1'], {}, t0)
      if (!r.ok) throw new Error('attendu')
      await db.query(`UPDATE "Commande" SET etat = 'annulee'`)
      expect(await reprendrePassagePublic(r.jeton, new Date(t0.getTime() + 31 * MIN))).toEqual({ ok: false, code: 'invalide' })
      expect(await compter('Reservation')).toBe(1)
      expect(await compter('Jeton', 'WHERE "revoqueLe" IS NULL')).toBe(1)
    })

    it('Lot 2 refermé avant la retentative : « ferme »', async () => {
      await oeuvre('o1')
      const t0 = new Date()
      const r = await poser(['o1'], {}, t0)
      if (!r.ok) throw new Error('attendu')
      vi.stubEnv('LOT2_OUVERT', 'non')
      const { reprendrePassagePublic } = await import('@/lib/commandes')
      expect(await reprendrePassagePublic(r.jeton, new Date(t0.getTime() + 31 * MIN))).toEqual({ ok: false, code: 'ferme' })
    })
  })

  describe('passage posé par l’équipe (décision 3A)', () => {
    const jetonDuMail = () => /\/commande\/([A-Za-z0-9_-]{43})/.exec(envoi.envoyes[0]?.texte ?? '')?.[1]
    async function poserAssistee() {
      const { poserVenteAssistee } = await import('@/lib/commandes')
      const r = await poserVenteAssistee(ADMIN, { email: 'claire@exemple.test', nom: 'Claire Martin', pays: 'FR', oeuvres: ['o1', 'o2'] })
      if (!r.ok) throw new Error('attendu')
      return { ...r, jeton: jetonDuMail()! }
    }

    it('complète adresse et téléphone seulement, sans nouvelle réservation ni nouveau passage, sans dépendre du Lot 2', async () => {
      vi.stubEnv('LOT2_OUVERT', '')
      await oeuvre('o1')
      await oeuvre('o2', { artiste: 'art-b' })
      const r = await poserAssistee()
      const avant = (await db.query(`SELECT id, echeance FROM "Reservation" ORDER BY id`)).rows
      const { completerCoordonneesDuLien } = await import('@/lib/commandes')
      expect(await completerCoordonneesDuLien(r.jeton, { email: 'pirate@x.test', nom: 'Autre', adresse: '3 quai du Port\n13002 Marseille', telephone: '' })).toEqual({ ok: true })
      const c = (await db.query(`SELECT email, nom, adresse, telephone FROM "CoordonneesAcheteur"`)).rows
      expect(c).toEqual([{ email: 'claire@exemple.test', nom: 'Claire Martin', adresse: '3 quai du Port\n13002 Marseille', telephone: null }])
      expect((await db.query(`SELECT id, echeance FROM "Reservation" ORDER BY id`)).rows).toEqual(avant)
      expect(await compter('PassageEnCaisse')).toBe(1)
      expect(await compter('Jeton', `WHERE usage = 'commande_publique'`)).toBe(0)
      expect(await etat('o1')).toBe('reservee')
    })

    it('adresse vide ou trop longue, téléphone invalide : erreurs, rien modifié ; lien invalide ou absent : introuvable', async () => {
      await oeuvre('o1')
      await oeuvre('o2', { artiste: 'art-b' })
      const r = await poserAssistee()
      const { completerCoordonneesDuLien } = await import('@/lib/commandes')
      expect(await completerCoordonneesDuLien(r.jeton, { adresse: ' ', telephone: 'abc' })).toEqual({
        ok: false,
        code: 'coordonnees_invalides',
        erreurs: { adresse: fr.commandes.erreurs.adresseManquante, telephone: fr.commandes.erreurs.telephoneInvalide },
      })
      expect((await db.query(`SELECT adresse FROM "CoordonneesAcheteur"`)).rows[0].adresse).toBeNull()
      expect(await completerCoordonneesDuLien('A'.repeat(43), { adresse: 'x' })).toEqual({ ok: false, code: 'introuvable' })
      expect(await completerCoordonneesDuLien(undefined, { adresse: 'x' })).toEqual({ ok: false, code: 'introuvable' })
      // Lien échu : plus rien à compléter par ce biais.
      expect(await completerCoordonneesDuLien(r.jeton, { adresse: 'x' }, new Date(r.echeance.getTime() + 1000))).toEqual({ ok: false, code: 'introuvable' })
    })

    it('action et page : cookie « commande », formulaire adresse et téléphone seulement, puis coordonnées enregistrées', async () => {
      vi.stubEnv('LOT2_OUVERT', '')
      await oeuvre('o1')
      await oeuvre('o2', { artiste: 'art-b' })
      const r = await poserAssistee()
      jar.lus.commande = r.jeton
      const page = (await import('@/app/commande/coordonnees/page')).default
      const avant = renderToStaticMarkup((await page()) as never)
      expect(avant).toContain('id="coordonnees-adresse"')
      expect(avant).toContain('id="coordonnees-telephone"')
      expect(avant).not.toContain('id="coordonnees-email"')
      expect(avant).not.toContain('id="coordonnees-nom"')
      expect(avant).toMatch(/autocomplete="street-address"/i)
      const texteAvant = texteDe(await page())
      expect(texteAvant).toContain('Titre o1')
      expect(texteAvant).toContain('Titre o2')
      expect(texteAvant).toContain(fr.livraison.droitsNonInclus)

      const { completerCoordonnees } = await import('@/app/commande/coordonnees/actions')
      expect(await completerCoordonnees({ adresse: '' })).toMatchObject({ ok: false, code: 'invalide' })
      expect(await completerCoordonnees({ adresse: '3 quai du Port', telephone: '' })).toEqual({ ok: true })
      const apres = texteDe(await page())
      expect(apres).toContain(fr.coordonnees.enregistrees)
      expect(renderToStaticMarkup((await page()) as never)).not.toContain('<form')
      // La page de la commande propose le lien tant que l'adresse manque.
      const commande = (await import('@/app/commande/page')).default
      expect(renderToStaticMarkup((await commande()) as never)).not.toContain('href="/commande/coordonnees"')
    })

    it('/commande : lien vers les coordonnées tant que l’adresse manque', async () => {
      await oeuvre('o1')
      await oeuvre('o2', { artiste: 'art-b' })
      const r = await poserAssistee()
      jar.lus.commande = r.jeton
      const commande = (await import('@/app/commande/page')).default
      const html = renderToStaticMarkup((await commande()) as never)
      expect(html).toContain('href="/commande/coordonnees"')
      expect(texteDe(await commande())).toContain(fr.commande.coordonnees)
    })
  })

  describe('page du passage de l’acheteur', () => {
    it('Lot 2 ouvert sans passage : le panier et le formulaire (côté client) ; avec passage : lignes figées et prochaine étape', async () => {
      await oeuvre('o1')
      const page = (await import('@/app/commande/coordonnees/page')).default
      expect(texteDe(await page())).toContain(fr.coordonnees.chargement)
      const r = await poser(['o1'])
      if (!r.ok) throw new Error('attendu')
      jar.lus.passage = r.jeton
      const texte = texteDe(await page())
      expect(texte).toContain('Titre o1')
      expect(texte).toContain('1 040 €')
      expect(texte).toContain(fr.coordonnees.continuerPaiement)
      expect(renderToStaticMarkup((await page()) as never)).toContain('href="/commande/paiement"')
      expect(texte).not.toContain('ouvrira prochainement')
      expect(texte).toContain(fr.coordonnees.enregistrees)
      expect(renderToStaticMarkup((await page()) as never)).not.toContain('<form')
      // Cookie d'un jeton révoqué : retour au panier.
      await db.query(`UPDATE "Jeton" SET "revoqueLe" = now()`)
      expect(texteDe(await page())).toContain(fr.coordonnees.chargement)
    })

    it('réservation échue : la page lit « échue » et propose « Continuer » (rendu client après montage)', async () => {
      await oeuvre('o1')
      const t0 = new Date(Date.now() - 40 * MIN)
      const r = await poser(['o1'], {}, t0)
      if (!r.ok) throw new Error('attendu')
      jar.lus.passage = r.jeton
      const { lirePassagePublic } = await import('@/lib/commandes')
      expect((await lirePassagePublic(r.jeton))?.echue).toBe(true)
      const texte = texteDe(await (await import('@/app/commande/coordonnees/page')).default())
      expect(texte).toContain(fr.coordonnees.reprendre)
      expect(texte).not.toContain(fr.coordonnees.continuerPaiement)
    })
  })

  describe('sortie du passage : « Modifier ma commande »', () => {
    it('annule les commandes en attente, libère les réservations, révoque le jeton, sans e-mail ni événement de commande ; rejouée : sans effet', async () => {
      await oeuvre('o1')
      await oeuvre('o2', { artiste: 'art-b' })
      const r = await poser(['o1', 'o2'])
      if (!r.ok) throw new Error('attendu')
      const { annulerPassagePublic, lirePassagePublic } = await import('@/lib/commandes')
      expect(await annulerPassagePublic(r.jeton)).toEqual({ ok: true, dejaAnnule: false })
      expect(await compter('Commande', `WHERE etat = 'annulee'`)).toBe(2)
      expect(await compter('Reservation', `WHERE issue = 'liberee'`)).toBe(2)
      expect(await compter('RemboursementCommande')).toBe(0)
      expect(await compter('Evenement', `WHERE nom = 'CommandeAnnulee'`)).toBe(0)
      expect(await etat('o1')).toBe('disponible')
      expect(await lirePassagePublic(r.jeton)).toBeNull()
      expect(await compter('Jeton', 'WHERE "revoqueLe" IS NULL')).toBe(0)
      expect(envoi.envoyes).toHaveLength(0)
      expect(await annulerPassagePublic(r.jeton)).toEqual({ ok: true, dejaAnnule: true })
      expect(await annulerPassagePublic(undefined)).toEqual({ ok: true, dejaAnnule: true })
    })

    it('une œuvre déclarée vendue ailleurs entre-temps n’est jamais écrasée ; commande confirmée : etat_invalide, rien écrit', async () => {
      await oeuvre('o1')
      await oeuvre('o2')
      const r = await poser(['o1', 'o2'])
      if (!r.ok) throw new Error('attendu')
      await db.query(`UPDATE "Artwork" SET disponibilite = 'vendue_ailleurs' WHERE slug = 'o2'`)
      const { annulerPassagePublic } = await import('@/lib/commandes')
      expect(await annulerPassagePublic(r.jeton)).toMatchObject({ ok: true })
      expect(await etat('o2')).toBe('vendue_ailleurs')
      expect(await etat('o1')).toBe('disponible')

      await db.query(`UPDATE "Commande" SET etat = 'confirmee'`)
      await db.query(`UPDATE "Reservation" SET issue = NULL, "issueLe" = NULL; UPDATE "Jeton" SET "revoqueLe" = NULL`)
      expect(await annulerPassagePublic(r.jeton)).toEqual({ ok: false, code: 'etat_invalide' })
      expect(await compter('Commande', `WHERE etat = 'confirmee'`)).toBe(2 - 1)
      expect(await compter('Jeton', 'WHERE "revoqueLe" IS NULL')).toBe(1)
    })

    it('Lot 2 fermé : on peut toujours renoncer ; l’action efface le cookie', async () => {
      await oeuvre('o1')
      const r = await poser(['o1'])
      if (!r.ok) throw new Error('attendu')
      vi.stubEnv('LOT2_OUVERT', '')
      jar.lus.passage = r.jeton
      const { modifierMaCommande } = await import('@/app/commande/coordonnees/actions')
      expect(await modifierMaCommande()).toEqual({ ok: true })
      expect(jar.poses.at(-1)).toMatchObject({ nom: 'passage', valeur: '', options: { maxAge: 0, path: '/commande' } })
      expect(await etat('o1')).toBe('disponible')
      await db.query(`UPDATE "Commande" SET etat = 'confirmee'`)
      expect(await modifierMaCommande()).toEqual({ ok: true })
    })
  })

  describe('passage déjà détenu par le navigateur', () => {
    it('mêmes œuvres et même pays : reprise ET coordonnées mises à jour (e-mail, nom, adresse, téléphone)', async () => {
      await oeuvre('o1')
      await oeuvre('o2', { artiste: 'art-b' })
      const premier = await poser(['o1', 'o2'])
      if (!premier.ok) throw new Error('attendu')
      const neuves = { email: 'nouvelle@exemple.test', nom: 'Claire Dupont', adresse: '1 place Neuve\n69001 Lyon', telephone: '' }
      const second = await poser(['o2', 'o1'], { jeton: premier.jeton, coordonnees: neuves })
      expect(second).toMatchObject({ ok: true, reprise: true, passageId: premier.passageId })
      expect(await compter('PassageEnCaisse')).toBe(1)
      expect(await compter('Reservation')).toBe(2)
      expect((await db.query(`SELECT email, nom, adresse, telephone FROM "CoordonneesAcheteur"`)).rows).toEqual([
        { email: 'nouvelle@exemple.test', nom: 'Claire Dupont', adresse: '1 place Neuve\n69001 Lyon', telephone: null },
      ])
    })

    it('autres œuvres : l’ancien passage est annulé et le nouveau créé dans la même transaction (une seule réservation active par œuvre)', async () => {
      await oeuvre('o1')
      await oeuvre('o2')
      await oeuvre('o3')
      const premier = await poser(['o1', 'o2'])
      if (!premier.ok) throw new Error('attendu')
      const second = await poser(['o2', 'o3'], { jeton: premier.jeton })
      expect(second).toMatchObject({ ok: true, reprise: false })
      if (!second.ok) return
      expect(second.passageId).not.toBe(premier.passageId)
      expect(await compter('PassageEnCaisse')).toBe(2)
      expect(await compter('Commande', `WHERE etat = 'annulee' AND "passageId" = '${premier.passageId}'`)).toBe(1)
      expect(await compter('Commande', `WHERE etat = 'en_attente_paiement'`)).toBe(1)
      expect(await compter('Reservation', 'WHERE issue IS NULL')).toBe(2)
      expect(await compter('Reservation', `WHERE issue = 'liberee'`)).toBe(2)
      expect(await etat('o1')).toBe('disponible')
      expect(await etat('o2')).toBe('reservee')
      expect(await etat('o3')).toBe('reservee')
      const { lirePassagePublic } = await import('@/lib/commandes')
      expect(await lirePassagePublic(premier.jeton)).toBeNull()
      expect((await lirePassagePublic(second.jeton))?.passageId).toBe(second.passageId)
    })

    it('autre pays : même traitement ; un refus (œuvre non livrée) laisse l’ancien passage intact', async () => {
      await oeuvre('o1')
      await db.query(`INSERT INTO "ZonePays" ("codePays", "zoneId") VALUES ('BE', 'zone-ue')`)
      const premier = await poser(['o1'])
      if (!premier.ok) throw new Error('attendu')
      const refus = await poser(['o1'], { jeton: premier.jeton, pays: 'US' })
      expect(refus).toMatchObject({ ok: false, code: 'non_livree', slug: 'o1' })
      expect(await compter('Commande', `WHERE etat = 'en_attente_paiement'`)).toBe(1)
      expect(await compter('Reservation', 'WHERE issue IS NULL')).toBe(1)
      const be = await poser(['o1'], { jeton: premier.jeton, pays: 'be' })
      expect(be).toMatchObject({ ok: true, reprise: false })
      expect((await db.query(`SELECT "paysLivraison" FROM "PassageEnCaisse" ORDER BY "createdAt" DESC LIMIT 1`)).rows[0].paysLivraison).toBe('BE')
    })

    it('pays hors zone ou inconnu côté serveur : non livré, rien créé ; l’action ramène un pays invalide à la France', async () => {
      await oeuvre('o1')
      expect(await poser(['o1'], { pays: 'US' })).toMatchObject({ ok: false, code: 'non_livree', slug: 'o1' })
      expect(await poser(['o1'], { pays: 'ZZ' })).toMatchObject({ ok: false, code: 'non_livree' })
      await rienEcrit()
      jar.lus.pays = 'ZZ'
      const { envoyerCoordonnees } = await import('@/app/commande/coordonnees/actions')
      expect(await envoyerCoordonnees(['o1'], COORD)).toEqual({ ok: true })
      expect((await db.query(`SELECT "paysLivraison" FROM "PassageEnCaisse"`)).rows[0].paysLivraison).toBe('FR')
    })

    it('cookie perdu, réponse perdue : la réservation du même e-mail est signalée « déjà en cours », jamais reprise sans jeton', async () => {
      await oeuvre('o1')
      expect((await poser(['o1'])).ok).toBe(true)
      expect(await poser(['o1'])).toEqual({ ok: false, code: 'reservation_en_cours' })
      // Un autre e-mail ne voit pas cette réservation : refus ordinaire.
      expect(await poser(['o1'], { coordonnees: { ...COORD, email: 'autre@exemple.test' } })).toMatchObject({ ok: false, code: 'oeuvre_indisponible' })
      expect(await compter('PassageEnCaisse')).toBe(1)
    })
  })

  describe('limite par IP', () => {
    it('au-delà du seuil : « trop_de_demandes » sans détail ; saisie invalide ni enregistrée ni comptée ; IP hachée', async () => {
      const { LIMITES_PASSAGE_PUBLIC } = await import('@/lib/reglages')
      await oeuvre('o1', { dispo: 'vendue' })
      for (let i = 0; i < 3; i++) await poser(['o1'], { coordonnees: { ...COORD, email: 'x' }, ip: '203.0.113.7' })
      expect(await compter('TentativeInscription')).toBe(0)
      for (let i = 0; i < LIMITES_PASSAGE_PUBLIC.parIp; i++) expect(await poser(['o1'], { ip: '203.0.113.7' })).toMatchObject({ code: 'oeuvre_indisponible' })
      expect(await poser(['o1'], { ip: '203.0.113.7' })).toEqual({ ok: false, code: 'trop_de_demandes' })
      expect(await poser(['o1'], { ip: '198.51.100.9' })).toMatchObject({ code: 'oeuvre_indisponible' })
      const cles = (await db.query(`SELECT cle FROM "TentativeInscription"`)).rows.map((r) => r.cle as string)
      expect(cles.every((c) => /^passage-ip:[0-9a-f]{64}$/.test(c))).toBe(true)
      expect(cles.join()).not.toContain('203.0.113')
      await rienEcrit()
      const { envoyerCoordonnees } = await import('@/app/commande/coordonnees/actions')
      expect(await envoyerCoordonnees(['o1'], COORD)).toEqual({ ok: false, code: 'oeuvre_indisponible', slug: 'o1' })
    })
  })

  describe('retentative : cas limites', () => {
    const passageEchu = async (slugs: string[], t0: Date) => {
      const r = await poser(slugs, {}, t0)
      if (!r.ok) throw new Error('attendu')
      return r
    }
    const lancer = async (jeton: string | undefined, maintenant: Date) => (await import('@/lib/commandes')).reprendrePassagePublic(jeton, maintenant)

    it('prix, frais ou livraison changés : rien n’est réservé, « prix_change » nomme l’œuvre', async () => {
      for (const cas of [
        `UPDATE "Artwork" SET "prixCentimes" = 120000 WHERE slug = 'o2'`,
        `UPDATE "OffreLivraison" SET "fraisCentimes" = 9000 WHERE "artworkId" = 'o2'`,
        `UPDATE "Artwork" SET devise = 'USD' WHERE slug = 'o2'`,
        `DELETE FROM "OffreLivraison" WHERE "artworkId" = 'o2'`,
      ]) {
        await db.query(`DELETE FROM "TentativeInscription"; DELETE FROM "Jeton"; DELETE FROM "Reservation"; DELETE FROM "LigneCommande"; DELETE FROM "Commande"; DELETE FROM "CoordonneesAcheteur"; DELETE FROM "PassageEnCaisse"; DELETE FROM "OffreLivraison"; DELETE FROM "Artwork"`)
        await oeuvre('o1')
        await oeuvre('o2')
        const t0 = new Date(Date.now() - 40 * MIN)
        const r = await passageEchu(['o1', 'o2'], t0)
        await db.query(cas)
        const avant = await compter('Reservation')
        expect(await lancer(r.jeton, new Date(t0.getTime() + 31 * MIN)), cas).toEqual({ ok: false, code: 'prix_change', slug: 'o2' })
        expect(await compter('Reservation')).toBe(avant)
        expect(await compter('Reservation', 'WHERE issue IS NULL')).toBe(2)
        expect(await compter('Jeton', 'WHERE "revoqueLe" IS NULL')).toBe(1)
      }
    })

    it('retentative réussie : l’échéance d’abandon des commandes est prolongée', async () => {
      await oeuvre('o1')
      const t0 = new Date(Date.now() - 40 * MIN)
      const r = await passageEchu(['o1'], t0)
      const avant = new Date((await db.query(`SELECT "abandonneLe" FROM "Commande"`)).rows[0].abandonneLe).getTime()
      const apres = new Date(t0.getTime() + 35 * MIN)
      expect(await lancer(r.jeton, apres)).toMatchObject({ ok: true, reprise: false })
      const nouveau = new Date((await db.query(`SELECT "abandonneLe" FROM "Commande"`)).rows[0].abandonneLe).getTime()
      expect(nouveau).toBeGreaterThan(avant)
      expect(nouveau).toBe(apres.getTime() + 30 * MIN + 7 * 24 * 3_600_000)
    })

    it('plafond atteint à la retentative : rien ne change', async () => {
      for (const s of ['o1', 'o2', 'o3', 'o4', 'o5']) await oeuvre(s)
      const t0 = new Date(Date.now() - 40 * MIN)
      const r = await passageEchu(['o1', 'o2'], t0)
      // Même e-mail : trois autres œuvres réservées maintenant.
      expect((await poser(['o3', 'o4', 'o5'])).ok).toBe(true)
      const avant = await compter('Reservation')
      expect(await lancer(r.jeton, new Date(t0.getTime() + 31 * MIN))).toEqual({ ok: false, code: 'plafond_atteint' })
      expect(await compter('Reservation')).toBe(avant)
      expect(await compter('Jeton', 'WHERE "revoqueLe" IS NULL')).toBe(2)
    })

    it.each(['vendue', 'retiree', 'vendue_ailleurs'])('œuvre %s entre-temps : « oeuvre_indisponible », rien réservé', async (dispo) => {
      await oeuvre('o1')
      await oeuvre('o2')
      const t0 = new Date(Date.now() - 40 * MIN)
      const r = await passageEchu(['o1', 'o2'], t0)
      await db.query(`UPDATE "Artwork" SET disponibilite = $1::"Disponibilite" WHERE slug = 'o2'`, [dispo])
      expect(await lancer(r.jeton, new Date(t0.getTime() + 31 * MIN))).toEqual({ ok: false, code: 'oeuvre_indisponible', slug: 'o2' })
      expect(await compter('Reservation', 'WHERE issue IS NULL')).toBe(0 + 2)
      expect(await etat('o2')).toBe(dispo)
    })

    it('slug changé depuis : la retentative suit l’œuvre par son identifiant ; les lignes figées gardent l’ancien slug', async () => {
      await oeuvre('o1')
      const t0 = new Date(Date.now() - 40 * MIN)
      const r = await passageEchu(['o1'], t0)
      await db.query(`UPDATE "Artwork" SET slug = 'nouveau-nom' WHERE id = 'o1'`)
      expect(await lancer(r.jeton, new Date(t0.getTime() + 31 * MIN))).toMatchObject({ ok: true, reprise: false })
      expect((await db.query(`SELECT slug FROM "LigneCommande"`)).rows[0].slug).toBe('o1')
      expect(await compter('Reservation', 'WHERE issue IS NULL')).toBe(1)
    })

    it('deux « Continuer » simultanés après l’échéance : une seule nouvelle réservation, un seul jeton actif', async () => {
      await oeuvre('o1')
      await oeuvre('o2')
      const t0 = new Date(Date.now() - 40 * MIN)
      const r = await passageEchu(['o1', 'o2'], t0)
      const apres = new Date(t0.getTime() + 31 * MIN)
      const [a, b] = await Promise.all([lancer(r.jeton, apres), lancer(r.jeton, apres)])
      expect(a.ok && b.ok).toBe(true)
      expect([a, b].filter((x) => x.ok && !x.reprise)).toHaveLength(1)
      expect(await compter('Reservation', 'WHERE issue IS NULL')).toBe(2)
      expect(await compter('Jeton', 'WHERE "revoqueLe" IS NULL')).toBe(1)
      expect(await compter('PassageEnCaisse')).toBe(1)
    })
  })

  describe('journaux et pages', () => {
    it('une erreur levée dans l’action : « indisponible » sans détail ; ni e-mail ni adresse dans les journaux', async () => {
      await oeuvre('o1')
      const journal: string[] = []
      for (const n of ['log', 'info', 'warn', 'error'] as const) vi.spyOn(console, n).mockImplementation((...a: unknown[]) => void journal.push(JSON.stringify(a)))
      const { prisma } = await import('@/lib/prisma')
      vi.spyOn(prisma, '$transaction').mockRejectedValue(new Error('claire.martin@exemple.test 12 rue des Lilas'))
      const { envoyerCoordonnees, reprendreReservation } = await import('@/app/commande/coordonnees/actions')
      jar.lus.passage = 'A'.repeat(43)
      expect(await envoyerCoordonnees(['o1'], COORD)).toEqual({ ok: false, code: 'indisponible' })
      expect(await reprendreReservation()).toEqual({ ok: false, code: 'indisponible' })
      expect(journal.length).toBeGreaterThan(0)
      const tout = journal.join('\n')
      expect(tout).not.toContain('exemple.test')
      expect(tout).not.toContain('rue des Lilas')
    })

    it('Lot 2 fermé avec un cookie « passage » valide : message d’ouverture prochaine, ni passage ni formulaire', async () => {
      await oeuvre('o1')
      const r = await poser(['o1'])
      if (!r.ok) throw new Error('attendu')
      vi.stubEnv('LOT2_OUVERT', '')
      jar.lus.passage = r.jeton
      const page = (await import('@/app/commande/coordonnees/page')).default
      const html = renderToStaticMarkup((await page()) as never)
      expect(texteDe(await page())).toContain(fr.coordonnees.ferme.titre)
      expect(html).not.toContain('Titre o1')
      expect(html).not.toContain('<form')
    })

    it('cookies « commande » et « passage » ensemble : le passage de l’équipe passe d’abord', async () => {
      await oeuvre('o1')
      await oeuvre('o2')
      await oeuvre('o3')
      const { poserVenteAssistee } = await import('@/lib/commandes')
      const a = await poserVenteAssistee(ADMIN, { email: 'equipe@exemple.test', nom: 'Équipe', pays: 'FR', oeuvres: ['o1'] })
      if (!a.ok) throw new Error('attendu')
      const publique = await poser(['o2'], { coordonnees: { ...COORD, email: 'autre@exemple.test' } })
      if (!publique.ok) throw new Error('attendu')
      jar.lus.commande = /\/commande\/([A-Za-z0-9_-]{43})/.exec(envoi.envoyes[0]?.texte ?? '')?.[1]
      jar.lus.passage = publique.jeton
      const page = (await import('@/app/commande/coordonnees/page')).default
      const texte = texteDe(await page())
      expect(texte).toContain('Titre o1')
      expect(texte).not.toContain('Titre o2')
    })

    it('lien de l’équipe inactif (cookie « commande » sans passage valide) : « Ce lien n’est plus actif » et lien vers /commande', async () => {
      jar.lus.commande = 'A'.repeat(43)
      const page = (await import('@/app/commande/coordonnees/page')).default
      const html = renderToStaticMarkup((await page()) as never)
      expect(texteDe(await page())).toContain(fr.coordonnees.inactif.titre)
      expect(html).toContain('href="/commande"')
      expect(html).not.toContain('<form')
    })

    it('/commande n’affiche pas une commande annulée (6.3) ; toutes annulées : lien inactif', async () => {
      await oeuvre('o1')
      await oeuvre('o2', { artiste: 'art-b' })
      const { poserVenteAssistee } = await import('@/lib/commandes')
      const a = await poserVenteAssistee(ADMIN, { email: 'equipe@exemple.test', nom: 'Équipe', pays: 'FR', oeuvres: ['o1', 'o2'] })
      if (!a.ok) throw new Error('attendu')
      jar.lus.commande = /\/commande\/([A-Za-z0-9_-]{43})/.exec(envoi.envoyes[0]?.texte ?? '')?.[1]
      await db.query(`UPDATE "Commande" SET etat = 'annulee' WHERE id = $1`, [a.commandes[1].id])
      const page = (await import('@/app/commande/page')).default
      const texte = texteDe(await page())
      expect(texte).toContain('Titre o1')
      expect(texte).not.toContain('Titre o2')
      await db.query(`UPDATE "Commande" SET etat = 'annulee'`)
      expect(texteDe(await page())).toContain(fr.commande.inactif.titre)
    })

    it('mesure : /commande/coordonnees est hors liste blanche', async () => {
      const { cheminMesurable } = await import('@/lib/mesure/regles')
      expect(cheminMesurable('/commande/coordonnees')).toBe(false)
    })

    it('complément du passage de l’équipe : un téléphone déjà saisi n’est pas écrasé par un champ vide', async () => {
      await oeuvre('o1')
      const { poserVenteAssistee, completerCoordonneesDuPassage } = await import('@/lib/commandes')
      const a = await poserVenteAssistee(ADMIN, { email: 'equipe@exemple.test', nom: 'Équipe', pays: 'FR', oeuvres: ['o1'] })
      if (!a.ok) throw new Error('attendu')
      await db.query(`UPDATE "CoordonneesAcheteur" SET telephone = '+33 6 00 00 00 00'`)
      expect(await completerCoordonneesDuPassage(a.passageId, { adresse: '3 quai du Port', telephone: '' })).toEqual({ ok: true })
      expect((await db.query(`SELECT adresse, telephone FROM "CoordonneesAcheteur"`)).rows[0]).toEqual({ adresse: '3 quai du Port', telephone: '+33 6 00 00 00 00' })
    })
  })

  it('middleware : /commande/coordonnees reste atteignable pendant la maintenance (règle partagée)', async () => {
    const { passeLaMaintenance } = await import('@/lib/reglages')
    expect(passeLaMaintenance(null, '/commande/coordonnees')).toBe(true)
    expect(passeLaMaintenance(null, '/panier')).toBe(false)
  })
})
