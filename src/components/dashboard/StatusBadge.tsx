import type { CodeEtat } from '@/lib/disponibilite/etats'

// Badge d'état d'une œuvre (story 2.2, `status-badge` de la story 2.8) : libellé calculé par le
// module disponibilite (Brouillon, En curation, Publiée, Réservée, Vendue, Vendue ailleurs,
// Retirée). L'état est porté par le texte et par le style du trait (plein, tirets, pointillés,
// double, épais) ; la couleur ne fait que le souligner.
const STYLES: Record<CodeEtat, string> = {
  brouillon:       'border border-dashed border-neutral-400 text-neutral-600 bg-transparent',
  en_curation:     'border border-dotted border-amber-600 text-amber-800 bg-amber-50',
  disponible:      'border border-solid border-emerald-600 text-emerald-800 bg-emerald-50',
  reservee:        'border-[3px] border-double border-sky-700 text-sky-800 bg-sky-50',
  vendue:          'border-2 border-solid border-neutral-800 text-background bg-neutral-800',
  vendue_ailleurs: 'border-2 border-dashed border-neutral-700 text-neutral-800 bg-neutral-100',
  retiree:         'border-2 border-dotted border-neutral-500 text-neutral-600 bg-transparent',
}

export function StatusBadge({ etat, libelle }: { etat: CodeEtat; libelle: string }) {
  return (
    <span className={`inline-flex items-center font-sans text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-sm whitespace-nowrap ${STYLES[etat]}`}>
      {libelle}
    </span>
  )
}
