'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils/cn'
import { fr } from '@/lib/i18n'
import { ArtworkImage } from '@/components/ui'
import type { PhotoFiche } from '@/lib/types'

// Story 3.5 (FR-1, UX-DR17) : carrousel de photos de la fiche. Défilement natif (scroll-snap : le
// balayage est celui du navigateur), boutons précédent/suivant, jamais de défilement automatique,
// compteur « 1/4 » et légende de la prise de vue. Un appui sur la photo ouvre le plein écran
// (`<dialog>` natif) où l'on zoome sans bibliothèque. Une seule photo : ni compteur ni boutons.

type Props = {
  photos: PhotoFiche[]
  titre: string
  artiste: string
  gradient: string
  accentColor: string
  vendue?: boolean
}

const ZOOM_MAX = 3
const MOINS = '−'
const PLUS = '+'

export function CarrouselPhotos({ photos, titre, artiste, gradient, accentColor, vendue = false }: Props) {
  const textes = fr.fiche.photos
  const liste: (PhotoFiche | null)[] = photos.length > 0 ? photos : [null]
  const total = liste.length
  const piste = useRef<HTMLDivElement>(null)
  const [indexBrut, setIndex] = useState(0)
  const index = Math.min(indexBrut, total - 1)
  const [plein, setPlein] = useState(false)

  const legende = (p: PhotoFiche | null) => textes.legendes[p?.type ?? 'principale']
  const alt = (p: PhotoFiche | null) => textes.alt(titre, artiste, legende(p))

  // Position suivie sur le défilement natif (balayage compris).
  const surDefilement = useCallback(() => {
    const el = piste.current
    if (!el || el.clientWidth === 0) return
    setIndex(Math.min(total - 1, Math.max(0, Math.round(Math.abs(el.scrollLeft) / el.clientWidth))))
  }, [total])

  const aller = useCallback(
    (cible: number) => {
      const el = piste.current
      if (!el) return
      const i = Math.min(total - 1, Math.max(0, cible))
      const reduit = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollTo({ left: i * el.clientWidth * (getComputedStyle(el).direction === 'rtl' ? -1 : 1), behavior: reduit ? 'auto' : 'smooth' })
      setIndex(i)
    },
    [total],
  )

  return (
    <div className="w-full">
      <div className="relative">
        <div
          ref={piste}
          onScroll={surDefilement}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') aller(index - 1)
            else if (e.key === 'ArrowRight') aller(index + 1)
            else return
            e.preventDefault()
          }}
          tabIndex={0}
          role="group"
          aria-roledescription="carrousel"
          aria-label={textes.carrousel}
          className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {liste.map((p, i) => (
            <div
              key={`${i}-${p?.url ?? 'repli'}`}
              role="group"
              aria-roledescription="diapositive"
              aria-label={total > 1 ? textes.compteur(i + 1, total) : undefined}
              aria-hidden={i === index ? undefined : true}
              className="relative w-full shrink-0 snap-center aspect-[4/5] overflow-hidden rounded-sm bg-neutral-100"
            >
              <button
                type="button"
                onClick={() => {
                  setIndex(i)
                  setPlein(true)
                }}
                aria-label={textes.agrandir}
                tabIndex={i === index ? undefined : -1}
                className="absolute inset-0 z-[1] cursor-zoom-in"
              />
              <ArtworkImage
                imageUrl={p?.url ?? null}
                title={titre}
                alt={alt(p)}
                gradient={gradient}
                accentColor={accentColor}
                priority={i === 0}
                sizes="(max-width: 768px) 100vw, 55vw"
                className="object-contain"
              />
            </div>
          ))}
        </div>

        {vendue && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/40">
            <span className="font-serif text-heading-sm text-background border border-background/40 px-6 py-3 rounded-sm">
              {fr.fiche.etat.vendue}
            </span>
          </div>
        )}

        {total > 1 && (
          <>
            <BoutonFleche sens="precedent" desactive={index === 0} onClick={() => aller(index - 1)} />
            <BoutonFleche sens="suivant" desactive={index === total - 1} onClick={() => aller(index + 1)} />
          </>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="font-sans text-caption text-neutral-600" aria-live="polite">
          {legende(liste[index])}
        </p>
        {total > 1 && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5" aria-hidden="true">
              {liste.map((_, i) => (
                <span key={i} className={cn('block h-1.5 w-1.5 rounded-full', i === index ? 'bg-foreground' : 'bg-neutral-300')} />
              ))}
            </span>
            <p className="font-sans text-caption text-neutral-600">{textes.compteur(index + 1, total)}</p>
          </div>
        )}
      </div>

      <PleinEcran
        ouvert={plein}
        onFermer={() => setPlein(false)}
        photo={liste[index]}
        titre={titre}
        alt={alt(liste[index])}
        legende={legende(liste[index])}
        compteur={total > 1 ? textes.compteur(index + 1, total) : null}
      />
    </div>
  )
}

