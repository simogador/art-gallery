import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { formatPrice } from '@/lib/utils/artworks'
import { ArtworkImage } from '@/components/ui'
import { oeuvresDeLArtiste, gradient, accent } from '@/lib/catalogue'
import { acteurCourant } from '@/lib/acces'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { InfoBanner } from '@/components/dashboard/InfoBanner'
import { AvailabilityPicker, BoutonAnnulerDeclaration } from '@/components/dashboard/AvailabilityPicker'
import { dernieresDeclarations, ecrireAEquipe, heureLisible, messageDeclaration } from '@/lib/disponibilite'
import { CONTACT_EQUIPE, DELAI_ANNULATION_DECLARATION_MINUTES, DELAI_REPONSE_CURATION_JOURS } from '@/lib/reglages'

export const metadata: Metadata = { title: 'Mes œuvres — Errancy' }

interface Props {
  searchParams?: Promise<{ envoyee?: string | string[]; declaration?: string | string[]; annulee?: string | string[] }>
}

export const dynamic = 'force-dynamic'

export default async function OeuvresPage({ searchParams }: Props) {
  // Story 2.6 : retour après un envoi en curation (?envoyee=1), bandeau du délai de réponse.
  const params = await searchParams
  const envoyee = params?.envoyee === '1'
  // Story 2.8 : retour après une déclaration (?declaration=<slug>) ou son annulation (?annulee=<slug>).
  const slugDeclare = typeof params?.declaration === 'string' ? params.declaration : null
  const slugAnnule = typeof params?.annulee === 'string' ? params.annulee : null

  // Rôle relu à chaque page : le layout n'est pas réexécuté lors d'une navigation interne.
  const acteur = await acteurCourant()
  if (acteur.type === 'visiteur') redirect('/auth/connexion')
  if (acteur.type !== 'artist') redirect('/dashboard')

  const lues = await oeuvresDeLArtiste(acteur.userId)
  if (!lues) redirect('/dashboard/artiste')
  const artworks = lues.oeuvres

  // États calculés par le module disponibilite (story 2.2).
  const available = artworks.filter((w) => w.disponible).length
  const sold      = artworks.filter((w) => w.vendue).length

  // Story 2.8 : déclarations en vigueur (bandeau, « Annuler » dans le délai), œuvres de l'artiste seulement.
  const declarations = await dernieresDeclarations(acteur, artworks.map((w) => w.slug))
  const declaree = slugDeclare ? declarations.get(slugDeclare) ?? null : null
  const oeuvreAnnulee = slugAnnule ? artworks.find((w) => w.slug === slugAnnule && w.disponible) ?? null : null

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-10 gap-4">
        <div>
          <p className="font-sans text-xs uppercase tracking-[0.25em] text-neutral-600 mb-3">Collection</p>
          <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
            Mes œuvres
          </h1>
          <p className="font-sans text-sm text-neutral-600 mt-2">
            {artworks.length} œuvre{artworks.length !== 1 ? 's' : ''} · {available} disponible{available !== 1 ? 's' : ''} · {sold} vendue{sold !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/dashboard/artiste/oeuvres/nouvelle"
          className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-sm font-sans text-xs uppercase tracking-widest hover:bg-neutral-700 transition-colors duration-300"
        >
          <PlusIcon />
          Ajouter
        </Link>
      </div>

      {envoyee && (
        <p role="status" className="mb-8 font-sans text-sm text-foreground bg-neutral-50 border border-neutral-200 rounded-sm px-4 py-3">
          Votre œuvre a été envoyée à l&apos;équipe Errancy. Elle est maintenant « En curation » :
          l&apos;équipe vous répond sous {DELAI_REPONSE_CURATION_JOURS} jours.
        </p>
      )}

      {declaree && slugDeclare && (
        <InfoBanner
          action={declaree.annulable ? <BoutonAnnulerDeclaration slug={slugDeclare} retour="liste" lien /> : undefined}
        >
          {messageDeclaration(declaree.type, declaree.le)}
        </InfoBanner>
      )}

      {oeuvreAnnulee && (
        <InfoBanner>Déclaration annulée : « {oeuvreAnnulee.title} » est de nouveau en vente.</InfoBanner>
      )}

      {artworks.length === 0 ? (
        <div className="py-32 border border-dashed border-neutral-200 rounded-sm flex flex-col items-center justify-center text-center">
          <p className="font-serif text-xl font-light text-neutral-600 mb-2">Aucune œuvre</p>
          <p className="font-sans text-sm text-neutral-600 mb-8 max-w-xs">
            Commencez par ajouter votre première œuvre à la collection Errancy.
          </p>
          <Link
            href="/dashboard/artiste/oeuvres/nouvelle"
            className="font-sans text-xs uppercase tracking-widest text-foreground border border-neutral-200 rounded-sm px-6 py-3 hover:border-foreground transition-colors duration-300"
          >
            Ajouter une œuvre
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[56px_1fr_120px_100px_120px_44px] gap-4 items-center px-4 mb-1">
            {['', 'Titre', 'Technique', 'Prix', 'Statut', ''].map((h) => (
              <span key={h} className="font-sans text-[10px] uppercase tracking-widest text-neutral-600">{h}</span>
            ))}
          </div>

          {artworks.map((artwork) => {
            const declaration = declarations.get(artwork.slug)
            // « Annuler » dans le bandeau pour l'œuvre qui vient d'être déclarée : un seul lien.
            const annulableJusquA =
              declaration?.annulable && artwork.slug !== slugDeclare ? heureLisible(declaration.annulableJusquA) : null
            return (
            <div
              key={artwork.slug}
              className="grid grid-cols-[48px_1fr_auto] md:grid-cols-[56px_1fr_120px_100px_120px_44px] gap-x-4 gap-y-3 items-center p-4 border border-neutral-200 rounded-sm hover:border-neutral-400 transition-colors duration-200 group"
            >
              {/* Thumbnail */}
              <div className="relative w-12 h-14 md:w-14 md:h-[3.5rem] rounded-sm overflow-hidden flex-shrink-0">
                <ArtworkImage
                  imageUrl={artwork.imageUrl}
                  title={artwork.title}
                  gradient={gradient(artwork.slug)}
                  accentColor={accent(artwork.slug)}
                  sizes="56px"
                />
              </div>

              {/* Title + year */}
              <div className="min-w-0">
                <p className="font-serif text-base font-light text-foreground group-hover:text-neutral-600 transition-colors duration-200 truncate">
                  {artwork.title}
                </p>
                <p className="font-sans text-xs text-neutral-600 mt-0.5 truncate">
                  {[artwork.year, artwork.dimensions].filter(Boolean).join(' · ')}
                </p>
                {/* Badge visible aussi sur téléphone. */}
                <div className="mt-1.5 md:hidden">
                  <StatusBadge etat={artwork.etat} libelle={artwork.libelleEtat} />
                </div>
              </div>

              {/* Technique */}
              <p className="font-sans text-xs text-neutral-500 truncate hidden md:block">
                {artwork.medium}
              </p>

              {/* Price */}
              <p className="font-serif text-sm font-light text-foreground hidden md:block">
                {artwork.prix !== null ? formatPrice(artwork.prix) : '—'}
              </p>

              {/* Status */}
              <div className="hidden md:flex">
                <StatusBadge etat={artwork.etat} libelle={artwork.libelleEtat} />
              </div>

              {/* Edit link */}
              <Link
                href={`/dashboard/artiste/oeuvres/${artwork.slug}`}
                className="flex items-center justify-center w-11 h-11 rounded-sm border border-neutral-200 hover:border-foreground hover:bg-neutral-50 transition-all duration-200 group/edit"
                aria-label={`${artwork.etat === 'en_curation' ? 'Voir' : 'Modifier'} ${artwork.title}`}
              >
                <EditIcon />
              </Link>

              {/* Story 2.8 : disponibilité tenue par l'artiste (clé : remonté après chaque changement d'état). */}
              <div className="col-span-full empty:hidden">
                <AvailabilityPicker
                  key={`${artwork.slug}-${artwork.etat}`}
                  slug={artwork.slug}
                  titre={artwork.title}
                  declarations={artwork.declarations}
                  contactEquipe={ecrireAEquipe(artwork.etat, declaration?.annulable ?? false)}
                  remiseEnVente={artwork.remiseEnVente}
                  contact={CONTACT_EQUIPE}
                  delaiAnnulationMinutes={DELAI_ANNULATION_DECLARATION_MINUTES}
                  annulableJusquA={annulableJusquA}
                  retour="liste"
                />
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className="text-neutral-600 group-hover/edit:text-foreground transition-colors duration-200">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}
