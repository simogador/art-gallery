'use client'

import { useState, useTransition } from 'react'
import { ETATS_DEMANDE, libelleEtatDemande, type EtatDemande, type TypeDemande } from '@/lib/demandes/file-regles'
import { fr } from '@/lib/i18n'
import { actionEtatDemande } from './actions'

// Commande d'état d'une demande (story 4.6) : un bouton par autre état, extraite de la page pour être
// testée dans un navigateur (tests/navigateur). Le résultat d'un refus est annoncé (`role="alert"`).

export function CommandeEtat({ type, id, etat, nom }: { type: TypeDemande; id: string; etat: EtatDemande; nom: string }) {
  const [enCours, demarrer] = useTransition()
  const [refus, setRefus] = useState<string | null>(null)

  function changer(suivant: EtatDemande) {
    setRefus(null)
    demarrer(async () => {
      try {
        const resultat = await actionEtatDemande(type, id, suivant)
        if (!resultat.ok) setRefus(resultat.message)
      } catch {
        setRefus(fr.demandes.refus.indisponible)
      }
    })
  }

  return (
    <div className="mt-3">
      <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-600">{fr.demandes.changerEtat}</p>
      <div className="mt-1 flex flex-wrap gap-x-4">
        {ETATS_DEMANDE.filter((e) => e !== etat).map((e) => (
          <button
            key={e}
            type="button"
            disabled={enCours}
            aria-label={fr.demandes.marquerPour(libelleEtatDemande(e), nom)}
            onClick={() => changer(e)}
            className="min-h-touch-target font-sans text-xs text-neutral-600 hover:text-foreground underline underline-offset-4 disabled:opacity-40"
          >
            {fr.demandes.marquer(libelleEtatDemande(e))}
          </button>
        ))}
      </div>
      {enCours && (
        <p role="status" className="mt-1 font-sans text-xs text-neutral-600">
          {fr.demandes.enCours}
        </p>
      )}
      {refus && (
        <p role="alert" className="mt-1 font-sans text-sm text-foreground">
          {refus}
        </p>
      )}
    </div>
  )
}
