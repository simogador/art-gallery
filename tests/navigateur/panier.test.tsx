import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fr, formaterMontant } from '@/lib/i18n'
import type { PanierCompose } from '@/lib/panier'
import type { PrixLivre } from '@/lib/livraison/prix'
import type { Artwork } from '@/lib/types'

// Panier public (story 7.2) dans un vrai navigateur : action de recalcul, routeur et choix du pays
// simulés ; le store du navigateur est réel (localStorage). Les montants viennent de la réponse du serveur.
const recalculerPanier = vi.fn()
vi.mock('@/app/panier/actions', () => ({ recalculerPanier: (slugs: unknown) => recalculerPanier(slugs) }))
vi.mock('@/app/actions/pays', () => ({ choisirPaysLivraison: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => '/panier' }))

const { CartContent } = await import('@/app/panier/CartContent')
const { useCartStore, CLE_STOCKAGE_PANIER } = await import('@/lib/store/cart')
const t = fr.panier

const livre = (total: number, frais: number, min: number, max: number): PrixLivre => ({
  livree: true,
  totalCentimes: total,
  fraisCentimes: frais,
  devise: 'EUR',
  delaiMinJours: min,
  delaiMaxJours: max,
})
const somme = (livrees: number, prix: number, frais: number, min: number, max: number) => ({
  livrees,
  nonLivrees: 0,
  devise: 'EUR',
  prixCentimes: prix,
  fraisCentimes: frais,
  totalCentimes: prix + frais,
  delaiMinJours: min,
  delaiMaxJours: max,
})
const ligne = (slug: string, titre: string, prixLivre: PrixLivre) => ({
  slug,
  titre,
  imageUrl: null,
  gradient: 'from-neutral-100',
  accentColor: '#999',
  prixLivre,
  prixOeuvreCentimes: prixLivre.livree ? prixLivre.totalCentimes - prixLivre.fraisCentimes : null,
})
const proche = (id: string): Artwork =>
  ({
    id,
    title: `Proche ${id}`,
    artist: 'Kara',
    artistId: 'kara',
    sold: false,
    hauteurMm: null,
    largeurMm: null,
    imageUrl: null,
    gradient: 'g',
    accentColor: '#999',
    prixLivre: livre(30000, 1000, 5, 8),
  }) as unknown as Artwork

function panierDeuxArtistes(pays = { code: 'FR', nom: 'France' }): PanierCompose {
  return {
    pays,
    commandes: [
      { numero: 1, artiste: { slug: 'kara', nom: 'Kara' }, lignes: [ligne('nuit', 'La nuit', livre(240000, 0, 7, 11))], somme: somme(1, 240000, 0, 7, 11) },
      { numero: 2, artiste: { slug: 'ines', nom: 'Inès' }, lignes: [ligne('aube', 'L’aube', livre(68000, 8000, 10, 14))], somme: somme(1, 60000, 8000, 10, 14) },
    ],
    indisponibles: [],
    total: somme(2, 300000, 8000, 10, 14),
  }
}

beforeEach(() => {
  recalculerPanier.mockReset()
  localStorage.clear()
  useCartStore.setState({ slugs: [] })
})

