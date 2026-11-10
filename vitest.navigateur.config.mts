import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

// Tests d'interactions dans un vrai navigateur (rétrospective de l'epic 3, action A2) : composants
// isolés, actions serveur et routeur simulés, aucun réseau externe. `npm test` (serveur, PostgreSQL)
// ne lit pas ces fichiers. Chromium vient de `npx playwright install chromium` ; hors CI, on peut
// désigner un Chrome déjà installé avec NAVIGATEUR_EXECUTABLE.
const executable = process.env.NAVIGATEUR_EXECUTABLE

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // `next/image` : balise `img` simple (pas de /_next/image dans un composant isolé).
      { find: /^next\/image$/, replacement: fileURLToPath(new URL('./tests/navigateur/utils/next-image.tsx', import.meta.url)) },
    ],
  },
  // Évite le rechargement de Vite au premier lancement (dépendances optimisées à la volée).
  optimizeDeps: { include: ['react/jsx-dev-runtime', 'react-dom', 'react-dom/client', 'vitest-browser-react'] },
  // Certains modules importés par les composants (en-tête) lisent process.env : absent dans le navigateur.
  define: { 'process.env': '{}' },
  test: {
    include: ['tests/navigateur/**/*.test.tsx'],
    testTimeout: 15_000,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        launchOptions: executable ? { executablePath: executable, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] },
      }),
      instances: [{ browser: 'chromium' }],
    },
  },
})
