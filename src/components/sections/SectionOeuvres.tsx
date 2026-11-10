import Link from 'next/link'
import { VignetteOeuvre } from '@/app/galerie/VignetteOeuvre'
import { fr } from '@/lib/i18n'
import type { Artwork } from '@/lib/types'

// Sections de l'accueil « Sélection de l'équipe » et « Dernières œuvres publiées » (story 3.10,
// FR-18, UX-DR22) : les vignettes sont celles de la galerie (une seule cible, vers la fiche), les
// données arrivent en props (catalogue) et aucun calcul de prix n'a lieu ici. Ni carrousel ni
// défilement automatique. Le filet or est décoratif (aria-hidden).

interface SectionOeuvresProps {
  id: string
  surtitre: string
  titre: string
  introduction: string
  oeuvres: Artwork[]
  paysNom: string
}

export function SectionOeuvres({ id, surtitre, titre, introduction, oeuvres, paysNom }: SectionOeuvresProps) {
  return (
    <section aria-labelledby={`${id}-titre`} id={id} className="bg-background py-16 md:py-24">
      <div className="container-premium">
        <p className="mb-3 font-sans text-label-caps uppercase text-neutral-600">{surtitre}</p>
        <h2 id={`${id}-titre`} className="font-serif text-display-md text-foreground">
          {titre}
        </h2>
        <span className="ornament-rule mt-4" aria-hidden="true" />
        <p className="mt-4 max-w-xl font-sans text-base text-neutral-600 text-pretty">{introduction}</p>
        <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
          {oeuvres.map((oeuvre) => (
            <li key={oeuvre.id}>
              <VignetteOeuvre artwork={oeuvre} paysNom={paysNom} niveau="h3" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** Accès à la galerie complète, sous les deux sections (visible aussi quand elles sont vides). */
export function ParcourirGalerie() {
  return (
    <div className="container-premium pb-16 md:pb-24">
      <Link
        href="/galerie"
        className="inline-flex min-h-touch-target items-center justify-center rounded-sm border border-foreground bg-foreground px-8 py-4 font-sans text-sm font-medium uppercase tracking-widest text-background hover:bg-neutral-700"
      >
        {fr.accueil.parcourirGalerie}
      </Link>
    </div>
  )
}

/** État vide : aucune œuvre à montrer (catalogue vide, ou tout est vendu). */
export function CollectionVide() {
  return (
    <section aria-labelledby="collection-vide-titre" className="bg-background py-16 md:py-24">
      <div className="container-premium">
        <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-neutral-200 px-6 py-20 text-center">
          <h2 id="collection-vide-titre" className="font-serif text-display-xs text-foreground">
            {fr.accueil.vide.titre}
          </h2>
          <p className="max-w-sm font-sans text-sm text-neutral-600 text-pretty">{fr.accueil.vide.message}</p>
        </div>
      </div>
    </section>
  )
}
