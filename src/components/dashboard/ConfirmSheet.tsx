'use client'

import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'

// `confirm-sheet` (story 2.8) : feuille de confirmation qui monte du bas, « Annuler » à gauche,
// « Confirmer » à droite. Échap ou un appui sur le voile ferme sans agir et rend le focus à
// l'élément qui l'a ouverte (retourFocus). Fenêtre modale native (<dialog>) : le reste de la page
// est inerte. Jamais deux feuilles empilées : une seule peut être ouverte à la fois.

let feuilleOuverte: symbol | null = null

export function ConfirmSheet({
  ouverte,
  titre,
  children,
  libelleConfirmer = 'Confirmer',
  enCours = false,
  erreur = null,
  onAnnuler,
  onConfirmer,
  retourFocus,
}: {
  ouverte: boolean
  titre: string
  children?: ReactNode
  libelleConfirmer?: string
  enCours?: boolean
  erreur?: string | null
  onAnnuler: () => void
  onConfirmer: () => void
  retourFocus: RefObject<HTMLElement | null>
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const jeton = useRef(Symbol('feuille'))
  const idTitre = useId()
  const idTexte = useId()
  const idErreur = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const moi = jeton.current
    if (ouverte && !dialog.open) {
      if (feuilleOuverte !== null && feuilleOuverte !== moi) {
        // Une autre feuille est déjà ouverte : on n'en empile pas une seconde.
        onAnnuler()
        return
      }
      feuilleOuverte = moi
      dialog.showModal()
    } else if (!ouverte && dialog.open) {
      // L'événement `close` libère la place et rend le focus.
      dialog.close()
    }
  }, [ouverte, onAnnuler, retourFocus])

  // Démontée ouverte (après une confirmation réussie, par exemple) : la place se libère.
  useEffect(() => {
    const moi = jeton.current
    return () => {
      if (feuilleOuverte === moi) feuilleOuverte = null
    }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitre}
      aria-describedby={children ? idTexte : undefined}
      // Échap : on ferme nous-mêmes, pour rendre le focus ; rien pendant l'enregistrement.
      onCancel={(e) => {
        e.preventDefault()
        if (!enCours) onAnnuler()
      }}
      // Toute fermeture, la nôtre comme une fermeture native (Échap répété…) : la place se libère,
      // le focus revient au déclencheur et le parent oublie son choix (sans effet s'il l'a déjà fait).
      onClose={() => {
        if (feuilleOuverte === jeton.current) feuilleOuverte = null
        retourFocus.current?.focus()
        onAnnuler()
      }}
      // Un appui sur le voile (::backdrop) arrive sur le <dialog> lui-même.
      onClick={(e) => {
        if (e.target === e.currentTarget && !enCours) onAnnuler()
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none max-h-[85vh] p-0 bg-transparent backdrop:bg-foreground/40"
    >
      <div className="bg-background border-t border-neutral-200 rounded-t-lg shadow-premium-lg px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8 motion-safe:animate-slide-up">
        <div className="mx-auto max-w-xl">
          <h2 id={idTitre} className="font-serif text-xl font-light text-foreground">
            {titre}
          </h2>
          {children && (
            <div id={idTexte} className="mt-2 font-sans text-sm text-neutral-600">
              {children}
            </div>
          )}
          {erreur && (
            <p id={idErreur} role="alert" className="mt-3 font-sans text-sm text-red-700">
              {erreur}
            </p>
          )}
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              autoFocus
              onClick={onAnnuler}
              disabled={enCours}
              className="flex-1 min-h-11 px-4 border border-neutral-300 rounded-sm font-sans text-xs uppercase tracking-widest text-foreground hover:border-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onConfirmer}
              disabled={enCours}
              aria-describedby={erreur ? idErreur : undefined}
              className="flex-1 min-h-11 px-4 bg-foreground text-background rounded-sm font-sans text-xs uppercase tracking-widest hover:bg-neutral-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              {enCours ? 'Enregistrement…' : libelleConfirmer}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
