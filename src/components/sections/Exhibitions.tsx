'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { Button, Badge } from '@/components/ui'
import { EXHIBITIONS } from '@/data/exhibitions'
import type { Exhibition, ExhibitionStatus } from '@/lib/types'

type FilterTab = 'toutes' | ExhibitionStatus

const TABS: { value: FilterTab; label: string }[] = [
  { value: 'toutes',    label: 'Toutes' },
  { value: 'en-cours',  label: 'En cours' },
  { value: 'a-venir',   label: 'À venir' },
  { value: 'passee',    label: 'Passées' },
]

const STATUS_CONFIG: Record<ExhibitionStatus, { label: string; variant: 'gold' | 'default' | 'dark' }> = {
  'en-cours': { label: 'En cours',  variant: 'gold'    },
  'a-venir':  { label: 'À venir',   variant: 'default' },
  'passee':   { label: 'Passée',    variant: 'dark'    },
}

/* ─── Variants ────────────────────────────────────────────────────────────── */

const sectionVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const fadeUpVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function Exhibitions() {
  const [activeTab, setActiveTab] = useState<FilterTab>('toutes')

  const filtered = activeTab === 'toutes'
    ? EXHIBITIONS
    : EXHIBITIONS.filter((e) => e.status === activeTab)

  const featured = EXHIBITIONS.find((e) => e.featured && e.status === 'en-cours')

  return (
    <section id="expositions" className="py-24 md:py-32 bg-neutral-50 overflow-hidden">
      <motion.div
        className="container-premium"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
      >
        {/* ── Header ── */}
        <motion.div variants={fadeUpVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
          <div>
            <span className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-3 block">
              Programme
            </span>
            <h2 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
              Expositions
            </h2>
            <div className="divider mt-4" />
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <p className="font-sans text-sm text-neutral-500">
              Galerie ouverte du mardi au dimanche
            </p>
            <p className="font-sans text-sm font-medium text-foreground">
              10h – 19h · Entrée libre
            </p>
          </div>
        </motion.div>

        {/* ── Featured exhibition ── */}
        {featured && (
          <motion.div variants={fadeUpVariants} className="mb-14">
            <FeaturedCard exhibition={featured} />
          </motion.div>
        )}

        {/* ── Filter tabs ── */}
        <motion.div variants={fadeUpVariants} className="flex items-center gap-1 mb-10 border-b border-neutral-200">
          {TABS.map(({ value, label }) => {
            const count = value === 'toutes'
              ? EXHIBITIONS.length
              : EXHIBITIONS.filter((e) => e.status === value).length
            const isActive = activeTab === value

            return (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className={cn(
                  'relative px-4 py-3',
                  'font-sans text-xs uppercase tracking-widest',
                  'transition-colors duration-300',
                  'flex items-center gap-2',
                  isActive ? 'text-foreground' : 'text-neutral-400 hover:text-neutral-600',
                )}
              >
                {label}
                <span className={cn(
                  'text-[10px]',
                  isActive ? 'text-gold' : 'text-neutral-300',
                )}>
                  {count}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="expo-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-px bg-foreground"
                    transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                  />
                )}
              </button>
            )
          })}
        </motion.div>

        {/* ── Exhibition list ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {filtered.map((expo, i) => (
              <ExhibitionRow key={expo.id} exhibition={expo} index={i} />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* ── Archive CTA ── */}
        <motion.div variants={fadeUpVariants} className="mt-14 flex justify-center">
          <Button variant="ghost" size="lg" rightIcon={<ArrowIcon />}>
            <Link href="/expositions">Voir toutes les expositions</Link>
          </Button>
        </motion.div>
      </motion.div>
    </section>
  )
}

/* ─── FeaturedCard ────────────────────────────────────────────────────────── */

