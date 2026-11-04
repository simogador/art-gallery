import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@/generated/prisma/client'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 2.10 (AD-20 temps 4, AD-6) : les anciennes colonnes Artwork.available, Artwork.price et
// Artwork.dimensions ne sont plus ni lues ni écrites, puis disparaissent du schéma (migrations A et B).

const acteur = vi.hoisted(() => ({ courant: { type: 'visiteur' } as Record<string, unknown> }))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => acteur.courant }))
const stripe = vi.hoisted(() => ({ evenement: vi.fn() }))
vi.mock('@/lib/stripe', () => ({ getStripe: () => ({ webhooks: { constructEvent: stripe.evenement } }) }))

const ANCIENNES = ['available', 'price', 'dimensions'] as const
const CLE = new RegExp(`\\b(${ANCIENNES.join('|')})\\b\\s*:`)

const fichiers = (dossier: string): string[] =>
  readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom)
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(ts|tsx)$/.test(nom) ? [chemin] : []
  })

// Texte entre la parenthèse ou l'accolade ouvrante en `debut` et sa fermante (chaînes ignorées).
function bloc(texte: string, debut: number): string {
  const ouvrante = texte[debut]
  const fermante = ouvrante === '(' ? ')' : '}'
  let profondeur = 0
  for (let i = debut; i < texte.length; i++) {
    if (texte[i] === ouvrante) profondeur++
    else if (texte[i] === fermante && --profondeur === 0) return texte.slice(debut, i + 1)
  }
  return texte.slice(debut)
}

const sansCommentaires = (texte: string) => texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/**
 * Accès Prisma à une ancienne colonne dans un fichier de src/ : clé `available`, `price` ou
 * `dimensions` dans l'argument d'un appel `….artwork.<méthode>(…)`, dans une sélection imbriquée
 * `artworks: { … }` / `artwork: { … }`, dans un objet constant passé à ces appels, ou affectation
 * `data.<colonne>` ; colonne nommée dans une requête SQL brute sur "Artwork".
 */
