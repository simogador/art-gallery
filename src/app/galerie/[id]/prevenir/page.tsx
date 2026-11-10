import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getArtworkBySlug } from '@/lib/catalogue'
import { fr } from '@/lib/i18n'
import { CONTACT_EQUIPE } from '@/lib/reglages'
import { FormulairePrevenir } from './FormulairePrevenir'

// « Me prévenir » sur une œuvre réservée (story 4.5, FR-9). Œuvre visible et réservée seulement :
// inconnue, non visible, disponible, vendue ou retirée → 404 (le serveur revérifie à l'envoi). Lien
// depuis la barre d'actions de la fiche ; page non indexée, rendue à chaque requête (l'état change).

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const artwork = await getArtworkBySlug(params.id)
  return {
    title: artwork?.reservee ? fr.prevenir.titrePage(artwork.title) : fr.prevenir.titre,
    robots: { index: false, follow: false },
  }
}

export default async function PagePrevenir({ params }: Props) {
  const artwork = await getArtworkBySlug(params.id)
  if (!artwork || !artwork.reservee) notFound()

  return (
    <div className="container-premium pb-16 pt-28 md:pb-24 md:pt-36">
      <div className="max-w-xl">
        <Link
          href={`/galerie/${artwork.id}`}
          className="inline-flex min-h-touch-target items-center font-sans text-sm text-neutral-600 underline underline-offset-4"
        >
          {fr.prevenir.retour}
        </Link>
        <h1 className="mt-4 font-serif text-display-md text-foreground">{fr.prevenir.titre}</h1>
        <p className="mt-4 font-sans text-base text-neutral-600">{fr.prevenir.introduction(artwork.title, artwork.artist)}</p>
        <FormulairePrevenir slug={artwork.id} contact={CONTACT_EQUIPE} />
      </div>
    </div>
  )
}
