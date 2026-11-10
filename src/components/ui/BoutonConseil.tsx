import { useId } from 'react'
import { cn } from '@/lib/utils/cn'
import { fr } from '@/lib/i18n'
import { boutonConseil, type ContexteConseil } from '@/lib/conseil'
import { numeroWhatsApp } from '@/lib/reglages'

// Story 4.4 (FR-7, UX-DR14) : bouton « Conseil WhatsApp » unique, avec sa sous-ligne de délai.
// Composant serveur, calculé à chaque requête (l'état « dans les horaires » dépend de l'heure). Numéro
// réglé : lien `wa.me` avec message prérempli (référence et lien de l'œuvre, ou nom de l'artiste) ;
// sinon le bouton garde sa place et ouvre `/conseil` avec le délai tenu (48 heures). Le numéro
// n'apparaît que dans l'adresse du lien. Sur fond noir (pied de page) le texte hérite du pied
// (`text-neutral-200` posé avec `bg-foreground`, story 3.1). Ni vert ni logo en couleur ; nommé par son action.

export function BoutonConseil({
  contexte = { type: 'general' },
  surSombre = false,
  className,
}: {
  contexte?: ContexteConseil
  /** Posé sur un fond noir (pied de page) : texte et filet clairs. */
  surSombre?: boolean
  className?: string
}) {
  const t = fr.conseilWhatsApp
  const idLigne = useId()
  const bouton = boutonConseil({ numero: numeroWhatsApp(), contexte, maintenant: new Date() })
  const titre = contexte.type === 'oeuvre' ? contexte.titre.trim() : ''
  const whatsapp = bouton.mode === 'whatsapp'
  const libelle = whatsapp ? t.libelle : t.repliLibelle
  const nom = titre ? (whatsapp ? t.libelleSur(titre) : t.repliLibelleSur(titre)) : libelle

  return (
    <div className={className}>
      <a
        href={bouton.href}
        {...(whatsapp ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        aria-label={whatsapp ? `${nom} ${t.nouvelOnglet}` : nom}
        aria-describedby={idLigne}
        className={cn(
          'inline-flex min-h-touch-target w-full items-center justify-center rounded-sm border px-6 py-3 text-center font-sans text-button sm:w-auto',
          surSombre
            ? 'border-neutral-200 hover:bg-neutral-800'
            : 'border-foreground text-foreground hover:bg-neutral-100',
        )}
      >
        {libelle}
      </a>
      <p id={idLigne} className={cn('mt-2 font-sans text-sm', !surSombre && 'text-neutral-600')}>
        {bouton.sousLigne}
      </p>
    </div>
  )
}
