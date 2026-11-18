import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'

// Phrase d'échéance de la réservation (story 7.3) : fuseau de l'appareil forcé (Tokyo, UTC+9) et date
// du jour figée ; les heures attendues sont écrites en dur, sans recalcul avec les fonctions de formatage.
vi.mock('@/lib/i18n', async (original) => ({ ...(await original<typeof import('@/lib/i18n')>()), fuseauAppareil: () => 'Asia/Tokyo' }))
vi.mock('@/app/commande/coordonnees/actions', () => ({ reprendreReservation: vi.fn(), modifierMaCommande: vi.fn(), envoyerCoordonnees: vi.fn(), completerCoordonnees: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

const { ReservationHeureFixe } = await import('@/app/commande/coordonnees/ReservationHeureFixe')

afterEach(() => vi.useRealTimers())

describe('Phrase de réservation dans le fuseau de l’appareil', () => {
  it('le même jour : « Œuvres réservées pour vous jusqu’à 15 h 42. » (06 h 42 UTC = 15 h 42 à Tokyo)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-20T06:12:00Z'))
    const ecran = await render(<ReservationHeureFixe echeance="2026-11-20T06:42:00Z" echue={false} />)
    await vi.waitFor(() => expect(ecran.getByRole('status').element().textContent).toBe('Œuvres réservées pour vous jusqu’à 15 h 42.'))
  })

  it('terminée côté serveur : « Votre réservation a pris fin à 15 h 42. »', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-20T06:50:00Z'))
    const ecran = await render(<ReservationHeureFixe echeance="2026-11-20T06:42:00Z" echue={true} />)
    await vi.waitFor(() => expect(ecran.getByRole('status').element().textContent).toBe('Votre réservation a pris fin à 15 h 42.'))
  })

  it('un autre jour : la date s’ajoute (22 h UTC = 7 h le lendemain à Tokyo)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-20T06:00:00Z'))
    const ecran = await render(<ReservationHeureFixe echeance="2026-11-21T22:05:00Z" echue={false} />)
    await vi.waitFor(() => expect(ecran.getByRole('status').element().textContent).toBe('Œuvres réservées pour vous jusqu’au 22 novembre à 7 h 05.'))
  })
})
