import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LienConseil } from '@/components/ui/LienConseil'

// Lien du bouton Conseil dans un vrai navigateur : le clic est signalé à /api/mesure seulement quand
// c'est le lien WhatsApp ; l'adresse et la cible du lien ne changent pas. `fetch` simulé.
const fetchSimule = vi.fn()

beforeEach(() => {
  fetchSimule.mockReset()
  fetchSimule.mockResolvedValue(new Response('{"ok":true}'))
  vi.stubGlobal('fetch', fetchSimule)
})

// Le clic ne doit pas quitter la page de test : on annule la navigation après l'avoir observée.
const sansNavigation = (e: Event) => e.preventDefault()

describe('LienConseil (navigateur)', () => {
  it('mode WhatsApp, sur une fiche : POST evenement/ClicConseil avec le slug, lien inchangé', async () => {
    document.addEventListener('click', sansNavigation)
    const ecran = await render(<LienConseil slug="nuit-blanche" mesure href="https://wa.me/0?text=x" target="_blank" rel="noopener noreferrer">Conseil</LienConseil>)
    const lien = ecran.getByRole('link', { name: 'Conseil' })
    await lien.click()
    await vi.waitFor(() => expect(fetchSimule).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSimule.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/mesure')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toMatchObject({ type: 'evenement', nom: 'ClicConseil', slug: 'nuit-blanche' })
    const a = lien.element() as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('https://wa.me/0?text=x')
    expect(a.target).toBe('_blank')
    document.removeEventListener('click', sansNavigation)
  })

  it('hors fiche : slug null', async () => {
    document.addEventListener('click', sansNavigation)
    const ecran = await render(<LienConseil slug={null} mesure href="https://wa.me/0" target="_blank">Conseil</LienConseil>)
    await ecran.getByRole('link', { name: 'Conseil' }).click()
    await vi.waitFor(() => expect(fetchSimule).toHaveBeenCalledTimes(1))
    expect(JSON.parse((fetchSimule.mock.calls[0]![1] as RequestInit).body as string).slug).toBeNull()
    document.removeEventListener('click', sansNavigation)
  })

  it('pas en mode WhatsApp (repli vers /conseil) : rien n’est envoyé, lien inchangé', async () => {
    document.addEventListener('click', sansNavigation)
    const ecran = await render(<LienConseil slug="nuit-blanche" mesure={false} href="/conseil">Demander conseil</LienConseil>)
    const lien = ecran.getByRole('link', { name: 'Demander conseil' })
    await lien.click()
    await new Promise((r) => setTimeout(r, 100))
    expect(fetchSimule).not.toHaveBeenCalled()
    expect((lien.element() as HTMLAnchorElement).getAttribute('href')).toBe('/conseil')
    document.removeEventListener('click', sansNavigation)
  })
})
