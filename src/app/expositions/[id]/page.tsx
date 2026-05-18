import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { EXHIBITIONS } from '@/data/exhibitions'
import {
  getExhibitionById,
  getRelatedExhibitions,
  getExhibitionArtworks,
  getExhibitionArtistData,
} from '@/lib/utils/exhibitions'
import { ExhibitionDetail } from './ExhibitionDetail'

interface Props {
  params: { id: string }
}

export function generateStaticParams() {
  return EXHIBITIONS.map((e) => ({ id: e.id }))
}

export function generateMetadata({ params }: Props): Metadata {
  const exhibition = getExhibitionById(params.id)
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

export default function ExhibitionPage({ params }: Props) {
  const exhibition = getExhibitionById(params.id)
  if (!exhibition) notFound()

  return (
    <ExhibitionDetail
      exhibition={exhibition}
      artists={getExhibitionArtistData(exhibition)}
      artworks={getExhibitionArtworks(exhibition)}
      related={getRelatedExhibitions(exhibition)}
    />
  )
}
