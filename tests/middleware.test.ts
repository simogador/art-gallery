import { afterEach, describe, expect, it, vi } from 'vitest'

// Le middleware appelle maintenanceActive() de reglages : comportement vérifié en l'exécutant (sans
// lire son texte source). `next-auth` est réduit à un passe-plat : le gestionnaire reçoit la requête.
vi.mock('next-auth', () => ({ default: () => ({ auth: (gestionnaire: unknown) => gestionnaire }) }))

type Requete = { auth: { user: { role: string } } | null; nextUrl: URL }
const requete = (chemin: string, role: string | null = null): Requete => ({
  auth: role ? { user: { role } } : null,
  nextUrl: new URL(chemin, 'https://www.errancy.art'),
})
const appeler = async (r: Requete) => {
  const { default: middleware } = await import('@/middleware')
  return (middleware as unknown as (r: Requete) => Response)(r)
}

afterEach(() => vi.unstubAllEnvs())

describe('middleware : maintenance (story 3.8, règle partagée avec le sitemap)', () => {
  it.each([
    [{ MAINTENANCE_MODE: 'on' }, true],
    [{ VERCEL_ENV: 'production' }, true],
    [{ VERCEL_ENV: 'production', MAINTENANCE_MODE: 'off' }, false],
    [{ VERCEL_ENV: 'preview', MAINTENANCE_MODE: 'on' }, true],
    [{ VERCEL_ENV: 'preview' }, false],
    [{}, false],
  ])('environnement %j : page de maintenance pour un visiteur = %s', async (env, maintenance) => {
    vi.stubEnv('MAINTENANCE_MODE', '')
    vi.stubEnv('VERCEL_ENV', '')
    for (const [cle, valeur] of Object.entries(env)) vi.stubEnv(cle, valeur)
    const reponse = await appeler(requete('/galerie'))
    expect(reponse.headers.get('x-middleware-rewrite')?.endsWith('/maintenance.html') ?? false).toBe(maintenance)
    if (!maintenance) expect(reponse.headers.get('x-middleware-next')).toBe('1')
  })

  it('maintenance active : un admin passe, un artiste seulement dans son espace', async () => {
    vi.stubEnv('MAINTENANCE_MODE', 'on')
    expect((await appeler(requete('/galerie', 'admin'))).headers.get('x-middleware-rewrite')).toBeNull()
    expect((await appeler(requete('/galerie', 'artist'))).headers.get('x-middleware-rewrite')).not.toBeNull()
    expect((await appeler(requete('/dashboard/artiste', 'artist'))).headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('hors maintenance : pages protégées renvoyées vers la connexion sans session', async () => {
    vi.stubEnv('MAINTENANCE_MODE', 'off')
    const reponse = await appeler(requete('/dashboard/artiste'))
    expect(reponse.status).toBe(307)
    expect(new URL(reponse.headers.get('location')!).pathname).toBe('/auth/connexion')
  })
})
