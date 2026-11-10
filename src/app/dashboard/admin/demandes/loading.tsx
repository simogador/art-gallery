import { fr } from '@/lib/i18n'

// Chargement de la file des demandes (story 4.6) : lignes squelettes neutral-200, sans animation.
export default function ChargementDemandes() {
  return (
    <div role="status" aria-busy="true">
      <p className="sr-only">{fr.demandes.chargement}</p>
      <h1 className="font-serif text-3xl text-foreground">{fr.demandes.titre}</h1>
      <ul aria-hidden="true" className="mt-8 space-y-4">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="rounded-sm border border-neutral-200 p-4">
            <div className="h-5 w-1/3 rounded-sm bg-neutral-200" />
            <div className="mt-3 h-4 w-2/3 rounded-sm bg-neutral-200" />
            <div className="mt-2 h-4 w-1/2 rounded-sm bg-neutral-200" />
          </li>
        ))}
      </ul>
    </div>
  )
}
