import { URL_SITE, lot2Ouvert } from '@/lib/reglages'
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Header, Footer, MouvementReduit } from '@/components/layout'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { BoutonConseil } from '@/components/ui/BoutonConseil'
import { ChoixMesure } from '@/components/ui/ChoixMesure'
import { UniteProvider } from '@/components/ui/UniteToggle'
import { COOKIE_UNITE, lireUnite } from '@/lib/i18n'
import { COOKIE_CHOIX, lireChoix } from '@/lib/mesure/regles'
import '@/styles/globals.css'

// Polices hébergées dans le projet (src/app/fonts, licence SIL OFL) : le build ne dépend plus
// de Google Fonts. Sous-ensemble latin et graisses identiques à l'ancien next/font/google.
const cormorant = localFont({
  src: [
    { path: './fonts/cormorant-garamond-latin-300-normal.woff2', weight: '300', style: 'normal' },
    { path: './fonts/cormorant-garamond-latin-300-italic.woff2', weight: '300', style: 'italic' },
    { path: './fonts/cormorant-garamond-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/cormorant-garamond-latin-400-italic.woff2', weight: '400', style: 'italic' },
    { path: './fonts/cormorant-garamond-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/cormorant-garamond-latin-500-italic.woff2', weight: '500', style: 'italic' },
    { path: './fonts/cormorant-garamond-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/cormorant-garamond-latin-600-italic.woff2', weight: '600', style: 'italic' },
    { path: './fonts/cormorant-garamond-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: './fonts/cormorant-garamond-latin-700-italic.woff2', weight: '700', style: 'italic' },
  ],
  variable: '--font-cormorant',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
  adjustFontFallback: 'Times New Roman',
})

const inter = localFont({
  src: [
    { path: './fonts/inter-latin-300-normal.woff2', weight: '300', style: 'normal' },
    { path: './fonts/inter-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/inter-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/inter-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})

export const metadata: Metadata = {
  // Story 3.8 : base des adresses relatives (canoniques, images de partage), jamais la requête.
  metadataBase: new URL(URL_SITE),
  title: {
    default: "Galerie d'Art Premium",
    template: "%s | Galerie d'Art",
  },
  description: "Une galerie d'art contemporain d'exception — œuvres sélectionnées, artistes émergents et établis.",
  keywords: ["galerie art", "art contemporain", "œuvres d'art", "artistes"],
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: "Galerie d'Art Premium",
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  // Story 3.2 : unité des dimensions mémorisée sur l'appareil (cookie absent ou invalide : cm).
  const unite = lireUnite(cookies().get(COOKIE_UNITE)?.value)
  // Story 4.8 : choix de mesure lu dans le cookie (absent : la bannière non bloquante le propose).
  const choixMesure = lireChoix(cookies().get(COOKIE_CHOIX)?.value)
  return (
    <html lang="fr" className={`${cormorant.variable} ${inter.variable}`}>
      <body>
        {/* Story 3.1 (UX-DR3) : premier élément focalisable de chaque page, visible au focus. */}
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[100] focus:inline-flex focus:items-center focus:min-h-touch-target focus:px-4 focus:bg-foreground focus:text-background focus:font-sans focus:text-button focus:rounded-sm"
        >
          Aller au contenu
        </a>
        <MouvementReduit>
          <UniteProvider initiale={unite}>
            <Header session={session} lot2Ouvert={lot2Ouvert()} />
            <main id="contenu" tabIndex={-1}>
              {children}
            </main>
            <Footer conseil={<BoutonConseil surSombre />} />
            <ChoixMesure choix={choixMesure} />
          </UniteProvider>
        </MouvementReduit>
      </body>
    </html>
  )
}
