import { renderToStaticMarkup } from 'react-dom/server'
import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 4.6 (FR-25, FR-8, UX-DR42) : file des demandes de l'équipe. Base réelle : accès admin seulement
// (module, page, action serveur), tri de la plus ancienne à la plus récente, états par défaut et
// « traitées », changement d'état avec auteur et date, œuvre supprimée, alertes vers la file.

const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as unknown }))

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }), headers: () => new Headers() }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirection:${url}`)
  },
  notFound: () => {
    throw new Error('introuvable')
  },
}))

const ADMIN = { type: 'admin', userId: 'admin-1' }
const AUTRE_ADMIN = { type: 'admin', userId: 'admin-2' }
const ARTISTE = { type: 'artist', userId: 'u-art', artiste: null }
const USER = { type: 'user', userId: 'u-user' }
const VISITEUR = { type: 'visiteur' }

/** Texte de la page rendue côté serveur (balises retirées, entités décodées, espaces fusionnés). */
async function texteDe(noeud: unknown): Promise<string> {
  return renderToStaticMarkup(noeud as never)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

describe('base : file des demandes', () => {
  let base: BaseJetable
  let db: Client

  const visite = (id: string, o: { etat?: string; creeeLe: string; artwork?: string | null; telephone?: string | null }) =>
    db.query(
      `INSERT INTO "DemandeVisite" (id, "artworkId", type, creneaux, fuseau, email, telephone, etat, "createdAt", "updatedAt")
       VALUES ($1, $2, 'distance', ARRAY['2026-12-01T15:00:00Z', '2026-12-02T10:00:00Z']::timestamptz[], 'America/Montreal',
               'visiteur@exemple.test', $3, $4::"EtatDemande", $5::timestamptz, now())`,
      [id, o.artwork === undefined ? 'oeuvre-1' : o.artwork, o.telephone ?? null, o.etat ?? 'nouvelle', o.creeeLe],
    )
  const selection = (id: string, o: { etat?: string; creeeLe: string }) =>
    db.query(
      `INSERT INTO "DemandeSelection" (id, espace, ambiances, "budgetCentimes", email, etat, "createdAt", "updatedAt")
       VALUES ($1, 'Salon lumineux', ARRAY['calme'], 150000, 'selection@exemple.test', $2::"EtatDemande", $3::timestamptz, now())`,
      [id, o.etat ?? 'nouvelle', o.creeeLe],
    )
  const ligne = async (table: string, id: string) =>
    (await db.query(`SELECT etat, "etatChangePar", "etatChangeLe" FROM "${table}" WHERE id = $1`, [id])).rows[0]

  beforeAll(async () => {
    vi.doMock('@/lib/acces', async (original) => ({
      ...(await original<typeof import('@/lib/acces')>()),
      acteurCourant: async () => acteur.courant,
    }))
    base = await creerBaseJetable()
    process.env.DATABASE_URL = base.url
    db = new Client({ connectionString: base.url })
    await db.connect()
    await db.query(`INSERT INTO "User" (id, email, name, role, "updatedAt") VALUES ('admin-1', 'a1@exemple.test', 'Camille', 'admin', now())`)
    await db.query(`INSERT INTO "User" (id, email, role, "updatedAt") VALUES ('admin-2', 'a2@exemple.test', 'admin', now())`)
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt")
       VALUES ('artiste-1', 'artiste-1', 'Artiste', 'MA', 1980, 'Bio', '', now())`,
    )
  })

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$disconnect()
    await db?.end()
    await base?.supprimer()
  })

  beforeEach(async () => {
    acteur.courant = ADMIN
    vi.restoreAllMocks()
    for (const table of ['DemandeVisite', 'DemandeSelection', 'Artwork']) await db.query(`DELETE FROM "${table}"`)
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "artistId", "updatedAt")
       VALUES ('oeuvre-1', 'aube', 'Aube', 2024, 'Huile', 'D', '', 'artiste-1', now())`,
    )
  })

  it('lecture : seul l’admin voit la file ; visiteur, user et artiste sont refusés par le module', async () => {
    const { fileDesDemandes } = await import('@/lib/demandes')
    await selection('s1', { creeeLe: '2026-11-01T10:00:00Z' })
    for (const a of [VISITEUR, USER, ARTISTE]) {
      expect(await fileDesDemandes(a as never)).toEqual({ ok: false, code: 'acces_refuse' })
    }
    const r = await fileDesDemandes(ADMIN as never)
    expect(r.ok && r.demandes.map((d) => d.id)).toEqual(['s1'])
  })

  it('tri : visites et sélections mêlées, de la plus ancienne à la plus récente, à traiter seulement par défaut', async () => {
    const { fileDesDemandes } = await import('@/lib/demandes')
    await visite('v-recente', { creeeLe: '2026-11-05T10:00:00Z' })
    await selection('s-ancienne', { creeeLe: '2026-11-01T10:00:00Z' })
    await visite('v-milieu', { creeeLe: '2026-11-03T10:00:00Z', etat: 'planifiee' })
    await selection('s-faite', { creeeLe: '2026-11-02T10:00:00Z', etat: 'faite' })
    await visite('v-sans-suite', { creeeLe: '2026-11-04T10:00:00Z', etat: 'sans_suite' })

    const defaut = await fileDesDemandes(ADMIN as never)
    expect(defaut.ok && defaut.demandes.map((d) => d.id)).toEqual(['s-ancienne', 'v-milieu', 'v-recente'])
    const toutes = await fileDesDemandes(ADMIN as never, { traitees: true })
    expect(toutes.ok && toutes.demandes.map((d) => d.id)).toEqual(['s-ancienne', 's-faite', 'v-milieu', 'v-sans-suite', 'v-recente'])
  })

  it('une visite porte le titre et le lien de l’œuvre ; œuvre supprimée : sans lien', async () => {
    const { fileDesDemandes } = await import('@/lib/demandes')
    await visite('v1', { creeeLe: '2026-11-01T10:00:00Z' })
    await db.query(`DELETE FROM "Artwork" WHERE id = 'oeuvre-1'`)
    await visite('v2', { creeeLe: '2026-11-02T10:00:00Z', artwork: null })
    const r = await fileDesDemandes(ADMIN as never)
    expect(r.ok && r.demandes.map((d) => (d.type === 'visite' ? d.oeuvre : 'x'))).toEqual([null, null])
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "artistId", "updatedAt")
       VALUES ('oeuvre-1', 'aube', 'Aube', 2024, 'Huile', 'D', '', 'artiste-1', now())`,
    )
    await db.query(`UPDATE "DemandeVisite" SET "artworkId" = 'oeuvre-1' WHERE id = 'v1'`)
    const r2 = await fileDesDemandes(ADMIN as never)
    expect(r2.ok && r2.demandes[0]).toMatchObject({ type: 'visite', oeuvre: { titre: 'Aube', slug: 'aube' } })
  })

  it('changement d’état : état, auteur et date enregistrés ; la demande quitte la file', async () => {
    const { changerEtatDemande, fileDesDemandes } = await import('@/lib/demandes')
    await visite('v1', { creeeLe: '2026-11-01T10:00:00Z' })
    await selection('s1', { creeeLe: '2026-11-02T10:00:00Z' })
    const avant = Date.now()
    expect(await changerEtatDemande(ADMIN as never, 'visite', 'v1', 'faite')).toEqual({ ok: true })
    expect(await changerEtatDemande(ADMIN as never, 'selection', 's1', 'planifiee')).toEqual({ ok: true })
    const v = await ligne('DemandeVisite', 'v1')
    expect(v).toMatchObject({ etat: 'faite', etatChangePar: 'admin-1' })
    expect(new Date(v.etatChangeLe).getTime()).toBeGreaterThanOrEqual(avant - 1000)
    expect(await ligne('DemandeSelection', 's1')).toMatchObject({ etat: 'planifiee', etatChangePar: 'admin-1' })
    const r = await fileDesDemandes(ADMIN as never)
    expect(r.ok && r.demandes.map((d) => d.id)).toEqual(['s1'])
    expect(r.ok && r.demandes[0].changement?.par).toBe('Camille')
  })

  it('transitions libres (retour à « nouvelle ») ; le dernier changement l’emporte', async () => {
    const { changerEtatDemande } = await import('@/lib/demandes')
    await selection('s1', { creeeLe: '2026-11-01T10:00:00Z' })
    await changerEtatDemande(ADMIN as never, 'selection', 's1', 'faite')
    await changerEtatDemande(AUTRE_ADMIN as never, 'selection', 's1', 'sans_suite')
    expect(await ligne('DemandeSelection', 's1')).toMatchObject({ etat: 'sans_suite', etatChangePar: 'admin-2' })
    await changerEtatDemande(ADMIN as never, 'selection', 's1', 'nouvelle')
    expect(await ligne('DemandeSelection', 's1')).toMatchObject({ etat: 'nouvelle', etatChangePar: 'admin-1' })
  })

  it('refus : non-admin, état inconnu, type inconnu, demande absente ; rien n’est changé', async () => {
    const { changerEtatDemande } = await import('@/lib/demandes')
    await visite('v1', { creeeLe: '2026-11-01T10:00:00Z' })
    for (const a of [VISITEUR, USER, ARTISTE]) {
      expect(await changerEtatDemande(a as never, 'visite', 'v1', 'faite')).toEqual({ ok: false, code: 'acces_refuse' })
    }
    expect(await changerEtatDemande(ADMIN as never, 'visite', 'v1', 'archivee')).toEqual({ ok: false, code: 'invalide' })
    expect(await changerEtatDemande(ADMIN as never, 'visite', 'v1', undefined)).toEqual({ ok: false, code: 'invalide' })
    expect(await changerEtatDemande(ADMIN as never, 'autre', 'v1', 'faite')).toEqual({ ok: false, code: 'invalide' })
    expect(await changerEtatDemande(ADMIN as never, 'visite', 'absente', 'faite')).toEqual({ ok: false, code: 'introuvable' })
    expect(await changerEtatDemande(ADMIN as never, 'visite', 42, 'faite')).toEqual({ ok: false, code: 'introuvable' })
    // Un identifiant de visite n'agit pas sur la table des sélections.
    expect(await changerEtatDemande(ADMIN as never, 'selection', 'v1', 'faite')).toEqual({ ok: false, code: 'introuvable' })
    expect(await ligne('DemandeVisite', 'v1')).toMatchObject({ etat: 'nouvelle', etatChangePar: null, etatChangeLe: null })
  })

  it('action serveur : rôle relu en base (jamais le jeton), refus renvoyé sans exception', async () => {
    const { actionEtatDemande } = await import('@/app/dashboard/admin/demandes/actions')
    const { fr } = await import('@/lib/i18n')
    await visite('v1', { creeeLe: '2026-11-01T10:00:00Z' })
    for (const a of [VISITEUR, USER, ARTISTE]) {
      acteur.courant = a
      expect(await actionEtatDemande('visite', 'v1', 'faite')).toEqual({ ok: false, message: fr.demandes.refus.acces_refuse })
    }
    expect(await ligne('DemandeVisite', 'v1')).toMatchObject({ etat: 'nouvelle' })
    acteur.courant = ADMIN
    expect(await actionEtatDemande('visite', 'v1', 'faite')).toEqual({ ok: true })
    expect(await actionEtatDemande('visite', 'v1', 'x')).toEqual({ ok: false, message: fr.demandes.refus.invalide })
    expect(await ligne('DemandeVisite', 'v1')).toMatchObject({ etat: 'faite', etatChangePar: 'admin-1' })
  })

  it('page : redirection pour visiteur, user et artiste ; l’admin voit type, œuvre, créneaux dans le fuseau du visiteur, date et état', async () => {
    const { default: Page } = await import('@/app/dashboard/admin/demandes/page')
    await visite('v1', { creeeLe: '2026-11-01T10:00:00Z', telephone: '+1 514 555 0199' })
    await selection('s1', { creeeLe: '2026-11-02T10:00:00Z' })
    for (const a of [VISITEUR, USER, ARTISTE]) {
      acteur.courant = a
      await expect(Page({})).rejects.toThrow('redirection:/dashboard')
    }
    acteur.courant = ADMIN
    const texte = await texteDe(await Page({}))
    expect(texte).toContain('Aube')
    expect(texte).toContain('Reçue le 1 novembre 2026')
    expect(texte).toContain('État : Nouvelle')
    // 15 h UTC le 1er décembre = 10 h à Montréal (fuseau du visiteur, pas Paris).
    expect(texte).toContain('mardi 1 décembre 2026 à 10 h 00')
    expect(texte).toContain('visiteur@exemple.test')
    expect(texte).toContain('+1 514 555 0199')
    expect(texte.indexOf('Aube')).toBeLessThan(texte.indexOf('Salon lumineux'))
    expect(texte).toContain('Voir les demandes traitées')
  })

  it('page : « Aucune demande en attente. » quand la file est vide ; « traitées » ajoute faite et sans suite', async () => {
    const { default: Page } = await import('@/app/dashboard/admin/demandes/page')
    expect(await texteDe(await Page({}))).toContain('Aucune demande en attente.')
    await selection('s-faite', { creeeLe: '2026-11-02T10:00:00Z', etat: 'faite' })
    expect(await texteDe(await Page({}))).toContain('Aucune demande en attente.')
    const t = await texteDe(await Page({ searchParams: { traitees: '1' } }))
    expect(t).toContain('État : Faite')
    expect(t).toContain('Masquer les demandes traitées')
  })

  it('page : « Œuvre supprimée » pour une visite sans œuvre', async () => {
    const { default: Page } = await import('@/app/dashboard/admin/demandes/page')
    await visite('v1', { creeeLe: '2026-11-01T10:00:00Z', artwork: null })
    expect(await texteDe(await Page({}))).toContain('Œuvre supprimée')
  })

  it('page : « Dernier changement par … » (auteur existant), « un compte supprimé » (auteur disparu)', async () => {
    const { default: Page } = await import('@/app/dashboard/admin/demandes/page')
    await selection('s1', { creeeLe: '2026-11-01T10:00:00Z' })
    await selection('s2', { creeeLe: '2026-11-02T10:00:00Z' })
    await db.query(`UPDATE "DemandeSelection" SET "etatChangePar" = 'admin-1', "etatChangeLe" = '2026-11-03T10:00:00Z', etat = 'planifiee' WHERE id = 's1'`)
    await db.query(`UPDATE "DemandeSelection" SET "etatChangePar" = 'disparu', "etatChangeLe" = '2026-11-04T10:00:00Z', etat = 'planifiee' WHERE id = 's2'`)
    const texte = await texteDe(await Page({}))
    expect(texte).toContain('Dernier changement par Camille, le 3 novembre 2026')
    expect(texte).toContain('Dernier changement par un compte supprimé, le 4 novembre 2026')
  })

  it('page : ambiances en français', async () => {
    const { default: Page } = await import('@/app/dashboard/admin/demandes/page')
    await db.query(
      `INSERT INTO "DemandeSelection" (id, espace, ambiances, "budgetCentimes", email, "updatedAt")
       VALUES ('s-a', 'Salon', ARRAY['melancolique', 'mysterieuse', 'inconnue'], 1000, 'a@exemple.test', now())`,
    )
    const texte = await texteDe(await Page({}))
    expect(texte).toContain('Mélancolique, Mystérieuse, inconnue')
  })

  it('erreur de lecture : exception sans détail, journal sans donnée personnelle', async () => {
    const { fileDesDemandes } = await import('@/lib/demandes')
    const { prisma } = await import('@/lib/prisma')
    await selection('s1', { creeeLe: '2026-11-01T10:00:00Z' })
    vi.spyOn(prisma.demandeSelection, 'findMany').mockRejectedValueOnce(new Error('selection@exemple.test'))
    const journal = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(fileDesDemandes(ADMIN as never)).rejects.toThrow('file_indisponible')
    expect(JSON.stringify(journal.mock.calls)).not.toContain('exemple.test')
  })

  it('les alertes à l’équipe mènent à la file, sans donnée personnelle', async () => {
    const { fr } = await import('@/lib/i18n')
    const { contenuAlerteDemande, contenuAlerteVisite } = await import('@/lib/notifications/contenus')
    const lien = 'https://www.errancy.art/dashboard/admin/demandes'
    for (const c of [contenuAlerteDemande({ numero: 'n1', lien }), contenuAlerteVisite({ numero: 'n1', lien })]) {
      expect(c.texte).toContain(lien)
    }
    expect(fr.courriels.alerteDemande.bouton).not.toContain('administration')
  })
})
