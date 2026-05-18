import type { Metadata } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import { Header, Footer } from '@/components/layout'
import '@/styles/globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${cormorant.variable} ${inter.variable}`}>
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  )
}
