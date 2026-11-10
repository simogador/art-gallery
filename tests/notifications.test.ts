import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 4.1 (FR-34, FR-25, AD-11, AQ-1, UX-DR44) : e-mails transactionnels. Port d'envoi, adaptateur
// du prestataire, adaptateur « journal » hors production, trois événements (invitation émise, œuvre
// validée, œuvre renvoyée), un seul e-mail par événement, jamais d'adresse dans les journaux.

type Envoye = { a: string; sujet: string; texte: string; html: string; cle: string }
const envoi = vi.hoisted(() => ({
  envoyes: [] as { a: string; sujet: string; texte: string; html: string; cle: string }[],
  resultat: { ok: true } as { ok: true } | { ok: false; code: 'refuse' | 'indisponible' | 'non_configure' },
  leve: false,
}))

vi.mock('@/lib/notifications/choix', () => ({
  envoiActif: () => ({
    envoyer: async (c: Envoye) => {
      if (envoi.leve) throw new Error(`panne pour ${c.a}`)
      envoi.envoyes.push(c)
      return envoi.resultat
    },
  }),
  choisirEnvoi: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }), headers: () => new Headers() }))

const ADMIN = { type: 'admin', userId: 'admin-1' }
const ADRESSE_ARTISTE = 'karim.benali@exemple.test'
const COMMENTAIRE = 'La photo du dos est floue : merci de la reprendre à la lumière du jour.'

const fichiers = (dossier: string): string[] =>
  readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom)
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(ts|tsx)$/.test(nom) ? [chemin] : []
  })

describe('contenus des e-mails (purs)', () => {
  it('chaque e-mail vouvoie, porte son lien et se termine par l’adresse de l’équipe', async () => {
    const { contenuInvitation, contenuOeuvreValidee, contenuOeuvreRenvoyee } = await import('@/lib/notifications/contenus')
    const lien = 'https://www.errancy.art/x'
    const contenus = [
      contenuInvitation({ artiste: 'Karim Benali', lien, echeance: new Date('2026-11-17T10:00:00Z') }),
      contenuOeuvreValidee({ artiste: 'Karim Benali', titre: 'Nuit', lien }),
      contenuOeuvreRenvoyee({ artiste: 'Karim Benali', titre: 'Nuit', commentaire: COMMENTAIRE, lien }),
    ]
    for (const c of contenus) {
      expect(c.texte).toContain('Bonjour Karim Benali,')
      expect(c.texte).toContain(lien)
      expect(c.html).toContain(`href="${lien}"`)
      expect(c.texte.trimEnd().endsWith('Une question ? Écrivez-nous à contact@errancy.art')).toBe(true)
      expect(c.html).toContain('Une question ? Écrivez-nous à contact@errancy.art')
      expect(c.texte).not.toMatch(/\btu\b|\bton\b|\bta\b/i)
    }
    expect(contenus[0].texte).toContain('Créer mon accès')
    expect(contenus[0].texte).toContain('7 jours')
    expect(contenus[2].texte).toContain(COMMENTAIRE)
  })

  it('le commentaire de l’équipe est échappé dans la version HTML', async () => {
    const { contenuOeuvreRenvoyee } = await import('@/lib/notifications/contenus')
    const c = contenuOeuvreRenvoyee({ artiste: 'A', titre: '<b>T</b>', commentaire: '<script>alert(1)</script> & "x"', lien: 'https://www.errancy.art/x' })
    expect(c.html).not.toContain('<script>')
    expect(c.html).toContain('&lt;script&gt;')
    expect(c.html).toContain('&amp;')
  })
})