function accesAnciennesColonnes(fichier: string): string[] {
  const texte = sansCommentaires(readFileSync(fichier, 'utf8'))
  const trouves: string[] = []
  const blocs: string[] = []
  for (const m of texte.matchAll(/\.artwork\.\w+\s*\(/g)) blocs.push(bloc(texte, m.index! + m[0].length - 1))
  for (const m of texte.matchAll(/\bartworks?\s*:\s*\{/g)) blocs.push(bloc(texte, m.index! + m[0].length - 1))
  // Objets constants nommés dans ces blocs (select: CHAMPS, where: VISIBLE, ...CHAMPS_ETAT).
  const noms = new Set(blocs.flatMap((b) => [...b.matchAll(/(?::|\.\.\.)\s*([A-Z_][A-Za-z0-9_]*)\b/g)].map((m) => m[1])))
  for (const nom of noms) {
    const def = new RegExp(`\\bconst\\s+${nom}\\b[^=]*=\\s*\\{`).exec(texte)
    if (def) blocs.push(bloc(texte, def.index + def[0].length - 1))
  }
  for (const b of blocs) if (CLE.test(b)) trouves.push(`${fichier}: ${b.slice(0, 120).replace(/\s+/g, ' ')}`)
  for (const m of texte.matchAll(new RegExp(`\\bdata(?:\\.|\\[['"])(${ANCIENNES.join('|')})\\b`, 'g'))) {
    trouves.push(`${fichier}: ${m[0]}`)
  }
  for (const m of texte.matchAll(/`[^`]*`/g)) {
    if (/"Artwork"/.test(m[0]) && new RegExp(`\\b(${ANCIENNES.join('|')})\\b`).test(m[0])) {
      trouves.push(`${fichier}: ${m[0].slice(0, 120).replace(/\s+/g, ' ')}`)
    }
  }
  return trouves
}

describe('plus aucune lecture ni écriture des anciennes colonnes', () => {
  it('le schéma Prisma ne les décrit plus', () => {
    for (const colonne of ANCIENNES) expect(Object.keys(Prisma.ArtworkScalarFieldEnum)).not.toContain(colonne)
  })

  it('aucun fichier de src/ (hors src/generated) ne les nomme comme colonne d’Artwork dans une requête', () => {
    const trouves = fichiers('src')
      .filter((f) => !f.split(path.sep).join('/').startsWith('src/generated/'))
      .flatMap(accesAnciennesColonnes)
    expect(trouves).toEqual([])
  })

  it('le contrôle détecte un accès (témoin)', () => {
    const dossier = mkdtempSync(path.join(tmpdir(), 'temoin-'))
    const temoin = path.join(dossier, 'temoin.ts')
    const exemples = [
      "await prisma.artwork.update({ where: { slug }, data: { disponibilite, available: false } })",
      "const CHAMPS = { slug: true, price: true }\nawait tx.artwork.findMany({ select: CHAMPS })",
      "await prisma.artist.findMany({ include: { artworks: { select: { dimensions: true } } } })",
      "data.price = 10",
      'await tx.$queryRaw`SELECT "available" FROM "Artwork"`',
    ]
    try {
      for (const exemple of exemples) {
        writeFileSync(temoin, exemple)
        expect(accesAnciennesColonnes(temoin), exemple).not.toEqual([])
      }
      // Clés de corps de requête et types d'affichage : pas des colonnes.
      writeFileSync(temoin, "const disponible = body.available\nconst carte = { price: 10, size: '' }")
      expect(accesAnciennesColonnes(temoin)).toEqual([])
    } finally {
      rmSync(dossier, { recursive: true, force: true })
    }
  })
})

// Base après la migration A seulement (préversion, et production entre la fusion et B) : les trois
// colonnes existent encore, `dimensions` NOT NULL avec la valeur par défaut ''. Le nouveau code ne doit
// pas les toucher.
describe('base après la migration A : le nouveau code ignore les anciennes colonnes', () => {
  let base: BaseJetable
  let db: Client
  const ARTISTE = { type: 'artist', userId: 'utilisateur-1', artiste: { id: 'artiste-1', slug: 'artiste-1', name: 'Artiste Un' } }
  const ADMIN = { type: 'admin', userId: 'admin-1' }

  const anciennes = async (slug: string) =>
    (
      await db.query(
        `SELECT available, price, dimensions, publication::text AS publication, disponibilite::text AS disponibilite,
                "prixCentimes", "hauteurMm", "largeurMm"
         FROM "Artwork" WHERE slug = $1`,
        [slug],
      )
    ).rows[0]

  beforeAll(async () => {
    base = await creerBaseJetable()
    process.env.DATABASE_URL = base.url
    db = new Client({ connectionString: base.url })
    await db.connect()
    // État exact de la base après A (avant B) : colonnes telles que créées par 20260519111355_init,
    // puis le fichier de la migration A lu sur le disque (un fichier A vide ferait échouer le dépôt).
    await db.query(
      `ALTER TABLE "Artwork" ADD COLUMN "dimensions" TEXT NOT NULL, ADD COLUMN "price" DOUBLE PRECISION,
                             ADD COLUMN "available" BOOLEAN NOT NULL DEFAULT true`,
    )
    const migrationA = readdirSync('prisma/migrations').filter((nom) => nom.endsWith('_dimensions_par_defaut'))
    expect(migrationA).toHaveLength(1)
    await db.query(readFileSync(path.join('prisma/migrations', migrationA[0], 'migration.sql'), 'utf8'))
    await db.query(`INSERT INTO "User" (id, email, role, "updatedAt") VALUES ('utilisateur-1', 'a@exemple.test', 'artist', now())`)
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt", "userId", "accordSigneLe")
       VALUES ('artiste-1', 'artiste-1', 'Artiste Un', 'MA', 1980, 'Bio', '', now(), 'utilisateur-1', '2026-11-01')`,
    )
  })

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$disconnect()
    await db?.end()
    await base?.supprimer()
  })

  beforeEach(async () => {
    acteur.courant = { type: 'visiteur' }
    await db.query('DELETE FROM "Artwork"')
  })

  // Œuvre écrite par l'ancien code (double écriture) : anciennes et nouvelles colonnes cohérentes.
  async function oeuvreDeLAncienCode(slug: string) {
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", dimensions, price, available,
                              "prixCentimes", "hauteurMm", "largeurMm", publication, disponibilite, "artistId", "updatedAt")
       VALUES ($1, $1, 'Ancienne', 2020, 'Huile', 'D', '', '10 × 10 cm', 100, true,
               10000, 100, 100, 'publiee', 'disponible', 'artiste-1', now())`,
      [slug],
    )
  }

  it('dépôt : le brouillon est créé sans écrire price ni dimensions (valeurs par défaut de la base)', async () => {
    const { enregistrerChamp } = await import('@/lib/curation')
    const cree = await enregistrerChamp(ARTISTE as never, null, 'titre', 'Sans anciennes colonnes')
    if (!cree.ok) throw new Error(cree.code)
    for (const [champ, valeur] of [['prix', '1 250,50'], ['hauteur', '60'], ['largeur', '80']] as const) {
      expect((await enregistrerChamp(ARTISTE as never, cree.depot.slug, champ, valeur)).ok, champ).toBe(true)
    }
    expect(await anciennes(cree.depot.slug)).toEqual({
      available: true, price: null, dimensions: '', publication: 'brouillon', disponibilite: 'disponible',
      prixCentimes: 125050, hauteurMm: 600, largeurMm: 800,
    })
  })

  it('administration : édition et bascules ne changent que les colonnes exactes et les deux axes', async () => {
    await oeuvreDeLAncienCode('ancienne')
    acteur.courant = ADMIN
    const { PUT } = await import('@/app/api/admin/oeuvres/[slug]/route')
    const modifier = (corps: unknown) =>
      PUT(
        new Request('http://localhost/api/admin/oeuvres/ancienne', { method: 'PUT', body: JSON.stringify(corps) }) as never,
        { params: Promise.resolve({ slug: 'ancienne' }) },
      )
    expect((await modifier({ price: '250', dimensions: '20 × 30 cm' })).status).toBe(200)
    expect((await modifier({ available: false })).status).toBe(200)
    expect((await modifier({ publiee: false })).status).toBe(200)
    expect(await anciennes('ancienne')).toEqual({
      available: true, price: 100, dimensions: '10 × 10 cm', publication: 'brouillon', disponibilite: 'vendue',
      prixCentimes: 25000, hauteurMm: 200, largeurMm: 300,
    })
  })

  it('édition : le texte prérempli renvoyé tel quel garde des dimensions partielles', async () => {
    await oeuvreDeLAncienCode('partielle')
    await db.query(`UPDATE "Artwork" SET "largeurMm" = NULL, "profondeurMm" = 40 WHERE slug = 'partielle'`)
    acteur.courant = ADMIN
    const { PUT } = await import('@/app/api/admin/oeuvres/[slug]/route')
    const modifier = (corps: unknown) =>
      PUT(
        new Request('http://localhost/api/admin/oeuvres/partielle', { method: 'PUT', body: JSON.stringify(corps) }) as never,
        { params: Promise.resolve({ slug: 'partielle' }) },
      )
    // Sans largeur, le formulaire est prérempli vide (formaterDimensions) : renvoyé tel quel, rien n'est effacé.
    expect((await modifier({ price: '300', dimensions: '' })).status).toBe(200)
    const lue = (await db.query(`SELECT "hauteurMm", "largeurMm", "profondeurMm", "prixCentimes" FROM "Artwork" WHERE slug = 'partielle'`)).rows[0]
    expect(lue).toEqual({ hauteurMm: 100, largeurMm: null, profondeurMm: 40, prixCentimes: 30000 })
    // Un nouveau texte remplace les trois colonnes.
    expect((await modifier({ dimensions: '20 × 30 cm' })).status).toBe(200)
    const remplacee = (await db.query(`SELECT "hauteurMm", "largeurMm", "profondeurMm" FROM "Artwork" WHERE slug = 'partielle'`)).rows[0]
    expect(remplacee).toEqual({ hauteurMm: 200, largeurMm: 300, profondeurMm: null })
  })

  it('webhook de paiement : seule la disponibilité change', async () => {
    await oeuvreDeLAncienCode('payee')
    stripe.evenement.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_a', payment_intent: 'pi_a', amount_total: 10000, currency: 'eur',
          metadata: { artworkIds: 'payee', userId: 'utilisateur-1' }, customer_details: null,
        },
      },
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const reponse = await POST(
      new Request('http://localhost/api/webhooks/stripe', {
        method: 'POST', headers: { 'stripe-signature': 'signature' }, body: '{}',
      }) as never,
    )
    expect(reponse.status).toBe(200)
    expect(await anciennes('payee')).toMatchObject({ available: true, price: 100, dimensions: '10 × 10 cm', disponibilite: 'vendue' })
  })
})
