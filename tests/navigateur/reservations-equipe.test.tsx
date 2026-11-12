import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fr } from '@/lib/i18n'

// Réservations en cours de l'équipe (story 6.3 bis) dans un vrai navigateur : actions serveur et routeur
// simulés. Libérer demande une confirmation (annulable), le renvoi n'est proposé que sans lien actif,
// le résultat est annoncé, la liste est relue (`router.refresh`), un seul appel malgré un double appui.
const actionLibererVenteAssistee = vi.fn()
const actionRenvoyerLien = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => refresh(), push: () => {} }) }))
vi.mock('@/app/dashboard/admin/commandes/actions', () => ({
  actionLibererVenteAssistee: (...a: unknown[]) => actionLibererVenteAssistee(...a),
  actionRenvoyerLien: (...a: unknown[]) => actionRenvoyerLien(...a),
}))

const { ReservationsEquipe } = await import('@/app/dashboard/admin/commandes/ReservationsEquipe')
const t = fr.venteAssistee.suivi

const vente = (surcharge = {}) => ({
  passageId: 'p1',
  beneficiaire: 'Claire Martin (claire@exemple.test)',
  origine: t.origines.vente_assistee,
  echeance: '13 novembre 2026 à 10 h 00',
  echue: false,
  lienActif: true,
  liberable: true,
  oeuvres: ['Nuit bleue', 'Rivage'],
  ...surcharge,
})

beforeEach(() => {
  actionLibererVenteAssistee.mockReset()
  actionRenvoyerLien.mockReset()
  refresh.mockReset()
})

describe('ReservationsEquipe (navigateur)', () => {
  it('liste vide : message d’état vide', async () => {
    const ecran = await render(<ReservationsEquipe ventes={[]} />)
    await expect.element(ecran.getByText(t.vide)).toBeVisible()
  })

  it('affiche œuvres, bénéficiaire, origine, échéance ; pas de « Renvoyer » quand le lien est actif', async () => {
    const ecran = await render(<ReservationsEquipe ventes={[vente()]} />)
    const texte = ecran.container.textContent ?? ''
    for (const attendu of ['Nuit bleue, Rivage', 'Claire Martin (claire@exemple.test)', t.origines.vente_assistee, '13 novembre 2026 à 10 h 00']) {
      expect(texte).toContain(attendu)
    }
    await expect.element(ecran.getByText(t.lienEnvoye)).toBeVisible()
    expect(ecran.container.textContent).not.toContain(t.renvoyer)
  })

  it('libérer : confirmation d’abord, annulable ; confirmée, action appelée, résultat annoncé, liste relue', async () => {
    actionLibererVenteAssistee.mockResolvedValue({ ok: true, message: t.liberee })
    const ecran = await render(<ReservationsEquipe ventes={[vente()]} />)
    await ecran.getByRole('button', { name: t.liberer }).click()
    expect(actionLibererVenteAssistee).not.toHaveBeenCalled()
    await ecran.getByRole('button', { name: t.annuler }).click()
    expect(actionLibererVenteAssistee).not.toHaveBeenCalled()
    await ecran.getByRole('button', { name: t.liberer }).click()
    await ecran.getByRole('button', { name: t.confirmer }).click()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.liberee)
    expect(actionLibererVenteAssistee).toHaveBeenCalledTimes(1)
    expect(actionLibererVenteAssistee).toHaveBeenCalledWith('p1')
    expect(refresh).toHaveBeenCalled()
  })

  it('renvoyer : proposé sans lien actif ; succès annoncé ; échec d’envoi annoncé en alerte', async () => {
    actionRenvoyerLien.mockResolvedValueOnce({ ok: true, message: t.renvoyee })
    const ecran = await render(<ReservationsEquipe ventes={[vente({ lienActif: false })]} />)
    await expect.element(ecran.getByText(t.lienNonEnvoye)).toBeVisible()
    await ecran.getByRole('button', { name: t.renvoyer }).click()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.renvoyee)
    expect(actionRenvoyerLien).toHaveBeenCalledWith('p1')
    actionRenvoyerLien.mockResolvedValueOnce({ ok: false, message: fr.venteAssistee.emailNonParti })
    await ecran.getByRole('button', { name: t.renvoyer }).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(fr.venteAssistee.emailNonParti)
  })

  it('origine paiement : ni « Libérer » ni « Renvoyer »', async () => {
    const ecran = await render(<ReservationsEquipe ventes={[vente({ liberable: false, lienActif: false })]} />)
    const texte = ecran.container.textContent ?? ''
    expect(texte).not.toContain(t.liberer)
    expect(texte).not.toContain(t.renvoyer)
  })

  it('réservation échue : « Libérer » seul, pas de renvoi', async () => {
    const ecran = await render(<ReservationsEquipe ventes={[vente({ lienActif: false, echue: true })]} />)
    await expect.element(ecran.getByRole('button', { name: t.liberer })).toBeVisible()
    expect(ecran.container.textContent).not.toContain(t.renvoyer)
  })

  it('un seul appel malgré un double appui sur « Oui, libérer »', async () => {
    let fin: (v: unknown) => void = () => {}
    actionLibererVenteAssistee.mockReturnValue(new Promise((r) => { fin = r }))
    const ecran = await render(<ReservationsEquipe ventes={[vente()]} />)
    await ecran.getByRole('button', { name: t.liberer }).click()
    const bouton = ecran.container.querySelectorAll('button')[0] as HTMLButtonElement
    bouton.click()
    bouton.click()
    expect(actionLibererVenteAssistee).toHaveBeenCalledTimes(1)
    fin({ ok: true, message: t.liberee })
  })
})
