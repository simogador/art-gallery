'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { Button, Badge } from '@/components/ui'
import { ARTWORKS } from '@/data/artworks'
import type { Artwork, ArtMedium } from '@/lib/types'

const FILTERS: ArtMedium[] = ['Tout', 'Peinture', 'Sculpture', 'Photographie', 'Art numérique']

const VISIBLE_DEFAULT = 6

/* ─── Variants ────────────────────────────────────────────────────────────── */

const sectionVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const headerVariants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
}

const cardVariants = {
  hidden:  { opacity: 0, y: 32, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1,   transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, scale: 0.95,        transition: { duration: 0.25 } },
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function Gallery() {
  const [activeFilter, setActiveFilter] = useState<ArtMedium>('Tout')
  const [showAll,      setShowAll]      = useState(false)
  const [hovered,      setHovered]      = useState<string | null>(null)

  const filtered = useMemo(() => {
    const list = activeFilter === 'Tout'
      ? ARTWORKS
      : ARTWORKS.filter((a) => a.medium === activeFilter)
    return showAll ? list : list.slice(0, VISIBLE_DEFAULT)
  }, [activeFilter, showAll])

  const totalForFilter = activeFilter === 'Tout'
    ? ARTWORKS.length
    : ARTWORKS.filter((a) => a.medium === activeFilter).length

  const handleFilter = (f: ArtMedium) => {
    setActiveFilter(f)
    setShowAll(false)
  }

  return (
    <section id="galerie" className="py-24 md:py-32 bg-background">
      <motion.div
        className="container-premium"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
      >
        {/* ── Header ── */}
        <motion.div variants={headerVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
          <div>
            <span className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-3 block">
              Collection
            </span>
            <h2 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
              Œuvres sélectionnées
            </h2>
            <div className="divider mt-4" />
          </div>
          <p className="font-sans text-sm text-neutral-500 max-w-xs text-pretty">
            Chaque pièce est authentifiée et accompagnée d&apos;un certificat d&apos;origine.
          </p>
        </motion.div>

        {/* ── Filters ── */}
        <motion.div variants={headerVariants} className="flex items-center gap-2 flex-wrap mb-10">
          {FILTERS.map((filter) => {
            const count = filter === 'Tout'
              ? ARTWORKS.length
              : ARTWORKS.filter((a) => a.medium === filter).length
            const isActive = activeFilter === filter

            return (
              <button
                key={filter}
                onClick={() => handleFilter(filter)}
                className={cn(
                  'relative inline-flex items-center gap-2',
                  'font-sans text-xs uppercase tracking-widest',
                  'px-4 py-2 rounded-sm border',
                  'transition-all duration-300',
                  isActive
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-transparent text-neutral-500 border-neutral-200 hover:border-neutral-400 hover:text-foreground',
                )}
              >
                {filter}
                <span className={cn(
                  'text-[10px] font-normal',
                  isActive ? 'text-neutral-400' : 'text-neutral-300',
                )}>
                  {count}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="filter-pill"
                    className="absolute inset-0 bg-foreground rounded-sm -z-10"
                    transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                  />
                )}
              </button>
            )
          })}
        </motion.div>

        {/* ── Grid ── */}
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((artwork, i) => (
              <ArtworkCard
                key={artwork.id}
                artwork={artwork}
                index={i}
                hovered={hovered === artwork.id}
                onHover={(id) => setHovered(id)}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        {/* ── Footer ── */}
        <motion.div variants={headerVariants} className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-14 pt-8 border-t border-neutral-200">
          <p className="font-sans text-sm text-neutral-400">
            {showAll ? totalForFilter : Math.min(VISIBLE_DEFAULT, totalForFilter)} sur{' '}
            <span className="text-foreground font-medium">{totalForFilter}</span> œuvres
          </p>
          <div className="flex items-center gap-3">
            {!showAll && totalForFilter > VISIBLE_DEFAULT && (
              <Button variant="ghost" size="md" onClick={() => setShowAll(true)}>
                Voir tout ({totalForFilter - VISIBLE_DEFAULT} de plus)
              </Button>
            )}
            <Link href="/galerie">
              <Button variant="primary" size="md" rightIcon={<ArrowIcon />}>
                Toute la collection
              </Button>
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}

/* ─── ArtworkCard ─────────────────────────────────────────────────────────── */

interface ArtworkCardProps {
  artwork: Artwork
  index:   number
  hovered: boolean
  onHover: (id: string | null) => void
}

function ArtworkCard({ artwork, index, hovered, onHover }: ArtworkCardProps) {
  const isLarge = index === 0 || index === 4

  return (
    <motion.article
      layout
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn(
        'group relative cursor-pointer',
        isLarge && 'sm:col-span-2 lg:col-span-1',
      )}
      onHoverStart={() => onHover(artwork.id)}
      onHoverEnd={() => onHover(null)}
    >
      {/* Image area */}
      <div className={cn(
        'relative overflow-hidden rounded-sm bg-neutral-100',
        isLarge ? 'aspect-[4/3]' : 'aspect-[3/4]',
      )}>
        {/* Placeholder gradient */}
        <div className={cn('absolute inset-0 bg-gradient-to-br', artwork.gradient)} />

        {/* Decorative SVG motif */}
        <div className="absolute inset-0 flex items-center justify-center opacity-15">
          <ArtMotif seed={artwork.id} color={artwork.accentColor} />
        </div>

        {/* Hover overlay */}
        <motion.div
          className="absolute inset-0 bg-foreground/70 flex flex-col justify-end p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: hovered ? 0 : 12, opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
          >
            <p className="font-serif text-xl font-light text-background">{artwork.title}</p>
            <p className="font-sans text-xs text-neutral-400 mt-0.5 uppercase tracking-widest">
              {artwork.artist} · {artwork.year}
            </p>
            <div className="flex items-center gap-3 mt-4">
              <Button variant="gold" size="sm">
                {artwork.sold ? 'Œuvre vendue' : 'Acquérir'}
              </Button>
              <Link href={`/galerie/${artwork.id}`}>
                <Button variant="ghost" size="sm" className="border-white/30 text-background hover:bg-white/10 hover:border-white/50">
                  Détails
                </Button>
              </Link>
            </div>
          </motion.div>
        </motion.div>

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {artwork.featured && !artwork.sold && (
            <Badge variant="gold" label="Coup de cœur" size="sm" />
          )}
          {artwork.sold && (
            <Badge variant="dark" label="Vendue" size="sm" />
          )}
        </div>

        {/* Medium tag */}
        <div className="absolute top-3 right-3">
          <Badge variant="default" label={artwork.medium} size="sm" />
        </div>
      </div>

      {/* Info */}
      <Link href={`/galerie/${artwork.id}`} className="block mt-4">
        <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-serif text-lg font-light text-foreground leading-tight group-hover:text-gold transition-colors duration-300">
            {artwork.title}
          </h3>
          <p className="font-sans text-xs text-neutral-500 mt-0.5 uppercase tracking-widest">
            {artwork.artist} · {artwork.size}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          {artwork.sold ? (
            <span className="font-sans text-xs text-neutral-400 uppercase tracking-widest">Vendue</span>
          ) : (
            <span className="font-serif text-lg font-light text-foreground">
              {artwork.price.toLocaleString('fr-FR')} €
            </span>
          )}
        </div>
      </div>
      </Link>
    </motion.article>
  )
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function ArtMotif({ seed, color }: { seed: string; color: string }) {
  const h = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const shapes = [
    <circle key="c" cx="60" cy="60" r={20 + (h % 25)} stroke={color} strokeWidth="1" fill="none" />,
    <rect key="r" x={30 + (h % 20)} y={30 + (h % 15)} width={60 - (h % 20)} height={60 - (h % 15)} stroke={color} strokeWidth="1" fill="none" />,
    <path key="p" d={`M20 ${40 + (h % 20)} Q60 ${20 + (h % 30)} 100 ${40 + (h % 20)}`} stroke={color} strokeWidth="1" fill="none" />,
  ]
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      {shapes[h % 3]}
      <path d={`M60 20 L60 100 M20 60 L100 60`} stroke={color} strokeWidth="0.5" opacity="0.5" />
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
