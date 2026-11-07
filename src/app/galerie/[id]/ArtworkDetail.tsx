'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { Button, Badge, Modal, UniteToggle, useUnite } from '@/components/ui'
import { formaterDimensionsDouble, formaterMontant, fr } from '@/lib/i18n'
import { useCartStore } from '@/lib/store/cart'
import { ArtworkImage } from '@/components/ui'
import { photosDeFiche } from '@/lib/catalogue/mappers'
import { CarrouselPhotos } from './CarrouselPhotos'
import { RangeeFiche } from './RangeeFiche'
import { SectionsFiche } from './SectionsFiche'
import type { Artwork } from '@/lib/types'

/* ─── Variants ────────────────────────────────────────────────────────────── */

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

/* ─── Component ───────────────────────────────────────────────────────────── */

interface Props {
  artwork: Artwork
  related: Artwork[]
  /** Pays de livraison du visiteur (cookie `pays`, France par défaut), nom français compris (story 3.3). */
  pays:    { code: string; nom: string }
}

export function ArtworkDetail({ artwork, related, pays }: Props) {
  const [contactOpen,  setContactOpen]  = useState(false)
  const [formSent,     setFormSent]     = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [addedToCart,  setAddedToCart]  = useState(false)

  const { addItem, removeItem, hasItem } = useCartStore()
  const inCart = hasItem(artwork.id)
  // Story 3.2 : les deux unités toujours visibles, celle choisie d'abord (« 24 × 29,9 in » puis « 61 × 76 cm »).
  const tailles = formaterDimensionsDouble(artwork, useUnite())
  // Story 3.5 : photos de prise de vue ; repli sur l'image principale quand la lecture n'en a pas.
  const photos = artwork.photos ?? photosDeFiche(undefined, artwork.imageUrl)

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
          {/* Story 3.5 : titre et rangée sont dans le HTML avant les photos (ils s'affichent d'abord) ;
              à l'écran les photos passent en tête (mobile) ou à gauche (md et plus). */}
          <div className="grid md:grid-cols-[1.1fr_1fr] lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-16 items-start">

            {/* ── Info panel ── */}
            <motion.div
              className="md:col-start-2 md:row-start-1"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
              initial="hidden"
              animate="visible"
            >
              {/* Libellé de disponibilité (point + libellé) */}
              <motion.div custom={0} variants={fadeUp} className="flex items-center gap-3 mb-3">
                {artwork.featured && !artwork.sold && (
                  <Badge variant="gold" dot label={fr.fiche.coupDeCoeur} />
                )}
                <p className="flex items-center gap-2 font-sans text-sm text-neutral-600">
                  <span aria-hidden="true" className={cn('block h-2 w-2 rounded-full', artwork.sold ? 'border border-foreground' : 'bg-foreground')} />
                  {artwork.sold ? fr.fiche.etat.vendue : fr.fiche.etat.disponible}
                </p>
              </motion.div>

              {/* Title */}
              <motion.h1
                custom={1} variants={fadeUp}
                className="font-serif text-display-sm text-foreground"
              >
                {artwork.title}
              </motion.h1>

              {/* Artist */}
              <motion.div custom={2} variants={fadeUp} className="mt-2 flex items-center gap-3">
                <Link
                  href={`/artistes/${artwork.artistId}`}
                  className="font-sans text-sm text-neutral-600 hover:text-foreground transition-colors duration-300 uppercase tracking-widest"
                >
                  {artwork.artist}
                </Link>
                <span className="text-neutral-500">·</span>
                <span className="font-sans text-sm text-neutral-600">{artwork.year}</span>
              </motion.div>

              <motion.div custom={3} variants={fadeUp} className="my-6">
                <div className="divider" />
              </motion.div>

              {/* Story 3.5 : rangée Taille / Prix livré / Délai (prix livré calculé par le module livraison). */}
              <motion.div custom={4} variants={fadeUp} className="mb-4">
                {/* Œuvre vendue (story 3.7) : la case Taille seule, aucun prix ni délai. */}
                <RangeeFiche artwork={artwork} pays={pays} vendue={artwork.sold} />
              </motion.div>

              {/* Technique, médium, année ; bascule cm / in */}
              <motion.div custom={5} variants={fadeUp} className="grid grid-cols-2 gap-3 mb-8">
                {[
                  { label: 'Technique',  value: artwork.technique },
                  { label: 'Médium',     value: artwork.medium },
                  { label: 'Année',      value: String(artwork.year) },
                ].filter(({ value }) => value).map(({ label, value }) => (
                  <div key={label} className="bg-neutral-50 border border-neutral-100 rounded-sm px-4 py-3">
                    <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-600">{label}</p>
                    <p className="font-sans text-sm text-foreground mt-0.5 leading-snug">{value}</p>
                  </div>
                ))}
                {tailles && (
                  <div className="col-span-2 flex items-center justify-between gap-3">
                    <p id="libelle-unite" className="font-sans text-xs text-neutral-600">{fr.unite.libelle}</p>
                    <UniteToggle libelleId="libelle-unite" />
                  </div>
                )}
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
                ) : null}
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

              {/* Story 3.6 : les quatre questions (sections natives, seule la première ouverte). */}
              <motion.div custom={7} variants={fadeUp}>
                <SectionsFiche key={artwork.id} artwork={artwork} pays={pays} vendue={artwork.sold} />
              </motion.div>
            </motion.div>

            {/* ── Photos : en tête sur mobile, à gauche et collantes dès md ── */}
            <div className="order-first md:order-none md:col-start-1 md:row-start-1 md:sticky md:top-28">
              <CarrouselPhotos
                photos={photos}
                titre={artwork.title}
                artiste={artwork.artist}
                gradient={artwork.gradient}
                accentColor={artwork.accentColor}
                vendue={artwork.sold}
              />
            </div>
          </div>
        </div>

        {/* ── Related artworks ── */}
        {related.length > 0 && (
          <RelatedSection artworks={related} paysNom={pays.nom} vendue={artwork.sold} artiste={{ slug: artwork.artistId, nom: artwork.artist }} />
        )}
      </div>

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

