import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fr } from '@/lib/i18n'

// Commandes de l'équipe (story 8.3) dans un vrai navigateur : action serveur et routeur simulés. Alertes de
// retard distinctes en tête, aucune action sans appui, motif obligatoire avant la confirmation, un seul appel
// malgré un double appui, résultat annoncé (région `status`, qui reçoit le focus), liste relue.
const actionAnnulerParLEquipe = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => refresh(), push: () => {} }) }))
vi.mock('@/app/dashboard/admin/commandes/actions', () => ({
  actionAnnulerParLEquipe: (...a: unknown[]) => actionAnnulerParLEquipe(...a),
  actionEnregistrerLivraison: vi.fn(),
  actionAccepterReclamation: vi.fn(),
  actionRefuserReclamation: vi.fn(),
  actionRetourRecu: vi.fn(),
}))

const { CommandesEquipe } = await import('@/app/dashboard/admin/commandes/CommandesEquipe')
const t = fr.commandesEquipe

const vue = (surcharge = {}) => ({
  numero: 'ERR-AAAA-BBBB',
  etat: 'confirmee' as const,
  artiste: 'Artiste A',
  oeuvres: ['Titre un'],
  priseEnChargeAvant: '18 novembre 2026, 10 h 00',
  priseEnChargeLe: '—',
  expedieAvant: '23 novembre 2026, 10 h 00',
  expedieeLe: '—',
  transporteur: null,
  numeroSuivi: null,
  envoiAssure: false,
  referenceAssurance: null,
  remboursement: null,
  annuleeLe: null,
  motif: null,
  alertes: [],
  annulable: true,
  livrable: false,
  preuveRequise: false,
  livreeLe: null,
  livraisonSource: null,
  preuveLivraison: null,
  retourAvant: null,
  reclamation: null,
  retournable: false,
  montantCommande: null,
  retourRecuLe: null,
  ...surcharge,
})
const AUCUNE = { priseEnCharge: [], expedition: [] }
const MOTIF = 'Œuvre abîmée avant la remise.'
const bouton = (ecran: { container: HTMLElement }, texte: string) =>
  [...ecran.container.querySelectorAll('button')].find((b) => b.textContent?.includes(texte)) as HTMLButtonElement

beforeEach(() => {
  actionAnnulerParLEquipe.mockReset()
  refresh.mockReset()
})

