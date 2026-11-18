'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'
import { fr } from '@/lib/i18n'

// Erreur du récapitulatif et du paiement (story 7.4) : « Réessayer » relance le rendu serveur ; le passage et
// la réservation, déjà en base, sont repris tels quels.
export default function ErreurPaiement({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()
  return (
    <div className="container-premium max-w-4xl pb-16 pt-28" role="alert">
      <p className="font-sans text-base text-foreground">{fr.paiementAcheteur.panne}</p>
      <Button
        type="button"
        className="mt-4"
        onClick={() =>
          startTransition(() => {
            router.refresh()
            reset()
          })
        }
      >
        {fr.paiementAcheteur.reessayer}
      </Button>
    </div>
  )
}
