import { fr } from '@/lib/i18n'

// Chargement de la confirmation (story 7.6) : squelettes neutral-200, sans animation.
export default function ChargementConfirmation() {
  return (
    <div className="container-premium max-w-4xl pb-16 pt-28" role="status" aria-busy="true">
      <p className="sr-only">{fr.confirmation.chargement}</p>
      <div aria-hidden="true" className="mt-8 flex flex-col gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="h-40 rounded-sm bg-neutral-200" />
        ))}
      </div>
    </div>
  )
}
