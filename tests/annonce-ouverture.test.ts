import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 4.9 (FR-35) : annonce de l'ouverture aux contacts de la maintenance. Base réelle, adaptateur
// d'envoi factice : un seul e-mail par contact, adresse supprimée dès l'envoi accepté, échec = adresse
// gardée et relançable sans doublon pour les prévenus, admin seulement, essai à l'admin sans écriture
// dans la liste, désinscription (valide, utilisée, périmée), aucune adresse dans les journaux.

type Envoye = { a: string; sujet: string; texte: string; html: string; cle: string }
const envoi = vi.hoisted(() => ({
  envoyes: [] as { a: string; sujet: string; texte: string; html: string; cle: string }[],
  /** Adresses dont l'envoi échoue (refus du prestataire) ou lève une exception. */
  refus: new Set<string>(),
  leve: new Set<string>(),
}))
const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as unknown }))

vi.mock('@/lib/notifications/choix', () => ({
  envoiActif: () => ({
    envoyer: async (c: Envoye) => {
      if (envoi.leve.has(c.a)) throw new Error(`panne pour ${c.a}`)
      if (envoi.refus.has(c.a)) return { ok: false, code: 'refuse' }
      envoi.envoyes.push(c)
      return { ok: true }
    },
  }),
  choisirEnvoi: vi.fn(),
  envoiReel: () => true,
}))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }), headers: () => new Headers() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  redirect: (url: string) => {
    throw new Error(`redirection:${url}`)
  },
  notFound: () => {
    throw new Error('introuvable')
  },
}))

const ADMIN = { type: 'admin', userId: 'admin-1' }
const ARTISTE = { type: 'artist', userId: 'u-art', artiste: null }
const USER = { type: 'user', userId: 'u-user' }
const VISITEUR = { type: 'visiteur' }
const ADRESSES = ['alice@exemple.test', 'bruno@exemple.test', 'chloe@exemple.test']

/** `annoncerOuverture` sans pause entre les envois (nulle en test). */
async function annoncer() {
  const { annoncerOuverture } = await import('@/lib/notifications')
  return (a: never, o: Record<string, unknown> = {}) => annoncerOuverture(a, { pause: 0, ...o })
}

const texteDe = (noeud: unknown): string =>
  renderToStaticMarkup(noeud as never)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')

