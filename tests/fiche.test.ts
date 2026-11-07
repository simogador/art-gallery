import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { photosDeFiche } from '@/lib/catalogue/mappers'
import {
  SEUIL_FORMAT_GRAND_CM,
  SEUIL_FORMAT_PETIT_CM,
  formatOeuvre,
  orientationOeuvre,
} from '@/lib/reglages'
import { UniteProvider } from '@/components/ui/UniteToggle'
import { CarrouselPhotos } from '@/app/galerie/[id]/CarrouselPhotos'
import { ArtworkDetail } from '@/app/galerie/[id]/ArtworkDetail'
import { RangeeFiche } from '@/app/galerie/[id]/RangeeFiche'
import { fr, formaterMontant } from '@/lib/i18n'
import type { Artwork, PhotoFiche } from '@/lib/types'
import { creerBaseJetable, type BaseJetable } from './utils/base-jetable'

// Story 3.5 (FR-1 à FR-4, UX-DR15, UX-DR17, UX-DR18) : photos de la fiche et rangée
// Taille / Prix livré / Délai.

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }), usePathname: () => '/' }))

const F = '\u202f'
const RACINE = path.resolve(__dirname, '..')

const photo = (type: string, url = `https://res.cloudinary.com/x/${type}.jpg`) => ({ type, url, largeur: 800, hauteur: 1000 })

describe('photosDeFiche', () => {
  it('mise en situation d’abord, puis face, puis gros plan ; la vidéo est exclue', () => {
    const photos = photosDeFiche(
      [photo('gros_plan'), photo('video', 'https://res.cloudinary.com/x/v.mp4'), photo('face_lumiere_du_jour'), photo('mise_en_situation')],
      'https://res.cloudinary.com/x/principale.jpg',
    )
    expect(photos.map((p) => p.type)).toEqual(['mise_en_situation', 'face_lumiere_du_jour', 'gros_plan'])
  })

  it('sans PhotoOeuvre : repli sur imageUrl (une photo) ; sans rien : liste vide', () => {
    expect(photosDeFiche([], 'https://res.cloudinary.com/x/a.jpg')).toEqual([
      { url: 'https://res.cloudinary.com/x/a.jpg', type: 'principale', largeur: null, hauteur: null },
    ])
    expect(photosDeFiche(undefined, 'https://res.cloudinary.com/x/a.jpg')).toHaveLength(1)
    expect(photosDeFiche([photo('video')], 'https://res.cloudinary.com/x/a.jpg')[0].type).toBe('principale')
    expect(photosDeFiche([], null)).toEqual([])
  })
})

describe('format et orientation (reglages)', () => {
  it('seuils : 40 et 100 cm, bornes incluses dans « moyen »', () => {
    expect(SEUIL_FORMAT_PETIT_CM).toBe(40)
    expect(SEUIL_FORMAT_GRAND_CM).toBe(100)
    expect(formatOeuvre(300, 200)).toBe('petit')
    expect(formatOeuvre(399, 100)).toBe('petit')
    expect(formatOeuvre(400, 100)).toBe('moyen')
    expect(formatOeuvre(1000, 300)).toBe('moyen')
    expect(formatOeuvre(300, 1000)).toBe('moyen')
    expect(formatOeuvre(1001, 300)).toBe('grand')
  })

  it('le plus grand côté décide, hauteur ou largeur', () => {
    expect(formatOeuvre(300, 1200)).toBe('grand')
    expect(formatOeuvre(1200, 300)).toBe('grand')
  })

  it('un seuil modifié change le format, sans autre changement', () => {
    expect(formatOeuvre(500, 400, { petit: 40, grand: 100 })).toBe('moyen')
    expect(formatOeuvre(500, 400, { petit: 60, grand: 100 })).toBe('petit')
    expect(formatOeuvre(500, 400, { petit: 40, grand: 45 })).toBe('grand')
  })

  it('dimensions absentes : ni format ni orientation', () => {
    expect(formatOeuvre(null, 500)).toBeNull()
    expect(formatOeuvre(500, null)).toBeNull()
    expect(orientationOeuvre(null, 500)).toBeNull()
    expect(orientationOeuvre(0, 500)).toBeNull()
  })

  it('orientation : carré à 5 % près', () => {
    expect(orientationOeuvre(760, 610)).toBe('portrait')
    expect(orientationOeuvre(610, 760)).toBe('paysage')
    expect(orientationOeuvre(1000, 950)).toBe('carre')
    expect(orientationOeuvre(950, 1000)).toBe('carre')
    expect(orientationOeuvre(1000, 949)).toBe('portrait')
    expect(orientationOeuvre(500, 500)).toBe('carre')
  })

  it('les composants ne codent aucun seuil : ils lisent reglages', () => {
    const rangee = readFileSync(path.join(RACINE, 'src/app/galerie/[id]/RangeeFiche.tsx'), 'utf8')
    expect(rangee).toContain("from '@/lib/reglages'")
    expect(rangee).not.toMatch(/\b(40|100)\b/)
  })
})

