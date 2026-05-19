import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getArtworkBySlug, getRelatedArtworks } from '@/lib/db/artworks'
import { getArtistBySlug } from '@/lib/db/artists'
import { ArtworkDetail } from './ArtworkDetail'

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
  const artwork = await getArtworkBySlug(params.id)
  if (!artwork) notFound()

  const [related, artist] = await Promise.all([
    getRelatedArtworks(artwork),
    getArtistBySlug(artwork.artistId),
  ])

  return <ArtworkDetail artwork={artwork} related={related} artist={artist} />
}
