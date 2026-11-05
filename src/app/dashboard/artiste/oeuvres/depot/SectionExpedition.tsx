import {
  CHAMPS_OFFRE,
  ID_CHAMP,
  LIBELLES_OFFRE,
  type ChampOffre,
  type SaisieOffre,
  type ZoneDepot,
} from '@/lib/curation/depot-regles'

// Section 4. Expédition du dépôt (stories 2.3 et 2.6, AD-12) : pour chaque zone ouverte par l'équipe,
// frais et délais, ou « Je ne livre pas cette zone ». Composant contrôlé par le formulaire de dépôt,
// qui enregistre une zone dès que ses quatre valeurs sont valides. Sans zone ouverte, la section
// l'explique au lieu d'afficher une liste vide.

/** Erreurs d'une zone : par champ, et `zone` pour un message de la zone entière (visible même champs masqués). */
export type ErreursZone = Partial<Record<ChampOffre | 'zone', string>>

type Props = {
  zones: ZoneDepot[]
  saisies: Record<string, SaisieOffre>
  erreurs: Record<string, ErreursZone>
  repriseDisponible: boolean
  onSaisie: (zoneId: string, champ: ChampOffre, valeur: string) => void
  onSortie: (zoneId: string, champ: ChampOffre) => void
  onNonLivree: (zoneId: string, nonLivree: boolean) => void
  onReprendre: () => void
}

const SAISIE_VIDE: SaisieOffre = { nonLivree: false, frais: '', preparation: '', transportMin: '', transportMax: '' }

export function SectionExpedition({ zones, saisies, erreurs, repriseDisponible, onSaisie, onSortie, onNonLivree, onReprendre }: Props) {
  if (zones.length === 0) {
    return (
      <p className="font-sans text-sm text-neutral-600">
        Les zones de livraison ne sont pas encore ouvertes. Vous pourrez indiquer vos frais et délais
        d&apos;envoi dès que l&apos;équipe Errancy les aura définies.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      <p className="font-sans text-sm text-neutral-600">
        Pour chaque zone, indiquez vos frais d&apos;expédition et vos délais, ou choisissez de ne pas y livrer.
        Livrez au moins une zone. Chaque zone est enregistrée dès que ses quatre valeurs sont indiquées.
      </p>
      {repriseDisponible && (
        <button
          type="button"
          onClick={onReprendre}
          className="self-start min-h-[44px] px-4 font-sans text-xs uppercase tracking-widest border border-foreground rounded-sm hover:bg-foreground hover:text-background transition-colors duration-200"
        >
          Reprendre les zones de ma dernière œuvre
        </button>
      )}
      <ul className="flex flex-col gap-4">
        {zones.map((z) => {
          const saisie = saisies[z.id] ?? SAISIE_VIDE
          const erreursZone = erreurs[z.id] ?? {}
          const idNonLivree = ID_CHAMP.zone(z.id, 'nonLivree')
          const idErreurZone = `${idNonLivree}-erreur`
          return (
            <li key={z.id}>
              <fieldset className="border border-neutral-200 rounded-sm p-4">
                <legend className="font-sans text-sm font-medium text-foreground px-1">{z.nom}</legend>
                <label htmlFor={idNonLivree} className="min-h-[44px] inline-flex items-center gap-3 font-sans text-sm text-foreground cursor-pointer">
                  <input
                    id={idNonLivree}
                    type="checkbox"
                    checked={saisie.nonLivree}
                    onChange={(e) => onNonLivree(z.id, e.target.checked)}
                    aria-describedby={erreursZone.zone ? idErreurZone : undefined}
                    className="w-5 h-5 accent-foreground"
                  />
                  Je ne livre pas cette zone
                </label>
                {!saisie.nonLivree && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                    {CHAMPS_OFFRE.map((c) => {
                      const id = ID_CHAMP.zone(z.id, c)
                      const erreur = erreursZone[c]
                      return (
                        <div key={c} className="flex flex-col gap-1.5">
                          <label htmlFor={id} className="font-sans text-sm font-medium text-foreground">
                            {LIBELLES_OFFRE[c]}
                          </label>
                          <input
                            id={id}
                            type="text"
                            inputMode={c === 'frais' ? 'decimal' : 'numeric'}
                            autoComplete="off"
                            value={saisie[c]}
                            onChange={(e) => onSaisie(z.id, c, e.target.value)}
                            onBlur={() => onSortie(z.id, c)}
                            aria-invalid={erreur ? true : undefined}
                            aria-describedby={erreur ? `${id}-erreur` : undefined}
                            className={`w-full min-h-[44px] font-sans text-base text-foreground bg-transparent border rounded-sm px-4 py-2.5 outline-none focus:border-foreground focus:ring-1 focus:ring-foreground ${erreur ? 'border-red-500' : 'border-neutral-500'}`}
                          />
                          {erreur && (
                            <p id={`${id}-erreur`} role="alert" className="font-sans text-xs text-red-600">
                              Erreur : {erreur}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {erreursZone.zone && (
                  <p id={idErreurZone} role="alert" className="font-sans text-xs text-red-600 mt-3">
                    Erreur : {erreursZone.zone}
                  </p>
                )}
              </fieldset>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