describe('Panier (navigateur)', () => {
  it('panier vide : message et lien vers la galerie, aucun recalcul', async () => {
    const ecran = await render(<CartContent pays={{ code: 'FR', nom: 'France' }} achatOuvert={false} />)
    await expect.element(ecran.getByText(t.vide)).toBeVisible()
    expect(ecran.getByRole('link', { name: t.parcourir }).element().getAttribute('href')).toBe('/galerie')
    expect(recalculerPanier).not.toHaveBeenCalled()
  })

  it('deux artistes : cartes numérotées, bandeau des colis, total général en clair avec la mention des droits', async () => {
    useCartStore.setState({ slugs: ['nuit', 'aube'] })
    recalculerPanier.mockResolvedValue({ ok: true, panier: panierDeuxArtistes() })
    const ecran = await render(<CartContent pays={{ code: 'FR', nom: 'France' }} achatOuvert={false} conseil={<a href="#c">Conseil</a>} />)

    await expect.element(ecran.getByRole('heading', { name: t.commande(1) })).toBeVisible()
    await expect.element(ecran.getByRole('heading', { name: t.commande(2) })).toBeVisible()
    expect(recalculerPanier).toHaveBeenCalledWith(['nuit', 'aube'])
    await expect.element(ecran.getByText(t.colis(2, [t.delaiCourt(7, 11), t.delaiCourt(10, 14)]))).toBeVisible()
    const addition = t.additionTotaux([formaterMontant(240000, 'EUR'), formaterMontant(68000, 'EUR')])
    await expect.element(ecran.getByText(addition)).toBeVisible()
    await expect.element(ecran.getByText(formaterMontant(308000, 'EUR'), { exact: true })).toBeVisible()
    await expect.element(ecran.getByText(fr.livraison.droitsNonInclus)).toBeVisible()
    // Lot 2 fermé : ni barre « Continuer » ni lien de paiement ; « Continuer à parcourir » et Conseil restent.
    expect(ecran.getByRole('link', { name: t.continuer, exact: true }).elements()).toHaveLength(0)
    await expect.element(ecran.getByText(t.achatFerme)).toBeVisible()
    await expect.element(ecran.getByRole('link', { name: t.continuerParcourir })).toBeVisible()
    await expect.element(ecran.getByRole('link', { name: 'Conseil' })).toBeVisible()
  })

  it('changement de pays : montants masqués pendant le recalcul, puis recalculés et annoncés', async () => {
    useCartStore.setState({ slugs: ['nuit', 'aube'] })
    recalculerPanier.mockResolvedValueOnce({ ok: true, panier: panierDeuxArtistes() })
    const ecran = await render(<CartContent pays={{ code: 'FR', nom: 'France' }} achatOuvert={false} />)
    await expect.element(ecran.getByText(formaterMontant(308000, 'EUR'), { exact: true })).toBeVisible()

    let fin: (v: unknown) => void = () => {}
    recalculerPanier.mockReturnValueOnce(new Promise((r) => (fin = r)))
    await ecran.rerender(<CartContent pays={{ code: 'BE', nom: 'Belgique' }} achatOuvert={false} />)
    await expect.element(ecran.getByText(t.recalculEnCours)).toBeVisible()
    await expect.element(ecran.getByText(t.montantsMasques)).toBeVisible()
    expect(document.body.textContent).not.toContain(formaterMontant(308000, 'EUR'))

    const belgique = panierDeuxArtistes({ code: 'BE', nom: 'Belgique' })
    belgique.total = somme(2, 300000, 20000, 12, 16)
    fin({ ok: true, panier: belgique })
    await expect.element(ecran.getByText(formaterMontant(320000, 'EUR'), { exact: true })).toBeVisible()
    await vi.waitFor(() => {
      const annonces = Array.from(document.querySelectorAll('[aria-live="polite"]')).map((e) => e.textContent)
      expect(annonces).toContain(t.recalcule('Belgique'))
    })
  })

  it('œuvre indisponible : ligne barrée, message, trois œuvres proches, autres commandes intactes ; retrait annoncé', async () => {
    useCartStore.setState({ slugs: ['nuit', 'vendue'] })
    const panier = panierDeuxArtistes()
    panier.commandes = [panier.commandes[0]]
    panier.total = somme(1, 240000, 0, 7, 11)
    panier.indisponibles = [
      { slug: 'vendue', titre: 'La vendue', artisteSlug: 'kara', artisteNom: 'Kara', proches: [proche('p1'), proche('p2'), proche('p3')] },
    ]
    recalculerPanier.mockResolvedValue({ ok: true, panier })
    const ecran = await render(<CartContent pays={{ code: 'FR', nom: 'France' }} achatOuvert={false} />)

    await expect.element(ecran.getByText(t.indisponible)).toBeVisible()
    await expect.element(ecran.getByText('La vendue')).toBeVisible()
    await expect.element(ecran.getByRole('heading', { name: t.proches('Kara') })).toBeVisible()
    for (const id of ['p1', 'p2', 'p3']) await expect.element(ecran.getByText(`Proche ${id}`)).toBeVisible()
    await expect.element(ecran.getByRole('heading', { name: t.commande(1) })).toBeVisible()

    recalculerPanier.mockResolvedValue({ ok: true, panier: { ...panier, indisponibles: [] } })
    await ecran.getByRole('button', { name: t.retirer('La vendue') }).click()
    expect(useCartStore.getState().slugs).toEqual(['nuit'])
    await vi.waitFor(() => expect(Array.from(document.querySelectorAll('[aria-live="polite"]')).map((e) => e.textContent)).toContain(t.retire('La vendue')))
  })

  it('erreur de recalcul : message, panier conservé, « Réessayer » relance le recalcul', async () => {
    useCartStore.setState({ slugs: ['nuit'] })
    recalculerPanier.mockResolvedValueOnce({ ok: false })
    const ecran = await render(<CartContent pays={{ code: 'FR', nom: 'France' }} achatOuvert={false} />)
    await expect.element(ecran.getByText(t.erreur)).toBeVisible()
    expect(document.querySelector('[role="alert"]')).not.toBeNull()
    expect(document.body.textContent).not.toMatch(/€/)
    expect(useCartStore.getState().slugs).toEqual(['nuit'])

    recalculerPanier.mockResolvedValueOnce({ ok: true, panier: panierDeuxArtistes() })
    await ecran.getByRole('button', { name: t.reessayer }).click()
    await expect.element(ecran.getByRole('heading', { name: t.commande(1) })).toBeVisible()
    expect(recalculerPanier).toHaveBeenCalledTimes(2)
  })

  it('Lot 2 ouvert : barre « Continuer » vers /commande/coordonnees avec total et nombre de commandes', async () => {
    useCartStore.setState({ slugs: ['nuit', 'aube'] })
    recalculerPanier.mockResolvedValue({ ok: true, panier: panierDeuxArtistes() })
    const ecran = await render(<CartContent pays={{ code: 'FR', nom: 'France' }} achatOuvert={true} />)
    const continuer = ecran.getByRole('link', { name: t.continuer, exact: true })
    await expect.element(continuer).toBeVisible()
    expect(continuer.element().getAttribute('href')).toBe('/commande/coordonnees')
    await expect.element(ecran.getByText(t.sousLigneContinuer(2))).toBeVisible()
    // Cible tactile d'au moins 44 px (classe `min-h-touch-target`, styles Tailwind non chargés ici).
    expect(continuer.element().className).toContain('min-h-touch-target')
  })

  it('œuvre non livrée vers le pays : ligne « Pas de livraison », « Continuer » indisponible', async () => {
    useCartStore.setState({ slugs: ['nuit'] })
    const panier = panierDeuxArtistes({ code: 'US', nom: 'États-Unis' })
    panier.commandes = [{ ...panier.commandes[0], lignes: [ligne('nuit', 'La nuit', { livree: false, raison: 'non_livree' })], somme: { ...somme(0, 0, 0, 0, 0), nonLivrees: 1, devise: null } }]
    panier.total = { ...somme(0, 0, 0, 0, 0), nonLivrees: 1, devise: null }
    recalculerPanier.mockResolvedValue({ ok: true, panier })
    const ecran = await render(<CartContent pays={{ code: 'US', nom: 'États-Unis' }} achatOuvert={true} />)
    await expect.element(ecran.getByText(t.nonLivree('États-Unis'))).toBeVisible()
    expect(ecran.getByRole('link', { name: t.continuer, exact: true }).elements()).toHaveLength(0)
    await expect.element(ecran.getByText(t.corrigerAvantContinuer)).toBeVisible()
  })
})

