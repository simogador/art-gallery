import { existsSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '@/lib/i18n'
import { lot2Ouvert } from '@/lib/reglages'

// Story 1.7 (AD-17) : l'interrupteur du Lot 2. Story 7.9 : l'ancien chemin d'achat n'existe plus.

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }) }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirection:${url}`)
  },
  notFound: () => {
    throw new Error('introuvable')
  },
}))

describe('lot2Ouvert', () => {
  it('n’ouvre le Lot 2 que si LOT2_OUVERT vaut « oui »', () => {
    expect(lot2Ouvert({})).toBe(false)
    expect(lot2Ouvert({ LOT2_OUVERT: 'non' })).toBe(false)
    expect(lot2Ouvert({ LOT2_OUVERT: 'true' })).toBe(false)
    expect(lot2Ouvert({ LOT2_OUVERT: '' })).toBe(false)
    expect(lot2Ouvert({ LOT2_OUVERT: 'oui' })).toBe(true)
    expect(lot2Ouvert({ LOT2_OUVERT: ' OUI ' })).toBe(true)
  })
})

describe('ancien chemin d’achat retiré (story 7.9)', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('/api/checkout, le webhook de paiement et le client du prestataire n’existent plus', () => {
    for (const chemin of ['src/app/api/checkout/route.ts', 'src/app/api/webhooks/stripe/route.ts', 'src/lib/stripe.ts']) {
      expect(existsSync(path.resolve(chemin)), chemin).toBe(false)
    }
  })

  it.each(['', 'oui'])('la page de confirmation n’appelle aucun prestataire (LOT2_OUVERT=%j)', async (valeur) => {
    vi.stubEnv('LOT2_OUVERT', valeur)
    const { default: Confirmation } = await import('@/app/confirmation/page')
    // Un ancien `?session_id=` est ignoré.
    const page = await (Confirmation as unknown as (p: unknown) => Promise<unknown>)({ searchParams: Promise.resolve({ session_id: 'cs_1' }) })
    const html = renderToStaticMarkup(page as never)
    expect(html).toContain(valeur === 'oui' ? fr.confirmation.inactif.titre : fr.confirmation.ferme.titre)
  })
})
