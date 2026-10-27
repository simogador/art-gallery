import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Story 1.6 (AD-1) : la règle ESLint qui réserve la base aux modules métier, et le contrôle
// CI qui empêche la liste d'exceptions de grandir.

type Message = { ruleId: string | null }
type Linter = { lintText(code: string, options: { filePath: string }): Promise<{ messages: Message[] }[]> }
// eslint 8 ne fournit pas de types : chargement par require.
const { ESLint } = createRequire(import.meta.url)('eslint') as { ESLint: new () => Linter }
const eslint = new ESLint()

async function refuse(fichier: string, code: string): Promise<boolean> {
  const [resultat] = await eslint.lintText(code, { filePath: path.resolve(fichier) })
  return resultat.messages.some((m) => m.ruleId === 'no-restricted-imports')
}

describe('règle AD-1 : accès à la base', () => {
  it.each([
    "import { prisma } from '@/lib/prisma'",
    "import { PrismaClient } from '@/generated/prisma/client'",
    "import { prisma } from '../../lib/prisma'",
    "import type { Artist } from '../../generated/prisma/client'",
    "import { PrismaClient } from '@prisma/client'",
    "import { PrismaPg } from '@prisma/adapter-pg'",
    "import { Pool } from 'pg'",
  ])('refuse « %s » dans une page', async (code) => {
    expect(await refuse('src/app/essai/page.tsx', code)).toBe(true)
  })

  it('refuse un nouveau fichier de route dynamique, absent des exceptions', async () => {
    expect(await refuse('src/app/essai/[id]/page.tsx', "import { prisma } from '@/lib/prisma'")).toBe(true)
  })

  it('refuse les dossiers de src/lib qui ne sont pas des modules métier', async () => {
    expect(await refuse('src/lib/store/essai.ts', "import { prisma } from '../prisma'")).toBe(true)
    expect(await refuse('src/lib/essai.ts', "import { prisma } from './prisma'")).toBe(true)
  })

  it('accepte les modules métier, src/auth.ts et les exceptions existantes', async () => {
    const code = "import { prisma } from '@/lib/prisma'"
    expect(await refuse('src/lib/catalogue/essai.ts', code)).toBe(false)
    expect(await refuse('src/lib/db/essai.ts', code)).toBe(false)
    expect(await refuse('src/auth.ts', code)).toBe(false)
    expect(await refuse('src/app/api/checkout/route.ts', code)).toBe(false)
  })
})

describe('liste d’exceptions : ne fait que diminuer', () => {
  const script = path.resolve('scripts/verifier-exceptions-prisma.cjs')

  function depot(entrees: string[]) {
    const dossier = mkdtempSync(path.join(tmpdir(), 'exceptions-depot-'))
    const git = (...args: string[]) => execFileSync('git', args, { cwd: dossier, stdio: 'ignore' })
    git('init', '-q')
    mkdirSync(path.join(dossier, 'eslint'))
    const ecrire = (contenu: string) => writeFileSync(path.join(dossier, 'eslint/exceptions-prisma.cjs'), contenu)
    ecrire(`module.exports = ${JSON.stringify(entrees)}\n`)
    git('add', '.')
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base')
    const verifier = () => spawnSync('node', [script, 'HEAD'], { cwd: dossier }).status
    return { dossier, ecrire, verifier }
  }

  it('accepte une liste raccourcie ou supprimée, refuse tout ajout', () => {
    const d = depot(['src/a.ts', 'src/b.ts'])
    try {
      d.ecrire("module.exports = ['src/a.ts']\n")
      expect(d.verifier()).toBe(0)
      d.ecrire('module.exports = ["src/a.ts", "src/b.ts", "src/c.ts"]\n')
      expect(d.verifier()).toBe(1)
      rmSync(path.join(d.dossier, 'eslint/exceptions-prisma.cjs'))
      expect(d.verifier()).toBe(0)
    } finally {
      rmSync(d.dossier, { recursive: true, force: true })
    }
  })
})
