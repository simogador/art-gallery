'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useUnite } from '@/components/ui'
import { formaterDimensionsDouble, formaterMontant, fr, MONTANT_ABSENT } from '@/lib/i18n'
import { formatOeuvre, orientationOeuvre } from '@/lib/reglages'
import type { Artwork } from '@/lib/types'

// Story 3.6 (FR-5, UX-DR16) : les quatre questions en `details`/`summary` natifs, dans l'ordre fixe,
// seule la première ouverte. Aucun état mémorisé : l'ouverture initiale est celle du HTML. Les
// chiffres viennent des mêmes données que la rangée (`Artwork.prixLivre`, dimensions, `reglages`) ;
// aucun calcul ici.

type Props = {
  artwork: Pick<
    Artwork,
    'artist' | 'artistId' | 'description' | 'certificat' | 'hauteurMm' | 'largeurMm' | 'profondeurMm' | 'prixLivre'
  >
  pays: { code: string; nom: string }
  /** Œuvre vendue (story 3.7) : sans « Combien au total ? » ni « Quand la recevrai-je ? ». */
  vendue?: boolean
}

export function SectionsFiche({ artwork, pays, vendue = false }: Props) {
  const t = fr.fiche.sections
  const textes = fr.fiche.rangee
  const unite = useUnite()
  const tailles = formaterDimensionsDouble(artwork, unite)
  const orientation = orientationOeuvre(artwork.hauteurMm, artwork.largeurMm)
  const format = formatOeuvre(artwork.hauteurMm, artwork.largeurMm)
  const histoire = artwork.description?.trim()
  const prix = artwork.prixLivre
  const sansPrix = !prix || (prix.livree === false && prix.raison === 'sans_prix')

  return (
    <div role="group" aria-label={t.libelle} className="border-t border-neutral-300">
      <Section titre={t.chezMoi.titre} ouverte>
        <p className="font-sans text-body-strong text-foreground">{tailles?.[0] ?? MONTANT_ABSENT}</p>
        {tailles && (
          <>
            <p className="font-sans text-sm text-neutral-600">{tailles[1]}</p>
            {orientation && format && (
              <p className="font-sans text-sm text-neutral-600">
                {t.chezMoi.orientationFormat(textes.orientation[orientation], textes.format[format])}
              </p>
            )}
          </>
        )}
      </Section>

      {!vendue && (
      <Section titre={t.total.titre}>
        {prix?.livree ? (
          <>
            <p className="font-sans text-sm text-neutral-600">{t.total.phrase(pays.nom)}</p>
            <p className="font-sans text-body-strong text-foreground">{formaterMontant(prix.totalCentimes, prix.devise)}</p>
            <p className="font-sans text-sm text-neutral-600">{fr.livraison.droitsNonInclus}</p>
          </>
        ) : sansPrix ? (
          <p className="font-sans text-body-strong text-foreground">{MONTANT_ABSENT}</p>
        ) : (
          <NonLivree artiste={artwork.artist} pays={pays.nom} />
        )}
      </Section>
      )}

      {!vendue && (
      <Section titre={t.quand.titre}>
        {prix?.livree ? (
          <>
            <p className="font-sans text-sm text-neutral-600">{t.quand.phrase(pays.nom)}</p>
            <p className="font-sans text-body-strong text-foreground">{textes.delaiJours(prix.delaiMinJours, prix.delaiMaxJours)}</p>
            <p className="font-sans text-sm text-neutral-600">{textes.livreeChezVous}</p>
          </>
        ) : sansPrix ? (
          <p className="font-sans text-body-strong text-foreground">{MONTANT_ABSENT}</p>
        ) : (
          <NonLivree artiste={artwork.artist} pays={pays.nom} />
        )}
      </Section>
      )}

      <Section titre={t.serieux.titre}>
        {histoire && (
          <div>
            <h3 className="font-sans text-label-caps uppercase text-neutral-600">{t.serieux.histoire}</h3>
            <p className="mt-1 whitespace-pre-line font-sans text-sm leading-relaxed text-neutral-600 text-pretty">{histoire}</p>
          </div>
        )}
        <p className="font-sans text-body-strong text-foreground">{t.serieux.selectionnee}</p>
        {artwork.certificat && <p className="font-sans text-sm text-neutral-600">{t.serieux.certificat}</p>}
        <div>
          <h3 className="font-sans text-label-caps uppercase text-neutral-600">{t.serieux.retourTitre}</h3>
          <p className="mt-1 font-sans text-sm text-neutral-600">{t.serieux.retour}</p>
        </div>
        <Link
          href={`/artistes/${artwork.artistId}`}
          className="inline-flex min-h-touch-target items-center font-sans text-sm text-foreground underline underline-offset-4"
        >
          {t.serieux.lienArtiste(artwork.artist)}
        </Link>
      </Section>
    </div>
  )
}

function NonLivree({ artiste, pays }: { artiste: string; pays: string }) {
  return (
    <>
      <p className="font-sans text-body-strong text-foreground">{fr.fiche.rangee.pasDeLivraison(pays)}</p>
      <p className="font-sans text-sm text-neutral-600">{fr.fiche.rangee.neLivrePas(artiste, pays)}</p>
    </>
  )
}

function Section({ titre, ouverte, children }: { titre: string; ouverte?: boolean; children: ReactNode }) {
  return (
    <details open={ouverte} className="group border-b border-neutral-300">
      <summary className="flex min-h-touch-target cursor-pointer items-center justify-between gap-3 py-3 font-serif text-lg text-foreground">
        {titre}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 group-open:rotate-180">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="flex flex-col gap-2 pb-4">{children}</div>
    </details>
  )
}