describe('CommandesEquipe (navigateur)', () => {
  it('liste vide : message d’état vide et « Aucun retard. »', async () => {
    const ecran = await render(<CommandesEquipe commandes={[]} alertes={AUCUNE} />)
    await expect.element(ecran.getByText(t.vide)).toBeVisible()
    await expect.element(ecran.getByText(t.alertes.aucune)).toBeVisible()
  })

  it('deux alertes distinctes en tête, et le retard sur la carte', async () => {
    const ecran = await render(
      <CommandesEquipe
        commandes={[vue({ alertes: ['prise_en_charge_en_retard', 'expedition_en_retard'] })]}
        alertes={{ priseEnCharge: ['ERR-AAAA-BBBB'], expedition: ['ERR-AAAA-BBBB', 'ERR-CCCC-DDDD'] }}
      />,
    )
    const prise = ecran.container.querySelector('[data-alerte="prise_en_charge_en_retard"]')
    const expedition = ecran.container.querySelector('[data-alerte="expedition_en_retard"]')
    expect(prise?.textContent).toContain(t.alertes.priseEnCharge)
    expect(expedition?.textContent).toContain(t.alertes.expedition)
    expect(expedition?.textContent).toContain('ERR-CCCC-DDDD')
    expect(ecran.container.textContent).toContain(t.alertes.enRetard.prise_en_charge_en_retard)
  })

  it('expédiée : transporteur, numéro de suivi, assurance et référence ; aucun bouton d’annulation', async () => {
    const ecran = await render(
      <CommandesEquipe
        commandes={[vue({ etat: 'expediee', annulable: false, transporteur: 'DHL Express', numeroSuivi: 'JD014600003SE', envoiAssure: true, referenceAssurance: 'REF-1', expedieeLe: '21 novembre 2026' })]}
        alertes={AUCUNE}
      />,
    )
    const texte = ecran.container.textContent ?? ''
    for (const attendu of ['DHL Express', 'JD014600003SE', 'REF-1', t.champs.referenceAssurance, t.oui]) expect(texte).toContain(attendu)
    expect(ecran.container.querySelectorAll('button')).toHaveLength(0)
  })

  it('annulée : motif, date et remboursement lisibles', async () => {
    const ecran = await render(
      <CommandesEquipe
        commandes={[vue({ etat: 'annulee', annulable: false, motif: MOTIF, annuleeLe: '20 novembre 2026', remboursement: 'Demandé, 1 040 €' })]}
        alertes={AUCUNE}
      />,
    )
    const texte = ecran.container.textContent ?? ''
    for (const attendu of [MOTIF, '20 novembre 2026', 'Demandé, 1 040 €', t.etats.annulee]) expect(texte).toContain(attendu)
  })

  it('motif vide ou court : message par champ, aucune action appelée ; motif valide : confirmation en deux temps', async () => {
    const ecran = await render(<CommandesEquipe commandes={[vue()]} alertes={AUCUNE} />)
    bouton(ecran, t.annulation.bouton).click()
    await expect.element(ecran.getByLabelText(t.annulation.motifLibelle)).toBeVisible()
    bouton(ecran, t.annulation.continuer).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(t.annulation.erreurs.obligatoire)
    const champ = ecran.container.querySelector('textarea') as HTMLTextAreaElement
    await ecran.getByLabelText(t.annulation.motifLibelle).fill('court')
    bouton(ecran, t.annulation.continuer).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(t.annulation.erreurs.trop_court)
    expect(actionAnnulerParLEquipe).not.toHaveBeenCalled()
    await ecran.getByLabelText(t.annulation.motifLibelle).fill(MOTIF)
    expect(champ.value).toBe(MOTIF)
    bouton(ecran, t.annulation.continuer).click()
    await expect.element(ecran.getByText(t.annulation.confirmer('ERR-AAAA-BBBB'))).toBeVisible()
    expect(actionAnnulerParLEquipe).not.toHaveBeenCalled()
  })

  it('succès : un seul appel malgré un double appui, annoncé, focus sur l’annonce, liste relue', async () => {
    let fin: (v: unknown) => void = () => {}
    actionAnnulerParLEquipe.mockReturnValue(new Promise((r) => { fin = r }))
    const ecran = await render(<CommandesEquipe commandes={[vue()]} alertes={AUCUNE} />)
    bouton(ecran, t.annulation.bouton).click()
    await ecran.getByLabelText(t.annulation.motifLibelle).fill(MOTIF)
    bouton(ecran, t.annulation.continuer).click()
    await expect.element(ecran.getByText(t.annulation.confirmer('ERR-AAAA-BBBB'))).toBeVisible()
    const oui = bouton(ecran, t.annulation.oui)
    oui.click()
    oui.click()
    expect(actionAnnulerParLEquipe).toHaveBeenCalledTimes(1)
    expect(actionAnnulerParLEquipe).toHaveBeenCalledWith('ERR-AAAA-BBBB', MOTIF)
    fin({ ok: true, message: t.annulation.succes })
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.annulation.succes)
    expect(refresh).toHaveBeenCalled()
    await vi.waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('status'))
  })

  it('refus du serveur : annoncé, la commande reste annulable', async () => {
    actionAnnulerParLEquipe.mockResolvedValue({ ok: false, message: t.annulation.refus.etat_invalide })
    const ecran = await render(<CommandesEquipe commandes={[vue()]} alertes={AUCUNE} />)
    bouton(ecran, t.annulation.bouton).click()
    await ecran.getByLabelText(t.annulation.motifLibelle).fill(MOTIF)
    bouton(ecran, t.annulation.continuer).click()
    await expect.element(ecran.getByText(t.annulation.confirmer('ERR-AAAA-BBBB'))).toBeVisible()
    bouton(ecran, t.annulation.oui).click()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.annulation.refus.etat_invalide)
  })

  it('refus du serveur : le motif saisi est conservé', async () => {
    actionAnnulerParLEquipe.mockResolvedValue({ ok: false, message: t.annulation.refus.indisponible })
    const ecran = await render(<CommandesEquipe commandes={[vue()]} alertes={AUCUNE} />)
    bouton(ecran, t.annulation.bouton).click()
    await ecran.getByLabelText(t.annulation.motifLibelle).fill(MOTIF)
    bouton(ecran, t.annulation.continuer).click()
    await expect.element(ecran.getByText(t.annulation.confirmer('ERR-AAAA-BBBB'))).toBeVisible()
    bouton(ecran, t.annulation.oui).click()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(t.annulation.refus.indisponible)
    bouton(ecran, t.annulation.non).click()
    await expect.element(ecran.getByLabelText(t.annulation.motifLibelle)).toHaveValue(MOTIF)
  })

  it('motif limité à 500 caractères, expédiée sans échéances, note de plafond, alertes en région nommée', async () => {
    const ecran = await render(<CommandesEquipe commandes={[vue({ etat: 'expediee', annulable: false })]} alertes={AUCUNE} tronque />)
    const texte = ecran.container.textContent ?? ''
    expect(texte).not.toContain(t.champs.priseEnChargeAvant)
    expect(texte).not.toContain(t.champs.expedieAvant)
    expect(texte).toContain(t.tronque)
    expect(ecran.container.querySelector('section[aria-labelledby="alertes-retard"]')).not.toBeNull()
    const ecran2 = await render(<CommandesEquipe commandes={[vue()]} alertes={AUCUNE} />)
    bouton(ecran2, t.annulation.bouton).click()
    await expect.element(ecran2.getByLabelText(t.annulation.motifLibelle)).toHaveAttribute('maxlength', '500')
  })
})
