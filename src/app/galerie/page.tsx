import type { Metadata } from 'next'
import { GalleryPage } from './GalleryPage'

export const metadata: Metadata = {
  title: 'Collection',
  description: "La collection complète de la galerie — peintures, sculptures, photographies et art numérique, chaque œuvre authentifiée et livrée assurée.",
}

export default function GaleriePage() {
  return <GalleryPage />
}
