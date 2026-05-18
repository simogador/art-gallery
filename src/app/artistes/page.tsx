import type { Metadata } from 'next'
import { ArtistsList } from './ArtistsList'

export const metadata: Metadata = {
  title: 'Artistes',
  description: "Découvrez les artistes représentés par notre galerie — une constellation de talents internationaux unis par une exigence commune de l'excellence.",
}

export default function ArtistesPage() {
  return <ArtistsList />
}
