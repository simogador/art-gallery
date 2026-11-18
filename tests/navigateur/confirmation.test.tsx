import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fr } from '@/lib/i18n'
import type { CommandeConfirmation } from '@/lib/commandes'

// Confirmation de commande (story 7.6) dans un vrai navigateur : cartes (« Confirmée » seulement pour une
// commande confirmée), mise à jour automatique (toutes les 20 s, 10 minutes au plus, arrêt à la confirmation,
// minuteur nettoyé), annonce et focus à la bascule, « Suivre mes commandes » inactif, panier vidé, aucun lien
// de création de compte. Les états viennent du serveur : les composants ne décident de rien.
const refresh = vi.fn()
const push = vi.fn()
const ouvrirSuivi = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }))
vi.mock('@/app/confirmation/actions', () => ({ ouvrirSuivi: (...a: unknown[]) => ouvrirSuivi(...a) }))
vi.mock('@/app/actions/pays', () => ({ choisirPaysLivraison: vi.fn() }))

const { CartesConfirmation } = await import('@/app/confirmation/CartesConfirmation')
const { MiseAJourAuto } = await import('@/app/confirmation/MiseAJourAuto')
const { SuivreCommandes } = await import('@/app/confirmation/SuivreCommandes')
const { CartClearer } = await import('@/app/confirmation/CartClearer')
const { useCartStore } = await import('@/lib/store/cart')
const t = fr.confirmation

const commande = (numero: string, artiste: string, etat: CommandeConfirmation['etat'], slug: string): CommandeConfirmation => ({
  numero, artiste, etat, devise: 'EUR',
  lignes: [{ slug, titre: `Titre ${slug}`, prixCentimes: 240000, fraisCentimes: 12000, totalCentimes: 252000, devise: 'EUR', delaiMinJours: 7, delaiMaxJours: 11 }],
  prixCentimes: 240000, fraisCentimes: 12000, totalCentimes: 252000, delaiMinJours: 7, delaiMaxJours: 11,
})

afterEach(() => {
  vi.useRealTimers()
  refresh.mockClear()
  push.mockClear()
  ouvrirSuivi.mockReset()
})

describe('Cartes de confirmation', () => {
  it('commandes confirmées : numéro, artiste, œuvre, délai, prix total et « Confirmée » sur chacune', async () => {
    await render(<CartesConfirmation commandes={[commande('ERR-AAAA-BBBB', 'Atelier A', 'confirmee', 'o1'), commande('ERR-CCCC-DDDD', 'Atelier B', 'confirmee', 'o2')]} />)
    const corps = (document.body.textContent ?? '').replace(/\s+/g, ' ')
    for (const attendu of ['ERR-AAAA-BBBB', 'ERR-CCCC-DDDD', 'Atelier A', 'Atelier B', 'Titre o1', 'Titre o2', '7 à 11 jours', '2 520 €']) {
      expect(corps).toContain(attendu.replace(/\s+/g, ' '))
    }
    expect(corps.match(new RegExp(t.etats.confirmee, 'g'))).toHaveLength(2)
    expect(document.querySelectorAll('section[aria-labelledby^="commande-"]')).toHaveLength(2)
  })

  it('en attente : jamais « Confirmée » ; annulée : « Annulée » ; mixte : chaque carte à son état', async () => {
    await render(
      <CartesConfirmation
        commandes={[commande('ERR-AAAA-BBBB', 'Atelier A', 'en_attente_paiement', 'o1'), commande('ERR-CCCC-DDDD', 'Atelier B', 'annulee', 'o2'), commande('ERR-EEEE-FFFF', 'Atelier C', 'confirmee', 'o3')]}
      />,
    )
    const etat = (n: string) => document.querySelector(`#commande-${n}`)?.closest('section')?.querySelector('[data-etat]')?.textContent
    expect(etat('ERR-AAAA-BBBB')).toBe(t.etats.enAttente)
    expect(etat('ERR-CCCC-DDDD')).toBe(t.etats.annulee)
    expect(etat('ERR-EEEE-FFFF')).toBe(t.etats.confirmee)
  })

  it('en attente seule : le mot « Confirmée » est absent de la page', async () => {
    await render(<CartesConfirmation commandes={[commande('ERR-AAAA-BBBB', 'Atelier A', 'en_attente_paiement', 'o1')]} />)
    expect(document.body.textContent).not.toContain(t.etats.confirmee)
  })

  it('artiste absent : ligne masquée ; délai nul : ligne masquée', async () => {
    const c = { ...commande('ERR-AAAA-BBBB', '', 'confirmee', 'o1'), delaiMinJours: 0, delaiMaxJours: 0 }
    await render(<CartesConfirmation commandes={[c]} />)
    const corps = document.body.textContent ?? ''
    expect(corps).not.toContain('Artiste')
    expect(corps).not.toMatch(/0 jour/)
  })
})

