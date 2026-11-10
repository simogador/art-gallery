import type { Metadata } from 'next'
import { getAllArtists } from '@/lib/catalogue'
import { fr } from '@/lib/i18n'
import { urlAbsolue } from '@/lib/reglages'
import { ArtistsList } from './ArtistsList'

export const metadata: Metadata = {
  title: fr.artistes.titre,
  description: fr.artistes.description,
  alternates: { canonical: urlAbsolue('/artistes') },
}

export default async function ArtistesPage() {
  return <ArtistsList artists={await getAllArtists()} />
}
