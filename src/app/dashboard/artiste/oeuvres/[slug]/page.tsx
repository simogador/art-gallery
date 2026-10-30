import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { oeuvreAEditer } from '@/lib/catalogue'
import { ArtworkForm } from '@/components/dashboard/ArtworkForm'
import { acteurCourant } from '@/lib/acces'
import { StatusBadge } from '@/components/dashboard/StatusBadge'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return { title: `Modifier ${slug} — Errancy` }
}

export default async function EditOeuvrePage({ params }: Props) {
  // Rôle relu à chaque page : le layout n'est pas réexécuté lors d'une navigation interne.
  const acteur = await acteurCourant()
  if (acteur.type === 'visiteur') redirect('/auth/connexion')
  if (acteur.type !== 'artist') redirect('/dashboard')

  const { slug } = await params

  if (!acteur.artiste) redirect('/dashboard/artiste')

  // null si l'œuvre n'existe pas ou appartient à un autre artiste.
  const artwork = await oeuvreAEditer(acteur.userId, slug)
  if (!artwork) notFound()

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/dashboard/artiste/oeuvres"
            className="font-sans text-xs uppercase tracking-widest text-neutral-400 hover:text-foreground transition-colors duration-200"
          >
            Mes œuvres
          </Link>
          <span className="text-neutral-300">›</span>
          <span className="font-sans text-xs uppercase tracking-widest text-neutral-600 truncate max-w-xs">
            {artwork.title}
          </span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
              {artwork.title}
            </h1>
            <p className="font-sans text-sm text-neutral-400 mt-2">
              {artwork.year}{artwork.dimensionsLues ? ` · ${artwork.dimensionsLues}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <StatusBadge etat={artwork.etat} libelle={artwork.libelleEtat} />
            {/* Fiche publique seulement pour une œuvre visible (sinon 404 ou redirection). */}
            {artwork.visible && (
              <Link
                href={`/galerie/${artwork.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-sans text-xs uppercase tracking-widest text-neutral-400 hover:text-foreground transition-colors duration-200"
              >
                Voir ↗
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="divider mb-10" />

      <ArtworkForm
        mode="edit"
        artwork={{
          slug:        artwork.slug,
          title:       artwork.title,
          year:        artwork.year,
          medium:      artwork.medium,
          dimensions:  artwork.dimensions,
          price:       artwork.price,
          description: artwork.description,
          imageUrl:    artwork.imageUrl ?? null,
        }}
      />
    </div>
  )
}