const props = { confirmee: false, annulee: false }
const titre = <h1 id="titre" tabIndex={-1}>Titre</h1>

function cacher(oui: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => oui })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('Mise à jour automatique', () => {
  it('toutes les 20 secondes pendant 10 minutes au plus, puis plus rien et « Rechargez la page »', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const ecran = await render(<MiseAJourAuto enAttente {...props} idTitre="titre" />)
    expect(document.body.textContent).toContain(t.majAuto)
    vi.advanceTimersByTime(19_000)
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1_000)
    expect(refresh).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10 * 60_000 - 20_000)
    expect(refresh).toHaveBeenCalledTimes(30)
    await vi.waitFor(() => expect(document.body.textContent).toContain(t.rechargez))
    expect(document.body.textContent).not.toContain(t.majAuto)
    vi.advanceTimersByTime(5 * 60_000)
    expect(refresh).toHaveBeenCalledTimes(30)
    ecran.unmount()
  })

  it('onglet caché : aucun rafraîchissement, un seul au retour', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    try {
      await render(<MiseAJourAuto enAttente {...props} idTitre="titre" />)
      cacher(true)
      vi.advanceTimersByTime(100_000)
      expect(refresh).not.toHaveBeenCalled()
      cacher(false)
      expect(refresh).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(20_000)
      expect(refresh).toHaveBeenCalledTimes(2)
    } finally {
      cacher(false)
    }
  })

  it('bascule vers confirmé : annonce « confirmée » dans la région status et focus sur le titre', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const ecran = await render(<>{titre}<MiseAJourAuto enAttente {...props} idTitre="titre" /></>)
    expect(ecran.getByRole('status').element().textContent).toBe('')
    vi.advanceTimersByTime(40_000)
    expect(refresh).toHaveBeenCalledTimes(2)
    await ecran.rerender(<>{titre}<MiseAJourAuto enAttente={false} confirmee annulee={false} idTitre="titre" /></>)
    await vi.waitFor(() => expect(ecran.getByRole('status').element().textContent).toBe(t.bascule))
    expect(document.activeElement?.id).toBe('titre')
    vi.advanceTimersByTime(5 * 60_000)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('bascule vers annulé : autre annonce, jamais « confirmée », focus inchangé', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const ecran = await render(<>{titre}<MiseAJourAuto enAttente {...props} idTitre="titre" /></>)
    await ecran.rerender(<>{titre}<MiseAJourAuto enAttente={false} confirmee={false} annulee idTitre="titre" /></>)
    await vi.waitFor(() => expect(ecran.getByRole('status').element().textContent).toBe(t.basculeAnnulee))
    expect(document.activeElement).toBe(document.body)
  })

  it('bascule vers « réservation échue » (ni confirmé ni annulé) : aucune annonce, aucun focus', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const ecran = await render(<>{titre}<MiseAJourAuto enAttente {...props} idTitre="titre" /></>)
    await ecran.rerender(<>{titre}<MiseAJourAuto enAttente={false} {...props} idTitre="titre" /></>)
    expect(ecran.getByRole('status').element().textContent).toBe('')
    expect(document.activeElement).toBe(document.body)
  })

  it('déjà confirmé à l’ouverture : aucun rafraîchissement, aucune annonce, aucun focus volé', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const ecran = await render(<MiseAJourAuto enAttente={false} confirmee annulee={false} idTitre="titre" />)
    vi.advanceTimersByTime(60_000)
    expect(refresh).not.toHaveBeenCalled()
    expect(ecran.getByRole('status').element().textContent).toBe('')
    expect(document.activeElement).toBe(document.body)
  })

  it('le minuteur est nettoyé au démontage', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const ecran = await render(<MiseAJourAuto enAttente {...props} idTitre="titre" />)
    vi.advanceTimersByTime(20_000)
    expect(refresh).toHaveBeenCalledTimes(1)
    ecran.unmount()
    vi.advanceTimersByTime(5 * 60_000)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('Suivre mes commandes, panier et compte', () => {
  it('« Suivre mes commandes » : actif, l’action serveur est appelée puis /suivi s’ouvre ; aucun lien ni compte', async () => {
    ouvrirSuivi.mockResolvedValue({ ok: true })
    const ecran = await render(<SuivreCommandes />)
    const bouton = ecran.getByRole('button', { name: t.suivre }).element() as HTMLButtonElement
    expect(bouton.getAttribute('aria-disabled')).toBeNull()
    expect(bouton.disabled).toBe(false)
    bouton.focus()
    expect(document.activeElement).toBe(bouton)
    bouton.click()
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/suivi'))
    expect(ouvrirSuivi).toHaveBeenCalledTimes(1)
    expect(document.querySelectorAll('a')).toHaveLength(0)
    expect(document.body.textContent).not.toMatch(/compte|connexion|inscri/i)
  })

  it('« Suivre mes commandes » : un double appui n’appelle l’action qu’une fois', async () => {
    let fin: (v: { ok: true }) => void = () => undefined
    ouvrirSuivi.mockReturnValue(new Promise((r) => (fin = r)))
    const ecran = await render(<SuivreCommandes />)
    const bouton = ecran.getByRole('button').element() as HTMLButtonElement
    bouton.click()
    bouton.click()
    expect(ouvrirSuivi).toHaveBeenCalledTimes(1)
    fin({ ok: true })
    await vi.waitFor(() => expect(push).toHaveBeenCalledTimes(1))
  })

  it('« Suivre mes commandes » : échec ou cookie absent, message neutre annoncé, aucune navigation, nouvel essai possible', async () => {
    ouvrirSuivi.mockResolvedValue({ ok: false, code: 'invalide' })
    const ecran = await render(<SuivreCommandes />)
    const bouton = ecran.getByRole('button').element() as HTMLButtonElement
    bouton.click()
    await vi.waitFor(() => expect(ecran.getByRole('status').element().textContent).toBe(t.suivreErreur))
    expect(push).not.toHaveBeenCalled()
    ouvrirSuivi.mockResolvedValue({ ok: true })
    bouton.click()
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/suivi'))
    ouvrirSuivi.mockRejectedValue(new Error('x'))
  })

  it('« Suivre mes commandes » : plafond de liens atteint, message neutre distinct', async () => {
    ouvrirSuivi.mockResolvedValue({ ok: false, code: 'trop_de_liens' })
    const ecran = await render(<SuivreCommandes />)
    ;(ecran.getByRole('button').element() as HTMLButtonElement).click()
    await vi.waitFor(() => expect(ecran.getByRole('status').element().textContent).toBe(t.suivreTropDeLiens))
    expect(push).not.toHaveBeenCalled()
  })

  it('CartClearer ne retire que les œuvres confirmées : une œuvre en attente ou d’un panier neuf reste', async () => {
    useCartStore.setState({ slugs: ['o1', 'o2', 'neuve'] })
    await render(<CartClearer slugs={['o1', 'o2']} />)
    await vi.waitFor(() => expect(useCartStore.getState().slugs).toEqual(['neuve']))
  })

  it('CartClearer sans œuvre confirmée ne touche à rien', async () => {
    useCartStore.setState({ slugs: ['o1'] })
    await render(<CartClearer slugs={[]} />)
    expect(useCartStore.getState().slugs).toEqual(['o1'])
  })
})

describe('Chargement et erreur', () => {
  it('chargement : message pour les lecteurs d’écran, région occupée', async () => {
    const { default: Chargement } = await import('@/app/confirmation/loading')
    const ecran = await render(<Chargement />)
    expect(ecran.getByRole('status').element().getAttribute('aria-busy')).toBe('true')
    expect(document.body.textContent).toContain(t.chargement)
  })

  it('erreur : « Réessayer » relance le rendu serveur et la frontière', async () => {
    const { default: Erreur } = await import('@/app/confirmation/error')
    const reset = vi.fn()
    const ecran = await render(<Erreur error={new Error('x')} reset={reset} />)
    expect(ecran.getByRole('alert').element().textContent).toContain(t.panne)
    await ecran.getByRole('button', { name: t.reessayer }).click()
    await vi.waitFor(() => expect(reset).toHaveBeenCalledTimes(1))
    expect(refresh).toHaveBeenCalled()
  })
})
