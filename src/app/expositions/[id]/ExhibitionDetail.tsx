'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { Button, Badge, Modal } from '@/components/ui'
import { formatPrice } from '@/lib/utils/artworks'
import type { Artist, Artwork, Exhibition, ExhibitionStatus } from '@/lib/types'

const STATUS_CONFIG: Record<ExhibitionStatus, { label: string; variant: 'gold' | 'default' | 'dark' }> = {
  'en-cours': { label: 'En cours',  variant: 'gold'    },
  'a-venir':  { label: 'À venir',   variant: 'default' },
  'passee':   { label: 'Passée',    variant: 'dark'    },
}

/* ─── Variants ────────────────────────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

const visualVariant = {
  hidden:  { opacity: 0, scale: 1.03 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] } },
}

/* ─── Component ───────────────────────────────────────────────────────────── */

interface Props {
  exhibition: Exhibition
  artists:    Artist[]
  artworks:   Artwork[]
  related:    Exhibition[]
}

export function ExhibitionDetail({ exhibition, artists, artworks, related }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [formSent,  setFormSent]  = useState(false)
  const [loading,   setLoading]   = useState(false)

  const cfg      = STATUS_CONFIG[exhibition.status]
  const isPast   = exhibition.status === 'passee'
  const isActive = exhibition.status === 'en-cours'

  const handleSubmit = async (e: React.FormEvent) => {
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
            <li><Link href="/expositions" className="hover:text-foreground transition-colors duration-200">Expositions</Link></li>
            <li aria-hidden="true"><ChevronRightIcon /></li>
            <li className="text-foreground truncate max-w-[200px]">{exhibition.title}</li>
          </ol>
        </motion.nav>

        {/* ── Main split layout ── */}
        <div className="container-premium py-12 md:py-16">
          <div className="grid md:grid-cols-[1fr_1.35fr] lg:grid-cols-[1fr_1.5fr] gap-10 lg:gap-16 items-start">

            {/* ── LEFT — Visual ── */}
            <div className="md:sticky md:top-28 flex flex-col gap-5">
              <motion.div variants={visualVariant} initial="hidden" animate="visible">
                <div className={cn(
                  'relative overflow-hidden rounded-sm aspect-[4/5]',
                  'bg-gradient-to-br', exhibition.gradient,
                )}>
                  {/* Motif */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ExpoMotif color={exhibition.accentColor} size={260} />
                  </div>

                  {/* Subtle grid */}
                  <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                    <div className="absolute top-0 bottom-0 left-1/2 w-px bg-foreground/5" />
                    <div className="absolute left-0 right-0 top-1/2 h-px bg-foreground/5" />
                  </div>

                  {/* Badges */}
                  <div className="absolute top-4 left-4 flex flex-col gap-2">
                    <Badge variant={cfg.variant} dot label={cfg.label} />
                    {exhibition.featured && !isPast && <Badge variant="gold" label="À la une" />}
                  </div>
                  <div className="absolute top-4 right-4">
                    <span className="font-sans text-[10px] uppercase tracking-widest bg-background/90 text-foreground px-2 py-1 rounded-sm">
                      {exhibition.worksCount} œuvres
                    </span>
                  </div>

                  {/* Bottom venue strip */}
                  <div className="absolute bottom-0 left-0 right-0 bg-background/90 backdrop-blur-sm border-t border-neutral-200 px-5 py-4">
                    <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-neutral-500 mb-0.5">Lieu</p>
                    <p className="font-sans text-xs text-neutral-600">{exhibition.venue}</p>
                  </div>
                </div>
              </motion.div>

              {/* Infos pratiques (active / upcoming only) */}
              {!isPast && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="bg-neutral-50 border border-neutral-100 rounded-sm p-5"
                >
                  <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-400 mb-4">
                    Infos pratiques
                  </p>
                  <div className="flex flex-col gap-3">
                    <InfoRow icon={<ClockIcon />}    label="Horaires" value="Mar – Dim · 10h – 19h" />
                    <InfoRow icon={<TicketIcon />}   label="Entrée"   value="Libre · Sans réservation" />
                    <InfoRow icon={<LocationIcon />} label="Galerie"  value="Galerie d'Art Contemporain, Paris" />
                    {isActive && (
                      <InfoRow icon={<CalendarIcon />} label="Fermeture" value={`${exhibition.dateEnd}`} />
                    )}
                    {!isActive && (
                      <InfoRow icon={<CalendarIcon />} label="Ouverture" value={`${exhibition.dateStart}`} />
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            {/* ── RIGHT — Info ── */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
            >
              {/* Status */}
              <motion.div custom={0} variants={fadeUp} className="flex items-center gap-3 mb-5">
                <Badge variant={cfg.variant} dot label={cfg.label} />
              </motion.div>

              {/* Title */}
              <motion.h1
                custom={1} variants={fadeUp}
                className="font-serif font-light text-foreground leading-tight"
                style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)' }}
              >
                {exhibition.title}
              </motion.h1>
              <motion.p custom={2} variants={fadeUp} className="font-sans text-sm text-gold uppercase tracking-widest mt-2">
                {exhibition.subtitle}
              </motion.p>

              <motion.div custom={3} variants={fadeUp} className="my-6">
                <div className="divider" />
              </motion.div>

              {/* Quick meta grid */}
              <motion.div custom={4} variants={fadeUp} className="grid grid-cols-2 gap-3 mb-8">
                {[
                  { label: 'Ouverture', value: exhibition.dateStart },
                  { label: 'Clôture',   value: exhibition.dateEnd   },
                  { label: 'Lieu',      value: exhibition.venue     },
                  { label: 'Œuvres',    value: `${exhibition.worksCount} pièces` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-neutral-50 border border-neutral-100 rounded-sm px-4 py-3">
                    <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-400">{label}</p>
                    <p className="font-sans text-sm text-foreground mt-0.5 leading-snug">{value}</p>
                  </div>
                ))}
              </motion.div>

              {/* Artists chips */}
              <motion.div custom={5} variants={fadeUp} className="mb-8">
                <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-400 mb-3">Avec</p>
                <div className="flex flex-wrap gap-2">
                  {exhibition.artists.map((artistName) => {
                    const artistData = artists.find((a) => a.name === artistName)
                    return artistData ? (
                      <Link key={artistName} href={`/artistes/${artistData.id}`}>
                        <motion.span
                          whileHover={{ y: -1 }}
                          className={cn(
                            'inline-flex items-center gap-2 cursor-pointer',
                            'font-sans text-xs text-foreground border border-neutral-200',
                            'px-3 py-1.5 rounded-sm',
                            'hover:border-gold hover:text-gold transition-all duration-200',
                          )}
                        >
                          <span className={cn(
                            'w-5 h-5 rounded-sm flex-shrink-0 flex items-center justify-center',
                            'text-[9px] font-serif text-background/80',
                            'bg-gradient-to-br', artistData.gradient,
                          )}>
                            {artistName.split(' ').map((n) => n[0]).join('')}
                          </span>
                          {artistName}
                        </motion.span>
                      </Link>
                    ) : (
                      <span
                        key={artistName}
                        className="inline-flex items-center font-sans text-xs text-foreground border border-neutral-200 px-3 py-1.5 rounded-sm"
                      >
                        {artistName}
                      </span>
                    )
                  })}
                </div>
              </motion.div>

              {/* Description */}
              <motion.div custom={6} variants={fadeUp} className="mb-8">
                <p className="font-sans text-sm text-neutral-600 leading-relaxed text-pretty">
                  {exhibition.description}
                </p>
              </motion.div>

              {/* CTAs */}
              <motion.div custom={7} variants={fadeUp} className="flex flex-col gap-3">
                {!isPast ? (
                  <>
                    <Button
                      variant="primary" size="lg" fullWidth
                      onClick={() => setModalOpen(true)}
                      rightIcon={<ArrowIcon />}
                    >
                      {isActive ? 'Préparer ma visite' : "M'alerter de l'ouverture"}
                    </Button>
                    <Button variant="ghost" size="md" fullWidth onClick={() => setModalOpen(true)}>
                      Réserver une visite guidée
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="lg" fullWidth onClick={() => setModalOpen(true)}>
                      Contacter la galerie
                    </Button>
                    <Link
                      href="/expositions"
                      className="font-sans text-xs uppercase tracking-widest text-neutral-400 hover:text-foreground transition-colors duration-200 flex items-center justify-center gap-2 py-2"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M13 8H3M7 12l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Toutes les expositions
                    </Link>
                  </>
                )}
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* ── Artists section ── */}
        {artists.length > 0 && (
          <ArtistsSection artists={artists} />
        )}

        {/* ── Artworks section ── */}
        {artworks.length > 0 && (
          <ArtworksSection artworks={artworks} />
        )}

        {/* ── Related exhibitions ── */}
        {related.length > 0 && (
          <RelatedSection exhibitions={related} />
        )}
      </div>

      {/* ── Modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setFormSent(false) }}
        title={
          isPast
            ? 'Contacter la galerie'
            : isActive
            ? 'Préparer ma visite'
            : "M'alerter de l'ouverture"
        }
        subtitle={exhibition.title}
        size="md"
        footer={
          !formSent ? (
            <>
              <Button variant="ghost" size="md" onClick={() => setModalOpen(false)}>Annuler</Button>
              <Button variant="gold"  size="md" form="expo-contact" type="submit" loading={loading}>
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
          <form id="expo-contact" onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="font-sans text-sm text-neutral-500 mb-2">
              {isPast
                ? `Renseignez vos coordonnées pour toute question concernant "${exhibition.title}".`
                : isActive
                ? `Indiquez vos préférences pour organiser votre visite de "${exhibition.title}".`
                : `Laissez votre email pour être alerté dès l'ouverture de "${exhibition.title}".`
              }
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Prénom" name="firstname" placeholder="Marie"  required />
              <FormField label="Nom"    name="lastname"  placeholder="Dupont" required />
            </div>
            <FormField label="Email"     name="email" type="email" placeholder="marie@exemple.fr" required />
            {!isPast && isActive && (
              <>
                <FormField label="Téléphone" name="phone" type="tel" placeholder="+33 6 00 00 00 00" />
                <FormField label="Date souhaitée" name="date" type="date" />
              </>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-xs font-medium uppercase tracking-widest text-neutral-500">
                Message (optionnel)
              </label>
              <textarea
                name="message"
                rows={3}
                placeholder="Questions, accessibilité, visite de groupe…"
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

/* ─── Artists section ─────────────────────────────────────────────────────── */

function ArtistsSection({ artists }: { artists: Artist[] }) {
  return (
    <section className="py-20 bg-foreground relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full border border-neutral-800" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
      </div>
      <div className="container-premium relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <span className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-3 block">Participent</span>
          <h2
            className="font-serif font-light text-background"
            style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)' }}
          >
            Artistes de l&apos;exposition
          </h2>
          <div className="w-16 h-px bg-gold/60 mt-4" />
        </motion.div>

        <div className={cn(
          'grid grid-cols-1 gap-4',
          artists.length === 1 ? 'sm:max-w-sm' : 'sm:grid-cols-2 lg:grid-cols-3',
        )}>
          {artists.map((artist, i) => (
            <motion.div
              key={artist.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <Link href={`/artistes/${artist.id}`}>
                <div className="group flex items-center gap-4 p-5 border border-neutral-800 rounded-sm hover:border-neutral-600 transition-colors duration-300 cursor-pointer">
                  {/* Avatar */}
                  <div className={cn(
                    'relative w-14 h-14 rounded-sm flex-shrink-0 overflow-hidden flex items-center justify-center',
                    'bg-gradient-to-br', artist.gradient, 'opacity-70',
                  )}>
                    <span className="font-serif text-base font-light text-background/80 relative z-10">
                      {artist.name.split(' ').map((n) => n[0]).join('')}
                    </span>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-base font-light text-background group-hover:text-gold transition-colors duration-300 truncate">
                      {artist.name}
                    </p>
                    <p className="font-sans text-xs text-neutral-500 uppercase tracking-widest mt-0.5">
                      {artist.discipline} · {artist.country}
                    </p>
                    <p className="font-sans text-xs text-neutral-600 mt-1 leading-snug line-clamp-1">
                      {artist.bio.slice(0, 60)}…
                    </p>
                  </div>
                  {/* Arrow */}
                  <div className="text-neutral-700 group-hover:text-gold transition-colors duration-300 flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Artworks section ────────────────────────────────────────────────────── */

function ArtworksSection({ artworks }: { artworks: Artwork[] }) {
  const displayed = artworks.slice(0, 4)

  return (
    <section className="py-20 bg-neutral-50 border-t border-neutral-200">
      <div className="container-premium">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex items-end justify-between gap-6 mb-10"
        >
          <div>
            <span className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-3 block">Sélection</span>
            <h2 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)' }}>
              Œuvres des artistes
            </h2>
            <div className="divider mt-4" />
          </div>
          <Button variant="ghost" size="md" rightIcon={<ArrowIcon />}>
            <Link href="/galerie">Toute la collection</Link>
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {displayed.map((artwork, i) => (
            <motion.div
              key={artwork.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
            >
              <Link href={`/galerie/${artwork.id}`} className="group block">
                <div className={cn(
                  'relative aspect-[3/4] overflow-hidden rounded-sm mb-4',
                  'bg-gradient-to-br', artwork.gradient,
                )}>
                  <div className="absolute inset-0 flex items-center justify-center opacity-15">
                    <ArtMotif seed={artwork.id} color={artwork.accentColor} />
                  </div>
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/8 transition-colors duration-300" />
                  {artwork.sold && (
                    <div className="absolute top-3 left-3">
                      <Badge variant="dark" label="Vendue" size="sm" />
                    </div>
                  )}
                </div>
                <h3 className="font-serif text-base font-light text-foreground group-hover:text-gold transition-colors duration-300 leading-tight">
                  {artwork.title}
                </h3>
                <p className="font-sans text-xs text-neutral-400 uppercase tracking-widest mt-0.5">{artwork.artist}</p>
                {!artwork.sold && (
                  <p className="font-serif text-sm font-light text-neutral-500 mt-1">{formatPrice(artwork.price)}</p>
                )}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Related exhibitions ─────────────────────────────────────────────────── */

function RelatedSection({ exhibitions }: { exhibitions: Exhibition[] }) {
  return (
    <section className="py-20 bg-background border-t border-neutral-100">
      <div className="container-premium">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <span className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-3 block">Programme</span>
          <h2 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)' }}>
            Autres expositions
          </h2>
          <div className="divider mt-4" />
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {exhibitions.map((expo, i) => {
            const cfg = STATUS_CONFIG[expo.status]
            return (
              <motion.div
                key={expo.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
              >
                <Link href={`/expositions/${expo.id}`} className="group block">
                  <div className={cn(
                    'relative overflow-hidden rounded-sm aspect-[4/3] mb-4',
                    'bg-gradient-to-br', expo.gradient,
                  )}>
                    <div className="absolute inset-0 flex items-center justify-center opacity-20">
                      <ExpoMotif color={expo.accentColor} size={130} />
                    </div>
                    <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/8 transition-colors duration-300" />
                    <div className="absolute top-3 left-3">
                      <Badge variant={cfg.variant} dot label={cfg.label} size="sm" />
                    </div>
                  </div>
                  <h3 className="font-serif text-lg font-light text-foreground group-hover:text-gold transition-colors duration-300 leading-tight">
                    {expo.title}
                  </h3>
                  <p className="font-sans text-xs text-gold uppercase tracking-widest mt-1">{expo.subtitle}</p>
                  <p className="font-sans text-xs text-neutral-400 mt-1.5">
                    {expo.dateStart} — {expo.dateEnd}
                  </p>
                </Link>
              </motion.div>
            )
          })}
        </div>

        <div className="flex justify-center mt-12">
          <Button variant="ghost" size="lg" rightIcon={<ArrowIcon />}>
            <Link href="/expositions">Tout le programme</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

/* ─── Info row ────────────────────────────────────────────────────────────── */

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 text-gold mt-0.5">{icon}</div>
      <div>
        <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-400">{label}</p>
        <p className="font-sans text-xs text-neutral-700 mt-0.5">{value}</p>
      </div>
    </div>
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

/* ─── Expo motif ──────────────────────────────────────────────────────────── */

function ExpoMotif({ color, size = 200 }: { color: string; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const r1 = size * 0.35
  const r2 = size * 0.225
  const r3 = size * 0.10
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" className="opacity-30" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r1} stroke={color} strokeWidth="1"   />
      <circle cx={cx} cy={cy} r={r2} stroke={color} strokeWidth="0.5" />
      <circle cx={cx} cy={cy} r={r3} stroke={color} strokeWidth="0.5" />
      <line x1={cx - r1} y1={cy}      x2={cx + r1} y2={cy}      stroke={color} strokeWidth="0.5" />
      <line x1={cx}      y1={cy - r1} x2={cx}      y2={cy + r1} stroke={color} strokeWidth="0.5" />
      <line x1={cx - r2} y1={cy - r2} x2={cx + r2} y2={cy + r2} stroke={color} strokeWidth="0.3" opacity="0.5" />
      <line x1={cx + r2} y1={cy - r2} x2={cx - r2} y2={cy + r2} stroke={color} strokeWidth="0.3" opacity="0.5" />
    </svg>
  )
}

/* ─── Icons ───────────────────────────────────────────────────────────────── */

const iconBase = (d: string) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

const ChevronRightIcon = () => iconBase('M9 18l6-6-6-6')
const ArrowIcon        = () => iconBase('M3 12h18M13 6l6 6-6 6')
const ClockIcon        = () => iconBase('M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 6v6l4 2')
const TicketIcon       = () => iconBase('M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z')
const LocationIcon     = () => iconBase('M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z')
const CalendarIcon     = () => iconBase('M3 4h18v18H3zM16 2v4M8 2v4M3 10h18')
