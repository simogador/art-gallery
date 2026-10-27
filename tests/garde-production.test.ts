import { describe, expect, it } from 'vitest'
import { ecritureInterdite, identifiantBase } from '@/lib/garde-production'

const URL_PROD = 'postgresql://u:p@ep-cool-name-123456-pooler.eu-central-1.aws.neon.tech/neondb'

describe('garde de production', () => {
  it("tire l'identifiant d'endpoint de l'URL", () => {
    expect(identifiantBase(URL_PROD)).toBe('ep-cool-name-123456')
    expect(identifiantBase('postgresql://u@localhost:5432/x')).toBe('localhost')
    expect(identifiantBase('pas une url')).toBeNull()
    expect(identifiantBase(undefined)).toBeNull()
  })

  it('interdit l’écriture hors production quand DATABASE_URL vise la production', () => {
    expect(ecritureInterdite({ DATABASE_PRODUCTION_ID: 'ep-cool-name-123456', DATABASE_URL: URL_PROD })).toBe(true)
    expect(
      ecritureInterdite({ VERCEL_ENV: 'preview', DATABASE_PRODUCTION_ID: 'ep-cool-name-123456', DATABASE_URL: URL_PROD }),
    ).toBe(true)
  })

  it('reconnaît un identifiant saisi en majuscules, avec -pooler ou en hôte complet', () => {
    const id = ' EP-Cool-Name-123456-pooler.eu-central-1.aws.neon.tech '
    expect(ecritureInterdite({ DATABASE_PRODUCTION_ID: id, DATABASE_URL: URL_PROD })).toBe(true)
  })

  it('autorise la production, une autre base, ou l’absence de variable', () => {
    expect(
      ecritureInterdite({ VERCEL_ENV: 'production', DATABASE_PRODUCTION_ID: 'ep-cool-name-123456', DATABASE_URL: URL_PROD }),
    ).toBe(false)
    expect(ecritureInterdite({ DATABASE_PRODUCTION_ID: 'ep-autre-999', DATABASE_URL: URL_PROD })).toBe(false)
    expect(ecritureInterdite({ DATABASE_URL: URL_PROD })).toBe(false)
  })
})
