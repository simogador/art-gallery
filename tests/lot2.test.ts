import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { auth } from '@/auth'
import { lot2Ouvert } from '@/lib/reglages'

// Story 1.7 (AD-17) : l'interrupteur du Lot 2 ferme le chemin d'achat actuel.

const creerSession = vi.fn()
const recupererSession = vi.fn()

vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'u1', email: 'a@exemple.test' } })) }))
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({ checkout: { sessions: { create: creerSession, retrieve: recupererSession } } }),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    artwork: {
      findMany: vi.fn(async () => [
        {
          slug: 'oeuvre-1',
          title: 'Œuvre 1',
          available: true,
          price: 1200,
          year: 2020,
          medium: 'Huile',
          artist: { name: 'Artiste' },
        },
      ]),
    },
  },
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirection:${url}`)
  },
  notFound: () => {
    throw new Error('introuvable')
  },
}))

function requetePanier() {
  return new Request('http://localhost/api/checkout', {
    method: 'POST',
    body: JSON.stringify({ items: [{ id: 'oeuvre-1' }] }),
  })
}

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

describe('chemin d’achat actuel', () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset().mockResolvedValue({ user: { id: 'u1', email: 'a@exemple.test' } } as never)
    creerSession.mockReset().mockResolvedValue({ url: 'https://paiement.exemple.test/s' })
    recupererSession.mockReset().mockResolvedValue({ payment_status: 'paid', metadata: {}, amount_total: 0 })
  })
  afterEach(() => vi.unstubAllEnvs())

  describe('Lot 2 fermé', () => {
    beforeEach(() => vi.stubEnv('LOT2_OUVERT', ''))

    it('POST /api/checkout refuse aussi quand LOT2_OUVERT est absente (défaut de production)', async () => {
      vi.stubEnv('LOT2_OUVERT', undefined)
      const { POST } = await import('@/app/api/checkout/route')
      const reponse = await POST(requetePanier() as never)
      expect(reponse.status).toBe(403)
      expect(creerSession).not.toHaveBeenCalled()
    })

    it('refuse avant même de vérifier la connexion', async () => {
      vi.mocked(auth).mockResolvedValue(null as never)
      const { POST } = await import('@/app/api/checkout/route')
      expect((await POST(requetePanier() as never)).status).toBe(403)
    })

    it('POST /api/checkout refuse sans créer de session de paiement', async () => {
      const { POST } = await import('@/app/api/checkout/route')
      const reponse = await POST(requetePanier() as never)
      expect(reponse.status).toBe(403)
      expect(await reponse.json()).toMatchObject({ code: 'lot2_ferme' })
      expect(creerSession).not.toHaveBeenCalled()
    })

    it('la page de confirmation n’appelle pas le prestataire', async () => {
      const { default: Confirmation } = await import('@/app/confirmation/page')
      await expect(Confirmation({ searchParams: Promise.resolve({ session_id: 'cs_1' }) })).rejects.toThrow(
        'redirection:/panier',
      )
      expect(recupererSession).not.toHaveBeenCalled()
    })
  })

  describe('Lot 2 ouvert (comportement actuel inchangé)', () => {
    beforeEach(() => vi.stubEnv('LOT2_OUVERT', 'oui'))

    it('POST /api/checkout crée la session de paiement', async () => {
      const { POST } = await import('@/app/api/checkout/route')
      const reponse = await POST(requetePanier() as never)
      expect(reponse.status).toBe(200)
      expect(await reponse.json()).toEqual({ url: 'https://paiement.exemple.test/s' })
      expect(creerSession).toHaveBeenCalledOnce()
    })

    it('la page de confirmation interroge le prestataire', async () => {
      const { default: Confirmation } = await import('@/app/confirmation/page')
      await Confirmation({ searchParams: Promise.resolve({ session_id: 'cs_1' }) })
      expect(recupererSession).toHaveBeenCalledWith('cs_1')
    })
  })
})