function FeaturedCard({ exhibition: expo }: { exhibition: Exhibition }) {
  return (
    <Link href={`/expositions/${expo.id}`} className="block group">
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.35 }}
      className={cn(
        'relative grid md:grid-cols-2 gap-0 overflow-hidden rounded-sm',
        'border border-neutral-200 shadow-premium',
        'cursor-pointer',
      )}
    >
      {/* Visual side */}
      <div className={cn(
        'relative min-h-[280px] md:min-h-[380px]',
        'bg-gradient-to-br', expo.gradient,
        'flex items-center justify-center overflow-hidden',
      )}>
        {/* Decorative motif */}
        <ExpoMotif color={expo.accentColor} />

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors duration-500" />

        {/* Featured tag */}
        <div className="absolute top-5 left-5">
          <Badge variant="gold" dot label="À la une" />
        </div>

        {/* Works count */}
        <div className="absolute bottom-5 right-5 text-right">
          <span className="font-sans text-[10px] uppercase tracking-widest text-foreground/60">
            {expo.worksCount} œuvres
          </span>
        </div>
      </div>

      {/* Content side */}
      <div className="bg-background p-8 md:p-10 flex flex-col justify-between">
        <div>
          {/* Status + date */}
          <div className="flex items-center gap-3 mb-5">
            <Badge
              variant={STATUS_CONFIG[expo.status].variant}
              dot
              label={STATUS_CONFIG[expo.status].label}
            />
            <span className="font-sans text-xs text-neutral-400">
              {expo.dateStart} — {expo.dateEnd}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-serif font-light text-foreground leading-tight mb-2"
            style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)' }}>
            {expo.title}
          </h3>
          <p className="font-sans text-sm text-gold uppercase tracking-widest mb-4">
            {expo.subtitle}
          </p>

          {/* Artists */}
          <div className="flex flex-wrap gap-2 mb-5">
            {expo.artists.map((artist) => (
              <span key={artist} className="font-sans text-xs text-neutral-500 border border-neutral-200 px-3 py-1 rounded-sm">
                {artist}
              </span>
            ))}
          </div>

          {/* Description */}
          <p className="font-sans text-sm text-neutral-500 leading-relaxed text-pretty">
            {expo.description}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between gap-4 pt-6 border-t border-neutral-100">
          <div>
            <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-400">Lieu</p>
            <p className="font-sans text-sm text-foreground mt-0.5">{expo.venue}</p>
          </div>
          <div className="flex items-center gap-1.5 font-sans text-xs uppercase tracking-widest text-foreground group-hover:text-gold transition-colors duration-300 flex-shrink-0">
            Découvrir <ArrowIcon />
          </div>
        </div>
      </div>
    </motion.div>
    </Link>
  )
}

/* ─── ExhibitionRow ───────────────────────────────────────────────────────── */

function ExhibitionRow({ exhibition: expo, index }: { exhibition: Exhibition; index: number }) {
  const [open, setOpen] = useState(false)
  const cfg = STATUS_CONFIG[expo.status]
  const isPast = expo.status === 'passee'

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'border border-neutral-200 rounded-sm overflow-hidden',
        'bg-background',
        isPast && 'opacity-70',
      )}
    >
      {/* Row header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left"
        aria-expanded={open}
      >
        <div className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_auto_auto] gap-4 items-center px-6 py-5 group">
          {/* Color swatch */}
          <div
            className={cn('w-1 self-stretch rounded-full bg-gradient-to-b', expo.gradient)}
            aria-hidden="true"
          />

          {/* Title block */}
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="font-serif text-lg font-light text-foreground group-hover:text-gold transition-colors duration-300 leading-tight">
                {expo.title}
              </h3>
              <Badge variant={cfg.variant} dot label={cfg.label} size="sm" />
            </div>
            <p className="font-sans text-xs text-neutral-400 mt-1 uppercase tracking-widest">
              {expo.artists.join(' · ')}
            </p>
          </div>

          {/* Date — hidden on mobile */}
          <div className="hidden md:block text-right">
            <p className="font-sans text-xs text-neutral-400 whitespace-nowrap">
              {expo.dateStart}
            </p>
            <p className="font-sans text-xs text-neutral-300 mt-0.5 whitespace-nowrap">
              → {expo.dateEnd}
            </p>
          </div>

          {/* Chevron */}
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-neutral-400 group-hover:text-foreground transition-colors duration-200"
          >
            <ChevronIcon />
          </motion.div>
        </div>
      </button>

      {/* Expandable detail */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className={cn(
              'px-6 pb-6 ml-5', // aligned with content (past the color swatch)
              'border-t border-neutral-100 pt-5',
            )}>
              <div className="grid md:grid-cols-3 gap-6">
                {/* Description */}
                <div className="md:col-span-2">
                  <p className="font-sans text-sm text-neutral-500 leading-relaxed text-pretty">
                    {expo.description}
                  </p>
                  {!isPast && (
                    <Button variant="ghost" size="sm" className="mt-4" rightIcon={<ArrowIcon />}>
                      <Link href={`/expositions/${expo.id}`}>En savoir plus</Link>
                    </Button>
                  )}
                </div>

                {/* Meta */}
                <div className="flex flex-col gap-4">
                  <MetaItem label="Lieu" value={expo.venue} />
                  <MetaItem label="Durée" value={`${expo.dateStart} — ${expo.dateEnd}`} />
                  <MetaItem label="Œuvres" value={`${expo.worksCount} pièces`} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-400">{label}</p>
      <p className="font-sans text-sm text-foreground mt-0.5">{value}</p>
    </div>
  )
}

function ExpoMotif({ color }: { color: string }) {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" fill="none" className="opacity-30" aria-hidden="true">
      <circle cx="100" cy="100" r="70" stroke={color} strokeWidth="1" />
      <circle cx="100" cy="100" r="45" stroke={color} strokeWidth="0.5" />
      <circle cx="100" cy="100" r="20" stroke={color} strokeWidth="0.5" />
      <line x1="30"  y1="100" x2="170" y2="100" stroke={color} strokeWidth="0.5" />
      <line x1="100" y1="30"  x2="100" y2="170" stroke={color} strokeWidth="0.5" />
      <line x1="50"  y1="50"  x2="150" y2="150" stroke={color} strokeWidth="0.3" opacity="0.5" />
      <line x1="150" y1="50"  x2="50"  y2="150" stroke={color} strokeWidth="0.3" opacity="0.5" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
