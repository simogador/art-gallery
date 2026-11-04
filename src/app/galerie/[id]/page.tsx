import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getArtworkBySlug, getRelatedArtworks, getArtistBySlug, artisteDOeuvreRetiree } from '@/lib/catalogue'
import { ArtworkDetail } from './ArtworkDetail'

// Story 2.8 : une déclaration de l'artiste (vendue ailleurs, retirée) se voit en moins de 60 s.
// La page est rendue à chaque requête (mise en page dynamique) et l'action de l'artiste la
// revalide aussitôt ; ce plafond ne joue que si elle redevenait statique un jour.
export const revalidate = 60

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
  const artwork = await getArtworkBySlug(params.id)
  if (!artwork) {
    const artiste = await artisteDOeuvreRetiree(params.id)
    if (artiste) permanentRedirect(`/artistes/${artiste}`)
    notFound()
  }

  const [related, artist] = await Promise.all([
    getRelatedArtworks(artwork),
    getArtistBySlug(artwork.artistId),
  ])

  return <ArtworkDetail artwork={artwork} related={related} artist={artist} />
}
