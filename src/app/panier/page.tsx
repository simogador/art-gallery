import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Mon panier' }

export default async function PanierPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/connexion')

  return (
    <div className="min-h-screen bg-background pt-28 pb-24">
      <div className="container-premium max-w-4xl">

        <div className="mb-12">
          <nav className="flex items-center gap-2 font-sans text-xs text-neutral-400 uppercase tracking-widest mb-8">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Mon espace</Link>
            <span>›</span>
            <span className="text-foreground">Panier</span>
          </nav>
          <span className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-4 block">Acquisition</span>
          <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
            Mon panier
          </h1>
          <div className="divider mt-4" />
        </div>

        {/* Empty state */}
        <div className="grid md:grid-cols-[1fr_320px] gap-8 items-start">
          <div className="flex flex-col items-center justify-center py-32 border border-dashed border-neutral-200 rounded-sm text-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-300 mb-6" aria-hidden="true">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <p className="font-serif text-xl font-light text-neutral-400">Votre panier est vide</p>
            <p className="font-sans text-sm text-neutral-400 mt-2 max-w-xs text-pretty">
              Ajoutez des œuvres à votre panier depuis la galerie ou votre wishlist.
            </p>
            <Link
              href="/galerie"
              className="mt-8 inline-flex items-center gap-2 font-sans text-xs uppercase tracking-widest text-foreground border border-neutral-200 rounded-sm px-6 py-3 hover:border-foreground transition-colors duration-300"
            >
              Explorer la collection
            </Link>
          </div>

          {/* Order summary */}
          <div className="border border-neutral-200 rounded-sm">
            <div className="px-6 py-4 border-b border-neutral-100">
              <p className="font-sans text-xs uppercase tracking-widest text-neutral-400">Récapitulatif</p>
            </div>
            <div className="px-6 py-6 space-y-4">
              {[
                { label: 'Sous-total',  value: '—' },
                { label: 'Transport',   value: 'Offert' },
                { label: 'Assurance',   value: 'Incluse' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="font-sans text-xs text-neutral-500">{label}</span>
                  <span className="font-sans text-sm text-foreground">{value}</span>
                </div>
              ))}
              <div className="pt-4 border-t border-neutral-200 flex items-center justify-between">
                <span className="font-sans text-xs uppercase tracking-widest text-foreground">Total</span>
                <span className="font-serif text-xl font-light text-foreground">—</span>
              </div>
            </div>
            <div className="px-6 pb-6">
              <button
                disabled
                className="w-full py-3.5 bg-neutral-100 text-neutral-400 font-sans text-xs uppercase tracking-widest rounded-sm cursor-not-allowed"
              >
                Procéder au paiement
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
