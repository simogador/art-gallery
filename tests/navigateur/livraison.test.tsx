import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fr } from '@/lib/i18n'

// Livraison constatée (story 8.4) dans un vrai navigateur, actions serveur et routeur simulés : « J'ai reçu
// l'œuvre » de /suivi (confirmation en deux temps, un seul appel malgré un double appui, résultat annoncé dans une
// région `status`, liste relue seulement en cas de succès) et « Enregistrer la livraison » de l'équipe (source,
// preuve obligatoire au-dessus du seuil, deux temps, une seule action).
const confirmerReception = vi.fn()
const actionEnregistrerLivraison = vi.fn()
const actionAnnulerParLEquipe = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => refresh(), push: () => {} }) }))
vi.mock('@/app/suivi/actions', () => ({ confirmerReception: (...a: unknown[]) => confirmerReception(...a) }))
vi.mock('@/app/dashboard/admin/commandes/actions', () => ({
  actionAnnulerParLEquipe: (...a: unknown[]) => actionAnnulerParLEquipe(...a),
  actionEnregistrerLivraison: (...a: unknown[]) => actionEnregistrerLivraison(...a),
}))

const { ConfirmerReception } = await import('@/app/suivi/ConfirmerReception')
const { CommandesEquipe } = await import('@/app/dashboard/admin/commandes/CommandesEquipe')
const tr = fr.suivi.reception
const te = fr.commandesEquipe
const bouton = (ecran: { container: HTMLElement }, texte: string) =>
  [...ecran.container.querySelectorAll('button')].find((b) => b.textContent?.includes(texte)) as HTMLButtonElement

/** Les clics ne se suivent qu'une fois l'étape suivante affichée. */
const attendre = (ecran: { container: HTMLElement }, texte: string) => vi.waitFor(() => expect(bouton(ecran, texte)).toBeTruthy())

beforeEach(() => {
  for (const f of [confirmerReception, actionEnregistrerLivraison, actionAnnulerParLEquipe, refresh]) f.mockReset()
})

