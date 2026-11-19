'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'
import { fr } from '@/lib/i18n'

// Erreur du suivi (story 7.7) : « Réessayer » relance le rendu serveur ; rien n'est écrit.
export default function ErreurSuivi({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()
  return (
    <div className="container-premium max-w-4xl pb-16 pt-28" role="alert">
      <p className="font-sans text-base text-foreground">{fr.suivi.panne}</p>
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
        {fr.suivi.reessayer}
      </Button>
    </div>
  )
}
