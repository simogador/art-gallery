'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { formatPrice } from '@/lib/utils/artworks'
import { Button, Badge, Modal } from '@/components/ui'
import { useCartStore } from '@/lib/store/cart'
import { ArtworkImage } from '@/components/ui'
import type { Artwork, Artist } from '@/lib/types'

type Tab = 'oeuvre' | 'artiste' | 'provenance'

const TABS: { id: Tab; label: string }[] = [
  { id: 'oeuvre',     label: 'L\'œuvre' },
  { id: 'artiste',    label: 'L\'artiste' },
  { id: 'provenance', label: 'Provenance' },
]

/* ─── Variants ────────────────────────────────────────────────────────────── */

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

const imageVariant = {
  hidden:  { opacity: 0, scale: 1.03 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] } },
}

/* ─── Component ───────────────────────────────────────────────────────────── */

interface Props {
  artwork: Artwork
  related: Artwork[]
  artist:  Artist | null
}

export function ArtworkDetail({ artwork, related, artist }: Props) {
  const [activeTab,    setActiveTab]    = useState<Tab>('oeuvre')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [contactOpen,  setContactOpen]  = useState(false)
  const [formSent,     setFormSent]     = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [addedToCart,  setAddedToCart]  = useState(false)

  const { addItem, removeItem, hasItem } = useCartStore()
  const inCart = hasItem(artwork.id)

  const handleContact = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((r) => setTimeout(r, 900))
    setLoading(false)
    setFormSent(true)
  }

  function handleAddToCart() {
    addItem({
      id:          artwork.id,
      title:       artwork.title,
      artist:      artwork.artist,
      artistId:    artwork.artistId,
      price:       artwork.price,
      imageUrl:    artwork.imageUrl,
      gradient:    artwork.gradient,
      accentColor: artwork.accentColor,
    })
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2000)
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
            <li><Link href="/galerie" className="hover:text-foreground transition-colors duration-200">Galerie</Link></li>
            <li aria-hidden="true"><ChevronRightIcon /></li>
            <li className="text-foreground truncate max-w-[200px]">{artwork.title}</li>
          </ol>
        </motion.nav>

        {/* ── Main split layout ── */}
        <div className="container-premium py-12 md:py-16">
          <div className="grid md:grid-cols-[1.1fr_1fr] lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-16 items-start">

            {/* ── LEFT — Image ── */}
            <div className="md:sticky md:top-28">
              <motion.div
                variants={imageVariant}
                initial="hidden"
                animate="visible"
                className="relative group cursor-zoom-in"
                onClick={() => setLightboxOpen(true)}
                role="button"
                aria-label="Agrandir l'image"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setLightboxOpen(true)}
              >
                {/* Main visual */}
                <div className={cn(
                  'relative overflow-hidden rounded-sm aspect-[4/5]',
                )}>
                  <ArtworkImage
                    imageUrl={artwork.imageUrl}
                    title={artwork.title}
                    gradient={artwork.gradient}
                    accentColor={artwork.accentColor}
                    priority
                    sizes="(max-width: 768px) 100vw, 55vw"
                  />

                  {/* Hover zoom hint */}
                  <motion.div
                    className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors duration-400 flex items-center justify-center"
                  >
                    <motion.div
                      className="bg-background/90 backdrop-blur-sm rounded-sm px-3 py-2 flex items-center gap-2"
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileHover={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ZoomIcon />
                      <span className="font-sans text-xs uppercase tracking-widest">Agrandir</span>
                    </motion.div>
                  </motion.div>

                  {/* Sold overlay */}
                  {artwork.sold && (
                    <div className="absolute inset-0 bg-foreground/40 flex items-center justify-center">
                      <span className="font-serif text-2xl font-light text-background border border-background/40 px-6 py-3 rounded-sm">
                        Vendue
                      </span>
                    </div>
                  )}
                </div>

                {/* Thumbnail strip */}
                <div className="flex gap-2 mt-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        'relative flex-1 aspect-square overflow-hidden rounded-sm cursor-pointer',
                        i === 0 ? 'ring-1 ring-foreground ring-offset-1' : 'opacity-50 hover:opacity-80 transition-opacity duration-200',
                      )}
                    >
                      <ArtworkImage
                        imageUrl={i === 0 ? artwork.imageUrl : null}
                        title={artwork.title}
                        gradient={artwork.gradient}
                        accentColor={artwork.accentColor}
                        sizes="10vw"
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* ── RIGHT — Info panel ── */}
            <motion.div
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
              initial="hidden"
              animate="visible"
            >
              {/* Status badge */}
              <motion.div custom={0} variants={fadeUp} className="flex items-center gap-3 mb-5">
                {artwork.featured && !artwork.sold && (
                  <Badge variant="gold" dot label="Coup de cœur" />
                )}
                {artwork.sold
                  ? <Badge variant="dark" label="Vendue" />
                  : <Badge variant="default" dot label="Disponible" />
                }
                <Badge variant="default" label={artwork.medium} />
              </motion.div>

              {/* Title */}
              <motion.h1
                custom={1} variants={fadeUp}
                className="font-serif font-light text-foreground leading-tight"
                style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}
              >
                {artwork.title}
              </motion.h1>

              {/* Artist */}
              <motion.div custom={2} variants={fadeUp} className="mt-2 flex items-center gap-3">
                <Link
                  href={`/artistes/${artwork.artistId}`}
                  className="font-sans text-sm text-neutral-500 hover:text-gold transition-colors duration-300 uppercase tracking-widest"
                >
                  {artwork.artist}
                </Link>
                <span className="text-neutral-300">·</span>
                <span className="font-sans text-sm text-neutral-400">{artwork.year}</span>
              </motion.div>

              <motion.div custom={3} variants={fadeUp} className="my-6">
                <div className="divider" />
              </motion.div>

              {/* Price */}
              <motion.div custom={4} variants={fadeUp} className="mb-8">
                {artwork.sold ? (
                  <div>
                    <p className="font-sans text-xs uppercase tracking-widest text-neutral-400 mb-1">Prix de vente</p>
                    <p className="font-serif text-3xl font-light text-neutral-400 line-through decoration-1">
                      {formatPrice(artwork.price)}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-sans text-xs uppercase tracking-widest text-neutral-400 mb-1">Prix</p>
                    <p className="font-serif text-3xl font-light text-foreground">
                      {formatPrice(artwork.price)}
                    </p>
                    <p className="font-sans text-xs text-neutral-400 mt-1">
                      Frais de port et d&apos;assurance inclus · TVA non applicable
                    </p>
                  </div>
                )}
              </motion.div>

              {/* Quick specs */}
              <motion.div custom={5} variants={fadeUp} className="grid grid-cols-2 gap-3 mb-8">
                {[
                  { label: 'Technique',  value: artwork.technique },
                  { label: 'Format',     value: artwork.size },
                  { label: 'Médium',     value: artwork.medium },
                  { label: 'Année',      value: String(artwork.year) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-neutral-50 border border-neutral-100 rounded-sm px-4 py-3">
                    <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-400">{label}</p>
                    <p className="font-sans text-sm text-foreground mt-0.5 leading-snug">{value}</p>
                  </div>
                ))}
              </motion.div>

              {/* CTA buttons */}
              <motion.div custom={6} variants={fadeUp} className="flex flex-col gap-3 mb-10">
                {!artwork.sold ? (
                  <>
                    {inCart ? (
                      <div className="flex gap-3">
                        <Link href="/panier" className="flex-1">
                          <Button variant="primary" size="lg" fullWidth rightIcon={<ArrowIcon />}>
                            Voir le panier
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="lg"
                          onClick={() => removeItem(artwork.id)}
                          aria-label="Retirer du panier"
                        >
                          <TrashIcon />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        onClick={handleAddToCart}
                        rightIcon={addedToCart ? <CheckIcon /> : <CartIcon />}
                      >
                        {addedToCart ? 'Ajouté !' : 'Ajouter au panier'}
                      </Button>
                    )}
                    <Button variant="ghost" size="md" fullWidth onClick={() => setContactOpen(true)}>
                      Prendre rendez-vous
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="lg" fullWidth onClick={() => setContactOpen(true)}>
                    Être notifié d&apos;une œuvre similaire
                  </Button>
                )}
                <div className="flex items-center gap-3 pt-1">
                  <button className="flex items-center gap-2 font-sans text-xs uppercase tracking-widest text-neutral-400 hover:text-foreground transition-colors duration-200">
                    <HeartIcon /> Sauvegarder
                  </button>
                  <span className="text-neutral-200">·</span>
                  <button className="flex items-center gap-2 font-sans text-xs uppercase tracking-widest text-neutral-400 hover:text-foreground transition-colors duration-200">
                    <ShareIcon /> Partager
                  </button>
                </div>
              </motion.div>

              {/* Tabs */}
              <motion.div custom={7} variants={fadeUp}>
                <div className="flex border-b border-neutral-200 mb-6">
                  {TABS.map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={cn(
                        'relative px-4 py-3',
                        'font-sans text-xs uppercase tracking-widest',
                        'transition-colors duration-300',
                        activeTab === id ? 'text-foreground' : 'text-neutral-400 hover:text-neutral-600',
                      )}
                    >
                      {label}
                      {activeTab === id && (
                        <motion.div
                          layoutId="artwork-tab"
                          className="absolute bottom-0 left-0 right-0 h-px bg-foreground"
                          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                        />
                      )}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                  >
                    {activeTab === 'oeuvre'     && <TabOeuvre artwork={artwork} />}
                    {activeTab === 'artiste'    && <TabArtiste artist={artist} artworkArtist={artwork.artist} />}
                    {activeTab === 'provenance' && <TabProvenance artwork={artwork} />}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* ── Related artworks ── */}
        {related.length > 0 && (
          <RelatedSection artworks={related} />
        )}
      </div>

      {/* ── Lightbox ── */}
      <Modal
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        size="xl"
        title={artwork.title}
        subtitle={`${artwork.artist} · ${artwork.year}`}
      >
        <div className="aspect-[4/3] w-full overflow-hidden rounded-sm relative">
          <ArtworkImage
            imageUrl={artwork.imageUrl}
            title={artwork.title}
            gradient={artwork.gradient}
            accentColor={artwork.accentColor}
            sizes="90vw"
          />
        </div>
      </Modal>

      {/* ── Contact Modal ── */}
      <Modal
        open={contactOpen}
        onClose={() => { setContactOpen(false); setFormSent(false) }}
        title={artwork.sold ? 'M\'alerter' : 'Acquérir cette œuvre'}
        subtitle={artwork.title}
        size="md"
        footer={
          !formSent ? (
            <>
              <Button variant="ghost" size="md" onClick={() => setContactOpen(false)}>Annuler</Button>
              <Button variant="gold" size="md" form="contact-form" type="submit" loading={loading}>
                Envoyer la demande
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
              <CheckCircleIcon />
            </div>
            <div>
              <p className="font-serif text-xl font-light">Demande envoyée</p>
              <p className="font-sans text-sm text-neutral-500 mt-2">
                Notre équipe vous contactera dans les 24h ouvrées.
              </p>
            </div>
          </motion.div>
        ) : (
          <form id="contact-form" onSubmit={handleContact} className="flex flex-col gap-4">
            <p className="font-sans text-sm text-neutral-500 mb-2">
              {artwork.sold
                ? `Indiquez votre contact pour être alerté dès qu'une œuvre similaire à "${artwork.title}" est disponible.`
                : `Renseignez vos coordonnées pour engager le processus d'acquisition de "${artwork.title}".`
              }
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Prénom" name="firstname" placeholder="Marie" required />
              <FormField label="Nom" name="lastname" placeholder="Dupont" required />
            </div>
            <FormField label="Email" name="email" type="email" placeholder="marie@exemple.fr" required />
            <FormField label="Téléphone" name="phone" type="tel" placeholder="+33 6 00 00 00 00" />
            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-xs font-medium uppercase tracking-widest text-neutral-500">
                Message (optionnel)
              </label>
              <textarea
                name="message"
                rows={3}
                placeholder="Questions, délai, lieu de livraison souhaité…"
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

/* ─── Tabs ────────────────────────────────────────────────────────────────── */

function TabOeuvre({ artwork }: { artwork: Artwork }) {
  return (
    <div className="space-y-5">
      <div className="font-sans text-sm text-neutral-600 leading-relaxed text-pretty whitespace-pre-line">
        {artwork.description}
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        {artwork.tags.map((tag) => (
          <span key={tag} className="font-sans text-[10px] uppercase tracking-widest border border-neutral-200 text-neutral-500 px-3 py-1 rounded-sm">
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

function TabArtiste({ artist, artworkArtist }: { artist: Artist | null | undefined; artworkArtist: string }) {
  if (!artist) {
    return <p className="font-sans text-sm text-neutral-500">{artworkArtist}</p>
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {/* Monogram avatar */}
        <div className={cn(
          'w-14 h-14 rounded-sm flex-shrink-0 overflow-hidden flex items-center justify-center',
          'bg-gradient-to-br', artist.gradient,
        )}>
          <span className="font-serif text-xl font-light text-background/70">
            {artist.name.split(' ').map((n: string) => n[0]).join('')}
          </span>
        </div>
        <div>
          <p className="font-serif text-lg font-light text-foreground">{artist.name}</p>
          <p className="font-sans text-xs text-neutral-400 uppercase tracking-widest mt-0.5">
            {artist.discipline} · {artist.country}
          </p>
        </div>
      </div>
      <p className="font-sans text-sm text-neutral-600 leading-relaxed text-pretty">
        {artist.bio}
      </p>
      <div className="grid grid-cols-3 gap-3 pt-2">
        {[
          { label: 'Œuvres',        value: artist.worksCount },
          { label: 'Expositions',   value: artist.exhibitions },
          { label: 'Actif depuis',  value: artist.yearsActive.split('—')[0].trim() },
        ].map(({ label, value }) => (
          <div key={label} className="bg-neutral-50 border border-neutral-100 rounded-sm px-3 py-2 text-center">
            <p className="font-serif text-lg font-light text-foreground">{value}</p>
            <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-400">{label}</p>
          </div>
        ))}
      </div>
      <div className="pt-4">
        <Link
          href={`/artistes/${artist.id}`}
          className="inline-flex items-center gap-1.5 font-sans text-xs uppercase tracking-widest text-gold hover:underline underline-offset-4"
        >
          Voir le profil complet
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  )
}

function TabProvenance({ artwork }: { artwork: Artwork }) {
  return (
    <div className="space-y-4">
      {[
        {
          icon: <CertificateIcon />,
          title: 'Certificat d\'authenticité',
          desc: 'Chaque œuvre est livrée avec un certificat numéroté, signé par l\'artiste, attestant de son authenticité et de sa provenance directe.',
        },
        {
          icon: <ShieldIcon />,
          title: 'Garantie galerie',
          desc: `Acquise directement auprès de ${artwork.artist} par la galerie en ${artwork.year}. Aucun intermédiaire. Provenance certifiée.`,
        },
        {
          icon: <TruckIcon />,
          title: 'Transport & assurance',
          desc: 'Livraison assurée à 100 % de la valeur d\'achat. Emballage spécialisé par des transporteurs d\'art agréés, partout en Europe.',
        },
        {
          icon: <RotateIcon />,
          title: 'Droit de retour',
          desc: 'Vous disposez de 14 jours pour retourner l\'œuvre si elle ne correspond pas à vos attentes, sans justification requise.',
        },
      ].map(({ icon, title, desc }) => (
        <div key={title} className="flex gap-4 p-4 bg-neutral-50 border border-neutral-100 rounded-sm">
          <div className="flex-shrink-0 text-gold mt-0.5">{icon}</div>
          <div>
            <p className="font-sans text-sm font-medium text-foreground">{title}</p>
            <p className="font-sans text-xs text-neutral-500 mt-1 leading-relaxed">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Related section ─────────────────────────────────────────────────────── */

function RelatedSection({ artworks }: { artworks: Artwork[] }) {
  return (
    <section className="border-t border-neutral-200 py-16 md:py-20 bg-neutral-50">
      <div className="container-premium">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <p className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-2">Sélection</p>
          <h2 className="font-serif text-2xl font-light text-foreground">Vous pourriez aimer</h2>
          <div className="divider mt-3" />
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {artworks.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <Link href={`/galerie/${a.id}`} className="group block">
                {/* Image */}
                <div className="relative aspect-[3/4] overflow-hidden rounded-sm mb-4">
                  <ArtworkImage
                    imageUrl={a.imageUrl}
                    title={a.title}
                    gradient={a.gradient}
                    accentColor={a.accentColor}
                    sizes="(max-width: 640px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/8 transition-colors duration-400" />
                  {a.sold && (
                    <div className="absolute top-3 left-3">
                      <Badge variant="dark" label="Vendue" size="sm" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-serif text-lg font-light text-foreground group-hover:text-gold transition-colors duration-300">
                      {a.title}
                    </h3>
                    <p className="font-sans text-xs text-neutral-400 uppercase tracking-widest mt-0.5">
                      {a.artist}
                    </p>
                  </div>
                  {!a.sold && (
                    <p className="font-serif text-base font-light text-foreground flex-shrink-0">
                      {formatPrice(a.price)}
                    </p>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-center mt-12">
          <Button variant="ghost" size="lg" rightIcon={<ArrowIcon />}>
            <Link href="/#galerie">Toute la collection</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

/* ─── Form field ──────────────────────────────────────────────────────────── */

function FormField({
  label, name, type = 'text', placeholder, required,
}: {
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

function LargeArtMotif({ color, seed, size = 200 }: { color: string; seed: string | number; size?: number }) {
  const h = String(seed).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const r1 = (size * 0.35) + (h % (size * 0.1))
  const r2 = r1 * 0.6
  const cx = size / 2
  const cy = size / 2

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r1} stroke={color} strokeWidth="0.8" opacity="0.6" />
      <circle cx={cx} cy={cy} r={r2} stroke={color} strokeWidth="0.5" opacity="0.4" />
      <line x1={cx - r1} y1={cy} x2={cx + r1} y2={cy} stroke={color} strokeWidth="0.4" opacity="0.35" />
      <line x1={cx} y1={cy - r1} x2={cx} y2={cy + r1} stroke={color} strokeWidth="0.4" opacity="0.35" />
      {h % 2 === 0 && (
        <rect
          x={cx - r2 * 0.7} y={cy - r2 * 0.7}
          width={r2 * 1.4} height={r2 * 1.4}
          stroke={color} strokeWidth="0.5" opacity="0.3"
        />
      )}
      <circle cx={cx} cy={cy} r={4} fill={color} opacity="0.5" />
    </svg>
  )
}

/* ─── Icons ───────────────────────────────────────────────────────────────── */

const icon = (d: string, opts?: { fill?: boolean; size?: number }) => {
  const s = opts?.size ?? 16
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={opts?.fill ? 'currentColor' : 'none'}
      stroke={opts?.fill ? 'none' : 'currentColor'} strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const ChevronRightIcon   = () => icon('M9 18l6-6-6-6')
const ArrowIcon          = () => icon('M3 12h18M13 6l6 6-6 6')
const ZoomIcon           = () => icon('M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zm-2 3l2 2')
const HeartIcon          = () => icon('M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z')
const ShareIcon          = () => icon('M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13')
const CheckCircleIcon    = () => icon('M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3', { size: 28 })
const CertificateIcon    = () => icon('M12 15l-2 5-3-3-5 2 2-5-3-3 5-2 2-5 3 3 5-2-2 5zM15 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0z')
const ShieldIcon         = () => icon('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z')
const TruckIcon          = () => icon('M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z')
const RotateIcon         = () => icon('M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15')
const CartIcon           = () => icon('M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0')
const CheckIcon          = () => icon('M20 6 9 17l-5-5')
const TrashIcon          = () => icon('M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2')
