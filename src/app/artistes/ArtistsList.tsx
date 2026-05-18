'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { Badge, Button } from '@/components/ui'
import { ARTISTS } from '@/data/artists'
import type { Artist } from '@/lib/types'

const DISCIPLINES = ['Tous', ...Array.from(new Set(ARTISTS.map((a) => a.discipline)))]

const TOTAL_WORKS      = ARTISTS.reduce((s, a) => s + a.worksCount, 0)
const TOTAL_EXHIBITIONS = ARTISTS.reduce((s, a) => s + a.exhibitions, 0)

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

export function ArtistsList() {
  const [activeFilter, setActiveFilter] = useState('Tous')

  const filtered = activeFilter === 'Tous'
    ? ARTISTS
    : ARTISTS.filter((a) => a.discipline === activeFilter)

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
            Nos représentés
          </motion.span>
          <motion.h1
            variants={fadeUpVariants}
            className="font-serif font-light text-foreground"
            style={{ fontSize: 'clamp(2.75rem, 6vw, 5rem)' }}
          >
            Les{' '}
            <em className="gold-text not-italic">artistes</em>
          </motion.h1>
          <motion.div variants={fadeUpVariants} className="my-6">
            <div className="divider" />
          </motion.div>
          <motion.p
            variants={fadeUpVariants}
            className="font-sans text-base text-neutral-500 max-w-xl text-pretty leading-relaxed"
          >
            Une constellation de talents internationaux, unis par une exigence commune
            de l&apos;excellence et une vision singulière du monde contemporain.
          </motion.p>

          {/* Global stats */}
          <motion.div
            variants={fadeUpVariants}
            className="flex items-center gap-10 mt-10 pt-8 border-t border-neutral-200"
          >
            {[
              { value: String(ARTISTS.length),       label: 'Artistes' },
              { value: `${TOTAL_WORKS}+`,             label: 'Œuvres' },
              { value: String(TOTAL_EXHIBITIONS),     label: 'Expositions' },
            ].map(({ value, label }) => (
              <div key={label} className="flex flex-col">
                <span className="font-serif text-3xl font-light text-foreground leading-none">{value}</span>
                <span className="font-sans text-xs uppercase tracking-widest text-neutral-400 mt-1">{label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── Filter + Grid ── */}
      <section className="py-16 md:py-24">
        <div className="container-premium">

          {/* Filter pills */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2 flex-wrap mb-14"
          >
            {DISCIPLINES.map((d) => {
              const count   = d === 'Tous' ? ARTISTS.length : ARTISTS.filter((a) => a.discipline === d).length
              const isActive = activeFilter === d
              return (
                <button
                  key={d}
                  onClick={() => setActiveFilter(d)}
                  className={cn(
                    'relative inline-flex items-center gap-2',
                    'font-sans text-xs uppercase tracking-widest',
                    'px-4 py-2 rounded-sm border transition-all duration-300',
                    isActive
                      ? 'bg-foreground text-background border-foreground'
                      : 'text-neutral-500 border-neutral-200 hover:border-neutral-400 hover:text-foreground',
                  )}
                >
                  {d}
                  <span className={cn('text-[10px] font-normal', isActive ? 'text-neutral-400' : 'text-neutral-300')}>
                    {count}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="artist-filter-pill"
                      className="absolute inset-0 bg-foreground rounded-sm -z-10"
                      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                    />
                  )}
                </button>
              )
            })}
          </motion.div>

          {/* Grid */}
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
            {filtered.map((artist, i) => (
              <ArtistCard key={artist.id} artist={artist} index={i} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Dark CTA ── */}
      <section className="py-24 bg-foreground relative overflow-hidden">
        <BackgroundDecor />
        <div className="container-premium relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
          <div>
            <span className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-3 block">
              Rejoindre la galerie
            </span>
            <p
              className="font-serif font-light text-background text-balance leading-tight"
              style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', maxWidth: '30rem' }}
            >
              Vous êtes artiste ?
            </p>
            <p className="font-sans text-sm text-neutral-500 mt-3 max-w-sm text-pretty">
              Nous sélectionnons de nouveaux talents chaque trimestre. Soumettez votre dossier
              pour intégrer notre programme de représentation.
            </p>
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
              Soumettre son dossier
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ─── ArtistCard ──────────────────────────────────────────────────────────── */

function ArtistCard({ artist, index }: { artist: Artist; index: number }) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.article
      custom={index}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{
        opacity: 1, y: 0,
        transition: { duration: 0.55, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] },
      }}
      viewport={{ once: true, margin: '-60px' }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="group cursor-pointer"
    >
      <Link href={`/artistes/${artist.id}`} className="block">
        {/* Portrait */}
        <div className="relative overflow-hidden rounded-sm aspect-[3/4] mb-5">
          <div className={cn('absolute inset-0 bg-gradient-to-br', artist.gradient, 'opacity-70')} />

          {/* Monogram */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <span
                className="font-serif font-light leading-none select-none"
                style={{ fontSize: 'clamp(4rem, 8vw, 6rem)', color: 'rgba(10,10,10,0.13)' }}
              >
                {artist.name.split(' ').map((n) => n[0]).join('')}
              </span>
              <div className="w-10 h-px bg-gold/40" />
            </div>
          </div>

          {/* Hover overlay */}
          <motion.div
            className="absolute inset-0 bg-foreground/75 flex flex-col justify-end p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: hovered ? 0 : 10, opacity: hovered ? 1 : 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
            >
              <p className="font-sans text-xs text-neutral-300 leading-relaxed text-pretty">
                {artist.bio.slice(0, 130)}…
              </p>
              <div className="flex items-center gap-1.5 mt-4 font-sans text-xs uppercase tracking-widest text-gold">
                Voir le profil
                <ArrowSmIcon />
              </div>
            </motion.div>
          </motion.div>

          {/* Badges */}
          <div className="absolute top-3 left-3">
            {artist.featured && <Badge variant="gold" dot label="Représenté" size="sm" />}
          </div>
          <div className="absolute top-3 right-3">
            <Badge variant="default" label={artist.discipline} size="sm" />
          </div>
        </div>

        {/* Info */}
        <div>
          <h2 className="font-serif text-xl font-light text-foreground group-hover:text-gold transition-colors duration-300">
            {artist.name}
          </h2>
          <p className="font-sans text-xs text-neutral-500 uppercase tracking-widest mt-1">
            {artist.discipline} · {artist.country}
          </p>
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-neutral-100">
            <StatPill value={String(artist.worksCount)} label="Œuvres" />
            <StatPill value={String(artist.exhibitions)} label="Expositions" />
            <StatPill value={artist.yearsActive.split('—')[0].trim()} label="Depuis" />
          </div>
        </div>
      </Link>
    </motion.article>
  )
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-serif text-lg font-light text-foreground leading-none">{value}</span>
      <span className="font-sans text-[10px] uppercase tracking-widest text-neutral-400 mt-0.5">{label}</span>
    </div>
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
