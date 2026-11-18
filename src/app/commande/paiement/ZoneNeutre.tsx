import { fr } from '@/lib/i18n'

// Zone de paiement neutre (story 7.4, FR-14, DESIGN.md `neutral-zone`) : hachures décoratives (`aria-hidden`),
// jamais interactive, ni formulaire, ni logo, ni nom de prestataire. Elle nomme ce qui n'est pas décidé et
// invite à finaliser avec l'équipe ; le bouton Conseil est reçu en propriété (composant serveur du parent).
// Composant serveur.

const t = fr.paiementAcheteur.zoneNeutre

export function ZoneNeutre({ numeros, conseil }: { numeros: readonly string[]; conseil: React.ReactNode }) {
  return (
    <section aria-labelledby="paiement-titre" className="mt-10">
      <h2 id="paiement-titre" className="font-serif text-heading-md text-foreground">
        {t.titre}
      </h2>
      <div className="relative mt-4 px-4 py-10 sm:px-8">
        <div aria-hidden="true" className="zone-neutre absolute inset-0" />
        <div className="relative mx-auto max-w-md rounded-sm border border-neutral-300 bg-white px-5 py-5 text-center">
          <p className="font-sans text-sm font-medium text-foreground">{t.etiquette}</p>
        </div>
      </div>
      <p className="mt-4 font-sans text-sm text-foreground">{t.texte}</p>
      <p className="mt-2 font-sans text-sm text-neutral-600">{t.numeros(numeros)}</p>
      <p className="mt-2 font-sans text-sm text-neutral-600">{t.avantLaFin}</p>
      <div className="mt-6">{conseil}</div>
    </section>
  )
}
