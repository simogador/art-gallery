import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { CartContent } from './CartContent'

export const metadata: Metadata = { title: 'Mon panier' }

export default async function PanierPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/connexion')

  return (
    <div className="min-h-screen bg-background pt-28 pb-24">
      <div className="container-premium max-w-4xl">

        <div className="mb-12">
          <nav className="flex items-center gap-2 font-sans text-xs text-neutral-400 uppercase tracking-widest mb-8">
            <Link href="/" className="hover:text-foreground transition-colors">Accueil</Link>
            <span aria-hidden="true">›</span>
            <span className="text-foreground">Panier</span>
          </nav>
          <span className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-4 block">Acquisition</span>
          <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
            Mon panier
          </h1>
          <div className="divider mt-4" />
        </div>

        <CartContent />

      </div>
    </div>
  )
}
