import type { CodeEtat } from '@/lib/disponibilite/etats'

// Badge d'état d'une œuvre (story 2.2) : libellé calculé par le module disponibilite
// (Brouillon, En curation, Disponible, Réservée, Vendue, Vendue ailleurs, Retirée).
// L'état est porté par le texte, la couleur ne fait que le souligner.
export function StatusBadge({ etat, libelle }: { etat: CodeEtat; libelle: string }) {
  const disponible = etat === 'disponible'
  return (
    <span className={`inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-sm ${
      disponible
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
    }`}>
      <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${disponible ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
      {libelle}
    </span>
  )
}
