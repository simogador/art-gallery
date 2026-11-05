import Link from 'next/link'
import type { OeuvreACurer } from '@/lib/curation'
import { dateLisible, mentionAccord } from '@/lib/curation/curation-regles'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { RecapitulatifOeuvre } from '@/components/dashboard/RecapitulatifOeuvre'
import { LIBELLES_ETAT } from '@/lib/disponibilite/etats'
import { DecisionCuration } from './DecisionCuration'

// Page de curation d'une œuvre (story 2.7) : récapitulatif complet en lecture seule (photos en
// grand), accord signé de l'artiste, liste de contrôle et décision. L'appelant a vérifié l'acteur.

export function PageCuration({ oeuvre }: { oeuvre: OeuvreACurer }) {
  return (
    <div>
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/dashboard/admin/oeuvres"
            className="font-sans text-xs uppercase tracking-widest text-neutral-500 hover:text-foreground transition-colors duration-200"
          >
            Œuvres
          </Link>
          <span aria-hidden="true" className="text-neutral-600">›</span>
          <span className="font-sans text-xs uppercase tracking-widest text-neutral-600 truncate max-w-xs">
            {oeuvre.titre || 'Sans titre'}
          </span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-sans text-xs uppercase tracking-[0.25em] text-neutral-600 mb-3">Curation</p>
            <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
              {oeuvre.titre || 'Sans titre'}
            </h1>
            <p className="font-sans text-sm text-neutral-600 mt-2">
              {oeuvre.artiste.nom}
              {oeuvre.envoyeeLe ? ` · envoyée le ${dateLisible(oeuvre.envoyeeLe)}` : ''}
            </p>
            <p className="font-sans text-sm text-foreground mt-1">
              <span aria-hidden="true">{oeuvre.accordSigneLe ? '✓ ' : '○ '}</span>
              {mentionAccord(oeuvre.accordSigneLe)}
            </p>
          </div>
          <StatusBadge etat="en_curation" libelle={LIBELLES_ETAT.en_curation} />
        </div>
        {/* Œuvre déjà renvoyée une fois : la correction attendue se vérifie avant de décider. */}
        {oeuvre.dernierRenvoiEquipe && (
          <section
            aria-labelledby="titre-dernier-renvoi"
            className="font-sans text-sm text-foreground bg-neutral-50 border border-neutral-200 rounded-sm px-4 py-3 mt-4 max-w-prose"
          >
            <h2 id="titre-dernier-renvoi" className="font-medium">
              Renvoyée à l&apos;artiste le {dateLisible(oeuvre.dernierRenvoiEquipe.le)} avec ce commentaire :
            </h2>
            <blockquote className="whitespace-pre-line mt-2 border-s-2 border-neutral-300 ps-3">
              {oeuvre.dernierRenvoiEquipe.commentaire}
            </blockquote>
          </section>
        )}
      </div>

      <RecapitulatifOeuvre recap={oeuvre} photosEnGrand />

      <div className="border-t border-neutral-200 pt-8 mt-10">
        <DecisionCuration slug={oeuvre.slug} accordSigne={oeuvre.accordSigneLe !== null} />
      </div>
    </div>
  )
}
