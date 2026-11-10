import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '@/lib/i18n'

// Story 4.8 : émetteurs de la mesure. Adaptateur simulé (`@/lib/mesure/choix`), cookie de consentement
// « accepté », pages et actions appelées comme des fonctions, sans navigateur ni base.

const etat = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  entetes: {} as Record<string, string>,
  envoyes: [] as Record<string, unknown>[],
  selection: { ok: true } as Record<string, unknown>,
  visite: { ok: true } as Record<string, unknown>,
}))

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (nom: string) => (etat.cookies.has(nom) ? { name: nom, value: etat.cookies.get(nom) } : undefined),
    set: (a: string | { name: string; value: string }, v?: string) => {
      if (typeof a === 'string') etat.cookies.set(a, v ?? '')
      else etat.cookies.set(a.name, a.value)
    },
    delete: (nom: string) => void etat.cookies.delete(nom),
  }),
  headers: () => ({ get: (nom: string) => etat.entetes[nom.toLowerCase()] ?? null }),
}))
vi.mock('@/lib/acces', () => ({ acteurCourant: async () => ({ type: 'visiteur' }) }))
vi.mock('@/lib/mesure/choix', () => ({
  mesureActive: () => ({ envoyer: async (e: Record<string, unknown>) => void etat.envoyes.push(e) }),
  choisirMesure: vi.fn(),
}))
vi.mock('@/lib/demandes', () => ({
  enregistrerDemandeSelection: async () => etat.selection,
  enregistrerDemandeVisite: async () => etat.visite,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  notFound: () => { throw new Error('introuvable') },
  permanentRedirect: () => { throw new Error('redirection') },
}))
vi.mock('next/font/local', () => ({ default: () => ({ variable: '' }) }))
vi.mock('@/auth', () => ({ auth: async () => null }))
vi.mock('@/app/auth/actions', () => ({ logout: async () => {} }))
vi.mock('@/lib/catalogue', () => ({
  getArtworkBySlug: async () => ({ id: 'nuit', title: 'Nuit', artist: 'Karim', artistId: 'karim', sold: false }),
  getRelatedArtworks: async () => [],
  artisteDOeuvreRetiree: async () => null,
}))

type Noeud = ReactElement<{ children?: ReactNode; [cle: string]: unknown }>
function elements(n: ReactNode): Noeud[] {
  if (Array.isArray(n)) return n.flatMap(elements)
  if (!isValidElement(n)) return []
  const e = n as Noeud
  return [e, ...elements(e.props.children)]
}

beforeEach(() => {
  etat.cookies.clear()
  etat.cookies.set('mesure_choix', 'oui')
  etat.entetes = { referer: 'https://www.errancy.art/galerie/nuit' }
  etat.envoyes.length = 0
  etat.selection = { ok: true }
  etat.visite = { ok: true }
})

describe('émetteurs de la mesure', () => {
  it('fiche : une seule vue, avec le slug de l’œuvre ; sans consentement, aucune', async () => {
    const { default: Page } = await import('@/app/galerie/[id]/page')
    await Page({ params: { id: 'nuit' } })
    expect(etat.envoyes).toHaveLength(1)
    expect(etat.envoyes[0]).toMatchObject({ nom: 'VueFiche', slug: 'nuit' })
    etat.envoyes.length = 0
    etat.cookies.set('mesure_choix', 'non')
    await Page({ params: { id: 'nuit' } })
    expect(etat.envoyes).toEqual([])
  })

  it('choix du pays : ChoixPays pour un code valide, rien pour un code invalide', async () => {
    const { choisirPaysLivraison } = await import('@/app/actions/pays')
    expect(await choisirPaysLivraison('CA')).toMatchObject({ ok: true, code: 'CA' })
    expect(etat.envoyes).toHaveLength(1)
    expect(etat.envoyes[0]).toMatchObject({ nom: 'ChoixPays', slug: 'nuit' })
    etat.envoyes.length = 0
    expect(await choisirPaysLivraison('ZZZ')).toEqual({ ok: false })
    expect(etat.envoyes).toEqual([])
  })

  it('demande de sélection : DemandeEnvoyee sans slug seulement si elle est enregistrée', async () => {
    const { envoyerDemandeSelection } = await import('@/app/conseil/actions')
    etat.entetes = { referer: 'https://www.errancy.art/conseil' }
    await envoyerDemandeSelection({})
    expect(etat.envoyes).toHaveLength(1)
    expect(etat.envoyes[0]).toMatchObject({ nom: 'DemandeEnvoyee', slug: null })
    etat.envoyes.length = 0
    for (const refus of [{ ok: false, code: 'invalide', erreurs: {} }, { ok: false, code: 'trop_de_demandes' }]) {
      etat.selection = refus
      await envoyerDemandeSelection({})
    }
    expect(etat.envoyes).toEqual([])
  })

  it('demande de visite : DemandeEnvoyee avec le slug de l’œuvre seulement si elle est enregistrée', async () => {
    const { envoyerDemandeVisite } = await import('@/app/galerie/[id]/visite/actions')
    etat.entetes = { referer: 'https://www.errancy.art/galerie/nuit/visite' }
    await envoyerDemandeVisite('nuit', {})
    expect(etat.envoyes).toHaveLength(1)
    expect(etat.envoyes[0]).toMatchObject({ nom: 'DemandeEnvoyee', slug: 'nuit' })
    etat.envoyes.length = 0
    for (const refus of [{ ok: false, code: 'invalide', erreurs: {} }, { ok: false, code: 'oeuvre_indisponible' }, { ok: false, code: 'trop_de_demandes' }]) {
      etat.visite = refus
      await envoyerDemandeVisite('nuit', {})
    }
    expect(etat.envoyes).toEqual([])
  })
})

describe('montage de la bannière et du lien « Gérer la mesure »', () => {
  it('layout : ChoixMesure reçoit le choix du cookie (et null sans choix)', async () => {
    const { default: Layout } = await import('@/app/layout')
    const { ChoixMesure } = await import('@/components/ui/ChoixMesure')
    const choixDe = async () => elements(await Layout({ children: null })).find((e) => e.type === ChoixMesure)?.props.choix
    expect(await choixDe()).toBe('accepte')
    etat.cookies.set('mesure_choix', 'non')
    expect(await choixDe()).toBe('refuse')
    etat.cookies.delete('mesure_choix')
    expect(await choixDe()).toBeNull()
  })

  it('pied de page : contient le lien « Gérer la mesure »', async () => {
    const { Footer } = await import('@/components/layout/Footer')
    const { BoutonGererMesure } = await import('@/components/ui/ChoixMesure')
    expect(renderToStaticMarkup(createElement(Footer, {}))).toContain(fr.mesure.gerer)
    expect(BoutonGererMesure).toBeTypeOf('function')
  })
})