const oeuvre = (surcharge: Partial<Artwork> = {}): Artwork => ({
  id: 'o', title: 'Titre', artist: 'Kara', artistId: 'kara', year: 2024, medium: 'Peinture', technique: 'Huile',
  price: 1450, hauteurMm: 760, largeurMm: 610, profondeurMm: null, description: '', tags: [], featured: false,
  sold: false, imageUrl: null, gradient: '', accentColor: '#000', ...surcharge,
})
const pays = { code: 'FR', nom: 'France' }
const rendreRangee = (a: Artwork, unite: 'cm' | 'in' = 'cm') =>
  renderToStaticMarkup(h(UniteProvider, { initiale: unite, children: h(RangeeFiche, { artwork: a, pays }) }))

describe('RangeeFiche', () => {
  const livree: Artwork['prixLivre'] = {
    livree: true, totalCentimes: 149000, devise: 'EUR', fraisCentimes: 4000, delaiMinJours: 8, delaiMaxJours: 12,
  }

  it('pays livré : taille, prix total, délai, mention des droits', () => {
    const html = rendreRangee(oeuvre({ prixLivre: livree }))
    expect(html.indexOf('Taille')).toBeLessThan(html.indexOf('Prix livré'))
    expect(html.indexOf('Prix livré')).toBeLessThan(html.indexOf('Délai'))
    expect(html).toContain(`76${F}×${F}61${F}cm`)
    expect(html).toContain(`29,9${F}×${F}24${F}in`)
    expect(html).toContain('Portrait')
    expect(html).toContain('Format moyen')
    expect(html).toContain(formaterMontant(149000))
    expect(html).toContain('8 à 12 jours')
    expect(html).toContain('Modifier')
    expect(html).toContain('Droits et taxes d’import éventuels non inclus')
    expect(html.indexOf('</dl>')).toBeLessThan(html.indexOf('Droits et taxes'))
  })

  it('unité choisie d’abord', () => {
    const html = rendreRangee(oeuvre({ prixLivre: livree }), 'in')
    expect(html.indexOf(`29,9${F}×${F}24${F}in`)).toBeLessThan(html.indexOf(`76${F}×${F}61${F}cm`))
  })

  it('pays non livré : phrase de la case et phrase de l’artiste, pas de mention des droits', () => {
    const html = rendreRangee(oeuvre({ prixLivre: { livree: false, raison: 'non_livree' } }))
    expect(html).toContain('Pas de livraison vers France')
    expect(html).toContain('Kara ne livre pas encore France.')
    expect(html).not.toContain('Droits et taxes')
  })

  it('dimensions absentes : « — », ni orientation ni format', () => {
    const html = rendreRangee(oeuvre({ hauteurMm: null, prixLivre: livree }))
    expect(html).not.toContain('Portrait')
    expect(html).not.toContain('Format moyen')
    expect(html).not.toContain(' cm')
    expect(html).toContain('—')
  })

  it('œuvre sans prix : « — » à la place du prix', () => {
    const html = rendreRangee(oeuvre({ prixLivre: { livree: false, raison: 'sans_prix' } }))
    expect(html).not.toContain('Pas de livraison')
  })
})

describe('délai et fiche complète', () => {
  const livree: Artwork['prixLivre'] = {
    livree: true, totalCentimes: 149000, devise: 'EUR', fraisCentimes: 4000, delaiMinJours: 8, delaiMaxJours: 12,
  }
  const fiche = (a: Artwork) =>
    renderToStaticMarkup(h(UniteProvider, { initiale: 'cm', children: h(ArtworkDetail, { artwork: a, related: [], artist: null, pays }) }))

  it('delaiJours : singulier et pluriel', () => {
    expect(fr.fiche.rangee.delaiJours(1, 1)).toBe('1 jour')
    expect(fr.fiche.rangee.delaiJours(2, 2)).toBe('2 jours')
  })

  it('œuvre sans prix ou prixLivre absent : « — » dans la case Prix livré', () => {
    for (const prixLivre of [{ livree: false, raison: 'sans_prix' } as const, undefined]) {
      const html = rendreRangee(oeuvre({ prixLivre }))
      const case_ = html.slice(html.indexOf('Prix livré'), html.indexOf('Délai'))
      expect(case_).toContain('—')
      expect(case_).not.toContain('Pas de livraison')
    }
  })

  it('titre et rangée précèdent le carrousel dans le HTML', () => {
    const html = fiche(oeuvre({ prixLivre: livree, photos: [{ url: 'https://res.cloudinary.com/x/a.jpg', type: 'mise_en_situation', largeur: 8, hauteur: 10 }] }))
    const carrousel = html.indexOf('aria-roledescription="carrousel"')
    expect(carrousel).toBeGreaterThan(0)
    for (const repere of ['<h1', 'Taille', 'Prix livré', 'Délai']) {
      expect(html.indexOf(repere), repere).toBeGreaterThan(-1)
      expect(html.indexOf(repere), repere).toBeLessThan(carrousel)
    }
  })

  it('œuvre vendue : taille affichée, pas de rangée', () => {
    const html = fiche(oeuvre({ sold: true }))
    expect(html).toContain(`76${F}×${F}61${F}cm`)
    expect(html).not.toContain('Taille, prix livré et délai')
    expect(html).not.toContain('Délai')
  })

  it('badge « Coup de cœur » pour une œuvre featured', () => {
    expect(fiche(oeuvre({ featured: true, prixLivre: livree }))).toContain('Coup de cœur')
    expect(fiche(oeuvre({ prixLivre: livree }))).not.toContain('Coup de cœur')
  })
})

