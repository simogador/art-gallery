import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fr } from '@/lib/i18n'

// Commande d'état de la file des demandes dans un vrai navigateur : action serveur simulée.
const actionEtatDemande = vi.fn()
vi.mock('@/app/dashboard/admin/demandes/actions', () => ({ actionEtatDemande: (...a: unknown[]) => actionEtatDemande(...a) }))

const NOM = fr.demandes.nomDemande(fr.demandes.types.visite, '1 novembre 2026')

const { CommandeEtat } = await import('@/app/dashboard/admin/demandes/CommandeEtat')

beforeEach(() => {
  actionEtatDemande.mockReset().mockResolvedValue({ ok: true })
})

describe('CommandeEtat (navigateur)', () => {
  it('propose les trois autres états, pas l’état actuel', async () => {
    const ecran = await render(<CommandeEtat type="visite" id="v1" etat="nouvelle" nom={NOM} />)
    await expect.element(ecran.getByRole('button', { name: fr.demandes.marquerPour(fr.demandes.etats.faite, NOM) })).toBeVisible()
    expect(ecran.getByRole('button')).toHaveLength(3)
    expect(ecran.getByRole('button', { name: fr.demandes.marquerPour(fr.demandes.etats.nouvelle, NOM) }).elements()).toHaveLength(0)
  })

  it('« Faite » : action appelée avec le type, l’identifiant et l’état', async () => {
    const ecran = await render(<CommandeEtat type="selection" id="s1" etat="nouvelle" nom={NOM} />)
    await ecran.getByRole('button', { name: fr.demandes.marquerPour(fr.demandes.etats.faite, NOM) }).click()
    await vi.waitFor(() => expect(actionEtatDemande).toHaveBeenCalledTimes(1))
    expect(actionEtatDemande).toHaveBeenCalledWith('selection', 's1', 'faite')
  })

  it('un refus est annoncé', async () => {
    actionEtatDemande.mockResolvedValue({ ok: false, message: fr.demandes.refus.introuvable })
    const ecran = await render(<CommandeEtat type="visite" id="v1" etat="planifiee" nom={NOM} />)
    await ecran.getByRole('button', { name: fr.demandes.marquerPour(fr.demandes.etats.sans_suite, NOM) }).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(fr.demandes.refus.introuvable)
  })

  it('chaque bouton est nommé par la demande ; exception de l’action : message neutre', async () => {
    actionEtatDemande.mockRejectedValue(new Error('panne'))
    const ecran = await render(<CommandeEtat type="visite" id="v1" etat="nouvelle" nom={NOM} />)
    const bouton = ecran.getByRole('button', { name: fr.demandes.marquerPour(fr.demandes.etats.faite, NOM) })
    await expect.element(bouton).toHaveAttribute('aria-label', fr.demandes.marquerPour(fr.demandes.etats.faite, NOM))
    await bouton.click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(fr.demandes.refus.indisponible)
  })
})