describe('adaptateurs et choix par environnement', () => {
  afterEach(() => vi.restoreAllMocks())

  it('hors production, l’adaptateur « journal » n’envoie rien et n’écrit que la clé, sans adresse', async () => {
    const { adaptateurJournal } = await import('@/lib/notifications/adaptateur-journal')
    const infos = vi.spyOn(console, 'info').mockImplementation(() => {})
    const appel = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    const r = await adaptateurJournal.envoyer({
      a: ADRESSE_ARTISTE,
      sujet: 'Sujet secret',
      texte: 'https://www.errancy.art/auth/invitation/jeton-secret',
      html: '<p>x</p>',
      cle: 'evt-1:envoyerInvitation',
    })
    expect(r).toEqual({ ok: true })
    expect(appel).not.toHaveBeenCalled()
    const journal = JSON.stringify(infos.mock.calls)
    expect(journal).toContain('evt-1:envoyerInvitation')
    expect(journal).not.toMatch(/exemple\.test|jeton-secret|Sujet secret/)
  })

  it('le prestataire n’est choisi qu’en production Vercel', async () => {
    const { choisirEnvoi } = await vi.importActual<typeof import('@/lib/notifications/choix')>('@/lib/notifications/choix')
    const { adaptateurJournal } = await import('@/lib/notifications/adaptateur-journal')
    expect(choisirEnvoi({})).toBe(adaptateurJournal)
    expect(choisirEnvoi({ VERCEL_ENV: 'preview', RESEND_API_KEY: 'cle' })).toBe(adaptateurJournal)
    expect(choisirEnvoi({ VERCEL_ENV: 'development', RESEND_API_KEY: 'cle' })).toBe(adaptateurJournal)
    expect(choisirEnvoi({ VERCEL_ENV: 'production', RESEND_API_KEY: 'cle' })).not.toBe(adaptateurJournal)
  })

  it('prestataire : expéditeur, réponses, clé d’idempotence ; échecs sans donnée personnelle', async () => {
    const { creerAdaptateurPrestataire } = await import('@/lib/notifications/adaptateur-prestataire')
    const courriel = { a: ADRESSE_ARTISTE, sujet: 'Sujet', texte: 'Texte', html: '<p>Texte</p>', cle: 'evt-2:envoyerInvitation' }
    const appel = vi.fn(async () => new Response('{"id":"x"}', { status: 200 }))
    expect(await creerAdaptateurPrestataire({ RESEND_API_KEY: 'cle-test' }, appel as never).envoyer(courriel)).toEqual({ ok: true })
    const [url, init] = appel.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    const entetes = init.headers as Record<string, string>
    expect(entetes.Authorization).toBe('Bearer cle-test')
    expect(entetes['Idempotency-Key']).toBe('evt-2:envoyerInvitation')
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'Errancy <contact@errancy.art>',
      to: [ADRESSE_ARTISTE],
      reply_to: 'contact@errancy.art',
      subject: 'Sujet',
      text: 'Texte',
      html: '<p>Texte</p>',
    })

    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sansCle = creerAdaptateurPrestataire({}, appel as never)
    expect(await sansCle.envoyer(courriel)).toEqual({ ok: false, code: 'non_configure' })
    const refus = creerAdaptateurPrestataire({ RESEND_API_KEY: 'k' }, (async () => new Response(`adresse ${ADRESSE_ARTISTE} refusée`, { status: 422 })) as never)
    expect(await refus.envoyer(courriel)).toEqual({ ok: false, code: 'refuse' })
    const panne = creerAdaptateurPrestataire({ RESEND_API_KEY: 'k' }, (async () => new Response('', { status: 503 })) as never)
    expect(await panne.envoyer(courriel)).toEqual({ ok: false, code: 'indisponible' })
    const limite = creerAdaptateurPrestataire({ RESEND_API_KEY: 'k' }, (async () => new Response('', { status: 429 })) as never)
    expect(await limite.envoyer(courriel)).toEqual({ ok: false, code: 'indisponible' })
    const coupee = creerAdaptateurPrestataire({ RESEND_API_KEY: 'k' }, (async () => { throw new Error(`réseau ${ADRESSE_ARTISTE}`) }) as never)
    expect(await coupee.envoyer(courriel)).toEqual({ ok: false, code: 'indisponible' })
    expect(JSON.stringify(erreurs.mock.calls)).not.toMatch(/exemple\.test|cle-test/)
  })

  it('le nom du prestataire n’est que dans son adaptateur', () => {
    const trouves = fichiers('src')
      .filter((f) => path.basename(f) !== 'adaptateur-prestataire.ts')
      .filter((f) => /resend/i.test(readFileSync(f, 'utf8')))
    expect(trouves).toEqual([])
    expect(readFileSync('src/lib/notifications/adaptateur-prestataire.ts', 'utf8')).toMatch(/RESEND_API_KEY/)
  })
})

