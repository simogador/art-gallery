'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { dateAccordEnSaisie, mentionAccord } from '@/lib/curation/curation-regles'
import { actionEnregistrerAccord, type EtatAccord } from './actions'

// Accord écrit signé d'un artiste (story 2.7, FR-16) : l'équipe enregistre la date de signature, ou
// l'efface. Sans elle, aucune œuvre de l'artiste ne peut être validée en curation.

function Bouton({ children }: { children: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[44px] px-4 border border-neutral-300 rounded-sm font-sans text-xs uppercase tracking-widest text-neutral-700 hover:border-foreground disabled:opacity-40"
    >
      {pending ? 'Enregistrement…' : children}
    </button>
  )
}

export function AccordArtiste({ artistId, nom, accordSigneLe }: { artistId: string; nom: string; accordSigneLe: string | null }) {
  // Un seul état pour les deux formulaires (enregistrer, effacer) : un seul message à la fois,
  // et toute erreur est reliée au champ date.
  const [etat, envoyer] = useFormState(actionEnregistrerAccord.bind(null, artistId), null as EtatAccord)
  const idChamp = `accord-${artistId}`
  const idErreur = `erreur-accord-${artistId}`
  const erreur = etat && !etat.ok ? etat.message : null

  return (
    <div className="flex flex-col gap-2">
      <p className="font-sans text-sm text-foreground">
        <span aria-hidden="true">{accordSigneLe ? '✓ ' : '○ '}</span>
        {mentionAccord(accordSigneLe)}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <form action={envoyer} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={idChamp} className="font-sans text-xs text-neutral-600">
              Date de signature de l&apos;accord de {nom}
            </label>
            <input
              // Remonté quand la date enregistrée change (enregistrée ou effacée) : la saisie la suit.
              key={accordSigneLe ?? 'aucune'}
              id={idChamp}
              name="date"
              type="date"
              required
              defaultValue={dateAccordEnSaisie(accordSigneLe)}
              aria-invalid={erreur ? true : undefined}
              aria-describedby={erreur ? idErreur : undefined}
              className="min-h-[44px] px-3 border border-neutral-500 rounded-sm font-sans text-base"
            />
          </div>
          <Bouton>Enregistrer</Bouton>
        </form>
        {accordSigneLe && (
          <form action={envoyer}>
            <input type="hidden" name="effacer" value="1" />
            <Bouton>Effacer la date</Bouton>
          </form>
        )}
      </div>
      {erreur && (
        <p id={idErreur} role="alert" className="font-sans text-xs text-red-700">
          {erreur}
        </p>
      )}
      {etat?.ok && <p role="status" className="font-sans text-xs text-green-800">{etat.message}</p>}
    </div>
  )
}
