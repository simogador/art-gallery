'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { Button, Badge } from '@/components/ui'
import { ARTISTS } from '@/data/artists'
import type { Artist } from '@/lib/types'

/* ─── Variants ────────────────────────────────────────────────────────────── */

const sectionVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const fadeUpVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
}

const cardVariants = {
  hidden:  { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function Artists() {
  const featured  = ARTISTS.filter((a) => a.featured)
  const secondary = ARTISTS.filter((a) => !a.featured)

  return (
    <section id="artistes" className="py-24 md:py-32 bg-foreground overflow-hidden">
      <motion.div
        className="container-premium"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
      >
        {/* ── Header ── */}
        <motion.div variants={fadeUpVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div>
            <span className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-3 block">
              Nos représentés
            </span>
            <h2
              className="font-serif font-light text-background"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
            >
              Les artistes
            </h2>
            <div className="w-16 h-px bg-gold opacity-60 mt-4" />
          </div>
          <p className="font-sans text-sm text-neutral-500 max-w-xs text-pretty">
            Une constellation de talents internationaux, liés par une exigence commune de l&apos;excellence.
          </p>
        </motion.div>

        {/* ── Featured artists (large cards) ── */}
        <motion.div
          variants={fadeUpVariants}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6"
        >
          {featured.map((artist, i) => (
            <ArtistCard key={artist.id} artist={artist} index={i} size="lg" />
          ))}
        </motion.div>

        {/* ── Secondary artists (compact row) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {secondary.map((artist, i) => (
            <ArtistCard key={artist.id} artist={artist} index={i + featured.length} size="sm" />
          ))}
        </div>

        {/* ── CTA footer ── */}
        <motion.div
          variants={fadeUpVariants}
          className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-16 pt-8 border-t border-neutral-800"
        >
          <div>
            <p className="font-serif text-xl font-light text-background">
              Vous êtes artiste ?
            </p>
            <p className="font-sans text-sm text-neutral-500 mt-1">
              Nous sélectionnons de nouveaux talents chaque trimestre.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="md" className="border-neutral-700 text-neutral-300 hover:border-neutral-400 hover:text-background">
              <Link href="/artistes">Voir tous les artistes</Link>
            </Button>
            <Button variant="gold" size="md">
              Soumettre son travail
            </Button>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Decorative background elements ── */}
      <BackgroundDecor />
    </section>
  )
}

/* ─── ArtistCard ──────────────────────────────────────────────────────────── */

interface ArtistCardProps {
  artist: Artist
  index:  number
  size:   'lg' | 'sm'
}

function ArtistCard({ artist, index, size }: ArtistCardProps) {
  const [hovered, setHovered] = useState(false)

  if (size === 'lg') {
    return (
      <motion.article
        custom={index}
        variants={cardVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="group relative cursor-pointer"
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
      >
        <Link href={`/artistes/${artist.id}`} className="block">
          {/* Portrait */}
          <div className="relative overflow-hidden rounded-sm aspect-[3/4] bg-neutral-800 mb-5">
            <div className={cn('absolute inset-0 bg-gradient-to-br', artist.gradient, 'opacity-40')} />

            {/* Monogram */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Monogram name={artist.name} />
            </div>

            {/* Hover overlay */}
            <motion.div
              className="absolute inset-0 bg-foreground/60 flex flex-col justify-end p-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: hovered ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: hovered ? 0 : 8, opacity: hovered ? 1 : 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
              >
                <p className="font-sans text-xs text-neutral-300 leading-relaxed">
                  {artist.bio.slice(0, 120)}…
                </p>
                <div className="flex items-center gap-1.5 mt-3 font-sans text-xs uppercase tracking-widest text-gold">
                  Voir le profil
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </motion.div>
            </motion.div>

            {/* Badges */}
            <div className="absolute top-3 left-3">
              <Badge variant="gold" dot label="Représenté" size="sm" />
            </div>
            <div className="absolute top-3 right-3">
              <span className="font-sans text-[10px] uppercase tracking-widest bg-background/90 text-foreground px-2 py-1 rounded-sm">
                {artist.worksCount} œuvres
              </span>
            </div>
          </div>

          {/* Info */}
          <div>
            <h3 className="font-serif text-xl font-light text-background group-hover:text-gold transition-colors duration-300">
              {artist.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-sans text-xs text-neutral-500 uppercase tracking-widest">{artist.discipline}</span>
              <span className="text-neutral-700">·</span>
              <span className="font-sans text-xs text-neutral-500">{artist.country}</span>
            </div>
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-neutral-800">
              <StatPill value={artist.worksCount.toString()} label="Œuvres" />
              <StatPill value={artist.exhibitions.toString()} label="Expos" />
            </div>
          </div>
        </Link>
      </motion.article>
    )
  }

  /* ── Compact (sm) card ── */
  return (
    <Link href={`/artistes/${artist.id}`}>
      <motion.article
        custom={index}
        variants={cardVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="group flex items-center gap-5 p-5 border border-neutral-800 rounded-sm hover:border-neutral-600 transition-colors duration-300 cursor-pointer"
      >
        {/* Avatar */}
        <div className={cn(
          'relative flex-shrink-0 w-14 h-14 rounded-sm overflow-hidden',
          'bg-gradient-to-br', artist.gradient, 'opacity-80',
        )}>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-serif text-lg font-light text-background/80">
              {artist.name.split(' ').map((n) => n[0]).join('')}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-base font-light text-background group-hover:text-gold transition-colors duration-300 truncate">
            {artist.name}
          </h3>
          <p className="font-sans text-xs text-neutral-500 uppercase tracking-widest mt-0.5">
            {artist.discipline} · {artist.country}
          </p>
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0 text-neutral-600 group-hover:text-gold transition-colors duration-300">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </motion.article>
    </Link>
  )
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-serif text-lg font-light text-background leading-none">{value}</span>
      <span className="font-sans text-[10px] uppercase tracking-widest text-neutral-600 mt-0.5">{label}</span>
    </div>
  )
}

function Monogram({ name }: { name: string }) {
  const initials = name.split(' ').map((n) => n[0]).join('')
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-serif text-5xl font-light text-background/20 leading-none select-none">
        {initials}
      </span>
      <div className="w-8 h-px bg-gold/40" />
    </div>
  )
}

function BackgroundDecor() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden -z-0" aria-hidden="true">
      {/* Large circle */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full border border-neutral-800" />
      <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full border border-neutral-800" />
      {/* Gold line */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
    </div>
  )
}
