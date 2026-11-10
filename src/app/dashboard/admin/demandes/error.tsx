'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'
import { fr } from '@/lib/i18n'

// Erreur de la file des demandes (story 4.6) : rien de technique ; « Réessayer » relance le rendu serveur.
export default function ErreurDemandes({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()
  return (
    <div role="alert">
      <p className="font-sans text-base text-foreground">{fr.demandes.erreur}</p>
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
        {fr.demandes.reessayer}
      </Button>
    </div>
  )
}