const pays = { code: 'FR', nom: 'France' }
const sansLivraison = { livrees: 0, nonLivrees: 1, devise: null, prixCentimes: 0, fraisCentimes: 0, totalCentimes: 0, delaiMinJours: 0, delaiMaxJours: 0 }
const annonces = () => Array.from(document.querySelectorAll('[aria-live="polite"]')).map((e) => e.textContent)

describe('Panier : cas limites (navigateur)', () => {
  it('monnaies mêlées : montants « — », message dédié, « Continuer » inactif', async () => {
    useCartStore.setState({ slugs: ['nuit', 'aube'] })
    const panier = panierDeuxArtistes()
    panier.total = { ...somme(2, 300000, 8000, 10, 14), devise: null }
    recalculerPanier.mockResolvedValue({ ok: true, panier })
    const ecran = await render(<CartContent pays={pays} achatOuvert={true} />)
    await expect.element(ecran.getByText(t.monnaiesMelees).first()).toBeVisible()
    expect(document.body.textContent).not.toContain(t.nonLivreesComptees(1))
    const bouton = ecran.getByRole('button', { name: t.continuer })
    await expect.element(bouton).toBeDisabled()
    expect(bouton.element().getAttribute('aria-describedby')).toBe('explication-continuer')
    expect(document.getElementById('explication-continuer')?.textContent).toBe(t.monnaiesMelees)
  })

  it('deux cartes dont l’une non livrée : total « — + 1 000 € », un seul colis, pas de bandeau ni « 0 jour »', async () => {
    useCartStore.setState({ slugs: ['nuit', 'aube'] })
    const panier = panierDeuxArtistes()
    panier.commandes = [
      { ...panier.commandes[0], lignes: [ligne('nuit', 'La nuit', { livree: false, raison: 'non_livree' })], somme: sansLivraison },
      { ...panier.commandes[1], lignes: [ligne('aube', 'L’aube', livre(100000, 0, 4, 6))], somme: somme(1, 100000, 0, 4, 6) },
    ]
    panier.total = { ...somme(1, 100000, 0, 4, 6), nonLivrees: 1 }
    recalculerPanier.mockResolvedValue({ ok: true, panier })
    const ecran = await render(<CartContent pays={pays} achatOuvert={true} />)
    await expect.element(ecran.getByText(t.additionTotaux(['—', formaterMontant(100000, 'EUR')]))).toBeVisible()
    expect(document.body.textContent).not.toMatch(/colis séparés/)
    expect(document.body.textContent).not.toContain('0 jour')
    await expect.element(ecran.getByRole('button', { name: t.continuer })).toBeDisabled()
    await expect.element(ecran.getByText(t.corrigerAvantContinuer)).toBeVisible()
  })

  it('pendant un recalcul : bandeau masqué, « Continuer » inactif ; cartes et sous-totaux recalculés au changement de pays', async () => {
    useCartStore.setState({ slugs: ['nuit', 'aube'] })
    recalculerPanier.mockResolvedValueOnce({ ok: true, panier: panierDeuxArtistes() })
    const ecran = await render(<CartContent pays={pays} achatOuvert={true} />)
    const bandeau = t.colis(2, [t.delaiCourt(7, 11), t.delaiCourt(10, 14)])
    await expect.element(ecran.getByText(bandeau)).toBeVisible()
    await expect.element(ecran.getByRole('link', { name: t.continuer, exact: true })).toBeVisible()

    let fin: (v: unknown) => void = () => {}
    recalculerPanier.mockReturnValueOnce(new Promise((r) => (fin = r)))
    await ecran.rerender(<CartContent pays={{ code: 'BE', nom: 'Belgique' }} achatOuvert={true} />)
    await expect.element(ecran.getByText(t.recalculEnCours)).toBeVisible()
    expect(document.body.textContent).not.toContain(bandeau)
    await expect.element(ecran.getByRole('button', { name: t.continuer })).toBeDisabled()

    const be = panierDeuxArtistes({ code: 'BE', nom: 'Belgique' })
    be.commandes[0] = { ...be.commandes[0], somme: somme(1, 240000, 15000, 12, 16) }
    be.commandes[1] = { ...be.commandes[1], somme: somme(1, 60000, 20000, 14, 18) }
    be.total = somme(2, 300000, 35000, 14, 18)
    fin({ ok: true, panier: be })
    await expect.element(ecran.getByText(formaterMontant(255000, 'EUR'), { exact: true }).first()).toBeVisible()
    await expect.element(ecran.getByText(formaterMontant(80000, 'EUR'), { exact: true }).first()).toBeVisible()
    await expect.element(ecran.getByText(formaterMontant(335000, 'EUR'), { exact: true }).first()).toBeVisible()
    await expect.element(ecran.getByText(t.colis(2, [t.delaiCourt(12, 16), t.delaiCourt(14, 18)]))).toBeVisible()
  })

  it('réponse périmée ignorée : le dernier recalcul l’emporte', async () => {
    useCartStore.setState({ slugs: ['nuit', 'aube'] })
    let finA: (v: unknown) => void = () => {}
    recalculerPanier.mockReturnValueOnce(new Promise((r) => (finA = r)))
    const ecran = await render(<CartContent pays={pays} achatOuvert={false} />)
    const be = panierDeuxArtistes({ code: 'BE', nom: 'Belgique' })
    be.total = somme(2, 300000, 35000, 14, 18)
    recalculerPanier.mockResolvedValueOnce({ ok: true, panier: be })
    await ecran.rerender(<CartContent pays={{ code: 'BE', nom: 'Belgique' }} achatOuvert={false} />)
    await expect.element(ecran.getByText(formaterMontant(335000, 'EUR'), { exact: true })).toBeVisible()
    finA({ ok: true, panier: panierDeuxArtistes() })
    await new Promise((r) => setTimeout(r, 100))
    await expect.element(ecran.getByText(formaterMontant(335000, 'EUR'), { exact: true })).toBeVisible()
    expect(document.body.textContent).not.toContain(formaterMontant(308000, 'EUR'))
  })

  it('erreur après un premier succès : message, montants masqués, panier conservé', async () => {
    useCartStore.setState({ slugs: ['nuit', 'aube'] })
    recalculerPanier.mockResolvedValueOnce({ ok: true, panier: panierDeuxArtistes() })
    const ecran = await render(<CartContent pays={pays} achatOuvert={false} />)
    await expect.element(ecran.getByRole('heading', { name: t.commande(1) })).toBeVisible()
    recalculerPanier.mockResolvedValueOnce({ ok: false })
    await ecran.rerender(<CartContent pays={{ code: 'BE', nom: 'Belgique' }} achatOuvert={false} />)
    await expect.element(ecran.getByText(t.erreur)).toBeVisible()
    expect(document.body.textContent).not.toContain('€')
    expect(useCartStore.getState().slugs).toEqual(['nuit', 'aube'])
  })

  it('« Réessayer » après un premier échec : recalcul visible, bouton inactif pendant l’essai, nouvel échec annoncé', async () => {
    useCartStore.setState({ slugs: ['nuit'] })
    recalculerPanier.mockResolvedValueOnce({ ok: false })
    const ecran = await render(<CartContent pays={pays} achatOuvert={false} />)
    await expect.element(ecran.getByText(t.erreur)).toBeVisible()
    let fin: (v: unknown) => void = () => {}
    recalculerPanier.mockReturnValueOnce(new Promise((r) => (fin = r)))
    await ecran.getByRole('button', { name: t.reessayer }).click()
    await expect.element(ecran.getByText(t.recalculEnCours)).toBeVisible()
    await expect.element(ecran.getByRole('button', { name: t.reessayer })).toBeDisabled()
    expect(document.querySelector('[role="alert"]')).toBeNull()
    fin({ ok: false })
    await expect.element(ecran.getByText(t.erreur)).toBeVisible()
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(t.erreur)
    await expect.element(ecran.getByRole('button', { name: t.reessayer })).not.toBeDisabled()
  })

  it('dernière œuvre retirée : retrait annoncé dans une région stable, focus sur « Parcourir la galerie »', async () => {
    useCartStore.setState({ slugs: ['nuit'] })
    const panier = panierDeuxArtistes()
    panier.commandes = [panier.commandes[0]]
    panier.total = somme(1, 240000, 0, 7, 11)
    recalculerPanier.mockResolvedValue({ ok: true, panier })
    const ecran = await render(<CartContent pays={pays} achatOuvert={false} />)
    const region = document.querySelector('[aria-live="polite"]')
    await ecran.getByRole('button', { name: t.retirer('La nuit') }).click()
    await expect.element(ecran.getByText(t.vide)).toBeVisible()
    expect(document.querySelector('[aria-live="polite"]')).toBe(region)
    expect(annonces()).toContain(t.retire('La nuit'))
    await vi.waitFor(() => expect(document.activeElement?.textContent).toBe(t.parcourir))
  })
})

