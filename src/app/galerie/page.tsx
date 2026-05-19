import type { Metadata } from 'next'
import { getAllArtworks } from '@/lib/db/artworks'
import { GalleryPage } from './GalleryPage'

export const metadata: Metadata = {
  title: 'Collection',
  description: "La collection complète de la galerie — peintures, sculptures, photographies et art numérique, chaque œuvre authentifiée et livrée assurée.",
}

export default async function GaleriePage() {
  const artworks = await getAllArtworks()
  return <GalleryPage artworks={artworks} artistNames={[...new Set(artworks.map((a) => a.artist))]} />
}
