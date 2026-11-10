import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 4.8 (FR-27, AD-19, NFR-6) : mesure du tunnel avec consentement. Règles pures, adaptateurs,
// refus (aucun événement ni cookie de mesure), chemins à jeton, administrateurs, compteur des
// choix sur une vraie base. Aucune clé ni adresse réelle : valeurs factices.

const etat = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  entetes: {} as Record<string, string>,
  acteur: { type: 'visiteur' } as { type: string },
  envoyes: [] as Record<string, unknown>[],
  leve: false,
  echecSet: null as string | null,
}))

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (nom: string) => (etat.cookies.has(nom) ? { name: nom, value: etat.cookies.get(nom) } : undefined),
    set: (nom: string, valeur: string) => {
      if (etat.echecSet === nom) throw new Error('cookie impossible')
      etat.cookies.set(nom, valeur)
    },
    delete: (nom: string) => void etat.cookies.delete(nom),
  }),
  headers: () => ({ get: (nom: string) => etat.entetes[nom.toLowerCase()] ?? null }),
}))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => etat.acteur }))
vi.mock('@/lib/mesure/choix', () => ({
  mesureActive: () => ({
    envoyer: async (e: Record<string, unknown>) => {
      if (etat.leve) throw new Error('prestataire en panne')
      etat.envoyes.push(e)
    },
  }),
  choisirMesure: vi.fn(),
}))

const UUID = '3f2c9a4e-8b1d-4c6e-9f0a-1b2c3d4e5f60'
const accepter = () => {
  etat.cookies.set('mesure_choix', 'oui')
  etat.cookies.set('mesure_id', UUID)
  etat.cookies.set('mesure_source', 'instagram')
}

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom)
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin]
  })
}

let base: BaseJetable
let db: Client

// Base jetable pour tout le fichier : le client Prisma lit DATABASE_URL à son premier import (dans les tests).
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

beforeEach(() => {
  etat.cookies.clear()
  etat.entetes = {}
  etat.acteur = { type: 'visiteur' }
  etat.envoyes.length = 0
  etat.leve = false
  etat.echecSet = null
  vi.restoreAllMocks()
})

describe('règles pures', () => {
  it('liste blanche de chemins : fiches, galerie, artistes, conseil, visite ; jamais jeton, tableau de bord, API', async () => {
    const { cheminMesurable } = await import('@/lib/mesure/regles')
    for (const bon of ['/', '/galerie', '/galerie/nuit-blanche', '/galerie/nuit-blanche/visite', '/artistes', '/artistes/karim-benali', '/conseil']) {
      expect(cheminMesurable(bon), bon).toBe(true)
    }
    for (const mauvais of [
      '/auth/invitation/abc123',
      '/auth/invitation',
      '/dashboard',
      '/dashboard/admin/demandes',
      '/dashboard/artiste/oeuvres',
      '/api/mesure',
      '/panier',
      '/galerie/a/b/c',
      '/galerie/Nuit Blanche',
      // Story 4.5 : « Me prévenir » et ses suites ne sont pas mesurées.
      '/galerie/x/prevenir',
      '/auth/desinscription-alerte/abc',
      '/maintenance.html',
      null,
      undefined,
      42,
    ]) {
      expect(cheminMesurable(mauvais), String(mauvais)).toBe(false)
    }
  })

  it('source d’arrivée : utm_source nettoyé, sinon domaine du référent, jamais l’adresse complète', async () => {
    const { sourceArrivee } = await import('@/lib/mesure/regles')
    const hotes = ['www.errancy.art']
    expect(sourceArrivee({ utm: ' Instagram ', hotes })).toBe('instagram')
    expect(sourceArrivee({ utm: '<script>x', referent: 'https://t.co/x', hotes })).toBe('scriptx')
    expect(sourceArrivee({ referent: 'https://www.google.com/search?q=jean.dupont%40exemple.test', hotes })).toBe('google.com')
    expect(sourceArrivee({ referent: 'https://www.errancy.art/galerie', hotes })).toBeNull()
    expect(sourceArrivee({ referent: '', hotes })).toBe('direct')
    expect(sourceArrivee({ referent: 'pas une adresse', hotes })).toBeNull()
  })

  it('choix : lecture du cookie, valeur inconnue = pas de choix', async () => {
    const { lireChoix } = await import('@/lib/mesure/regles')
    expect([lireChoix('oui'), lireChoix('non'), lireChoix('peut-être'), lireChoix(undefined)]).toEqual(['accepte', 'refuse', null, null])
  })

  it('catalogue : sept événements, slug validé, jamais de texte libre', async () => {
    const { NOMS_EVENEMENTS, slugValide, EVENEMENTS_DU_NAVIGATEUR } = await import('@/lib/mesure/catalogue')
    expect([...NOMS_EVENEMENTS]).toEqual(['VueFiche', 'ChoixPays', 'ClicConseil', 'DemandeEnvoyee', 'AjoutPanier', 'DebutCommande', 'CommandeConfirmee'])
    expect(EVENEMENTS_DU_NAVIGATEUR).toEqual(['ClicConseil'])
    expect(slugValide('nuit-blanche')).toBe('nuit-blanche')
    expect(slugValide('jean.dupont@exemple.test')).toBeNull()
    expect(slugValide('Un texte saisi')).toBeNull()
  })
})

