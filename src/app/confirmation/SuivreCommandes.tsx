'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fr } from '@/lib/i18n'
import { ouvrirSuivi } from './actions'

// « Suivre mes commandes » (story 7.7) : l'action serveur échange le jeton du navigateur contre un lien de suivi
// (cookie `httpOnly`), puis le client ouvre `/suivi`. Garde anti double appui par `useRef` (sans `useFormState`,
// testable dans le navigateur) ; un échec reste dit dans une région `role="status"`, sans détail technique.
export function SuivreCommandes() {
  const router = useRouter()
  const enCours = useRef(false)
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'erreur' | 'trop_de_liens'>('repos')

  async function suivre() {
    if (enCours.current) return
    enCours.current = true
    setEtat('envoi')
    try {
      const reponse = await ouvrirSuivi()
      if (reponse.ok) {
        router.push('/suivi')
        return
      }
      setEtat(reponse.code === 'trop_de_liens' ? 'trop_de_liens' : 'erreur')
    } catch {
      setEtat('erreur')
    } finally {
      enCours.current = false
    }
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={suivre}
        aria-describedby="suivre-etat"
        className="inline-flex min-h-touch-target items-center border border-foreground px-6 font-sans text-sm text-foreground hover:bg-neutral-100"
      >
        {etat === 'envoi' ? fr.confirmation.suivreEnCours : fr.confirmation.suivre}
      </button>
      <p id="suivre-etat" role="status" className="mt-2 font-sans text-sm text-neutral-600">
        {etat === 'erreur' ? fr.confirmation.suivreErreur : etat === 'trop_de_liens' ? fr.confirmation.suivreTropDeLiens : ''}
      </p>
    </div>
  )
}
