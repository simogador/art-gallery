import type { Metadata } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import { Header, Footer } from '@/components/layout'
import { auth } from '@/auth'
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
