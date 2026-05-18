'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { Button, Badge, Modal } from '@/components/ui'
import { formatPrice } from '@/lib/utils/artworks'
import type { Artist, Artwork } from '@/lib/types'

/* ─── Variants ────────────────────────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

const portraitVariant = {
  hidden:  { opacity: 0, scale: 1.03 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] } },
}

/* ─── Component ───────────────────────────────────────────────────────────── */

interface Props {
  artist:   Artist
  artworks: Artwork[]
}

export function ArtistProfile({ artist, artworks }: Props) {
  const [contactOpen, setContactOpen] = useState(false)
  const [formSent,    setFormSent]    = useState(false)
  const [loading,     setLoading]     = useState(false)

  const availableCount = artworks.filter((a) => !a.sold).length

  const handleContact = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((r) => setTimeout(r, 900))
    setLoading(false)
    setFormSent(true)
  }

  return (
    <>
      <div className="min-h-screen bg-background pt-20">

        {/* ── Breadcrumb ── */}
        <motion.nav
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="container-premium py-5 border-b border-neutral-100"
          aria-label="Fil d'Ariane"
        >
          <ol className="flex items-center gap-2 font-sans text-xs text-neutral-400 uppercase tracking-widest">
            <li><Link href="/" className="hover:text-foreground transition-colors duration-200">Accueil</Link></li>
            <li aria-hidden="true"><ChevronRightIcon /></li>
            <li><Link href="/artistes" className="hover:text-foreground transition-colors duration-200">Artistes</Link></li>
            <li aria-hidden="true"><ChevronRightIcon /></li>
            <li className="text-foreground truncate max-w-[200px]">{artist.name}</li>
          </ol>
        </motion.nav>

        {/* ── Main split layout ── */}
        <div className="container-premium py-12 md:py-16">
          <div className="grid md:grid-cols-[1fr_1.7fr] lg:grid-cols-[360px_1fr] gap-12 lg:gap-20 items-start">

            {/* ── LEFT — Portrait + Info ── */}
            <div className="md:sticky md:top-28">
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
              >
                {/* Portrait */}
                <motion.div variants={portraitVariant} className="relative mb-8">
                  <div className={cn(
                    'relative overflow-hidden rounded-sm aspect-[3/4]',
                    'bg-gradient-to-br', artist.gradient,
                  )}>
                    {/* Monogram */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-4">
                        <span
                          className="font-serif font-light leading-none select-none"
                          style={{ fontSize: 'clamp(5rem, 12vw, 8rem)', color: 'rgba(10,10,10,0.12)' }}
                        >
                          {artist.name.split(' ').map((n) => n[0]).join('')}
                        </span>
                        <div className="w-14 h-px bg-gold/50" />
                      </div>
                    </div>

                    {/* Decorative grid lines */}
                    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-foreground/5" />
                      <div className="absolute left-0 right-0 top-1/2 h-px bg-foreground/5" />
                    </div>

                    {/* Badges */}
                    <div className="absolute top-4 left-4">
                      {artist.featured && <Badge variant="gold" dot label="Représenté" />}
                    </div>
                    <div className="absolute top-4 right-4">
                      <Badge variant="default" label={artist.discipline} />
                    </div>

                    {/* Bottom strip */}
                    <div className="absolute bottom-0 left-0 right-0 bg-background/90 backdrop-blur-sm border-t border-neutral-200 px-5 py-4">
                      <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-neutral-500 mb-0.5">{artist.country}</p>
                      <p className="font-sans text-xs text-neutral-400">{artist.yearsActive}</p>
                    </div>
                  </div>
                </motion.div>

                {/* Name */}
                <motion.h1
                  custom={1} variants={fadeUp}
                  className="font-serif font-light text-foreground leading-tight"
                  style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}
                >
                  {artist.name}
                </motion.h1>
                <motion.p custom={2} variants={fadeUp} className="font-sans text-xs text-gold uppercase tracking-widest mt-1.5">
                  {artist.discipline}
                </motion.p>

                <motion.div custom={3} variants={fadeUp} className="my-5">
                  <div className="divider" />
                </motion.div>

                {/* Bio */}
                <motion.p
                  custom={4} variants={fadeUp}
                  className="font-sans text-sm text-neutral-600 leading-relaxed text-pretty"
                >
                  {artist.bio}
                </motion.p>

                {/* Stats */}
                <motion.div custom={5} variants={fadeUp} className="grid grid-cols-3 gap-2 mt-7">
                  {[
                    { label: 'Œuvres',       value: String(artist.worksCount) },
                    { label: 'Expositions',  value: String(artist.exhibitions) },
                    { label: 'Actif depuis', value: artist.yearsActive.split('—')[0].trim() },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-neutral-50 border border-neutral-100 rounded-sm px-3 py-3 text-center">
                      <p className="font-serif text-xl font-light text-foreground">{value}</p>
                      <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-400 mt-0.5 leading-tight">{label}</p>
                    </div>
                  ))}
                </motion.div>

                {/* CTAs */}
                <motion.div custom={6} variants={fadeUp} className="flex flex-col gap-3 mt-7">
                  <Button
                    variant="primary" size="lg" fullWidth
                    onClick={() => setContactOpen(true)}
                    rightIcon={<ArrowIcon />}
                  >
                    Contacter la galerie
                  </Button>
                  <Button variant="ghost" size="md" fullWidth onClick={() => setContactOpen(true)}>
                    Demander le portfolio complet
                  </Button>
                </motion.div>
              </motion.div>
            </div>

            {/* ── RIGHT — Artworks ── */}
            <div>
              {/* Section header */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10"
              >
                <div>
                  <span className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-3 block">Collection</span>
                  <h2
                    className="font-serif font-light text-foreground"
                    style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)' }}
                  >
                    Œuvres de {artist.name.split(' ')[0]}
                  </h2>
                  <div className="divider mt-4" />
                </div>
                {artworks.length > 0 && (
                  <p className="font-sans text-sm text-neutral-400 flex-shrink-0">
                    <span className="text-foreground font-medium">{availableCount}</span>{' '}
                    disponible{availableCount > 1 ? 's' : ''} sur {artworks.length}
                  </p>
                )}
              </motion.div>

              {artworks.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-neutral-200 rounded-sm"
                >
                  <div className="w-16 h-16 rounded-full bg-neutral-50 flex items-center justify-center mb-5">
                    <ImagePlaceholderIcon />
                  </div>
                  <p className="font-serif text-xl font-light text-neutral-400">Bientôt disponible</p>
                  <p className="font-sans text-sm text-neutral-400 mt-2 max-w-xs">
                    Les œuvres de {artist.name} seront présentées prochainement sur notre galerie.
                  </p>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                  {artworks.map((artwork, i) => (
                    <ArtworkCard key={artwork.id} artwork={artwork} index={i} />
                  ))}
                </div>
              )}

              {/* Footer */}
              {artworks.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center justify-between mt-10 pt-8 border-t border-neutral-100"
                >
                  <Link
                    href="/artistes"
                    className="font-sans text-xs uppercase tracking-widest text-neutral-400 hover:text-foreground transition-colors duration-200 flex items-center gap-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M13 8H3M7 12l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Tous les artistes
                  </Link>
                  <Button variant="ghost" size="md" rightIcon={<ArrowIcon />}>
                    <Link href="/galerie">Toute la collection</Link>
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Contact Modal ── */}
      <Modal
        open={contactOpen}
        onClose={() => { setContactOpen(false); setFormSent(false) }}
        title={`À propos de ${artist.name}`}
        subtitle="Galerie d'Art Contemporain"
        size="md"
        footer={
          !formSent ? (
            <>
              <Button variant="ghost" size="md" onClick={() => setContactOpen(false)}>Annuler</Button>
              <Button variant="gold" size="md" form="contact-artist" type="submit" loading={loading}>
                Envoyer
              </Button>
            </>
          ) : undefined
        }
      >
        {formSent ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-8 flex flex-col items-center text-center gap-4"
          >
            <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" className="text-gold" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3" />
              </svg>
            </div>
            <div>
              <p className="font-serif text-xl font-light">Message envoyé</p>
              <p className="font-sans text-sm text-neutral-500 mt-2">
                Notre équipe vous contactera dans les 24h ouvrées.
              </p>
            </div>
          </motion.div>
        ) : (
          <form id="contact-artist" onSubmit={handleContact} className="flex flex-col gap-4">
            <p className="font-sans text-sm text-neutral-500 mb-2">
              Renseignez vos coordonnées pour être mis en contact au sujet de {artist.name}.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Prénom" name="firstname" placeholder="Marie" required />
              <FormField label="Nom"    name="lastname"  placeholder="Dupont" required />
            </div>
            <FormField label="Email"     name="email" type="email" placeholder="marie@exemple.fr" required />
            <FormField label="Téléphone" name="phone" type="tel"   placeholder="+33 6 00 00 00 00" />
            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-xs font-medium uppercase tracking-widest text-neutral-500">
                Message
              </label>
              <textarea
                name="message"
                rows={3}
                placeholder={`Je souhaite en savoir plus sur le travail de ${artist.name}…`}
                className={cn(
                  'w-full px-4 py-2.5 rounded-sm border border-neutral-200',
                  'font-sans text-sm text-foreground bg-transparent',
                  'placeholder:text-neutral-400',
                  'outline-none focus:border-foreground transition-colors duration-300',
                  'resize-none',
                )}
              />
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}

