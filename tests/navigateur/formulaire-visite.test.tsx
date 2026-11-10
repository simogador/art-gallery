import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { formaterDateHeure, fr, fuseauAppareil, heureMurale, heureMuraleEnUtc } from '@/lib/i18n'

// Formulaire de demande de visite (story 4.3) dans un vrai navigateur : action serveur simulée.
// « En atelier » seulement si l'artiste l'accepte, créneaux dans le fuseau de l'appareil, validation à
// la sortie du champ ou du groupe, résumé en tête, saisie conservée, « Envoi… » sans double appui.
const envoyerDemandeVisite = vi.fn()
vi.mock('@/app/galerie/[id]/visite/actions', () => ({ envoyerDemandeVisite: (...a: unknown[]) => envoyerDemandeVisite(...a) }))

const { FormulaireVisite } = await import('@/app/galerie/[id]/visite/FormulaireVisite')
const t = fr.visite
const FUSEAU = fuseauAppareil()

beforeEach(() => {
  envoyerDemandeVisite.mockReset()
})

const JOUR = 24 * 3_600_000
/** Heure murale à `jours` d'ici, à `heure` h, dans le fuseau de l'appareil (valeur d'un `datetime-local`). */
const dans = (jours: number, heure = 15) => `${heureMurale(new Date(Date.now() + jours * JOUR), FUSEAU)!.slice(0, 10)}T${String(heure).padStart(2, '0')}:00`

const texteDe = (locator: { element: () => Element }) => () => locator.element().textContent ?? ''
type Ecran = Awaited<ReturnType<typeof render>>
const creneau = (ecran: Ecran, n: number) => ecran.container.querySelector<HTMLInputElement>(`#visite-creneau-${n}`)!

async function remplir(ecran: Ecran, creneaux = [dans(3), dans(5, 10)]) {
  for (const [i, c] of creneaux.entries()) await userEvent.fill(creneau(ecran, i + 1), c)
  await ecran.getByRole('textbox', { name: t.champs.email.libelle }).fill('claire@exemple.test')
}

