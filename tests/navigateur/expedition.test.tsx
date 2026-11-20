import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fr } from '@/lib/i18n'

// « Marquer comme expédiée » (story 8.2) dans un vrai navigateur : action serveur et routeur simulés. Les champs
// de l'assurance n'existent qu'au-dessus du seuil (décidé par le serveur), un seul appel malgré un double appui,
// erreurs par champ en résumé (focus) et saisie conservée, succès annoncé (`role="status"`) puis page relue ;
// une fois expédiée, le formulaire disparaît et l'annonce reste.
const actionMarquerExpediee = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => refresh(), push: () => {} }) }))
vi.mock('@/app/dashboard/artiste/commandes/actions', () => ({
  actionMarquerExpediee: (...a: unknown[]) => actionMarquerExpediee(...a),
}))

const { FormulaireExpedition } = await import('@/app/dashboard/artiste/commandes/FormulaireExpedition')
const t = fr.commandesArtiste.expedition
const NUMERO = 'ERR-AAAA-BBBB'

beforeEach(() => {
  actionMarquerExpediee.mockReset()
  refresh.mockReset()
})

const champ = (c: HTMLElement, id: string) => c.querySelector(`#expedition-${id}`) as HTMLInputElement

async function saisir(el: HTMLInputElement, valeur: string) {
  // Champ contrôlé par React : passer par le setter natif pour que `onChange` voie la valeur.
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  el.focus()
  setter?.call(el, valeur)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('FormulaireExpedition (navigateur)', () => {
  it('sous le seuil : transporteur et numéro seulement, aucun champ d’assurance', async () => {
    const ecran = await render(<FormulaireExpedition numero={NUMERO} assurance={false} seuil="1 000 €" />)
    expect(champ(ecran.container, 'transporteur')).not.toBeNull()
    expect(champ(ecran.container, 'numeroSuivi')).not.toBeNull()
    expect(champ(ecran.container, 'envoiAssure')).toBeNull()
    expect(champ(ecran.container, 'referenceAssurance')).toBeNull()
  })

  it('au-dessus du seuil : case et référence présentes ; refus par champ en résumé, saisie conservée', async () => {
    actionMarquerExpediee.mockResolvedValue({
      ok: false,
      message: t.resume(2),
      erreurs: { envoiAssure: t.erreurs.assuranceCase, referenceAssurance: t.erreurs.assuranceReference },
    })
    const ecran = await render(<FormulaireExpedition numero={NUMERO} assurance seuil="1 000 €" />)
    await saisir(champ(ecran.container, 'transporteur'), 'DHL')
    await saisir(champ(ecran.container, 'numeroSuivi'), 'JD0123456789')
    await ecran.getByRole('button', { name: t.marquer }).click()
    await vi.waitFor(() => expect(ecran.container.querySelector('[role="alert"]')?.textContent).toContain(t.erreurs.assuranceCase))
    expect(ecran.container.querySelector('[role="alert"]')?.textContent).toContain(t.erreurs.assuranceReference)
    await vi.waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('alert'))
    expect(actionMarquerExpediee).toHaveBeenCalledWith(NUMERO, { transporteur: 'DHL', numeroSuivi: 'JD0123456789', envoiAssure: false, referenceAssurance: '' })
    expect(champ(ecran.container, 'transporteur').value).toBe('DHL')
    expect(champ(ecran.container, 'envoiAssure').getAttribute('aria-invalid')).toBe('true')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('succès : un seul appel malgré un double appui, annonce et focus, page relue ; puis plus de formulaire', async () => {
    let fin: (v: unknown) => void = () => {}
    actionMarquerExpediee.mockReturnValue(new Promise((r) => { fin = r }))
    const ecran = await render(<FormulaireExpedition numero={NUMERO} assurance={false} seuil="1 000 €" />)
    await saisir(champ(ecran.container, 'transporteur'), 'Colissimo')
    await saisir(champ(ecran.container, 'numeroSuivi'), '6A12345678')
    const form = ecran.container.querySelector('form') as HTMLFormElement
    form.requestSubmit()
    form.requestSubmit()
    expect(actionMarquerExpediee).toHaveBeenCalledTimes(1)
    fin({ ok: true, message: t.reussi })
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.reussi)
    expect(refresh).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('status'))
    await ecran.rerender(<FormulaireExpedition numero={NUMERO} assurance={false} seuil="1 000 €" expediee />)
    expect(ecran.container.querySelector('form')).toBeNull()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.reussi)
  })

  it('échec technique : message neutre, bouton réarmé', async () => {
    actionMarquerExpediee.mockRejectedValue(new Error('x'))
    const ecran = await render(<FormulaireExpedition numero={NUMERO} assurance={false} seuil="1 000 €" />)
    await ecran.getByRole('button', { name: t.marquer }).click()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.erreurs.indisponible)
    expect((ecran.container.querySelector('button') as HTMLButtonElement).disabled).toBe(false)
  })
})
