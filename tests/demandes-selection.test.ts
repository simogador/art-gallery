import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 4.2 (FR-8, UX-DR44) : demande de sélection personnalisée. Règles pures, enregistrement à
// l'état `nouvelle`, accusé au visiteur et alerte à l'équipe (un e-mail chacun, même rejoué), limites
// d'envoi par IP et par e-mail, double appui, jamais de donnée personnelle dans les journaux.

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

const VALIDE = {
  espace: 'Un salon de 25 m², mur blanc de 3 m face à la fenêtre.',
  ambiances: ['calme', 'lumineuse'],
  precision: 'Plutôt des tons chauds.',
  budget: '1 500 €',
  email: ' Claire.Martin@Exemple.TEST ',
  telephone: '+33 6 12 34 56 78',
}

describe('règles pures', () => {
  it('une saisie correcte est normalisée (e-mail, budget en centimes, ambiances dans l’ordre de la liste)', async () => {
    const { validerSelection } = await import('@/lib/demandes/selection-regles')
    const r = validerSelection({ ...VALIDE, ambiances: ['lumineuse', 'calme', 'calme'] })
    expect(r).toEqual({
      ok: true,
      valeur: {
        espace: VALIDE.espace,
        ambiances: ['calme', 'lumineuse'],
        precision: 'Plutôt des tons chauds.',
        budgetCentimes: 150_000,
        email: 'claire.martin@exemple.test',
        telephone: '+33 6 12 34 56 78',
      },
    })
    // Téléphone et précision facultatifs.
    const minimal = validerSelection({ ...VALIDE, telephone: '', precision: '  ' })
    expect(minimal.ok && minimal.valeur).toMatchObject({ telephone: null, precision: null })
  })

  it('chaque champ fautif a son message en français', async () => {
    const { validerSelection } = await import('@/lib/demandes/selection-regles')
    const { fr } = await import('@/lib/i18n')
    const r = validerSelection({ espace: ' ', ambiances: [], precision: 'x'.repeat(1001), budget: 'beaucoup', email: 'pas-un-email', telephone: 'abc' })
    expect(r).toEqual({
      ok: false,
      erreurs: {
        espace: fr.conseil.erreurs.espaceVide,
        ambiances: fr.conseil.erreurs.ambiancesVides,
        precision: fr.conseil.erreurs.precisionLongue,
        budget: fr.conseil.erreurs.budgetInvalide,
        email: fr.conseil.erreurs.emailInvalide,
        telephone: fr.conseil.erreurs.telephoneInvalide,
      },
    })
  })

  it('budget : nul, négatif, décimal, énorme ou ambiance inconnue refusés ; corps quelconque sans exception', async () => {
    const { validerSelection, lireBudgetEuros } = await import('@/lib/demandes/selection-regles')
    for (const b of ['0', '-5', '12,5', '1e3', '2000000', '9999999999']) {
      expect(validerSelection({ ...VALIDE, budget: b }).ok).toBe(false)
    }
    expect(lireBudgetEuros('1500')).toBe(1500)
    expect(lireBudgetEuros(' 1 500 € ')).toBe(1500)
    expect(validerSelection({ ...VALIDE, ambiances: ['calme', 'inventee'] }).ok).toBe(false)
    for (const corps of [null, undefined, 42, 'texte', [], { ambiances: 'calme', espace: 3 }]) {
      expect(validerSelection(corps).ok).toBe(false)
    }
  })
})

