'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fr } from '@/lib/i18n'
import { confirmerReception } from './actions'

// « J'ai reçu l'œuvre » (story 8.4, FR-29) : confirmation en deux temps (la constatation est définitive ici), garde
// anti double appui par `useRef`, résultat annoncé dans une région `role="status"` (gardée montée après la
// bascule), `router.refresh()` pour relire la commande. Sans `useFormState` (test navigateur). Le numéro de
// commande est le seul champ envoyé : l'action serveur tire le passage du jeton de suivi du navigateur.
// `proposer` faux (commande déjà livrée après `router.refresh()`) : le composant reste monté pour garder le message
// de succès et son annonce, sans bouton.
export function ConfirmerReception({ numero, proposer = true }: { numero: string; proposer?: boolean }) {
  const t = fr.suivi.reception
  const router = useRouter()
  const garde = useRef(false)
  const confirmer = useRef<HTMLButtonElement>(null)
  const [etape, setEtape] = useState<'repos' | 'question' | 'envoi' | 'fini'>('repos')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (etape === 'question') confirmer.current?.focus()
  }, [etape])

  async function valider() {
    if (garde.current) return
    garde.current = true
    setEtape('envoi')
    try {
      const r = await confirmerReception(numero)
      setMessage(r.message)
      setEtape(r.ok ? 'fini' : 'repos')
      if (r.ok) router.refresh()
    } catch {
      setMessage(t.erreurs.indisponible)
      setEtape('repos')
    } finally {
      garde.current = false
    }
  }

  const idEtat = `reception-${numero}`
  return (
    <div>
      {((proposer && etape === 'repos') || etape === 'question' || etape === 'envoi') && (
        <>
          {etape === 'repos' ? (
            <button
              type="button"
              onClick={() => setEtape('question')}
              aria-describedby={idEtat}
              className="inline-flex min-h-touch-target items-center border border-foreground px-6 font-sans text-sm text-foreground hover:bg-neutral-100"
            >
              {t.bouton}
            </button>
          ) : (
            <div>
              <p className="font-sans text-sm text-foreground">{t.question}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  ref={confirmer}
                  disabled={etape === 'envoi'}
                  onClick={valider}
                  className="inline-flex min-h-touch-target items-center border border-foreground px-6 font-sans text-sm text-foreground hover:bg-neutral-100 disabled:opacity-40"
                >
                  {etape === 'envoi' ? t.enCours : t.confirmer}
                </button>
                <button
                  type="button"
                  disabled={etape === 'envoi'}
                  onClick={() => setEtape('repos')}
                  className="inline-flex min-h-touch-target items-center border border-neutral-500 px-6 font-sans text-sm text-foreground hover:bg-neutral-100 disabled:opacity-40"
                >
                  {t.annuler}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      <p id={idEtat} role="status" className="mt-2 font-sans text-sm text-neutral-600">
        {message}
      </p>
    </div>
  )
}
