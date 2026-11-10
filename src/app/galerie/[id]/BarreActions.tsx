'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { fr } from '@/lib/i18n'

// Story 4.7 (FR-6, UX-DR12, UX-DR13) : barre d'actions de la fiche. Fixe en bas sur mobile (zone sûre
// respectée, masquée pendant la saisie dans un champ), bloc collant en haut de la colonne d'informations
// dès `lg`, jamais fixe. Une seule action principale : le Conseil WhatsApp, rendu par le serveur et reçu
// en propriété ; les autres sont secondaires. La fiche ne décide d'aucune réservation ni d'aucun achat.

export type EtatBarre = 'disponible' | 'reservee' | 'vendue'

const CHAMPS_DE_SAISIE = 'input, textarea, [contenteditable=""], [contenteditable="true"]'
const TYPES_SANS_SAISIE = ['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'file', 'image', 'color']

/** Vrai quand l'élément ciblé reçoit du texte (le clavier de l'appareil s'ouvre). */
function estSaisie(cible: EventTarget | null): boolean {
  if (!(cible instanceof Element) || !cible.matches(CHAMPS_DE_SAISIE)) return false
  return !(cible instanceof HTMLInputElement && TYPES_SANS_SAISIE.includes(cible.type))
}

export function BarreActions({
  etat, slug, artiste, conseil, achat,
}: {
  etat: EtatBarre
  slug: string
  artiste: { slug: string; nom: string }
  /** Bouton Conseil WhatsApp (4.4), rendu côté serveur. */
  conseil: ReactNode
  /** Achat : fourni seulement quand le Lot 2 est ouvert (lu par la page) ; absent sinon, jamais grisé. */
  achat?: ReactNode
}) {
  const [saisie, setSaisie] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSaisie(estSaisie(document.activeElement))
    const entree = (e: FocusEvent) => { if (estSaisie(e.target)) setSaisie(true) }
    const sortie = (e: FocusEvent) => { if (!estSaisie(e.relatedTarget)) setSaisie(false) }
    document.addEventListener('focusin', entree)
    document.addEventListener('focusout', sortie)
    return () => {
      document.removeEventListener('focusin', entree)
      document.removeEventListener('focusout', sortie)
    }
  }, [])

  // La barre fixe ne doit rien cacher (contenu ni pied de page) : le corps de page est dégagé de sa
  // hauteur mesurée, seulement tant qu'elle est réellement fixe.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ajuster = () => {
      const fixe = getComputedStyle(el).position === 'fixed'
      // Story 4.8 : la bannière de mesure, quand elle est ouverte, publie sa hauteur ; la barre se pose au-dessus.
      const banniere = parseFloat(document.documentElement.style.getPropertyValue('--hauteur-banniere')) || 0
      document.body.style.paddingBottom = fixe ? `${el.getBoundingClientRect().height + banniere}px` : ''
    }
    ajuster()
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ajuster) : null
    obs?.observe(el)
    window.addEventListener('resize', ajuster)
    // La variable de la bannière change (ouverture, fermeture, redimensionnement) : attribut `style` de la racine.
    const veille = new MutationObserver(ajuster)
    veille.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => {
      obs?.disconnect()
      veille.disconnect()
      window.removeEventListener('resize', ajuster)
      document.body.style.paddingBottom = ''
    }
  }, [])

  const lienSecondaire = 'inline-flex min-h-touch-target w-full items-center justify-center font-sans text-sm text-foreground underline underline-offset-4'

  return (
    <div
      ref={ref}
      role="group"
      aria-label={fr.fiche.barre.nom}
      data-saisie={saisie ? 'oui' : 'non'}
      className={cn(
        'fixed inset-x-0 bottom-[var(--hauteur-banniere,0px)] z-30 border-t border-neutral-200 bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        'lg:inset-x-auto lg:bottom-auto lg:sticky lg:top-24 lg:z-10 lg:mb-8 lg:border lg:rounded-sm lg:p-4',
        saisie && 'max-lg:hidden',
      )}
    >
      <div className="flex flex-col gap-2">
        {etat === 'disponible' && achat}
        {conseil}
        {etat === 'disponible' && (
          <Link href={`/galerie/${slug}/visite`} className={lienSecondaire}>
            {fr.fiche.barre.visite}
          </Link>
        )}
        {etat === 'reservee' && (
          // Aucune heure de fin : « Me prévenir » est une alerte, jamais une promesse de priorité.
          <Link href={`/galerie/${slug}/prevenir`} className={lienSecondaire}>
            {fr.fiche.barre.prevenir}
          </Link>
        )}
        {etat === 'vendue' && (
          <Link href={`/artistes/${artiste.slug}`} className={lienSecondaire}>
            {fr.fiche.vendue.lienArtiste(artiste.nom)}
          </Link>
        )}
      </div>
    </div>
  )
}