describe('Store du panier (navigateur)', () => {
  it('ne garde que des slugs, dédoublonnés et plafonnés ; les prix de l’ancienne clé ne sont jamais repris', async () => {
    const { PLAFOND_PANIER } = await import('@/lib/panier/regles')
    const { addItem } = useCartStore.getState()
    expect(addItem('a')).toBe(true)
    expect(addItem('a')).toBe(true)
    expect(useCartStore.getState().slugs).toEqual(['a'])
    for (let i = 0; i < PLAFOND_PANIER + 5; i++) useCartStore.getState().addItem(`o${i}`)
    expect(useCartStore.getState().slugs).toHaveLength(PLAFOND_PANIER)
    expect(useCartStore.getState().addItem('encore')).toBe(false)

    useCartStore.setState({ slugs: ['a'] })
    const stocke = JSON.parse(localStorage.getItem(CLE_STOCKAGE_PANIER) ?? '{}')
    expect(stocke.state).toEqual({ slugs: ['a'] })

    // Ancien stockage (clé d'avant, avec prix) : seul l'identifiant est repris. Nouvelle clé altérée : seuls des slugs valides restent.
    localStorage.setItem('errancy-cart', JSON.stringify({ state: { items: [{ id: 'vieux', price: 1200 }] }, version: 0 }))
    localStorage.setItem(CLE_STOCKAGE_PANIER, JSON.stringify({ state: { slugs: ['b', 'b', 7, { id: 'x', price: 5 }, ''] }, version: 1 }))
    await useCartStore.persist.rehydrate()
    expect(useCartStore.getState().slugs).toEqual(['b', 'vieux'])
  })

  it('reprend les seuls identifiants de l’ancien panier (sans prix), puis supprime l’ancienne clé', async () => {
    localStorage.setItem(
      'errancy-cart',
      JSON.stringify({ state: { items: [{ id: 'vieux', price: 1200, title: 'T' }, { id: 'b', price: 5 }, { price: 9 }, 'x'] }, version: 0 }),
    )
    localStorage.setItem(CLE_STOCKAGE_PANIER, JSON.stringify({ state: { slugs: ['b', 'c'] }, version: 1 }))
    await useCartStore.persist.rehydrate()
    expect(useCartStore.getState().slugs).toEqual(['b', 'c', 'vieux'])
    expect(localStorage.getItem('errancy-cart')).toBeNull()
    const stocke = localStorage.getItem(CLE_STOCKAGE_PANIER) ?? ''
    expect(JSON.parse(stocke).state).toEqual({ slugs: ['b', 'c', 'vieux'] })
    expect(stocke).not.toContain('1200')
  })

  it('ancien panier sans nouvelle clé : repris ; stockage corrompu toléré', async () => {
    localStorage.setItem('errancy-cart', JSON.stringify({ state: { items: [{ id: 'seul', price: 1 }] }, version: 0 }))
    await useCartStore.persist.rehydrate()
    expect(useCartStore.getState().slugs).toEqual(['seul'])
    expect(JSON.parse(localStorage.getItem(CLE_STOCKAGE_PANIER) ?? '{}').state).toEqual({ slugs: ['seul'] })

    localStorage.clear()
    localStorage.setItem('errancy-cart', '{pas du json')
    await useCartStore.persist.rehydrate()
    expect(useCartStore.getState().slugs).toEqual([])
    expect(localStorage.getItem('errancy-cart')).toBeNull()
  })
})