describe('adaptateurs', () => {
  const evenement = { nom: 'VueFiche' as const, slug: 'nuit-blanche', source: 'instagram', visiteur: UUID }

  it('journal : le nom de l’événement seulement', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const { adaptateurJournal } = await import('@/lib/mesure/adaptateur-journal')
    await adaptateurJournal.envoyer(evenement)
    expect(JSON.stringify(info.mock.calls)).toContain('VueFiche')
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/nuit-blanche|instagram|3f2c9a4e/)
  })

  it('prestataire : appel HTTP vers l’adresse réglée, sans SDK, charge réduite au slug et à la source', async () => {
    const { creerAdaptateurPrestataire } = await import('@/lib/mesure/adaptateur-prestataire')
    const appel = vi.fn(async () => new Response('{}', { status: 200 }))
    const env = { MESURE_CLE: 'cle-factice', MESURE_ADRESSE: 'https://hebergement.exemple.test/' }
    await creerAdaptateurPrestataire(env, appel as never).envoyer(evenement)
    const [url, init] = appel.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://hebergement.exemple.test/capture/')
    expect(JSON.parse(init.body as string)).toEqual({
      api_key: 'cle-factice',
      event: 'VueFiche',
      distinct_id: UUID,
      properties: { slug: 'nuit-blanche', source: 'instagram', $process_person_profile: false, $lib: 'errancy-serveur' },
    })
  })

  it('prestataire : clé ou adresse absente, refus, panne : aucune erreur levée, rien de personnel journalisé', async () => {
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { creerAdaptateurPrestataire } = await import('@/lib/mesure/adaptateur-prestataire')
    const appel = vi.fn(async () => new Response('', { status: 500 }))
    await creerAdaptateurPrestataire({}, appel as never).envoyer(evenement)
    await creerAdaptateurPrestataire({ MESURE_CLE: 'k', MESURE_ADRESSE: 'http://pas-https.test' }, appel as never).envoyer(evenement)
    expect(appel).not.toHaveBeenCalled()
    const env = { MESURE_CLE: 'cle-factice', MESURE_ADRESSE: 'https://h.exemple.test' }
    await creerAdaptateurPrestataire(env, appel as never).envoyer(evenement)
    await creerAdaptateurPrestataire(env, (async () => { throw new Error('réseau') }) as never).envoyer(evenement)
    expect(erreurs).toHaveBeenCalledTimes(4)
    expect(JSON.stringify(erreurs.mock.calls)).not.toMatch(/cle-factice|nuit-blanche|instagram|3f2c9a4e/)
  })

  it('choix : prestataire en production Vercel seulement, journal partout ailleurs (AD-22)', async () => {
    const { choisirMesure } = await vi.importActual<typeof import('@/lib/mesure/choix')>('@/lib/mesure/choix')
    const { adaptateurJournal } = await import('@/lib/mesure/adaptateur-journal')
    expect(choisirMesure({})).toBe(adaptateurJournal)
    expect(choisirMesure({ VERCEL_ENV: 'preview', MESURE_CLE: 'k', MESURE_ADRESSE: 'https://h.test' })).toBe(adaptateurJournal)
    expect(choisirMesure({ VERCEL_ENV: 'production' })).not.toBe(adaptateurJournal)
  })

  it('le nom du prestataire n’est que dans son adaptateur ; aucun SDK de mesure dans le navigateur', () => {
    const sources = fichiers('src').filter((f) => /\.(ts|tsx)$/.test(f))
    const trouves = sources.filter((f) => path.basename(f) !== 'adaptateur-prestataire.ts').filter((f) => /posthog/i.test(readFileSync(f, 'utf8')))
    expect(trouves).toEqual([])
    expect(readFileSync('src/lib/mesure/adaptateur-prestataire.ts', 'utf8')).toMatch(/posthog/i)
    const paquets = JSON.parse(readFileSync('package.json', 'utf8'))
    expect(Object.keys({ ...paquets.dependencies, ...paquets.devDependencies }).filter((n) => /posthog/i.test(n))).toEqual([])
  })
})

