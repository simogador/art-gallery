import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { fr } from '@/lib/i18n'

// Formulaire de demande de sélection (story 4.2) dans un vrai navigateur : action serveur simulée.
// Validation à la sortie du champ (jamais à la frappe), résumé en tête, saisie conservée, bouton
// « Envoi… » qui ignore les doubles appuis, refus sans message technique.
const envoyerDemandeSelection = vi.fn()
vi.mock('@/app/conseil/actions', () => ({ envoyerDemandeSelection: (...a: unknown[]) => envoyerDemandeSelection(...a) }))

const { FormulaireConseil } = await import('@/app/conseil/FormulaireConseil')
const t = fr.conseil

beforeEach(() => {
  envoyerDemandeSelection.mockReset()
})

// Texte d'un élément, réessayé jusqu'à ce qu'il soit là (le texte exact compte ; pas de comparaison partielle).
const texteDe = (locator: { element: () => Element }) => () => locator.element().textContent ?? ''

const champ = (ecran: Awaited<ReturnType<typeof render>>, nom: string) => ecran.getByRole('textbox', { name: nom })

async function remplir(ecran: Awaited<ReturnType<typeof render>>) {
  await champ(ecran, t.champs.espace.libelle).fill('Un salon, mur blanc de 3 m.')
  await ecran.getByRole('checkbox', { name: 'Calme' }).click()
  await ecran.getByRole('checkbox', { name: 'Lumineuse' }).click()
  await champ(ecran, t.champs.budget.libelle).fill('1500')
  await champ(ecran, t.champs.email.libelle).fill('claire@exemple.test')
}

