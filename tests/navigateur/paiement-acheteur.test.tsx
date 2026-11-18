import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fr } from '@/lib/i18n'
import type { RecapitulatifPaiement } from '@/lib/commandes'

// Récapitulatif et paiement (story 7.4) dans un vrai navigateur : zone neutre (sans formulaire, logo ni nom
// de prestataire, décoration `aria-hidden`), cartes par commande, total général, bandeau de colis séparés,
// réservation en heure fixe (fuseau de l'appareil forcé à Tokyo), état échu, lien Conseil. Les montants
// sont fournis par le serveur : le composant n'additionne rien.
vi.mock('@/lib/i18n', async (original) => ({ ...(await original<typeof import('@/lib/i18n')>()), fuseauAppareil: () => 'Asia/Tokyo' }))
vi.mock('@/app/commande/coordonnees/actions', () => ({ reprendreReservation: vi.fn(), modifierMaCommande: vi.fn(), envoyerCoordonnees: vi.fn(), completerCoordonnees: vi.fn() }))
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock('@/app/actions/pays', () => ({ choisirPaysLivraison: vi.fn() }))

const { CartesPaiement } = await import('@/app/commande/paiement/CartesPaiement')
const { ZoneNeutre } = await import('@/app/commande/paiement/ZoneNeutre')
const { ReservationHeureFixe } = await import('@/app/commande/coordonnees/ReservationHeureFixe')
const { default: ErreurPaiement } = await import('@/app/commande/paiement/error')
const { LienConseil } = await import('@/components/ui/LienConseil')
const t = fr.paiementAcheteur

const ligne = (slug: string, titre: string) => ({
  slug, titre, prixCentimes: 240000, fraisCentimes: 12000, totalCentimes: 252000, devise: 'EUR', delaiMinJours: 7, delaiMaxJours: 11,
})
const commande = (numero: string, artiste: string, slug: string, total: number) => ({
  numero, artiste, devise: 'EUR', lignes: [ligne(slug, `Titre ${slug}`)],
  prixCentimes: 240000, fraisCentimes: 12000, totalCentimes: total, delaiMinJours: 7, delaiMaxJours: 11,
})
const recapitulatif = (commandes: RecapitulatifPaiement['commandes'], total: number): RecapitulatifPaiement => ({
  passageId: 'p', pays: 'FR', devise: 'EUR', echeance: new Date('2026-11-20T06:42:00Z'), echue: false, commandes, totalCentimes: total,
})
const conseil = <LienConseil slug={null} mesure={false} href="/conseil">Demander conseil</LienConseil>

describe('Cartes du récapitulatif', () => {
  it('une commande : prix, livraison, prix total, délai, artiste, total général et droits ; pas de bandeau ni d’addition', async () => {
    const ecran = await render(<CartesPaiement recapitulatif={recapitulatif([commande('ERR-AAAA-BBBB', 'Atelier A', 'o1', 252000)], 252000)} />)
    const corps = (document.body.textContent ?? '').replace(/\s+/g, ' ')
    for (const attendu of ['ERR-AAAA-BBBB', 'Atelier A', 'Titre o1', '2 400 €', '120 €', '2 520 €', '7 à 11 jours', fr.livraison.droitsNonInclus]) {
      expect(corps).toContain(attendu.replace(/\s+/g, ' '))
    }
    expect(corps).not.toContain('colis séparés')
    expect(ecran.getByRole('heading', { name: t.totalGeneral })).toBeTruthy()
  })

  it('deux commandes : bandeau « 2 colis séparés, 2 délais », total « A + B » puis le total général', async () => {
    await render(
      <CartesPaiement
        recapitulatif={recapitulatif([commande('ERR-AAAA-BBBB', 'Atelier A', 'o1', 252000), commande('ERR-CCCC-DDDD', 'Atelier B', 'o2', 68000)], 320000)}
      />,
    )
    const corps = (document.body.textContent ?? '').replace(/\s+/g, ' ')
    expect(corps).toContain(t.colis(2, ['7 à 11 jours', '7 à 11 jours']).replace(/\s+/g, ' '))
    expect(corps).toContain('2 520 € + 680 €')
    expect(corps).toContain('3 200 €')
    expect(document.querySelectorAll('section[aria-labelledby^="commande-"]')).toHaveLength(2)
  })
})

describe('Affichage des cas limites', () => {
  it('délai nul : ligne « Délai » et bandeau masqués, jamais « 0 jour » ; artiste absent : ligne masquée, jamais « Artiste : » vide', async () => {
    const sans = { ...commande('ERR-AAAA-BBBB', '', 'o1', 252000), delaiMinJours: 0, delaiMaxJours: 0 }
    await render(<CartesPaiement recapitulatif={recapitulatif([sans, commande('ERR-CCCC-DDDD', 'Atelier B', 'o2', 68000)], 320000)} />)
    const corps = (document.body.textContent ?? '').replace(/\s+/g, ' ')
    expect(corps).not.toMatch(/0 jour/)
    expect(corps).not.toContain('Artiste :\u00a0')
    expect(corps).not.toMatch(/Artiste : *(Délai|Titre|Œuvres|$)/)
    expect(corps).not.toContain('colis séparés')
    expect(corps).toContain('Atelier B')
    expect(corps.match(/Délai/g)).toHaveLength(1)
  })

  it('commande sans œuvre : message neutre, la carte reste affichée avec son total', async () => {
    const vide = { ...commande('ERR-AAAA-BBBB', 'Atelier A', 'o1', 252000), lignes: [] }
    await render(<CartesPaiement recapitulatif={recapitulatif([vide], 252000)} />)
    const corps = document.body.textContent ?? ''
    expect(corps).toContain(t.sansOeuvre)
    expect(corps).toContain('ERR-AAAA-BBBB')
  })
})