describe('mesurer : consentement, chemins, administrateurs', () => {
  it('aucun choix : aucun événement', async () => {
    const { mesurer } = await import('@/lib/mesure')
    await mesurer({ nom: 'VueFiche', slug: 'nuit-blanche' }, { chemin: '/galerie/nuit-blanche' })
    expect(etat.envoyes).toEqual([])
  })

  it('refus : aucun événement, même avec des cookies de mesure restés sur l’appareil', async () => {
    etat.cookies.set('mesure_choix', 'non')
    etat.cookies.set('mesure_id', UUID)
    const { mesurer, mesurerDepuisAction } = await import('@/lib/mesure')
    await mesurer({ nom: 'VueFiche', slug: 'nuit-blanche' }, { chemin: '/galerie/nuit-blanche' })
    etat.entetes.referer = 'https://www.errancy.art/galerie/nuit-blanche'
    await mesurerDepuisAction({ nom: 'ChoixPays' })
    expect(etat.envoyes).toEqual([])
  })

  it('acceptation : l’événement part avec le slug, la source et l’identifiant du cookie, rien d’autre', async () => {
    accepter()
    const { mesurer } = await import('@/lib/mesure')
    await mesurer({ nom: 'VueFiche', slug: 'nuit-blanche' }, { chemin: '/galerie/nuit-blanche' })
    expect(etat.envoyes).toEqual([{ nom: 'VueFiche', slug: 'nuit-blanche', source: 'instagram', visiteur: UUID }])
  })

  it('sans source gardée : utm de la page, sinon domaine du référent, sinon direct', async () => {
    etat.cookies.set('mesure_choix', 'oui')
    const { mesurer } = await import('@/lib/mesure')
    await mesurer({ nom: 'VueFiche', slug: 'a' }, { chemin: '/galerie/a', utm: 'Newsletter' })
    etat.entetes.referer = 'https://www.google.com/search?q=x'
    await mesurer({ nom: 'VueFiche', slug: 'a' }, { chemin: '/galerie/a' })
    etat.entetes.referer = ''
    await mesurer({ nom: 'VueFiche', slug: 'a' }, { chemin: '/galerie/a' })
    expect(etat.envoyes.map((e) => e.source)).toEqual(['newsletter', 'google.com', 'direct'])
    // Pas d'identifiant dans le cookie : un identifiant aléatoire par événement, jamais vide.
    expect(etat.envoyes.every((e) => typeof e.visiteur === 'string' && (e.visiteur as string).length > 20)).toBe(true)
  })

  it('page à jeton, tableau de bord, API : jamais mesurés, même avec consentement', async () => {
    accepter()
    const { mesurer } = await import('@/lib/mesure')
    for (const chemin of ['/auth/invitation/jeton-secret', '/dashboard/artiste', '/dashboard/admin/demandes', '/api/checkout', null]) {
      await mesurer({ nom: 'VueFiche' }, { chemin })
    }
    expect(etat.envoyes).toEqual([])
  })

  it('administrateur : jamais mesuré, même avec consentement', async () => {
    accepter()
    etat.acteur = { type: 'admin' }
    const { mesurer } = await import('@/lib/mesure')
    await mesurer({ nom: 'VueFiche', slug: 'a' }, { chemin: '/galerie/a' })
    expect(etat.envoyes).toEqual([])
  })

  it('une panne du prestataire ne fait jamais échouer l’action, sans donnée personnelle dans le journal', async () => {
    accepter()
    etat.leve = true
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { mesurer } = await import('@/lib/mesure')
    await expect(mesurer({ nom: 'VueFiche', slug: 'nuit-blanche' }, { chemin: '/galerie/nuit-blanche' })).resolves.toBeUndefined()
    expect(erreurs).toHaveBeenCalled()
    expect(JSON.stringify(erreurs.mock.calls)).not.toMatch(/nuit-blanche|instagram|3f2c9a4e/)
  })

  it('action : la page est celle du référent, le slug vient de la fiche ; un slug donné l’emporte ; page non listée : rien', async () => {
    accepter()
    const { mesurerDepuisAction } = await import('@/lib/mesure')
    etat.entetes.referer = 'https://www.errancy.art/galerie/nuit-blanche?utm_source=x'
    await mesurerDepuisAction({ nom: 'ChoixPays' })
    await mesurerDepuisAction({ nom: 'DemandeEnvoyee', slug: null })
    etat.entetes.referer = 'https://www.errancy.art/galerie/nuit-blanche/visite'
    await mesurerDepuisAction({ nom: 'DemandeEnvoyee', slug: 'nuit-blanche' })
    etat.entetes.referer = 'https://www.errancy.art/dashboard/admin'
    await mesurerDepuisAction({ nom: 'ChoixPays' })
    expect(etat.envoyes.map((e) => [e.nom, e.slug])).toEqual([
      ['ChoixPays', 'nuit-blanche'],
      ['DemandeEnvoyee', null],
      ['DemandeEnvoyee', 'nuit-blanche'],
    ])
  })
})

