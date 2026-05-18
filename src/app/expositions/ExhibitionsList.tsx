'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { Badge, Button } from '@/components/ui'
import { EXHIBITIONS } from '@/data/exhibitions'
import type { Exhibition, ExhibitionStatus } from '@/lib/types'

type FilterTab = 'toutes' | ExhibitionStatus

const TABS: { value: FilterTab; label: string }[] = [
  { value: 'toutes',   label: 'Toutes'   },
  { value: 'en-cours', label: 'En cours' },
  { value: 'a-venir',  label: 'À venir'  },
  { value: 'passee',   label: 'Passées'  },
]

const STATUS_CONFIG: Record<ExhibitionStatus, { label: string; variant: 'gold' | 'default' | 'dark' }> = {
  'en-cours': { label: 'En cours',  variant: 'gold'    },
  'a-venir':  { label: 'À venir',   variant: 'default' },
  'passee':   { label: 'Passée',    variant: 'dark'    },
}

const COUNTS = {
  'en-cours': EXHIBITIONS.filter((e) => e.status === 'en-cours').length,
  'a-venir':  EXHIBITIONS.filter((e) => e.status === 'a-venir').length,
  'passee':   EXHIBITIONS.filter((e) => e.status === 'passee').length,
}

/* ─── Variants ────────────────────────────────────────────────────────────── */

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const fadeUpVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function ExhibitionsList() {
  const [activeTab, setActiveTab] = useState<FilterTab>('toutes')

  const filtered   = activeTab === 'toutes' ? EXHIBITIONS : EXHIBITIONS.filter((e) => e.status === activeTab)
  const featured   = filtered.find((e) => e.featured)
  const gridItems  = featured ? filtered.filter((e) => e.id !== featured.id) : filtered

  return (
    <div className="min-h-screen bg-background">

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-24 overflow-hidden">
        <GridLines />
        <motion.div
          className="container-premium relative z-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.span variants={fadeUpVariants} className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-4 block">
            Programme
          </motion.span>
          <motion.h1
            variants={fadeUpVariants}
            className="font-serif font-light text-foreground"
            style={{ fontSize: 'clamp(2.75rem, 6vw, 5rem)' }}
          >
            Les{' '}
            <em className="gold-text not-italic">expositions</em>
          </motion.h1>
          <motion.div variants={fadeUpVariants} className="my-6">
            <div className="divider" />
          </motion.div>
          <motion.p
            variants={fadeUpVariants}
            className="font-sans text-base text-neutral-500 max-w-xl text-pretty leading-relaxed"
          >
            Du mardi au dimanche, 10h–19h · Entrée libre. Découvrez un programme
            d&apos;expositions monographiques et collectives qui interrogent les grandes
            questions de l&apos;art contemporain.
          </motion.p>

          {/* Status counters */}
          <motion.div
            variants={fadeUpVariants}
            className="flex flex-wrap items-center gap-8 mt-10 pt-8 border-t border-neutral-200"
          >
            {([
              { label: 'En cours', count: COUNTS['en-cours'], variant: 'gold'    as const },
              { label: 'À venir',  count: COUNTS['a-venir'],  variant: 'default' as const },
              { label: 'Passées',  count: COUNTS['passee'],   variant: 'dark'    as const },
            ]).map(({ label, count, variant }) => (
              <div key={label} className="flex items-center gap-3">
                <Badge variant={variant} dot label={label} />
                <span className="font-serif text-2xl font-light text-foreground leading-none">{count}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── Filter + Content ── */}
      <section className="py-16 md:py-24">
        <div className="container-premium">

          {/* Filter tabs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-1 mb-12 border-b border-neutral-200"
          >
            {TABS.map(({ value, label }) => {
              const count    = value === 'toutes' ? EXHIBITIONS.length : EXHIBITIONS.filter((e) => e.status === value).length
              const isActive = activeTab === value
              return (
                <button
                  key={value}
                  onClick={() => setActiveTab(value)}
                  className={cn(
                    'relative px-4 py-3 flex items-center gap-2',
                    'font-sans text-xs uppercase tracking-widest',
                    'transition-colors duration-300',
                    isActive ? 'text-foreground' : 'text-neutral-400 hover:text-neutral-600',
                  )}
                >
                  {label}
                  <span className={cn('text-[10px]', isActive ? 'text-gold' : 'text-neutral-300')}>{count}</span>
                  {isActive && (
                    <motion.div
                      layoutId="expo-list-tab"
                      className="absolute bottom-0 left-0 right-0 h-px bg-foreground"
                      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                    />
                  )}
                </button>
              )
            })}
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              {/* Featured card */}
              {featured && (
                <div className="mb-10">
                  <FeaturedCard exhibition={featured} />
                </div>
              )}

              {/* Grid */}
              {gridItems.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {gridItems.map((expo, i) => (
                    <ExhibitionCard key={expo.id} exhibition={expo} index={i} />
                  ))}
                </div>
              )}

              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-neutral-200 rounded-sm">
                  <p className="font-serif text-xl font-light text-neutral-400">Aucune exposition</p>
                  <p className="font-sans text-sm text-neutral-400 mt-2">
                    Il n&apos;y a pas d&apos;exposition dans cette catégorie pour le moment.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ── Visit CTA ── */}
      <section className="py-24 bg-foreground relative overflow-hidden">
        <BackgroundDecor />
        <div className="container-premium relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
          <div>
            <span className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-3 block">Préparer sa visite</span>
            <p
              className="font-serif font-light text-background leading-tight"
              style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', maxWidth: '32rem' }}
            >
              Ouvert du mardi au dimanche
            </p>
            <div className="flex flex-col gap-1.5 mt-4">
              <p className="font-sans text-sm text-neutral-400">10h – 19h · Entrée libre</p>
              <p className="font-sans text-sm text-neutral-400">Visites guidées sur réservation</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 flex-shrink-0">
            <Button
              variant="ghost"
              size="lg"
              className="border-neutral-700 text-neutral-300 hover:border-neutral-400 hover:text-background"
            >
              <Link href="/">Retour à la galerie</Link>
            </Button>
            <Button variant="gold" size="lg">
              Réserver une visite guidée
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ─── FeaturedCard ────────────────────────────────────────────────────────── */

function FeaturedCard({ exhibition: expo }: { exhibition: Exhibition }) {
  const cfg = STATUS_CONFIG[expo.status]

  return (
    <Link href={`/expositions/${expo.id}`} className="block group">
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative grid md:grid-cols-2 gap-0 overflow-hidden rounded-sm border border-neutral-200 shadow-premium cursor-pointer"
      >
        {/* Visual side */}
        <div className={cn(
          'relative min-h-[280px] md:min-h-[380px]',
          'bg-gradient-to-br', expo.gradient,
          'flex items-center justify-center overflow-hidden',
        )}>
          <ExpoMotif color={expo.accentColor} size={220} />
          <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/8 transition-colors duration-500" />
          <div className="absolute top-5 left-5">
            <Badge variant="gold" dot label="À la une" />
          </div>
          <div className="absolute bottom-5 right-5">
            <span className="font-sans text-[10px] uppercase tracking-widest bg-background/90 text-foreground px-2 py-1 rounded-sm">
              {expo.worksCount} œuvres
            </span>
          </div>
        </div>

        {/* Content side */}
        <div className="bg-background p-8 md:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <Badge variant={cfg.variant} dot label={cfg.label} />
              <span className="font-sans text-xs text-neutral-400">{expo.dateStart} — {expo.dateEnd}</span>
            </div>
            <h2
              className="font-serif font-light text-foreground group-hover:text-gold transition-colors duration-300 leading-tight"
              style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)' }}
            >
              {expo.title}
            </h2>
            <p className="font-sans text-sm text-gold uppercase tracking-widest mt-2 mb-5">{expo.subtitle}</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {expo.artists.map((a) => (
                <span key={a} className="font-sans text-xs text-neutral-500 border border-neutral-200 px-3 py-1 rounded-sm">
                  {a}
                </span>
              ))}
            </div>
            <p className="font-sans text-sm text-neutral-500 leading-relaxed text-pretty line-clamp-3">
              {expo.description}
            </p>
          </div>
          <div className="mt-8 flex items-center justify-between gap-4 pt-6 border-t border-neutral-100">
            <div>
              <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-400">Lieu</p>
              <p className="font-sans text-sm text-foreground mt-0.5">{expo.venue}</p>
            </div>
            <div className="flex items-center gap-1.5 font-sans text-xs uppercase tracking-widest text-foreground group-hover:text-gold transition-colors duration-300 flex-shrink-0">
              Découvrir
              <ArrowSmIcon />
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

/* ─── ExhibitionCard ──────────────────────────────────────────────────────── */

function ExhibitionCard({ exhibition: expo, index }: { exhibition: Exhibition; index: number }) {
  const [hovered, setHovered] = useState(false)
  const cfg    = STATUS_CONFIG[expo.status]
  const isPast = expo.status === 'passee'

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{
        opacity: 1, y: 0,
        transition: { duration: 0.55, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] },
      }}
      viewport={{ once: true, margin: '-40px' }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className={cn('group cursor-pointer', isPast && 'opacity-75')}
    >
      <Link href={`/expositions/${expo.id}`} className="block">
        {/* Visual */}
        <div className={cn('relative overflow-hidden rounded-sm aspect-[4/3] mb-5', 'bg-gradient-to-br', expo.gradient)}>
          <div className="absolute inset-0 flex items-center justify-center opacity-25">
            <ExpoMotif color={expo.accentColor} size={160} />
          </div>
          {/* Hover overlay */}
          <motion.div
            className="absolute inset-0 bg-foreground/65 flex flex-col justify-end p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <motion.div
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: hovered ? 0 : 8, opacity: hovered ? 1 : 0 }}
              transition={{ duration: 0.3, delay: 0.04 }}
            >
              <p className="font-sans text-xs text-neutral-300 leading-relaxed text-pretty">
                {expo.description.slice(0, 115)}…
              </p>
              <div className="flex items-center gap-1.5 mt-3 font-sans text-xs uppercase tracking-widest text-gold">
                Voir l&apos;exposition <ArrowSmIcon />
              </div>
            </motion.div>
          </motion.div>
          {/* Badges */}
          <div className="absolute top-3 left-3">
            <Badge variant={cfg.variant} dot label={cfg.label} size="sm" />
          </div>
          <div className="absolute bottom-3 right-3">
            <span className="font-sans text-[10px] uppercase tracking-widest bg-background/90 text-foreground px-2 py-1 rounded-sm">
              {expo.worksCount} œuvres
            </span>
          </div>
        </div>

        {/* Info */}
        <div>
          <h2 className="font-serif text-xl font-light text-foreground group-hover:text-gold transition-colors duration-300 leading-tight">
            {expo.title}
          </h2>
          <p className="font-sans text-xs text-gold uppercase tracking-widest mt-1">{expo.subtitle}</p>
          <p className="font-sans text-xs text-neutral-400 mt-2 uppercase tracking-widest">
            {expo.artists.join(' · ')}
          </p>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-100">
            <span className="font-sans text-xs text-neutral-400">{expo.dateStart} — {expo.dateEnd}</span>
            <span className="font-sans text-xs text-neutral-500 truncate max-w-[130px] text-right">
              {expo.venue.split('—')[0].trim()}
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  )
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function ExpoMotif({ color, size = 200 }: { color: string; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const r1 = size * 0.35
  const r2 = size * 0.225
  const r3 = size * 0.10
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r1} stroke={color} strokeWidth="1"   />
      <circle cx={cx} cy={cy} r={r2} stroke={color} strokeWidth="0.5" />
      <circle cx={cx} cy={cy} r={r3} stroke={color} strokeWidth="0.5" />
      <line x1={cx - r1} y1={cy}       x2={cx + r1} y2={cy}       stroke={color} strokeWidth="0.5" />
      <line x1={cx}      y1={cy - r1}  x2={cx}      y2={cy + r1}  stroke={color} strokeWidth="0.5" />
      <line x1={cx - r2} y1={cy - r2}  x2={cx + r2} y2={cy + r2}  stroke={color} strokeWidth="0.3" opacity="0.5" />
      <line x1={cx + r2} y1={cy - r2}  x2={cx - r2} y2={cy + r2}  stroke={color} strokeWidth="0.3" opacity="0.5" />
    </svg>
  )
}

function ArrowSmIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function GridLines() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {[20, 50, 80].map((pos) => (
        <div key={pos} className="absolute top-0 bottom-0 w-px bg-neutral-200/60" style={{ left: `${pos}%` }} />
      ))}
      <div className="absolute top-[40%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
    </div>
  )
}

function BackgroundDecor() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full border border-neutral-800" />
      <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full border border-neutral-800" />
      <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
    </div>
  )
}