describe('« J’ai reçu l’œuvre » (navigateur)', () => {
  it('aucune action sans confirmation : le bouton ouvre la question, « Pas encore » revient', async () => {
    const ecran = await render(<ConfirmerReception numero="ERR-AAAA-BBBB" />)
    bouton(ecran, tr.bouton).click()
    await expect.element(ecran.getByText(tr.question)).toBeVisible()
    expect(confirmerReception).not.toHaveBeenCalled()
    bouton(ecran, tr.annuler).click()
    await expect.element(ecran.getByRole('button', { name: tr.bouton })).toBeVisible()
    expect(confirmerReception).not.toHaveBeenCalled()
  })

  it('succès : un seul appel malgré un double appui, annoncé, liste relue', async () => {
    let fin: (v: unknown) => void = () => {}
    confirmerReception.mockReturnValue(new Promise((r) => { fin = r }))
    const ecran = await render(<ConfirmerReception numero="ERR-AAAA-BBBB" />)
    bouton(ecran, tr.bouton).click()
    await attendre(ecran, tr.confirmer)
    const oui = bouton(ecran, tr.confirmer)
    oui.click()
    oui.click()
    expect(confirmerReception).toHaveBeenCalledTimes(1)
    expect(confirmerReception).toHaveBeenCalledWith('ERR-AAAA-BBBB')
    fin({ ok: true, message: tr.reussi })
    await expect.element(ecran.getByRole('status')).toHaveTextContent(tr.reussi)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('après la bascule (commande livrée, proposer faux) : le message de succès reste présent, sans bouton', async () => {
    confirmerReception.mockResolvedValue({ ok: true, message: tr.reussi })
    const ecran = await render(<ConfirmerReception numero="ERR-AAAA-BBBB" />)
    bouton(ecran, tr.bouton).click()
    await attendre(ecran, tr.confirmer)
    bouton(ecran, tr.confirmer).click()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(tr.reussi)
    await ecran.rerender(<ConfirmerReception numero="ERR-AAAA-BBBB" proposer={false} />)
    await expect.element(ecran.getByRole('status')).toHaveTextContent(tr.reussi)
    expect(ecran.container.querySelectorAll('button')).toHaveLength(0)
  })

  it('refus du serveur : message annoncé, le bouton reste proposé, rien n’est relu', async () => {
    confirmerReception.mockResolvedValue({ ok: false, message: tr.erreurs.preuveRequise })
    const ecran = await render(<ConfirmerReception numero="ERR-AAAA-BBBB" />)
    bouton(ecran, tr.bouton).click()
    await attendre(ecran, tr.confirmer)
    bouton(ecran, tr.confirmer).click()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(tr.erreurs.preuveRequise)
    await expect.element(ecran.getByRole('button', { name: tr.bouton })).toBeVisible()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('panne de l’action : message neutre, aucun détail technique', async () => {
    confirmerReception.mockRejectedValue(new Error('boom'))
    const ecran = await render(<ConfirmerReception numero="ERR-AAAA-BBBB" />)
    bouton(ecran, tr.bouton).click()
    await attendre(ecran, tr.confirmer)
    bouton(ecran, tr.confirmer).click()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(tr.erreurs.indisponible)
    expect(ecran.container.textContent).not.toContain('boom')
  })
})

const vue = (surcharge = {}) => ({
  numero: 'ERR-AAAA-BBBB',
  etat: 'expediee' as const,
  artiste: 'Artiste A',
  oeuvres: ['Titre un'],
  priseEnChargeAvant: '—',
  priseEnChargeLe: '—',
  expedieAvant: '—',
  expedieeLe: '21 novembre 2026',
  transporteur: 'DHL Express',
  numeroSuivi: 'JD014600003SE',
  envoiAssure: false,
  referenceAssurance: null,
  remboursement: null,
  annuleeLe: null,
  motif: null,
  alertes: [],
  annulable: false,
  livrable: true,
  preuveRequise: false,
  livreeLe: null,
  livraisonSource: null,
  preuveLivraison: null,
  retourAvant: null,
  ...surcharge,
})
const AUCUNE = { priseEnCharge: [], expedition: [] }

describe('« Enregistrer la livraison » de l’équipe (navigateur)', () => {
  it('proposé sur une expédiée seulement ; une livrée montre date, source, preuve et fin de délai, sans bouton', async () => {
    const ecran = await render(
      <CommandesEquipe
        commandes={[
          vue(),
          vue({ numero: 'ERR-CCCC-DDDD', etat: 'livree', livrable: false, livreeLe: '25 novembre 2026', livraisonSource: te.livraison.sourcesConstat.equipe_preuve, preuveLivraison: 'POD-1', retourAvant: '9 décembre 2026' }),
        ]}
        alertes={AUCUNE}
      />,
    )
    expect(ecran.container.querySelectorAll('button')).toHaveLength(1)
    const texte = ecran.container.textContent ?? ''
    for (const attendu of [te.etats.livree, '25 novembre 2026', te.livraison.sourcesConstat.equipe_preuve, 'POD-1', '9 décembre 2026', te.champs.retourAvant]) expect(texte).toContain(attendu)
  })

  it('sous le seuil : suivi du transporteur sans preuve, deux temps, un seul appel malgré un double appui, annoncé et relu', async () => {
    let fin: (v: unknown) => void = () => {}
    actionEnregistrerLivraison.mockReturnValue(new Promise((r) => { fin = r }))
    const ecran = await render(<CommandesEquipe commandes={[vue()]} alertes={AUCUNE} />)
    bouton(ecran, te.livraison.bouton).click()
    await expect.element(ecran.getByLabelText(te.livraison.preuveLibelle)).toBeVisible()
    bouton(ecran, te.livraison.continuer).click()
    await expect.element(ecran.getByText(te.livraison.confirmer('ERR-AAAA-BBBB'))).toBeVisible()
    expect(actionEnregistrerLivraison).not.toHaveBeenCalled()
    const oui = bouton(ecran, te.livraison.oui)
    oui.click()
    oui.click()
    expect(actionEnregistrerLivraison).toHaveBeenCalledTimes(1)
    expect(actionEnregistrerLivraison).toHaveBeenCalledWith('ERR-AAAA-BBBB', 'equipe_suivi', '')
    fin({ ok: true, message: te.livraison.succes })
    await expect.element(ecran.getByRole('status')).toHaveTextContent(te.livraison.succes)
    expect(refresh).toHaveBeenCalled()
  })

  it('au-dessus du seuil : la source « suivi » est désactivée, la preuve est exigée avant toute confirmation', async () => {
    const ecran = await render(<CommandesEquipe commandes={[vue({ preuveRequise: true })]} alertes={AUCUNE} />)
    bouton(ecran, te.livraison.bouton).click()
    await attendre(ecran, te.livraison.continuer)
    const suivi = ecran.container.querySelector('input[type="radio"][value="equipe_suivi"]') as HTMLInputElement
    const preuve = ecran.container.querySelector('input[type="radio"][value="equipe_preuve"]') as HTMLInputElement
    expect(suivi.disabled).toBe(true)
    expect(preuve.checked).toBe(true)
    bouton(ecran, te.livraison.continuer).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(te.livraison.erreurs.requis)
    expect(actionEnregistrerLivraison).not.toHaveBeenCalled()
    await ecran.getByLabelText(te.livraison.preuveLibelle).fill('POD-SIGNATURE-4471')
    bouton(ecran, te.livraison.continuer).click()
    await attendre(ecran, te.livraison.oui)
    actionEnregistrerLivraison.mockResolvedValue({ ok: true, message: te.livraison.succes })
    bouton(ecran, te.livraison.oui).click()
    await vi.waitFor(() => expect(actionEnregistrerLivraison).toHaveBeenCalledWith('ERR-AAAA-BBBB', 'equipe_preuve', 'POD-SIGNATURE-4471'))
  })

  it('refus du serveur : message dans le champ, retour à la saisie', async () => {
    actionEnregistrerLivraison.mockResolvedValue({ ok: false, message: te.livraison.erreurs.preuve_requise, champ: 'source' })
    const ecran = await render(<CommandesEquipe commandes={[vue()]} alertes={AUCUNE} />)
    bouton(ecran, te.livraison.bouton).click()
    await attendre(ecran, te.livraison.continuer)
    bouton(ecran, te.livraison.continuer).click()
    await attendre(ecran, te.livraison.oui)
    bouton(ecran, te.livraison.oui).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(te.livraison.erreurs.preuve_requise)
    await expect.element(ecran.getByLabelText(te.livraison.preuveLibelle)).toBeVisible()
  })
})
