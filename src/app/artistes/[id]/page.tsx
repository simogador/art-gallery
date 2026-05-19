import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getArtistBySlug, getArtistArtworksBySlug } from '@/lib/db/artists'
import { ArtistProfile } from './ArtistProfile'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const artist = await getArtistBySlug(params.id)
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

export default async function ArtistPage({ params }: Props) {
  const [artist, artworks] = await Promise.all([
    getArtistBySlug(params.id),
    getArtistArtworksBySlug(params.id),
  ])
  if (!artist) notFound()
  return <ArtistProfile artist={artist} artworks={artworks} />
}
