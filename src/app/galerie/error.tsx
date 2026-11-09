'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'
import { fr } from '@/lib/i18n'

// Erreur de la galerie (story 3.9) : les filtres sont dans l'adresse, qui ne change pas ;
// « Réessayer » relance le rendu serveur avec les mêmes filtres.
export default function ErreurGalerie({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()
  return (
    <div className="container-premium pb-16 pt-28 md:pb-24 md:pt-36" role="alert">
      <p className="font-sans text-base text-foreground">{fr.galerie.erreur}</p>
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
        {fr.galerie.reessayer}
      </Button>
    </div>
  )
}
