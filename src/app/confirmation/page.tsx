import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getStripe } from '@/lib/stripe'
import { ARTWORKS } from '@/data/artworks'
import { formatPrice } from '@/lib/utils/artworks'
import { CartClearer } from './CartClearer'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = { title: 'Acquisition confirmée' }

interface Props {
  searchParams: Promise<{ session_id?: string }>
}

export default async function ConfirmationPage({ searchParams }: Props) {
  const { session_id } = await searchParams

  if (!session_id) redirect('/')

  let session
  try {
    session = await getStripe().checkout.sessions.retrieve(session_id)
  } catch {
    notFound()
  }

  if (session.payment_status !== 'paid') {
    redirect('/panier')
  }

  const artworkIds = (session.metadata?.artworkIds ?? '').split(',').filter(Boolean)
  const artworks   = artworkIds.map((id) => ARTWORKS.find((a) => a.id === id)).filter(Boolean)
  const total      = (session.amount_total ?? 0) / 100
  const reference  = session_id.slice(-8).toUpperCase()

  return (
    <>
      {/* Vide le panier côté client après paiement */}
      <CartClearer />

      <div className="min-h-screen bg-background pt-28 pb-24">
        <div className="container-premium max-w-2xl">

          {/* ── En-tête succès ── */}
          <div className="text-center mb-14">
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center">
                  <CheckIcon />
                </div>
                <div className="absolute inset-0 rounded-full border border-gold/30 animate-ping opacity-30" />
              </div>
            </div>

            <p className="font-sans text-xs uppercase tracking-[0.3em] text-gold mb-4">
              Paiement accepté
            </p>
            <h1
              className="font-serif font-light text-foreground"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
            >
              Acquisition confirmée
            </h1>
            <p className="font-sans text-sm text-neutral-500 mt-4 max-w-md mx-auto text-pretty">
              Merci pour votre confiance. Notre équipe prendra contact avec vous dans les 24h ouvrées
              pour organiser la livraison assurée de {artworks.length > 1 ? 'vos œuvres' : 'votre œuvre'}.
            </p>

            <div className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-sm">
              <span className="font-sans text-[10px] uppercase tracking-widest text-neutral-400">Référence</span>
              <span className="font-sans text-xs font-medium text-foreground tracking-widest">#{reference}</span>
            </div>
          </div>

          <div className="divider mb-12" />

          {/* ── Récapitulatif commande ── */}
          <section className="mb-12">
            <h2 className="font-sans text-xs uppercase tracking-[0.25em] text-neutral-400 mb-6">
              {artworks.length > 1 ? 'Œuvres acquises' : 'Œuvre acquise'}
            </h2>

            <div className="flex flex-col gap-4">
              {artworks.map((artwork) => {
                if (!artwork) return null
                const seed = artwork.id
                const h    = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
                const size = 56
                const r1   = size * 0.35 + (h % (size * 0.1))
                const r2   = r1 * 0.6
                const cx   = size / 2
                const cy   = size / 2

                return (
                  <div
                    key={artwork.id}
                    className="flex items-center gap-4 p-4 border border-neutral-200 rounded-sm"
                  >
                    {/* Thumbnail */}
                    <div className={cn(
                      'w-14 h-18 flex-shrink-0 rounded-sm overflow-hidden flex items-center justify-center',
                      'bg-gradient-to-br', artwork.gradient,
                    )} style={{ height: '4.5rem' }}>
                      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true">
                        <circle cx={cx} cy={cy} r={r1} stroke={artwork.accentColor} strokeWidth="0.8" opacity="0.6" />
                        <circle cx={cx} cy={cy} r={r2} stroke={artwork.accentColor} strokeWidth="0.5" opacity="0.4" />
                        <line x1={cx - r1} y1={cy} x2={cx + r1} y2={cy} stroke={artwork.accentColor} strokeWidth="0.4" opacity="0.35" />
                        <line x1={cx} y1={cy - r1} x2={cx} y2={cy + r1} stroke={artwork.accentColor} strokeWidth="0.4" opacity="0.35" />
                        <circle cx={cx} cy={cy} r={3} fill={artwork.accentColor} opacity="0.5" />
                      </svg>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-serif text-base font-light text-foreground truncate">{artwork.title}</p>
                      <p className="font-sans text-xs text-neutral-400 uppercase tracking-widest mt-0.5 truncate">
                        {artwork.artist} · {artwork.year}
                      </p>
                    </div>

                    {/* Prix */}
                    <p className="font-serif text-base font-light text-foreground flex-shrink-0">
                      {formatPrice(artwork.price)}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-200">
              <span className="font-sans text-xs uppercase tracking-widest text-neutral-500">Total payé</span>
              <span className="font-serif text-xl font-light text-foreground">{formatPrice(total)}</span>
            </div>
          </section>

          {/* ── Informations livraison ── */}
          <section className="mb-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: <TruckIcon />,
                title: 'Livraison assurée',
                desc: 'Transport spécialisé œuvres d\'art, assuré à 100 % de la valeur.',
              },
              {
                icon: <CertIcon />,
                title: 'Certificat inclus',
                desc: 'Certificat d\'authenticité numéroté et signé par l\'artiste.',
              },
              {
                icon: <MailIcon />,
                title: 'Confirmation par email',
                desc: 'Un récapitulatif complet vous a été envoyé par email.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex flex-col gap-2 p-4 bg-neutral-50 border border-neutral-100 rounded-sm">
                <span className="text-gold">{icon}</span>
                <p className="font-sans text-xs font-medium text-foreground uppercase tracking-widest">{title}</p>
                <p className="font-sans text-xs text-neutral-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </section>

          {/* ── Actions ── */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/galerie"
              className={cn(
                'inline-flex items-center justify-center gap-2',
                'px-8 py-4 rounded-sm',
                'font-sans text-xs uppercase tracking-widest',
                'bg-foreground text-background',
                'hover:bg-neutral-700 transition-colors duration-300',
              )}
            >
              Continuer à explorer
            </Link>
            <Link
              href="/"
              className={cn(
                'inline-flex items-center justify-center gap-2',
                'px-8 py-4 rounded-sm',
                'font-sans text-xs uppercase tracking-widest',
                'border border-neutral-200 text-foreground',
                'hover:border-foreground transition-colors duration-300',
              )}
            >
              Retour à l&apos;accueil
            </Link>
          </div>

        </div>
      </div>
    </>
  )
}

/* ─── Icons ───────────────────────────────────────────────────────────────── */

function CheckIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className="text-gold" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
    </svg>
  )
}

function CertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15l-2 5-3-3-5 2 2-5-3-3 5-2 2-5 3 3 5-2-2 5zM15 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}
