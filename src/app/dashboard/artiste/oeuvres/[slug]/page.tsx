import * as React from 'react'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { oeuvreAEditer } from '@/lib/catalogue'
import { ArtworkForm } from '@/components/dashboard/ArtworkForm'
import { acteurCourant } from '@/lib/acces'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { lireDepot, lireOeuvreEnCuration } from '@/lib/curation'
import { zonesOuvertes } from '@/lib/livraison'
import { DELAI_REPONSE_CURATION_JOURS } from '@/lib/reglages'
import { PageDepot } from '../depot/PageDepot'
import { RecapitulatifCuration } from '../depot/RecapitulatifCuration'

interface Props {
  params: Promise<{ slug: string }>
}

// Une seule lecture du dépôt par requête, partagée par generateMetadata et la page. React.cache
// n'existe que dans le React serveur de Next.js ; ailleurs (tests), appel direct.
const memoiser: <F extends (...args: never[]) => unknown>(f: F) => F =
  'cache' in React ? (React as unknown as { cache: <F>(f: F) => F }).cache : (f) => f
const depotDeLaPage = memoiser(async (slug: string) => lireDepot(await acteurCourant(), slug))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if ((await depotDeLaPage(slug)).ok) return { title: 'Déposer une œuvre — Errancy' }
  return { title: `Modifier ${slug} — Errancy` }
}

export const dynamic = 'force-dynamic'

export default async function EditOeuvrePage({ params }: Props) {
  // Rôle relu à chaque page : le layout n'est pas réexécuté lors d'une navigation interne.
  const acteur = await acteurCourant()
  if (acteur.type === 'visiteur') redirect('/auth/connexion')
  if (acteur.type !== 'artist') redirect('/dashboard')

  const { slug } = await params

  if (!acteur.artiste) redirect('/dashboard/artiste')

  // Story 2.5 : un brouillon de l'artiste s'ouvre dans le formulaire de dépôt. Une œuvre d'un autre
  // artiste (acces_refuse) ou inexistante : 404. Story 2.6 : une œuvre en curation s'affiche en
  // lecture seule (récapitulatif et délai de réponse) ; une œuvre publiée garde l'ancienne page
  // d'édition, jusqu'aux stories 2.7 et 2.8.
  const depot = await depotDeLaPage(slug)
  if (depot.ok) {
    return <PageDepot depot={depot.depot} zones={await zonesOuvertes()} />
  }
  if (depot.code !== 'transition_interdite') notFound()

  const enCuration = await lireOeuvreEnCuration(acteur, slug)
  if (enCuration.ok) return <RecapitulatifCuration recap={enCuration.recap} delaiJours={DELAI_REPONSE_CURATION_JOURS} />

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
