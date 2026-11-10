import Link from 'next/link'
import { fr, SEPARATEUR } from '@/lib/i18n'
import type { Exhibition } from '@/lib/types'

// Section « Expositions » de l'accueil (story 3.10) : expositions visibles du catalogue réel (au
// moins une œuvre visible, story 2.9), lues par la page d'accueil, qui masque la section quand la
// liste est vide. En cours d'abord ; une seule cible par exposition (sa page). Aucun horaire ni
// condition d'entrée inventés.

const T = fr.accueil.expositions

const ORDRE = { 'en-cours': 0, 'a-venir': 1, passee: 2 } as const
const MAX_EXPOSITIONS = 4

const LIEN_SECONDAIRE =
  'inline-flex min-h-touch-target items-center justify-center rounded-sm border border-neutral-200 px-8 py-4 font-sans text-sm font-medium uppercase tracking-widest text-foreground hover:border-foreground hover:bg-neutral-50'

export function Exhibitions({ exhibitions }: { exhibitions: Exhibition[] }) {
  // Tri stable : en cours, à venir, passées ; l'exposition à la une en tête de son groupe.
  const montrees = exhibitions
    .map((e, i) => ({ e, i }))
    .sort((a, b) => ORDRE[a.e.status] - ORDRE[b.e.status] || Number(b.e.featured) - Number(a.e.featured) || a.i - b.i)
    .slice(0, MAX_EXPOSITIONS)
    .map(({ e }) => e)

  return (
    <section id="expositions" aria-labelledby="accueil-expositions-titre" className="bg-background py-16 md:py-24">
      <div className="container-premium">
        <p className="mb-3 font-sans text-label-caps uppercase text-neutral-600">{T.surtitre}</p>
        <h2 id="accueil-expositions-titre" className="font-serif text-display-md text-foreground">
          {T.titre}
        </h2>
        <span className="ornament-rule mt-4" aria-hidden="true" />

        <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          {montrees.map((expo) => (
            <li key={expo.id}>
              <Link
                href={`/expositions/${expo.id}`}
                className="group block h-full rounded-sm border border-neutral-200 p-6 hover:border-foreground"
              >
                <span className={`mb-5 block h-1 w-16 rounded-full bg-gradient-to-r ${expo.gradient}`} aria-hidden="true" />
                <span className="block font-sans text-label-caps uppercase text-neutral-600">
                  {expo.featured && expo.status === 'en-cours' ? `${T.alaUne}${SEPARATEUR}` : ''}
                  {T.statut[expo.status]}
                </span>
                <span className="mt-2 block font-serif text-display-xs text-foreground group-hover:underline group-hover:underline-offset-4">
                  {expo.title}
                </span>
                {expo.subtitle && <span className="mt-1 block font-sans text-sm text-neutral-600">{expo.subtitle}</span>}
                <span className="mt-4 block font-sans text-caption text-neutral-600">{T.periode(expo.dateStart, expo.dateEnd)}</span>
                <span className="block font-sans text-caption text-neutral-600">{T.oeuvres(expo.worksCount)}</span>
                {expo.venue && (
                  <span className="block font-sans text-caption text-neutral-600">{T.lieu(expo.venue)}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <Link href="/expositions" className={LIEN_SECONDAIRE}>
            {T.voirToutes}
          </Link>
        </div>
      </div>
    </section>
  )
}
