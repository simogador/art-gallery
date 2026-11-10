import { cookies } from 'next/headers'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { descriptionFiche } from '@/lib/catalogue/mappers'
import { getArtworkBySlug, getRelatedArtworks, artisteDOeuvreRetiree } from '@/lib/catalogue'
import { COOKIE_PAYS, lirePays, nomPays } from '@/lib/livraison'
import { lot2Ouvert, urlAbsolue } from '@/lib/reglages'
import { BoutonConseil } from '@/components/ui/BoutonConseil'
import { mesurer } from '@/lib/mesure'
import { ArtworkDetail } from './ArtworkDetail'

// Story 3.3 : la fiche affiche le prix livré vers le pays du visiteur (cookie `pays`, France par
// défaut) : elle est rendue à chaque requête (lecture du cookie), sans `revalidate`. Une déclaration
// de l'artiste (story 2.8) s'y voit donc aussitôt.

interface Props {
  params: { id: string }
  searchParams?: { utm_source?: string | string[] }
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

export default async function ArtworkPage({ params, searchParams }: Props) {
  // Story 2.2 : fiche des seules œuvres visibles. Retirée : redirection permanente vers son
  // artiste ; non publiée (brouillon, en curation) ou inconnue : 404.
  const pays = lirePays(cookies().get(COOKIE_PAYS)?.value)
  const artwork = await getArtworkBySlug(params.id, pays)
  if (!artwork) {
    const artiste = await artisteDOeuvreRetiree(params.id)
    if (artiste) permanentRedirect(`/artistes/${artiste}`)
    notFound()
  }

  // Story 4.8 : vue de fiche, seulement avec le consentement du visiteur (relu dans le cookie), jamais
  // pour un administrateur ; une erreur de mesure ne casse pas la fiche. La source d'arrivée vient de
  // `utm_source` ou du référent.
  const utm = searchParams?.utm_source
  const [related] = await Promise.all([
    getRelatedArtworks(artwork, 3, pays),
    mesurer({ nom: 'VueFiche', slug: artwork.id }, { chemin: `/galerie/${artwork.id}`, utm: Array.isArray(utm) ? utm[0] : utm }),
  ])

  // Story 4.4 : bouton Conseil WhatsApp rendu côté serveur (heure et numéro lus à chaque requête).
  const conseil = <BoutonConseil contexte={{ type: 'oeuvre', slug: artwork.id, titre: artwork.title }} />

  return <ArtworkDetail artwork={artwork} related={related} pays={{ code: pays, nom: nomPays(pays) }} conseil={conseil} lot2Ouvert={lot2Ouvert()} />
}
