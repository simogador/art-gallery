import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ARTWORKS } from '@/data/artworks'
import { getArtworkById, getRelatedArtworks } from '@/lib/utils/artworks'
import { ArtworkDetail } from './ArtworkDetail'

interface Props {
  params: { id: string }
}

export function generateStaticParams() {
  return ARTWORKS.map((a) => ({ id: a.id }))
}

export function generateMetadata({ params }: Props): Metadata {
  const artwork = getArtworkById(params.id)
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

export default function ArtworkPage({ params }: Props) {
  const artwork = getArtworkById(params.id)
  if (!artwork) notFound()

  const related = getRelatedArtworks(artwork)

  return <ArtworkDetail artwork={artwork} related={related} />
}
