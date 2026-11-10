import { renderToStaticMarkup } from 'react-dom/server'
import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '@/lib/i18n'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 4.5 (FR-9) : « Me prévenir » sur une œuvre réservée. Base réelle ; aucune œuvre n'est réservée
// avant l'Epic 6 : l'état `reservee` est posé directement en base de test. Inscription, ordre calculé,
// doublon, anti-abus, événement (création seulement), confirmation avec lien de désinscription,
// désinscription, suppression à la sortie de la vente, section de l'équipe, pages.

type Envoye = { a: string; sujet: string; texte: string; html: string; cle: string }
const envoi = vi.hoisted(() => ({
  envoyes: [] as { a: string; sujet: string; texte: string; html: string; cle: string }[],
  resultat: { ok: true } as { ok: true } | { ok: false; code: 'refuse' | 'indisponible' | 'non_configure' },
}))
const entetes = vi.hoisted(() => ({ ip: '203.0.113.7' as string | null }))
const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as { type: string; userId?: string } }))

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
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

const ADMIN = { type: 'admin', userId: 'admin-1' }
const ARTISTE = { type: 'artist', userId: 'u-art', artiste: null }
const USER = { type: 'user', userId: 'u-user' }
const VISITEUR = { type: 'visiteur' }

const texteDe = (noeud: unknown): string =>
  renderToStaticMarkup(noeud as never)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')

const EMAIL = ' Claire.Martin@Exemple.TEST '
const NORMALISE = 'claire.martin@exemple.test'

describe('règles pures', () => {
  it('e-mail normalisé, invalide refusé, corps quelconque sans exception', async () => {
    const { validerPrevenir, rangParmi } = await import('@/lib/demandes/prevenir-regles')
    expect(validerPrevenir({ email: EMAIL })).toEqual({ ok: true, valeur: { email: NORMALISE } })
    for (const corps of [null, undefined, 42, 'x', [], { email: 3 }, { email: 'nope' }, { email: '' }]) {
      expect(validerPrevenir(corps)).toEqual({ ok: false, erreurs: { email: fr.prevenir.erreurs.emailInvalide } })
    }
    // Rang : le plus ancien d'abord, départage par id.
    const t = new Date('2026-11-01T10:00:00Z')
    const l = [
      { id: 'c', createdAt: t },
      { id: 'a', createdAt: new Date(t.getTime() + 5) },
      { id: 'b', createdAt: t },
    ]
    expect([rangParmi('b', l), rangParmi('c', l), rangParmi('a', l), rangParmi('zzz', l)]).toEqual([1, 2, 3, 0])
  })
})

