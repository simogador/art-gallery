import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { formaterMontant } from '@/lib/i18n'
import { ArtworkImage } from '@/components/ui'
import { gradient, accent } from '@/lib/catalogue/mappers'
import { ToggleAction } from '@/components/dashboard/ToggleAction'
import { DeleteButton } from '@/components/dashboard/DeleteButton'
import { acteurCourant } from '@/lib/acces'
import { basculesPublication, fileDeCuration, messageRefusCuration } from '@/lib/curation'
import {
  basculePossible, estDisponible, estEnCuration, estMarqueeDisponible, estPubliee, estRecopiee, estVendue, libelleEtat,
} from '@/lib/disponibilite'
import { FileDeCuration } from './FileDeCuration'

export const metadata: Metadata = { title: 'Œuvres — Admin Errancy' }

interface Props {
  searchParams?: Promise<{ decision?: string | string[] }>
}

const BANDEAUX_DECISION: Record<string, string> = {
  validee: 'Œuvre validée : elle est publiée et visible sur le site.',
  renvoyee: 'Œuvre renvoyée à l’artiste : elle redevient un brouillon, avec votre commentaire sur sa fiche.',
}

export default async function AdminOeuvresPage({ searchParams }: Props) {
  const acteur = await acteurCourant()
  if (acteur.type !== 'admin') redirect('/dashboard')

  // Story 2.7 : file de curation en tête (module curation), et bandeau après une décision.
  const decision = (await searchParams)?.decision
  const bandeau = typeof decision === 'string' ? BANDEAUX_DECISION[decision] : undefined
  const file = await fileDeCuration(acteur)

  const artworks = await prisma.artwork.findMany({
    orderBy: [{ createdAt: 'desc' }],
    include: { artist: { select: { name: true, slug: true } } },
  })

  // Story 2.7 : bascule « Publiée / Brouillon » seulement là où definirPublication l'accepte.
  const basculables = await basculesPublication(acteur, artworks.map((w) => w.slug))

  // Story 2.2 : états lus par le module disponibilite.
  const available   = artworks.filter((w) => estDisponible(w)).length
  const sold        = artworks.filter((w) => estVendue(w)).length
  const nonPubliees = artworks.filter((w) => !estPubliee(w)).length

  return (
    <div>
      <div className="mb-10">
        <p className="font-sans text-xs uppercase tracking-[0.25em] text-neutral-600 mb-3">Gestion</p>
        <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
          Œuvres
        </h1>
        <p className="font-sans text-sm text-neutral-600 mt-2">
          {artworks.length} œuvre{artworks.length > 1 ? 's' : ''} · {available} disponibles · {sold} vendues · {nonPubliees} non publiées
        </p>
      </div>

      {bandeau && (
        <p role="status" className="mb-8 font-sans text-sm text-foreground bg-neutral-50 border border-neutral-200 rounded-sm px-4 py-3">
          {bandeau}
        </p>
      )}

      <FileDeCuration file={file.ok ? file.file : []} erreur={file.ok ? undefined : messageRefusCuration(file.code)} />

      <h2 className="font-serif font-light text-foreground text-2xl mb-4">Toutes les œuvres</h2>

      {/* Column headers */}
      <div className="hidden lg:grid grid-cols-[56px_1fr_140px_90px_110px_90px_80px] gap-4 px-4 mb-2">
        {['', 'Titre', 'Artiste', 'Prix', 'Publication', 'Statut', ''].map((h, i) => (
          <span key={i} className="font-sans text-[10px] uppercase tracking-widest text-neutral-600">{h}</span>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {artworks.map((artwork) => (
          <div key={artwork.slug}
            className="grid grid-cols-[48px_1fr_auto] lg:grid-cols-[56px_1fr_140px_90px_110px_90px_80px] gap-4 items-center p-4 border border-neutral-200 rounded-sm hover:border-neutral-300 transition-colors duration-200 group">

            {/* Thumbnail */}
            <div className="relative w-12 h-14 rounded-sm overflow-hidden flex-shrink-0">
              <ArtworkImage
                imageUrl={artwork.imageUrl}
                title={artwork.title}
                gradient={gradient(artwork.slug)}
                accentColor={accent(artwork.slug)}
                sizes="48px"
              />
            </div>

            {/* Title */}
            <div className="min-w-0">
              <p className="font-serif text-base font-light text-foreground group-hover:text-neutral-600 transition-colors duration-200 truncate">
                {artwork.title || 'Sans titre'}
              </p>
              {/* Brouillon de dépôt (story 2.5) : année 0 tant qu'elle n'est pas saisie. */}
              <p className="font-sans text-xs text-neutral-600 mt-0.5">{[artwork.year, artwork.medium].filter(Boolean).join(' · ')}</p>
            </div>

            {/* Artist */}
            <Link href={`/artistes/${artwork.artist.slug}`} target="_blank"
              className="font-sans text-xs text-neutral-500 hover:text-foreground truncate hidden lg:block">
              {artwork.artist.name}
            </Link>

            {/* Price */}
            <p className="font-serif text-sm font-light text-foreground hidden lg:block">
              {formaterMontant(artwork.prixCentimes, artwork.devise)}
            </p>

            {/* Publication toggle (module curation) ; une œuvre en curation, déposée non validée ou sans
                accord signé passe par la file de curation (story 2.7). */}
            <div className="hidden lg:block">
              {estRecopiee(artwork) && basculables.has(artwork.slug) ? (
              <ToggleAction
                value={estPubliee(artwork)}
                apiUrl={`/api/admin/oeuvres/${artwork.slug}`}
                field="publiee"
                labelOn="Publiée"
                labelOff="Brouillon"
                colorOn="blue"
              />
              ) : <span className="font-sans text-[10px] uppercase tracking-widest text-neutral-600">{libelleEtat(artwork)}</span>}
            </div>

            {/* Status toggle (module disponibilite) : seulement entre disponible et vendue ;
                réservée, vendue ailleurs, retirée ou non recopiée en lecture seule. */}
            <div className="hidden lg:block" title={libelleEtat(artwork)}>
              {basculePossible(artwork) ? (
              <ToggleAction
                value={estMarqueeDisponible(artwork)}
                apiUrl={`/api/admin/oeuvres/${artwork.slug}`}
                field="available"
                labelOn="Dispo"
                labelOff="Vendue"
                colorOn="green"
              />
              ) : <span className="font-sans text-[10px] uppercase tracking-widest text-neutral-600">{libelleEtat(artwork)}</span>}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Link
                href={`/dashboard/admin/oeuvres/${artwork.slug}`}
                className="font-sans text-[10px] uppercase tracking-widest text-neutral-600 hover:text-foreground transition-colors duration-200"
              >
                {estEnCuration(artwork) ? 'Relire' : 'Éditer'}
              </Link>
              <DeleteButton
                apiUrl={`/api/admin/oeuvres/${artwork.slug}`}
                label="Suppr."
                confirm={`Supprimer "${artwork.title}" ? Cette action est irréversible.`}
                redirectTo="/dashboard/admin/oeuvres"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