describe('CarrouselPhotos', () => {
  const photos: PhotoFiche[] = [
    { url: 'https://res.cloudinary.com/x/a.jpg', type: 'mise_en_situation', largeur: 800, hauteur: 1000 },
    { url: 'https://res.cloudinary.com/x/b.jpg', type: 'face_lumiere_du_jour', largeur: 800, hauteur: 1000 },
    { url: 'https://res.cloudinary.com/x/c.jpg', type: 'gros_plan', largeur: 800, hauteur: 1000 },
  ]
  const rendre = (liste: PhotoFiche[]) =>
    renderToStaticMarkup(h(CarrouselPhotos, { photos: liste, titre: 'Titre', artiste: 'Kara', gradient: '', accentColor: '#000' }))

  it('trois photos : compteur 1/3, légende de la mise en situation, boutons, texte alternatif complet', () => {
    const html = rendre(photos)
    expect(html).toContain('1/3')
    expect(html).toContain(fr.fiche.photos.legendes.mise_en_situation)
    expect(html).toContain('Photo précédente')
    expect(html).toContain('Photo suivante')
    expect(html).toContain('Titre, Kara')
    expect(html).toContain(fr.fiche.photos.legendes.gros_plan)
    // Première photo en tête.
    expect(html.indexOf('a.jpg')).toBeLessThan(html.indexOf('b.jpg'))
  })

  it('une seule photo : ni compteur ni boutons, légende « Photo de l’œuvre »', () => {
    const html = rendre([{ url: 'https://res.cloudinary.com/x/a.jpg', type: 'principale', largeur: null, hauteur: null }])
    expect(html).not.toContain('1/1')
    expect(html).not.toContain('Photo précédente')
    expect(html).not.toContain('Photo suivante')
    expect(html).toContain('Photo de l’œuvre')
  })

  it('jamais de défilement automatique', () => {
    const source = readFileSync(path.join(RACINE, 'src/app/galerie/[id]/CarrouselPhotos.tsx'), 'utf8')
    expect(source).not.toMatch(/setInterval|autoplay|autoPlay/)
  })
})

describe('base : photos de la fiche', () => {
  let base: BaseJetable
  let db: Client

  beforeAll(async () => {
    base = await creerBaseJetable()
    process.env.DATABASE_URL = base.url
    db = new Client({ connectionString: base.url })
    await db.connect()
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "accordSigneLe", "updatedAt")
       VALUES ('art-f', 'art-f', 'Artiste F', 'MA', 1980, 'Bio', '', now(), now())`,
    )
    const insere = (slug: string) =>
      db.query(
        `INSERT INTO "Artwork" (id, slug, title, year, medium, description, "imageUrl", "prixCentimes", devise, "hauteurMm", "largeurMm",
           publication, disponibilite, "artistId", "updatedAt")
         VALUES ($1, $1, $1, 2024, 'Huile', 'D', 'https://res.cloudinary.com/x/principale.jpg', 100000, 'EUR', 610, 760, 'publiee', 'disponible', 'art-f', now())`,
        [slug],
      )
    await insere('avec-photos')
    await insere('sans-photos')
    for (const [type, n] of [['gros_plan', 1], ['video', 2], ['face_lumiere_du_jour', 3], ['mise_en_situation', 4]] as const) {
      await db.query(
        `INSERT INTO "PhotoOeuvre" (id, "artworkId", type, url, "publicId", largeur, hauteur, "updatedAt")
         VALUES (gen_random_uuid()::text, 'avec-photos', $1::"TypePhoto", $2, $3, 800, 1000, now())`,
        [type, `https://res.cloudinary.com/x/${type}.jpg`, `errancy/oeuvres/avec-photos/${n}`],
      )
    }
  })

  afterAll(async () => {
    await db?.end()
    const { prisma } = await import('@/lib/prisma')
    await prisma.$disconnect()
    await base?.supprimer()
  })

  it('getArtworkBySlug : images seulement, mise en situation en tête ; repli sur imageUrl', async () => {
    const { getArtworkBySlug } = await import('@/lib/catalogue')
    const a = await getArtworkBySlug('avec-photos', 'FR')
    expect(a?.photos?.map((p) => p.type)).toEqual(['mise_en_situation', 'face_lumiere_du_jour', 'gros_plan'])
    const b = await getArtworkBySlug('sans-photos', 'FR')
    expect(b?.photos).toEqual([
      { url: 'https://res.cloudinary.com/x/principale.jpg', type: 'principale', largeur: null, hauteur: null },
    ])
  })
})
