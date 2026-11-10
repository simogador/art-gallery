import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  MAX_AFFICHAGE,
  PAS_AFFICHAGE,
  adresseGalerie,
  appliquerFiltres,
  filtresActifs,
  lireFiltres,
  optionsDepuis,
  sansFiltre,
} from '@/lib/catalogue/filtres'
import { fr } from '@/lib/i18n'
import type { Artwork } from '@/lib/types'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 3.9 (FR-17, UX-DR20, UX-DR22, UX-DR39) : galerie filtrée pour un mur et un budget.

const jar = vi.hoisted(() => ({ valeurs: new Map<string, string>() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/headers', () => ({
  cookies: () => ({ get: (nom: string) => (jar.valeurs.has(nom) ? { name: nom, value: jar.valeurs.get(nom) } : undefined) }),
  headers: () => new Headers(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  notFound: () => {
    throw new Error('introuvable')
  },
}))

const RACINE = path.resolve(__dirname, '..')

/* ── Adresses et valeurs inconnues ──────────────────────────────────────── */

const options = {
  artistes: [{ slug: 'ana', nom: 'Ana' }, { slug: 'bao', nom: 'Bao' }],
  pays: ['Maroc', 'Vietnam'],
}

describe('filtres : lecture et écriture de l’adresse', () => {
  it('sans paramètre : aucun filtre, 24 œuvres, ordre de la galerie', () => {
    expect(lireFiltres({}, options)).toEqual({ disponibles: false, tri: 'defaut', n: PAS_AFFICHAGE })
    expect(adresseGalerie(lireFiltres({}, options))).toBe('/galerie')
  })

  it('lit les neuf filtres, le tri et le nombre affiché', () => {
    const f = lireFiltres(
      { prix: '3000', format: 'moyen', orientation: 'carre', couleur: 'bleu', ambiance: 'calme', technique: 'art-numerique',
        artiste: 'ana', paysartiste: 'Maroc', dispo: '1', tri: 'prix-croissant', n: '48' },
      options,
    )
    expect(f).toEqual({
      prixMax: 3000, format: 'moyen', orientation: 'carre', couleur: 'bleu', ambiance: 'calme', technique: 'art-numerique',
      artiste: 'ana', pays: 'Maroc', disponibles: true, tri: 'prix-croissant', n: 48,
    })
    expect(filtresActifs(f)).toHaveLength(9)
  })

  it('valeur inconnue ou illisible : ignorée, sans puce', () => {
    const f = lireFiltres(
      { couleur: 'turquoise', ambiance: 'x', format: 'enorme', orientation: '', technique: 'Peinture', prix: '-5', artiste: 'inconnu',
        paysartiste: 'Atlantide', dispo: 'oui', tri: 'hasard', n: 'beaucoup' },
      options,
    )
    expect(f).toEqual({ disponibles: false, tri: 'defaut', n: PAS_AFFICHAGE })
    expect(filtresActifs(f)).toEqual([])
    // Sans options (artistes et pays non vérifiables) : ignorés aussi.
    expect(lireFiltres({ artiste: 'ana', paysartiste: 'Maroc' })).toEqual({ disponibles: false, tri: 'defaut', n: PAS_AFFICHAGE })
  })

  it('prix : entier d’euros seulement ; n : au moins 24, au plus le plafond ; première valeur d’un paramètre répété', () => {
    expect(lireFiltres({ prix: '0' }).prixMax).toBeUndefined()
    expect(lireFiltres({ prix: '12,5' }).prixMax).toBeUndefined()
    expect(lireFiltres({ prix: '1 500' }).prixMax).toBe(1500)
    expect(lireFiltres({ n: '5' }).n).toBe(PAS_AFFICHAGE)
    expect(lireFiltres({ n: String(MAX_AFFICHAGE + 1) }).n).toBe(PAS_AFFICHAGE)
    expect(lireFiltres({ prix: ['100', '200'] }).prixMax).toBe(100)
  })

  it('aller-retour : l’adresse écrite relit les mêmes filtres (retour arrière, partage)', () => {
    const f = lireFiltres({ prix: '900', couleur: 'ocre', artiste: 'bao', dispo: '1', tri: 'prix-decroissant', n: '72' }, options)
    const adresse = adresseGalerie(f, { n: f.n })
    expect(adresse).toBe('/galerie?prix=900&couleur=ocre&artiste=bao&dispo=1&tri=prix-decroissant&n=72')
    const params = Object.fromEntries(new URL(adresse, 'https://x.test').searchParams)
    expect(lireFiltres(params, options)).toEqual(f)
  })

  it('une puce retire son filtre et relance la liste au début (pas de n, tri conservé)', () => {
    const f = lireFiltres({ prix: '900', couleur: 'ocre', tri: 'prix-croissant', n: '72' }, options)
    expect(adresseGalerie(sansFiltre(f, 'prix'))).toBe('/galerie?couleur=ocre&tri=prix-croissant')
    expect(adresseGalerie(sansFiltre(sansFiltre(f, 'prix'), 'couleur'))).toBe('/galerie?tri=prix-croissant')
    expect(adresseGalerie(f, { n: f.n + PAS_AFFICHAGE })).toContain('n=96')
  })
})

/* ── Filtrage et tri sur un catalogue en mémoire ────────────────────────── */

const livree = (totalCentimes: number): Artwork['prixLivre'] => ({
  livree: true, totalCentimes, devise: 'EUR', fraisCentimes: 0, delaiMinJours: 3, delaiMaxJours: 5,
})

function oeuvre(id: string, extra: Partial<Artwork> = {}): Artwork {
  return {
    id, title: id, artist: 'Ana', artistId: 'ana', year: 2024, medium: 'Peinture', technique: 'Huile', price: 0,
    hauteurMm: 600, largeurMm: 800, profondeurMm: null, description: '', certificat: false, tags: [], featured: false,
    sold: false, imageUrl: null, gradient: '', accentColor: '', paysArtiste: 'Maroc',
    prixLivre: livree(100_000), ...extra,
  }
}

describe('filtres : application', () => {
  const catalogue = [
    oeuvre('a', { prixLivre: livree(250_000), couleurDominante: 'bleu', ambiance: 'calme', hauteurMm: 300, largeurMm: 300 }),
    oeuvre('b', { prixLivre: livree(300_000), couleurDominante: 'bleu', hauteurMm: 1200, largeurMm: 800, artistId: 'bao', artist: 'Bao', paysArtiste: 'Vietnam' }),
    oeuvre('c', { prixLivre: { livree: false, raison: 'non_livree' }, couleurDominante: 'rouge', medium: 'Sculpture' }),
    oeuvre('d', { prixLivre: livree(300_001), sold: false, medium: 'Photographie', hauteurMm: 800, largeurMm: 600 }),
    oeuvre('e', { prixLivre: livree(10_000), sold: true }),
    oeuvre('f', { prixLivre: undefined }),
  ]
  const ids = (f: Parameters<typeof appliquerFiltres>[1]) => appliquerFiltres(catalogue, f).map((o) => o.id)
  const base = lireFiltres({})

  it('prix maximum : jamais une œuvre non livrée, vendue ou sans prix livré ; borne incluse, au centime', () => {
    expect(ids({ ...base, prixMax: 3000 })).toEqual(['a', 'b'])
    expect(ids({ ...base, prixMax: 2500 })).toEqual(['a'])
    expect(ids({ ...base, prixMax: 1 })).toEqual([])
  })

  it('format, orientation, couleur, ambiance, technique, artiste, pays : chacun seul', () => {
    expect(ids({ ...base, format: 'petit' })).toEqual(['a'])
    expect(ids({ ...base, format: 'grand' })).toEqual(['b'])
    expect(ids({ ...base, orientation: 'carre' })).toEqual(['a'])
    expect(ids({ ...base, orientation: 'portrait' })).toEqual(['b', 'd'])
    expect(ids({ ...base, couleur: 'bleu' })).toEqual(['a', 'b'])
    expect(ids({ ...base, ambiance: 'calme' })).toEqual(['a'])
    expect(ids({ ...base, technique: 'sculpture' })).toEqual(['c'])
    expect(ids({ ...base, technique: 'photographie' })).toEqual(['d'])
    expect(ids({ ...base, artiste: 'bao' })).toEqual(['b'])
    expect(ids({ ...base, pays: 'Vietnam' })).toEqual(['b'])
    expect(ids({ ...base, disponibles: true })).not.toContain('e')
  })

  it('plusieurs filtres : intersection', () => {
    expect(ids({ ...base, couleur: 'bleu', format: 'grand', artiste: 'bao' })).toEqual(['b'])
    expect(ids({ ...base, couleur: 'bleu', format: 'grand', artiste: 'ana' })).toEqual([])
  })

  it('tri par prix livré : non livrées et vendues en dernier dans les deux sens', () => {
    expect(ids({ ...base, tri: 'prix-croissant' }).slice(0, 3)).toEqual(['a', 'b', 'd'])
    expect(ids({ ...base, tri: 'prix-decroissant' }).slice(0, 3)).toEqual(['d', 'b', 'a'])
    for (const tri of ['prix-croissant', 'prix-decroissant'] as const) {
      expect(ids({ ...base, tri }).slice(3).sort()).toEqual(['c', 'e', 'f'])
    }
    expect(ids(base)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('format ou orientation actif : une œuvre sans dimensions est exclue', () => {
    const sans = [oeuvre('x', { hauteurMm: null }), oeuvre('y', { largeurMm: null })]
    expect(appliquerFiltres(sans, { ...base, format: 'moyen' })).toEqual([])
    expect(appliquerFiltres(sans, { ...base, orientation: 'paysage' })).toEqual([])
    expect(appliquerFiltres(sans, base)).toHaveLength(2)
  })

  it('nationalité avec espace final : retrouvée par le filtre pays de l’artiste', () => {
    const o = [oeuvre('z', { paysArtiste: 'Maroc ' })]
    expect(optionsDepuis(o).pays).toEqual(['Maroc'])
    expect(appliquerFiltres(o, { ...base, pays: 'Maroc' }).map((x) => x.id)).toEqual(['z'])
  })

  it('options : artistes et pays tirés des œuvres, triés', () => {
    expect(optionsDepuis(catalogue)).toEqual({
      artistes: [{ slug: 'ana', nom: 'Ana' }, { slug: 'bao', nom: 'Bao' }],
      pays: ['Maroc', 'Vietnam'],
    })
  })
})

/* ── Base réelle : catalogue, prix livré, page ──────────────────────────── */

describe('galerie sur base réelle', () => {
  let base: BaseJetable
  let db: Client

  async function oeuvre(slug: string, o: { prix: number | null; h?: number; l?: number; couleur?: string; ambiance?: string; medium?: string; artiste?: string; dispo?: string; publication?: string }) {
    await db.query(
      `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", devise, "hauteurMm", "largeurMm",
         "couleurDominante", ambiance, publication, disponibilite, "artistId", "updatedAt")
       VALUES ($1, $1, $1, 2024, $2, 'Description', '', $3, 'EUR', $4, $5, $6, $7, $8::"Publication", $9::"Disponibilite", $10, now())`,
      [slug, o.medium ?? 'Huile sur toile', o.prix, o.h ?? 610, o.l ?? 760, o.couleur ?? null, o.ambiance ?? null,
       o.publication ?? 'publiee', o.dispo ?? 'disponible', o.artiste ?? 'ana'],
    )
  }
  async function offre(slug: string, zone: string, livree: boolean, frais: number | null) {
    await db.query(
      `INSERT INTO "OffreLivraison" (id, "artworkId", "zoneId", livree, "fraisCentimes", "preparationJours", "transportMinJours", "transportMaxJours", devise, "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, 'EUR', now())`,
      [slug, zone, livree, frais, livree ? 3 : null, livree ? 4 : null, livree ? 8 : null],
    )
  }

  beforeAll(async () => {
    base = await creerBaseJetable()
    process.env.DATABASE_URL = base.url
    db = new Client({ connectionString: base.url })
    await db.connect()
    for (const [slug, nom, pays] of [['ana', 'Ana', 'Maroc'], ['bao', 'Bao', 'Vietnam']]) {
      await db.query(
        `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "accordSigneLe", "updatedAt")
         VALUES ($1, $1, $2, $3, 1980, 'Bio', '', now(), now())`,
        [slug, nom, pays],
      )
    }
    await db.query(`INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "updatedAt") VALUES ('sans-accord', 'sans-accord', 'Sans accord', 'Peru', 1980, 'Bio', '', now())`)
    await db.query(`INSERT INTO "Zone" (id, nom, "updatedAt") VALUES ('z-ue', 'ue', now()), ('z-am', 'am', now())`)
    await db.query(`INSERT INTO "ZonePays" ("codePays", "zoneId") VALUES ('FR', 'z-ue'), ('US', 'z-am')`)

    await oeuvre('bleue-pas-chere', { prix: 100_000, couleur: 'bleu', ambiance: 'calme', h: 300, l: 300 })
    await oeuvre('bleue-chere', { prix: 400_000, couleur: 'bleu', artiste: 'bao', h: 1200, l: 900 })
    await oeuvre('rouge', { prix: 150_000, couleur: 'rouge', medium: 'Bronze', ambiance: 'intense' })
    await oeuvre('vendue', { prix: 50_000, dispo: 'vendue' })
    await oeuvre('sans-prix', { prix: null })
    await oeuvre('brouillon', { prix: 10_000, publication: 'brouillon' })
    await oeuvre('sans-accord', { prix: 10_000, artiste: 'sans-accord' })
    for (const s of ['bleue-pas-chere', 'bleue-chere', 'rouge', 'vendue', 'sans-prix', 'brouillon', 'sans-accord']) {
      await offre(s, 'z-ue', true, 20_000)
    }
    await offre('bleue-pas-chere', 'z-am', false, null)
    await offre('rouge', 'z-am', true, 90_000)
  })

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$disconnect()
    await db?.end()
    await base?.supprimer()
  })

  const html = async (params: Record<string, string>, pays?: string) => {
    jar.valeurs.clear()
    if (pays) jar.valeurs.set('pays', pays)
    const { default: Galerie } = await import('@/app/galerie/page')
    return renderToStaticMarkup(await Galerie({ searchParams: params }))
  }
  const liens = (h: string) => [...h.matchAll(/href="\/galerie\/([^"]+)"/g)].map((m) => m[1])

  it('sans filtre : œuvres visibles seulement (ni brouillon, ni artiste sans accord), ligne de résultats juste', async () => {
    const h = await html({})
    expect(liens(h).sort()).toEqual(['bleue-chere', 'bleue-pas-chere', 'rouge', 'sans-prix', 'vendue'])
    expect(h).toContain('5 œuvres')
    expect(h).toContain('prix livré France')
  })

  it('prix maximum : toute œuvre listée a sur sa fiche un prix livré ≤ au maximum, pour le même pays', async () => {
    const { lireGalerie, getArtworkBySlug } = await import('@/lib/catalogue')
    for (const [pays, prix] of [['FR', '1700'], ['FR', '1200'], ['FR', '5000'], ['US', '1500'], ['US', '2400'], ['CA', '9999']] as const) {
      const lue = await lireGalerie(pays, { prix })
      for (const o of lue.oeuvres) {
        const fiche = await getArtworkBySlug(o.id, pays)
        expect(fiche?.prixLivre?.livree, `${o.id} ${pays}`).toBe(true)
        if (fiche?.prixLivre?.livree) expect(fiche.prixLivre.totalCentimes).toBeLessThanOrEqual(Number(prix) * 100)
        expect(fiche?.prixLivre).toEqual(o.prixLivre)
        expect(fiche?.sold).toBe(false)
      }
    }
    expect((await lireGalerie('FR', { prix: '1200' })).oeuvres.map((o) => o.id)).toEqual(['bleue-pas-chere'])
    expect((await lireGalerie('FR', { prix: '1700' })).oeuvres.map((o) => o.id).sort()).toEqual(['bleue-pas-chere', 'rouge'])
    // Vers les États-Unis : « bleue-pas-chere » n'est pas livrée, jamais retenue ; 1 000 + 900 € pour « rouge ».
    expect((await lireGalerie('US', { prix: '2400' })).oeuvres.map((o) => o.id)).toEqual(['rouge'])
    expect((await lireGalerie('US', { prix: '2300' })).oeuvres).toEqual([])
    // Pays sans zone : rien.
    expect((await lireGalerie('CA', { prix: '9999' })).total).toBe(0)
  })

  it('filtres combinés, puces et retrait', async () => {
    const h = await html({ couleur: 'bleu', format: 'petit', ambiance: 'calme', artiste: 'ana' })
    expect(liens(h)).toEqual(['bleue-pas-chere'])
    expect(h).toContain('1 œuvre')
    expect(h).toContain('Retirer le filtre : Bleu')
    expect(h).toContain('Retirer le filtre : Petit format')
    expect(h).toContain('href="/galerie?format=petit&amp;ambiance=calme&amp;artiste=ana"')
    expect(h).not.toContain('Aucune œuvre ne correspond')
  })

  it('valeur inconnue : ignorée, aucune puce', async () => {
    const h = await html({ couleur: 'turquoise', artiste: 'fantome' })
    expect(h).not.toContain('Retirer le filtre')
    expect(liens(h)).toHaveLength(5)
  })

  it('aucun résultat : message et lien qui retire le dernier filtre', async () => {
    const h = await html({ couleur: 'bleu', ambiance: 'intense' })
    expect(h).toContain(fr.galerie.vide)
    expect(h).toContain(fr.galerie.retirerDernier)
    expect(h).toContain('href="/galerie?couleur=bleu"')
    expect(liens(h)).toEqual([])
  })

  it('pays de l’artiste et technique : options tirées des œuvres visibles', async () => {
    const h = await html({ paysartiste: 'Vietnam' })
    expect(liens(h)).toEqual(['bleue-chere'])
    expect(h).toContain('<option value="Maroc">Maroc</option>')
    expect(h).not.toContain('Peru')
    expect(liens(await html({ technique: 'sculpture' }))).toEqual(['rouge'])
  })

  it('vignette : une seule cible, prix livré et délai ; vendue sans prix ; aucun texte promotionnel', async () => {
    const h = await html({ couleur: 'bleu' })
    const carte = h.slice(h.indexOf('<article'), h.indexOf('</article>'))
    expect(carte.match(/<a /g)).toHaveLength(1)
    expect(carte).not.toContain('<button')
    expect(carte).toContain('Livrée sous 7 à 11 jours')
    expect(carte).toContain('Droits et taxes d’import éventuels non inclus')
    const v = await html({})
    const vendue = v.slice(v.indexOf('>vendue</h2>'), v.indexOf('</article>', v.indexOf('>vendue</h2>')))
    expect(vendue).toContain('Vendue')
    expect(vendue).not.toContain('€')
    expect(v).not.toMatch(/<s>|<del>|line-through|Promo|dernière chance/i)
  })

  it('plus d’œuvres : n augmente le nombre affiché, le lien disparaît quand il n’en reste pas', async () => {
    const { lireGalerie } = await import('@/lib/catalogue')
    expect((await lireGalerie('FR', { n: '24' })).oeuvres).toHaveLength(5)
    expect(await html({})).not.toContain(fr.galerie.afficherPlus)
    for (let i = 0; i < 30; i++) await oeuvre(`lot-${String(i).padStart(2, '0')}`, { prix: 100_000 + i })
    const premiere = await html({ tri: 'prix-croissant' })
    expect(liens(premiere)).toHaveLength(24)
    expect(premiere).toContain('35 œuvres')
    expect(premiere).toContain('href="/galerie?tri=prix-croissant&amp;n=48"')
    const suite = await html({ tri: 'prix-croissant', n: '48' })
    expect(liens(suite)).toHaveLength(35)
    expect(suite).not.toContain(fr.galerie.afficherPlus)
    await db.query(`DELETE FROM "Artwork" WHERE slug LIKE 'lot-%'`)
  })

  it('pays du cookie : prix livré et ligne de résultats suivent le pays', async () => {
    const h = await html({ prix: '2400' }, 'US')
    expect(liens(h)).toEqual(['rouge'])
    expect(h).toContain('prix livré États-Unis')
  })
})

/* ── Sources ────────────────────────────────────────────────────────────── */

describe('galerie : sources', () => {
  const lire = (f: string) => readFileSync(path.join(RACINE, f), 'utf8')

  it('l’introduction ne promet ni certificat, ni assurance, ni installation', () => {
    const textes = JSON.stringify(fr.galerie).toLowerCase()
    for (const mot of ['certificat', 'assur', 'installation', 'authentifi']) expect(textes, mot).not.toContain(mot)
  })

  it('canonique de /galerie et états de la fiche', async () => {
    const { metadata } = await import('@/app/galerie/page')
    expect(metadata.alternates?.canonical).toBe('https://www.errancy.art/galerie')
    expect(lire('src/app/galerie/[id]/loading.tsx')).toContain('return null')
    expect(lire('src/app/galerie/[id]/error.tsx')).toContain('fr.galerie.erreurPage')
  })

  it('grille : 2 colonnes, 3 de md à lg, 4 au-delà ; loading et error présents', () => {
    const page = lire('src/app/galerie/page.tsx')
    expect(page).toContain('grid-cols-2')
    expect(page).toContain('md:grid-cols-3')
    expect(page).toContain('lg:grid-cols-4')
    expect(lire('src/app/galerie/loading.tsx')).toContain('bg-neutral-200')
    expect(lire('src/app/galerie/error.tsx')).toContain('fr.galerie.reessayer')
  })
})