describe('base : événements et e-mails', () => {
  let base: BaseJetable
  let db: Client

  const compter = async (table: string) => Number((await db.query(`SELECT count(*) FROM "${table}"`)).rows[0].count)
  const lienDe = (c: Envoye) => /\/auth\/invitation\/([A-Za-z0-9_-]{43})/.exec(c.texte)?.[1]

  async function oeuvreEnCuration(slug: string, artistId = 'artiste-a') {
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes",
                              "hauteurMm", "largeurMm", publication, disponibilite, "artistId", "createdAt", "updatedAt")
       VALUES ('id-' || $1, $1, 'Nuit blanche', 2024, 'Huile', 'Histoire', 'https://res.cloudinary.com/x/image/upload/a.jpg',
               95000, 600, 800, 'en_curation', 'disponible', $2, now(), now())`,
      [slug, artistId],
    )
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
    envoi.envoyes.length = 0
    envoi.resultat = { ok: true }
    envoi.leve = false
    for (const table of ['Evenement', 'Jeton', 'Invitation', 'DecisionCuration', 'Artwork', 'Artist', 'User']) {
      await db.query(`DELETE FROM "${table}"`)
    }
    await db.query(`INSERT INTO "User" (id, email, role, "updatedAt") VALUES ('artiste-b-user', $1, 'artist', now())`, [ADRESSE_ARTISTE])
    for (const [id, nom, userId, accord] of [
      ['artiste-a', 'Karim Benali', null, '2026-11-01'],
      ['artiste-b', 'Karim B.', 'artiste-b-user', '2026-11-01'],
    ]) {
      await db.query(
        `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt", "userId", "accordSigneLe")
         VALUES ($1, $1, $2, 'MA', 1980, 'Bio', '', now(), $3, $4)`,
        [id, nom, userId, accord],
      )
    }
  })

  afterEach(() => vi.restoreAllMocks())

  it('invitation : un e-mail avec « Créer mon accès » et la durée ; le jeton naît à l’envoi, valeur en clair seulement dans l’e-mail', async () => {
    const { inviterArtiste, lireInvitation } = await import('@/lib/acces/invitations')
    const r = await inviterArtiste(ADMIN as never, 'artiste-a', '  Invite@Exemple.TEST ')
    expect(r).toMatchObject({ ok: true, email: 'invite@exemple.test' })
    expect(JSON.stringify(r)).not.toMatch(/[A-Za-z0-9_-]{43}/)
    expect(envoi.envoyes).toHaveLength(1)
    const [courriel] = envoi.envoyes
    expect(courriel.a).toBe('invite@exemple.test')
    expect(courriel.sujet).toBe('Votre invitation à rejoindre Errancy')
    expect(courriel.texte).toContain('Créer mon accès')
    expect(courriel.texte).toContain('7 jours')
    const jeton = lienDe(courriel)
    expect(jeton).toBeTruthy()
    expect(await lireInvitation(jeton!)).toMatchObject({ email: 'invite@exemple.test', artiste: 'Karim Benali' })
    // Une seule ligne de jeton, seule son empreinte est en base ; l'invitation est marquée envoyée.
    const jetons = (await db.query('SELECT * FROM "Jeton"')).rows
    expect(jetons).toHaveLength(1)
    expect(JSON.stringify(jetons)).not.toContain(jeton!)
    const invitation = (await db.query('SELECT "envoyeeLe", "echecEnvoiLe" FROM "Invitation"')).rows[0]
    expect(invitation.envoyeeLe).not.toBeNull()
    expect(invitation.echecEnvoiLe).toBeNull()
  })

  it('invitation : l’événement ne porte que l’id de l’invitation, aucun journal ne contient l’adresse ni le lien', async () => {
    const infos = vi.spyOn(console, 'info').mockImplementation(() => {})
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { inviterArtiste } = await import('@/lib/acces/invitations')
    await inviterArtiste(ADMIN as never, 'artiste-a', 'invite@exemple.test')
    const lignes = (await db.query('SELECT nom, charge FROM "Evenement"')).rows
    expect(lignes).toEqual([{ nom: 'InvitationEmise', charge: { invitationId: expect.any(String) } }])
    const jeton = lienDe(envoi.envoyes[0])!
    const sortie = JSON.stringify([lignes, infos.mock.calls, erreurs.mock.calls])
    expect(sortie).not.toMatch(/exemple\.test|Karim/)
    expect(sortie).not.toContain(jeton)
  })

  it('invitation : envoi refusé → « L’e-mail n’est pas parti », lien révoqué et jamais montré, relançable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { inviterArtiste, invitationsEnAttente, lireInvitation } = await import('@/lib/acces/invitations')
    const { messageRefusInvitation } = await import('@/lib/acces/messages')
    envoi.resultat = { ok: false, code: 'refuse' }
    const r = await inviterArtiste(ADMIN as never, 'artiste-a', 'invite@exemple.test')
    expect(r).toEqual({ ok: false, code: 'envoi_echoue' })
    expect(messageRefusInvitation('envoi_echoue')).toContain('L’e-mail n’est pas parti')
    const jeton = lienDe(envoi.envoyes[0])!
    expect(await lireInvitation(jeton)).toBeNull()
    expect(await invitationsEnAttente(['artiste-a'])).toEqual({
      'artiste-a': { email: 'invite@exemple.test', statut: 'echec', echeance: null },
    })

    // Relance : nouvelle invitation, un nouvel e-mail, le premier lien reste mort.
    envoi.resultat = { ok: true }
    const relance = await inviterArtiste(ADMIN as never, 'artiste-a', 'invite@exemple.test')
    expect(relance.ok).toBe(true)
    expect(envoi.envoyes).toHaveLength(2)
    const nouveau = lienDe(envoi.envoyes[1])!
    expect(nouveau).not.toBe(jeton)
    expect(await lireInvitation(jeton)).toBeNull()
    expect(await lireInvitation(nouveau)).not.toBeNull()
    expect((await invitationsEnAttente(['artiste-a']))['artiste-a']).toMatchObject({ statut: 'envoyee' })
  })

  it('invitation : un adaptateur qui lève compte comme un échec, sans adresse dans les journaux', async () => {
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { inviterArtiste, invitationsEnAttente } = await import('@/lib/acces/invitations')
    envoi.leve = true
    expect(await inviterArtiste(ADMIN as never, 'artiste-a', 'invite@exemple.test')).toEqual({ ok: false, code: 'envoi_echoue' })
    expect((await invitationsEnAttente(['artiste-a']))['artiste-a'].statut).toBe('echec')
    expect(await compter('Jeton')).toBe(1)
    expect((await db.query('SELECT "revoqueLe" FROM "Jeton"')).rows[0].revoqueLe).not.toBeNull()
    expect(JSON.stringify(erreurs.mock.calls)).not.toContain('exemple.test')
  })

  it('invitation remplacée avant l’envoi : l’ancienne n’émet aucun lien ni e-mail', async () => {
    const { emettreLienInvitation } = await import('@/lib/acces/lien-invitation')
    await db.query(`INSERT INTO "Invitation" (id, "artistId", email, "createdAt") VALUES ('ancienne', 'artiste-a', 'a@exemple.test', now() - interval '1 minute')`)
    await db.query(`INSERT INTO "Invitation" (id, "artistId", email, "createdAt") VALUES ('recente', 'artiste-a', 'b@exemple.test', now())`)
    expect(await emettreLienInvitation('ancienne')).toBeNull()
    expect(await emettreLienInvitation('recente')).toMatchObject({ email: 'b@exemple.test', artiste: 'Karim Benali' })
    // Déjà envoyée ou inconnue : rien.
    await db.query(`UPDATE "Invitation" SET "envoyeeLe" = now() WHERE id = 'recente'`)
    expect(await emettreLienInvitation('recente')).toBeNull()
    expect(await emettreLienInvitation('inconnue')).toBeNull()
    expect(await compter('Jeton')).toBe(1)
  })

  it('écran de l’équipe : états en cours, lien d’avant la 4.1, lien expiré', async () => {
    const { invitationsEnAttente } = await import('@/lib/acces/invitations')
    const { noterEnvoiInvitation } = await import('@/lib/acces/lien-invitation')
    const echeance = new Date(Date.now() + 86_400_000)
    const jeton = (cible: string, e = echeance) =>
      db.query(`INSERT INTO "Jeton" (id, empreinte, usage, cible, echeance) VALUES ($1, $1, 'invitation', $2, $3)`, [`j-${cible}`, cible, e])
    await db.query(`INSERT INTO "Invitation" (id, "artistId", email) VALUES ('i1', 'artiste-a', 'a@exemple.test')`)
    expect(await invitationsEnAttente(['artiste-a'])).toEqual({ 'artiste-a': { email: 'a@exemple.test', statut: 'en_cours', echeance: null } })
    await jeton('i1')
    expect((await invitationsEnAttente(['artiste-a']))['artiste-a']).toMatchObject({ statut: 'lien_manuel' })
    await db.query(`UPDATE "Invitation" SET "envoyeeLe" = now() WHERE id = 'i1'`)
    expect((await invitationsEnAttente(['artiste-a']))['artiste-a']).toMatchObject({ statut: 'envoyee' })
    await db.query(`UPDATE "Jeton" SET echeance = now() - interval '1 minute'`)
    expect(await invitationsEnAttente(['artiste-a'])).toEqual({})
    // Un échec noté ne touche pas une invitation déjà partie.
    await db.query(`UPDATE "Jeton" SET echeance = $1`, [echeance])
    await noterEnvoiInvitation('i1', 'echec')
    expect((await invitationsEnAttente(['artiste-a']))['artiste-a']).toMatchObject({ statut: 'envoyee' })
  })

  it('erreur après la réclamation, avant l’envoi : l’échec est noté, l’équipe peut relancer', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const lien = await import('@/lib/acces/lien-invitation')
    vi.spyOn(lien, 'emettreLienInvitation').mockRejectedValueOnce(new Error('base indisponible'))
    const { inviterArtiste, invitationsEnAttente } = await import('@/lib/acces/invitations')
    expect(await inviterArtiste(ADMIN as never, 'artiste-a', 'invite@exemple.test')).toEqual({ ok: false, code: 'envoi_echoue' })
    expect((await invitationsEnAttente(['artiste-a']))['artiste-a'].statut).toBe('echec')
    expect(envoi.envoyes).toHaveLength(0)
  })

  it('œuvre validée : un e-mail « publiée » à l’adresse du compte de l’artiste, lien vers la fiche', async () => {
    const { validerOeuvre, CONTROLES_CURATION } = await import('@/lib/curation')
    await oeuvreEnCuration('nuit-blanche', 'artiste-b')
    const r = await validerOeuvre(ADMIN as never, 'nuit-blanche', CONTROLES_CURATION.map((c) => c.code))
    expect(r.ok).toBe(true)
    expect(envoi.envoyes).toHaveLength(1)
    const [c] = envoi.envoyes
    expect(c.a).toBe(ADRESSE_ARTISTE)
    expect(c.sujet).toBe('Votre œuvre « Nuit blanche » est publiée')
    expect(c.texte).toContain('https://www.errancy.art/galerie/nuit-blanche')
    expect(c.texte).toContain('Bonjour Karim B.,')
  })

  it('œuvre renvoyée : un e-mail avec le commentaire de l’équipe et le lien vers le dépôt', async () => {
    const { renvoyerOeuvre } = await import('@/lib/curation')
    await oeuvreEnCuration('nuit-blanche', 'artiste-b')
    expect((await renvoyerOeuvre(ADMIN as never, 'nuit-blanche', COMMENTAIRE)).ok).toBe(true)
    expect(envoi.envoyes).toHaveLength(1)
    const [c] = envoi.envoyes
    expect(c.a).toBe(ADRESSE_ARTISTE)
    expect(c.sujet).toBe('Votre œuvre « Nuit blanche » : nos remarques')
    expect(c.texte).toContain(COMMENTAIRE)
    expect(c.texte).toContain('https://www.errancy.art/dashboard/artiste/oeuvres/nuit-blanche')
    // L'événement ne porte pas le commentaire : ids seulement.
    const charges = (await db.query(`SELECT charge FROM "Evenement" WHERE nom = 'OeuvreRenvoyee'`)).rows
    expect(JSON.stringify(charges)).not.toContain('floue')
  })

  it('événement traité deux fois (rejeu, parallèle) : un seul e-mail', async () => {
    const { validerOeuvre, CONTROLES_CURATION } = await import('@/lib/curation')
    const { repartir } = await import('@/lib/evenements')
    await oeuvreEnCuration('nuit-blanche', 'artiste-b')
    await validerOeuvre(ADMIN as never, 'nuit-blanche', CONTROLES_CURATION.map((c) => c.code))
    expect(envoi.envoyes).toHaveLength(1)
    const ids = (await db.query('SELECT id FROM "Evenement"')).rows.map((l) => l.id as string)
    await Promise.all([repartir(ids), repartir(ids), repartir(ids)])
    await repartir(ids)
    expect(envoi.envoyes).toHaveLength(1)
    // Deux événements, un gestionnaire chacun (invalidation du catalogue, e-mail) : chaque réclamation n'est prise qu'une fois.
    expect(await compter('TraitementEvenement')).toBe(2)
  })

  it('invitation rejouée : un seul e-mail, un seul jeton', async () => {
    const { inviterArtiste } = await import('@/lib/acces/invitations')
    const { repartir } = await import('@/lib/evenements')
    await inviterArtiste(ADMIN as never, 'artiste-a', 'invite@exemple.test')
    const ids = (await db.query('SELECT id FROM "Evenement"')).rows.map((l) => l.id as string)
    await Promise.all([repartir(ids), repartir(ids)])
    expect(envoi.envoyes).toHaveLength(1)
    expect(await compter('Jeton')).toBe(1)
  })

  it('artiste sans compte : aucun e-mail de résultat, l’action réussit', async () => {
    const infos = vi.spyOn(console, 'info').mockImplementation(() => {})
    const { validerOeuvre, CONTROLES_CURATION } = await import('@/lib/curation')
    await oeuvreEnCuration('nuit-blanche', 'artiste-a')
    expect((await validerOeuvre(ADMIN as never, 'nuit-blanche', CONTROLES_CURATION.map((c) => c.code))).ok).toBe(true)
    expect(envoi.envoyes).toHaveLength(0)
    expect(JSON.stringify(infos.mock.calls)).not.toMatch(/exemple\.test|Karim/)
  })

  it('échec d’envoi d’un résultat de curation : l’action réussit, journal sans adresse', async () => {
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { validerOeuvre, CONTROLES_CURATION } = await import('@/lib/curation')
    await oeuvreEnCuration('nuit-blanche', 'artiste-b')
    envoi.resultat = { ok: false, code: 'indisponible' }
    expect((await validerOeuvre(ADMIN as never, 'nuit-blanche', CONTROLES_CURATION.map((c) => c.code))).ok).toBe(true)
    expect(JSON.stringify(erreurs.mock.calls)).toContain('résultat de curation non envoyé')
    expect(JSON.stringify(erreurs.mock.calls)).not.toContain('exemple.test')
  })

  it('refus métier : aucun événement, aucun e-mail', async () => {
    const { validerOeuvre, renvoyerOeuvre } = await import('@/lib/curation')
    await oeuvreEnCuration('nuit-blanche', 'artiste-b')
    expect(await validerOeuvre(ADMIN as never, 'nuit-blanche', [])).toEqual({ ok: false, code: 'controle_incomplet' })
    expect((await renvoyerOeuvre(ADMIN as never, 'nuit-blanche', 'court')).ok).toBe(false)
    expect(await validerOeuvre({ type: 'visiteur' } as never, 'nuit-blanche', [])).toEqual({ ok: false, code: 'acces_refuse' })
    expect(await compter('Evenement')).toBe(0)
    expect(envoi.envoyes).toHaveLength(0)
  })
})
