import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fr, formaterMontant } from '@/lib/i18n'

// Paiements à constater (story 6.4) dans un vrai navigateur : action serveur et routeur simulés. La
// saisie est contrôlée avant l'envoi, un refus est annoncé en alerte et garde la saisie, un succès est
// annoncé et vide les champs, la liste est relue, un seul appel malgré un double appui.
const actionConstaterPaiement = vi.fn()
const actionAnnulerCommande = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => refresh(), push: () => {} }) }))
vi.mock('@/app/dashboard/admin/commandes/actions', () => ({
  actionConstaterPaiement: (...a: unknown[]) => actionConstaterPaiement(...a),
  actionAnnulerCommande: (...a: unknown[]) => actionAnnulerCommande(...a),
}))

const { PaiementsEnAttente } = await import('@/app/dashboard/admin/commandes/PaiementsEnAttente')
const t = fr.paiement

const passage = (surcharge = {}) => ({
  passageId: 'p1',
  acheteur: 'Claire Martin (claire@exemple.test)',
  devise: 'EUR',
  total: '2 080 €',
  commandes: [{ id: 'c1', numero: 'ERR-AAAA-BBBB', oeuvres: ['Nuit bleue'] }, { id: 'c2', numero: 'ERR-CCCC-DDDD', oeuvres: ['Rivage'] }],
  ...surcharge,
})

beforeEach(() => {
  actionConstaterPaiement.mockReset()
  actionAnnulerCommande.mockReset()
  refresh.mockReset()
})

