import type { ReactNode } from 'react'

// `info-banner` (story 2.8) : bandeau d'information annoncé aux lecteurs d'écran (role="status"),
// avec au plus une action (ex. « Retirée de la vente à 10 h 12. » + « Annuler »).
export function InfoBanner({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role="status"
      className="mb-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 font-sans text-sm text-foreground bg-neutral-50 border border-neutral-200 rounded-sm px-4 py-2"
    >
      <p className="py-2">{children}</p>
      {action}
    </div>
  )
}
