import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BoutonConseil } from '@/components/ui/BoutonConseil'
import { Footer } from '@/components/layout/Footer'
import { UniteProvider } from '@/components/ui/UniteToggle'

// Story 4.4 : le bouton Conseil WhatsApp est présent aux cinq emplacements. Pages appelées comme des
// fonctions (arbre d'éléments), sans navigateur ni base ; lectures du catalogue simulées. Numéro
// factice construit à l'exécution, jamais le vrai.
const NUMERO = ['3', '3', '7', '0', '0', '0', '0', '0', '0', '0', '0'].join('')

const lectures = vi.hoisted(() => ({
  oeuvre: { id: 'nuit', title: 'Nuit', artist: 'Karim Benali', artistId: 'karim', sold: false } as Record<string, unknown>,
  artiste: { id: 'karim', name: 'Karim Benali', discipline: '', country: '', bio: '', gradient: '' } as Record<string, unknown>,
}))

vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }), headers: () => new Headers() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  notFound: () => { throw new Error('introuvable') },
  permanentRedirect: () => { throw new Error('redirection') },
}))
vi.mock('next/font/local', () => ({ default: () => ({ variable: '' }) }))
vi.mock('@/auth', () => ({ auth: async () => null }))
vi.mock('@/app/auth/actions', () => ({ logout: async () => {} }))
vi.mock('@/lib/catalogue', () => ({
  getArtworkBySlug: async () => lectures.oeuvre,
  getRelatedArtworks: async () => [],
  artisteDOeuvreRetiree: async () => null,
  getArtistBySlug: async () => lectures.artiste,
  getArtistArtworksBySlug: async () => [],
  accueilPublic: async () => ({ artistes: [], expositions: [], miseEnAvant: null, selection: [], nouveautes: [], chiffres: {} }),
  lireGalerie: async () => ({ filtres: { n: 24 }, options: { artistes: [] }, totalCatalogue: 0, total: 0, oeuvres: [] }),
}))
vi.mock('@/lib/catalogue/filtres', async (original) => ({
  ...(await original<typeof import('@/lib/catalogue/filtres')>()),
  filtresActifs: () => [],
}))
vi.mock('@/app/galerie/FiltresGalerie', () => ({ FormulaireFiltres: () => null, PucesFiltres: () => null }))
vi.mock('@/components/sections', () => ({
  Hero: () => null, SectionOeuvres: () => null, ParcourirGalerie: () => null, CollectionVide: () => null,
  Artists: () => null, Exhibitions: () => null,
}))

type Noeud = ReactElement<{ children?: ReactNode; [cle: string]: unknown }>

/** Tous les éléments de l'arbre (enfants et props `children`), sans exécuter les composants. */
function elements(n: ReactNode): Noeud[] {
  if (Array.isArray(n)) return n.flatMap(elements)
  if (!isValidElement(n)) return []
  const e = n as Noeud
  return [e, ...elements(e.props.children)]
}
const boutons = (n: ReactNode) => elements(n).filter((e) => e.type === BoutonConseil)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-10T10:00:00Z')) // mardi 10 h à Londres : dans les horaires
  vi.stubEnv('WHATSAPP_NUMERO', NUMERO)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('emplacements du bouton Conseil WhatsApp', () => {
  it('fiche : la page passe le contexte œuvre (slug, titre) à ArtworkDetail', async () => {
    const { default: Page } = await import('@/app/galerie/[id]/page')
    const { ArtworkDetail } = await import('@/app/galerie/[id]/ArtworkDetail')
    const arbre = (await Page({ params: { id: 'nuit' } })) as Noeud
    expect(arbre.type).toBe(ArtworkDetail)
    const conseil = arbre.props.conseil as Noeud
    expect(conseil.type).toBe(BoutonConseil)
    expect(conseil.props.contexte).toEqual({ type: 'oeuvre', slug: 'nuit', titre: 'Nuit' })
  })

  it.each([['oui', true], [undefined, false]])('fiche : la page passe lot2Ouvert (LOT2_OUVERT=%s)', async (valeur, attendu) => {
    if (valeur) vi.stubEnv('LOT2_OUVERT', valeur)
    else vi.stubEnv('LOT2_OUVERT', '')
    const { default: Page } = await import('@/app/galerie/[id]/page')
    const arbre = (await Page({ params: { id: 'nuit' } })) as Noeud
    expect(arbre.props.lot2Ouvert).toBe(attendu)
  })

  it.each([false, true])('fiche : ArtworkDetail affiche le bouton reçu (vendue : %s)', async (sold) => {
    const { ArtworkDetail } = await import('@/app/galerie/[id]/ArtworkDetail')
    const artwork = { ...lectures.oeuvre, sold, year: 2024, title: 'Nuit', photos: [], gradient: '', accentColor: '' }
    const html = renderToStaticMarkup(
      createElement(
        UniteProvider,
        { initiale: 'cm' },
        createElement(ArtworkDetail, {
          artwork: artwork as never, related: [], pays: { code: 'FR', nom: 'France' },
          conseil: createElement(BoutonConseil, { contexte: { type: 'oeuvre', slug: 'nuit', titre: 'Nuit' } }),
        }),
      ),
    )
    expect(html).toContain('aria-label="Conseil WhatsApp sur Nuit')
    expect(html).toContain('moins de 2 heures')
  })

  it('page artiste : contexte artiste avec le nom', async () => {
    const { default: Page } = await import('@/app/artistes/[id]/page')
    const arbre = (await Page({ params: { id: 'karim' } })) as Noeud
    const { ArtistProfile } = await import('@/app/artistes/[id]/ArtistProfile')
    expect(arbre.type).toBe(ArtistProfile)
    const profil = ArtistProfile(arbre.props as never)
    const [bouton] = boutons(profil)
    expect(bouton.props.contexte).toEqual({ type: 'artiste', nom: 'Karim Benali' })
  })

  it('layout : passe <BoutonConseil surSombre /> à Footer, qui le rend', async () => {
    const { default: Layout } = await import('@/app/layout')
    const arbre = await Layout({ children: null })
    const pied = elements(arbre).find((e) => e.type === Footer)!
    const conseil = pied.props.conseil as Noeud
    expect(conseil.type).toBe(BoutonConseil)
    expect(conseil.props.surSombre).toBe(true)
    const html = renderToStaticMarkup(createElement(Footer, { conseil: createElement('p', null, 'MARQUEUR-CONSEIL') }))
    expect(html).toContain('MARQUEUR-CONSEIL')
  })

  it('accueil et galerie : une section contient le bouton', async () => {
    const accueil = await (await import('@/app/page')).default()
    const galerie = await (await import('@/app/galerie/page')).default({ searchParams: {} })
    for (const arbre of [accueil, galerie]) {
      const section = elements(arbre).find((e) => e.type === 'section' && boutons(e.props.children).length === 1)
      expect(section).toBeTruthy()
    }
    expect(boutons(accueil)[0].props.contexte ?? { type: 'general' }).toEqual({ type: 'general' })
  })

  it('le bouton rendu annonce l’horaire à l’heure simulée', () => {
    const html = renderToStaticMarkup(createElement(BoutonConseil, {}))
    expect(html).toContain('Réponse en moins de 2 heures')
  })
})
