import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LIBELLES_SELECTION, MESSAGES_REFUS_SELECTION, MESSAGES_RETOUR_SELECTION } from '@/lib/curation/selection-regles'

// Bascule « Sélection de l'accueil » dans un vrai navigateur : action serveur simulée (elle redirige
// vers la liste avec le résultat, que `RetourSelection` affiche).
const actionSelection = vi.fn()
vi.mock('@/app/dashboard/admin/oeuvres/actions', () => ({ actionSelection: (...a: unknown[]) => actionSelection(...a) }))

const { BasculeSelection, RetourSelection } = await import('@/app/dashboard/admin/oeuvres/BasculeSelection')

beforeEach(() => {
  actionSelection.mockReset().mockResolvedValue(undefined)
})

describe('BasculeSelection (navigateur)', () => {
  it('marquer : action appelée avec le slug et l’état voulu (vrai)', async () => {
    const ecran = await render(<BasculeSelection slug="aube" marquee={false} />)
    await ecran.getByRole('button', { name: LIBELLES_SELECTION.ajouter }).click()
    await vi.waitFor(() => expect(actionSelection).toHaveBeenCalledTimes(1))
    expect(actionSelection).toHaveBeenCalledWith('aube', true)
  })

  it('démarquer : action appelée avec le slug et l’état voulu (faux)', async () => {
    const ecran = await render(<BasculeSelection slug="aube" marquee />)
    await ecran.getByRole('button', { name: LIBELLES_SELECTION.dans }).click()
    await vi.waitFor(() => expect(actionSelection).toHaveBeenCalledTimes(1))
    expect(actionSelection).toHaveBeenCalledWith('aube', false)
  })
})

describe('RetourSelection (navigateur)', () => {
  it('annonce le résultat de la bascule (marquée, retirée)', async () => {
    const ecran = await render(<RetourSelection code="marquee" />)
    await expect.element(ecran.getByRole('status')).toHaveTextContent(MESSAGES_RETOUR_SELECTION.marquee)
    await ecran.rerender(<RetourSelection code="retiree_selection" />)
    await expect.element(ecran.getByRole('status')).toHaveTextContent(MESSAGES_RETOUR_SELECTION.retiree_selection)
  })

  it('affiche chaque refus de l’action', async () => {
    const ecran = await render(<RetourSelection code="non_publiee" />)
    for (const [code, message] of Object.entries(MESSAGES_REFUS_SELECTION)) {
      await ecran.rerender(<RetourSelection code={code} />)
      await expect.element(ecran.getByRole('status')).toHaveTextContent(message)
    }
  })

  it('rien pour un code inconnu ou absent', async () => {
    const ecran = await render(<RetourSelection code="inconnu" />)
    expect(ecran.getByRole('status').elements()).toHaveLength(0)
    await ecran.rerender(<RetourSelection code={undefined} />)
    expect(ecran.getByRole('status').elements()).toHaveLength(0)
  })
})
