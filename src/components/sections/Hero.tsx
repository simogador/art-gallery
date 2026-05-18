'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Button, Badge } from '@/components/ui'
import { cn } from '@/lib/utils/cn'

const STATS = [
  { value: '340+', label: 'Œuvres' },
  { value: '60',   label: 'Artistes' },
  { value: '12',   label: 'Expositions' },
] as const

/* ─── Animation variants ──────────────────────────────────────────────────── */

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.3 },
  },
}

const fadeUpVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

const fadeInVariants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

const imageVariants = {
  hidden:  { opacity: 0, scale: 1.04 },
  visible: {
    opacity: 1, scale: 1,
    transition: { duration: 1.1, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 },
  },
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] })

  // Parallax effects
  const imageY    = useTransform(scrollYProgress, [0, 1], ['0%',  '18%'])
  const contentY  = useTransform(scrollYProgress, [0, 1], ['0%',  '10%'])
  const opacity   = useTransform(scrollYProgress, [0, 0.6], [1, 0])

  return (
    <section
      ref={sectionRef}
      className="relative min-h-dvh flex items-center overflow-hidden bg-background"
      aria-label="Section héro"
    >
      {/* ── Background grid lines ── */}
      <GridLines />

      {/* ── Main layout ── */}
      <div className="container-premium relative z-10 py-32 md:py-0 md:min-h-dvh flex items-center">
        <div className="grid md:grid-cols-2 gap-12 md:gap-8 lg:gap-16 items-center w-full">

          {/* ── Left: Content ── */}
          <motion.div
            style={{ y: contentY, opacity }}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col"
          >
            {/* Badge */}
            <motion.div variants={fadeInVariants}>
              <Badge variant="gold" dot label="Exposition en cours" className="mb-8" />
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeUpVariants}
              className="font-serif font-light text-foreground text-balance leading-[1.1]"
              style={{ fontSize: 'clamp(2.75rem, 5.5vw, 4.5rem)' }}
            >
              L&apos;Art qui{' '}
              <em className="gold-text not-italic">transcende</em>
              {' '}le temps
            </motion.h1>

            {/* Divider */}
            <motion.div variants={fadeInVariants} className="my-6">
              <div className="divider" />
            </motion.div>

            {/* Subtitle */}
            <motion.p
              variants={fadeUpVariants}
              className="font-sans text-base text-neutral-500 leading-relaxed text-pretty max-w-md"
            >
              Une sélection d&apos;œuvres d&apos;exception réunissant les voix les plus
              singulières de l&apos;art contemporain. Chaque pièce, une invitation au voyage.
            </motion.p>

            {/* CTA */}
            <motion.div
              variants={fadeUpVariants}
              className="flex flex-col sm:flex-row gap-3 mt-10"
            >
              <Button variant="primary" size="lg" rightIcon={<ArrowIcon />}>
                Explorer la galerie
              </Button>
              <Button variant="ghost" size="lg">
                Rencontrer les artistes
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={fadeInVariants}
              className="flex items-center gap-8 mt-14 pt-8 border-t border-neutral-200"
            >
              {STATS.map(({ value, label }, i) => (
                <StatItem key={label} value={value} label={label} index={i} />
              ))}
            </motion.div>
          </motion.div>

          {/* ── Right: Image ── */}
          <motion.div
            className="relative"
            initial="hidden"
            animate="visible"
          >
            {/* Primary image */}
            <motion.div
              variants={imageVariants}
              style={{ y: imageY }}
              className="relative z-10"
            >
              <div className={cn(
                'relative overflow-hidden rounded-sm',
                'aspect-[3/4] md:aspect-[4/5]',
                'bg-neutral-200',
              )}>
                {/* Placeholder art image */}
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-100 via-neutral-200 to-neutral-300" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <ArtPlaceholder />
                </div>
                {/* Image overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/20 via-transparent to-transparent" />
              </div>

              {/* Artwork caption */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.5 }}
                className={cn(
                  'absolute bottom-4 left-4 right-4',
                  'bg-background/90 backdrop-blur-sm',
                  'border border-neutral-200',
                  'rounded-sm px-4 py-3',
                )}
              >
                <p className="font-serif text-sm font-light text-foreground">
                  <em>Lumière Dorée</em>
                  {' — '}
                  <span className="text-neutral-500 font-sans text-xs">Sophie Marceau, 2024</span>
                </p>
                <p className="font-sans text-xs text-gold mt-0.5 uppercase tracking-widest">
                  Huile sur toile · 120 × 90 cm
                </p>
              </motion.div>
            </motion.div>

            {/* Floating accent card */}
            <motion.div
              initial={{ opacity: 0, x: 20, y: -10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ delay: 1, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={cn(
                'absolute -top-6 -right-4 md:-right-8 z-20',
                'bg-foreground text-background',
                'rounded-sm px-4 py-3',
                'shadow-premium-lg',
              )}
            >
              <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-400 mb-0.5">
                Pièce du mois
              </p>
              <p className="font-serif text-lg font-light leading-tight">12 400 €</p>
            </motion.div>

            {/* Background decorative square */}
            <div className="absolute -bottom-6 -left-6 w-2/3 h-2/3 bg-neutral-100 rounded-sm -z-10" />

            {/* Gold dot accent */}
            <div className="absolute -bottom-3 -right-3 w-3 h-3 bg-gold rounded-full z-20" />
          </motion.div>
        </div>
      </div>

      {/* ── Scroll indicator ── */}
      <motion.div
        style={{ opacity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-neutral-400">
          Défiler
        </span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="w-px h-10 bg-gradient-to-b from-neutral-400 to-transparent"
        />
      </motion.div>
    </section>
  )
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function StatItem({ value, label, index }: { value: string; label: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9 + index * 0.1, duration: 0.5 }}
      className="flex flex-col"
    >
      <span className="font-serif text-2xl font-light text-foreground leading-none">
        {value}
      </span>
      <span className="font-sans text-xs uppercase tracking-widest text-neutral-400 mt-1">
        {label}
      </span>
    </motion.div>
  )
}

function GridLines() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Vertical lines */}
      {[20, 50, 80].map((pos) => (
        <div
          key={pos}
          className="absolute top-0 bottom-0 w-px bg-neutral-200/60"
          style={{ left: `${pos}%` }}
        />
      ))}
      {/* Gold horizontal accent */}
      <div className="absolute top-[30%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
    </div>
  )
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArtPlaceholder() {
  return (
    <svg width="120" height="160" viewBox="0 0 120 160" fill="none" className="opacity-20" aria-hidden="true">
      <rect x="10" y="10" width="100" height="140" rx="1" stroke="#0A0A0A" strokeWidth="1" />
      <circle cx="60" cy="60" r="28" stroke="#C9A84C" strokeWidth="1" />
      <path d="M20 110 Q60 70 100 110" stroke="#0A0A0A" strokeWidth="1" fill="none" />
      <rect x="30" y="125" width="60" height="1" fill="#C9A84C" />
      <rect x="40" y="132" width="40" height="1" fill="#0A0A0A" opacity="0.4" />
    </svg>
  )
}
