import { Hero, Gallery, Artists, Exhibitions } from '@/components/sections'
import { accueilPublic } from '@/lib/catalogue'

// Story 2.9 : l'accueil lit le seul catalogue réel (module catalogue). Sans œuvre visible, la
// collection affiche son état vide ; les sections artistes et expositions vides sont masquées.
export default async function HomePage() {
  const { oeuvres, artistes, expositions, miseEnAvant, chiffres } = await accueilPublic()
  return (
    <>
      <Hero
        oeuvre={miseEnAvant}
        chiffres={chiffres}
        expositionEnCours={expositions.some((e) => e.status === 'en-cours')}
      />
      <Gallery artworks={oeuvres} />
      {artistes.length > 0 && <Artists artists={artistes} />}
      {expositions.length > 0 && <Exhibitions exhibitions={expositions} />}
    </>
  )
}
