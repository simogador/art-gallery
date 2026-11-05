'use client'

import { useEffect, useId, useMemo, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { fr } from '@/lib/i18n'
import { CODES_PAYS, nomPays, trierParNom } from '@/lib/livraison/pays'
import { choisirPaysLivraison, type ResultatPays } from '@/app/actions/pays'
import { Button } from './Button'

// Story 3.3 (FR-3, AD-12) : pays de livraison du visiteur. Affiche le pays choisi (cookie `pays`,
// France par défaut) et « Modifier », qui ouvre la liste des pays ; le choix est enregistré par une
// action serveur (cookie), puis la page est rafraîchie : prix et délais sont recalculés côté serveur
// et la zone aria-live l'annonce. `nom` vient du serveur (nom français du pays).

export function PaysLivraison({ code, nom, className }: { code: string; nom: string; className?: string }) {
  const textes = fr.livraison
  const router = useRouter()
  const id = useId()
  const [ouvert, setOuvert] = useState(false)
  const [choix, setChoix] = useState(code)
  const [erreur, setErreur] = useState(false)
  const [annonce, setAnnonce] = useState('')
  const [enCours, demarrer] = useTransition()
  const boutonModifier = useRef<HTMLButtonElement>(null)
  // Nom du pays choisi, annoncé quand la page rafraîchie apporte les nouveaux prix (prop `code`).
  const aAnnoncer = useRef<string | null>(null)
  // Même pays choisi de nouveau (`code` inchangé) : ce compteur déclenche l'annonce à sa place.
  const [repetition, setRepetition] = useState(0)
  const etaitOuvert = useRef(false)

  // Nouveau pays venu du serveur (rafraîchissement, navigation) : il l'emporte, et le recalcul est annoncé.
  useEffect(() => {
    setChoix(code)
    if (aAnnoncer.current !== null) {
      setAnnonce(textes.recalcules(aAnnoncer.current))
      aAnnoncer.current = null
    }
  }, [code, repetition, textes])

  // Fermeture du formulaire : le focus revient sur « Modifier ».
  useEffect(() => {
    if (etaitOuvert.current && !ouvert) boutonModifier.current?.focus()
    etaitOuvert.current = ouvert
  }, [ouvert])

  function fermer() {
    setChoix(code)
    setErreur(false)
    setOuvert(false)
  }

  // Liste construite à l'ouverture seulement (noms français, triés).
  const pays = useMemo(() => (ouvert ? trierParNom(CODES_PAYS).map((c) => ({ code: c, nom: nomPays(c) })) : []), [ouvert])

  function valider(e: FormEvent) {
    e.preventDefault()
    demarrer(async () => {
      let resultat: ResultatPays
      try {
        resultat = await choisirPaysLivraison(choix)
      } catch {
        resultat = { ok: false }
      }
      if (!resultat.ok) {
        setErreur(true)
        return
      }
      setErreur(false)
      setOuvert(false)
      // Vidée d'abord, annoncée au rendu suivant (nouveaux prix reçus) : un même choix répété est
      // annoncé de nouveau.
      setAnnonce('')
      aAnnoncer.current = resultat.nom
      if (resultat.code === code) setRepetition((n) => n + 1)
      router.refresh()
    })
  }

  function touche(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      fermer()
    }
  }

  return (
    <div className={cn('font-sans text-sm text-neutral-600', className)}>
      <p className="flex flex-wrap items-center gap-x-3">
        <span>{textes.paysChoisi(nom)}</span>
        <button
          type="button"
          aria-expanded={ouvert}
          aria-controls={ouvert ? `${id}-formulaire` : undefined}
          aria-label={textes.modifierPays(nom)}
          ref={boutonModifier}
          onClick={() => (ouvert ? fermer() : setOuvert(true))}
          className="min-h-touch-target text-foreground underline underline-offset-4 hover:text-neutral-600"
        >
          {textes.modifier}
        </button>
      </p>
      {ouvert && (
        <form id={`${id}-formulaire`} onSubmit={valider} onKeyDown={touche} className="mt-2 flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-liste`} className="text-xs text-neutral-600">
              {textes.libelleListe}
            </label>
            <select
              id={`${id}-liste`}
              name="pays"
              value={choix}
              onChange={(e) => setChoix(e.target.value)}
              className="min-h-touch-target text-input text-foreground bg-background border border-neutral-200 rounded-sm px-3"
            >
              {pays.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.nom}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm" disabled={enCours}>
            {textes.valider}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={fermer}>
            {textes.annuler}
          </Button>
        </form>
      )}
      {erreur && (
        <p role="alert" className="mt-2 text-foreground">
          {textes.erreur}
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {annonce}
      </p>
    </div>
  )
}
