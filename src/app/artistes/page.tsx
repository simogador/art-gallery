import type { Metadata } from 'next'
import { getAllArtists } from '@/lib/db/artists'
import { ArtistsList } from './ArtistsList'

export const metadata: Metadata = {
  title: 'Artistes',
  description: "Découvrez les artistes représentés par notre galerie — une constellation de talents internationaux unis par une exigence commune de l'excellence.",
}

export default async function ArtistesPage() {
  const artists = await getAllArtists()
  return <ArtistsList artists={artists} />
}
