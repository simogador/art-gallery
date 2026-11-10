'use client'

import { useTransition, type FormEvent } from 'react'
import { LIBELLES_SELECTION, MESSAGES_RETOUR_SELECTION } from '@/lib/curation/selection-regles'
import { actionSelection } from './actions'

// Sélection de l'accueil (story 3.10, FR-18) : bascule marquer / démarquer, extraite de la page pour
// être testée dans un navigateur (tests/navigateur). L'action serveur redirige vers la liste avec le
// résultat ; `RetourSelection` l'affiche.

export function BasculeSelection({ slug, marquee }: { slug: string; marquee: boolean }) {
  const [enCours, demarrer] = useTransition()

  function basculer(e: FormEvent) {
    e.preventDefault()
    demarrer(async () => {
      await actionSelection(slug, !marquee)
    })
  }

  return (
    <form onSubmit={basculer} className="mt-1">
      <button
        type="submit"
        disabled={enCours}
        className="min-h-touch-target font-sans text-[10px] uppercase tracking-widest text-neutral-600 hover:text-foreground underline underline-offset-4 disabled:opacity-40"
      >
        {marquee ? LIBELLES_SELECTION.dans : LIBELLES_SELECTION.ajouter}
      </button>
    </form>
  )
}

/** Résultat de la bascule, annoncé (`role="status"`) ; rien si le code est inconnu. */
export function RetourSelection({ code }: { code: string | undefined }) {
  if (typeof code !== 'string' || !Object.hasOwn(MESSAGES_RETOUR_SELECTION, code)) return null
  return (
    <p role="status" className="mb-8 font-sans text-sm text-foreground bg-neutral-50 border border-neutral-200 rounded-sm px-4 py-3">
      {MESSAGES_RETOUR_SELECTION[code]}
    </p>
  )
}