describe('FormulaireConseil (navigateur)', () => {
  it('envoi valide : saisie transmise, confirmation avec le délai annoncé', async () => {
    envoyerDemandeSelection.mockResolvedValue({ ok: true })
    const ecran = await render(<FormulaireConseil delaiHeures={48} />)
    await remplir(ecran)
    await ecran.getByRole('button', { name: t.envoyer }).click()

    await vi.waitFor(() => expect(envoyerDemandeSelection).toHaveBeenCalledTimes(1))
    expect(envoyerDemandeSelection).toHaveBeenCalledWith({
      espace: 'Un salon, mur blanc de 3 m.',
      ambiances: ['calme', 'lumineuse'],
      precision: '',
      budget: '1500',
      email: 'claire@exemple.test',
      telephone: '',
    })
    await vi.waitFor(() => expect(texteDe(ecran.getByRole('status'))()).toBe('Demande reçue. Nous vous répondons sous 48 heures.'))
  })

  it('champs fautifs : rien d’envoyé, message sous chaque champ, résumé en tête, saisie conservée', async () => {
    const ecran = await render(<FormulaireConseil delaiHeures={48} />)
    await champ(ecran, t.champs.email.libelle).fill('pas-un-email')
    await champ(ecran, t.champs.precision.libelle).fill('Des tons chauds')
    await ecran.getByRole('button', { name: t.envoyer }).click()

    expect(envoyerDemandeSelection).not.toHaveBeenCalled()
    // Espace, ambiances, budget, e-mail : quatre champs fautifs.
    await vi.waitFor(() => expect(texteDe(ecran.getByRole('alert').first())()).toContain(t.resume(4)))
    for (const message of [t.erreurs.espaceVide, t.erreurs.ambiancesVides, t.erreurs.budgetInvalide, t.erreurs.emailInvalide]) {
      expect(ecran.container.textContent).toContain(message)
    }
    // Message relié au champ fautif et saisie conservée.
    const email = champ(ecran, t.champs.email.libelle)
    await expect.element(email).toHaveAttribute('aria-invalid', 'true')
    await expect.element(email).toHaveValue('pas-un-email')
    await expect.element(champ(ecran, t.champs.precision.libelle)).toHaveValue('Des tons chauds')
    // Le résumé reçoit le focus (lecteur d'écran).
    expect(document.activeElement?.getAttribute('role')).toBe('alert')
  })

  it('validation à la sortie du champ, pas à la frappe', async () => {
    const ecran = await render(<FormulaireConseil delaiHeures={48} />)
    const email = champ(ecran, t.champs.email.libelle)
    await email.fill('pas-un-email')
    expect(ecran.container.textContent).not.toContain(t.erreurs.emailInvalide)
    await userEvent.tab()
    const sousLeChamp = () => ecran.container.querySelector('#conseil-email-erreur')
    await vi.waitFor(() => expect(sousLeChamp()?.textContent).toBe(t.erreurs.emailInvalide))
    // Corrigé puis quitté : le message disparaît.
    await email.fill('claire@exemple.test')
    await userEvent.tab()
    await vi.waitFor(() => expect(sousLeChamp()).toBeNull())
  })

  it('ambiances : validées à la sortie du groupe, pas à chaque case ; confirmation reçoit le focus', async () => {
    envoyerDemandeSelection.mockResolvedValue({ ok: true })
    const ecran = await render(<FormulaireConseil delaiHeures={48} />)
    const message = () => ecran.container.querySelector('#conseil-ambiances-erreur')
    await ecran.getByRole('checkbox', { name: 'Calme' }).click()
    await ecran.getByRole('checkbox', { name: 'Calme' }).click()
    expect(message()).toBeNull()
    // Six cases : cinq tabulations restent dans le groupe, la sixième en sort.
    for (let i = 0; i < 6; i++) await userEvent.tab()
    await vi.waitFor(() => expect(message()?.textContent).toBe(t.erreurs.ambiancesVides))
    await ecran.getByRole('checkbox', { name: 'Calme' }).click()
    await vi.waitFor(() => expect(message()).toBeNull())

    await remplir(ecran)
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await vi.waitFor(() => expect(ecran.getByRole('status').element().parentElement).toBe(document.activeElement))
  })

  it('double appui : un seul envoi, bouton « Envoi… » désactivé pendant l’attente', async () => {
    let terminer: (r: unknown) => void = () => {}
    envoyerDemandeSelection.mockReturnValue(new Promise((resolve) => (terminer = resolve)))
    const ecran = await render(<FormulaireConseil delaiHeures={48} />)
    await remplir(ecran)

    const formulaire = ecran.container.querySelector('form')!
    formulaire.requestSubmit()
    formulaire.requestSubmit()
    await expect.element(ecran.getByRole('button', { name: t.envoiEnCours })).toBeDisabled()
    expect(envoyerDemandeSelection).toHaveBeenCalledTimes(1)

    terminer({ ok: true })
    await vi.waitFor(() => expect(texteDe(ecran.getByRole('status'))()).toContain('Demande reçue.'))
    expect(envoyerDemandeSelection).toHaveBeenCalledTimes(1)
  })

  it('trop d’envois : message neutre, saisie conservée, bouton de nouveau utilisable', async () => {
    envoyerDemandeSelection.mockResolvedValue({ ok: false, code: 'trop_de_demandes' })
    const ecran = await render(<FormulaireConseil delaiHeures={48} />)
    await remplir(ecran)
    await ecran.getByRole('button', { name: t.envoyer }).click()

    await expect.element(ecran.getByText(t.refus)).toBeVisible()
    expect(ecran.container.textContent).not.toMatch(/429|limite|rate|erreur/i)
    await expect.element(champ(ecran, t.champs.email.libelle)).toHaveValue('claire@exemple.test')
    await expect.element(ecran.getByRole('button', { name: t.envoyer })).toBeEnabled()
  })

  it('refus du serveur par champ : les messages s’affichent sous les champs', async () => {
    envoyerDemandeSelection.mockResolvedValue({ ok: false, code: 'invalide', erreurs: { email: t.erreurs.emailInvalide } })
    const ecran = await render(<FormulaireConseil delaiHeures={48} />)
    await remplir(ecran)
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await vi.waitFor(() => expect(texteDe(ecran.getByRole('alert').first())()).toContain(t.resume(1)))
    await expect.element(champ(ecran, t.champs.email.libelle)).toHaveAttribute('aria-invalid', 'true')
  })

  it('panne : message « momentanément impossible », rien de technique', async () => {
    envoyerDemandeSelection.mockRejectedValue(new Error('boom'))
    const ecran = await render(<FormulaireConseil delaiHeures={48} />)
    await remplir(ecran)
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await expect.element(ecran.getByText(t.indisponible)).toBeVisible()
    expect(ecran.container.textContent).not.toContain('boom')
  })
})
