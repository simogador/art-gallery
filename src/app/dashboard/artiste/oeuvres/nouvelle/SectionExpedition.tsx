// Story 2.3 : zones ouvertes par l'équipe, en lecture seule. La saisie des frais et délais par zone
// viendra avec la story 2.6.
export function SectionExpedition({ zones }: { zones: string[] }) {
  return (
    <section aria-labelledby="expedition" className="mt-12 border-t border-neutral-200 pt-8">
      <h2 id="expedition" className="font-serif font-light text-foreground text-2xl mb-3">
        Expédition
      </h2>
      {zones.length === 0 ? (
        <p className="font-sans text-sm text-neutral-600">
          Les zones de livraison ne sont pas encore ouvertes. Vous pourrez indiquer vos frais et délais
          d&apos;envoi dès que l&apos;équipe Errancy les aura définies.
        </p>
      ) : (
        <>
          <p className="font-sans text-sm text-neutral-600 mb-3">
            Vous pourrez bientôt indiquer, pour chaque zone, vos frais et délais d&apos;envoi, ou
            choisir de ne pas y livrer.
          </p>
          <ul className="flex flex-wrap gap-2">
            {zones.map((nom) => (
              <li key={nom} className="font-sans text-xs px-3 py-1.5 border border-neutral-300 rounded-sm text-neutral-700">
                {nom}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
