'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fr } from '@/lib/i18n'
import { actionPrendreEnCharge } from './actions'

// « Je prends en charge » (story 8.1, FR-22) : confirmation en deux temps (le premier appui ouvre la question,
// le second enregistre), garde `useRef` contre le double appui, état local sans `useFormState` (test navigateur).
// Le résultat est annoncé dans une région `role="status"` qui reçoit le focus ; la page est ensuite relue
// (`router.refresh()`) : c'est le serveur qui révèle l'adresse, jamais ce composant. La page le garde monté à la
// même place une fois la commande prise en charge (`prise`) : le bouton disparaît, l'annonce reste.

const t = fr.commandesArtiste.action
const BOUTON = 'min-h-touch-target rounded-sm px-5 font-sans text-button disabled:opacity-40'

export function PriseEnCharge({ numero, prise = false }: { numero: string; prise?: boolean }) {
  const router = useRouter()
  const occupe = useRef(false)
  const statut = useRef<HTMLDivElement>(null)
  const confirmer = useRef<HTMLButtonElement>(null)
  const prendre = useRef<HTMLButtonElement>(null)
  const [etape, setEtape] = useState<'repos' | 'question'>('repos')
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  // Succès reçu : le bouton ne revient pas en attendant la page relue.
  const [fait, setFait] = useState(false)
  const retourAuRepos = useRef(false)

  useEffect(() => {
    if (etape === 'question') confirmer.current?.focus()
    else if (retourAuRepos.current) {
      retourAuRepos.current = false
      prendre.current?.focus()
    }
  }, [etape])

  useEffect(() => {
    if (message) statut.current?.focus()
  }, [message])

  function annuler() {
    retourAuRepos.current = true
    setEtape('repos')
  }

  async function enregistrer() {
    if (occupe.current) return
    occupe.current = true
    setEnCours(true)
    setMessage(null)
    try {
      const r = await actionPrendreEnCharge(numero)
      setMessage(r.message)
      setEtape('repos')
      if (r.ok) {
        setFait(true)
        router.refresh()
      }
    } catch {
      setMessage(t.erreurs.indisponible)
    } finally {
      occupe.current = false
      setEnCours(false)
    }
  }

  return (
    <div>
      {prise || fait ? null : etape === 'repos' ? (
        <button
          ref={prendre}
          type="button"
          onClick={() => setEtape('question')}
          className={`${BOUTON} bg-foreground text-neutral-200 fond-sombre`}
        >
          {t.prendre}
        </button>
      ) : (
        <div className="rounded-sm border border-neutral-500 p-4">
          <p id={`question-${numero}`} className="font-sans text-sm text-foreground">
            {t.question}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              ref={confirmer}
              type="button"
              disabled={enCours}
              aria-describedby={`question-${numero}`}
              onClick={enregistrer}
              className={`${BOUTON} bg-foreground text-neutral-200 fond-sombre`}
            >
              {enCours ? t.enCours : t.confirmer}
            </button>
            <button type="button" disabled={enCours} onClick={annuler} className={`${BOUTON} border border-foreground text-foreground`}>
              {t.annuler}
            </button>
          </div>
        </div>
      )}
      <div role="status" aria-live="polite" tabIndex={-1} ref={statut} className="mt-3">
        {message && <p className="font-sans text-sm text-foreground">{message}</p>}
      </div>
    </div>
  )
}