describe('base : « Me prévenir »', () => {
  let base: BaseJetable
  let db: Client
  const compter = async (table: string) => Number((await db.query(`SELECT count(*) FROM "${table}"`)).rows[0].count)
  const emails = async (slug = 'nuit-bleue') =>
    (await db.query(`SELECT email FROM "InscriptionPrevenir" WHERE "artworkId" = $1 ORDER BY "createdAt", id`, [slug])).rows.map((r) => r.email as string)
  const lienDesinscription = (e: Envoye) => e.texte.match(/https?:\/\/\S+\/auth\/desinscription-alerte\/([A-Za-z0-9_-]+)/)?.[1] ?? ''

  async function oeuvre(slug: string, options: { publication?: string; dispo?: string; artiste?: string } = {}) {
    const { publication = 'publiee', dispo = 'reservee', artiste = 'art-p' } = options
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", devise, "hauteurMm", "largeurMm",
         publication, disponibilite, "artistId", "updatedAt")
       VALUES ($1, $1, $2, 2024, 'Huile', 'D', 'https://res.cloudinary.com/x/p.jpg', 250000, 'EUR', 610, 760,
         $3::"Publication", $4::"Disponibilite", $5, now())`,
      [slug, `Titre ${slug}`, publication, dispo, artiste],
    )
  }
  const etat = (slug: string, dispo: string) => db.query(`UPDATE "Artwork" SET disponibilite = $2::"Disponibilite" WHERE slug = $1`, [slug, dispo])

  beforeAll(async () => {
    vi.doMock('@/lib/acces', async (original) => ({
      ...(await original<typeof import('@/lib/acces')>()),
      acteurCourant: async () => acteur.courant,
    }))
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
    acteur.courant = VISITEUR
    for (const table of ['Evenement', 'Jeton', 'InscriptionPrevenir', 'TentativeInscription', 'Artwork', 'Artist', 'User']) await db.query(`DELETE FROM "${table}"`)
    await db.query(`INSERT INTO "User" (id, email, name, role, "updatedAt") VALUES ('u-p', 'artiste.prive@atelier.test', 'Nadia Benali', 'artist', now())`)
    await db.query(`INSERT INTO "User" (id, email, name, role, "updatedAt") VALUES ('admin-1', 'equipe@exemple.test', 'Camille', 'admin', now())`)
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", website, "accordSigneLe", "userId", "updatedAt")
       VALUES ('art-p', 'art-p', 'Nadia Benali', 'MA', 1980, 'Bio', '', 'https://atelier-prive.test', now(), 'u-p', now())`,
    )
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt")
       VALUES ('art-sans-accord', 'art-sans-accord', 'Sans Accord', 'MA', 1980, 'Bio', '', now())`,
    )
  })

  afterEach(() => vi.restoreAllMocks())

  it('la migration ajoute l’usage « desinscription_alerte » et la table, appliquées par la base jetable', async () => {
    const usages = (await db.query(`SELECT unnest(enum_range(NULL::"UsageJeton"))::text AS v`)).rows.map((r) => r.v)
    expect(usages).toContain('desinscription_alerte')
    expect((await db.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'InscriptionPrevenir'`)).rows[0].n).toBe(1)
  })

  it('inscription : enregistrée (e-mail normalisé), événement avec id seulement, un e-mail de confirmation avec lien de désinscription', async () => {
    await oeuvre('nuit-bleue')
    const { envoyerInscriptionPrevenir } = await import('@/app/galerie/[id]/prevenir/actions')
    expect(await envoyerInscriptionPrevenir('nuit-bleue', { email: EMAIL })).toEqual({ ok: true })
    expect(await emails()).toEqual([NORMALISE])

    const evenements = (await db.query('SELECT nom, charge FROM "Evenement"')).rows
    expect(evenements).toEqual([{ nom: 'InscriptionPrevenirRecue', charge: { inscriptionId: expect.any(String) } }])
    expect(JSON.stringify(evenements)).not.toMatch(/exemple\.test|Claire|nuit-bleue/)

    expect(envoi.envoyes).toHaveLength(1)
    const mail = envoi.envoyes[0]
    expect(mail.a).toBe(NORMALISE)
    expect(mail.sujet).toBe('Nous vous prévenons pour « Titre nuit-bleue »')
    expect(mail.texte).toContain('« Titre nuit-bleue »')
    expect(mail.texte).toContain('Nous vous écrirons si elle redevient disponible.')
    expect(mail.texte).toMatch(/https:\/\/www\.errancy\.art\/auth\/desinscription-alerte\/[A-Za-z0-9_-]{43}/)
    expect(mail.html).toContain('/auth/desinscription-alerte/')
    expect(mail.texte.trimEnd().endsWith('Une question ? Écrivez-nous à contact@errancy.art')).toBe(true)
    // Jamais d'heure de fin de réservation, ni de coordonnées de l'artiste, ni de promesse de priorité.
    expect(mail.texte + mail.html).not.toMatch(/jusqu|expire|\d h \d\d|priorit|atelier|Nadia|Benali/i)
    const jeton = (await db.query(`SELECT usage::text, cible FROM "Jeton"`)).rows
    const inscription = (await db.query('SELECT id FROM "InscriptionPrevenir"')).rows[0].id
    expect(jeton).toEqual([{ usage: 'desinscription_alerte', cible: inscription }])
  })

  it('doublon : aucun doublon, place inchangée, même résultat, ni nouvel événement ni nouvel e-mail', async () => {
    await oeuvre('nuit-bleue')
    const { envoyerInscriptionPrevenir } = await import('@/app/galerie/[id]/prevenir/actions')
    const { rangInscriptionPrevenir } = await import('@/lib/demandes')
    await envoyerInscriptionPrevenir('nuit-bleue', { email: 'a@exemple.test' })
    await envoyerInscriptionPrevenir('nuit-bleue', { email: 'b@exemple.test' })
    const avant = (await db.query(`SELECT id, "createdAt" FROM "InscriptionPrevenir" WHERE email = 'a@exemple.test'`)).rows[0]
    expect(await rangInscriptionPrevenir(avant.id)).toBe(1)
    envoi.envoyes.length = 0
    expect(await envoyerInscriptionPrevenir('nuit-bleue', { email: ' A@Exemple.test ' })).toEqual({ ok: true })
    expect(await emails()).toEqual(['a@exemple.test', 'b@exemple.test'])
    const apres = (await db.query(`SELECT id, "createdAt" FROM "InscriptionPrevenir" WHERE email = 'a@exemple.test'`)).rows[0]
    expect(apres).toEqual(avant)
    expect(await rangInscriptionPrevenir(avant.id)).toBe(1)
    expect(await compter('Evenement')).toBe(2)
    expect(envoi.envoyes).toHaveLength(0)
  })

  it('double appui simultané : une seule inscription, un seul événement, un seul e-mail', async () => {
    await oeuvre('nuit-bleue')
    const { envoyerInscriptionPrevenir } = await import('@/app/galerie/[id]/prevenir/actions')
    const r = await Promise.all([1, 2, 3].map(() => envoyerInscriptionPrevenir('nuit-bleue', { email: EMAIL })))
    expect(r).toEqual([{ ok: true }, { ok: true }, { ok: true }])
    expect(await compter('InscriptionPrevenir')).toBe(1)
    expect(await compter('Evenement')).toBe(1)
    expect(envoi.envoyes).toHaveLength(1)
  })

  it('ordre d’arrivée calculé : le plus ancien d’abord, départage par id, les suivants avancent quand un inscrit se retire', async () => {
    await oeuvre('nuit-bleue')
    const { rangInscriptionPrevenir } = await import('@/lib/demandes')
    await db.query(
      `INSERT INTO "InscriptionPrevenir" (id, "artworkId", email, "createdAt") VALUES
         ('i3', 'nuit-bleue', 'c@exemple.test', '2026-11-03T10:00:00Z'),
         ('i2b', 'nuit-bleue', 'b2@exemple.test', '2026-11-02T10:00:00Z'),
         ('i2a', 'nuit-bleue', 'b1@exemple.test', '2026-11-02T10:00:00Z'),
         ('i1', 'nuit-bleue', 'a@exemple.test', '2026-11-01T10:00:00Z')`,
    )
    expect(await Promise.all(['i1', 'i2a', 'i2b', 'i3'].map(rangInscriptionPrevenir))).toEqual([1, 2, 3, 4])
    await db.query(`DELETE FROM "InscriptionPrevenir" WHERE id = 'i1'`)
    expect(await Promise.all(['i2a', 'i2b', 'i3'].map(rangInscriptionPrevenir))).toEqual([1, 2, 3])
    expect(await rangInscriptionPrevenir('inconnue')).toBeNull()
  })

  it('œuvre non réservée (disponible, vendue, retirée, ailleurs, brouillon, en curation, sans accord, inconnue) : refus, rien d’enregistré ni compté', async () => {
    await oeuvre('dispo', { dispo: 'disponible' })
    await oeuvre('vendue', { dispo: 'vendue' })
    await oeuvre('retiree', { dispo: 'retiree' })
    await oeuvre('ailleurs', { dispo: 'vendue_ailleurs' })
    await oeuvre('brouillon', { publication: 'brouillon' })
    await oeuvre('curation', { publication: 'en_curation' })
    await oeuvre('sans-accord', { artiste: 'art-sans-accord' })
    const { envoyerInscriptionPrevenir } = await import('@/app/galerie/[id]/prevenir/actions')
    for (const slug of ['dispo', 'vendue', 'retiree', 'ailleurs', 'brouillon', 'curation', 'sans-accord', 'inconnue']) {
      expect(await envoyerInscriptionPrevenir(slug, { email: EMAIL }), slug).toEqual({ ok: false, code: 'oeuvre_indisponible' })
    }
    expect(await compter('InscriptionPrevenir')).toBe(0)
    expect(await compter('TentativeInscription')).toBe(0)
    expect(await compter('Evenement')).toBe(0)
    expect(envoi.envoyes).toHaveLength(0)
  })

  it('e-mail invalide : message par champ, rien enregistré, compté ni envoyé', async () => {
    await oeuvre('nuit-bleue')
    const { envoyerInscriptionPrevenir } = await import('@/app/galerie/[id]/prevenir/actions')
    expect(await envoyerInscriptionPrevenir('nuit-bleue', { email: 'nope' })).toEqual({
      ok: false,
      code: 'invalide',
      erreurs: { email: fr.prevenir.erreurs.emailInvalide },
    })
    expect(await compter('InscriptionPrevenir')).toBe(0)
    expect(await compter('TentativeInscription')).toBe(0)
    expect(await compter('Evenement')).toBe(0)
    expect(envoi.envoyes).toHaveLength(0)
  })

  it('anti-abus par IP puis par e-mail : refus sans message technique, empreintes salées', async () => {
    await oeuvre('nuit-bleue')
    const { envoyerInscriptionPrevenir } = await import('@/app/galerie/[id]/prevenir/actions')
    const { LIMITES_INSCRIPTION_PREVENIR: L } = await import('@/lib/reglages')
    for (let i = 0; i < L.parIp; i++) expect(await envoyerInscriptionPrevenir('nuit-bleue', { email: `p${i}@exemple.test` })).toEqual({ ok: true })
    expect(await envoyerInscriptionPrevenir('nuit-bleue', { email: 'autre@exemple.test' })).toEqual({ ok: false, code: 'trop_de_demandes' })
    expect(await compter('InscriptionPrevenir')).toBe(L.parIp)

    await db.query('DELETE FROM "TentativeInscription"')
    for (let i = 0; i < L.parEmail; i++) {
      entetes.ip = `198.51.100.${i + 1}`
      expect(await envoyerInscriptionPrevenir('nuit-bleue', { email: EMAIL })).toEqual({ ok: true })
    }
    entetes.ip = '198.51.100.99'
    expect(await envoyerInscriptionPrevenir('nuit-bleue', { email: EMAIL })).toEqual({ ok: false, code: 'trop_de_demandes' })
    const cles = (await db.query('SELECT cle FROM "TentativeInscription"')).rows.map((l) => l.cle as string)
    expect(cles.every((c) => /^prevenir-(ip|email):[0-9a-f]{64}$/.test(c))).toBe(true)
    expect(JSON.stringify(cles)).not.toMatch(/198\.51|203\.0|exemple/)
  })

  it('e-mail refusé par le prestataire : l’inscription reste, le lien est révoqué, journal d’ids sans adresse', async () => {
    await oeuvre('nuit-bleue')
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { envoyerInscriptionPrevenir } = await import('@/app/galerie/[id]/prevenir/actions')
    envoi.resultat = { ok: false, code: 'indisponible' }
    expect(await envoyerInscriptionPrevenir('nuit-bleue', { email: EMAIL })).toEqual({ ok: true })
    expect(await emails()).toEqual([NORMALISE])
    expect((await db.query(`SELECT "revoqueLe" FROM "Jeton"`)).rows[0].revoqueLe).not.toBeNull()
    const journal = JSON.stringify(erreurs.mock.calls)
    expect(journal).toContain('confirmation « Me prévenir » non envoyée')
    expect(journal).not.toMatch(/exemple\.test|Claire|203\.0\.113/)
  })

  it('événement rejoué : un seul e-mail de confirmation', async () => {
    await oeuvre('nuit-bleue')
    const { enregistrerInscriptionPrevenir } = await import('@/lib/demandes')
    const { repartir } = await import('@/lib/evenements')
    await enregistrerInscriptionPrevenir({ email: EMAIL }, { ip: '203.0.113.7', slug: 'nuit-bleue' })
    const ids = (await db.query('SELECT id FROM "Evenement"')).rows.map((l) => l.id as string)
    await Promise.all([repartir(ids), repartir(ids)])
    expect(envoi.envoyes).toHaveLength(1)
    expect(await compter('TraitementEvenement')).toBe(1)
  })

  it('panne de la base : « indisponible » sans détail ni donnée personnelle dans les journaux', async () => {
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
    const demandes = await import('@/lib/demandes')
    vi.spyOn(demandes, 'enregistrerInscriptionPrevenir').mockRejectedValueOnce(new Error('connexion perdue pour claire@exemple.test'))
    const { envoyerInscriptionPrevenir } = await import('@/app/galerie/[id]/prevenir/actions')
    expect(await envoyerInscriptionPrevenir('nuit-bleue', { email: EMAIL })).toEqual({ ok: false, code: 'indisponible' })
    expect(JSON.stringify(erreurs.mock.calls)).not.toContain('exemple.test')
  })

  describe('désinscription', () => {
    async function inscrire(slug = 'nuit-bleue', email = EMAIL) {
      await oeuvre(slug)
      const { enregistrerInscriptionPrevenir } = await import('@/lib/demandes')
      await enregistrerInscriptionPrevenir({ email }, { ip: null, slug })
      return lienDesinscription(envoi.envoyes[envoi.envoyes.length - 1])
    }

    it('lien valide : inscription retirée et page de confirmation ; réutilisé, inconnu ou mal formé : message neutre', async () => {
      const jeton = await inscrire()
      expect(jeton).toHaveLength(43)
      const { default: Page } = await import('@/app/auth/desinscription-alerte/[jeton]/page')
      expect(texteDe(await Page({ params: { jeton } }))).toContain('nous ne vous écrirons plus au sujet de cette œuvre')
      expect(await emails()).toEqual([])
      const neutre = texteDe(await Page({ params: { jeton } }))
      expect(neutre).toContain('déjà été utilisé ou n’est plus valable')
      expect(neutre).not.toMatch(/erreur|exception|prisma/i)
      expect(texteDe(await Page({ params: { jeton: 'x'.repeat(43) } }))).toContain('n’est plus valable')
      expect(texteDe(await Page({ params: { jeton: 'court' } }))).toContain('n’est plus valable')
    })

    it('lien périmé : inscription gardée ; l’usage du jeton ne sert pas ailleurs', async () => {
      const jeton = await inscrire()
      await db.query(`UPDATE "Jeton" SET echeance = now() - interval '1 minute'`)
      const { desinscrirePrevenir, desinscrire } = await import('@/lib/demandes')
      expect(await desinscrirePrevenir(jeton)).toBe(false)
      expect(await emails()).toEqual([NORMALISE])
      // Un jeton d'un autre usage (maintenance) n'ouvre pas cette désinscription, et inversement.
      const { preparerDesinscription } = await import('@/lib/demandes')
      await db.query(`INSERT INTO "InscriptionOuverture" (id, email, "consentementLe") VALUES ('c1', 'z@exemple.test', now())`)
      const autre = await preparerDesinscription('c1')
      expect(await desinscrirePrevenir(autre!)).toBe(false)
      await db.query(`UPDATE "Jeton" SET echeance = now() + interval '1 day' WHERE usage = 'desinscription_alerte'`)
      expect(await desinscrire(jeton)).toBe(false)
      expect(await desinscrirePrevenir(jeton)).toBe(true)
    })

    it('valeur mal formée : aucune transaction ouverte', async () => {
      const { prisma } = await import('@/lib/prisma')
      const tx = vi.spyOn(prisma, '$transaction')
      const { desinscrirePrevenir } = await import('@/lib/demandes')
      expect(await desinscrirePrevenir('trop court')).toBe(false)
      expect(await desinscrirePrevenir('é'.repeat(43))).toBe(false)
      expect(tx).not.toHaveBeenCalled()
    })

    it('panne de la base : message distinct, jamais le jeton dans les journaux', async () => {
      const jeton = await inscrire()
      const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
      const demandes = await import('@/lib/demandes')
      vi.spyOn(demandes, 'desinscrirePrevenir').mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'P1001' }))
      const { default: Page } = await import('@/app/auth/desinscription-alerte/[jeton]/page')
      expect(texteDe(await Page({ params: { jeton } }))).toContain(fr.desinscriptionAlerte.indisponible)
      expect(JSON.stringify(erreurs.mock.calls)).not.toContain(jeton)
    })

    it('en-tête de référent : next.config et metadata de la page', async () => {
      const { default: config } = await import('../next.config.mjs')
      const regles = await config.headers!()
      const regle = regles.find((r: { source: string }) => r.source === '/auth/desinscription-alerte/:path*')
      expect(regle?.headers).toContainEqual({ key: 'Referrer-Policy', value: 'no-referrer' })
      const { metadata } = await import('@/app/auth/desinscription-alerte/[jeton]/page')
      expect(metadata.referrer).toBe('no-referrer')
      expect(metadata.robots).toEqual({ index: false, follow: false })
    })
  })

  describe('suppression à la sortie de la vente', () => {
    async function avecInscrits(slug: string) {
      await oeuvre(slug)
      await db.query(
        `INSERT INTO "InscriptionPrevenir" (id, "artworkId", email) VALUES ('i-${slug}-1', $1, 'a@exemple.test'), ('i-${slug}-2', $1, 'b@exemple.test')`,
        [slug],
      )
    }
    async function declarer(slug: string, dispo: string) {
      await etat(slug, dispo)
      const { ecrireEvenement, repartirApresValidation } = await import('@/lib/evenements')
      const { prisma } = await import('@/lib/prisma')
      const id = await prisma.$transaction((tx) => ecrireEvenement(tx, { nom: 'DisponibiliteChangee', charge: { artworkId: slug, artistId: 'art-p' } }))
      await repartirApresValidation([id])
    }

    it.each(['vendue', 'vendue_ailleurs', 'retiree'])('passage à %s : inscriptions supprimées, aucun e-mail', async (dispo) => {
      await avecInscrits('a')
      await avecInscrits('autre')
      const infos = vi.spyOn(console, 'info').mockImplementation(() => {})
      await declarer('a', dispo)
      expect(await emails('a')).toEqual([])
      expect(await emails('autre')).toEqual(['a@exemple.test', 'b@exemple.test'])
      expect(envoi.envoyes).toHaveLength(0)
      expect(JSON.stringify(infos.mock.calls)).not.toContain('exemple.test')
    })

    it.each(['reservee', 'disponible'])('état %s : rien n’est supprimé', async (dispo) => {
      await avecInscrits('a')
      await declarer('a', dispo)
      expect(await emails('a')).toEqual(['a@exemple.test', 'b@exemple.test'])
      expect(envoi.envoyes).toHaveLength(0)
    })

    it('rejouable : un second passage sans inscription ne lève rien ; l’état est relu en base, pas porté par l’événement', async () => {
      await avecInscrits('a')
      const { retirerInscriptionsPrevenirSiSortie } = await import('@/lib/demandes')
      await etat('a', 'vendue')
      expect(await retirerInscriptionsPrevenirSiSortie('a')).toBe(2)
      expect(await retirerInscriptionsPrevenirSiSortie('a')).toBe(0)
      expect(await retirerInscriptionsPrevenirSiSortie('inconnue')).toBe(0)
    })

    it('œuvre supprimée : inscriptions supprimées avec elle (cascade)', async () => {
      await avecInscrits('a')
      await db.query(`DELETE FROM "Artwork" WHERE slug = 'a'`)
      expect(await compter('InscriptionPrevenir')).toBe(0)
    })
  })

  describe('section de l’équipe', () => {
    async function remplir() {
      await oeuvre('nuit-bleue')
      await oeuvre('aube')
      await db.query(
        `INSERT INTO "InscriptionPrevenir" (id, "artworkId", email, "createdAt") VALUES
           ('i1', 'nuit-bleue', 'premier@exemple.test', '2026-11-01T10:00:00Z'),
           ('i2', 'aube', 'unique@exemple.test', '2026-11-02T10:00:00Z'),
           ('i3', 'nuit-bleue', 'second@exemple.test', '2026-11-03T10:00:00Z')`,
      )
    }

    it('module : l’admin voit les œuvres, le nombre et l’ordre ; visiteur, user et artiste sont refusés', async () => {
      await remplir()
      const { inscriptionsParOeuvre } = await import('@/lib/demandes')
      for (const a of [VISITEUR, USER, ARTISTE]) expect(await inscriptionsParOeuvre(a as never), a.type).toEqual({ ok: false, code: 'acces_refuse' })
      const r = await inscriptionsParOeuvre(ADMIN as never)
      expect(r).toMatchObject({ ok: true })
      if (!r.ok) return
      expect(r.oeuvres.map((o) => [o.titre, o.nombre])).toEqual([
        ['Titre nuit-bleue', 2],
        ['Titre aube', 1],
      ])
      expect(r.oeuvres[0].inscrits.map((i) => [i.rang, i.email])).toEqual([
        [1, 'premier@exemple.test'],
        [2, 'second@exemple.test'],
      ])
    })

    it('page : redirection pour les non-admins ; l’admin voit la section, état vide propre', async () => {
      const { default: Page } = await import('@/app/dashboard/admin/demandes/page')
      for (const a of [VISITEUR, USER, ARTISTE]) {
        acteur.courant = a
        await expect(Page({}), a.type).rejects.toThrow('redirection:/dashboard')
      }
      acteur.courant = ADMIN
      expect(texteDe(await Page({}))).toContain(fr.demandes.prevenir.vide)
      await remplir()
      const texte = texteDe(await Page({}))
      expect(texte).toContain('Me prévenir')
      expect(texte).toContain('2 inscrits')
      expect(texte).toContain('1 inscrit')
      expect(texte).toContain('N° 1 · premier@exemple.test')
      expect(texte.indexOf('premier@exemple.test')).toBeLessThan(texte.indexOf('second@exemple.test'))
      expect(texte).not.toMatch(/supprimer|retirer/i)
    })
  })

  describe('robustesse', () => {
    it('section de l’équipe : une lecture en échec n’emporte pas la file des demandes ; journal sans adresse', async () => {
      await oeuvre('nuit-bleue')
      await db.query(`INSERT INTO "InscriptionPrevenir" (id, "artworkId", email) VALUES ('i1', 'nuit-bleue', 'secret@exemple.test')`)
      const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { prisma } = await import('@/lib/prisma')
      vi.spyOn(prisma.inscriptionPrevenir, 'findMany').mockRejectedValueOnce(Object.assign(new Error('boom secret@exemple.test'), { code: 'P1001' }))
      const { inscriptionsParOeuvre } = await import('@/lib/demandes')
      expect(await inscriptionsParOeuvre(ADMIN as never)).toEqual({ ok: false, code: 'inscriptions_indisponibles' })
      expect(JSON.stringify(erreurs.mock.calls)).not.toContain('exemple.test')
      expect(JSON.stringify(erreurs.mock.calls)).toContain('inscriptions_indisponibles')

      vi.spyOn(prisma.inscriptionPrevenir, 'findMany').mockRejectedValueOnce(new Error('boom'))
      acteur.courant = ADMIN
      const { default: Page } = await import('@/app/dashboard/admin/demandes/page')
      const texte = texteDe(await Page({}))
      expect(texte).toContain(fr.demandes.prevenir.indisponible)
      expect(texte).toContain(fr.demandes.vide)
      expect(texte).not.toContain('exemple.test')
    })

    it('course : une vente validée pendant l’inscription (verrou partagé) la fait refuser, sans inscription ni e-mail', async () => {
      await oeuvre('nuit-bleue')
      const vente = new Client({ connectionString: base.url })
      await vente.connect()
      try {
        await vente.query('BEGIN')
        await vente.query(`UPDATE "Artwork" SET disponibilite = 'vendue' WHERE id = 'nuit-bleue'`)
        const { enregistrerInscriptionPrevenir } = await import('@/lib/demandes')
        const promesse = enregistrerInscriptionPrevenir({ email: EMAIL }, { ip: null, slug: 'nuit-bleue' })
        // L'inscription voit encore « réservée » (vente non validée) puis attend le verrou de la ligne.
        await new Promise((r) => setTimeout(r, 400))
        await vente.query('COMMIT')
        expect(await promesse).toEqual({ ok: false, code: 'oeuvre_indisponible' })
      } finally {
        await vente.end()
      }
      expect(await compter('InscriptionPrevenir')).toBe(0)
      expect(await compter('Evenement')).toBe(0)
      expect(envoi.envoyes).toHaveLength(0)
    })

    it('vente réelle (vendue ailleurs, retirée, marquerVendues) : les inscriptions sont supprimées de bout en bout', async () => {
      const artiste = { type: 'artist', userId: 'u-p', artiste: { id: 'art-p', slug: 'art-p', name: 'Nadia Benali' } }
      const { declarerDisponibilite, marquerVendues } = await import('@/lib/disponibilite')
      const { enregistrerInscriptionPrevenir } = await import('@/lib/demandes')
      for (const slug of ['a', 'b', 'c', 'garde']) {
        await oeuvre(slug)
        await enregistrerInscriptionPrevenir({ email: `x-${slug}@exemple.test` }, { ip: null, slug })
      }
      envoi.envoyes.length = 0
      expect(await declarerDisponibilite(artiste as never, 'a', 'vendue_ailleurs')).toMatchObject({ ok: true })
      expect(await declarerDisponibilite(artiste as never, 'b', 'retiree')).toMatchObject({ ok: true })
      expect(await marquerVendues(['c'])).toBe(1)
      expect(await emails('a')).toEqual([])
      expect(await emails('b')).toEqual([])
      expect(await emails('c')).toEqual([])
      expect(await emails('garde')).toEqual(['x-garde@exemple.test'])
      expect(envoi.envoyes).toHaveLength(0)
    })

    it('gestionnaire de suppression en échec : l’action de vente réussit, journal d’ids sans adresse', async () => {
      const artiste = { type: 'artist', userId: 'u-p', artiste: { id: 'art-p', slug: 'art-p', name: 'Nadia Benali' } }
      await oeuvre('a')
      await db.query(`INSERT INTO "InscriptionPrevenir" (id, "artworkId", email) VALUES ('i1', 'a', 'secret@exemple.test')`)
      const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
      const demandes = await import('@/lib/demandes')
      vi.spyOn(demandes, 'retirerInscriptionsPrevenirSiSortie').mockRejectedValueOnce(new Error('panne pour secret@exemple.test'))
      const { declarerDisponibilite } = await import('@/lib/disponibilite')
      expect(await declarerDisponibilite(artiste as never, 'a', 'vendue_ailleurs')).toMatchObject({ ok: true })
      const journal = JSON.stringify(erreurs.mock.calls)
      expect(journal).toContain('retirerInscriptionsPrevenir')
      expect(journal).toContain('a')
      expect(journal).not.toContain('exemple.test')
      // Rejouable : la suppression se fait au prochain passage.
      expect(await demandes.retirerInscriptionsPrevenirSiSortie('a')).toBe(1)
    })
  })

  describe('pages', () => {
    it('/galerie/[id]/prevenir : 404 hors œuvre visible réservée ; sinon le formulaire pour l’œuvre', async () => {
      await oeuvre('reservee')
      await oeuvre('dispo', { dispo: 'disponible' })
      await oeuvre('vendue', { dispo: 'vendue' })
      await oeuvre('retiree', { dispo: 'retiree' })
      await oeuvre('brouillon', { publication: 'brouillon' })
      await oeuvre('sans-accord', { artiste: 'art-sans-accord' })
      const { default: Page, generateMetadata } = await import('@/app/galerie/[id]/prevenir/page')
      for (const id of ['dispo', 'vendue', 'retiree', 'brouillon', 'sans-accord', 'inconnue']) {
        await expect(Page({ params: { id } }), id).rejects.toThrow('introuvable')
      }
      const page = await Page({ params: { id: 'reservee' } })
      const html = renderToStaticMarkup(page as never)
      expect(html).toContain('Me prévenir')
      expect(html).toContain('Titre reservee')
      expect(html).toContain('prevenir-email')
      expect(html).not.toMatch(/jusqu|expire|priorit/i)
      expect(await generateMetadata({ params: { id: 'reservee' } })).toMatchObject({ robots: { index: false, follow: false } })
    })

    it('hors production : l’adaptateur « journal » est choisi, sans envoi réel', async () => {
      const { choisirEnvoi } = await vi.importActual<typeof import('@/lib/notifications/choix')>('@/lib/notifications/choix')
      const { adaptateurJournal } = await import('@/lib/notifications/adaptateur-journal')
      expect(choisirEnvoi({})).toBe(adaptateurJournal)
      expect(choisirEnvoi({ VERCEL_ENV: 'preview' })).toBe(adaptateurJournal)
    })
  })
})
