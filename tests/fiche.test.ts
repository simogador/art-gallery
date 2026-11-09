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
import { SectionsFiche } from '@/app/galerie/[id]/SectionsFiche'
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
  price: 1450, hauteurMm: 760, largeurMm: 610, profondeurMm: null, description: '', certificat: false, tags: [], featured: false,
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
    renderToStaticMarkup(h(UniteProvider, { initiale: 'cm', children: h(ArtworkDetail, { artwork: a, related: [], pays }) }))

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

  it('œuvre vendue ou vendue ailleurs : « Vendue », taille seule, aucun prix ni délai ni section d’achat (story 3.7)', () => {
    // Même un prix livré résiduel ne doit rien montrer.
    const html = fiche(oeuvre({ sold: true, prixLivre: livree, description: 'Une histoire.' }))
    expect(html).toContain('Vendue')
    expect(html).toContain(`76${F}×${F}61${F}cm`)
    expect(html).toContain('Une histoire.')
    expect(html).not.toContain('Taille, prix livré et délai')
    for (const interdit of ['Délai', 'Prix livré', 'Combien au total', 'Quand la recevrai-je', 'Prix de vente', 'line-through', 'Droits et taxes', 'Acheter', 'panier']) {
      expect(html, interdit).not.toContain(interdit)
    }
    expect(html).not.toMatch(/\d[\s\u202f]?€/)
    expect(html).not.toContain(formaterMontant(149000, 'EUR'))
    expect(html).not.toContain('notifié')
    expect(html).toContain(fr.fiche.sections.serieux.titre)
  })

  it('œuvre vendue : œuvres proches avec lien vers l’artiste ; sans œuvre proche, lien conservé dans « Est-ce sérieux ? »', () => {
    const proche = oeuvre({ id: 'p', title: 'Proche', prixLivre: livree })
    const avec = renderToStaticMarkup(
      h(UniteProvider, { initiale: 'cm', children: h(ArtworkDetail, { artwork: oeuvre({ sold: true }), related: [proche], pays }) }),
    )
    expect(avec).toContain(fr.fiche.vendue.proches)
    expect(avec).toContain('href="/artistes/kara"')
    expect(avec).toContain(fr.fiche.vendue.lienArtiste('Kara'))
    const sans = fiche(oeuvre({ sold: true }))
    expect(sans).not.toContain('€')
    expect(sans).not.toContain(fr.fiche.vendue.proches)
    expect(sans).toContain('href="/artistes/kara"')
  })

  it('œuvre vendue sans dimensions : pas de case Taille', () => {
    const html = fiche(oeuvre({ sold: true, hauteurMm: null, largeurMm: null, profondeurMm: null }))
    expect(html).not.toContain('<dt')
    expect(html).not.toContain('Taille, prix livré et délai')
    expect(html).toContain('Vendue')
  })

  it('œuvre disponible : rangée à trois cases et quatre sections inchangées', () => {
    const html = fiche(oeuvre({ prixLivre: livree }))
    for (const x of ['Taille, prix livré et délai', 'Prix livré', 'Délai', 'Combien au total', 'Quand la recevrai-je', 'Disponible']) {
      expect(html, x).toContain(x)
    }
    expect(html).not.toContain(fr.fiche.vendue.proches)
  })

  it('badge « Coup de cœur » pour une œuvre featured', () => {
    expect(fiche(oeuvre({ featured: true, prixLivre: livree }))).toContain('Coup de cœur')
    expect(fiche(oeuvre({ prixLivre: livree }))).not.toContain('Coup de cœur')
  })
})

