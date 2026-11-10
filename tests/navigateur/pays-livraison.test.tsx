import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { fr } from '@/lib/i18n'

// Choix du pays de livraison dans un vrai navigateur : action serveur et routeur simulés.
const refresh = vi.fn()
const choisirPaysLivraison = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/app/actions/pays', () => ({ choisirPaysLivraison: (code: unknown) => choisirPaysLivraison(code) }))

const { PaysLivraison } = await import('@/components/ui/PaysLivraison')
const t = fr.livraison

beforeEach(() => {
  refresh.mockReset()
  choisirPaysLivraison.mockReset()
})

describe('PaysLivraison (navigateur)', () => {
  it('choisit un pays au clavier : action appelée avec le code ISO, rafraîchissement demandé, liste annoncée', async () => {
    choisirPaysLivraison.mockResolvedValue({ ok: true, code: 'BE', nom: 'Belgique' })
    const ecran = await render(<PaysLivraison code="FR" nom="France" />)
    await expect.element(ecran.getByText(t.paysChoisi('France'))).toBeVisible()

    const modifier = ecran.getByRole('button', { name: t.modifierPays('France') })
    await modifier.click()
    const liste = ecran.getByRole('combobox', { name: t.libelleListe })
    await expect.element(liste).toHaveValue('FR')

    // Choix au clavier : le focus sur la liste, la lettre du nom, puis Tab jusqu'à « Valider » et Entrée.
    ;(liste.element() as HTMLElement).focus()
    await userEvent.keyboard('Belg')
    await expect.element(liste).toHaveValue('BE')
    await userEvent.tab()
    await expect.element(ecran.getByRole('button', { name: t.valider })).toHaveFocus()
    await userEvent.keyboard('{Enter}')

    await vi.waitFor(() => expect(choisirPaysLivraison).toHaveBeenCalledWith('BE'))
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    // Le formulaire se ferme, le focus revient sur « Modifier ».
    await expect.element(ecran.getByRole('combobox')).not.toBeInTheDocument()
    await expect.element(modifier).toHaveFocus()
    // La zone aria-live annonce le recalcul une fois la page rafraîchie (nouveau `code` reçu).
    await ecran.rerender(<PaysLivraison code="BE" nom="Belgique" />)
    await expect.element(ecran.getByText(t.recalcules('Belgique'))).toBeInTheDocument()
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(t.recalcules('Belgique'))
  })

  it('Échap ferme le formulaire sans appeler l’action', async () => {
    const ecran = await render(<PaysLivraison code="FR" nom="France" />)
    await ecran.getByRole('button', { name: t.modifierPays('France') }).click()
    await expect.element(ecran.getByRole('combobox')).toBeVisible()
    ;(ecran.getByRole('combobox').element() as HTMLElement).focus()
    await userEvent.keyboard('{Escape}')
    await vi.waitFor(() => expect(document.querySelector('select')).toBeNull())
    expect(choisirPaysLivraison).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('affiche l’erreur de l’action et laisse le formulaire ouvert', async () => {
    choisirPaysLivraison.mockResolvedValue({ ok: false })
    const ecran = await render(<PaysLivraison code="FR" nom="France" />)
    await ecran.getByRole('button', { name: t.modifierPays('France') }).click()
    await ecran.getByRole('button', { name: t.valider }).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(t.erreur)
    await expect.element(ecran.getByRole('combobox')).toBeVisible()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('traite une action qui échoue (exception) comme une erreur affichée', async () => {
    choisirPaysLivraison.mockRejectedValue(new Error('réseau'))
    const ecran = await render(<PaysLivraison code="FR" nom="France" />)
    await ecran.getByRole('button', { name: t.modifierPays('France') }).click()
    await ecran.getByRole('button', { name: t.valider }).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(t.erreur)
    expect(refresh).not.toHaveBeenCalled()
  })
})
