import type { Metadata } from 'next'
import { fr } from '@/lib/i18n'
import { DELAI_REPONSE_DEMANDE_HEURES, urlAbsolue } from '@/lib/reglages'
import { FormulaireConseil } from './FormulaireConseil'

// Demande de sélection personnalisée (story 4.2, FR-8) : atteinte depuis l'en-tête et le pied de page.

export const metadata: Metadata = {
  title: fr.conseil.titre,
  description: fr.conseil.introduction,
  alternates: { canonical: urlAbsolue('/conseil') },
}

export default function PageConseil() {
  return (
    <div className="container-premium pb-16 pt-28 md:pb-24 md:pt-36">
      <div className="max-w-xl">
        <h1 className="font-serif text-display-md text-foreground">{fr.conseil.titre}</h1>
        <p className="mt-4 font-sans text-base text-neutral-600">{fr.conseil.introduction}</p>
        <FormulaireConseil delaiHeures={DELAI_REPONSE_DEMANDE_HEURES} />
      </div>
    </div>
  )
}
