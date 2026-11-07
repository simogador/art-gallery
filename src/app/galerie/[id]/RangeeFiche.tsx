'use client'

import type { ReactNode } from 'react'
import { PaysLivraison, useUnite } from '@/components/ui'
import { formaterDimensionsDouble, formaterMontant, fr, MONTANT_ABSENT, SEPARATEUR } from '@/lib/i18n'
import { formatOeuvre, orientationOeuvre } from '@/lib/reglages'
import type { Artwork } from '@/lib/types'

// Story 3.5 (FR-1 à FR-4, UX-DR15, UX-DR18) : rangée de trois cases Taille / Prix livré / Délai
// (DESIGN.md `tile-row`). Le prix livré et le délai viennent de `Artwork.prixLivre` (module
// livraison, story 3.3) : aucun calcul ici. Orientation et format : fonctions pures de `reglages`
// (seuils du porteur) ; les textes viennent de `fr`.

type Props = {
  artwork: Pick<Artwork, 'artist' | 'hauteurMm' | 'largeurMm' | 'profondeurMm' | 'prixLivre'>
  pays: { code: string; nom: string }
  /** Œuvre vendue (story 3.7) : la case Taille seule, ni prix livré, ni délai, ni choix du pays. */
  vendue?: boolean
}

export function RangeeFiche({ artwork, pays, vendue = false }: Props) {
  const textes = fr.fiche.rangee
  const unite = useUnite()
  const tailles = formaterDimensionsDouble(artwork, unite)
  const orientation = orientationOeuvre(artwork.hauteurMm, artwork.largeurMm)
  const format = formatOeuvre(artwork.hauteurMm, artwork.largeurMm)
  const prix = artwork.prixLivre
  const livree = prix?.livree === true
  const sansTaille = vendue && !tailles
  const sansPrix = !prix || (prix.livree === false && prix.raison === 'sans_prix')

  // Œuvre vendue sans dimensions : rien à afficher (pas de case Taille vide).
  if (sansTaille) return null

  return (
    <div>
      <dl aria-label={vendue ? textes.taille : textes.libelle} className={vendue ? 'grid grid-cols-1 gap-[6px]' : 'grid grid-cols-3 gap-[6px]'}>
        <Case libelle={textes.taille}>
          <dd className="font-sans text-body-strong text-foreground">{tailles?.[0] ?? MONTANT_ABSENT}</dd>
          {tailles && (
            <>
              <dd className="font-sans text-caption text-neutral-600">{tailles[1]}</dd>
              {orientation && format && (
                <dd className="font-sans text-caption text-neutral-600">
                  {textes.orientation[orientation] + SEPARATEUR + textes.format[format]}
                </dd>
              )}
            </>
          )}
        </Case>

        {!vendue && (
        <Case libelle={fr.livraison.prixLivre}>
          {prix?.livree ? (
            <dd className="font-sans text-body-strong text-foreground">{formaterMontant(prix.totalCentimes, prix.devise)}</dd>
          ) : sansPrix ? (
            <dd className="font-sans text-body-strong text-foreground">{MONTANT_ABSENT}</dd>
          ) : (
            <>
              <dd className="font-sans text-body-strong text-foreground">{textes.pasDeLivraison(pays.nom)}</dd>
              <dd className="font-sans text-caption text-neutral-600">{textes.neLivrePas(artwork.artist, pays.nom)}</dd>
            </>
          )}
        </Case>
        )}

        {!vendue && (
        <Case libelle={textes.delai}>
          {prix?.livree ? (
            <>
              <dd className="font-sans text-body-strong text-foreground">{textes.delaiJours(prix.delaiMinJours, prix.delaiMaxJours)}</dd>
              <dd className="font-sans text-caption text-neutral-600">{textes.livreeChezVous}</dd>
            </>
          ) : (
            <dd className="font-sans text-body-strong text-foreground">{MONTANT_ABSENT}</dd>
          )}
        </Case>
        )}
      </dl>

      {/* Pays choisi et « Modifier » (change le pays, recalcule côté serveur) puis mention des droits. */}
      {!vendue && <PaysLivraison code={pays.code} nom={pays.nom} className="mt-2" />}
      {!vendue && livree && <p className="mt-1 font-sans text-caption text-neutral-600">{fr.livraison.droitsNonInclus}</p>}
    </div>
  )
}

function Case({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-sm border border-neutral-300 border-t-2 border-t-gold bg-white p-3 break-words">
      <dt className="font-sans text-label-caps uppercase text-neutral-600">{libelle}</dt>
      {children}
    </div>
  )
}
