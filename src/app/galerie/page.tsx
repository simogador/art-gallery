import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { getAllArtworks } from '@/lib/catalogue'
import { COOKIE_PAYS, lirePays, nomPays } from '@/lib/livraison'
import { GalleryPage } from './GalleryPage'

export const metadata: Metadata = {
  title: 'Collection',
  description: "La collection complète de la galerie — peintures, sculptures, photographies et art numérique, chaque œuvre authentifiée et livrée assurée.",
}

// Story 3.3 : prix livré et délai vers le pays du visiteur (cookie `pays`, France par défaut),
// calculés par le module livraison ; page rendue à chaque requête (lecture du cookie).
export default async function GaleriePage() {
  const pays = lirePays(cookies().get(COOKIE_PAYS)?.value)
  const artworks = await getAllArtworks(pays)
  return (
    <GalleryPage
      artworks={artworks}
      artistNames={[...new Set(artworks.map((a) => a.artist))]}
      pays={{ code: pays, nom: nomPays(pays) }}
    />
  )
}
