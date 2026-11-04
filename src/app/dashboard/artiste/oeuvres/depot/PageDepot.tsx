import Link from 'next/link'
import type { DepotLu, ZoneDepot } from '@/lib/curation/depot-regles'
import { dateLisible } from '@/lib/curation/curation-regles'
import { FormulaireDepot } from './FormulaireDepot'

// Page de dépôt (story 2.5), commune à /dashboard/artiste/oeuvres/nouvelle (sans brouillon) et à
// /dashboard/artiste/oeuvres/[slug] (brouillon de l'artiste). L'appelant a vérifié l'acteur.
// Story 2.7 : une œuvre renvoyée par l'équipe affiche son commentaire en bandeau d'information,
// jusqu'au prochain envoi en curation (aucun e-mail avant l'epic 4).
export function PageDepot({
  depot,
  zones,
  repriseInitiale = false,
}: {
  depot: DepotLu | null
  zones: ZoneDepot[]
  repriseInitiale?: boolean
}) {
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
          Complétez les cinq sections. L&apos;œuvre reste un brouillon visible de vous seul jusqu&apos;à
          son envoi à l&apos;équipe Errancy, qui la valide avant toute publication.
        </p>
        {depot?.renvoi && (
          <div
            role="status"
            className="font-sans text-sm text-foreground bg-amber-50 border border-amber-200 rounded-sm px-4 py-3 mt-4 max-w-prose"
          >
            <p className="font-medium">
              L&apos;équipe Errancy vous a renvoyé cette œuvre le {dateLisible(depot.renvoi.le)} :
            </p>
            <blockquote className="whitespace-pre-line mt-2 border-l-2 border-amber-300 pl-3">{depot.renvoi.commentaire}</blockquote>
            <p className="mt-2">Corrigez-la, puis envoyez-la de nouveau en curation.</p>
          </div>
        )}
      </div>

      <FormulaireDepot depot={depot} zones={zones} repriseInitiale={repriseInitiale} />
    </div>
  )
}
