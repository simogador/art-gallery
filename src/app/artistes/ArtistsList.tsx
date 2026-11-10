import Image from 'next/image'
import Link from 'next/link'
import { fr, SEPARATEUR } from '@/lib/i18n'
import type { Artist } from '@/lib/types'

// Liste des artistes (story 3.11, FR-19) : seulement les artistes publics (accord signé, actifs, au
// moins une œuvre visible, story 2.9), lus par la page. Aucun chiffre déduit ni inventé ; une seule
// cible par artiste (sa page).

const T = fr.artistes

function Initiales({ nom }: { nom: string }) {
  return nom
    .split(' ')
    .filter(Boolean)
    .map((n) => [...n][0])
    .slice(0, 2)
    .join('')
}

export function ArtistsList({ artists }: { artists: Artist[] }) {
  return (
    <div className="container-premium pb-16 pt-28 md:pb-24 md:pt-36">
      <h1 className="font-serif text-display-md text-foreground">{T.titre}</h1>
      <span className="ornament-rule mt-4" aria-hidden="true" />
      <p className="mt-4 max-w-xl font-sans text-base text-neutral-600 text-pretty">{T.introduction}</p>

      {artists.length > 0 ? (
        <ul aria-label={T.liste} className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
          {artists.map((artist) => (
            <li key={artist.id}>
              <Link href={`/artistes/${artist.id}`} className="group block">
                <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-neutral-100">
                  {artist.imageUrl ? (
                    <Image
                      src={artist.imageUrl}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover"
                    />
                  ) : (
                    <span
                      className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${artist.gradient} font-serif text-display-md font-light text-foreground`}
                      aria-hidden="true"
                    >
                      <Initiales nom={artist.name} />
                    </span>
                  )}
                </div>
                <h2 className="mt-3 font-serif text-heading-sm text-foreground group-hover:underline group-hover:underline-offset-4">
                  {artist.name}
                </h2>
                <p className="mt-1 font-sans text-caption text-neutral-600">
                  {[artist.discipline, artist.country].filter(Boolean).join(SEPARATEUR)}
                </p>
                <p className="font-sans text-caption text-neutral-600">{T.selectionne}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-16 text-center font-sans text-base text-neutral-600">{T.vide}</p>
      )}
    </div>
  )
}
