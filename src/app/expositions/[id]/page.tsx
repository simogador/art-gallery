import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getExhibitionBySlug,
  getRelatedExhibitions,
  getExhibitionArtworksBySlug,
  getExhibitionArtistsBySlug,
} from '@/lib/db/exhibitions'
import { ExhibitionDetail } from './ExhibitionDetail'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const exhibition = await getExhibitionBySlug(params.id)
  if (!exhibition) return { title: 'Exposition introuvable' }
  return {
    title: exhibition.title,
    description: exhibition.description.slice(0, 155),
    openGraph: {
      title: `${exhibition.title} — ${exhibition.subtitle}`,
      description: exhibition.description.slice(0, 155),
      type: 'article',
    },
  }
}

export default async function ExhibitionPage({ params }: Props) {
  const exhibition = await getExhibitionBySlug(params.id)
  if (!exhibition) notFound()

  const [artists, artworks, related] = await Promise.all([
    getExhibitionArtistsBySlug(params.id),
    getExhibitionArtworksBySlug(params.id),
    getRelatedExhibitions(params.id),
  ])

  return (
    <ExhibitionDetail
      exhibition={exhibition}
      artists={artists}
      artworks={artworks}
      related={related}
    />
  )
}
