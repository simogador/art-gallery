'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'
import { fr } from '@/lib/i18n'

// Erreur de la confirmation (story 7.6) : « Réessayer » relance le rendu serveur ; rien n'est écrit.
export default function ErreurConfirmation({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()
  return (
    <div className="container-premium max-w-4xl pb-16 pt-28" role="alert">
      <p className="font-sans text-base text-foreground">{fr.confirmation.panne}</p>
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
        {fr.confirmation.reessayer}
      </Button>
    </div>
  )
}
