import type { ComponentProps } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { CarrouselPhotos } from '@/app/galerie/[id]/CarrouselPhotos'
import { fr } from '@/lib/i18n'
import type { PhotoFiche } from '@/lib/types'

// Le barrel `@/components/ui` importe l'action du pays de livraison (code serveur, qui mesure depuis la story 4.8) : simulée.
vi.mock('@/app/actions/pays', () => ({ choisirPaysLivraison: () => {} }))

// Carrousel de la fiche (défilement natif, compteur, plein écran, zoom) dans un vrai navigateur.
// `next/image` est remplacé par une balise `img` (alias de la configuration) : aucune requête externe.

const t = fr.fiche.photos

const image = (couleur: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="100"><rect width="80" height="100" fill="${couleur}"/></svg>`)}`
const PHOTOS: PhotoFiche[] = [
  { url: image('red'), type: 'mise_en_situation', largeur: 80, hauteur: 100 },
  { url: image('green'), type: 'face_lumiere_du_jour', largeur: 80, hauteur: 100 },
  { url: image('blue'), type: 'gros_plan', largeur: 80, hauteur: 100 },
  { url: image('black'), type: 'principale', largeur: 80, hauteur: 100 },
]

// Le CSS de Tailwind n'est pas chargé ici : on pose l'essentiel de la mise en page du défilement.
beforeAll(() => {
  const style = document.createElement('style')
  style.textContent = `
    [aria-roledescription="carrousel"] { display: flex; width: 300px; overflow-x: auto; scroll-snap-type: x mandatory; }
    [aria-roledescription="diapositive"] { position: relative; flex: 0 0 100%; height: 200px; scroll-snap-align: center; }
    [aria-roledescription="diapositive"] > button { position: absolute; inset: 0; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `
  document.head.append(style)
})
afterEach(() => {
  document.body.style.overflow = ''
})

function monter(photos: PhotoFiche[] = PHOTOS, props: Partial<ComponentProps<typeof CarrouselPhotos>> = {}) {
  return render(<CarrouselPhotos photos={photos} titre="Aube" artiste="Marie Roux" gradient="" accentColor="" {...props} />)
}
const piste = () => document.querySelector('[aria-roledescription="carrousel"]') as HTMLElement

describe('CarrouselPhotos (navigateur)', () => {
  it('boutons et compteur : « 2/4 » après « suivante », « 1/4 » après « précédente »', async () => {
    const ecran = await monter()
    await expect.element(ecran.getByText(t.compteur(1, 4), { exact: true })).toBeVisible()
    await expect.element(ecran.getByRole('button', { name: t.precedente })).toBeDisabled()

    await ecran.getByRole('button', { name: t.suivante }).click()
    await expect.element(ecran.getByText(t.compteur(2, 4), { exact: true })).toBeVisible()
    await expect.element(ecran.getByText(t.legendes.face_lumiere_du_jour, { exact: true })).toBeVisible()

    await ecran.getByRole('button', { name: t.precedente }).click()
    await expect.element(ecran.getByText(t.compteur(1, 4), { exact: true })).toBeVisible()
  })

  it('flèches du clavier sur le carrousel, bornées aux extrémités', async () => {
    const ecran = await monter()
    piste().focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    await expect.element(ecran.getByText(t.compteur(3, 4), { exact: true })).toBeVisible()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    await expect.element(ecran.getByText(t.compteur(4, 4), { exact: true })).toBeVisible()
    await expect.element(ecran.getByRole('button', { name: t.suivante })).toBeDisabled()
    await userEvent.keyboard('{ArrowLeft}')
    await expect.element(ecran.getByText(t.compteur(3, 4), { exact: true })).toBeVisible()
  })

  it('le compteur suit le balayage natif (défilement de la piste)', async () => {
    const ecran = await monter()
    const el = piste()
    el.scrollTo({ left: el.clientWidth * 2, behavior: 'instant' })
    await expect.element(ecran.getByText(t.compteur(3, 4), { exact: true })).toBeVisible()
  })

  it('jamais de défilement automatique', async () => {
    // Aucune minuterie enregistrée par le composant (l'attente seule ne verrait pas une minuterie longue).
    const intervalles = vi.spyOn(window, 'setInterval')
    const delais = vi.spyOn(window, 'setTimeout')
    const ecran = await monter()
    expect(intervalles).not.toHaveBeenCalled()
    expect(delais.mock.calls.filter(([, ms]) => typeof ms === 'number' && ms >= 500)).toEqual([])
    intervalles.mockRestore()
    delais.mockRestore()
    await new Promise((r) => setTimeout(r, 1500))
    await expect.element(ecran.getByText(t.compteur(1, 4), { exact: true })).toBeVisible()
    expect(piste().scrollLeft).toBe(0)
  })

  it('une seule photo : ni compteur ni boutons', async () => {
    const ecran = await monter([PHOTOS[0]])
    await expect.element(ecran.getByRole('button', { name: t.agrandir })).toBeVisible()
    expect(ecran.getByRole('button', { name: t.suivante }).elements()).toHaveLength(0)
    expect(ecran.getByRole('button', { name: t.precedente }).elements()).toHaveLength(0)
    expect(document.body.textContent).not.toMatch(/\d\/\d/)
  })

  it('sans photo : repli sans compteur ni boutons', async () => {
    const ecran = await monter([])
    expect(ecran.getByRole('button', { name: t.suivante }).elements()).toHaveLength(0)
    expect(document.body.textContent).not.toMatch(/\d\/\d/)
  })

  it('plein écran : <dialog> ouvert, zoom borné, Échap ferme et rend le focus au déclencheur', async () => {
    const ecran = await monter()
    const declencheur = ecran.getByRole('button', { name: t.agrandir })
    await declencheur.click()

    const dialogue = document.querySelector('dialog') as HTMLDialogElement
    await vi.waitFor(() => expect(dialogue.open).toBe(true))
    expect(dialogue.matches(':modal')).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    const zone = () => dialogue.querySelector('div[style*="width"]') as HTMLElement
    expect(zone().style.width).toBe('100%')

    // La légende de la prise de vue est reprise avec le compteur.
    await expect.element(ecran.getByText(t.legendes.mise_en_situation + fr.commun.separateur + t.compteur(1, 4))).toBeVisible()

    const zoomer = ecran.getByRole('button', { name: t.zoomer, exact: true }).first()
    await expect.element(ecran.getByRole('button', { name: t.dezoomer }).first()).toBeDisabled()
    await zoomer.click()
    await vi.waitFor(() => expect(zone().style.width).toBe('200%'))
    await zoomer.click()
    await vi.waitFor(() => expect(zone().style.width).toBe('300%'))
    await expect.element(zoomer).toBeDisabled()
    await ecran.getByRole('button', { name: t.dezoomer }).first().click()
    await vi.waitFor(() => expect(zone().style.width).toBe('200%'))

    await userEvent.keyboard('{Escape}')
    await vi.waitFor(() => expect(dialogue.open).toBe(false))
    await expect.element(declencheur).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
  })

  it('plein écran : le bouton « Fermer » ferme, et la photo ouverte est celle affichée', async () => {
    const ecran = await monter()
    await ecran.getByRole('button', { name: t.suivante }).click()
    await ecran.getByRole('button', { name: t.agrandir }).click()
    const dialogue = document.querySelector('dialog') as HTMLDialogElement
    await vi.waitFor(() => expect(dialogue.open).toBe(true))
    expect(dialogue.querySelector('img')?.getAttribute('src')).toBe(PHOTOS[1].url)
    await ecran.getByRole('button', { name: t.fermer }).click()
    await vi.waitFor(() => expect(dialogue.open).toBe(false))
  })
})
