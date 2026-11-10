import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getArtworkBySlug } from '@/lib/catalogue'
import { fr } from '@/lib/i18n'
import { DELAI_REPONSE_DEMANDE_HEURES } from '@/lib/reglages'
import { FormulaireVisite } from './FormulaireVisite'

// Demande de visite à distance ou en atelier (story 4.3, FR-8, UJ-4). Œuvre visible et disponible
// seulement : inconnue, non visible, vendue, réservée ou retirée → 404 (le serveur revérifie à
// l'envoi). Aucun lien depuis la fiche avant la story 4.7 : la page n'est joignable que par son
// adresse, et n'est pas indexée. Rendue à chaque requête (l'état de l'œuvre change).

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const artwork = await getArtworkBySlug(params.id)
  return {
    title: artwork && !artwork.sold ? fr.visite.titrePage(artwork.title) : fr.visite.titre,
    robots: { index: false, follow: false },
  }
}

export default async function PageVisite({ params }: Props) {
  const artwork = await getArtworkBySlug(params.id)
  // `sold` : tout ce qui n'est pas disponible (réservée, vendue, vendue ailleurs).
  if (!artwork || artwork.sold) notFound()

  return (
    <div className="container-premium pb-16 pt-28 md:pb-24 md:pt-36">
      <div className="max-w-xl">
        <Link
          href={`/galerie/${artwork.id}`}
          className="inline-flex min-h-touch-target items-center font-sans text-sm text-neutral-600 underline underline-offset-4"
        >
          {fr.visite.retour}
        </Link>
        <h1 className="mt-4 font-serif text-display-md text-foreground">{fr.visite.titre}</h1>
        <p className="mt-4 font-sans text-base text-neutral-600">{fr.visite.introduction(artwork.title, artwork.artist)}</p>
        <FormulaireVisite
          slug={artwork.id}
          atelierAccepte={artwork.visitesAtelier === true}
          delaiHeures={DELAI_REPONSE_DEMANDE_HEURES}
        />
      </div>
    </div>
  )
}