function BoutonFleche({ sens, desactive, onClick }: { sens: 'precedent' | 'suivant'; desactive: boolean; onClick: () => void }) {
  const textes = fr.fiche.photos
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      aria-label={sens === 'precedent' ? textes.precedente : textes.suivante}
      className={cn(
        'absolute top-1/2 z-[2] -translate-y-1/2 flex items-center justify-center',
        'min-h-touch-target min-w-touch-target rounded-sm bg-background/90 text-foreground',
        'disabled:opacity-0 disabled:pointer-events-none transition-opacity duration-200',
        sens === 'precedent' ? 'start-2' : 'end-2',
      )}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="rtl:-scale-x-100">
        <path d={sens === 'precedent' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
      </svg>
    </button>
  )
}

/* ── Plein écran : <dialog> natif, zoom sans bibliothèque ───────────────── */

type PropsPlein = {
  ouvert: boolean
  onFermer: () => void
  photo: PhotoFiche | null
  titre: string
  alt: string
  legende: string
  compteur: string | null
}

function PleinEcran({ ouvert, onFermer, photo, titre, alt, legende, compteur }: PropsPlein) {
  const textes = fr.fiche.photos
  const dialogue = useRef<HTMLDialogElement>(null)
  const [zoom, setZoom] = useState(1)
  const ligneLegende = compteur ? legende + fr.commun.separateur + compteur : legende

  useEffect(() => {
    const d = dialogue.current
    if (!d) return
    if (ouvert && !d.open) {
      setZoom(1)
      d.showModal()
    } else if (!ouvert && d.open) {
      d.close()
    }
  }, [ouvert])

  // Défilement de la page bloqué tant que le plein écran est ouvert.
  useEffect(() => {
    if (!ouvert) return
    const avant = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = avant
    }
  }, [ouvert])

  // Un appui sur l'image alterne entre la taille d'écran et le zoom.
  const basculer = () => setZoom((z) => (z > 1 ? 1 : 2))

  return (
    <dialog
      ref={dialogue}
      aria-label={textes.plein(titre)}
      onClose={onFermer}
      onClick={(e) => {
        if (e.target === dialogue.current) dialogue.current?.close()
      }}
      className="m-0 h-full max-h-none w-full max-w-none bg-foreground p-0 text-background backdrop:bg-foreground open:animate-fade-in"
    >
      {ouvert && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 p-3">
            <p className="font-sans text-caption text-background">{ligneLegende}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(1, z - 1))}
                disabled={zoom <= 1}
                aria-label={textes.dezoomer}
                className="fond-sombre min-h-touch-target min-w-touch-target border border-neutral-500 rounded-sm font-sans text-button text-background disabled:opacity-40"
              >
                <span aria-hidden="true">{MOINS}</span>
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 1))}
                disabled={zoom >= ZOOM_MAX}
                aria-label={textes.zoomer}
                className="fond-sombre min-h-touch-target min-w-touch-target border border-neutral-500 rounded-sm font-sans text-button text-background disabled:opacity-40"
              >
                <span aria-hidden="true">{PLUS}</span>
              </button>
              <button
                type="button"
                onClick={() => dialogue.current?.close()}
                className="fond-sombre min-h-touch-target min-w-touch-target border border-neutral-500 rounded-sm px-3 font-sans text-button text-background"
              >
                {textes.fermer}
              </button>
            </div>
          </div>
          {/* Zone défilante : le zoom agrandit l'image, on la parcourt au doigt ; le pincement du navigateur reste permis. */}
          <div className="min-h-0 flex-1 overflow-auto [touch-action:pan-x_pan-y_pinch-zoom]">
            <div className="flex min-h-full items-center justify-center" style={{ width: `${zoom * 100}%` }}>
              {photo ? (
                <button type="button" onClick={basculer} aria-label={zoom > 1 ? textes.dezoomer : textes.zoomer} className={cn('block w-full', zoom > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in')}>
                  <Image
                    src={photo.url}
                    alt={alt}
                    width={photo.largeur ?? 1600}
                    height={photo.hauteur ?? 2000}
                    sizes={`${zoom * 100}vw`}
                    className="mx-auto h-auto max-h-full w-full object-contain"
                    style={zoom === 1 ? { maxHeight: 'calc(100vh - 5rem)', width: 'auto' } : undefined}
                  />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </dialog>
  )
}