describe('FormulaireVisite (navigateur)', () => {
  it('« En atelier » absent si l’artiste ne l’accepte pas : « À distance » seul, déjà choisi', async () => {
    const ecran = await render(<FormulaireVisite slug="nuit-bleue" atelierAccepte={false} delaiHeures={48} />)
    expect(ecran.container.querySelectorAll('input[type="radio"]')).toHaveLength(1)
    await expect.element(ecran.getByRole('radio', { name: t.champs.type.distance })).toBeChecked()
    expect(ecran.container.textContent).not.toContain(t.champs.type.atelier)
  })

  it('« En atelier » proposé si l’artiste l’accepte ; aucun type choisi d’avance', async () => {
    const ecran = await render(<FormulaireVisite slug="nuit-bleue" atelierAccepte delaiHeures={48} />)
    await expect.element(ecran.getByRole('radio', { name: t.champs.type.atelier })).not.toBeChecked()
    await expect.element(ecran.getByRole('radio', { name: t.champs.type.distance })).not.toBeChecked()
  })

  it('envoi valide : fuseau de l’appareil affiché et transmis, confirmation avec délai et créneaux dans ce fuseau', async () => {
    envoyerDemandeVisite.mockResolvedValue({ ok: true })
    const ecran = await render(<FormulaireVisite slug="nuit-bleue" atelierAccepte delaiHeures={48} />)
    await vi.waitFor(() => expect(ecran.container.textContent).toContain(t.champs.creneaux.fuseau(FUSEAU)))
    await ecran.getByRole('radio', { name: t.champs.type.atelier }).click()
    const creneaux = [dans(3), dans(5, 10)]
    await remplir(ecran, creneaux)
    await ecran.getByRole('button', { name: t.envoyer }).click()

    await vi.waitFor(() => expect(envoyerDemandeVisite).toHaveBeenCalledTimes(1))
    expect(envoyerDemandeVisite).toHaveBeenCalledWith('nuit-bleue', {
      type: 'atelier',
      creneaux: [...creneaux, ''],
      fuseau: FUSEAU,
      email: 'claire@exemple.test',
      telephone: '',
    })
    await vi.waitFor(() => expect(texteDe(ecran.getByRole('status'))()).toBe('Demande reçue. Nous vous répondons sous 48 heures.'))
    for (const c of creneaux) {
      expect(ecran.container.textContent).toContain(formaterDateHeure(heureMuraleEnUtc(c, FUSEAU), { fuseau: FUSEAU, jourSemaine: true }))
    }
    // La confirmation reçoit le focus.
    expect(ecran.getByRole('status').element().parentElement).toBe(document.activeElement)
  })

  it('champs fautifs : rien d’envoyé, message sous chaque champ, résumé en tête, saisie conservée', async () => {
    const ecran = await render(<FormulaireVisite slug="nuit-bleue" atelierAccepte delaiHeures={48} />)
    await userEvent.fill(creneau(ecran, 1), dans(3))
    await ecran.getByRole('textbox', { name: t.champs.email.libelle }).fill('pas-un-email')
    // Entrée depuis le champ (envoi implicite) : les messages affichés à la sortie des champs
    // déplacent le bouton, qu'un clic simulé pourrait manquer.
    await userEvent.keyboard('{Enter}')

    expect(envoyerDemandeVisite).not.toHaveBeenCalled()
    // Type, créneaux (un seul), e-mail.
    await vi.waitFor(() => expect(texteDe(ecran.getByRole('alert').first())()).toContain(t.resume(3)))
    expect(ecran.container.querySelector('#visite-type-erreur')?.textContent).toBe(t.erreurs.typeVide)
    expect(ecran.container.querySelector('#visite-creneaux-erreur')?.textContent).toBe(t.erreurs.creneauxPeu(2))
    expect(ecran.container.querySelector('#visite-email-erreur')?.textContent).toBe(t.erreurs.emailInvalide)
    expect(creneau(ecran, 1).value).toBe(dans(3))
    await expect.element(ecran.getByRole('textbox', { name: t.champs.email.libelle })).toHaveValue('pas-un-email')
    expect(document.activeElement?.getAttribute('role')).toBe('alert')
  })

  it('créneaux : validés à la sortie du groupe (doublon, passé), pas à chaque champ', async () => {
    const ecran = await render(<FormulaireVisite slug="nuit-bleue" atelierAccepte={false} delaiHeures={48} />)
    const message = () => ecran.container.querySelector('#visite-creneaux-erreur')
    await userEvent.fill(creneau(ecran, 1), dans(3))
    creneau(ecran, 2).focus()
    expect(message()).toBeNull()
    await userEvent.fill(creneau(ecran, 2), dans(3))
    // Sortie du groupe : le focus passe à l'e-mail.
    await ecran.getByRole('textbox', { name: t.champs.email.libelle }).click()
    await vi.waitFor(() => expect(message()?.textContent).toBe(t.erreurs.creneauxIdentiques))

    await userEvent.fill(creneau(ecran, 2), dans(-2))
    await ecran.getByRole('textbox', { name: t.champs.email.libelle }).click()
    await vi.waitFor(() => expect(message()?.textContent).toBe(t.erreurs.creneauPasse))

    await userEvent.fill(creneau(ecran, 2), dans(4))
    await ecran.getByRole('textbox', { name: t.champs.email.libelle }).click()
    await vi.waitFor(() => expect(message()).toBeNull())
  })

  it('double appui : un seul envoi, bouton « Envoi… » désactivé pendant l’attente', async () => {
    let terminer: (r: unknown) => void = () => {}
    envoyerDemandeVisite.mockReturnValue(new Promise((resolve) => (terminer = resolve)))
    const ecran = await render(<FormulaireVisite slug="nuit-bleue" atelierAccepte={false} delaiHeures={48} />)
    await vi.waitFor(() => expect(ecran.container.textContent).toContain(t.champs.creneaux.fuseau(FUSEAU)))
    await remplir(ecran)

    const formulaire = ecran.container.querySelector('form')!
    formulaire.requestSubmit()
    formulaire.requestSubmit()
    await expect.element(ecran.getByRole('button', { name: t.envoiEnCours })).toBeDisabled()
    expect(envoyerDemandeVisite).toHaveBeenCalledTimes(1)

    terminer({ ok: true })
    await vi.waitFor(() => expect(texteDe(ecran.getByRole('status'))()).toContain('Demande reçue.'))
    expect(envoyerDemandeVisite).toHaveBeenCalledTimes(1)
  })

  it('refus du serveur : trop d’envois (message neutre), œuvre plus disponible, « En atelier » refusé sous le champ', async () => {
    envoyerDemandeVisite.mockResolvedValueOnce({ ok: false, code: 'trop_de_demandes' })
    const ecran = await render(<FormulaireVisite slug="nuit-bleue" atelierAccepte={false} delaiHeures={48} />)
    await vi.waitFor(() => expect(ecran.container.textContent).toContain(t.champs.creneaux.fuseau(FUSEAU)))
    await remplir(ecran)
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await expect.element(ecran.getByText(t.refus)).toBeVisible()
    expect(ecran.container.textContent).not.toMatch(/429|limite|rate|erreur/i)
    await expect.element(ecran.getByRole('textbox', { name: t.champs.email.libelle })).toHaveValue('claire@exemple.test')

    envoyerDemandeVisite.mockResolvedValueOnce({ ok: false, code: 'oeuvre_indisponible' })
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await expect.element(ecran.getByText(t.oeuvreIndisponible)).toBeVisible()

    envoyerDemandeVisite.mockResolvedValueOnce({ ok: false, code: 'invalide', erreurs: { type: t.erreurs.atelierIndisponible } })
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await vi.waitFor(() => expect(ecran.container.querySelector('#visite-type-erreur')?.textContent).toBe(t.erreurs.atelierIndisponible))
  })

  it('panne : message « momentanément impossible », rien de technique', async () => {
    envoyerDemandeVisite.mockRejectedValue(new Error('boom'))
    const ecran = await render(<FormulaireVisite slug="nuit-bleue" atelierAccepte={false} delaiHeures={48} />)
    await vi.waitFor(() => expect(ecran.container.textContent).toContain(t.champs.creneaux.fuseau(FUSEAU)))
    await remplir(ecran)
    await ecran.getByRole('button', { name: t.envoyer }).click()
    await expect.element(ecran.getByText(t.indisponible)).toBeVisible()
    expect(ecran.container.textContent).not.toContain('boom')
  })
})
