import { fr } from '@/lib/i18n'

// Cadre commun de la page de suivi (story 7.7) : surtitre, titre, filet. Composant serveur.
export function Cadre({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-24 pt-28">
      <div className="container-premium max-w-4xl">
        <span className="mb-4 block font-sans text-xs uppercase tracking-[0.25em] text-neutral-600">{fr.suivi.surtitre}</span>
        <h1 className="break-words font-serif text-display-md font-light text-foreground">
          {titre}
        </h1>
        <div className="divider mt-4" />
        <div className="mt-10">{children}</div>
      </div>
    </div>
  )
}
