import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ArtworkDetail } from '@/app/galerie/[id]/ArtworkDetail'
import { UniteProvider } from '@/components/ui/UniteToggle'
import { estReservee } from '@/lib/disponibilite/etats'
import { mapArtwork } from '@/lib/catalogue/mappers'
import { fr } from '@/lib/i18n'
import type { Artwork } from '@/lib/types'

// Story 4.7 : barre d'actions de la fiche par état (aucune réservation n'existe encore : états simulés).
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }), usePathname: () => '/' }))

const oeuvre = (s: Partial<Artwork> = {}): Artwork => ({
  id: 'nuit', title: 'Nuit', artist: 'Kara', artistId: 'kara', year: 2024, medium: 'Peinture', technique: 'Huile',
  price: 1450, hauteurMm: 760, largeurMm: 610, profondeurMm: null, description: '', certificat: false, tags: [], featured: false,
  sold: false, imageUrl: null, gradient: '', accentColor: '#000', ...s,
})
const CONSEIL = h('a', { href: '#c' }, 'MARQUEUR-CONSEIL')
const rendre = (a: Artwork, lot2Ouvert = false) =>
  renderToStaticMarkup(
    h(UniteProvider, {
      initiale: 'cm',
      children: h(ArtworkDetail, { artwork: a, related: [], pays: { code: 'FR', nom: 'France' }, conseil: CONSEIL, lot2Ouvert }),
    }),
  )
const nb = (html: string, x: string) => html.split(x).length - 1

describe('barre d’actions de la fiche', () => {
  it('disponible, Lot 2 fermé : Conseil et visite, pas d’achat ; anciens boutons supprimés', () => {
    const html = rendre(oeuvre())
    expect(nb(html, 'MARQUEUR-CONSEIL')).toBe(1)
    expect(html).toContain('href="/galerie/nuit/visite"')
    expect(html).toContain(fr.fiche.barre.visite)
    for (const interdit of ['Ajouter au panier', 'Acheter', 'Prendre rendez-vous', 'Sauvegarder', 'Partager', 'Acquérir']) {
      expect(html, interdit).not.toContain(interdit)
    }
    expect(html).toContain('bottom-0')
    expect(html).toContain('lg:sticky')
  })

  it('pays non livré : même barre, visite conservée', () => {
    const html = rendre(oeuvre({ prixLivre: { livree: false, raison: 'non_livree' } }))
    expect(html).toContain('href="/galerie/nuit/visite"')
    expect(nb(html, 'MARQUEUR-CONSEIL')).toBe(1)
  })

  it('Lot 2 ouvert : l’ancien bouton d’ajout au panier est dans la barre', () => {
    expect(rendre(oeuvre(), true)).toContain('Ajouter au panier')
  })

  it('vendue : Conseil et lien vers l’artiste, aucune visite, jamais d’achat même Lot 2 ouvert', () => {
    const html = rendre(oeuvre({ sold: true, reservee: false }), true)
    expect(nb(html, 'MARQUEUR-CONSEIL')).toBe(1)
    expect(html).toContain(fr.fiche.vendue.lienArtiste('Kara'))
    expect(html).not.toContain('/visite')
    expect(html).not.toContain('Ajouter au panier')
  })

  it('réservée : Conseil seul, sans visite, lien artiste ni heure de fin', () => {
    const html = rendre(oeuvre({ sold: true, reservee: true }), true)
    expect(nb(html, 'MARQUEUR-CONSEIL')).toBe(1)
    expect(html).not.toContain('/visite')
    expect(html).not.toContain('Ajouter au panier')
    expect(html).not.toContain(fr.fiche.barre.visite)
    const barre = html.slice(html.indexOf(`aria-label="${fr.fiche.barre.nom}"`))
    const fin = barre.indexOf('</div></div>')
    expect(fin).toBeGreaterThan(-1)
    expect(barre.slice(0, fin)).not.toContain('href="/artistes/')
  })
})

describe('état réservée dans le type d’affichage', () => {
  it('estReservee ne vaut que pour reservee ; le mapper garde sold vrai', () => {
    expect(estReservee({ publication: 'publiee', disponibilite: 'reservee' })).toBe(true)
    expect(estReservee({ publication: 'publiee', disponibilite: 'vendue' })).toBe(false)
    const base = {
      slug: 'a', title: 'A', year: 2024, medium: 'Huile', prixCentimes: 100, hauteurMm: 1, largeurMm: 1, profondeurMm: null,
      description: '', featured: false, publication: 'publiee', artist: { name: 'K', slug: 'k' },
    }
    const r = mapArtwork({ ...base, disponibilite: 'reservee' } as never)
    expect(r).toMatchObject({ sold: true, reservee: true })
    expect(mapArtwork({ ...base, disponibilite: 'vendue' } as never)).toMatchObject({ sold: true, reservee: false })
    expect(mapArtwork({ ...base, disponibilite: 'disponible' } as never)).toMatchObject({ sold: false, reservee: false })
  })
})
