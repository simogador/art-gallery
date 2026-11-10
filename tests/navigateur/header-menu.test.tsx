import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { Header } from '@/components/layout/Header'
import { fr } from '@/lib/i18n'

// Menu mobile de l'en-tête dans un vrai navigateur : le rendu statique n'ouvre jamais le panneau.
// Routeur et action de déconnexion simulés.
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ refresh: () => {}, push: () => {} }) }))
vi.mock('@/app/auth/actions', () => ({ logout: () => {} }))

const t = fr.entete
const panneau = () => document.querySelector('[role="dialog"][aria-modal="true"]') as HTMLElement | null

describe('Header, accès à la demande de sélection (navigateur)', () => {
  it('« Contacter » mène à /conseil, en-tête et menu mobile', async () => {
    const ecran = await render(<Header session={null} lot2Ouvert={false} />)
    const liens = () => Array.from(document.querySelectorAll('a[href="/conseil"]'))
    expect(liens().filter((a) => a.textContent === t.contacter)).toHaveLength(1)
    await ecran.getByRole('button', { name: t.ouvrirMenu }).click()
    await vi.waitFor(() => expect(panneau()).not.toBeNull())
    expect(panneau()!.querySelector('a[href="/conseil"]')?.textContent).toBe(t.contacter)
  })
})

describe('Header, menu mobile (navigateur)', () => {
  it('Lot 2 fermé : le panneau ouvert n’a ni lien /panier ni « Panier »', async () => {
    const ecran = await render(<Header session={null} lot2Ouvert={false} />)
    await ecran.getByRole('button', { name: t.ouvrirMenu }).click()
    await vi.waitFor(() => expect(panneau()).not.toBeNull())
    await expect.element(ecran.getByRole('button', { name: t.fermerMenu })).toBeVisible()
    expect(panneau()!.querySelector('a[href="/panier"]')).toBeNull()
    expect(panneau()!.textContent).not.toContain(t.panier)
    expect(panneau()!.querySelector('a[href="/galerie"]')).not.toBeNull()
  })

  it('Lot 2 ouvert : le panneau ouvert contient le lien /panier', async () => {
    const ecran = await render(<Header session={null} lot2Ouvert />)
    await ecran.getByRole('button', { name: t.ouvrirMenu }).click()
    await vi.waitFor(() => expect(panneau()).not.toBeNull())
    expect(panneau()!.querySelector('a[href="/panier"]')).not.toBeNull()
    expect(panneau()!.textContent).toContain(t.panier)
  })
})
