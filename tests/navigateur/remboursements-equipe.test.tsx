import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fr } from '@/lib/i18n'

// Remboursements à traiter (story 6.5) dans un vrai navigateur : action serveur et routeur simulés. Rien
// n'est envoyé sans appui, un seul appel malgré un double appui, le résultat est annoncé (région
// `status`, qui reçoit le focus), un refus aussi, la liste est relue.
const actionMarquerRemboursementEffectue = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => refresh(), push: () => {} }) }))
vi.mock('@/app/dashboard/admin/commandes/actions', () => ({
  actionMarquerRemboursementEffectue: (...a: unknown[]) => actionMarquerRemboursementEffectue(...a),
}))

const { RemboursementsEquipe } = await import('@/app/dashboard/admin/commandes/RemboursementsEquipe')
const t = fr.paiement.remboursements

const vue = (surcharge = {}) => ({
  id: 'r1',
  commande: 'ERR-AAAA-BBBB',
  acheteur: 'Claire Martin (claire@exemple.test)',
  montant: '1 040 €',
  demandeLe: '12 novembre 2026',
  ...surcharge,
})

beforeEach(() => {
  actionMarquerRemboursementEffectue.mockReset()
  refresh.mockReset()
})

describe('RemboursementsEquipe (navigateur)', () => {
  it('liste vide : message d’état vide', async () => {
    const ecran = await render(<RemboursementsEquipe remboursements={[]} />)
    await expect.element(ecran.getByText(t.vide)).toBeVisible()
  })

  it('affiche commande, acheteur, montant et date', async () => {
    const ecran = await render(<RemboursementsEquipe remboursements={[vue()]} />)
    const texte = ecran.container.textContent ?? ''
    for (const attendu of ['ERR-AAAA-BBBB', 'Claire Martin (claire@exemple.test)', '1 040 €', '12 novembre 2026', t.montant]) {
      expect(texte).toContain(attendu)
    }
    expect(actionMarquerRemboursementEffectue).not.toHaveBeenCalled()
  })

  it('succès : un seul appel malgré un double appui, annoncé, focus sur l’annonce, liste relue', async () => {
    let fin: (v: unknown) => void = () => {}
    actionMarquerRemboursementEffectue.mockReturnValue(new Promise((r) => { fin = r }))
    const ecran = await render(<RemboursementsEquipe remboursements={[vue(), vue({ id: 'r2', commande: 'ERR-CCCC-DDDD' })]} />)
    const bouton = [...ecran.container.querySelectorAll('button')][0] as HTMLButtonElement
    bouton.click()
    bouton.click()
    expect(actionMarquerRemboursementEffectue).toHaveBeenCalledTimes(1)
    expect(actionMarquerRemboursementEffectue).toHaveBeenCalledWith('r1')
    fin({ ok: true, message: t.succes })
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.succes)
    expect(refresh).toHaveBeenCalled()
    await vi.waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('status'))
  })

  it('refus : message annoncé', async () => {
    actionMarquerRemboursementEffectue.mockResolvedValue({ ok: false, message: t.refus.introuvable })
    const ecran = await render(<RemboursementsEquipe remboursements={[vue()]} />)
    await ecran.getByRole('button', { name: `${t.bouton} ERR-AAAA-BBBB` }).click()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.refus.introuvable)
  })

  it('action qui échoue : message d’indisponibilité, bouton de nouveau utilisable', async () => {
    actionMarquerRemboursementEffectue.mockRejectedValue(new Error('boom'))
    const ecran = await render(<RemboursementsEquipe remboursements={[vue()]} />)
    await ecran.getByRole('button', { name: `${t.bouton} ERR-AAAA-BBBB` }).click()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.refus.indisponible)
    await expect.element(ecran.getByRole('button', { name: `${t.bouton} ERR-AAAA-BBBB` })).toBeEnabled()
  })
})
