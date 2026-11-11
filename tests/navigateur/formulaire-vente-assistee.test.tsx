import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fr } from '@/lib/i18n'

// Formulaire de la vente assistée (story 6.3) dans un vrai navigateur : action serveur simulée.
// Œuvres obligatoires (rien d'envoyé sans), saisie transmise, succès annoncé, e-mail non parti annoncé,
// refus nommant l'œuvre sans effacer la saisie, un seul appel malgré un double appui.
const actionPoserVenteAssistee = vi.fn()
vi.mock('@/app/dashboard/admin/commandes/actions', () => ({ actionPoserVenteAssistee: (...a: unknown[]) => actionPoserVenteAssistee(...a) }))

const { FormulaireVenteAssistee } = await import('@/app/dashboard/admin/commandes/FormulaireVenteAssistee')
const t = fr.venteAssistee

beforeEach(() => {
  actionPoserVenteAssistee.mockReset()
})

type Ecran = Awaited<ReturnType<typeof render>>
const champ = (ecran: Ecran, libelle: string) => ecran.getByLabelText(libelle)
const remplir = async (ecran: Ecran) => {
  await champ(ecran, t.champs.email).fill('claire@exemple.test')
  await champ(ecran, t.champs.nom).fill('Claire Martin')
  await champ(ecran, t.champs.oeuvres).fill('nuit-bleue\nrivage')
}

describe('FormulaireVenteAssistee (navigateur)', () => {
  it('sans œuvre : rien envoyé, message sous le champ et résumé annoncé', async () => {
    const ecran = await render(<FormulaireVenteAssistee heuresParDefaut={48} />)
    ecran.container.querySelector('form')!.requestSubmit()
    expect(actionPoserVenteAssistee).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(ecran.container.querySelector('#vente-oeuvres-erreur')?.textContent).toBe(t.erreurs.oeuvresManquantes))
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(t.resume(1))
  })

  it('envoi valide : saisie transmise, succès annoncé, formulaire vidé sauf pays et durée', async () => {
    actionPoserVenteAssistee.mockResolvedValue({ ok: true, envoye: true, message: t.succes('claire@exemple.test', '13 novembre 2026 à 10 h 00') })
    const ecran = await render(<FormulaireVenteAssistee heuresParDefaut={48} />)
    await remplir(ecran)
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.succes('claire@exemple.test', '13 novembre 2026 à 10 h 00'))
    expect(actionPoserVenteAssistee).toHaveBeenCalledTimes(1)
    expect(actionPoserVenteAssistee).toHaveBeenCalledWith({
      email: 'claire@exemple.test',
      nom: 'Claire Martin',
      pays: 'FR',
      oeuvres: 'nuit-bleue\nrivage',
      heures: '48',
    })
    await expect.element(champ(ecran, t.champs.oeuvres)).toHaveValue('')
    await expect.element(champ(ecran, t.champs.heures)).toHaveValue('48')
  })

  it('refus du serveur : message annoncé, œuvre nommée, saisie conservée', async () => {
    actionPoserVenteAssistee.mockResolvedValue({ ok: false, message: t.refus.oeuvre_indisponible('rivage') })
    const ecran = await render(<FormulaireVenteAssistee heuresParDefaut={48} />)
    await remplir(ecran)
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(t.refus.oeuvre_indisponible('rivage'))
    await expect.element(champ(ecran, t.champs.oeuvres)).toHaveValue('nuit-bleue\nrivage')
  })

  it('double envoi simultané : une seule réservation demandée', async () => {
    let fin: (v: unknown) => void = () => {}
    actionPoserVenteAssistee.mockReturnValue(new Promise((r) => (fin = r)))
    const ecran = await render(<FormulaireVenteAssistee heuresParDefaut={48} />)
    await remplir(ecran)
    const form = ecran.container.querySelector('form')!
    form.requestSubmit()
    form.requestSubmit()
    expect(actionPoserVenteAssistee).toHaveBeenCalledTimes(1)
    fin({ ok: false, message: t.refus.indisponible })
  })
})
