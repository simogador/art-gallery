import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fr } from '@/lib/i18n'

// Commandes de l'annonce de l'ouverture dans un vrai navigateur (story 4.9) : confirmation en deux
// temps, bilan, refus annoncés, essai. Actions serveur simulées.
const actionAnnoncerOuverture = vi.fn()
const actionEssaiOuverture = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => refresh(), push: () => {} }) }))
vi.mock('@/app/dashboard/admin/ouverture/actions', () => ({
  actionAnnoncerOuverture: (...a: unknown[]) => actionAnnoncerOuverture(...a),
  actionEssaiOuverture: (...a: unknown[]) => actionEssaiOuverture(...a),
}))

const { AnnonceOuverture } = await import('@/app/dashboard/admin/ouverture/AnnonceOuverture')

beforeEach(() => {
  actionAnnoncerOuverture.mockReset().mockResolvedValue({ ok: true, bilan: { prevenus: 2, echecs: 1, restants: 1, aSupprimer: 0, arretEchecs: false } })
  actionEssaiOuverture.mockReset().mockResolvedValue({ ok: true, reel: true })
  refresh.mockReset()
})

describe('AnnonceOuverture (navigateur)', () => {
  it('premier geste : confirmation affichée, aucun envoi', async () => {
    const ecran = await render(<AnnonceOuverture nombre={3} />)
    await ecran.getByRole('button', { name: fr.ouverture.envoi.bouton }).click()
    await expect.element(ecran.getByText(fr.ouverture.envoi.confirmation(3))).toBeVisible()
    await expect.element(ecran.getByRole('button', { name: fr.ouverture.envoi.confirmer(3) })).toBeVisible()
    expect(actionAnnoncerOuverture).not.toHaveBeenCalled()
  })

  it('« Annuler » revient au premier temps sans envoyer', async () => {
    const ecran = await render(<AnnonceOuverture nombre={3} />)
    await ecran.getByRole('button', { name: fr.ouverture.envoi.bouton }).click()
    await ecran.getByRole('button', { name: fr.ouverture.envoi.annuler }).click()
    await expect.element(ecran.getByRole('button', { name: fr.ouverture.envoi.bouton })).toBeVisible()
    expect(actionAnnoncerOuverture).not.toHaveBeenCalled()
  })

  it('second geste : un seul appel, bilan affiché avec prévenus, échecs et restants', async () => {
    const ecran = await render(<AnnonceOuverture nombre={3} />)
    await ecran.getByRole('button', { name: fr.ouverture.envoi.bouton }).click()
    await ecran.getByRole('button', { name: fr.ouverture.envoi.confirmer(3) }).click()
    await expect.element(ecran.getByText(fr.ouverture.bilan.prevenus(2))).toBeVisible()
    await expect.element(ecran.getByText(fr.ouverture.bilan.echecs(1))).toBeVisible()
    await expect.element(ecran.getByText(fr.ouverture.bilan.restants(1))).toBeVisible()
    expect(actionAnnoncerOuverture).toHaveBeenCalledTimes(1)
    expect(actionAnnoncerOuverture).toHaveBeenCalledWith(3)
    expect(refresh).toHaveBeenCalled()
    // La confirmation est refermée dès l'envoi ; le nombre restant vient du bilan.
    expect(ecran.getByRole('button', { name: fr.ouverture.envoi.confirmer(3) }).elements()).toHaveLength(0)
  })

  it('focus : sur « Envoyer à N personnes » à l\'ouverture de la confirmation, puis sur le titre du bilan', async () => {
    const ecran = await render(<AnnonceOuverture nombre={3} />)
    await ecran.getByRole('button', { name: fr.ouverture.envoi.bouton }).click()
    await vi.waitFor(() => expect(document.activeElement?.textContent).toBe(fr.ouverture.envoi.confirmer(3)))
    await ecran.getByRole('button', { name: fr.ouverture.envoi.confirmer(3) }).click()
    await vi.waitFor(() => expect(document.activeElement?.textContent).toBe(fr.ouverture.bilan.titre))
  })

  it('une seule région aria-live, toujours présente, qui contient le bilan', async () => {
    const ecran = await render(<AnnonceOuverture nombre={3} />)
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1)
    expect(document.querySelectorAll('[role="status"], [role="alert"]')).toHaveLength(0)
    await ecran.getByRole('button', { name: fr.ouverture.envoi.bouton }).click()
    await ecran.getByRole('button', { name: fr.ouverture.envoi.confirmer(3) }).click()
    await expect.element(ecran.getByText(fr.ouverture.bilan.prevenus(2))).toBeVisible()
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1)
    expect(document.querySelector('[aria-live]')?.textContent).toContain(fr.ouverture.bilan.restants(1))
  })

  it('le bilan signale les adresses à retirer et l\'arrêt après échecs, et le serveur est rechargé', async () => {
    actionAnnoncerOuverture.mockResolvedValue({ ok: true, bilan: { prevenus: 1, echecs: 5, restants: 4, aSupprimer: 2, arretEchecs: true } })
    const ecran = await render(<AnnonceOuverture nombre={6} />)
    await ecran.getByRole('button', { name: fr.ouverture.envoi.bouton }).click()
    await ecran.getByRole('button', { name: fr.ouverture.envoi.confirmer(6) }).click()
    await expect.element(ecran.getByText(fr.ouverture.bilan.aSupprimer(2))).toBeVisible()
    await expect.element(ecran.getByText(fr.ouverture.bilan.arret)).toBeVisible()
    expect(refresh).toHaveBeenCalled()
  })

  it('un refus ou une exception de l’action est annoncé, sans bilan', async () => {
    actionAnnoncerOuverture.mockResolvedValue({ ok: false, message: fr.ouverture.refus.acces_refuse })
    const ecran = await render(<AnnonceOuverture nombre={1} />)
    await ecran.getByRole('button', { name: fr.ouverture.envoi.bouton }).click()
    await ecran.getByRole('button', { name: fr.ouverture.envoi.confirmer(1) }).click()
    await expect.element(ecran.getByText(fr.ouverture.refus.acces_refuse)).toBeVisible()
    expect(refresh).toHaveBeenCalled()

    actionAnnoncerOuverture.mockRejectedValue(new Error('panne'))
    await ecran.getByRole('button', { name: fr.ouverture.envoi.bouton }).click()
    await ecran.getByRole('button', { name: fr.ouverture.envoi.confirmer(1) }).click()
    await expect.element(ecran.getByText(fr.ouverture.refus.indisponible)).toBeVisible()
  })

  it('aucun contact : « Aucun contact à prévenir. » sans bouton d’envoi', async () => {
    const ecran = await render(<AnnonceOuverture nombre={0} />)
    await expect.element(ecran.getByText(fr.ouverture.vide)).toBeVisible()
    expect(ecran.getByRole('button', { name: fr.ouverture.envoi.bouton }).elements()).toHaveLength(0)
  })

  it('essai : appelé sans confirmation, résultat annoncé, aucun envoi aux contacts', async () => {
    const ecran = await render(<AnnonceOuverture nombre={3} />)
    await ecran.getByRole('button', { name: fr.ouverture.essai.bouton }).click()
    await expect.element(ecran.getByText(fr.ouverture.essai.envoye)).toBeVisible()
    expect(actionEssaiOuverture).toHaveBeenCalledTimes(1)
    expect(actionAnnoncerOuverture).not.toHaveBeenCalled()

    actionEssaiOuverture.mockResolvedValue({ ok: false, message: fr.ouverture.refus.envoi_echoue })
    await ecran.getByRole('button', { name: fr.ouverture.essai.bouton }).click()
    await expect.element(ecran.getByText(fr.ouverture.refus.envoi_echoue)).toBeVisible()

    actionEssaiOuverture.mockResolvedValue({ ok: true, reel: false })
    await ecran.getByRole('button', { name: fr.ouverture.essai.bouton }).click()
    await expect.element(ecran.getByText(fr.ouverture.essai.horsProduction)).toBeVisible()
  })
})
