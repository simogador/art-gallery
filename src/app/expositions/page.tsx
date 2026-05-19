import type { Metadata } from 'next'
import { getAllExhibitions } from '@/lib/db/exhibitions'
import { ExhibitionsList } from './ExhibitionsList'

export const metadata: Metadata = {
  title: 'Expositions',
  description: "Programme des expositions de la galerie — monographiques et collectives, en cours, à venir et passées.",
}

export default async function ExpositionsPage() {
  const exhibitions = await getAllExhibitions()
  return <ExhibitionsList exhibitions={exhibitions} />
}
