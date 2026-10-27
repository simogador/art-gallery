import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { acteurDepuis } from '@/lib/acces/acteur'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 1.8 (AD-15) : le rôle est relu en base ; un changement vaut sans reconnexion.

// Jeton de session figé : il dit toujours « user », quel que soit le rôle en base.
const UTILISATEUR = 'utilisateur-test'
vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: UTILISATEUR, role: 'user' } })) }))
vi.mock('@/lib/cloudinary', () => ({
  cloudinary: {
    uploader: {
      upload_stream: (_options: unknown, rappel: (e: unknown, r: unknown) => void) => ({
        end: () => rappel(null, { secure_url: 'https://exemple.test/nouvelle.jpg' }),
      }),
    },
  },
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirection:${url}`)
  },
}))

describe('acteurDepuis', () => {
  const artiste = { id: 'a1', slug: 'artiste', name: 'Artiste' }

  it('donne un acteur typé selon le rôle relu', () => {
    expect(acteurDepuis(null)).toEqual({ type: 'visiteur' })
    expect(acteurDepuis({ id: 'u', role: 'user', artist: null })).toEqual({ type: 'user', userId: 'u' })
    expect(acteurDepuis({ id: 'u', role: 'admin', artist: null })).toEqual({ type: 'admin', userId: 'u' })
    expect(acteurDepuis({ id: 'u', role: 'artist', artist: artiste })).toEqual({
      type: 'artist',
      userId: 'u',
      artiste,
    })
  })

  it('traite un rôle inconnu comme un simple utilisateur', () => {
    expect(acteurDepuis({ id: 'u', role: 'superadmin', artist: null })).toEqual({ type: 'user', userId: 'u' })
  })
})

describe('changement de rôle sans reconnexion', () => {
  let base: BaseJetable
  let db: Client
  const roleEnBase = (role: string) => db.query('UPDATE "User" SET role = $1 WHERE id = $2', [role, UTILISATEUR])

  beforeAll(async () => {
    base = await creerBaseJetable()
    // Le client Prisma de l'application lit DATABASE_URL à son premier import.
    process.env.DATABASE_URL = base.url
    db = new Client({ connectionString: base.url })
    await db.connect()
    await db.query(
      `INSERT INTO "User" (id, email, role, "updatedAt") VALUES ($1, 'artiste@exemple.test', 'user', now())`,
      [UTILISATEUR],
    )
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt", "userId")
       VALUES ('artiste-1', 'artiste-1', 'Artiste Un', 'FR', 1980, 'Bio', 'https://exemple.test/a.jpg', now(), $1)`,
      [UTILISATEUR],
    )
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt")
       VALUES ('artiste-2', 'artiste-2', 'Artiste Deux', 'FR', 1970, 'Bio', 'https://exemple.test/b.jpg', now())`,
    )
    for (const [slug, artiste] of [
      ['oeuvre-a-moi', 'artiste-1'],
      ['oeuvre-d-un-autre', 'artiste-2'],
    ]) {
      await db.query(
        `INSERT INTO "Artwork" (id, slug, title, year, medium, dimensions, description, "imageUrl", "artistId", "updatedAt")
         VALUES ($1, $1, 'Titre', 2020, 'Huile', '50 x 70 cm', 'Description', 'https://exemple.test/o.jpg', $2, now())`,
        [slug, artiste],
      )
    }
  })

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$disconnect()
    await db?.end()
    await base?.supprimer()
  })

  beforeEach(() => roleEnBase('user'))

  it('donne accès à /dashboard/artiste dès que le rôle passe à artist, puis le retire', async () => {
    const { default: LayoutArtiste } = await import('@/app/dashboard/artiste/layout')
    const ouvrir = () => LayoutArtiste({ children: null })

    await expect(ouvrir()).rejects.toThrow('redirection:/dashboard')

    await roleEnBase('artist')
    await expect(ouvrir()).resolves.toBeTruthy()

    await roleEnBase('user')
    await expect(ouvrir()).rejects.toThrow('redirection:/dashboard')
  })

  it('applique la même règle à /dashboard/admin', async () => {
    const { default: LayoutAdmin } = await import('@/app/dashboard/admin/layout')
    const ouvrir = () => LayoutAdmin({ children: null })

    await expect(ouvrir()).rejects.toThrow('redirection:/dashboard')
    await roleEnBase('admin')
    await expect(ouvrir()).resolves.toBeTruthy()
  })

  it('ouvre puis referme /dashboard/admin au gré du rôle en base', async () => {
    const { default: LayoutAdmin } = await import('@/app/dashboard/admin/layout')
    await roleEnBase('admin')
    await expect(LayoutAdmin({ children: null })).resolves.toBeTruthy()
    await roleEnBase('user')
    await expect(LayoutAdmin({ children: null })).rejects.toThrow('redirection:/dashboard')
  })

  it('vérifie le rôle dans chaque page de l’espace artiste, pas seulement dans le layout', async () => {
    const { default: PageArtiste } = await import('@/app/dashboard/artiste/page')
    await roleEnBase('artist')
    await expect(PageArtiste()).resolves.toBeTruthy()
    await roleEnBase('user')
    await expect(PageArtiste()).rejects.toThrow('redirection:/dashboard')
  })

  it('ouvre puis referme une route d’API artiste au gré du rôle en base', async () => {
    const { POST } = await import('@/app/api/artiste/oeuvres/route')
    const requete = () =>
      new Request('http://localhost/api/artiste/oeuvres', { method: 'POST', body: '{}' }) as never

    await roleEnBase('artist')
    expect((await POST(requete())).status).not.toBe(403)
    await roleEnBase('user')
    expect((await POST(requete())).status).toBe(403)
  })

  it('ne laisse changer l’image d’une œuvre qu’à son artiste ou à un admin', async () => {
    const { POST } = await import('@/app/api/upload/route')
    const envoyer = (slug: string) => {
      const formulaire = new FormData()
      formulaire.set('file', new Blob(['image']), 'image.jpg')
      formulaire.set('artworkId', slug)
      return POST(new Request('http://localhost/api/upload', { method: 'POST', body: formulaire }) as never)
    }

    expect((await envoyer('oeuvre-a-moi')).status).toBe(403) // simple utilisateur
    await roleEnBase('artist')
    expect((await envoyer('oeuvre-d-un-autre')).status).toBe(403)
    expect((await envoyer('oeuvre-a-moi')).status).toBe(200)
    await roleEnBase('admin')
    expect((await envoyer('oeuvre-d-un-autre')).status).toBe(200)
  })

  // Dernier test : il supprime l'utilisateur.
  it('renvoie vers la connexion un compte supprimé depuis sa connexion', async () => {
    const { acteurCourant } = await import('@/lib/acces')
    await db.query('UPDATE "Artist" SET "userId" = NULL WHERE "userId" = $1', [UTILISATEUR])
    await db.query('DELETE FROM "User" WHERE id = $1', [UTILISATEUR])
    expect(await acteurCourant()).toEqual({ type: 'visiteur' })
  })
})
