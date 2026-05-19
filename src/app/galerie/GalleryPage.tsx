'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { Button, Badge } from '@/components/ui'
import type { Artwork, Artist, ArtMedium } from '@/lib/types'

/* ─── Constants ───────────────────────────────────────────────────────────── */

const MEDIUMS: ArtMedium[] = ['Tout', 'Peinture', 'Sculpture', 'Photographie', 'Art numérique']
const SORTS = [
  { value: 'default',    label: 'Défaut' },
  { value: 'price-asc',  label: 'Prix ↑' },
  { value: 'price-desc', label: 'Prix ↓' },
] as const

type SortValue = typeof SORTS[number]['value']

/* ─── Variants ────────────────────────────────────────────────────────────── */

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const fadeUpVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
}

const cardVariants = {
  hidden:  { opacity: 0, y: 32, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1,   transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, scale: 0.95,        transition: { duration: 0.25 } },
}

/* ─── Component ───────────────────────────────────────────────────────────── */

interface Props {
  artworks:    Artwork[]
  artistNames: string[]
}

export function GalleryPage({ artworks, artistNames }: Props) {
  const artistOptions = ['Tous', ...artistNames]
  const totalAvailable = artworks.filter((a) => !a.sold).length
  const totalMediums   = new Set(artworks.map((a) => a.medium)).size

  const [activeMedium,     setActiveMedium]     = useState<ArtMedium>('Tout')
  const [activeArtist,     setActiveArtist]     = useState('Tous')
  const [onlyAvailable,    setOnlyAvailable]    = useState(false)
  const [sort,             setSort]             = useState<SortValue>('default')
  const [hovered,          setHovered]          = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = [...artworks]

    if (activeMedium !== 'Tout')
      list = list.filter((a) => a.medium === activeMedium)

    if (activeArtist !== 'Tous')
      list = list.filter((a) => a.artist === activeArtist)

    if (onlyAvailable)
      list = list.filter((a) => !a.sold)

    if (sort === 'price-asc')
      list = list.sort((a, b) => a.price - b.price)
    else if (sort === 'price-desc')
      list = list.sort((a, b) => b.price - a.price)

    return list
  }, [activeMedium, activeArtist, onlyAvailable, sort])

  const hasActiveFilters = activeMedium !== 'Tout' || activeArtist !== 'Tous' || onlyAvailable || sort !== 'default'

  function resetFilters() {
    setActiveMedium('Tout')
    setActiveArtist('Tous')
    setOnlyAvailable(false)
    setSort('default')
  }

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
            Collection
          </motion.span>
          <motion.h1
            variants={fadeUpVariants}
            className="font-serif font-light text-foreground"
            style={{ fontSize: 'clamp(2.75rem, 6vw, 5rem)' }}
          >
            La{' '}
            <em className="gold-text not-italic">collection</em>
          </motion.h1>
          <motion.div variants={fadeUpVariants} className="my-6">
            <div className="divider" />
          </motion.div>
          <motion.p
            variants={fadeUpVariants}
            className="font-sans text-base text-neutral-500 max-w-xl text-pretty leading-relaxed"
          >
            Chaque œuvre est authentifiée et accompagnée d&apos;un certificat d&apos;origine.
            Livraison assurée, installation à domicile sur demande.
          </motion.p>

          {/* Stats row */}
          <motion.div variants={fadeUpVariants} className="mt-10 flex flex-wrap gap-8 md:gap-16">
            {[
              { value: artworks.length,   label: 'Œuvres' },
              { value: totalAvailable,   label: 'Disponibles' },
              { value: artistNames.length, label: 'Artistes' },
              { value: totalMediums,     label: 'Médiums' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="font-serif text-3xl font-light text-foreground">{value}</p>
                <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-neutral-400 mt-0.5">{label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── Filters ── */}
      <section className="sticky top-16 md:top-20 z-20 bg-background/95 backdrop-blur-sm border-b border-neutral-200">
        <div className="container-premium py-4 space-y-3">

          {/* Medium pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {MEDIUMS.map((m) => {
              const count = m === 'Tout' ? artworks.length : artworks.filter((a) => a.medium === m).length
              const isActive = activeMedium === m
              return (
                <button
                  key={m}
                  onClick={() => setActiveMedium(m)}
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
                  {m}
                  <span className={cn('text-[10px]', isActive ? 'text-neutral-400' : 'text-neutral-300')}>
                    {count}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="gallery-medium-pill"
                      className="absolute inset-0 bg-foreground rounded-sm -z-10"
                      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          {/* Second row: artists + availability + sort */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">

            {/* Artist chips */}
            <div className="flex items-center gap-1.5 flex-wrap flex-1">
              {artistOptions.map((name) => {
                const isActive = activeArtist === name
                return (
                  <button
                    key={name}
                    onClick={() => setActiveArtist(name)}
                    className={cn(
                      'relative inline-flex items-center gap-1.5',
                      'font-sans text-[11px] tracking-wide',
                      'px-3 py-1 rounded-full border',
                      'transition-all duration-200',
                      isActive
                        ? 'border-gold text-foreground'
                        : 'border-neutral-200 text-neutral-400 hover:border-neutral-300 hover:text-neutral-600',
                    )}
                  >
                    {name !== 'Tous' && (
                      <span className="inline-block w-2 h-2 rounded-full bg-gold/60" />
                    )}
                    {name}
                    {isActive && (
                      <motion.div
                        layoutId="gallery-artist-chip"
                        className="absolute inset-0 rounded-full border border-gold -z-10"
                        transition={{ duration: 0.25 }}
                      />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Availability toggle */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setOnlyAvailable((v) => !v)}
                className={cn(
                  'relative w-10 h-5 rounded-full border transition-colors duration-200',
                  onlyAvailable ? 'bg-foreground border-foreground' : 'bg-transparent border-neutral-300',
                )}
                aria-label="Disponibles uniquement"
              >
                <motion.span
                  className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-background"
                  animate={{ x: onlyAvailable ? 20 : 0 }}
                  transition={{ duration: 0.2 }}
                />
              </button>
              <span className="font-sans text-xs text-neutral-500 whitespace-nowrap">Disponibles</span>
            </div>

            {/* Sort buttons */}
            <div className="flex items-center gap-1 shrink-0 border border-neutral-200 rounded-sm p-0.5">
              {SORTS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setSort(value)}
                  className={cn(
                    'font-sans text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-[2px] transition-all duration-200',
                    sort === value
                      ? 'bg-foreground text-background'
                      : 'text-neutral-400 hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Active filter summary */}
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-between pt-1"
            >
              <p className="font-sans text-xs text-neutral-400">
                <span className="text-foreground font-medium">{filtered.length}</span> résultat{filtered.length !== 1 ? 's' : ''}
                {' '}sur {artworks.length} œuvres
              </p>
              <button
                onClick={resetFilters}
                className="font-sans text-xs text-neutral-400 hover:text-foreground transition-colors duration-200 flex items-center gap-1"
              >
                <span className="text-[16px] leading-none">×</span>
                Réinitialiser
              </button>
            </motion.div>
          )}
        </div>
      </section>

      {/* ── Grid ── */}
      <section className="py-16 md:py-24">
        <div className="container-premium">
          <AnimatePresence mode="popLayout">
            {filtered.length > 0 ? (
              <motion.div
                key="grid"
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
                      onHover={setHovered}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="py-32 flex flex-col items-center gap-4 text-center"
              >
                <EmptyMotif />
                <p className="font-serif text-2xl font-light text-neutral-300">Aucune œuvre</p>
                <p className="font-sans text-sm text-neutral-400">
                  Aucune œuvre ne correspond à cette sélection.
                </p>
                <button
                  onClick={resetFilters}
                  className="mt-2 font-sans text-xs uppercase tracking-widest text-foreground underline underline-offset-4 hover:text-gold transition-colors"
                >
                  Réinitialiser les filtres
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer count */}
          {filtered.length > 0 && (
            <motion.div
              layout
              className="mt-14 pt-8 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <p className="font-sans text-sm text-neutral-400">
                <span className="text-foreground font-medium">{filtered.length}</span> sur{' '}
                <span className="text-foreground font-medium">{artworks.length}</span> œuvres
              </p>
              <Link href="/artistes" className="inline-flex items-center gap-2 font-sans text-sm text-neutral-500 hover:text-foreground transition-colors duration-200">
                Découvrir les artistes
                <ArrowIcon />
              </Link>
            </motion.div>
          )}
        </div>
      </section>

      {/* ── Acquisition CTA ── */}
      <section className="py-24 bg-foreground overflow-hidden relative">
        <BackgroundDecor />
        <div className="container-premium relative z-10">
          <div className="max-w-2xl">
            <span className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-4 block">
              Acquisition
            </span>
            <h2
              className="font-serif font-light text-background leading-tight mb-6"
              style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)' }}
            >
              Une œuvre vous touche ?<br />
              <em className="not-italic text-gold">Parlons-en.</em>
            </h2>
            <p className="font-sans text-sm text-neutral-400 leading-relaxed max-w-md mb-10 text-pretty">
              Notre équipe vous accompagne dans chaque étape — de la sélection à l&apos;installation.
              Livraison internationale assurée, facilités de paiement disponibles.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button variant="gold" size="lg" rightIcon={<ArrowIcon />}>
                Contacter la galerie
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="border-neutral-700 text-neutral-300 hover:text-background hover:border-background"
              >
                Nos services
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
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
        <div className={cn('absolute inset-0 bg-gradient-to-br', artwork.gradient)} />

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
              {!artwork.sold && (
                <Button variant="gold" size="sm">Acquérir</Button>
              )}
              <Link href={`/galerie/${artwork.id}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="border-white/30 text-background hover:bg-white/10 hover:border-white/50"
                >
                  Voir l&apos;œuvre
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

function GridLines() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 grid grid-cols-4 gap-0 opacity-[0.04]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-l border-foreground h-full" />
        ))}
      </div>
    </div>
  )
}

function BackgroundDecor() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <svg className="absolute right-0 top-0 w-[600px] h-[600px] opacity-[0.04]" viewBox="0 0 600 600" fill="none">
        <circle cx="500" cy="100" r="300" stroke="white" strokeWidth="1" />
        <circle cx="500" cy="100" r="200" stroke="white" strokeWidth="0.5" />
        <circle cx="500" cy="100" r="100" stroke="white" strokeWidth="0.5" />
      </svg>
    </div>
  )
}

function EmptyMotif() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="text-neutral-200">
      <circle cx="40" cy="40" r="30" stroke="currentColor" strokeWidth="1" />
      <circle cx="40" cy="40" r="15" stroke="currentColor" strokeWidth="0.5" />
      <line x1="10" y1="40" x2="70" y2="40" stroke="currentColor" strokeWidth="0.5" />
      <line x1="40" y1="10" x2="40" y2="70" stroke="currentColor" strokeWidth="0.5" />
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
