import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getArtistBySlug, getArtistArtworksBySlug } from '@/lib/catalogue'
import { fr } from '@/lib/i18n'
import { COOKIE_PAYS, lirePays, nomPays } from '@/lib/livraison'
import { urlAbsolue } from '@/lib/reglages'
import { ArtistProfile } from './ArtistProfile'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const artist = await getArtistBySlug(params.id)
  if (!artist) return { title: fr.artistes.introuvable }
  const titre = [artist.name, artist.discipline].filter(Boolean).join(' — ')
  const description = Array.from(artist.bio.trim().replace(/\s+/g, ' ')).slice(0, 155).join('') || [artist.name, artist.discipline].filter(Boolean).join(', ')
  const url = urlAbsolue(`/artistes/${artist.id}`)
  const images = artist.imageUrl ? [artist.imageUrl] : undefined
  return {
    title: artist.name,
    description,
    alternates: { canonical: url },
    openGraph: { title: titre, description, type: 'profile', url, images },
    twitter: { card: images ? 'summary_large_image' : 'summary', title: titre, description, images },
  }
}

export default async function ArtistPage({ params }: Props) {
  // Story 3.11 : prix livré et délai vers le pays du visiteur (cookie `pays`) : page rendue à chaque requête.
  const pays = lirePays(cookies().get(COOKIE_PAYS)?.value)
  const [artist, artworks] = await Promise.all([
    getArtistBySlug(params.id),
    getArtistArtworksBySlug(params.id, pays),
  ])
  if (!artist) notFound()
  return <ArtistProfile artist={artist} artworks={artworks} pays={{ code: pays, nom: nomPays(pays) }} />
}
