import { fr } from '@/lib/i18n'

// Chargement du récapitulatif et du paiement (story 7.4) : squelettes neutral-200, sans animation.
export default function ChargementPaiement() {
  return (
    <div className="container-premium max-w-4xl pb-16 pt-28" role="status" aria-busy="true">
      <p className="sr-only">{fr.paiementAcheteur.chargement}</p>
      <h1 className="font-serif text-display-md text-foreground">{fr.paiementAcheteur.titre}</h1>
      <div aria-hidden="true" className="mt-8 flex flex-col gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="h-40 rounded-sm bg-neutral-200" />
        ))}
      </div>
    </div>
  )
}