describe('route /api/mesure et compteur (base réelle)', () => {
  const compteurs = async () =>
    (await db.query(`SELECT choix::text, sum(nombre)::int AS nombre FROM "CompteurChoixMesure" GROUP BY choix ORDER BY choix`)).rows

  // `origine` : null = en-tête absent (refusé) ; par défaut, celle du site.
  const poster = async (corps: unknown, origine: string | null = 'https://www.errancy.art', brut?: string) => {
    const { POST } = await import('@/app/api/mesure/route')
    return POST(
      new Request('https://www.errancy.art/api/mesure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(origine ? { origin: origine } : {}) },
        body: brut ?? JSON.stringify(corps),
      }),
    )
  }

  beforeEach(async () => {
    await db.query('DELETE FROM "CompteurChoixMesure"')
  })

  it('table du compteur : jour, choix, nombre ; aucun identifiant', async () => {
    const colonnes = (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'CompteurChoixMesure' ORDER BY 1`)).rows
    expect(colonnes.map((c) => c.column_name)).toEqual(['choix', 'jour', 'nombre'])
  })

  it('accepter : choix conservé, compteur « accepté » +1, identifiant et source posés', async () => {
    etat.entetes.referer = ''
    const r = await poster({ type: 'consentement', choix: 'accepte', utm: 'Instagram', referent: '' })
    expect(r.status).toBe(200)
    expect(etat.cookies.get('mesure_choix')).toBe('oui')
    expect(etat.cookies.get('mesure_id')).toMatch(/^[0-9a-f-]{36}$/)
    expect(etat.cookies.get('mesure_source')).toBe('instagram')
    expect(await compteurs()).toEqual([{ choix: 'accepte', nombre: 1 }])
  })

  it('refuser : aucun cookie de mesure (supprimés), compteur « refusé » seul, aucun événement envoyé', async () => {
    etat.cookies.set('mesure_id', UUID)
    etat.cookies.set('mesure_source', 'instagram')
    expect((await poster({ type: 'consentement', choix: 'refuse' })).status).toBe(200)
    expect([...etat.cookies.keys()]).toEqual(['mesure_choix'])
    expect(etat.cookies.get('mesure_choix')).toBe('non')
    expect(await compteurs()).toEqual([{ choix: 'refuse', nombre: 1 }])

    // Arrivée et clic Conseil après un refus : ni cookie, ni événement.
    await poster({ type: 'arrivee', utm: 'instagram', referent: 'https://t.co/x' })
    await poster({ type: 'evenement', nom: 'ClicConseil', slug: 'nuit-blanche', chemin: '/galerie/nuit-blanche' })
    expect([...etat.cookies.keys()]).toEqual(['mesure_choix'])
    expect(etat.envoyes).toEqual([])
    expect(await compteurs()).toEqual([{ choix: 'refuse', nombre: 1 }])
  })

  it('retrait après acceptation : cookies de mesure supprimés, compteurs additionnés par choix', async () => {
    await poster({ type: 'consentement', choix: 'accepte' })
    await poster({ type: 'consentement', choix: 'accepte' })
    await poster({ type: 'consentement', choix: 'refuse' })
    expect([...etat.cookies.keys()]).toEqual(['mesure_choix'])
    expect(await compteurs()).toEqual([
      { choix: 'accepte', nombre: 2 },
      { choix: 'refuse', nombre: 1 },
    ])
    expect(Number((await db.query('SELECT count(*) FROM "CompteurChoixMesure"')).rows[0].count)).toBe(2)
  })

  it('compteur en échec : le choix reste appliqué', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(prisma, '$executeRaw').mockRejectedValue(new Error('base indisponible') as never)
    const r = await poster({ type: 'consentement', choix: 'refuse' })
    expect(r.status).toBe(200)
    expect(etat.cookies.get('mesure_choix')).toBe('non')
  })

  it('clic Conseil WhatsApp : événement avec slug et source après consentement ; page à jeton ou slug libre : rien', async () => {
    accepter()
    expect((await poster({ type: 'evenement', nom: 'ClicConseil', slug: 'nuit-blanche', chemin: '/galerie/nuit-blanche' })).status).toBe(200)
    await poster({ type: 'evenement', nom: 'ClicConseil', slug: 'nuit-blanche', chemin: '/auth/invitation/jeton' })
    await poster({ type: 'evenement', nom: 'ClicConseil', slug: 'jean.dupont@exemple.test', chemin: '/' })
    expect(etat.envoyes).toEqual([
      { nom: 'ClicConseil', slug: 'nuit-blanche', source: 'instagram', visiteur: UUID },
      { nom: 'ClicConseil', slug: null, source: 'instagram', visiteur: UUID },
    ])
  })

  it('route : origine absente refusée, slug forgé ignoré (celui de la page est retenu), corps trop gros refusé', async () => {
    accepter()
    expect((await poster({ type: 'consentement', choix: 'refuse' }, null)).status).toBe(403)
    expect(await compteurs()).toEqual([])
    await poster({ type: 'evenement', nom: 'ClicConseil', slug: 'oeuvre-forgee', chemin: '/galerie/vraie-oeuvre' })
    await poster({ type: 'evenement', nom: 'ClicConseil', slug: 'oeuvre-forgee', chemin: '/artistes/karim' })
    expect(etat.envoyes.map((e) => e.slug)).toEqual(['vraie-oeuvre', null])
    const gros = JSON.stringify({ type: 'evenement', nom: 'ClicConseil', chemin: '/', bourrage: 'x'.repeat(5000) })
    expect((await poster(null, 'https://www.errancy.art', gros)).status).toBe(413)
    expect(etat.envoyes).toHaveLength(2)
  })

  it('arrivée impossible à enregistrer : le compteur tourne quand même et le choix reste appliqué', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    etat.echecSet = 'mesure_id'
    const r = await poster({ type: 'consentement', choix: 'accepte' })
    expect(r.status).toBe(200)
    expect(etat.cookies.get('mesure_choix')).toBe('oui')
    expect(await compteurs()).toEqual([{ choix: 'accepte', nombre: 1 }])
  })

  it('compteur : appels simultanés du premier choix du jour, aucun compte perdu', async () => {
    const { compterChoix } = await import('@/lib/mesure/compteur')
    await Promise.all(Array.from({ length: 12 }, (_, i) => compterChoix(i % 3 === 0 ? 'refuse' : 'accepte')))
    expect(await compteurs()).toEqual([
      { choix: 'accepte', nombre: 8 },
      { choix: 'refuse', nombre: 4 },
    ])
    expect(Number((await db.query('SELECT count(*) FROM "CompteurChoixMesure"')).rows[0].count)).toBe(2)
  })

  it('le navigateur ne peut signaler que le clic Conseil ; message ou origine invalide refusés', async () => {
    accepter()
    expect((await poster({ type: 'evenement', nom: 'VueFiche', chemin: '/' })).status).toBe(400)
    expect((await poster({ type: 'inconnu' })).status).toBe(400)
    expect((await poster({ type: 'consentement', choix: 'peut-etre' })).status).toBe(400)
    expect((await poster([1, 2])).status).toBe(400)
    expect((await poster({ type: 'consentement', choix: 'refuse' }, 'https://autre-site.test')).status).toBe(403)
    expect(etat.envoyes).toEqual([])
    expect(await compteurs()).toEqual([])
  })
})
