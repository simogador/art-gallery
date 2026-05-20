'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui'
import { useCartStore, type CartItem } from '@/lib/store/cart'
import { formatPrice } from '@/lib/utils/artworks'

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

export function CartContent() {
  const [mounted,         setMounted]         = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError,   setCheckoutError]   = useState<string | null>(null)
  const { items, removeItem, total } = useCartStore()

  useEffect(() => { setMounted(true) }, [])

  async function handleCheckout() {
    setCheckoutError(null)
    setCheckoutLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur lors du paiement')
      window.location.href = data.url
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Erreur inattendue')
      setCheckoutLoading(false)
    }
  }

  if (!mounted) return <CartSkeleton />

  if (items.length === 0) return <EmptyCart />

  return (
    <div className="grid md:grid-cols-[1fr_320px] gap-8 items-start">

      {/* ── Items list ── */}
      <div className="flex flex-col gap-4">
        <AnimatePresence initial={false}>
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, x: -20, transition: { duration: 0.25 } }}
              layout
            >
              <CartItemRow item={item} onRemove={() => removeItem(item.id)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Order summary ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="border border-neutral-200 rounded-sm sticky top-28"
      >
        <div className="px-6 py-4 border-b border-neutral-100">
          <p className="font-sans text-xs uppercase tracking-widest text-neutral-400">Récapitulatif</p>
        </div>

        <div className="px-6 py-6 space-y-4">
          {[
            { label: 'Sous-total',  value: formatPrice(total()) },
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
            <span className="font-serif text-xl font-light text-foreground">{formatPrice(total())}</span>
          </div>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-3">
          {checkoutError && (
            <p className="font-sans text-xs text-red-500 text-center">{checkoutError}</p>
          )}
          <Button
            variant="gold"
            size="md"
            fullWidth
            loading={checkoutLoading}
            onClick={handleCheckout}
            rightIcon={checkoutLoading ? undefined : <ArrowIcon />}
          >
            {checkoutLoading ? 'Redirection…' : 'Procéder au paiement'}
          </Button>
          <p className="font-sans text-[10px] text-neutral-400 text-center leading-relaxed">
            Paiement sécurisé · SSL · Remboursement 14j
          </p>
        </div>
      </motion.div>
    </div>
  )
}

/* ─── Cart item row ───────────────────────────────────────────────────────── */

function CartItemRow({ item, onRemove }: { item: CartItem; onRemove: () => void }) {
  const seed = item.id
  const h = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const size = 56
  const r1 = size * 0.35 + (h % (size * 0.1))
  const r2 = r1 * 0.6
  const cx = size / 2
  const cy = size / 2

  return (
    <div className={cn(
      'flex items-start gap-4 p-4',
      'border border-neutral-200 rounded-sm',
      'hover:border-neutral-300 transition-colors duration-200',
    )}>
      {/* Artwork thumbnail */}
      <Link href={`/galerie/${item.id}`} className="flex-shrink-0 group" aria-label={item.title}>
        <div className={cn(
          'w-16 h-20 rounded-sm overflow-hidden flex items-center justify-center',
          'bg-gradient-to-br', item.gradient,
          'group-hover:opacity-80 transition-opacity duration-200',
        )}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true">
            <circle cx={cx} cy={cy} r={r1} stroke={item.accentColor} strokeWidth="0.8" opacity="0.6" />
            <circle cx={cx} cy={cy} r={r2} stroke={item.accentColor} strokeWidth="0.5" opacity="0.4" />
            <line x1={cx - r1} y1={cy} x2={cx + r1} y2={cy} stroke={item.accentColor} strokeWidth="0.4" opacity="0.35" />
            <line x1={cx} y1={cy - r1} x2={cx} y2={cy + r1} stroke={item.accentColor} strokeWidth="0.4" opacity="0.35" />
            <circle cx={cx} cy={cy} r={3} fill={item.accentColor} opacity="0.5" />
          </svg>
        </div>
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link href={`/galerie/${item.id}`} className="group">
          <h3 className="font-serif text-base font-light text-foreground group-hover:text-gold transition-colors duration-300 truncate">
            {item.title}
          </h3>
        </Link>
        <Link href={`/artistes/${item.artistId}`} className="font-sans text-xs text-neutral-400 uppercase tracking-widest hover:text-foreground transition-colors duration-200 mt-0.5 block truncate">
          {item.artist}
        </Link>
        <p className="font-serif text-lg font-light text-foreground mt-3">
          {formatPrice(item.price)}
        </p>
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        aria-label={`Retirer ${item.title} du panier`}
        className="flex-shrink-0 p-1.5 text-neutral-300 hover:text-red-400 transition-colors duration-200 rounded-sm"
      >
        <TrashIcon />
      </button>
    </div>
  )
}

/* ─── Empty state ─────────────────────────────────────────────────────────── */

function EmptyCart() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-32 border border-dashed border-neutral-200 rounded-sm text-center"
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-300 mb-6" aria-hidden="true">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      <p className="font-serif text-xl font-light text-neutral-400">Votre panier est vide</p>
      <p className="font-sans text-sm text-neutral-400 mt-2 max-w-xs text-pretty">
        Ajoutez des œuvres à votre panier depuis la galerie.
      </p>
      <Link
        href="/galerie"
        className="mt-8 inline-flex items-center gap-2 font-sans text-xs uppercase tracking-widest text-foreground border border-neutral-200 rounded-sm px-6 py-3 hover:border-foreground transition-colors duration-300"
      >
        Explorer la collection
      </Link>
    </motion.div>
  )
}

/* ─── Skeleton ────────────────────────────────────────────────────────────── */

function CartSkeleton() {
  return (
    <div className="grid md:grid-cols-[1fr_320px] gap-8">
      <div className="flex flex-col gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="h-28 rounded-sm bg-neutral-100 animate-pulse" />
        ))}
      </div>
      <div className="h-64 rounded-sm bg-neutral-100 animate-pulse" />
    </div>
  )
}

/* ─── Icons ───────────────────────────────────────────────────────────────── */

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h18M13 6l6 6-6 6" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2" />
    </svg>
  )
}
