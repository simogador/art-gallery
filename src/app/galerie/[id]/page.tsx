import { cookies } from 'next/headers'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { descriptionFiche } from '@/lib/catalogue/mappers'
import { getArtworkBySlug, getRelatedArtworks, artisteDOeuvreRetiree } from '@/lib/catalogue'
import { COOKIE_PAYS, lirePays, nomPays } from '@/lib/livraison'
import { urlAbsolue } from '@/lib/reglages'
import { ArtworkDetail } from './ArtworkDetail'

// Story 3.3 : la fiche affiche le prix livré vers le pays du visiteur (cookie `pays`, France par
// défaut) : elle est rendue à chaque requête (lecture du cookie), sans `revalidate`. Une déclaration
// de l'artiste (story 2.8) s'y voit donc aussitôt.

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const artwork = await getArtworkBySlug(params.id)
  if (!artwork) return { title: 'Œuvre introuvable' }
  const titre = `${artwork.title} — ${artwork.artist}`
  const url = urlAbsolue(`/galerie/${artwork.id}`)
  const description = descriptionFiche(artwork)
  // Image de partage : la mise en situation (première photo de la fiche), sinon `imageUrl`.
  const image = (artwork.photos ?? [])[0]?.url ?? artwork.imageUrl ?? undefined
  const images = image ? [image] : undefined
  return {
    title: titre,
    description,
    alternates: { canonical: url },
    openGraph: { title: titre, description, type: 'article', url, images },
    twitter: { card: images ? 'summary_large_image' : 'summary', title: titre, description, images },
  }
}

export default async function ArtworkPage({ params }: Props) {
  // Story 2.2 : fiche des seules œuvres visibles. Retirée : redirection permanente vers son
  // artiste ; non publiée (brouillon, en curation) ou inconnue : 404.
  const pays = lirePays(cookies().get(COOKIE_PAYS)?.value)
  const artwork = await getArtworkBySlug(params.id, pays)
  if (!artwork) {
    const artiste = await artisteDOeuvreRetiree(params.id)
    if (artiste) permanentRedirect(`/artistes/${artiste}`)
    notFound()
  }

  const related = await getRelatedArtworks(artwork, 3, pays)

  return <ArtworkDetail artwork={artwork} related={related} pays={{ code: pays, nom: nomPays(pays) }} />
}
