import Link from 'next/link'
import { ArtworkImage, DimensionsChoisies } from '@/components/ui'
import { formaterMontant, fr, MONTANT_ABSENT } from '@/lib/i18n'
import type { Artwork } from '@/lib/types'

// Vignette de la galerie (story 3.9, UX-DR22) : une seule cible, le lien vers la fiche. Artiste,
// dimensions (unité choisie), prix livré et délai viennent de `Artwork` (prix livré : module
// livraison, story 3.3) ; aucun calcul ici, aucun prix barré ni étiquette promotionnelle.

// Story 3.10 : l'accueil réutilise la même vignette sous un titre de section (h2) ; le titre de
// l'œuvre y descend alors d'un niveau (`niveau` h3), sans autre différence.
export function VignetteOeuvre({
  artwork,
  paysNom,
  niveau: Titre = 'h2',
}: {
  artwork: Artwork
  paysNom: string
  niveau?: 'h2' | 'h3'
}) {
  const prix = artwork.prixLivre
  const avecTaille = artwork.hauteurMm !== null && artwork.largeurMm !== null

  return (
    <article>
      <Link href={`/galerie/${artwork.id}`} className="group block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-neutral-100">
          <ArtworkImage
            imageUrl={artwork.imageUrl}
            title={artwork.title}
            alt=""
            gradient={artwork.gradient}
            accentColor={artwork.accentColor}
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        </div>
        <Titre className="mt-3 font-serif text-heading-sm text-foreground group-hover:underline group-hover:underline-offset-4">
          {artwork.title}
        </Titre>
        <p className="mt-1 font-sans text-caption text-neutral-600">{artwork.artist}</p>
        {avecTaille && (
          <p className="font-sans text-caption text-neutral-600">
            <DimensionsChoisies mm={artwork} />
          </p>
        )}
        {artwork.sold ? (
          <p className="mt-2 font-sans text-body-strong text-foreground">{fr.galerie.vendue}</p>
        ) : prix?.livree ? (
          <>
            <p className="mt-2 font-sans text-body-strong text-foreground">{formaterMontant(prix.totalCentimes, prix.devise)}</p>
            <p className="font-sans text-caption text-neutral-600">{fr.livraison.delai(prix.delaiMinJours, prix.delaiMaxJours)}</p>
            <p className="font-sans text-caption text-neutral-600">{fr.livraison.droitsNonInclus}</p>
          </>
        ) : prix && prix.raison === 'sans_prix' ? (
          <p className="mt-2 font-sans text-body-strong text-foreground">{MONTANT_ABSENT}</p>
        ) : (
          <p className="mt-2 font-sans text-caption text-neutral-600">{fr.livraison.pasDeLivraison(paysNom)}</p>
        )}
      </Link>
    </article>
  )
}