describe('PaiementsEnAttente (navigateur)', () => {
  it('liste vide : message d’état vide', async () => {
    const ecran = await render(<PaiementsEnAttente passages={[]} />)
    await expect.element(ecran.getByText(t.vide)).toBeVisible()
  })

  it('affiche acheteur, commandes, œuvres et total à recevoir', async () => {
    const ecran = await render(<PaiementsEnAttente passages={[passage()]} />)
    const texte = ecran.container.textContent ?? ''
    for (const attendu of ['Claire Martin (claire@exemple.test)', 'ERR-AAAA-BBBB', 'Nuit bleue', 'Rivage', '2 080 €', t.totalARecevoir]) {
      expect(texte).toContain(attendu)
    }
  })

  it('champs vides : résumé en alerte, aucun appel', async () => {
    const ecran = await render(<PaiementsEnAttente passages={[passage()]} />)
    await ecran.getByRole('button', { name: t.bouton }).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(t.resume(2))
    expect(actionConstaterPaiement).not.toHaveBeenCalled()
  })

  it('montant trop grand ou nul : erreur du montant, aucune confirmation', async () => {
    const ecran = await render(<PaiementsEnAttente passages={[passage()]} />)
    await ecran.getByLabelText(t.champs.reference).fill('VIR-1')
    await ecran.getByLabelText(t.champs.montant('EUR')).fill('99999999999')
    await ecran.getByRole('button', { name: t.bouton }).click()
    await expect.element(ecran.getByText(t.erreurs.montant)).toBeVisible()
    expect(ecran.container.textContent).not.toContain(t.oui)
  })

  it('succès : action appelée avec le passage, la référence et le montant ; annoncé, champs vidés, liste relue', async () => {
    actionConstaterPaiement.mockResolvedValue({ ok: true, message: t.succes(2) })
    const ecran = await render(<PaiementsEnAttente passages={[passage()]} />)
    await ecran.getByLabelText(t.champs.reference).fill('VIR-1')
    await ecran.getByLabelText(t.champs.montant('EUR')).fill('2080')
    await ecran.getByRole('button', { name: t.bouton }).click()
    // Confirmation d'abord : rien n'est envoyé, annulable.
    expect(ecran.container.textContent).toContain(t.confirmer(formaterMontant(208000, 'EUR'), 2))
    expect(actionConstaterPaiement).not.toHaveBeenCalled()
    await ecran.getByRole('button', { name: t.annuler }).click()
    expect(actionConstaterPaiement).not.toHaveBeenCalled()
    await ecran.getByRole('button', { name: t.bouton }).click()
    await ecran.getByRole('button', { name: t.oui }).click()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.succes(2))
    expect(actionConstaterPaiement).toHaveBeenCalledWith('p1', 'VIR-1', '2080')
    expect(refresh).toHaveBeenCalled()
    await expect.element(ecran.getByLabelText(t.champs.reference)).toHaveValue('')
  })

  it('refus : message en alerte, saisie conservée', async () => {
    actionConstaterPaiement.mockResolvedValue({ ok: false, message: t.refus.montant_different })
    const ecran = await render(<PaiementsEnAttente passages={[passage()]} />)
    await ecran.getByLabelText(t.champs.reference).fill('VIR-1')
    await ecran.getByLabelText(t.champs.montant('EUR')).fill('10')
    await ecran.getByRole('button', { name: t.bouton }).click()
    await ecran.getByRole('button', { name: t.oui }).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(t.refus.montant_different)
    await expect.element(ecran.getByLabelText(t.champs.montant('EUR'))).toHaveValue('10')
  })

  it('un seul appel malgré un double appui', async () => {
    let fin: (v: unknown) => void = () => {}
    actionConstaterPaiement.mockReturnValue(new Promise((r) => { fin = r }))
    const ecran = await render(<PaiementsEnAttente passages={[passage()]} />)
    await ecran.getByLabelText(t.champs.reference).fill('VIR-1')
    await ecran.getByLabelText(t.champs.montant('EUR')).fill('2080')
    await ecran.getByRole('button', { name: t.bouton }).click()
    const oui = [...ecran.container.querySelectorAll('button')].find((b) => b.textContent === t.oui) as HTMLButtonElement
    oui.click()
    oui.click()
    expect(actionConstaterPaiement).toHaveBeenCalledTimes(1)
    fin({ ok: true, message: t.succes(2) })
  })

  it('« Annuler la commande » : confirmation en deux temps, un seul appel avec l’id, annoncé et focus sur l’annonce, liste relue', async () => {
    const a = fr.paiement.annulation
    let fin: (v: unknown) => void = () => {}
    actionAnnulerCommande.mockReturnValue(new Promise((r) => { fin = r }))
    const ecran = await render(<PaiementsEnAttente passages={[passage()]} />)
    await ecran.getByRole('button', { name: `${a.bouton} ERR-CCCC-DDDD` }).click()
    expect(ecran.container.textContent).toContain(a.confirmer('ERR-CCCC-DDDD'))
    expect(actionAnnulerCommande).not.toHaveBeenCalled()
    // Renoncer : rien n'est envoyé.
    await ecran.getByRole('button', { name: a.non }).click()
    expect(actionAnnulerCommande).not.toHaveBeenCalled()
    await ecran.getByRole('button', { name: `${a.bouton} ERR-CCCC-DDDD` }).click()
    const oui = [...ecran.container.querySelectorAll('button')].find((b) => b.textContent === a.oui) as HTMLButtonElement
    oui.click()
    oui.click()
    expect(actionAnnulerCommande).toHaveBeenCalledTimes(1)
    expect(actionAnnulerCommande).toHaveBeenCalledWith('c2')
    fin({ ok: true, message: a.succes })
    await expect.element(ecran.getByRole('status')).toHaveTextContent(a.succes)
    expect(refresh).toHaveBeenCalled()
    await vi.waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('status'))
  })

  it('« Annuler la commande » refusée : message en alerte, aucun focus volé', async () => {
    const a = fr.paiement.annulation
    actionAnnulerCommande.mockResolvedValue({ ok: false, message: a.refus.etat_invalide })
    const ecran = await render(<PaiementsEnAttente passages={[passage()]} />)
    await ecran.getByRole('button', { name: `${a.bouton} ERR-AAAA-BBBB` }).click()
    await ecran.getByRole('button', { name: a.oui }).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(a.refus.etat_invalide)
    expect(actionAnnulerCommande).toHaveBeenCalledWith('c1')
  })
})
