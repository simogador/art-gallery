import { cookies } from 'next/headers'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getArtworkBySlug, getRelatedArtworks, getArtistBySlug, artisteDOeuvreRetiree } from '@/lib/catalogue'
import { COOKIE_PAYS, lirePays, nomPays } from '@/lib/livraison'
import { ArtworkDetail } from './ArtworkDetail'

// Story 3.3 : la fiche affiche le prix livré vers le pays du visiteur (cookie `pays`, France par
// défaut) : elle est rendue à chaque requête (lecture du cookie), sans `revalidate`. Une déclaration
// de l'artiste (story 2.8) s'y voit donc aussitôt.

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const artwork = await getArtworkBySlug(params.id)
  if (!artwork) return { title: 'Œuvre introuvable' }
  return {
    title: `${artwork.title} — ${artwork.artist}`,
    description: artwork.description.slice(0, 155),
    openGraph: {
      title: `${artwork.title} — ${artwork.artist}`,
      description: artwork.description.slice(0, 155),
      type: 'article',
    },
  }
}

export default async function ArtworkPage({ params }: Props) {
  // Story 2.2 : fiche des seules œuvres visibles. Retirée : redirection permanente vers son
  // artiste ; non publiée (brouillon, en curation) ou inconnue : 404.
  const pays = lirePays(cookies().get(COOKIE_PAYS)?.value)
  const artwork = await getArtworkBySlug(params.id, pays)
  if (!artwork) {
    const artiste = await artisteDOeuvreRetiree(params.id)
    if (artiste) permanentRedirect(`/artistes/${artiste}`)
    notFound()
  }

  const [related, artist] = await Promise.all([
    getRelatedArtworks(artwork, 3, pays),
    getArtistBySlug(artwork.artistId),
  ])

  return <ArtworkDetail artwork={artwork} related={related} artist={artist} pays={{ code: pays, nom: nomPays(pays) }} />
}