/* ─── Artwork card ────────────────────────────────────────────────────────── */

function ArtworkCard({ artwork, index }: { artwork: Artwork; index: number }) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.1, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="group cursor-pointer"
    >
      <Link href={`/galerie/${artwork.id}`} className="block">
        {/* Image */}
        <div className={cn(
          'relative overflow-hidden rounded-sm aspect-[3/4] mb-4',
          'bg-gradient-to-br', artwork.gradient,
        )}>
          <div className="absolute inset-0 flex items-center justify-center opacity-15">
            <ArtMotif seed={artwork.id} color={artwork.accentColor} />
          </div>

          {/* Hover overlay */}
          <motion.div
            className="absolute inset-0 bg-foreground/65 flex flex-col justify-end p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: hovered ? 0 : 8, opacity: hovered ? 1 : 0 }}
              transition={{ duration: 0.3, delay: 0.04 }}
            >
              <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-400 mb-1">
                {artwork.technique}
              </p>
              <div className="flex items-center gap-1.5 font-sans text-xs uppercase tracking-widest text-gold mt-3">
                Voir l&apos;œuvre
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </motion.div>
          </motion.div>

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {artwork.featured && !artwork.sold && <Badge variant="gold" label="Coup de cœur" size="sm" />}
            {artwork.sold && <Badge variant="dark" label="Vendue" size="sm" />}
          </div>
          <div className="absolute top-3 right-3">
            <Badge variant="default" label={artwork.medium} size="sm" />
          </div>
        </div>

        {/* Info */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-serif text-lg font-light text-foreground group-hover:text-gold transition-colors duration-300 leading-tight">
              {artwork.title}
            </h3>
            <p className="font-sans text-xs text-neutral-500 uppercase tracking-widest mt-0.5">
              {artwork.size} · {artwork.year}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            {artwork.sold ? (
              <span className="font-sans text-xs text-neutral-400 uppercase tracking-widest">Vendue</span>
            ) : (
              <span className="font-serif text-lg font-light text-foreground">
                {formatPrice(artwork.price)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.article>
  )
}

/* ─── Form field ──────────────────────────────────────────────────────────── */

function FormField({ label, name, type = 'text', placeholder, required }: {
  label: string; name: string; type?: string; placeholder?: string; required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="font-sans text-xs font-medium uppercase tracking-widest text-neutral-500">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className={cn(
          'px-4 py-2.5 rounded-sm border border-neutral-200',
          'font-sans text-sm text-foreground bg-transparent',
          'placeholder:text-neutral-400',
          'outline-none focus:border-foreground transition-colors duration-300',
        )}
      />
    </div>
  )
}

/* ─── Art motif ───────────────────────────────────────────────────────────── */

function ArtMotif({ seed, color }: { seed: string; color: string }) {
  const h = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const shapes = [
    <circle key="c" cx="60" cy="60" r={20 + (h % 25)} stroke={color} strokeWidth="1" fill="none" />,
    <rect key="r" x={30 + (h % 20)} y={30 + (h % 15)} width={60 - (h % 20)} height={60 - (h % 15)} stroke={color} strokeWidth="1" fill="none" />,
    <path key="p" d={`M20 ${40 + (h % 20)} Q60 ${20 + (h % 30)} 100 ${40 + (h % 20)}`} stroke={color} strokeWidth="1" fill="none" />,
  ]
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      {shapes[h % 3]}
      <path d="M60 20 L60 100 M20 60 L100 60" stroke={color} strokeWidth="0.5" opacity="0.5" />
    </svg>
  )
}

/* ─── Icons ───────────────────────────────────────────────────────────────── */

function ChevronRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
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

function ImagePlaceholderIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"
      strokeLinecap="round" strokeLinejoin="round" className="text-neutral-300" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  )
}