describe('base : demandes de sélection', () => {
  let base: BaseJetable
  let db: Client

  const compter = async (table: string) => Number((await db.query(`SELECT count(*) FROM "${table}"`)).rows[0].count)

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
    for (const table of ['Evenement', 'DemandeSelection', 'TentativeInscription']) await db.query(`DELETE FROM "${table}"`)
  })

  afterEach(() => vi.restoreAllMocks())

  it('envoi valide : demande « nouvelle », un accusé avec le délai et une alerte à l’équipe sans donnée personnelle', async () => {
    const { envoyerDemandeSelection } = await import('@/app/conseil/actions')
    expect(await envoyerDemandeSelection(VALIDE)).toEqual({ ok: true })
    const lignes = (await db.query('SELECT * FROM "DemandeSelection"')).rows
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({
      etat: 'nouvelle',
      email: 'claire.martin@exemple.test',
      budgetCentimes: 150_000,
      ambiances: ['calme', 'lumineuse'],
      telephone: '+33 6 12 34 56 78',
    })

    expect(envoi.envoyes).toHaveLength(2)
    const accuse = envoi.envoyes.find((c) => c.a === 'claire.martin@exemple.test')!
    expect(accuse.sujet).toBe('Nous avons bien reçu votre demande')
    expect(accuse.texte).toContain('Nous vous répondons sous 48 heures.')
    expect(accuse.texte.trimEnd().endsWith('Une question ? Écrivez-nous à contact@errancy.art')).toBe(true)
    const alerte = envoi.envoyes.find((c) => c.a === 'contact@errancy.art')!
    expect(alerte.texte).toContain(lignes[0].id)
    expect(alerte.texte).toContain('https://www.errancy.art/dashboard/admin')
    expect(alerte.texte + alerte.html + alerte.sujet).not.toMatch(/exemple\.test|Claire|6 12 34|salon|1500|calme/i)
  })

  it('l’événement ne porte que l’id de la demande', async () => {
    const { enregistrerDemandeSelection } = await import('@/lib/demandes')
    await enregistrerDemandeSelection(VALIDE, '203.0.113.7')
    const lignes = (await db.query('SELECT nom, charge FROM "Evenement"')).rows
    expect(lignes).toEqual([{ nom: 'DemandeSelectionRecue', charge: { demandeId: expect.any(String) } }])
    expect(JSON.stringify(lignes)).not.toMatch(/exemple\.test|Claire|salon/)
  })

  it('champs fautifs : messages par champ, rien d’enregistré ni compté, aucun e-mail', async () => {
    const { envoyerDemandeSelection } = await import('@/app/conseil/actions')
    const r = await envoyerDemandeSelection({ ...VALIDE, email: 'nope', budget: '' })
    expect(r).toMatchObject({ ok: false, code: 'invalide', erreurs: { email: expect.any(String), budget: expect.any(String) } })
    expect(await compter('DemandeSelection')).toBe(0)
    expect(await compter('TentativeInscription')).toBe(0)
    expect(await compter('Evenement')).toBe(0)
    expect(envoi.envoyes).toHaveLength(0)
  })

  it('double appui (deux envois simultanés identiques) : une seule demande et deux e-mails seulement', async () => {
    const { envoyerDemandeSelection } = await import('@/app/conseil/actions')
    const [a, b] = await Promise.all([envoyerDemandeSelection(VALIDE), envoyerDemandeSelection(VALIDE)])
    expect(a).toEqual({ ok: true })
    expect(b).toEqual({ ok: true })
    expect(await compter('DemandeSelection')).toBe(1)
    expect(await compter('Evenement')).toBe(1)
    expect(envoi.envoyes).toHaveLength(2)
  })

  it('une demande corrigée (autres ambiances, téléphone) n’est pas absorbée comme un doublon', async () => {
    const { envoyerDemandeSelection } = await import('@/app/conseil/actions')
    await envoyerDemandeSelection(VALIDE)
    await envoyerDemandeSelection({ ...VALIDE, ambiances: ['intense'], telephone: '' })
    expect(await compter('DemandeSelection')).toBe(2)
  })

  it('caractère nul, téléphone démesuré, tableau d’ambiances énorme : refus propres, jamais d’erreur de base', async () => {
    const { envoyerDemandeSelection } = await import('@/app/conseil/actions')
    expect(await envoyerDemandeSelection({ ...VALIDE, espace: 'Un salon\u0000 lumineux', precision: 'a\u0000b' })).toEqual({ ok: true })
    const ligne = (await db.query('SELECT espace, precision FROM "DemandeSelection"')).rows[0]
    expect(ligne).toEqual({ espace: 'Un salon lumineux', precision: 'ab' })
    expect(await envoyerDemandeSelection({ ...VALIDE, telephone: '1'.repeat(41), email: 'b@exemple.test' })).toMatchObject({ ok: false, code: 'invalide' })
    expect(await envoyerDemandeSelection({ ...VALIDE, ambiances: Array(5000).fill('calme'), email: 'c@exemple.test' })).toMatchObject({ ok: false, code: 'invalide' })
    expect(await compter('DemandeSelection')).toBe(1)
  })

  it('la purge des traces ne touche pas celles du formulaire de maintenance', async () => {
    const { envoyerDemandeSelection } = await import('@/app/conseil/actions')
    await db.query(`INSERT INTO "TentativeInscription" (id, cle, "createdAt") VALUES ('ancienne', 'ip:abc', now() - interval '3 hours')`)
    await envoyerDemandeSelection(VALIDE)
    expect(Number((await db.query(`SELECT count(*) FROM "TentativeInscription" WHERE id = 'ancienne'`)).rows[0].count)).toBe(1)
  })

  it('une demande différente du même e-mail est une autre demande', async () => {
    const { envoyerDemandeSelection } = await import('@/app/conseil/actions')
    await envoyerDemandeSelection(VALIDE)
    await envoyerDemandeSelection({ ...VALIDE, budget: '3000' })
    expect(await compter('DemandeSelection')).toBe(2)
  })

  it('événement rejoué : un seul accusé et une seule alerte', async () => {
    const { enregistrerDemandeSelection } = await import('@/lib/demandes')
    const { repartir } = await import('@/lib/evenements')
    await enregistrerDemandeSelection(VALIDE, '203.0.113.7')
    expect(envoi.envoyes).toHaveLength(2)
    const ids = (await db.query('SELECT id FROM "Evenement"')).rows.map((l) => l.id as string)
    await Promise.all([repartir(ids), repartir(ids)])
    await repartir(ids)
    expect(envoi.envoyes).toHaveLength(2)
    expect(await compter('TraitementEvenement')).toBe(2)
  })

  it('anti-abus par IP : au-delà du seuil, refus sans message technique, rien d’enregistré', async () => {
    const { envoyerDemandeSelection } = await import('@/app/conseil/actions')
    const { LIMITES_DEMANDE_SELECTION } = await import('@/lib/reglages')
    for (let i = 0; i < LIMITES_DEMANDE_SELECTION.parIp; i++) {
      expect(await envoyerDemandeSelection({ ...VALIDE, email: `visiteur${i}@exemple.test` })).toEqual({ ok: true })
    }
    expect(await envoyerDemandeSelection({ ...VALIDE, email: 'autre@exemple.test' })).toEqual({ ok: false, code: 'trop_de_demandes' })
    expect(await compter('DemandeSelection')).toBe(LIMITES_DEMANDE_SELECTION.parIp)
    // Une autre adresse IP n'est pas touchée.
    entetes.ip = '198.51.100.9'
    expect(await envoyerDemandeSelection({ ...VALIDE, email: 'autre@exemple.test' })).toEqual({ ok: true })
  })

  it('anti-abus par e-mail : le même e-mail depuis plusieurs IP est limité', async () => {
    const { envoyerDemandeSelection } = await import('@/app/conseil/actions')
    const { LIMITES_DEMANDE_SELECTION } = await import('@/lib/reglages')
    for (let i = 0; i < LIMITES_DEMANDE_SELECTION.parEmail; i++) {
      entetes.ip = `198.51.100.${i + 1}`
      expect(await envoyerDemandeSelection({ ...VALIDE, budget: String(1000 + i) })).toEqual({ ok: true })
    }
    entetes.ip = '198.51.100.99'
    expect(await envoyerDemandeSelection({ ...VALIDE, budget: '5000' })).toEqual({ ok: false, code: 'trop_de_demandes' })
  })

  it('limites : seules des empreintes salées sont gardées, ni IP ni e-mail en clair', async () => {
    const { envoyerDemandeSelection } = await import('@/app/conseil/actions')
    await envoyerDemandeSelection(VALIDE)
    const cles = (await db.query('SELECT cle FROM "TentativeInscription"')).rows.map((l) => l.cle as string)
    expect(cles).toHaveLength(2)
    expect(cles.every((c) => /^conseil-(ip|email):[0-9a-f]{64}$/.test(c))).toBe(true)
    expect(JSON.stringify(cles)).not.toMatch(/203\.0\.113|exemple/)
  })

  it('e-mail refusé par le prestataire : la demande reste enregistrée et confirmée, journal sans donnée personnelle', async () => {
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { envoyerDemandeSelection } = await import('@/app/conseil/actions')
    envoi.resultat = { ok: false, code: 'indisponible' }
    expect(await envoyerDemandeSelection(VALIDE)).toEqual({ ok: true })
    expect(await compter('DemandeSelection')).toBe(1)
    const journal = JSON.stringify(erreurs.mock.calls)
    expect(journal).toContain('accusé de demande non envoyé')
    expect(journal).not.toMatch(/exemple\.test|Claire|203\.0\.113|salon/)
  })

  it('panne de la base : réponse « indisponible », sans détail ni donnée personnelle dans les journaux', async () => {
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
    const demandes = await import('@/lib/demandes')
    vi.spyOn(demandes, 'enregistrerDemandeSelection').mockRejectedValueOnce(new Error('connexion perdue pour claire@exemple.test'))
    const { envoyerDemandeSelection } = await import('@/app/conseil/actions')
    expect(await envoyerDemandeSelection(VALIDE)).toEqual({ ok: false, code: 'indisponible' })
    expect(JSON.stringify(erreurs.mock.calls)).not.toContain('exemple.test')
  })
})
