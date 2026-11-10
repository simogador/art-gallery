'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'
import { fr } from '@/lib/i18n'

// Erreur d'une fiche (story 3.9) : même comportement que la galerie ;
// « Réessayer » relance le rendu serveur.
export default function ErreurPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()
  return (
    <div className="container-premium pb-16 pt-28 md:pb-24 md:pt-36" role="alert">
      <p className="font-sans text-base text-foreground">{fr.galerie.erreurPage}</p>
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
