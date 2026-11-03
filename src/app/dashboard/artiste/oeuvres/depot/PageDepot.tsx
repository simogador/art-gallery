import Link from 'next/link'
import type { DepotLu } from '@/lib/curation/depot-regles'
import { SectionExpedition } from '../nouvelle/SectionExpedition'
import { FormulaireDepot } from './FormulaireDepot'

// Page de dépôt (story 2.5), commune à /dashboard/artiste/oeuvres/nouvelle (sans brouillon) et à
// /dashboard/artiste/oeuvres/[slug] (brouillon de l'artiste). L'appelant a vérifié l'acteur.
export function PageDepot({ depot, zones }: { depot: DepotLu | null; zones: string[] }) {
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
          <span className="font-sans text-xs uppercase tracking-widest text-neutral-600 truncate max-w-xs">
            {depot?.titre || 'Nouvelle œuvre'}
          </span>
        </div>
        <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
          Déposer une œuvre
        </h1>
        <p className="font-sans text-sm text-neutral-600 mt-2 max-w-prose">
          Complétez les cinq sections. L&apos;œuvre reste un brouillon visible de vous seul ; l&apos;envoi à
          l&apos;équipe Errancy pour validation viendra une fois toutes les sections complètes.
        </p>
      </div>

      <FormulaireDepot depot={depot} expedition={<SectionExpedition zones={zones} />} />
    </div>
  )
}
