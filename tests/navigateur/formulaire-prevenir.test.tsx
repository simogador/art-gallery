import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fr } from '@/lib/i18n'

// Formulaire « Me prévenir » (story 4.5) dans un vrai navigateur : action serveur simulée. Validation de
// l'e-mail à la sortie du champ et à l'envoi, résumé en tête, saisie conservée, « Envoi… » sans double
// appui, confirmation « Nous vous écrirons si elle redevient disponible. », refus du serveur sans détail.
const envoyerInscriptionPrevenir = vi.fn()
vi.mock('@/app/galerie/[id]/prevenir/actions', () => ({ envoyerInscriptionPrevenir: (...a: unknown[]) => envoyerInscriptionPrevenir(...a) }))

const { FormulairePrevenir } = await import('@/app/galerie/[id]/prevenir/FormulairePrevenir')
const t = fr.prevenir

beforeEach(() => {
  envoyerInscriptionPrevenir.mockReset()
})

const texteDe = (locator: { element: () => Element }) => () => locator.element().textContent ?? ''
type Ecran = Awaited<ReturnType<typeof render>>
const champ = (ecran: Ecran) => ecran.getByRole('textbox', { name: t.champs.email.libelle })

describe('FormulairePrevenir (navigateur)', () => {
  it('e-mail invalide : validé à la sortie du champ (pas à la frappe), message sous le champ', async () => {
    const ecran = await render(<FormulairePrevenir slug="nuit-bleue" contact="contact@errancy.art" />)
    const message = () => ecran.container.querySelector('#prevenir-email-erreur')
    await champ(ecran).fill('pas-un-email')
    expect(message()).toBeNull()
    await ecran.getByRole('button', { name: t.envoyer }).element().focus()
    await vi.waitFor(() => expect(message()?.textContent).toBe(t.erreurs.emailInvalide))
    await expect.element(champ(ecran)).toHaveAttribute('aria-invalid', 'true')
    await expect.element(champ(ecran)).toHaveAttribute('aria-describedby', 'prevenir-email-erreur')
    await expect.element(champ(ecran)).toHaveAttribute('inputmode', 'email')
    expect(ecran.container.textContent).toContain(t.confidentialite('contact@errancy.art'))
    await champ(ecran).fill('claire@exemple.test')
    await ecran.getByRole('button', { name: t.envoyer }).element().focus()
    await vi.waitFor(() => expect(message()).toBeNull())
  })

  it('envoi d’un e-mail invalide : rien d’envoyé, résumé en tête avec le focus, saisie conservée', async () => {
    const ecran = await render(<FormulairePrevenir slug="nuit-bleue" contact="contact@errancy.art" />)
    await champ(ecran).fill('nope')
    ecran.container.querySelector('form')!.requestSubmit()
    expect(envoyerInscriptionPrevenir).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(texteDe(ecran.getByRole('alert').first())()).toContain(t.resume(1)))
    await expect.element(champ(ecran)).toHaveValue('nope')
    expect(document.activeElement?.getAttribute('role')).toBe('alert')
  })

  it('envoi valide : slug et saisie transmis, confirmation affichée et focalisée', async () => {
    envoyerInscriptionPrevenir.mockResolvedValue({ ok: true })
    const ecran = await render(<FormulairePrevenir slug="nuit-bleue" contact="contact@errancy.art" />)
    await champ(ecran).fill('claire@exemple.test')
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await vi.waitFor(() => expect(envoyerInscriptionPrevenir).toHaveBeenCalledTimes(1))
    expect(envoyerInscriptionPrevenir).toHaveBeenCalledWith('nuit-bleue', { email: 'claire@exemple.test' })
    await vi.waitFor(() => expect(texteDe(ecran.getByRole('status'))()).toBe('Nous vous écrirons si elle redevient disponible.'))
    expect(ecran.getByRole('status').element().parentElement).toBe(document.activeElement)
    // Aucune heure de fin de réservation, aucune promesse de priorité.
    expect(ecran.container.textContent).not.toMatch(/jusqu|expire|priorit/i)
  })

  it('double appui : un seul envoi, bouton « Envoi… » désactivé pendant l’attente', async () => {
    let terminer: (r: unknown) => void = () => {}
    envoyerInscriptionPrevenir.mockReturnValue(new Promise((resolve) => (terminer = resolve)))
    const ecran = await render(<FormulairePrevenir slug="nuit-bleue" contact="contact@errancy.art" />)
    await champ(ecran).fill('claire@exemple.test')
    const formulaire = ecran.container.querySelector('form')!
    formulaire.requestSubmit()
    formulaire.requestSubmit()
    await expect.element(ecran.getByRole('button', { name: t.envoiEnCours })).toBeDisabled()
    expect(envoyerInscriptionPrevenir).toHaveBeenCalledTimes(1)
    terminer({ ok: true })
    await vi.waitFor(() => expect(texteDe(ecran.getByRole('status'))()).toBe(t.confirmation))
    expect(envoyerInscriptionPrevenir).toHaveBeenCalledTimes(1)
  })

  it('refus du serveur : trop d’envois (message neutre), œuvre plus réservée, e-mail refusé sous le champ ; saisie conservée', async () => {
    envoyerInscriptionPrevenir.mockResolvedValueOnce({ ok: false, code: 'trop_de_demandes' })
    const ecran = await render(<FormulairePrevenir slug="nuit-bleue" contact="contact@errancy.art" />)
    await champ(ecran).fill('claire@exemple.test')
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await expect.element(ecran.getByText(t.refus)).toBeVisible()
    expect(ecran.container.textContent).not.toMatch(/429|limite|rate|erreur/i)
    await expect.element(champ(ecran)).toHaveValue('claire@exemple.test')

    envoyerInscriptionPrevenir.mockResolvedValueOnce({ ok: false, code: 'oeuvre_indisponible' })
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await expect.element(ecran.getByText(t.oeuvreIndisponible)).toBeVisible()

    envoyerInscriptionPrevenir.mockResolvedValueOnce({ ok: false, code: 'invalide', erreurs: { email: t.erreurs.emailInvalide } })
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await vi.waitFor(() => expect(ecran.container.querySelector('#prevenir-email-erreur')?.textContent).toBe(t.erreurs.emailInvalide))
  })

  it('panne : message « momentanément impossible », rien de technique, saisie conservée', async () => {
    envoyerInscriptionPrevenir.mockRejectedValue(new Error('boom'))
    const ecran = await render(<FormulairePrevenir slug="nuit-bleue" contact="contact@errancy.art" />)
    await champ(ecran).fill('claire@exemple.test')
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await expect.element(ecran.getByText(t.indisponible)).toBeVisible()
    expect(ecran.container.textContent).not.toContain('boom')
    await expect.element(champ(ecran)).toHaveValue('claire@exemple.test')
  })
})
