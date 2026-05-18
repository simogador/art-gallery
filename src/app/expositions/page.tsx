import type { Metadata } from 'next'
import { ExhibitionsList } from './ExhibitionsList'

export const metadata: Metadata = {
  title: 'Expositions',
  description: "Programme des expositions de la galerie — monographiques et collectives, en cours, à venir et passées.",
}

export default function ExpositionsPage() {
  return <ExhibitionsList />
}
