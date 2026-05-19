import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Ma wishlist' }

export default async function WishlistPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/connexion')

  return (
    <div className="min-h-screen bg-background pt-28 pb-24">
      <div className="container-premium max-w-4xl">

        <div className="mb-12">
          <nav className="flex items-center gap-2 font-sans text-xs text-neutral-400 uppercase tracking-widest mb-8">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Mon espace</Link>
            <span>›</span>
            <span className="text-foreground">Wishlist</span>
          </nav>
          <span className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-4 block">Collection personnelle</span>
          <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
            Ma wishlist
          </h1>
          <div className="divider mt-4" />
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-32 border border-dashed border-neutral-200 rounded-sm text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-300 mb-6" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <p className="font-serif text-xl font-light text-neutral-400">Votre wishlist est vide</p>
          <p className="font-sans text-sm text-neutral-400 mt-2 max-w-xs text-pretty">
            Sauvegardez des œuvres depuis la galerie pour les retrouver ici.
          </p>
          <Link
            href="/galerie"
            className="mt-8 inline-flex items-center gap-2 font-sans text-xs uppercase tracking-widest text-foreground border border-neutral-200 rounded-sm px-6 py-3 hover:border-foreground transition-colors duration-300"
          >
            Explorer la collection
          </Link>
        </div>
      </div>
    </div>
  )
}