describe('SectionsFiche (story 3.6)', () => {
  const livree: Artwork['prixLivre'] = {
    livree: true, totalCentimes: 149000, devise: 'EUR', fraisCentimes: 4000, delaiMinJours: 8, delaiMaxJours: 12,
  }
  const sections = (a: Artwork, unite: 'cm' | 'in' = 'cm') =>
    renderToStaticMarkup(h(UniteProvider, { initiale: unite, children: h(SectionsFiche, { artwork: a, pays }) }))
  const fichePleine = (a: Artwork) =>
    renderToStaticMarkup(h(UniteProvider, { initiale: 'cm', children: h(ArtworkDetail, { artwork: a, related: [], pays }) }))
  const t = fr.fiche.sections

  it('quatre sections dans l’ordre, seule la première ouverte', () => {
    const html = sections(oeuvre({ prixLivre: livree }))
    const titres = [t.chezMoi.titre, t.total.titre, t.quand.titre, t.serieux.titre]
    const positions = titres.map((x) => html.indexOf(x))
    positions.forEach((p) => expect(p).toBeGreaterThan(-1))
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(html.match(/<details/g)).toHaveLength(4)
    expect(html.match(/<details[^>]*\sopen/g)).toHaveLength(1)
    expect(html.indexOf('<details open')).toBeLessThan(html.indexOf(t.chezMoi.titre))
    expect(html).not.toMatch(/localStorage|sessionStorage/)
  })

  it('pays livré : mêmes chiffres que la rangée, mention des droits', () => {
    const a = oeuvre({ prixLivre: livree })
    const html = sections(a)
    const rangee = rendreRangee(a)
    for (const x of [formaterMontant(149000), '8 à 12 jours', `76${F}×${F}61${F}cm`, 'Portrait', 'Format moyen']) {
      expect(html).toContain(x)
      expect(rangee).toContain(x)
    }
    expect(html).toContain('Droits et taxes d’import éventuels non inclus')
  })

  it('pays non livré : « Pas de livraison vers » dans le total et le délai', () => {
    const html = sections(oeuvre({ prixLivre: { livree: false, raison: 'non_livree' } }))
    expect(html.match(/Pas de livraison vers France/g)).toHaveLength(2)
    expect(html).not.toContain('Droits et taxes')
  })

  it('dimensions absentes : « — » sans orientation ni format', () => {
    const html = sections(oeuvre({ largeurMm: null, prixLivre: livree }))
    const chezMoi = html.slice(html.indexOf(t.chezMoi.titre), html.indexOf(t.total.titre))
    expect(chezMoi).toContain('—')
    expect(chezMoi).not.toContain('Portrait')
    expect(chezMoi).not.toContain('Format')
  })

  it('« Est-ce sérieux ? » : histoire, sélection, retour sans durée, lien artiste ; certificat seulement si engagé', () => {
    const avec = sections(oeuvre({ description: 'Une histoire courte.', certificat: true, prixLivre: livree }))
    const sans = sections(oeuvre({ description: 'Une histoire courte.', certificat: false, prixLivre: livree }))
    for (const html of [avec, sans]) {
      expect(html).toContain('Une histoire courte.')
      expect(html).toContain('Sélectionnée par Errancy')
      expect(html).toContain(t.serieux.retour)
      expect(html).toContain('href="/artistes/kara"')
    }
    expect(avec).toContain('certificat d’authenticité signé par l’artiste')
    expect(sans).not.toContain('certificat')
    expect(t.serieux.retour).not.toMatch(/\d|gratuit/i)
  })

  it('hauteur seule nulle : « — » sans orientation ni format', () => {
    const html = sections(oeuvre({ hauteurMm: null, prixLivre: livree }))
    const chezMoi = html.slice(html.indexOf(t.chezMoi.titre), html.indexOf(t.total.titre))
    expect(chezMoi).toContain('—')
    expect(chezMoi).not.toMatch(/Portrait|Paysage|Carré|Format/)
  })

  it('sans prix (prixLivre absent ou sans_prix) : « — » dans total et délai', () => {
    for (const prixLivre of [undefined, { livree: false, raison: 'sans_prix' } as const]) {
      const html = sections(oeuvre({ prixLivre }))
      const total = html.slice(html.indexOf(t.total.titre), html.indexOf(t.quand.titre))
      const quand = html.slice(html.indexOf(t.quand.titre), html.indexOf(t.serieux.titre))
      for (const bloc of [total, quand]) {
        expect(bloc).toContain('—')
        expect(bloc).not.toContain('Pas de livraison')
      }
    }
  })

  it('mêmes textes que la rangée : livrée, non livrée, sans prix', () => {
    const texte = (html: string) => html.replace(/<[^>]+>/g, '|').split('|').map((x) => x.trim()).filter(Boolean)
    const cas: Artwork['prixLivre'][] = [livree, { livree: false, raison: 'non_livree' }, { livree: false, raison: 'sans_prix' }]
    for (const prixLivre of cas) {
      const a = oeuvre({ prixLivre })
      const r = texte(rendreRangee(a))
      const s = texte(sections(a))
      const attendus = prixLivre?.livree
        ? [formaterMontant(prixLivre.totalCentimes), fr.fiche.rangee.delaiJours(prixLivre.delaiMinJours, prixLivre.delaiMaxJours)]
        : prixLivre?.raison === 'non_livree'
          ? [fr.fiche.rangee.pasDeLivraison('France'), fr.fiche.rangee.neLivrePas('Kara', 'France')]
          : []
      for (const x of attendus) {
        expect(r, x).toContain(x)
        expect(s, x).toContain(x)
      }
      if (!prixLivre?.livree && prixLivre?.raison === 'sans_prix') {
        expect(r).not.toContain(fr.fiche.rangee.pasDeLivraison('France'))
        expect(s).not.toContain(fr.fiche.rangee.pasDeLivraison('France'))
      }
    }
  })

  it('la fiche n’a plus d’onglets ni de promesses non décidées', () => {
    const html = fichePleine(oeuvre({ prixLivre: livree, certificat: true }))
    expect(html).not.toMatch(/role="tab"|Provenance|Garantie|14 jours|100\s?%/)
    const source = readFileSync(path.join(RACINE, 'src/app/galerie/[id]/ArtworkDetail.tsx'), 'utf8')
    const sections = readFileSync(path.join(RACINE, 'src/app/galerie/[id]/SectionsFiche.tsx'), 'utf8')
    for (const code of [source, sections, readFileSync(path.join(RACINE, 'src/lib/i18n/fr.ts'), 'utf8')]) {
      expect(code).not.toMatch(/Garantie|compte à rebours|Stripe/i)
    }
    expect(sections).not.toMatch(/line-through/)
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
    await db.query(`UPDATE "Artwork" SET "engagementCertificat" = true WHERE slug = 'avec-photos'`)
    await insere('sans-photos')
    await insere('vendue-f')
    await db.query(`UPDATE "Artwork" SET disponibilite = 'vendue_ailleurs' WHERE slug = 'vendue-f'`)
    await insere('retiree-f')
    await db.query(`UPDATE "Artwork" SET disponibilite = 'retiree' WHERE slug = 'retiree-f'`)
    // Artiste avec accord mais sans autre œuvre visible : sa page est introuvable.
    await db.query(
      `INSERT INTO "Artist" (id, slug, name, nationality, "birthYear", bio, "imageUrl", "accordSigneLe", "updatedAt")
       VALUES ('art-g', 'art-g', 'Artiste G', 'MA', 1980, 'Bio', '', now(), now())`,
    )
    await insere('retiree-g')
    await db.query(`UPDATE "Artwork" SET disponibilite = 'retiree', "artistId" = 'art-g' WHERE slug = 'retiree-g'`)
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

  it('getArtworkBySlug : certificat selon engagementCertificat', async () => {
    const { getArtworkBySlug } = await import('@/lib/catalogue')
    expect((await getArtworkBySlug('avec-photos'))?.certificat).toBe(true)
    expect((await getArtworkBySlug('sans-photos'))?.certificat).toBe(false)
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

  it('états publics (story 3.7) : vendue lisible, retirée redirigée vers un artiste public, sinon introuvable', async () => {
    const { getArtworkBySlug, artisteDOeuvreRetiree } = await import('@/lib/catalogue')
    const vendue = await getArtworkBySlug('vendue-f', 'FR')
    expect(vendue?.sold).toBe(true)
    const html = renderToStaticMarkup(
      h(UniteProvider, { initiale: 'cm', children: h(ArtworkDetail, { artwork: vendue!, related: [], pays }) }),
    )
    expect(html).toContain('Vendue')
    expect(html).not.toContain('€')
    expect(html).not.toContain('Délai')
    expect(html).not.toContain('Prix livré')
    expect(await getArtworkBySlug('retiree-f', 'FR')).toBeNull()
    expect(await artisteDOeuvreRetiree('retiree-f')).toBe('art-f')
    expect(await artisteDOeuvreRetiree('retiree-g')).toBeNull()
    expect(await getArtworkBySlug('inconnue', 'FR')).toBeNull()
    expect(await artisteDOeuvreRetiree('inconnue')).toBeNull()
  })
})

describe('story 3.8 : maintenance active et adresse du site (reglages)', () => {
  it('même règle qu’avant dans le middleware : off, on, sinon production Vercel seulement', async () => {
    const { maintenanceActive, urlAbsolue, URL_SITE } = await import('@/lib/reglages')
    expect(maintenanceActive({ MAINTENANCE_MODE: 'off', VERCEL_ENV: 'production' })).toBe(false)
    expect(maintenanceActive({ MAINTENANCE_MODE: 'on' })).toBe(true)
    expect(maintenanceActive({ VERCEL_ENV: 'production' })).toBe(true)
    expect(maintenanceActive({ VERCEL_ENV: 'preview', MAINTENANCE_MODE: 'on' })).toBe(true)
    expect(maintenanceActive({ VERCEL_ENV: 'preview' })).toBe(false)
    expect(maintenanceActive({})).toBe(false)
    expect(URL_SITE).toBe('https://www.errancy.art')
    expect(urlAbsolue('/galerie/x')).toBe('https://www.errancy.art/galerie/x')
    const middleware = readFileSync(path.join(RACINE, 'src/middleware.ts'), 'utf8')
    expect(middleware).toMatch(/import \{[^}]*\bmaintenanceActive\b[^}]*\} from '@\/lib\/reglages'/)
    expect(middleware).toContain('maintenanceActive(')
  })
})
