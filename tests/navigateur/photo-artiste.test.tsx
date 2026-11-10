import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { fr } from '@/lib/i18n'
import { TAILLE_MAX_PHOTO_ARTISTE } from '@/lib/curation/fiche-artiste-regles'

// Envoi de la photo d'un artiste dans un vrai navigateur : actions serveur et envoi à Cloudinary
// simulés (aucun appel réseau, ni Cloudinary, ni base).
const preparer = vi.fn()
const enregistrer = vi.fn()
const envoyer = vi.fn()
vi.mock('@/app/dashboard/admin/artistes/actions', () => ({
  actionPreparerEnvoiArtiste: (...a: unknown[]) => preparer(...a),
  actionEnregistrerPhotoArtiste: (...a: unknown[]) => enregistrer(...a),
}))
vi.mock('@/components/dashboard/envoiCloudinary', () => ({
  envoyerACloudinary: (...a: unknown[]) => envoyer(...a),
}))

const { PhotoArtiste, MESSAGES_PHOTO_ARTISTE, LIBELLES_PHOTO_ARTISTE } = await import('@/app/dashboard/admin/artistes/PhotoArtiste')

const ENVOI = { cloudName: 'demo', apiKey: 'k', timestamp: 1, publicId: 'errancy/artistes/a1/portrait', allowedFormats: 'jpg,png', signature: 's' }
const ANCIENNE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="3" height="4"/>')}`
const NOUVELLE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="6" height="8"/>')}`

const champ = () => document.querySelector('input[type="file"]') as HTMLInputElement
const png = (taille = 1024) => new File([new Uint8Array(taille)], 'portrait.png', { type: 'image/png' })

function monter(urlInitiale: string | null = ANCIENNE) {
  return render(<PhotoArtiste artistId="a1" nom="Marie Roux" cible="portrait" libelle="Portrait" urlInitiale={urlInitiale} />)
}
const image = () => document.querySelector('img')?.getAttribute('src')

beforeEach(() => {
  preparer.mockReset().mockResolvedValue({ ok: true, envoi: ENVOI })
  enregistrer.mockReset().mockResolvedValue({ ok: true, url: NOUVELLE })
  envoyer.mockReset().mockResolvedValue({ public_id: ENVOI.publicId, secure_url: NOUVELLE })
})

describe('PhotoArtiste (navigateur)', () => {
  it('fichier valide : préparation, envoi puis enregistrement, la nouvelle photo remplace l’ancienne', async () => {
    const ecran = await monter()
    await expect.element(ecran.getByRole('button', { name: new RegExp(`^${LIBELLES_PHOTO_ARTISTE.remplacer}`) })).toBeVisible()
    const fichier = png()
    await userEvent.upload(champ(), fichier)

    await vi.waitFor(() => expect(enregistrer).toHaveBeenCalledTimes(1))
    expect(preparer).toHaveBeenCalledWith('a1', 'portrait')
    expect(envoyer).toHaveBeenCalledWith(ENVOI, fichier, expect.any(Function))
    expect(enregistrer).toHaveBeenCalledWith('a1', 'portrait', { public_id: ENVOI.publicId, secure_url: NOUVELLE })
    await vi.waitFor(() => expect(image()).toBe(NOUVELLE))
    expect(document.querySelector('[role="alert"]')).toBeNull()
  })

  it('sans photo : « Ajouter une photo » puis envoi', async () => {
    const ecran = await monter(null)
    await expect.element(ecran.getByRole('button', { name: new RegExp(`^${LIBELLES_PHOTO_ARTISTE.ajouter}`) })).toBeVisible()
    expect(image()).toBeUndefined()
    await userEvent.upload(champ(), png())
    await vi.waitFor(() => expect(image()).toBe(NOUVELLE))
  })

  it('fichier trop lourd : refus lisible, aucun appel', async () => {
    const ecran = await monter()
    await userEvent.upload(champ(), png(TAILLE_MAX_PHOTO_ARTISTE + 1))
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(fr.artistes.fichier.poids)
    expect(preparer).not.toHaveBeenCalled()
    expect(envoyer).not.toHaveBeenCalled()
    expect(enregistrer).not.toHaveBeenCalled()
    expect(image()).toBe(ANCIENNE)
  })

  it('type refusé : refus lisible, aucun appel', async () => {
    const ecran = await monter()
    await userEvent.upload(champ(), new File(['texte'], 'notes.txt', { type: 'text/plain' }), { applyAccept: false })
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(fr.artistes.fichier.type)
    expect(preparer).not.toHaveBeenCalled()
    expect(envoyer).not.toHaveBeenCalled()
    expect(enregistrer).not.toHaveBeenCalled()
    expect(image()).toBe(ANCIENNE)
  })

  it('échec d’envoi : « Envoi impossible », ancienne photo conservée, rien d’enregistré', async () => {
    envoyer.mockResolvedValue(null)
    const ecran = await monter()
    await userEvent.upload(champ(), png())
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(MESSAGES_PHOTO_ARTISTE.envoiRefuse)
    expect(MESSAGES_PHOTO_ARTISTE.envoiRefuse).toContain('Envoi impossible')
    expect(enregistrer).not.toHaveBeenCalled()
    expect(image()).toBe(ANCIENNE)
    await expect.element(ecran.getByRole('button', { name: new RegExp(`^${LIBELLES_PHOTO_ARTISTE.remplacer}`) })).toBeEnabled()
  })

  it('refus de la préparation (accès, artiste inconnu) : message de l’action, aucun envoi', async () => {
    preparer.mockResolvedValue({ ok: false, message: 'Accès refusé.' })
    const ecran = await monter()
    await userEvent.upload(champ(), png())
    await expect.element(ecran.getByRole('alert')).toHaveTextContent('Accès refusé.')
    expect(envoyer).not.toHaveBeenCalled()
    expect(image()).toBe(ANCIENNE)
  })

  it('refus de l’enregistrement : message de l’action, ancienne photo conservée', async () => {
    enregistrer.mockResolvedValue({ ok: false, message: 'Réponse Cloudinary invalide.' })
    const ecran = await monter()
    await userEvent.upload(champ(), png())
    await expect.element(ecran.getByRole('alert')).toHaveTextContent('Réponse Cloudinary invalide.')
    expect(image()).toBe(ANCIENNE)
  })

  it('action qui échoue (exception) : « Envoi impossible », ancienne photo conservée', async () => {
    preparer.mockRejectedValue(new Error('réseau'))
    const ecran = await monter()
    await userEvent.upload(champ(), png())
    await expect.element(ecran.getByRole('alert')).toHaveTextContent(MESSAGES_PHOTO_ARTISTE.echec)
    expect(image()).toBe(ANCIENNE)
  })
})