/* ─── Related section ─────────────────────────────────────────────────────── */

function RelatedSection({ artworks, paysNom, vendue, artiste }: {
  artworks: Artwork[]; paysNom: string; vendue: boolean; artiste: { slug: string; nom: string }
}) {
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
          <h2 className="font-serif text-2xl font-light text-foreground">
            {vendue ? fr.fiche.vendue.proches : fr.fiche.vendue.pourriezAimer}
          </h2>
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
                  {/* Story 3.3 : prix livré vers le pays choisi (module livraison), comme la fiche. */}
                  {!a.sold && a.prixLivre?.livree && (
                    <p className="font-serif text-base font-light text-foreground flex-shrink-0">
                      {formaterMontant(a.prixLivre.totalCentimes, a.prixLivre.devise)}
                    </p>
                  )}
                  {!a.sold && a.prixLivre?.livree === false && (
                    <p className="font-sans text-xs text-neutral-600 flex-shrink-0">
                      {a.prixLivre.raison === 'sans_prix' ? formaterMontant(null) : fr.livraison.pasDeLivraison(paysNom)}
                    </p>
                  )}
                </div>
                {!a.sold && a.prixLivre?.livree && (
                  <p className="font-sans text-xs text-neutral-600 mt-1">{fr.livraison.droitsNonInclus}</p>
                )}
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-center mt-12">
          {vendue ? (
            <Link
              href={`/artistes/${artiste.slug}`}
              className="inline-flex min-h-touch-target items-center font-sans text-sm text-foreground underline underline-offset-4"
            >
              {fr.fiche.vendue.lienArtiste(artiste.nom)}
            </Link>
          ) : (
            <Button variant="ghost" size="lg" rightIcon={<ArrowIcon />}>
              <Link href="/#galerie">Toute la collection</Link>
            </Button>
          )}
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
const CartIcon           = () => icon('M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0')
const CheckIcon          = () => icon('M20 6 9 17l-5-5')
const TrashIcon          = () => icon('M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2')
