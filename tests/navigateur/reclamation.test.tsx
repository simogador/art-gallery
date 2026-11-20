import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fr } from '@/lib/i18n'

// Réclamation et retour (story 8.5) dans un vrai navigateur, actions serveur, envoi Cloudinary et routeur simulés :
// « Signaler un problème » de /suivi (formulaire, validation avant l'envoi, photos contrôlées, confirmation en deux
// temps, un seul appel malgré un double appui, résultat annoncé, formulaire conservé en cas d'échec) et les gestes de
// l'équipe (accepter, refuser avec motif, retour reçu avec montant ; deux temps, un seul appel, résultat annoncé).
const preparerPhotoReclamation = vi.fn()
const signalerUnProbleme = vi.fn()
const envoyerACloudinary = vi.fn()
const actionAccepterReclamation = vi.fn()
const actionRefuserReclamation = vi.fn()
const actionRetourRecu = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => refresh(), push: () => {} }) }))
vi.mock('@/app/suivi/actions', () => ({
  confirmerReception: vi.fn(),
  preparerPhotoReclamation: (...a: unknown[]) => preparerPhotoReclamation(...a),
  signalerUnProbleme: (...a: unknown[]) => signalerUnProbleme(...a),
}))
vi.mock('@/components/dashboard/envoiCloudinary', () => ({ envoyerACloudinary: (...a: unknown[]) => envoyerACloudinary(...a) }))
vi.mock('@/app/dashboard/admin/commandes/actions', () => ({
  actionAnnulerParLEquipe: vi.fn(),
  actionEnregistrerLivraison: vi.fn(),
  actionAccepterReclamation: (...a: unknown[]) => actionAccepterReclamation(...a),
  actionRefuserReclamation: (...a: unknown[]) => actionRefuserReclamation(...a),
  actionRetourRecu: (...a: unknown[]) => actionRetourRecu(...a),
}))

const { SignalerProbleme } = await import('@/app/suivi/SignalerProbleme')
const { CommandesEquipe } = await import('@/app/dashboard/admin/commandes/CommandesEquipe')
const tr = fr.suivi.reclamation
const te = fr.commandesEquipe
const NUMERO = 'ERR-AAAA-BBBB'
const DESCRIPTION = 'Le cadre est fendu sur le côté gauche.'
const bouton = (ecran: { container: HTMLElement }, texte: string) =>
  [...ecran.container.querySelectorAll('button')].find((b) => b.textContent?.includes(texte)) as HTMLButtonElement
const attendre = (ecran: { container: HTMLElement }, texte: string) => vi.waitFor(() => expect(bouton(ecran, texte)).toBeTruthy())

function joindre(ecran: { container: HTMLElement }, fichiers: File[]) {
  const champ = ecran.container.querySelector('input[type="file"]') as HTMLInputElement
  const dt = new DataTransfer()
  fichiers.forEach((f) => dt.items.add(f))
  champ.files = dt.files
  champ.dispatchEvent(new Event('change', { bubbles: true }))
}
const image = (nom: string, octets = 1000, type = 'image/jpeg') => new File([new Uint8Array(octets)], nom, { type })

async function remplir(ecran: Awaited<ReturnType<typeof render>>) {
  bouton(ecran, tr.bouton).click()
  await expect.element(ecran.getByLabelText(tr.descriptionLibelle)).toBeVisible()
  await ecran.getByLabelText(tr.motifs.abimee).click()
  await ecran.getByLabelText(tr.descriptionLibelle).fill(DESCRIPTION)
}

beforeEach(() => {
  for (const f of [preparerPhotoReclamation, signalerUnProbleme, envoyerACloudinary, actionAccepterReclamation, actionRefuserReclamation, actionRetourRecu, refresh]) f.mockReset()
})

