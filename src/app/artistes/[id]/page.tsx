import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ARTISTS } from '@/data/artists'
import { getArtistById, getArtistArtworks } from '@/lib/utils/artists'
import { ArtistProfile } from './ArtistProfile'

interface Props {
  params: { id: string }
}

export function generateStaticParams() {
  return ARTISTS.map((a) => ({ id: a.id }))
}

export function generateMetadata({ params }: Props): Metadata {
  const artist = getArtistById(params.id)
  if (!artist) return { title: 'Artiste introuvable' }
  return {
    title: artist.name,
    description: artist.bio,
    openGraph: {
      title: `${artist.name} — ${artist.discipline}`,
      description: artist.bio,
      type: 'profile',
    },
  }
}

export default function ArtistPage({ params }: Props) {
  const artist = getArtistById(params.id)
  if (!artist) notFound()

  const artworks = getArtistArtworks(artist.id)
  return <ArtistProfile artist={artist} artworks={artworks} />
}
