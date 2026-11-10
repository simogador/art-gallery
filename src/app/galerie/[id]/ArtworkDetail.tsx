'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { Button, Badge, UniteToggle, useUnite } from '@/components/ui'
import { formaterDimensionsDouble, formaterMontant, fr } from '@/lib/i18n'
import { useCartStore } from '@/lib/store/cart'
import { ArtworkImage } from '@/components/ui'
import { photosDeFiche } from '@/lib/catalogue/mappers'
import { CarrouselPhotos } from './CarrouselPhotos'
import { RangeeFiche } from './RangeeFiche'
import { SectionsFiche } from './SectionsFiche'
import { BarreActions, type EtatBarre } from './BarreActions'
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
  /** Bouton Conseil WhatsApp rendu par le serveur (story 4.4). */
  conseil?: React.ReactNode
  /** Le Lot 2 est ouvert (`lot2Ouvert()`, lu par la page) : seul cas où l'ancien bouton d'ajout au panier reste dans la barre. */
  lot2Ouvert?: boolean
}

export function ArtworkDetail({ artwork, related, pays, conseil, lot2Ouvert = false }: Props) {
  const [addedToCart,  setAddedToCart]  = useState(false)

  const { addItem, removeItem, hasItem } = useCartStore()
  const inCart = hasItem(artwork.id)
  const etat: EtatBarre = !artwork.sold ? 'disponible' : artwork.reservee ? 'reservee' : 'vendue'
  // Story 3.2 : les deux unités toujours visibles, celle choisie d'abord (« 24 × 29,9 in » puis « 61 × 76 cm »).
  const tailles = formaterDimensionsDouble(artwork, useUnite())
  // Story 3.5 : photos de prise de vue ; repli sur l'image principale quand la lecture n'en a pas.
  const photos = artwork.photos ?? photosDeFiche(undefined, artwork.imageUrl)

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

  // Story 4.7 : ancien bouton d'ajout au panier (décision du porteur du 2026-11-10), refait en Epic 7.
  const achat = inCart ? (
    <div className="flex gap-3">
      <Link href="/panier" className="flex-1">
        <Button variant="primary" size="lg" fullWidth rightIcon={<ArrowIcon />}>
          Voir le panier
        </Button>
      </Link>
      <Button variant="ghost" size="lg" onClick={() => removeItem(artwork.id)} aria-label="Retirer du panier">
        <TrashIcon />
      </Button>
    </div>
  ) : (
    <Button variant="primary" size="lg" fullWidth onClick={handleAddToCart} rightIcon={addedToCart ? <CheckIcon /> : <CartIcon />}>
      {addedToCart ? 'Ajouté !' : 'Ajouter au panier'}
    </Button>
  )

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
              {/* Story 4.7 : barre d'actions (fixe en bas sur mobile, collante dès lg). Hors des `motion.div`
                  enfants : une transformation parente ferait perdre son ancrage à la barre fixe. */}
              <BarreActions
                etat={etat}
                slug={artwork.id}
                artiste={{ slug: artwork.artistId, nom: artwork.artist }}
                conseil={conseil}
                achat={lot2Ouvert ? achat : undefined}
              />

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
const CartIcon           = () => icon('M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0')
const CheckIcon          = () => icon('M20 6 9 17l-5-5')
const TrashIcon          = () => icon('M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2')
