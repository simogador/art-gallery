import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { heureMurale } from '@/lib/i18n'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 4.3 (FR-8, UJ-4, UX-DR44) : demande de visite à distance ou en atelier. Règles pures
// (créneaux, fuseau, type), enregistrement rattaché à l'œuvre à l'état `nouvelle`, accusé au visiteur
// et alerte à l'équipe (un e-mail chacun, même rejoué), limites, double appui, page réservée aux
// œuvres disponibles, jamais de coordonnées de l'artiste ni de donnée personnelle dans les journaux.

type Envoye = { a: string; sujet: string; texte: string; html: string; cle: string }
const envoi = vi.hoisted(() => ({
  envoyes: [] as { a: string; sujet: string; texte: string; html: string; cle: string }[],
  resultat: { ok: true } as { ok: true } | { ok: false; code: 'refuse' | 'indisponible' | 'non_configure' },
}))
const entetes = vi.hoisted(() => ({ ip: '203.0.113.7' as string | null }))

vi.mock('@/lib/notifications/choix', () => ({
  envoiActif: () => ({
    envoyer: async (c: Envoye) => {
      envoi.envoyes.push(c)
      return envoi.resultat
    },
  }),
  choisirEnvoi: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({
  cookies: () => ({ get: () => undefined }),
  headers: () => ({ get: (nom: string) => (nom === 'x-forwarded-for' ? entetes.ip : null) }),
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('introuvable')
  },
  redirect: (url: string) => {
    throw new Error(`redirection:${url}`)
  },
  permanentRedirect: (url: string) => {
    throw new Error(`redirection-permanente:${url}`)
  },
}))

const JOUR = 24 * 3_600_000
const FUSEAU = 'America/Montreal'
/** Heure murale à `jours` d'ici, arrondie à l'heure, dans le fuseau donné. */
const dans = (jours: number, heure = 15, fuseau = FUSEAU) => {
  const mur = heureMurale(new Date(Date.now() + jours * JOUR), fuseau)!
  return `${mur.slice(0, 10)}T${String(heure).padStart(2, '0')}:00`
}

const valide = () => ({
  type: 'distance',
  creneaux: [dans(3), dans(5, 10), ''],
  fuseau: FUSEAU,
  email: ' Claire.Martin@Exemple.TEST ',
  telephone: '+1 514 555 0199',
})
const CONTEXTE = () => ({ atelierAccepte: true, maintenant: new Date() })

describe('règles pures', () => {
  it('une saisie correcte est normalisée : créneaux en UTC avec le fuseau de l’appareil, e-mail', async () => {
    const { validerVisite } = await import('@/lib/demandes/visite-regles')
    const { heureMuraleEnUtc } = await import('@/lib/i18n')
    const v = valide()
    const r = validerVisite(v, CONTEXTE())
    expect(r).toEqual({
      ok: true,
      valeur: {
        type: 'distance',
        creneaux: [heureMuraleEnUtc(v.creneaux[0], FUSEAU), heureMuraleEnUtc(v.creneaux[1], FUSEAU)],
        fuseau: FUSEAU,
        email: 'claire.martin@exemple.test',
        telephone: '+1 514 555 0199',
      },
    })
    // Le fuseau de Montréal n'est pas celui de Paris : 15 h à Montréal = 20 h ou 21 h UTC.
    expect(heureMuraleEnUtc('2026-11-17T15:00', FUSEAU)?.toISOString()).toBe('2026-11-17T20:00:00.000Z')
    expect(heureMuraleEnUtc('2026-11-17T15:00', 'Europe/Paris')?.toISOString()).toBe('2026-11-17T14:00:00.000Z')
  })

  it('créneaux fautifs : moins de deux, plus de trois, doublons, passé, au-delà de 90 jours, illisible, fuseau inconnu', async () => {
    const { validerVisite } = await import('@/lib/demandes/visite-regles')
    const { fr } = await import('@/lib/i18n')
    const e = fr.visite.erreurs
    const erreur = (creneaux: string[], fuseau = FUSEAU) => {
      const r = validerVisite({ ...valide(), creneaux, fuseau }, CONTEXTE())
      return r.ok ? null : r.erreurs.creneaux
    }
    expect(erreur([dans(3), '', ''])).toBe(e.creneauxPeu(2))
    expect(erreur([dans(3), dans(4), dans(5), dans(6)])).toBe(e.creneauxTrop(3))
    expect(erreur([dans(3), dans(3)])).toBe(e.creneauxIdentiques)
    expect(erreur([dans(-2), dans(3)])).toBe(e.creneauPasse)
    expect(erreur([dans(3), dans(95)])).toBe(e.creneauLointain(90))
    expect(erreur([dans(3), 'demain matin'])).toBe(e.creneauIllisible)
    expect(erreur([dans(3), '2026-02-31T10:00'])).toBe(e.creneauIllisible)
    expect(erreur([dans(3), dans(4)], 'Mars/Olympus')).toBe(e.fuseauInconnu)
    expect(erreur([dans(3), dans(4)], '')).toBe(e.fuseauInconnu)
    expect(erreur([dans(3), dans(4), dans(89)])).toBeNull()
  })

  it('type : « en atelier » refusé si l’artiste ne l’accepte pas ; type absent ou inconnu refusé ; corps quelconque sans exception', async () => {
    const { validerVisite } = await import('@/lib/demandes/visite-regles')
    const { fr } = await import('@/lib/i18n')
    const maintenant = new Date()
    expect(validerVisite({ ...valide(), type: 'atelier' }, { atelierAccepte: true, maintenant }).ok).toBe(true)
    expect(validerVisite({ ...valide(), type: 'atelier' }, { atelierAccepte: false, maintenant })).toEqual({
      ok: false,
      erreurs: { type: fr.visite.erreurs.atelierIndisponible },
    })
    for (const type of ['', 'chez-moi']) {
      expect(validerVisite({ ...valide(), type }, CONTEXTE())).toMatchObject({ ok: false, erreurs: { type: fr.visite.erreurs.typeVide } })
    }
    for (const corps of [null, undefined, 42, 'texte', [], { creneaux: 'x', type: 3 }]) {
      expect(validerVisite(corps, CONTEXTE()).ok).toBe(false)
    }
  })
})

describe('heures murales (i18n)', () => {
  it('conversion selon le fuseau, heure d’été comprise ; heure sautée, date impossible et fuseau inconnu refusés', async () => {
    const { heureMuraleEnUtc, heureMurale, fuseauValide } = await import('@/lib/i18n')
    expect(heureMuraleEnUtc('2026-07-17T15:00', 'Europe/Paris')?.toISOString()).toBe('2026-07-17T13:00:00.000Z')
    expect(heureMuraleEnUtc('2026-11-17T15:00', 'Asia/Kolkata')?.toISOString()).toBe('2026-11-17T09:30:00.000Z')
    // 2 h 30 n'existe pas à Paris le 29 mars 2026 (passage à l'heure d'été).
    expect(heureMuraleEnUtc('2026-03-29T02:30', 'Europe/Paris')).toBeNull()
    // Correction du décalage autour des changements d'heure.
    expect(heureMuraleEnUtc('2026-03-29T01:30', 'Europe/Paris')?.toISOString()).toBe('2026-03-29T00:30:00.000Z')
    expect(heureMuraleEnUtc('2026-10-25T02:30', 'Europe/Paris')).not.toBeNull()
    expect(heureMuraleEnUtc('2026-02-31T10:00', 'UTC')).toBeNull()
    expect(heureMuraleEnUtc('2026-11-17T15:00', 'Mars/Olympus')).toBeNull()
    expect(heureMurale(new Date('2026-11-17T14:00:00Z'), 'Europe/Paris')).toBe('2026-11-17T15:00')
    expect([fuseauValide('Europe/Paris'), fuseauValide('UTC'), fuseauValide('+01:00'), fuseauValide(42)]).toEqual([true, true, false, false])
  })
})

describe('base : demandes de visite', () => {
  let base: BaseJetable
  let db: Client

  const compter = async (table: string) => Number((await db.query(`SELECT count(*) FROM "${table}"`)).rows[0].count)

  async function oeuvre(slug: string, options: { publication?: string; dispo?: string; atelier?: boolean | null; artiste?: string } = {}) {
    const { publication = 'publiee', dispo = 'disponible', atelier = null, artiste = 'art-v' } = options
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", devise, "hauteurMm", "largeurMm",
         publication, disponibilite, "visitesAtelier", "artistId", "updatedAt")
       VALUES ($1, $1, $2, 2024, 'Huile', 'D', 'https://res.cloudinary.com/x/p.jpg', 250000, 'EUR', 610, 760,
         $3::"Publication", $4::"Disponibilite", $5, $6, now())`,
      [slug, `Titre ${slug}`, publication, dispo, atelier, artiste],
    )
  }

  beforeAll(async () => {
    base = await creerBaseJetable()
    process.env.DATABASE_URL = base.url
    process.env.AUTH_SECRET = 'secret-de-test'
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
    entetes.ip = '203.0.113.7'
    for (const table of ['Evenement', 'DemandeVisite', 'TentativeInscription', 'Artwork', 'Artist', 'User']) await db.query(`DELETE FROM "${table}"`)
    // Artiste avec accord et coordonnées : elles ne doivent jamais apparaître.
    await db.query(
      `INSERT INTO "User" (id, email, name, role, "updatedAt") VALUES ('u-v', 'artiste.prive@atelier.test', 'Nadia Benali', 'artist', now())`,
    )
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", website, "accordSigneLe", "userId", "updatedAt")
       VALUES ('art-v', 'art-v', 'Nadia Benali', 'MA', 1980, 'Bio', '', 'https://atelier-prive.test', now(), 'u-v', now())`,
    )
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt")
       VALUES ('art-sans-accord', 'art-sans-accord', 'Sans Accord', 'MA', 1980, 'Bio', '', now())`,
    )
  })

  afterEach(() => vi.restoreAllMocks())

  it('visite à distance : demande « nouvelle » rattachée à l’œuvre, un accusé (créneaux dans le fuseau du visiteur) et une alerte sans donnée personnelle', async () => {
    await oeuvre('nuit-bleue')
    const { envoyerDemandeVisite } = await import('@/app/galerie/[id]/visite/actions')
    const { formaterDateHeure, heureMuraleEnUtc } = await import('@/lib/i18n')
    const saisie = valide()
    expect(await envoyerDemandeVisite('nuit-bleue', saisie)).toEqual({ ok: true })

    const lignes = (await db.query('SELECT * FROM "DemandeVisite"')).rows
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({
      artworkId: 'nuit-bleue',
      type: 'distance',
      etat: 'nouvelle',
      fuseau: FUSEAU,
      email: 'claire.martin@exemple.test',
      telephone: '+1 514 555 0199',
    })
    const attendus = saisie.creneaux.slice(0, 2).map((c) => heureMuraleEnUtc(c, FUSEAU)!.toISOString())
    expect((lignes[0].creneaux as Date[]).map((d) => new Date(d).toISOString())).toEqual(attendus)

    expect(envoi.envoyes).toHaveLength(2)
    const accuse = envoi.envoyes.find((c) => c.a === 'claire.martin@exemple.test')!
    expect(accuse.sujet).toBe('Nous avons bien reçu votre demande de visite')
    expect(accuse.texte).toContain('« Titre nuit-bleue »')
    expect(accuse.texte).toContain('Visite à distance')
    expect(accuse.texte).toContain(`fuseau ${FUSEAU}`)
    for (const c of saisie.creneaux.slice(0, 2)) {
      expect(accuse.texte).toContain(formaterDateHeure(heureMuraleEnUtc(c, FUSEAU), { fuseau: FUSEAU, jourSemaine: true }))
      // Heure saisie (15 h, 10 h) telle que le visiteur l'a écrite, pas convertie en heure de Paris.
      expect(accuse.texte).toContain(`à ${Number(c.slice(11, 13))} h 00`)
    }
    expect(accuse.texte).toContain('Nous vous répondons sous 48 heures.')
    expect(accuse.texte.trimEnd().endsWith('Une question ? Écrivez-nous à contact@errancy.art')).toBe(true)
    // Ni canal, ni durée, ni gratuité.
    expect(accuse.texte).not.toMatch(/vidéo|visio|whatsapp|zoom|minutes|gratuit/i)

    const alerte = envoi.envoyes.find((c) => c.a === 'contact@errancy.art')!
    expect(alerte.sujet).toBe('Nouvelle demande de visite')
    expect(alerte.texte).toContain(lignes[0].id)
    expect(alerte.texte).toContain('https://www.errancy.art/dashboard/admin')
    expect(alerte.texte + alerte.html + alerte.sujet).not.toMatch(/exemple\.test|Claire|514|Montreal/i)

    // Jamais les coordonnées de l'artiste, dans aucun e-mail.
    expect(JSON.stringify(envoi.envoyes)).not.toMatch(/atelier\.test|atelier-prive|artiste\.prive/)
  })

  it('visite en atelier : acceptée si l’artiste l’accepte ; sinon refus serveur sans enregistrement ni e-mail', async () => {
    await oeuvre('avec-atelier', { atelier: true })
    await oeuvre('sans-atelier', { atelier: false })
    await oeuvre('atelier-inconnu', { atelier: null })
    const { envoyerDemandeVisite } = await import('@/app/galerie/[id]/visite/actions')
    expect(await envoyerDemandeVisite('avec-atelier', { ...valide(), type: 'atelier' })).toEqual({ ok: true })
    expect((await db.query('SELECT type FROM "DemandeVisite"')).rows).toEqual([{ type: 'atelier' }])
    expect(envoi.envoyes.find((c) => c.a === 'claire.martin@exemple.test')?.texte).toContain('Visite en atelier')

    envoi.envoyes.length = 0
    for (const slug of ['sans-atelier', 'atelier-inconnu']) {
      expect(await envoyerDemandeVisite(slug, { ...valide(), type: 'atelier', email: `${slug}@exemple.test` })).toMatchObject({
        ok: false,
        code: 'invalide',
        erreurs: { type: expect.any(String) },
      })
    }
    expect(await compter('DemandeVisite')).toBe(1)
    expect(envoi.envoyes).toHaveLength(0)
  })

  it('œuvre non disponible (vendue, réservée, retirée, vendue ailleurs, brouillon, en curation, sans accord, inconnue) : refus serveur', async () => {
    await oeuvre('vendue', { dispo: 'vendue' })
    await oeuvre('reservee', { dispo: 'reservee' })
    await oeuvre('retiree', { dispo: 'retiree' })
    await oeuvre('ailleurs', { dispo: 'vendue_ailleurs' })
    await oeuvre('brouillon', { publication: 'brouillon' })
    await oeuvre('curation', { publication: 'en_curation' })
    await oeuvre('sans-accord', { artiste: 'art-sans-accord' })
    const { envoyerDemandeVisite } = await import('@/app/galerie/[id]/visite/actions')
    for (const slug of ['vendue', 'reservee', 'retiree', 'ailleurs', 'brouillon', 'curation', 'sans-accord', 'inconnue']) {
      expect(await envoyerDemandeVisite(slug, valide()), slug).toEqual({ ok: false, code: 'oeuvre_indisponible' })
    }
    expect(await compter('DemandeVisite')).toBe(0)
    expect(await compter('TentativeInscription')).toBe(0)
    expect(envoi.envoyes).toHaveLength(0)
  })

  it('page : 404 pour une œuvre non disponible ou inconnue ; « En atelier » proposé seulement si l’artiste l’accepte', async () => {
    await oeuvre('dispo-atelier', { atelier: true })
    await oeuvre('dispo-distance', { atelier: false })
    await oeuvre('vendue', { dispo: 'vendue' })
    await oeuvre('reservee', { dispo: 'reservee' })
    await oeuvre('retiree', { dispo: 'retiree' })
    await oeuvre('brouillon', { publication: 'brouillon' })
    const { default: Page } = await import('@/app/galerie/[id]/visite/page')
    for (const id of ['vendue', 'reservee', 'retiree', 'brouillon', 'inconnue']) {
      await expect(Page({ params: { id } }), id).rejects.toThrow('introuvable')
    }
    const props = async (id: string) => {
      const page = (await Page({ params: { id } })) as { props: { children: { props: { children: unknown[] } } } }
      const enfants = page.props.children.props.children as { props?: Record<string, unknown> }[]
      return enfants.find((e) => e?.props && 'atelierAccepte' in e.props)!.props!
    }
    expect(await props('dispo-atelier')).toMatchObject({ slug: 'dispo-atelier', atelierAccepte: true, delaiHeures: 48 })
    expect(await props('dispo-distance')).toMatchObject({ slug: 'dispo-distance', atelierAccepte: false })
  })

  it('pays non livré : la visite reste possible (le pays de livraison n’entre pas en compte)', async () => {
    // Aucune zone ni offre de livraison en base : l'œuvre n'est livrée nulle part.
    await oeuvre('non-livree')
    const { envoyerDemandeVisite } = await import('@/app/galerie/[id]/visite/actions')
    expect(await envoyerDemandeVisite('non-livree', valide())).toEqual({ ok: true })
  })

  it('l’événement ne porte que l’id de la demande', async () => {
    await oeuvre('nuit-bleue')
    const { enregistrerDemandeVisite } = await import('@/lib/demandes')
    await enregistrerDemandeVisite('nuit-bleue', valide(), '203.0.113.7')
    const lignes = (await db.query('SELECT nom, charge FROM "Evenement"')).rows
    expect(lignes).toEqual([{ nom: 'DemandeVisiteRecue', charge: { demandeId: expect.any(String) } }])
    expect(JSON.stringify(lignes)).not.toMatch(/exemple\.test|Claire|514|Montreal|nuit-bleue/)
  })

  it('créneaux fautifs : messages par champ, rien d’enregistré ni compté, aucun e-mail', async () => {
    await oeuvre('nuit-bleue')
    const { envoyerDemandeVisite } = await import('@/app/galerie/[id]/visite/actions')
    const r = await envoyerDemandeVisite('nuit-bleue', { ...valide(), creneaux: [dans(3), dans(3)], email: 'nope' })
    expect(r).toMatchObject({ ok: false, code: 'invalide', erreurs: { creneaux: expect.any(String), email: expect.any(String) } })
    expect(await compter('DemandeVisite')).toBe(0)
    expect(await compter('TentativeInscription')).toBe(0)
    expect(await compter('Evenement')).toBe(0)
    expect(envoi.envoyes).toHaveLength(0)
  })

  it('double appui (deux envois simultanés identiques) : une seule demande et deux e-mails seulement', async () => {
    await oeuvre('nuit-bleue')
    const { envoyerDemandeVisite } = await import('@/app/galerie/[id]/visite/actions')
    const saisie = valide()
    const [a, b] = await Promise.all([envoyerDemandeVisite('nuit-bleue', saisie), envoyerDemandeVisite('nuit-bleue', saisie)])
    expect(a).toEqual({ ok: true })
    expect(b).toEqual({ ok: true })
    expect(await compter('DemandeVisite')).toBe(1)
    expect(await compter('Evenement')).toBe(1)
    expect(envoi.envoyes).toHaveLength(2)
  })

  it('une demande corrigée (autres créneaux, autre œuvre) n’est pas absorbée comme un doublon', async () => {
    await oeuvre('nuit-bleue')
    await oeuvre('aube')
    const { envoyerDemandeVisite } = await import('@/app/galerie/[id]/visite/actions')
    await envoyerDemandeVisite('nuit-bleue', valide())
    await envoyerDemandeVisite('nuit-bleue', { ...valide(), creneaux: [dans(3), dans(6)] })
    await envoyerDemandeVisite('aube', valide())
    expect(await compter('DemandeVisite')).toBe(3)
  })

  it('événement rejoué : un seul accusé et une seule alerte', async () => {
    await oeuvre('nuit-bleue')
    const { enregistrerDemandeVisite } = await import('@/lib/demandes')
    const { repartir } = await import('@/lib/evenements')
    await enregistrerDemandeVisite('nuit-bleue', valide(), '203.0.113.7')
    expect(envoi.envoyes).toHaveLength(2)
    const ids = (await db.query('SELECT id FROM "Evenement"')).rows.map((l) => l.id as string)
    await Promise.all([repartir(ids), repartir(ids)])
    await repartir(ids)
    expect(envoi.envoyes).toHaveLength(2)
    expect(await compter('TraitementEvenement')).toBe(2)
  })

  it('anti-abus par IP puis par e-mail : refus sans message technique, compteurs distincts de la sélection', async () => {
    await oeuvre('nuit-bleue')
    const { envoyerDemandeVisite } = await import('@/app/galerie/[id]/visite/actions')
    const { LIMITES_DEMANDE_VISITE } = await import('@/lib/reglages')
    for (let i = 0; i < LIMITES_DEMANDE_VISITE.parIp; i++) {
      expect(await envoyerDemandeVisite('nuit-bleue', { ...valide(), email: `visiteur${i}@exemple.test` })).toEqual({ ok: true })
    }
    expect(await envoyerDemandeVisite('nuit-bleue', { ...valide(), email: 'autre@exemple.test' })).toEqual({ ok: false, code: 'trop_de_demandes' })
    expect(await compter('DemandeVisite')).toBe(LIMITES_DEMANDE_VISITE.parIp)

    // Même e-mail depuis plusieurs IP.
    await db.query('DELETE FROM "TentativeInscription"')
    for (let i = 0; i < LIMITES_DEMANDE_VISITE.parEmail; i++) {
      entetes.ip = `198.51.100.${i + 1}`
      expect(await envoyerDemandeVisite('nuit-bleue', { ...valide(), creneaux: [dans(3), dans(10 + i)] })).toEqual({ ok: true })
    }
    entetes.ip = '198.51.100.99'
    expect(await envoyerDemandeVisite('nuit-bleue', { ...valide(), creneaux: [dans(3), dans(30)] })).toEqual({ ok: false, code: 'trop_de_demandes' })

    const cles = (await db.query('SELECT cle FROM "TentativeInscription"')).rows.map((l) => l.cle as string)
    expect(cles.every((c) => /^visite-(ip|email):[0-9a-f]{64}$/.test(c))).toBe(true)
    expect(JSON.stringify(cles)).not.toMatch(/198\.51|203\.0|exemple/)
  })

  it('la purge des traces ne touche que celles de ce formulaire', async () => {
    await oeuvre('nuit-bleue')
    const { envoyerDemandeVisite } = await import('@/app/galerie/[id]/visite/actions')
    await db.query(
      `INSERT INTO "TentativeInscription" (id, cle, "createdAt") VALUES
         ('maintenance', 'ip:abc', now() - interval '3 hours'), ('conseil', 'conseil-ip:abc', now() - interval '3 hours'),
         ('visite', 'visite-ip:abc', now() - interval '3 hours')`,
    )
    await envoyerDemandeVisite('nuit-bleue', valide())
    const restantes = (await db.query(`SELECT id FROM "TentativeInscription" WHERE id IN ('maintenance', 'conseil', 'visite') ORDER BY id`)).rows
    expect(restantes).toEqual([{ id: 'conseil' }, { id: 'maintenance' }])
  })

  it('e-mail refusé par le prestataire : la demande reste enregistrée et confirmée, journal sans donnée personnelle', async () => {
    await oeuvre('nuit-bleue')
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { envoyerDemandeVisite } = await import('@/app/galerie/[id]/visite/actions')
    envoi.resultat = { ok: false, code: 'indisponible' }
    expect(await envoyerDemandeVisite('nuit-bleue', valide())).toEqual({ ok: true })
    expect(await compter('DemandeVisite')).toBe(1)
    const journal = JSON.stringify(erreurs.mock.calls)
    expect(journal).toContain('accusé de visite non envoyé')
    expect(journal).toContain('alerte de visite non envoyée')
    expect(journal).not.toMatch(/exemple\.test|Claire|203\.0\.113|514|Montreal|T15:00/)
  })

  it('panne de la base : réponse « indisponible », sans détail ni donnée personnelle dans les journaux', async () => {
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
    const demandes = await import('@/lib/demandes')
    vi.spyOn(demandes, 'enregistrerDemandeVisite').mockRejectedValueOnce(new Error('connexion perdue pour claire@exemple.test'))
    const { envoyerDemandeVisite } = await import('@/app/galerie/[id]/visite/actions')
    expect(await envoyerDemandeVisite('nuit-bleue', valide())).toEqual({ ok: false, code: 'indisponible' })
    expect(JSON.stringify(erreurs.mock.calls)).not.toContain('exemple.test')
  })

  it('œuvre supprimée : la demande reste, sans lien (artworkId null)', async () => {
    await oeuvre('supprimee')
    const { envoyerDemandeVisite } = await import('@/app/galerie/[id]/visite/actions')
    expect(await envoyerDemandeVisite('supprimee', valide())).toEqual({ ok: true })
    await db.query(`DELETE FROM "Artwork" WHERE slug = 'supprimee'`)
    const lignes = (await db.query('SELECT "artworkId", email FROM "DemandeVisite"')).rows
    expect(lignes).toEqual([{ artworkId: null, email: 'claire.martin@exemple.test' }])
  })

  it('accusé d’une demande dont l’œuvre a été supprimée : aucun e-mail, journal en ids seulement, sans exception', async () => {
    await oeuvre('effacee')
    const infos = vi.spyOn(console, 'info').mockImplementation(() => {})
    const { enregistrerDemandeVisite } = await import('@/lib/demandes')
    const { envoyerAccuseVisite } = await import('@/lib/notifications')
    await enregistrerDemandeVisite('effacee', valide(), '203.0.113.7')
    await db.query(`DELETE FROM "Artwork" WHERE slug = 'effacee'`)
    envoi.envoyes.length = 0
    const ev = (await db.query('SELECT id, charge FROM "Evenement"')).rows[0]
    await envoyerAccuseVisite({ id: ev.id, nom: 'DemandeVisiteRecue', version: 1, charge: ev.charge })
    expect(envoi.envoyes).toHaveLength(0)
    expect(JSON.stringify(infos.mock.calls)).toContain('œuvre de la demande de visite supprimée')
    expect(JSON.stringify(infos.mock.calls)).not.toMatch(/exemple\.test|Claire/)
  })

  it('catalogue : `visitesAtelier` exposé dans le type d’affichage (vrai seulement si l’artiste a répondu oui)', async () => {
    await oeuvre('oui', { atelier: true })
    await oeuvre('non', { atelier: false })
    await oeuvre('vide', { atelier: null })
    const { getArtworkBySlug } = await import('@/lib/catalogue')
    expect((await getArtworkBySlug('oui'))?.visitesAtelier).toBe(true)
    expect((await getArtworkBySlug('non'))?.visitesAtelier).toBe(false)
    expect((await getArtworkBySlug('vide'))?.visitesAtelier).toBe(false)
  })
})