describe('Erreur de la page', () => {
  it('« Réessayer » relance le rendu serveur et la frontière', async () => {
    refresh.mockClear()
    const reset = vi.fn()
    const ecran = await render(<ErreurPaiement error={new Error('x')} reset={reset} />)
    expect(ecran.getByRole('alert').element().textContent).toContain(t.panne)
    await ecran.getByRole('button', { name: t.reessayer }).click()
    await vi.waitFor(() => expect(reset).toHaveBeenCalledTimes(1))
    expect(refresh).toHaveBeenCalled()
  })
})

describe('Zone de paiement neutre', () => {
  it('nomme ce qui n’est pas décidé, invite à finaliser avec l’équipe, sans formulaire, champ, bouton, image ni prestataire', async () => {
    const ecran = await render(<ZoneNeutre numeros={['ERR-AAAA-BBBB', 'ERR-CCCC-DDDD']} conseil={conseil} />)
    expect(ecran.getByText(t.zoneNeutre.etiquette)).toBeTruthy()
    const corps = document.body.textContent ?? ''
    expect(corps).toContain(t.zoneNeutre.texte)
    expect(corps).toContain('ERR-AAAA-BBBB, ERR-CCCC-DDDD')
    expect(document.querySelectorAll('form, input, select, textarea, button, iframe, img, svg')).toHaveLength(0)
    expect(corps).not.toMatch(/stripe|paypal|mollie|adyen|visa|mastercard|carte bancaire/i)
    // La décoration hachurée est cachée aux technologies d'assistance et n'est pas interactive.
    const decor = document.querySelector('.zone-neutre') as HTMLElement
    expect(decor.getAttribute('aria-hidden')).toBe('true')
    expect(decor.querySelectorAll('a, [tabindex]')).toHaveLength(0)
    // Le lien Conseil est le seul élément interactif.
    expect(document.querySelectorAll('a')).toHaveLength(1)
    const lien = ecran.getByRole('link', { name: 'Demander conseil' })
    expect((lien.element() as HTMLAnchorElement).getAttribute('href')).toBe('/conseil')
  })
})

describe('Réservation en heure fixe sur la page de paiement', () => {
  it('bascule « a pris fin » reçue du serveur : la phrase change dans la région status et reçoit le focus', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-20T06:50:00Z'))
    try {
      const ecran = await render(<ReservationHeureFixe echeance="2026-11-20T06:42:00Z" echue={false} consommerMarque={false} />)
      await vi.waitFor(() => expect(ecran.getByRole('status').element().textContent).toBe('Œuvres réservées pour vous jusqu’à 15 h 42.'))
      expect(document.activeElement).toBe(document.body)
      await ecran.rerender(<ReservationHeureFixe echeance="2026-11-20T06:42:00Z" echue consommerMarque={false} />)
      await vi.waitFor(() => expect(ecran.getByRole('status').element().textContent).toBe('Votre réservation a pris fin à 15 h 42.'))
      const zone = ecran.getByRole('status').element().parentElement
      expect(document.activeElement).toBe(zone)
    } finally {
      vi.useRealTimers()
    }
  })

  it('en cours : « Œuvres réservées pour vous jusqu’à 15 h 42. » (06 h 42 UTC = 15 h 42 à Tokyo) ; aucun bouton', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-20T06:12:00Z'))
    try {
      const ecran = await render(<ReservationHeureFixe echeance="2026-11-20T06:42:00Z" echue={false} consommerMarque={false} />)
      await vi.waitFor(() => expect(ecran.getByRole('status').element().textContent).toBe('Œuvres réservées pour vous jusqu’à 15 h 42.'))
      expect(document.querySelectorAll('button')).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('échue : « Votre réservation a pris fin à 15 h 42. » et lien pour retenter vers les coordonnées', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-20T06:50:00Z'))
    try {
      const ecran = await render(
        <ReservationHeureFixe echeance="2026-11-20T06:42:00Z" echue consommerMarque={false}>
          <a href="/commande/coordonnees">{t.echue.retenter}</a>
        </ReservationHeureFixe>,
      )
      await vi.waitFor(() => expect(ecran.getByRole('status').element().textContent).toBe('Votre réservation a pris fin à 15 h 42.'))
      const lien = ecran.getByRole('link', { name: t.echue.retenter })
      expect((lien.element() as HTMLAnchorElement).getAttribute('href')).toBe('/commande/coordonnees')
    } finally {
      vi.useRealTimers()
    }
  })
})
