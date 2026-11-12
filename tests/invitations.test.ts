import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Client } from 'pg'
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthError } from 'next-auth'
import { CHARTE_ARTISTE, CHARTE_ARTISTE_VERSION } from '@/lib/acces/charte'
import { messageRefusActivation, messageRefusInvitation } from '@/lib/acces/messages'
import { passeLaMaintenance } from '@/lib/reglages'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 2.4 (FR-34, AD-14) : invitation et premier accès de l'artiste.

const ADMIN = { type: 'admin', userId: 'admin-1' }
const EMPREINTE_CHARTE = '2f9ca1d6471a367735d21d9081a579eabc94aa9866a285ab2b114c61a0ec2180'
const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as Record<string, unknown> }))
const session = vi.hoisted(() => ({ userId: null as string | null }))
const signIn = vi.hoisted(() => vi.fn())
const jar = vi.hoisted(() => ({ valeurs: new Map<string, string>(), supprimes: [] as { name: string; path?: string }[] }))
const entetes = vi.hoisted(() => ({ valeurs: new Map<string, string>() }))
// Story 4.1 : l'invitation part par e-mail (adaptateur factice) ; le lien n'existe que dans l'e-mail.
const courriels = vi.hoisted(() => ({ envoyes: [] as { a: string; sujet: string; texte: string; html: string; cle: string }[] }))
vi.mock('@/lib/notifications/choix', () => ({
  envoiActif: () => ({
    envoyer: async (c: { a: string; sujet: string; texte: string; html: string; cle: string }) => {
      courriels.envoyes.push(c)
      return { ok: true }
    },
  }),
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => (session.userId ? { user: { id: session.userId } } : null)),
  signIn,
}))
// next-auth importe next/server, que Vitest ne résout pas hors de Next.js.
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('@/lib/acces', async (original) => ({
  ...(await original<typeof import('@/lib/acces')>()),
  acteurCourant: async () => acteur.courant,
}))
// Story 3.4 : unstable_cache en passe-plat (pas de cache dans les tests), revalidateTag espionné.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (nom: string) => (jar.valeurs.has(nom) ? { name: nom, value: jar.valeurs.get(nom) } : undefined),
    delete: (c: string | { name: string; path?: string }) => jar.supprimes.push(typeof c === 'string' ? { name: c } : c),
  }),
  headers: () => ({ get: (nom: string) => entetes.valeurs.get(nom) ?? null }),
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirection:${url}`)
  },
  notFound: () => {
    throw new Error('introuvable')
  },
}))

function trouverElement(n: ReactNode, predicat: (e: ReactElement) => boolean): ReactElement | null {
  if (!isValidElement(n)) {
    if (!Array.isArray(n)) return null
    for (const enfant of n) {
      const r = trouverElement(enfant, predicat)
      if (r) return r
    }
    return null
  }
  if (predicat(n)) return n
  return trouverElement((n.props as { children?: ReactNode }).children, predicat)
}

describe('règles pures', () => {
  it('maintenance : admins partout, artistes seulement dans leur espace, /auth ouvert à tous', () => {
    expect(passeLaMaintenance('admin', '/galerie')).toBe(true)
    expect(passeLaMaintenance('artist', '/dashboard/artiste')).toBe(true)
    expect(passeLaMaintenance('artist', '/dashboard/artiste/oeuvres/nouvelle')).toBe(true)
    expect(passeLaMaintenance('artist', '/galerie')).toBe(false)
    expect(passeLaMaintenance('artist', '/dashboard/artistes-faux')).toBe(false)
    expect(passeLaMaintenance('artist', '/dashboard/admin')).toBe(false)
    expect(passeLaMaintenance('user', '/dashboard/artiste')).toBe(false)
    expect(passeLaMaintenance(null, '/auth/invitation')).toBe(true)
    expect(passeLaMaintenance(null, '/authentique')).toBe(false)
    expect(passeLaMaintenance(null, '/')).toBe(false)
    // Lien de l'acheteur d'une vente assistée (6.3 bis) : ouvert à tous ; le reste reste en maintenance.
    for (const role of [null, 'user', 'artist', 'admin']) {
      expect(passeLaMaintenance(role, '/commande')).toBe(true)
      expect(passeLaMaintenance(role, '/commande/abc')).toBe(true)
    }
    expect(passeLaMaintenance(null, '/commandes')).toBe(false)
    expect(passeLaMaintenance(null, '/commande-faux')).toBe(false)
    expect(passeLaMaintenance(null, '/galerie')).toBe(false)
  })

  it('la version de la charte change avec son texte', () => {
    // Si ce test échoue après une modification de la charte : changer CHARTE_ARTISTE_VERSION, puis
    // reporter ici la nouvelle empreinte.
    const empreinte = createHash('sha256').update(JSON.stringify(CHARTE_ARTISTE)).digest('hex')
    expect({ version: CHARTE_ARTISTE_VERSION, empreinte }).toEqual({ version: CHARTE_ARTISTE_VERSION, empreinte: EMPREINTE_CHARTE })
  })
})

describe('messages', () => {
  it('un texte en français pour chaque refus', () => {
    for (const code of ['acces_refuse', 'introuvable', 'email_invalide', 'deja_relie', 'email_utilise', 'email_invite_ailleurs', 'envoi_echoue'] as const) {
      expect(messageRefusInvitation(code)).toMatch(/\.$/)
    }
    expect(messageRefusActivation('invalide')).toBe('Ce lien d’invitation a expiré.')
  })
})

describe('base : invitations', () => {
  let base: BaseJetable
  let db: Client
  const DANS_8_JOURS = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)

  const compter = async (table: string) => (await db.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n as number

  async function inviter(artistId = 'artiste-a', email = 'karim@exemple.test') {
    const { inviterArtiste } = await import('@/lib/acces/invitations')
    const avant = courriels.envoyes.length
    const r = await inviterArtiste(ADMIN as never, artistId, email)
    if (!r.ok) throw new Error(`invitation refusée : ${r.code}`)
    const lien = /\/auth\/invitation\/([A-Za-z0-9_-]{43})/.exec(courriels.envoyes[avant]?.texte ?? '')
    if (!lien) throw new Error('aucun lien dans l’e-mail')
    return { ...r, jeton: lien[1] }
  }
  const SAISIE = { motDePasse: 'motdepasse-solide', confirmation: 'motdepasse-solide', charteAcceptee: true }

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
    session.userId = null
    signIn.mockReset()
    jar.valeurs.clear()
    jar.supprimes = []
    entetes.valeurs.clear()
    courriels.envoyes.length = 0
    await db.query('DELETE FROM "Evenement"')
    await db.query('DELETE FROM "Jeton"')
    await db.query('DELETE FROM "Invitation"')
    await db.query('DELETE FROM "Artwork"')
    await db.query('DELETE FROM "Artist"')
    await db.query('DELETE FROM "User"')
    await db.query(`INSERT INTO "User" (id, email, role, "updatedAt") VALUES ('artiste-b-user', 'b@exemple.test', 'artist', now())`)
    for (const [id, userId] of [['artiste-a', null], ['artiste-b', 'artiste-b-user']]) {
      await db.query(
        `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt", "userId")
         VALUES ($1, $1, $2, 'MA', 1980, 'Bio', '', now(), $3)`,
        [id, id === 'artiste-a' ? 'Karim Benali' : 'Artiste B', userId],
      )
    }
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "artistId", "updatedAt")
       VALUES ('oeuvre-b', 'oeuvre-b', 'Œuvre de B', 2020, 'Huile', 'Description', '', 'artiste-b', now())`,
    )
  })

  it('invitation par un admin : jeton de 256 bits, seule son empreinte en base', async () => {
    const r = await inviter()
    expect(r.jeton).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const jetons = (await db.query('SELECT * FROM "Jeton"')).rows
    expect(jetons).toHaveLength(1)
    expect(jetons[0].empreinte).toBe(createHash('sha256').update(r.jeton).digest('hex'))
    expect(jetons[0].usage).toBe('invitation')
    expect(JSON.stringify(jetons)).not.toContain(r.jeton)
    const invitation = (await db.query('SELECT * FROM "Invitation"')).rows[0]
    expect(invitation).toMatchObject({ artistId: 'artiste-a', email: 'karim@exemple.test', creeParId: 'admin-1' })
    expect(jetons[0].cible).toBe(invitation.id)
    // Échéance : 7 jours (réglage).
    const jours = (new Date(jetons[0].echeance).getTime() - new Date(invitation.createdAt).getTime()) / 86_400_000
    expect(Math.round(jours)).toBe(7)
  })

  it('hors admin, artiste déjà relié, e-mail invalide ou déjà utilisé : refus, rien de créé', async () => {
    const { inviterArtiste } = await import('@/lib/acces/invitations')
    for (const a of [{ type: 'artist', userId: 'artiste-b-user', artiste: null }, { type: 'visiteur' }, { type: 'user', userId: 'u' }]) {
      expect(await inviterArtiste(a as never, 'artiste-a', 'k@exemple.test')).toEqual({ ok: false, code: 'acces_refuse' })
    }
    expect(await inviterArtiste(ADMIN as never, 'artiste-b', 'k@exemple.test')).toEqual({ ok: false, code: 'deja_relie' })
    expect(await inviterArtiste(ADMIN as never, 'inconnu', 'k@exemple.test')).toEqual({ ok: false, code: 'introuvable' })
    expect(await inviterArtiste(ADMIN as never, 'artiste-a', 'pas-un-email')).toEqual({ ok: false, code: 'email_invalide' })
    expect(await inviterArtiste(ADMIN as never, 'artiste-a', '  B@Exemple.TEST ')).toEqual({ ok: false, code: 'email_utilise' })
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt") VALUES ('artiste-c', 'artiste-c', 'Artiste C', 'MA', 1990, 'Bio', '', now())`,
    )
    expect((await inviterArtiste(ADMIN as never, 'artiste-c', 'commun@exemple.test')).ok).toBe(true)
    expect(await inviterArtiste(ADMIN as never, 'artiste-a', 'Commun@exemple.test')).toEqual({ ok: false, code: 'email_invite_ailleurs' })
    await db.query('DELETE FROM "Jeton"')
    await db.query('DELETE FROM "Invitation"')
    expect(await compter('Invitation')).toBe(0)
    expect(await compter('Jeton')).toBe(0)
  })

  it('réinvitation : l’ancien lien ne marche plus, le nouveau oui', async () => {
    const { lireInvitation, invitationsEnAttente } = await import('@/lib/acces/invitations')
    const premier = await inviter('artiste-a', 'ancien@exemple.test')
    const second = await inviter('artiste-a', 'nouveau@exemple.test')
    expect(await lireInvitation(premier.jeton)).toBeNull()
    expect(await lireInvitation(second.jeton)).toMatchObject({ email: 'nouveau@exemple.test', artiste: 'Karim Benali' })
    expect(await invitationsEnAttente(['artiste-a', 'artiste-b'])).toEqual({
      'artiste-a': { email: 'nouveau@exemple.test', statut: 'envoyee', echeance: second.echeance },
    })
  })

  it('lien inconnu, mal formé, expiré, consommé ou révoqué : invalide', async () => {
    const { lireInvitation, activerInvitation } = await import('@/lib/acces/invitations')
    const r = await inviter()
    expect(await lireInvitation('x'.repeat(43))).toBeNull()
    expect(await lireInvitation('../../etc')).toBeNull()
    expect(await lireInvitation(r.jeton, DANS_8_JOURS)).toBeNull()
    expect(await activerInvitation(r.jeton, SAISIE, DANS_8_JOURS)).toEqual({ ok: false, code: 'invalide' })
    expect((await activerInvitation(r.jeton, SAISIE)).ok).toBe(true)
    expect(await lireInvitation(r.jeton)).toBeNull()
    expect(await activerInvitation(r.jeton, SAISIE)).toEqual({ ok: false, code: 'invalide' })
  })

  it('activation : compte artist relié à la fiche, charte datée et versionnée, jeton consommé', async () => {
    const { activerInvitation } = await import('@/lib/acces/invitations')
    const { CHARTE_ARTISTE_VERSION } = await import('@/lib/acces/charte')
    const r = await inviter()
    expect(await activerInvitation(r.jeton, SAISIE)).toEqual({ ok: true, email: 'karim@exemple.test' })
    const user = (await db.query(`SELECT * FROM "User" WHERE email = 'karim@exemple.test'`)).rows[0]
    expect(user).toMatchObject({ role: 'artist', name: 'Karim Benali' })
    expect(await bcrypt.compare('motdepasse-solide', user.password)).toBe(true)
    expect((await db.query(`SELECT "userId" FROM "Artist" WHERE id = 'artiste-a'`)).rows[0].userId).toBe(user.id)
    const invitation = (await db.query('SELECT * FROM "Invitation"')).rows[0]
    expect(invitation.accepteeLe).not.toBeNull()
    expect(invitation.charteVersion).toBe(CHARTE_ARTISTE_VERSION)
    expect((await db.query('SELECT "consommeLe" FROM "Jeton"')).rows[0].consommeLe).not.toBeNull()
  })

  it('saisie invalide : erreur, rien n’est créé ni consommé', async () => {
    const { activerInvitation, lireInvitation } = await import('@/lib/acces/invitations')
    const r = await inviter()
    expect(await activerInvitation(r.jeton, { ...SAISIE, motDePasse: 'court', confirmation: 'court' })).toEqual({ ok: false, code: 'mot_de_passe_court' })
    expect(await activerInvitation(r.jeton, { ...SAISIE, confirmation: 'autre-mot-de-passe' })).toEqual({ ok: false, code: 'mots_de_passe_differents' })
    expect(await activerInvitation(r.jeton, { ...SAISIE, charteAcceptee: false })).toEqual({ ok: false, code: 'charte_non_acceptee' })
    const long = 'é'.repeat(37) // 74 octets : bcrypt en ignorerait la fin.
    expect(await activerInvitation(r.jeton, { ...SAISIE, motDePasse: long, confirmation: long })).toEqual({ ok: false, code: 'mot_de_passe_long' })
    expect(await compter('User')).toBe(1)
    expect(await lireInvitation(r.jeton)).not.toBeNull()
  })

  it('e-mail pris entre l’invitation et l’activation : refus, jeton toujours valable', async () => {
    const { activerInvitation, lireInvitation } = await import('@/lib/acces/invitations')
    const r = await inviter()
    await db.query(`INSERT INTO "User" (id, email, role, "updatedAt") VALUES ('autre', 'karim@exemple.test', 'user', now())`)
    expect(await activerInvitation(r.jeton, SAISIE)).toEqual({ ok: false, code: 'email_utilise' })
    await db.query(`DELETE FROM "User" WHERE id = 'autre'`)
    expect(await lireInvitation(r.jeton)).not.toBeNull()
  })

  it('fiche reliée après l’invitation : le lien ne sert plus et ne déplace jamais la fiche', async () => {
    const { activerInvitation, lireInvitation } = await import('@/lib/acces/invitations')
    const r = await inviter()
    await db.query(`UPDATE "Artist" SET "userId" = NULL WHERE id = 'artiste-b'`)
    await db.query(`UPDATE "Artist" SET "userId" = 'artiste-b-user' WHERE id = 'artiste-a'`)
    expect(await lireInvitation(r.jeton)).toBeNull()
    expect((await activerInvitation(r.jeton, SAISIE)).ok).toBe(false)
    expect((await db.query(`SELECT "userId" FROM "Artist" WHERE id = 'artiste-a'`)).rows[0].userId).toBe('artiste-b-user')
    expect(await compter('User')).toBe(1)
  })

  it('double envoi simultané : un seul compte', async () => {
    const { activerInvitation } = await import('@/lib/acces/invitations')
    const r = await inviter()
    const resultats = await Promise.all([activerInvitation(r.jeton, SAISIE), activerInvitation(r.jeton, SAISIE)])
    expect(resultats.filter((x) => x.ok)).toHaveLength(1)
    expect(resultats.filter((x) => !x.ok)).toEqual([{ ok: false, code: expect.stringMatching(/invalide|email_utilise/) }])
    expect((await db.query(`SELECT count(*)::int AS n FROM "User" WHERE email = 'karim@exemple.test'`)).rows[0].n).toBe(1)
  })

  describe('ouverture du lien', () => {
    it('lien valable : cookie httpOnly, redirection sans jeton, no-referrer', async () => {
      const { GET } = await import('@/app/auth/invitation/[jeton]/route')
      const { NextRequest } = await import('next/server')
      const r = await inviter()
      const reponse = await GET(new NextRequest(`https://errancy.test/auth/invitation/${r.jeton}`), { params: { jeton: r.jeton } })
      expect(reponse.status).toBe(303)
      expect(reponse.headers.get('location')).toBe('https://errancy.test/auth/invitation')
      expect(reponse.headers.get('referrer-policy')).toBe('no-referrer')
      const cookie = reponse.headers.get('set-cookie') ?? ''
      expect(cookie).toContain(`invitation=${r.jeton}`)
      expect(cookie).toMatch(/HttpOnly/i)
      expect(cookie).toMatch(/Secure/i)
      expect(cookie).toMatch(/Path=\/auth\/invitation/)
    })

    it('lien invalide : redirection et cookie effacé', async () => {
      const { GET } = await import('@/app/auth/invitation/[jeton]/route')
      const { NextRequest } = await import('next/server')
      const jeton = 'y'.repeat(43)
      const reponse = await GET(new NextRequest(`https://errancy.test/auth/invitation/${jeton}`), { params: { jeton } })
      expect(reponse.headers.get('location')).toBe('https://errancy.test/auth/invitation')
      const cookie = reponse.headers.get('set-cookie') ?? ''
      expect(cookie).not.toContain(jeton)
      // Effacement effectif : même nom et même chemin que le cookie posé, expiré.
      expect(cookie).toMatch(/^invitation=;/)
      expect(cookie).toMatch(/Path=\/auth\/invitation/)
      expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/)
    })

    it('page : formulaire si le cookie porte un jeton valable, sinon « lien expiré » et « Écrire à l’équipe »', async () => {
      const { default: Page } = await import('@/app/auth/invitation/page')
      const { FormulaireActivation } = await import('@/app/auth/invitation/FormulaireActivation')
      const { LienExpire } = await import('@/app/auth/invitation/LienExpire')
      expect(trouverElement(await Page(), (e) => e.type === LienExpire)).not.toBeNull()
      const expire = renderToStaticMarkup(createElement(LienExpire))
      expect(expire).toContain('Ce lien d&#x27;invitation a expiré.')
      expect(expire).toContain('mailto:contact@errancy.art')

      const r = await inviter()
      jar.valeurs.set('invitation', r.jeton)
      const formulaire = trouverElement(await Page(), (e) => e.type === FormulaireActivation)
      expect(formulaire?.props).toMatchObject({ email: 'karim@exemple.test' })
      expect(trouverElement(await Page(), (e) => e.props?.role === 'status')).toBeNull()
      // Session déjà ouverte : elle sera remplacée, la page le dit.
      session.userId = 'artiste-b-user'
      const { auth } = await import('@/auth')
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'artiste-b-user', email: 'b@exemple.test' } } as never)
      const avertissement = trouverElement(await Page(), (e) => e.props?.role === 'status')
      expect(renderToStaticMarkup(avertissement as ReactElement)).toContain('Vous êtes connecté en tant que b@exemple.test')
    })
  })

  describe('actions serveur', () => {
    it('invitation : e-mail envoyé, lien jamais renvoyé à l’écran', async () => {
      const { actionInviter } = await import('@/app/dashboard/admin/artistes/actions')
      acteur.courant = ADMIN
      const f = new FormData()
      f.set('email', 'karim@exemple.test')
      const etat = await actionInviter('artiste-a', null, f)
      expect(etat).toMatchObject({ ok: true, email: 'karim@exemple.test' })
      expect(JSON.stringify(etat)).not.toMatch(/auth\/invitation|[A-Za-z0-9_-]{43}/)
      expect(courriels.envoyes).toHaveLength(1)
      acteur.courant = { type: 'visiteur' }
      expect(await actionInviter('artiste-a', null, f)).toEqual({ ok: false, message: 'Seule l’équipe Errancy peut inviter un artiste.' })
    })

    it('activation : erreur reliée au champ, puis connexion vers l’espace artiste et cookie effacé', async () => {
      const { actionActiver } = await import('@/app/auth/invitation/actions')
      const r = await inviter()
      jar.valeurs.set('invitation', r.jeton)
      const f = new FormData()
      f.set('motDePasse', 'motdepasse-solide')
      f.set('confirmation', 'motdepasse-solide')
      expect(await actionActiver(null, f)).toEqual({
        message: 'Acceptez la charte artiste pour créer votre accès.',
        champ: 'charte',
        expire: false,
      })
      f.set('charte', 'oui')
      await actionActiver(null, f)
      expect(signIn).toHaveBeenCalledWith('credentials', {
        email: 'karim@exemple.test',
        password: 'motdepasse-solide',
        redirectTo: '/dashboard/artiste',
      })
      expect(jar.supprimes).toContainEqual({ name: 'invitation', path: '/auth/invitation' })
      jar.valeurs.clear()
      expect(await actionActiver(null, f)).toMatchObject({ expire: true })
    })

    it('accès créé mais connexion impossible : le dire et proposer de se connecter', async () => {
      const { actionActiver } = await import('@/app/auth/invitation/actions')
      const r = await inviter()
      jar.valeurs.set('invitation', r.jeton)
      signIn.mockRejectedValueOnce(new AuthError())
      const f = new FormData()
      f.set('motDePasse', 'motdepasse-solide')
      f.set('confirmation', 'motdepasse-solide')
      f.set('charte', 'oui')
      expect(await actionActiver(null, f)).toEqual({
        message: 'Votre accès est créé. Connectez-vous avec votre e-mail et votre mot de passe.',
        champ: null,
        expire: false,
        cree: true,
      })
      expect((await db.query(`SELECT role FROM "User" WHERE email = 'karim@exemple.test'`)).rows[0].role).toBe('artist')
    })
  })

  describe('cloisonnement : un artiste n’accède qu’à ses propres œuvres', () => {
    it('API et page d’édition refusent l’œuvre d’un autre artiste', async () => {
      const { activerInvitation } = await import('@/lib/acces/invitations')
      const r = await inviter()
      await activerInvitation(r.jeton, SAISIE)
      const karim = (await db.query(`SELECT id FROM "User" WHERE email = 'karim@exemple.test'`)).rows[0].id
      session.userId = karim
      acteur.courant = { type: 'artist', userId: karim, artiste: { id: 'artiste-a', slug: 'artiste-a', name: 'Karim Benali' } }

      const { PUT, DELETE } = await import('@/app/api/artiste/oeuvres/[slug]/route')
      const { NextRequest } = await import('next/server')
      const params = { params: Promise.resolve({ slug: 'oeuvre-b' }) }
      const corps = JSON.stringify({ title: 'Piraté', year: 2020, technique: 'Huile' })
      expect((await PUT(new NextRequest('https://errancy.test/api', { method: 'PUT', body: corps }), params)).status).toBe(404)
      expect((await DELETE(new NextRequest('https://errancy.test/api', { method: 'DELETE' }), params)).status).toBe(404)
      expect((await db.query(`SELECT title FROM "Artwork" WHERE slug = 'oeuvre-b'`)).rows[0].title).toBe('Œuvre de B')

      const { oeuvreAEditer } = await import('@/lib/catalogue')
      expect(await oeuvreAEditer(karim, 'oeuvre-b')).toBeNull()
      const { default: Edition } = await import('@/app/dashboard/artiste/oeuvres/[slug]/page')
      await expect(Edition({ params: Promise.resolve({ slug: 'oeuvre-b' }) } as never)).rejects.toThrow('introuvable')
    })
  })
})
