'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fr } from '@/lib/i18n'

// Mise à jour de la confirmation (story 7.6) : tant qu'une commande attend le constat du paiement (et que sa
// réservation court), la page redemande le rendu au serveur toutes les 20 secondes, pendant 10 minutes au plus ;
// aucun rafraîchissement onglet caché (reprise au retour). Ce composant ne décide d'aucun état : seul le serveur
// dit `confirmee` ou `annulee`. À la bascule, annonce `role="status"` ; le focus ne va sur le titre (`idTitre`)
// que si le serveur dit confirmé. Passé les 10 minutes, la note demande de recharger la page.

export const INTERVALLE_MISE_A_JOUR_MS = 20_000
export const DUREE_MISE_A_JOUR_MS = 10 * 60_000
const PASSAGES_MAX = DUREE_MISE_A_JOUR_MS / INTERVALLE_MISE_A_JOUR_MS

type Props = { enAttente: boolean; confirmee: boolean; annulee: boolean; idTitre: string }

export function MiseAJourAuto({ enAttente, confirmee, annulee, idTitre }: Props) {
  const router = useRouter()
  const [annonce, setAnnonce] = useState('')
  const [expire, setExpire] = useState(false)
  const avant = useRef(enAttente)
  // Le routeur peut changer d'identité entre deux rendus : le minuteur ne doit pas repartir pour autant.
  const rafraichir = useRef(router.refresh)
  rafraichir.current = router.refresh

  useEffect(() => {
    if (!enAttente) return
    let passages = 0
    let manque = false
    let fini = false
    const minuteur = setInterval(() => {
      passages++
      if (document.hidden) manque = true
      else rafraichir.current()
      if (passages >= PASSAGES_MAX) {
        fini = true
        clearInterval(minuteur)
        setExpire(true)
      }
    }, INTERVALLE_MISE_A_JOUR_MS)
    const retour = () => {
      if (!document.hidden && manque && !fini) {
        manque = false
        rafraichir.current()
      }
    }
    document.addEventListener('visibilitychange', retour)
    return () => {
      clearInterval(minuteur)
      document.removeEventListener('visibilitychange', retour)
    }
  }, [enAttente])

  useEffect(() => {
    if (avant.current && !enAttente) {
      if (confirmee) {
        setAnnonce(fr.confirmation.bascule)
        document.getElementById(idTitre)?.focus()
      } else if (annulee) {
        setAnnonce(fr.confirmation.basculeAnnulee)
      }
    }
    avant.current = enAttente
  }, [enAttente, confirmee, annulee, idTitre])

  return (
    <>
      {enAttente && <p className="mb-8 mt-1 font-sans text-sm text-neutral-600">{expire ? fr.confirmation.rechargez : fr.confirmation.majAuto}</p>}
      <p role="status" className="sr-only">
        {annonce}
      </p>
    </>
  )
}
