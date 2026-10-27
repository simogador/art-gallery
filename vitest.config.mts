import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

// TEST_DATABASE_URL peut venir de .env.local, comme pour la CLI Prisma.
config({ path: '.env.local', quiet: true })

export default defineConfig({
  // tsconfig garde jsx: preserve pour Next.js ; les tests compilent le JSX eux-mêmes.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Chaque fichier crée et migre sa propre base : plus lent qu'un test unitaire.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
})
