'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fr } from '@/lib/i18n'
import { modifierMaCommande } from './actions'

// « Modifier ma commande » (story 7.3) : sortie du passage de l'acheteur. Confirmation simple en deux
// temps ; le serveur annule le passage (réservations libérées, cookie effacé), puis retour au panier, dont
// les œuvres sont conservées.

const t = fr.coordonnees.modifier
const BOUTON =
  'inline-flex min-h-touch-target items-center justify-center rounded-sm border border-neutral-200 px-6 font-sans text-xs uppercase tracking-widest text-foreground hover:border-foreground disabled:text-neutral-600'

export function ModifierCommande() {
  const routeur = useRouter()
  const [confirme, setConfirme] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const garde = useRef(false)

  async function liberer() {
    if (garde.current) return
    garde.current = true
    setEnCours(true)
    setMessage(null)
    let reussi = false
    try {
      const reponse = await modifierMaCommande()
      if (reponse.ok) {
        reussi = true
        routeur.push('/panier')
      } else {
        setMessage(t.refus)
      }
    } catch {
      setMessage(t.refus)
    } finally {
      if (!reussi) {
        garde.current = false
        setEnCours(false)
      }
    }
  }

  if (!confirme) {
    return (
      <button type="button" onClick={() => setConfirme(true)} className={BOUTON}>
        {t.bouton}
      </button>
    )
  }
  return (
    <div className="rounded-sm border border-neutral-200 p-4">
      <p role="alert" className="font-sans text-sm text-foreground">
        {t.confirmation}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={liberer} disabled={enCours} className={BOUTON}>
          {enCours ? t.enCours : t.confirmer}
        </button>
        <button type="button" onClick={() => setConfirme(false)} disabled={enCours} className={BOUTON}>
          {t.garder}
        </button>
      </div>
      {message && (
        <p role="alert" className="mt-3 font-sans text-sm text-red-700">
          {message}
        </p>
      )}
    </div>
  )
}
