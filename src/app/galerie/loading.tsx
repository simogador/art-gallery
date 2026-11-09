import { fr } from '@/lib/i18n'

// Chargement de la galerie (story 3.9) : vignettes squelettes neutral-200, sans animation.
export default function ChargementGalerie() {
  return (
    <div className="container-premium pb-16 pt-28 md:pb-24 md:pt-36" role="status" aria-busy="true">
      <p className="sr-only">{fr.galerie.chargement}</p>
      <h1 className="font-serif text-display-md text-foreground">{fr.galerie.titre}</h1>
      <ul aria-hidden="true" className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i}>
            <div className="aspect-[3/4] rounded-sm bg-neutral-200" />
            <div className="mt-3 h-5 w-3/4 rounded-sm bg-neutral-200" />
            <div className="mt-2 h-4 w-1/2 rounded-sm bg-neutral-200" />
          </li>
        ))}
      </ul>
    </div>
  )
}
