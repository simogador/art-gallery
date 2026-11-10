import Link from 'next/link'
import { ArtworkImage, DimensionsChoisies } from '@/components/ui'
import { fr, SEPARATEUR } from '@/lib/i18n'
import type { Artwork } from '@/lib/types'

// Ouverture de l'accueil (story 3.10, FR-18). Chiffres et œuvre mise en avant viennent du catalogue
// réel (props de la page, story 2.9) : un chiffre nul n'est pas affiché et, sans œuvre visible, la
// légende disparaît. Textes du dictionnaire (fr.accueil.hero) ; ni parallaxe, ni animation liée au
// défilement (story 3.1) ; aucun prix ici (le prix livré se lit sur les vignettes et la fiche).
export type ChiffresHero = { oeuvres: number; artistes: number; expositions: number }

const T = fr.accueil.hero

function statistiques({ oeuvres, artistes, expositions }: ChiffresHero) {
  return [
    { cle: 'oeuvres', valeur: oeuvres, libelle: T.statistiques.oeuvres(oeuvres) },
    { cle: 'artistes', valeur: artistes, libelle: T.statistiques.artistes(artistes) },
    { cle: 'expositions', valeur: expositions, libelle: T.statistiques.expositions(expositions) },
  ].filter((s) => s.valeur > 0)
}

const LIEN_PRIMAIRE =
  'inline-flex min-h-touch-target items-center justify-center rounded-sm border border-foreground bg-foreground px-8 py-4 font-sans text-sm font-medium uppercase tracking-widest text-background hover:bg-neutral-700'
const LIEN_SECONDAIRE =
  'inline-flex min-h-touch-target items-center justify-center rounded-sm border border-neutral-200 px-8 py-4 font-sans text-sm font-medium uppercase tracking-widest text-foreground hover:border-foreground hover:bg-neutral-50'

interface HeroProps {
  oeuvre: Artwork | null
  chiffres: ChiffresHero
  expositionEnCours: boolean
}

export function Hero({ oeuvre, chiffres, expositionEnCours }: HeroProps) {
  const stats = statistiques(chiffres)
  const avecTaille = oeuvre !== null && oeuvre.hauteurMm !== null && oeuvre.largeurMm !== null

  return (
    <section aria-labelledby="accueil-titre" className="relative overflow-hidden bg-background">
      <div className="container-premium relative z-10 pb-16 pt-28 md:pb-24 md:pt-36">
        <div className="grid w-full items-center gap-12 md:grid-cols-2 md:gap-8 lg:gap-16">
          <div className="flex animate-fade-in flex-col">
            {/* Seulement si une exposition visible est en cours. */}
            {expositionEnCours && (
              <p className="mb-8 inline-flex w-fit items-center gap-2 rounded-sm border border-gold/30 bg-gold-muted px-3 py-1 font-sans text-xs font-medium text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
                {T.expositionEnCours}
              </p>
            )}

            <h1
              id="accueil-titre"
              className="font-serif font-light leading-[1.1] text-foreground text-balance"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 4.5rem)' }}
            >
              {T.titre}
            </h1>

            <span className="ornament-rule my-6" aria-hidden="true" />

            <p className="max-w-md font-sans text-base leading-relaxed text-neutral-600 text-pretty">{T.introduction}</p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href="/galerie" className={LIEN_PRIMAIRE}>
                {T.parcourir}
              </Link>
              <Link href="/artistes" className={LIEN_SECONDAIRE}>
                {T.artistes}
              </Link>
            </div>

            {stats.length > 0 && (
              <dl className="mt-14 flex items-center gap-8 border-t border-neutral-200 pt-8">
                {stats.map(({ cle, valeur, libelle }) => (
                  <div key={cle} className="flex flex-col-reverse">
                    <dt className="mt-1 font-sans text-label-caps uppercase text-neutral-600">{libelle}</dt>
                    <dd className="font-serif text-2xl font-light leading-none text-foreground">{valeur}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div className="relative">
            <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-neutral-200 md:aspect-[4/5]">
              {oeuvre ? (
                <ArtworkImage
                  imageUrl={oeuvre.imageUrl}
                  title={oeuvre.title}
                  alt=""
                  gradient={oeuvre.gradient}
                  accentColor={oeuvre.accentColor}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              ) : (
                // Sans œuvre visible : fond neutre seul.
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-100 via-neutral-200 to-neutral-200" aria-hidden="true" />
              )}
            </div>

            {/* Légende : un seul lien vers la fiche de l'œuvre mise en avant. */}
            {oeuvre && (
              <Link
                href={`/galerie/${oeuvre.id}`}
                className="absolute inset-x-4 bottom-4 block rounded-sm border border-neutral-200 bg-background/90 px-4 py-3 backdrop-blur-sm"
              >
                <span className="block font-serif text-sm font-light text-foreground">
                  <em>{oeuvre.title}</em>
                </span>
                <span className="mt-0.5 block font-sans text-caption text-neutral-600">
                  {T.legende(oeuvre.technique, oeuvre.artist, oeuvre.year)}
                  {avecTaille && (
                    <>
                      {SEPARATEUR}
                      <DimensionsChoisies mm={oeuvre} />
                    </>
                  )}
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
