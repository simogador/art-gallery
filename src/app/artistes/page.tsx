import type { Metadata } from 'next'
import { getAllArtists, getAllExhibitions } from '@/lib/catalogue'
import { ArtistsList } from './ArtistsList'

export const metadata: Metadata = {
  title: 'Artistes',
  description: "Découvrez les artistes représentés par notre galerie — une constellation de talents internationaux unis par une exigence commune de l'excellence.",
}

export default async function ArtistesPage() {
  const [artists, exhibitions] = await Promise.all([getAllArtists(), getAllExhibitions()])
  return <ArtistsList artists={artists} exhibitionsCount={exhibitions.length} />
}