describe('base : annonce de l’ouverture', () => {
  let base: BaseJetable
  let db: Client

  const contacts = async () => (await db.query(`SELECT email FROM "InscriptionOuverture" ORDER BY "consentementLe"`)).rows.map((r) => r.email)
  const lienDesinscription = (e: Envoye) => e.texte.match(/https?:\/\/\S+\/auth\/desinscription\/([A-Za-z0-9_-]+)/)?.[1] ?? ''

  beforeAll(async () => {
    vi.doMock('@/lib/acces', async (original) => ({
      ...(await original<typeof import('@/lib/acces')>()),
      acteurCourant: async () => acteur.courant,
    }))
    base = await creerBaseJetable()
    process.env.DATABASE_URL = base.url
    db = new Client({ connectionString: base.url })
    await db.connect()
    await db.query(`INSERT INTO "User" (id, email, name, role, "updatedAt") VALUES ('admin-1', 'equipe@exemple.test', 'Camille', 'admin', now())`)
  })

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$disconnect()
    await db?.end()
    await base?.supprimer()
  })

  beforeEach(async () => {
    acteur.courant = ADMIN
    envoi.envoyes.length = 0
    envoi.refus.clear()
    envoi.leve.clear()
    vi.restoreAllMocks()
    await db.query(`DELETE FROM "InscriptionOuverture"`)
    await db.query(`DELETE FROM "Jeton"`)
    for (const [i, email] of ADRESSES.entries()) {
      await db.query(
        `INSERT INTO "InscriptionOuverture" (id, email, "consentementLe") VALUES ($1, $2, $3::timestamptz)`,
        [`c${i + 1}`, email, `2026-11-0${i + 1}T10:00:00Z`],
      )
    }
  })

  it('la migration ajoute l’usage « desinscription » à l’énumération des jetons', async () => {
    const { rows } = await db.query(`SELECT unnest(enum_range(NULL::"UsageJeton"))::text AS v`)
    expect(rows.map((r) => r.v)).toContain('desinscription')
  })

  it('accès : visiteur, user et artiste sont refusés par le module, rien n’est lu ni envoyé', async () => {
    const { envoyerEssaiOuverture } = await import('@/lib/notifications')
    const annoncerOuverture = await annoncer()
    const { contactsAPrevenir, nombreContactsAPrevenir } = await import('@/lib/demandes')
    for (const a of [VISITEUR, USER, ARTISTE]) {
      expect(await contactsAPrevenir(a as never)).toEqual({ ok: false, code: 'acces_refuse' })
      expect(await nombreContactsAPrevenir(a as never)).toEqual({ ok: false, code: 'acces_refuse' })
      expect(await annoncerOuverture(a as never)).toEqual({ ok: false, code: 'acces_refuse' })
      expect(await envoyerEssaiOuverture(a as never)).toEqual({ ok: false, code: 'acces_refuse' })
    }
    expect(envoi.envoyes).toHaveLength(0)
    expect(await contacts()).toEqual(ADRESSES)
  })

  it('actions serveur et page : refusées hors admin, nombre affiché pour l’admin sans rien envoyer', async () => {
    const { actionAnnoncerOuverture, actionEssaiOuverture } = await import('@/app/dashboard/admin/ouverture/actions')
    const { default: Page } = await import('@/app/dashboard/admin/ouverture/page')
    for (const a of [VISITEUR, USER, ARTISTE]) {
      acteur.courant = a
      expect(await actionAnnoncerOuverture(3)).toMatchObject({ ok: false })
      expect(await actionEssaiOuverture()).toMatchObject({ ok: false })
      await expect(Page()).rejects.toThrow('redirection:/dashboard')
    }
    expect(envoi.envoyes).toHaveLength(0)
    acteur.courant = ADMIN
    const texte = texteDe(await Page())
    expect(texte).toContain('3 contacts à prévenir')
    expect(texte).toContain('Annoncer l’ouverture')
    expect(envoi.envoyes).toHaveLength(0)
  })

  it('aucun contact : « Aucun contact à prévenir. » et l’annonce ne part pas', async () => {
    const annoncerOuverture = await annoncer()
    await db.query(`DELETE FROM "InscriptionOuverture"`)
    expect(await annoncerOuverture(ADMIN as never)).toEqual({ ok: true, bilan: { prevenus: 0, echecs: 0, restants: 0, aSupprimer: 0, arretEchecs: false } })
    expect(envoi.envoyes).toHaveLength(0)
    const { fr } = await import('@/lib/i18n')
    expect(fr.ouverture.vide).toBe('Aucun contact à prévenir.')
  })

  it('annonce : un e-mail par contact, adresse supprimée, bilan ; un second déclenchement n’écrit à personne', async () => {
    const annoncerOuverture = await annoncer()
    const r = await annoncerOuverture(ADMIN as never)
    expect(r).toEqual({ ok: true, bilan: { prevenus: 3, echecs: 0, restants: 0, aSupprimer: 0, arretEchecs: false } })
    expect(envoi.envoyes.map((e) => e.a).sort()).toEqual(ADRESSES)
    expect(new Set(envoi.envoyes.map((e) => e.cle)).size).toBe(3)
    expect(await contacts()).toEqual([])
    for (const e of envoi.envoyes) {
      expect(e.sujet).toBe('Errancy ouvre ses portes')
      expect(e.texte).toContain('Bonjour,')
      expect(e.texte).toContain('Nous supprimons votre adresse de notre liste')
      expect(e.texte).not.toContain('vient d’être supprimée')
      expect(e.texte).toMatch(/https?:\/\/[^\s/]+\/(\s|$)/)
      expect(lienDesinscription(e)).toHaveLength(43)
      expect(e.html).toContain('/auth/desinscription/')
      expect(e.texte.trimEnd().endsWith('Une question ? Écrivez-nous à contact@errancy.art')).toBe(true)
      expect(e.texte).not.toMatch(/\btu\b|\bton\b|\bta\b/i)
    }
    const encore = await annoncerOuverture(ADMIN as never)
    expect(encore).toEqual({ ok: true, bilan: { prevenus: 0, echecs: 0, restants: 0, aSupprimer: 0, arretEchecs: false } })
    expect(envoi.envoyes).toHaveLength(3)
  })

  it('échec : le contact garde son adresse, les suivants partent, la relance n’écrit qu’aux échecs', async () => {
    const annoncerOuverture = await annoncer()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    envoi.refus.add('alice@exemple.test')
    envoi.leve.add('bruno@exemple.test')
    const premier = await annoncerOuverture(ADMIN as never)
    expect(premier).toEqual({ ok: true, bilan: { prevenus: 1, echecs: 2, restants: 2, aSupprimer: 0, arretEchecs: false } })
    expect(envoi.envoyes.map((e) => e.a)).toEqual(['chloe@exemple.test'])
    expect(await contacts()).toEqual(['alice@exemple.test', 'bruno@exemple.test'])
    // Les liens émis pour les échecs sont révoqués : aucun e-mail n'est parti avec.
    const { rows } = await db.query(`SELECT cible, "revoqueLe" FROM "Jeton" WHERE usage = 'desinscription' ORDER BY cible`)
    expect(rows.filter((r) => r.cible !== 'c3').every((r) => r.revoqueLe)).toBe(true)

    envoi.refus.clear()
    envoi.leve.clear()
    const second = await annoncerOuverture(ADMIN as never)
    expect(second).toEqual({ ok: true, bilan: { prevenus: 2, echecs: 0, restants: 0, aSupprimer: 0, arretEchecs: false } })
    const destinataires = envoi.envoyes.map((e) => e.a)
    expect(destinataires.sort()).toEqual(ADRESSES)
    expect(destinataires.filter((a) => a === 'chloe@exemple.test')).toHaveLength(1)
    expect(await contacts()).toEqual([])
  })

  it('envoi borné en durée : les contacts non atteints restent à prévenir', async () => {
    const annoncerOuverture = await annoncer()
    const { DUREE_MAX_ANNONCE_SECONDES } = await import('@/lib/reglages')
    let t = 0
    // Chaque lecture de l'horloge avance de la moitié de la limite : un seul contact tient dans le temps.
    const horloge = () => (t += (DUREE_MAX_ANNONCE_SECONDES * 1000) / 2 + 1)
    const r = await annoncerOuverture(ADMIN as never, { maintenant: horloge })
    expect(r.ok && r.bilan.prevenus).toBeLessThan(3)
    expect(r.ok && r.bilan.restants).toBe(3 - (r.ok ? r.bilan.prevenus : 0))
    expect(await contacts()).toHaveLength(r.ok ? r.bilan.restants : -1)
  })

  it('deux annonces simultanées n’écrivent qu’une fois à chaque contact', async () => {
    const annoncerOuverture = await annoncer()
    await Promise.all([annoncerOuverture(ADMIN as never), annoncerOuverture(ADMIN as never)])
    expect(envoi.envoyes.map((e) => e.a).sort()).toEqual(ADRESSES)
    expect(await contacts()).toEqual([])
  })

  it('action serveur : bilan renvoyé à la page', async () => {
    const { actionAnnoncerOuverture } = await import('@/app/dashboard/admin/ouverture/actions')
    expect(await actionAnnoncerOuverture(3)).toEqual({ ok: true, bilan: { prevenus: 3, echecs: 0, restants: 0, aSupprimer: 0, arretEchecs: false } })
  })

  it('essai : même e-mail à l’adresse de l’admin seulement, liste et jetons intacts, lien factice', async () => {
    const { envoyerEssaiOuverture } = await import('@/lib/notifications')
    expect(await envoyerEssaiOuverture(ADMIN as never)).toEqual({ ok: true, reel: true })
    expect(envoi.envoyes).toHaveLength(1)
    const [e] = envoi.envoyes
    expect(e.a).toBe('equipe@exemple.test')
    expect(e.sujet).toBe('Errancy ouvre ses portes')
    expect(await contacts()).toEqual(ADRESSES)
    expect((await db.query(`SELECT count(*)::int AS n FROM "Jeton"`)).rows[0].n).toBe(0)
    expect(lienDesinscription(e)).toBe('essai')
    const { desinscrire } = await import('@/lib/demandes')
    expect(await desinscrire('essai')).toBe(false)
    expect(await contacts()).toEqual(ADRESSES)
  })

  it('essai : adresse absente ou envoi refusé = message, rien d’écrit', async () => {
    const { envoyerEssaiOuverture } = await import('@/lib/notifications')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    envoi.refus.add('equipe@exemple.test')
    expect(await envoyerEssaiOuverture(ADMIN as never)).toEqual({ ok: false, code: 'envoi_echoue' })
    expect(await envoyerEssaiOuverture({ type: 'admin', userId: 'inconnu' } as never)).toEqual({ ok: false, code: 'adresse_absente' })
    expect(await contacts()).toEqual(ADRESSES)
  })

  it('désinscription : lien valide retire le contact ; réutilisé, inconnu ou périmé : message neutre', async () => {
    const { preparerDesinscription, desinscrire } = await import('@/lib/demandes')
    const { default: Page } = await import('@/app/auth/desinscription/[jeton]/page')
    const jeton = await preparerDesinscription('c1')
    expect(jeton).toHaveLength(43)
    const confirmee = texteDe(await Page({ params: { jeton: jeton! } }))
    expect(confirmee).toContain('Errancy ne conserve plus votre adresse e-mail')
    expect(await contacts()).toEqual(['bruno@exemple.test', 'chloe@exemple.test'])

    const neutre = texteDe(await Page({ params: { jeton: jeton! } }))
    expect(neutre).toContain('déjà été utilisé ou n’est plus valable')
    expect(neutre).not.toMatch(/erreur|exception|prisma/i)
    expect(texteDe(await Page({ params: { jeton: 'x'.repeat(43) } }))).toContain('n’est plus valable')

    const autre = await preparerDesinscription('c2')
    await db.query(`UPDATE "Jeton" SET echeance = now() - interval '1 minute' WHERE usage = 'desinscription' AND cible = 'c2'`)
    expect(await desinscrire(autre!)).toBe(false)
    expect(await contacts()).toEqual(['bruno@exemple.test', 'chloe@exemple.test'])
  })

  it('désinscription après l’envoi : l’adresse est déjà supprimée, le lien reste valable une fois', async () => {
    const annoncerOuverture = await annoncer()
    const { desinscrire } = await import('@/lib/demandes')
    await annoncerOuverture(ADMIN as never)
    const jeton = lienDesinscription(envoi.envoyes[0])
    expect(await desinscrire(jeton)).toBe(true)
    expect(await desinscrire(jeton)).toBe(false)
    // Le jeton n'ouvre aucun autre usage (invitation) : lecture sous un autre usage impossible.
    const { rows } = await db.query(`SELECT usage::text FROM "Jeton" LIMIT 1`)
    expect(rows[0].usage).toBe('desinscription')
  })

  it('un contact désinscrit pendant l’envoi n’est ni prévenu ni compté en échec', async () => {
    const annoncerOuverture = await annoncer()
    await db.query(`DELETE FROM "InscriptionOuverture" WHERE id = 'c2'`)
    const r = await annoncerOuverture(ADMIN as never)
    expect(r).toEqual({ ok: true, bilan: { prevenus: 2, echecs: 0, restants: 0, aSupprimer: 0, arretEchecs: false } })
    expect(envoi.envoyes.map((e) => e.a)).not.toContain('bruno@exemple.test')
  })

  it('journaux : jamais d’adresse ni de lien de désinscription', async () => {
    const { envoyerEssaiOuverture } = await import('@/lib/notifications')
    const annoncerOuverture = await annoncer()
    const { desinscrire } = await import('@/lib/demandes')
    const traces = [vi.spyOn(console, 'info'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'log')].map((s) =>
      s.mockImplementation(() => {}),
    )
    envoi.refus.add('alice@exemple.test')
    envoi.leve.add('bruno@exemple.test')
    envoi.refus.add('equipe@exemple.test')
    await annoncerOuverture(ADMIN as never)
    await envoyerEssaiOuverture(ADMIN as never)
    await desinscrire('x'.repeat(43))
    const sortie = JSON.stringify(traces.flatMap((s) => s.mock.calls))
    expect(sortie).not.toMatch(/@exemple\.test/)
    expect(sortie).not.toContain('desinscription/')
    expect(sortie.length).toBeGreaterThan(10)
  })

  it('suppression en échec après envoi accepté : prévenu, lien conservé, adresse signalée, trois tentatives', async () => {
    const annoncerOuverture = await annoncer()
    const { prisma } = await import('@/lib/prisma')
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reel = prisma.inscriptionOuverture.deleteMany.bind(prisma.inscriptionOuverture)
    const suppression = vi.spyOn(prisma.inscriptionOuverture, 'deleteMany').mockImplementation(((args: { where?: { id?: string } }) =>
      args?.where?.id === 'c1' ? Promise.reject(new Error('panne')) : reel(args as never)) as never)
    const r = await annoncerOuverture(ADMIN as never)
    const appels = [...suppression.mock.calls]
    suppression.mockRestore()
    expect(r).toEqual({ ok: true, bilan: { prevenus: 3, echecs: 0, restants: 1, aSupprimer: 1, arretEchecs: false } })
    expect(appels.filter(([a]) => (a as { where: { id: string } }).where.id === 'c1')).toHaveLength(3)
    expect(await contacts()).toEqual(['alice@exemple.test'])
    // Le lien de l'e-mail parti reste valable.
    const { rows } = await db.query(`SELECT "revoqueLe" FROM "Jeton" WHERE cible = 'c1'`)
    expect(rows[0].revoqueLe).toBeNull()
    expect(JSON.stringify(erreurs.mock.calls)).not.toMatch(/@exemple\.test/)
  })

  it('nombre confirmé : seuls les plus anciens sont traités, restants = compte réel', async () => {
    const annoncerOuverture = await annoncer()
    for (const i of [4, 5]) {
      await db.query(`INSERT INTO "InscriptionOuverture" (id, email, "consentementLe") VALUES ($1, $2, $3::timestamptz)`, [`c${i}`, `contact${i}@exemple.test`, `2026-11-0${i}T10:00:00Z`])
    }
    const pendant = async () => {
      await db.query(`INSERT INTO "InscriptionOuverture" (id, email, "consentementLe") VALUES ('c6', 'contact6@exemple.test', '2026-11-09T10:00:00Z')`)
    }
    await pendant()
    const r = await annoncerOuverture(ADMIN as never, { max: 3 })
    expect(r).toEqual({ ok: true, bilan: { prevenus: 3, echecs: 0, restants: 3, aSupprimer: 0, arretEchecs: false } })
    expect(envoi.envoyes.map((e) => e.a).sort()).toEqual(ADRESSES)
    const { actionAnnoncerOuverture } = await import('@/app/dashboard/admin/ouverture/actions')
    for (const mauvais of [0, -1, 1.5, Number.NaN]) {
      expect(await actionAnnoncerOuverture(mauvais)).toMatchObject({ ok: false })
    }
    expect(envoi.envoyes).toHaveLength(3)
  })

  it('série d’échecs : arrêt après 5 échecs consécutifs, le bilan le dit, les autres restent', async () => {
    const annoncerOuverture = await annoncer()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    for (let i = 4; i <= 8; i++) {
      await db.query(`INSERT INTO "InscriptionOuverture" (id, email, "consentementLe") VALUES ($1, $2, $3::timestamptz)`, [`c${i}`, `contact${i}@exemple.test`, `2026-11-0${i}T10:00:00Z`])
    }
    for (const a of await contacts()) envoi.refus.add(a)
    const r = await annoncerOuverture(ADMIN as never)
    expect(r).toEqual({ ok: true, bilan: { prevenus: 0, echecs: 5, restants: 8, aSupprimer: 0, arretEchecs: true } })
    expect(envoi.envoyes).toHaveLength(0)
  })

  it('un succès remet la série à zéro ; sans série à la fin, pas d’arrêt', async () => {
    const annoncerOuverture = await annoncer()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    envoi.refus.add('alice@exemple.test')
    envoi.refus.add('chloe@exemple.test')
    const r = await annoncerOuverture(ADMIN as never)
    expect(r.ok && r.bilan.arretEchecs).toBe(false)
  })

  it('pause entre deux envois : appliquée entre les contacts, pas avant le premier', async () => {
    const { annoncerOuverture } = await import('@/lib/notifications')
    const debut = Date.now()
    await annoncerOuverture(ADMIN as never, { pause: 120 })
    const duree = Date.now() - debut
    expect(duree).toBeGreaterThanOrEqual(230)
    const { PAUSE_ENTRE_ENVOIS_MS, ECHECS_CONSECUTIFS_MAX, DUREE_MAX_ANNONCE_SECONDES } = await import('@/lib/reglages')
    expect([PAUSE_ENTRE_ENVOIS_MS, ECHECS_CONSECUTIFS_MAX, DUREE_MAX_ANNONCE_SECONDES]).toEqual([600, 5, 40])
  })

  it('le bilan écrit dit quoi faire : restants à relancer, adresses à retirer, arrêt', async () => {
    const { fr } = await import('@/lib/i18n')
    expect(fr.ouverture.bilan.relancer).toContain('contacts restants')
    expect(fr.ouverture.bilan.aSupprimer(2)).toContain('ne relancez pas')
    expect(fr.ouverture.bilan.arret).toBe('L’envoi s’est arrêté après plusieurs échecs de suite.')
  })

  it('désinscription : panne de la base = message distinct, lien non consommé', async () => {
    const { preparerDesinscription, desinscrire } = await import('@/lib/demandes')
    const { default: Page } = await import('@/app/auth/desinscription/[jeton]/page')
    const { prisma } = await import('@/lib/prisma')
    const jeton = await preparerDesinscription('c1')
    const panne = vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('base indisponible'))
    const texte = texteDe(await Page({ params: { jeton: jeton! } }))
    panne.mockRestore()
    expect(texte).toContain('Nous n’avons pas pu traiter votre demande. Réessayez dans quelques minutes.')
    expect(texte).not.toContain('déjà été utilisé')
    expect(await desinscrire(jeton!)).toBe(true)
  })

  it('la maintenance et robots.txt ne changent pas', async () => {
    const annoncerOuverture = await annoncer()
    const { maintenanceActive } = await import('@/lib/reglages')
    const robots = readFileSync('public/robots.txt', 'utf8')
    const avant = { variable: process.env.MAINTENANCE_MODE, active: maintenanceActive() }
    await annoncerOuverture(ADMIN as never)
    expect(process.env.MAINTENANCE_MODE).toBe(avant.variable)
    expect(maintenanceActive()).toBe(avant.active)
    expect(readFileSync('public/robots.txt', 'utf8')).toBe(robots)
  })
})

describe('annonce : contenu et code', () => {
  it('next.config pose Referrer-Policy: no-referrer sur la désinscription et sur l’invitation', async () => {
    const { default: config } = await import('../next.config.mjs')
    const regles = await config.headers!()
    for (const source of ['/auth/desinscription/:path*', '/auth/invitation/:path*']) {
      const regle = regles.find((r: { source: string }) => r.source === source)
      expect(regle?.headers).toContainEqual({ key: 'Referrer-Policy', value: 'no-referrer' })
    }
  })

  it('l’e-mail n’invente ni date, ni prix, ni nombre d’œuvres', async () => {
    const { contenuOuverture } = await import('@/lib/notifications/contenus')
    const c = contenuOuverture({ lien: 'https://www.errancy.art/', lienDesinscription: 'https://www.errancy.art/auth/desinscription/abc' })
    expect(c.texte).not.toMatch(/\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i)
    expect(c.texte).not.toMatch(/€|\boeuvres? sélectionnées?\b/i)
    expect(c.texte).not.toMatch(/\d+\s+œuvres/)
    expect(c.html).toContain('href="https://www.errancy.art/auth/desinscription/abc"')
  })
})