describe('« Signaler un problème » (navigateur)', () => {
  it('rien n’est appelé avant la confirmation ; le motif et la description sont exigés', async () => {
    const ecran = await render(<SignalerProbleme numero={NUMERO} />)
    bouton(ecran, tr.bouton).click()
    await attendre(ecran, tr.continuer)
    bouton(ecran, tr.continuer).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(tr.erreurs.motif)
    await ecran.getByLabelText(tr.motifs.non_conforme).click()
    bouton(ecran, tr.continuer).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(tr.erreurs.descriptionRequise)
    await ecran.getByLabelText(tr.descriptionLibelle).fill(DESCRIPTION)
    bouton(ecran, tr.continuer).click()
    await expect.element(ecran.getByText(tr.question)).toBeVisible()
    expect(signalerUnProbleme).not.toHaveBeenCalled()
    expect(preparerPhotoReclamation).not.toHaveBeenCalled()
    bouton(ecran, tr.retour).click()
    await expect.element(ecran.getByLabelText(tr.descriptionLibelle)).toHaveValue(DESCRIPTION)
  })

  it('photos : plus de 3, un fichier qui n’est pas une image, plus de 5 Mo : refusés avant tout envoi', async () => {
    const ecran = await render(<SignalerProbleme numero={NUMERO} />)
    bouton(ecran, tr.bouton).click()
    await attendre(ecran, tr.continuer)
    joindre(ecran, [image('a.jpg'), image('b.jpg'), image('c.jpg'), image('d.jpg')])
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(tr.erreurs.photosTrop)
    joindre(ecran, [image('doc.pdf', 1000, 'application/pdf')])
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(tr.erreurs.photoType)
    joindre(ecran, [image('gros.jpg', 5 * 1024 * 1024 + 1)])
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(tr.erreurs.photoPoids)
    expect(preparerPhotoReclamation).not.toHaveBeenCalled()
  })

  it('envoi : une signature et un envoi par photo, puis UN seul signalement malgré un double appui, annoncé, liste relue', async () => {
    preparerPhotoReclamation.mockResolvedValue({ ok: true, envoi: { cloudName: 'c', apiKey: 'k', timestamp: 1, publicId: 'p', allowedFormats: 'jpg', signature: 's' } })
    envoyerACloudinary.mockResolvedValue({ public_id: 'p' })
    let fin: (v: unknown) => void = () => {}
    signalerUnProbleme.mockReturnValue(new Promise((r) => { fin = r }))
    const ecran = await render(<SignalerProbleme numero={NUMERO} />)
    await remplir(ecran)
    joindre(ecran, [image('a.jpg'), image('b.png', 2000, 'image/png')])
    bouton(ecran, tr.continuer).click()
    await attendre(ecran, tr.confirmer)
    const oui = bouton(ecran, tr.confirmer)
    oui.click()
    oui.click()
    await vi.waitFor(() => expect(signalerUnProbleme).toHaveBeenCalledTimes(1))
    expect(preparerPhotoReclamation).toHaveBeenCalledTimes(2)
    expect(preparerPhotoReclamation).toHaveBeenCalledWith(NUMERO)
    expect(envoyerACloudinary).toHaveBeenCalledTimes(2)
    expect(signalerUnProbleme).toHaveBeenCalledWith(NUMERO, { motif: 'abimee', description: DESCRIPTION, photos: [{ public_id: 'p' }, { public_id: 'p' }] })
    fin({ ok: true, message: tr.reussi })
    await expect.element(ecran.getByRole('status')).toHaveTextContent(tr.reussi)
    expect(refresh).toHaveBeenCalledTimes(1)
    // La commande bascule (réclamation ouverte) : le message reste, plus de formulaire ni de bouton.
    await ecran.rerender(<SignalerProbleme numero={NUMERO} proposer={false} />)
    await expect.element(ecran.getByRole('status')).toHaveTextContent(tr.reussi)
    expect(ecran.container.querySelectorAll('button')).toHaveLength(0)
  })

  it('revenir au formulaire vide la sélection : les anciennes photos ne partent pas', async () => {
    signalerUnProbleme.mockResolvedValue({ ok: true, message: tr.reussi })
    const ecran = await render(<SignalerProbleme numero={NUMERO} />)
    await remplir(ecran)
    joindre(ecran, [image('a.jpg')])
    bouton(ecran, tr.continuer).click()
    await attendre(ecran, tr.retour)
    bouton(ecran, tr.retour).click()
    await attendre(ecran, tr.continuer)
    bouton(ecran, tr.continuer).click()
    await attendre(ecran, tr.confirmer)
    bouton(ecran, tr.confirmer).click()
    await vi.waitFor(() => expect(signalerUnProbleme).toHaveBeenCalledTimes(1))
    expect(preparerPhotoReclamation).not.toHaveBeenCalled()
    expect(signalerUnProbleme).toHaveBeenCalledWith(NUMERO, expect.objectContaining({ photos: [] }))
  })

  it('échec d’une photo : le formulaire est conservé avec le message, aucun signalement', async () => {
    preparerPhotoReclamation.mockResolvedValue({ ok: true, envoi: { cloudName: 'c', apiKey: 'k', timestamp: 1, publicId: 'p', allowedFormats: 'jpg', signature: 's' } })
    envoyerACloudinary.mockResolvedValue(null)
    const ecran = await render(<SignalerProbleme numero={NUMERO} />)
    await remplir(ecran)
    joindre(ecran, [image('a.jpg')])
    bouton(ecran, tr.continuer).click()
    await attendre(ecran, tr.confirmer)
    bouton(ecran, tr.confirmer).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(tr.erreurs.photoEnvoi)
    await expect.element(ecran.getByLabelText(tr.descriptionLibelle)).toHaveValue(DESCRIPTION)
    expect(signalerUnProbleme).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('refus du serveur : message annoncé, formulaire conservé, rien n’est relu', async () => {
    signalerUnProbleme.mockResolvedValue({ ok: false, message: tr.erreurs.delaiEchu })
    const ecran = await render(<SignalerProbleme numero={NUMERO} />)
    await remplir(ecran)
    bouton(ecran, tr.continuer).click()
    await attendre(ecran, tr.confirmer)
    bouton(ecran, tr.confirmer).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(tr.erreurs.delaiEchu)
    await expect.element(ecran.getByLabelText(tr.descriptionLibelle)).toHaveValue(DESCRIPTION)
    expect(preparerPhotoReclamation).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('délai échu : pas de bouton, note neutre', async () => {
    const ecran = await render(<SignalerProbleme numero={NUMERO} proposer={false} delaiEchu />)
    expect(ecran.container.querySelectorAll('button')).toHaveLength(0)
    await expect.element(ecran.getByText(tr.delaiEchu)).toBeVisible()
  })
})

const vue = (surcharge = {}) => ({
  numero: NUMERO,
  etat: 'livree' as const,
  artiste: 'Artiste A',
  oeuvres: ['Titre un'],
  priseEnChargeAvant: '—',
  priseEnChargeLe: '—',
  expedieAvant: '—',
  expedieeLe: '—',
  transporteur: null,
  numeroSuivi: null,
  envoiAssure: false,
  referenceAssurance: null,
  remboursement: null,
  annuleeLe: null,
  motif: null,
  alertes: [],
  annulable: false,
  livrable: false,
  preuveRequise: false,
  livreeLe: '20 novembre 2026',
  livraisonSource: 'L’acheteur',
  preuveLivraison: null,
  retourAvant: '4 décembre 2026',
  reclamation: { motif: te.reclamation.motifs.abimee, description: DESCRIPTION, etat: 'ouverte' as const, motifRefus: null, decideLe: null, photos: ['https://res.cloudinary.com/x/image/upload/v1/errancy/reclamations/c/photo-aaaaaaaa.jpg'] },
  retournable: false,
  montantCommande: null,
  retourRecuLe: null,
  ...surcharge,
})
const AUCUNE = { priseEnCharge: [], expedition: [] }
const MOTIF = 'Les photos ne montrent aucun dommage.'

describe('Réclamations de l’équipe (navigateur)', () => {
  it('la réclamation à traiter est en tête, avec motif, description et photos (liens)', async () => {
    const ecran = await render(<CommandesEquipe commandes={[vue()]} alertes={AUCUNE} />)
    await expect.element(ecran.getByText(te.reclamation.ouvertes)).toBeVisible()
    const texte = ecran.container.textContent ?? ''
    for (const attendu of [te.reclamation.motifs.abimee, DESCRIPTION, te.reclamation.photo(1)]) expect(texte).toContain(attendu)
    expect(ecran.container.querySelector('a[href*="photo-aaaaaaaa"]')).toBeTruthy()
  })

  it('accepter : deux temps, un seul appel malgré un double appui, résultat annoncé, liste relue', async () => {
    let fin: (v: unknown) => void = () => {}
    actionAccepterReclamation.mockReturnValue(new Promise((r) => { fin = r }))
    const ecran = await render(<CommandesEquipe commandes={[vue()]} alertes={AUCUNE} />)
    bouton(ecran, te.reclamation.accepter).click()
    await attendre(ecran, te.reclamation.oui)
    expect(actionAccepterReclamation).not.toHaveBeenCalled()
    const oui = bouton(ecran, te.reclamation.oui)
    oui.click()
    oui.click()
    expect(actionAccepterReclamation).toHaveBeenCalledTimes(1)
    expect(actionAccepterReclamation).toHaveBeenCalledWith(NUMERO)
    fin({ ok: true, message: te.reclamation.succes.acceptee })
    await expect.element(ecran.getByRole('status')).toHaveTextContent(te.reclamation.succes.acceptee)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('refuser : motif de 10 à 500 caractères avant la confirmation, puis un seul appel avec le motif', async () => {
    actionRefuserReclamation.mockResolvedValue({ ok: true, message: te.reclamation.succes.refusee })
    const ecran = await render(<CommandesEquipe commandes={[vue()]} alertes={AUCUNE} />)
    bouton(ecran, te.reclamation.refuser).click()
    await attendre(ecran, te.reclamation.continuer)
    await ecran.getByLabelText(te.reclamation.motifLibelle).fill('court')
    bouton(ecran, te.reclamation.continuer).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(te.reclamation.erreurs.trop_court)
    await ecran.getByLabelText(te.reclamation.motifLibelle).fill(MOTIF)
    bouton(ecran, te.reclamation.continuer).click()
    await attendre(ecran, te.reclamation.oui)
    expect(actionRefuserReclamation).not.toHaveBeenCalled()
    bouton(ecran, te.reclamation.oui).click()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(te.reclamation.succes.refusee)
    expect(actionRefuserReclamation).toHaveBeenCalledTimes(1)
    expect(actionRefuserReclamation).toHaveBeenCalledWith(NUMERO, MOTIF)
  })

  it('retour reçu : montant facultatif, deux temps ; refus explicite conservé dans le champ', async () => {
    actionRetourRecu.mockResolvedValueOnce({ ok: false, message: te.reclamation.erreurs.montant_depasse, champ: 'montant' })
    actionRetourRecu.mockResolvedValueOnce({ ok: true, message: te.reclamation.succes.retour })
    const accepte = vue({ retournable: true, montantCommande: '640 €', reclamation: { ...vue().reclamation, etat: 'acceptee' as const, decideLe: '21 novembre 2026' } })
    const ecran = await render(<CommandesEquipe commandes={[accepte]} alertes={AUCUNE} />)
    expect(ecran.container.textContent).not.toContain(te.reclamation.accepter)
    bouton(ecran, te.reclamation.retourBouton).click()
    await attendre(ecran, te.reclamation.continuer)
    await expect.element(ecran.getByText(te.reclamation.montantAide('640 €'))).toBeVisible()
    await ecran.getByLabelText(te.reclamation.montantLibelle).fill('9999')
    bouton(ecran, te.reclamation.continuer).click()
    await attendre(ecran, te.reclamation.oui)
    bouton(ecran, te.reclamation.oui).click()
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(te.reclamation.erreurs.montant_depasse)
    expect(actionRetourRecu).toHaveBeenLastCalledWith(NUMERO, '9999')
    await expect.element(ecran.getByLabelText(te.reclamation.montantLibelle)).toHaveValue('9999')
    await ecran.getByLabelText(te.reclamation.montantLibelle).fill('')
    bouton(ecran, te.reclamation.continuer).click()
    await attendre(ecran, te.reclamation.oui)
    bouton(ecran, te.reclamation.oui).click()
    await expect.element(ecran.getByRole('status')).toHaveTextContent(te.reclamation.succes.retour)
    expect(actionRetourRecu).toHaveBeenLastCalledWith(NUMERO, '')
    expect(actionRetourRecu).toHaveBeenCalledTimes(2)
  })

  it('réclamation acceptée : l’e-mail de l’acheteur et son aide sont affichés ; ouverte : rien', async () => {
    const accepte = vue({ retournable: true, montantCommande: '640 €', reclamation: { ...vue().reclamation, etat: 'acceptee' as const, emailAcheteur: 'claire@exemple.test' } })
    let ecran = await render(<CommandesEquipe commandes={[accepte]} alertes={AUCUNE} />)
    expect(ecran.container.textContent).toContain(`${te.reclamation.champs.emailAcheteur} claire@exemple.test`)
    expect(ecran.container.textContent).toContain(te.reclamation.emailAcheteurAide)
    ecran = await render(<CommandesEquipe commandes={[vue()]} alertes={AUCUNE} />)
    expect(ecran.container.querySelector('[data-email-acheteur]')).toBeNull()
  })

  it('une réclamation refusée reste dans la liste générale avec son motif, sans geste', async () => {
    const refusee = vue({ reclamation: { ...vue().reclamation, etat: 'refusee' as const, motifRefus: MOTIF, decideLe: '21 novembre 2026' } })
    const ecran = await render(<CommandesEquipe commandes={[refusee]} alertes={AUCUNE} />)
    expect(ecran.container.textContent).toContain(MOTIF)
    expect(ecran.container.textContent).not.toContain(te.reclamation.ouvertes)
    expect(ecran.container.querySelectorAll('button')).toHaveLength(0)
  })
})
