import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fr, formaterDateHeure, fuseauAppareil } from '@/lib/i18n'

// « Je prends en charge » (story 8.1) dans un vrai navigateur : action serveur et routeur simulés. Rien n'est
// envoyé au premier appui (confirmation en deux temps, focus sur « Confirmer »), « Annuler » rend le focus au
// bouton, un seul appel malgré un double appui, résultat annoncé (`role="status"`, qui reçoit le focus), page
// relue ; une fois la commande prise en charge, le bouton disparaît et l'annonce reste. Heure fixe dans le fuseau
// de l'appareil, écrite après le montage.
const actionPrendreEnCharge = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => refresh(), push: () => {} }) }))
vi.mock('@/app/dashboard/artiste/commandes/actions', () => ({
  actionPrendreEnCharge: (...a: unknown[]) => actionPrendreEnCharge(...a),
}))

const { PriseEnCharge } = await import('@/app/dashboard/artiste/commandes/PriseEnCharge')
const { HeureFixe } = await import('@/app/dashboard/artiste/commandes/HeureFixe')
const t = fr.commandesArtiste.action
const NUMERO = 'ERR-AAAA-BBBB'

beforeEach(() => {
  actionPrendreEnCharge.mockReset()
  refresh.mockReset()
})

describe('PriseEnCharge (navigateur)', () => {
  it('premier appui : la question s’ouvre, focus sur « Confirmer », rien n’est envoyé ; « Annuler » rend le focus', async () => {
    const ecran = await render(<PriseEnCharge numero={NUMERO} />)
    await ecran.getByRole('button', { name: t.prendre }).click()
    await expect.element(ecran.getByText(t.question)).toBeVisible()
    const confirmer = ecran.getByRole('button', { name: t.confirmer })
    await vi.waitFor(() => expect(document.activeElement?.textContent).toBe(t.confirmer))
    await expect.element(confirmer).toHaveAttribute('aria-describedby', `question-${NUMERO}`)
    expect(actionPrendreEnCharge).not.toHaveBeenCalled()
    await ecran.getByRole('button', { name: t.annuler }).click()
    await vi.waitFor(() => expect(document.activeElement?.textContent).toBe(t.prendre))
    expect(actionPrendreEnCharge).not.toHaveBeenCalled()
  })

  it('confirmation : un seul appel malgré un double appui, annonce et focus sur la région, page relue', async () => {
    let fin: (v: unknown) => void = () => {}
    actionPrendreEnCharge.mockReturnValue(new Promise((r) => { fin = r }))
    const ecran = await render(<PriseEnCharge numero={NUMERO} />)
    await ecran.getByRole('button', { name: t.prendre }).click()
    const bouton = [...ecran.container.querySelectorAll('button')].find((b) => b.textContent === t.confirmer) as HTMLButtonElement
    bouton.click()
    bouton.click()
    expect(actionPrendreEnCharge).toHaveBeenCalledTimes(1)
    expect(actionPrendreEnCharge).toHaveBeenCalledWith(NUMERO)
    fin({ ok: true, message: t.reussi })
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.reussi)
    expect(refresh).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('status'))
    // Avant même la page relue, le bouton ne revient pas.
    expect(ecran.container.querySelectorAll('button')).toHaveLength(0)
    // La page relue passe `prise` : toujours aucun bouton, l'annonce reste.
    await ecran.rerender(<PriseEnCharge numero={NUMERO} prise />)
    expect(ecran.container.querySelectorAll('button')).toHaveLength(0)
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.reussi)
  })

  it('refus : message neutre annoncé, page non relue, bouton de nouveau disponible', async () => {
    actionPrendreEnCharge.mockResolvedValue({ ok: false, message: t.erreurs.introuvable })
    const ecran = await render(<PriseEnCharge numero={NUMERO} />)
    await ecran.getByRole('button', { name: t.prendre }).click()
    await ecran.getByRole('button', { name: t.confirmer }).click()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.erreurs.introuvable)
    expect(refresh).not.toHaveBeenCalled()
    await expect.element(ecran.getByRole('button', { name: t.prendre })).toBeEnabled()
  })

  it('action qui échoue : message d’indisponibilité', async () => {
    actionPrendreEnCharge.mockRejectedValue(new Error('boom'))
    const ecran = await render(<PriseEnCharge numero={NUMERO} />)
    await ecran.getByRole('button', { name: t.prendre }).click()
    await ecran.getByRole('button', { name: t.confirmer }).click()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.erreurs.indisponible)
  })

  it('déjà prise en charge : aucun bouton', async () => {
    const ecran = await render(<PriseEnCharge numero={NUMERO} prise />)
    expect(ecran.container.querySelectorAll('button')).toHaveLength(0)
  })
})

describe('HeureFixe (navigateur)', () => {
  it('écrit la date et l’heure dans le fuseau de l’appareil, sans compte à rebours', async () => {
    const iso = '2026-11-21T14:42:00.000Z'
    const ecran = await render(<HeureFixe iso={iso} />)
    const attendu = formaterDateHeure(iso, { fuseau: fuseauAppareil() })
    await vi.waitFor(() => expect(ecran.container.textContent).toBe(attendu))
    expect(ecran.container.querySelector('time')?.getAttribute('dateTime')).toBe(iso)
  })
})
