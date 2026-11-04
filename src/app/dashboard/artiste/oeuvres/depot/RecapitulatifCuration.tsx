import Link from 'next/link'
import type { RecapitulatifCuration as Recap } from '@/lib/curation'
import { dateLisible } from '@/lib/curation/curation-regles'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { RecapitulatifOeuvre } from '@/components/dashboard/RecapitulatifOeuvre'
import { LIBELLES_ETAT } from '@/lib/disponibilite/etats'

// Œuvre en curation (story 2.6) : récapitulatif en lecture seule et délai de réponse de l'équipe.
// Aucun champ modifiable : l'artiste ne modifie plus une œuvre envoyée. Les cinq sections sont
// partagées avec la page de curation de l'équipe (RecapitulatifOeuvre, story 2.7).

export function RecapitulatifCuration({ recap, delaiJours }: { recap: Recap; delaiJours: number }) {
  const envoyee = recap.envoyeeLe ? dateLisible(recap.envoyeeLe) : null

  return (
    <div>
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/dashboard/artiste/oeuvres"
            className="font-sans text-xs uppercase tracking-widest text-neutral-500 hover:text-foreground transition-colors duration-200"
          >
            Mes œuvres
          </Link>
          <span aria-hidden="true" className="text-neutral-300">›</span>
          <span className="font-sans text-xs uppercase tracking-widest text-neutral-600 truncate max-w-xs">{recap.titre}</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
            {recap.titre}
          </h1>
          <StatusBadge etat="en_curation" libelle={LIBELLES_ETAT.en_curation} />
        </div>
        <p role="status" className="font-sans text-sm text-foreground bg-neutral-50 border border-neutral-200 rounded-sm px-4 py-3 mt-4 max-w-prose">
          {envoyee ? `Envoyée à l’équipe Errancy le ${envoyee}. ` : 'Envoyée à l’équipe Errancy. '}
          L&apos;équipe vous répond sous {delaiJours} jours. En attendant, l&apos;œuvre ne se modifie plus.
        </p>
      </div>

      <RecapitulatifOeuvre recap={recap} />
    </div>
  )
}
