import Image from 'next/image'
import { PaysLivraison, UniteToggle } from '@/components/ui'
import { VignetteOeuvre } from '@/app/galerie/VignetteOeuvre'
import { fr, SEPARATEUR } from '@/lib/i18n'
import type { Artist, Artwork } from '@/lib/types'

// Page d'un artiste (story 3.11, FR-19, FR-8) : portrait, biographie, démarche, formation,
// expositions et photo d'atelier saisies par l'équipe (une section vide n'est pas affichée),
// « Sélectionné par Errancy » et les œuvres disponibles avec prix livré et délai vers le pays
// choisi. Aucune coordonnée de l'artiste, aucune valeur déduite.

const T = fr.artistes

function Section({ id, titre, children }: { id: string; titre: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="font-serif text-heading-sm text-foreground">
        {titre}
      </h2>
      <span className="ornament-rule mt-3" aria-hidden="true" />
      <div className="mt-4 max-w-prose">{children}</div>
    </section>
  )
}

const Texte = ({ children }: { children: string }) => (
  <p className="whitespace-pre-line font-sans text-base text-neutral-600 text-pretty">{children}</p>
)

export function ArtistProfile({
  artist,
  artworks,
  pays,
}: {
  artist: Artist
  artworks: Artwork[]
  pays: { code: string; nom: string }
}) {
  const initiales = artist.name
    .split(' ')
    .filter(Boolean)
    .map((n) => [...n][0])
    .slice(0, 2)
    .join('')

  return (
    <div className="container-premium pb-16 pt-28 md:pb-24 md:pt-36">
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] md:gap-12 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-16">
        <div>
          <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-neutral-100">
            {artist.imageUrl ? (
              <Image
                src={artist.imageUrl}
                alt={T.portrait(artist.name)}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 360px"
                className="object-cover"
              />
            ) : (
              <span
                className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${artist.gradient} font-serif text-display-lg font-light text-foreground`}
                aria-hidden="true"
              >
                {initiales}
              </span>
            )}
          </div>
        </div>

        <div>
          <h1 className="font-serif text-display-md text-foreground">{artist.name}</h1>
          <p className="mt-2 font-sans text-base text-neutral-600">
            {[artist.discipline, artist.country].filter(Boolean).join(SEPARATEUR)}
          </p>
          <p className="mt-1 font-sans text-body-strong text-foreground">{T.selectionne}</p>

          <Section id="artiste-biographie" titre={T.sections.biographie}>
            <Texte>{artist.bio}</Texte>
          </Section>
          {artist.statement && (
            <Section id="artiste-demarche" titre={T.sections.demarche}>
              <Texte>{artist.statement}</Texte>
            </Section>
          )}
          {artist.formation && (
            <Section id="artiste-formation" titre={T.sections.formation}>
              <Texte>{artist.formation}</Texte>
            </Section>
          )}
          {artist.expositions && (
            <Section id="artiste-expositions" titre={T.sections.expositions}>
              <Texte>{artist.expositions}</Texte>
            </Section>
          )}
          {artist.atelierUrl && (
            <section aria-labelledby="artiste-atelier" className="mt-10">
              <h2 id="artiste-atelier" className="font-serif text-heading-sm text-foreground">
                {T.sections.atelier}
              </h2>
              <span className="ornament-rule mt-3" aria-hidden="true" />
              <div className="relative mt-4 aspect-[4/3] max-w-xl overflow-hidden rounded-sm bg-neutral-100">
                <Image
                  src={artist.atelierUrl}
                  alt={T.atelier(artist.name)}
                  fill
                  sizes="(max-width: 768px) 100vw, 576px"
                  className="object-cover"
                />
              </div>
            </section>
          )}
        </div>
      </div>

      {artworks.length > 0 && (
        <section aria-labelledby="artiste-oeuvres" className="mt-16">
          <h2 id="artiste-oeuvres" className="font-serif text-display-md text-foreground">
            {T.sections.oeuvres}
          </h2>
          <span className="ornament-rule mt-4" aria-hidden="true" />
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
            <PaysLivraison code={pays.code} nom={pays.nom} />
            <UniteToggle />
          </div>
          <ul aria-label={T.oeuvres} className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
            {artworks.map((o) => (
              <li key={o.id}>
                <VignetteOeuvre artwork={o} paysNom={pays.nom} niveau="h3" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
