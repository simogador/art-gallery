import Link from 'next/link'
import { fr, SEPARATEUR } from '@/lib/i18n'
import type { Artist } from '@/lib/types'

// Section « Les artistes » de l'accueil (story 3.10) : artistes visibles du catalogue réel (accord
// signé, au moins une œuvre visible, story 2.9), lus par la page d'accueil, qui masque la section
// quand la liste est vide. Une seule cible par artiste (sa page) ; aucune promesse ni appel à
// candidature inventé.

const T = fr.accueil.artistes

const LIEN_SECONDAIRE =
  'inline-flex min-h-touch-target items-center justify-center rounded-sm border border-neutral-200 px-8 py-4 font-sans text-sm font-medium uppercase tracking-widest text-foreground hover:border-foreground hover:bg-neutral-50'

function Initiales({ nom }: { nom: string }) {
  return nom
    .split(' ')
    .map((n) => n[0])
    .join('')
}

export function Artists({ artists }: { artists: Artist[] }) {
  return (
    <section id="artistes" aria-labelledby="accueil-artistes-titre" className="bg-neutral-50 py-16 md:py-24">
      <div className="container-premium">
        <p className="mb-3 font-sans text-label-caps uppercase text-neutral-600">{T.surtitre}</p>
        <h2 id="accueil-artistes-titre" className="font-serif text-display-md text-foreground">
          {T.titre}
        </h2>
        <span className="ornament-rule mt-4" aria-hidden="true" />
        <p className="mt-4 max-w-xl font-sans text-base text-neutral-600 text-pretty">{T.introduction}</p>

        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {artists.map((artist) => (
            <li key={artist.id}>
              <Link
                href={`/artistes/${artist.id}`}
                className="group flex min-h-touch-target items-center gap-5 rounded-sm border border-neutral-200 bg-background p-5 hover:border-foreground"
              >
                <span
                  className={`relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-sm bg-gradient-to-br ${artist.gradient}`}
                  aria-hidden="true"
                >
                  <span className="font-serif text-lg font-light text-foreground">
                    <Initiales nom={artist.name} />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-heading-sm text-foreground group-hover:underline group-hover:underline-offset-4">
                    {artist.name}
                  </span>
                  <span className="mt-0.5 block font-sans text-caption text-neutral-600">
                    {[artist.discipline, artist.country].filter(Boolean).join(SEPARATEUR)}
                  </span>
                  <span className="block font-sans text-caption text-neutral-600">{T.oeuvres(artist.worksCount)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <Link href="/artistes" className={LIEN_SECONDAIRE}>
            {T.voirTous}
          </Link>
        </div>
      </div>
    </section>
  )
}
