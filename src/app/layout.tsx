import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Header, Footer } from '@/components/layout'
import { auth } from '@/auth'
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
  return (
    <html lang="fr" className={`${cormorant.variable} ${inter.variable}`}>
      <body>
        <Header session={session} />
        {children}
        <Footer />
      </body>
    </html>
  )
}
