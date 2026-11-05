'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { formaterDateHeure } from '@/lib/i18n'
import { actionInviter, type EtatInvitation } from './actions'

// Invitation d'un artiste sans compte (story 2.4) : saisie de l'e-mail, puis lien affiché une seule
// fois, à envoyer à la main tant qu'aucun prestataire d'e-mail n'est choisi (AQ-1).

type Props = {
  artistId: string
  nom: string
  /** Invitation encore valable, s'il y en a une. */
  enAttente: { email: string; echeance: string } | null
}

// « 12 novembre à 15 h 42 », heure de Paris (story 3.2).
const dateLongue = (iso: string) => formaterDateHeure(iso, { annee: false })

function BoutonCreer() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[44px] px-4 bg-foreground text-background font-sans text-xs uppercase tracking-widest rounded-sm disabled:opacity-40"
    >
      {pending ? 'Création…' : 'Créer le lien'}
    </button>
  )
}

function LienUnique({ lien, echeance }: { lien: string; echeance: string }) {
  const [copie, setCopie] = useState<'oui' | 'manuelle' | null>(null)
  return (
    <div role="status" className="flex flex-col gap-2 border border-green-200 bg-green-50 rounded-sm p-3">
      <label htmlFor="lien-invitation" className="font-sans text-xs text-green-800">
        Lien à envoyer à l’artiste. Il ne sera plus affiché ; il expire le {dateLongue(echeance)}.
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="lien-invitation"
          readOnly
          value={lien}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-[44px] flex-1 min-w-0 px-3 border border-neutral-500 rounded-sm font-mono text-base bg-white"
        />
        <button
          type="button"
          onClick={async () => {
            // Presse-papiers indisponible (http, permission refusée) : le lien est sélectionné à la main.
            try {
              await navigator.clipboard.writeText(lien)
              setCopie('oui')
            } catch {
              ;(document.getElementById('lien-invitation') as HTMLInputElement | null)?.select()
              setCopie('manuelle')
            }
          }}
          className="min-h-[44px] px-4 border border-neutral-300 rounded-sm font-sans text-xs uppercase tracking-widest bg-white"
        >
          {copie === 'oui' ? 'Copié' : 'Copier'}
        </button>
      </div>
      {copie === 'manuelle' && (
        <p className="font-sans text-xs text-green-800">Copie automatique impossible : le lien est sélectionné, copiez-le avec le clavier.</p>
      )}
    </div>
  )
}

export function InvitationArtiste({ artistId, nom, enAttente }: Props) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, envoyer] = useFormState(actionInviter.bind(null, artistId), null as EtatInvitation)

  if (etat?.ok) return <LienUnique lien={etat.lien} echeance={etat.echeance} />

  return (
    <div className="flex flex-col gap-2">
      {enAttente && !ouvert && (
        <p className="font-sans text-xs text-neutral-500">
          Lien créé pour {enAttente.email}, valable jusqu’au {dateLongue(enAttente.echeance)}.
        </p>
      )}
      {ouvert ? (
        <form action={envoyer} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1 flex-1 min-w-[14rem]">
            <label htmlFor={`email-${artistId}`} className="font-sans text-xs text-neutral-600">
              E-mail de {nom}
            </label>
            <input
              id={`email-${artistId}`}
              name="email"
              type="email"
              required
              autoComplete="off"
              defaultValue={enAttente?.email}
              aria-describedby={etat && !etat.ok ? `erreur-${artistId}` : undefined}
              className="min-h-[44px] px-3 border border-neutral-500 rounded-sm font-sans text-base"
            />
          </div>
          <BoutonCreer />
          <button
            type="button"
            onClick={() => setOuvert(false)}
            className="min-h-[44px] px-4 border border-neutral-300 rounded-sm font-sans text-xs uppercase tracking-widest"
          >
            Annuler
          </button>
          {etat && !etat.ok && (
            <p id={`erreur-${artistId}`} role="alert" className="w-full font-sans text-xs text-red-700">
              {etat.message}
            </p>
          )}
        </form>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setOuvert(true)}
            className="min-h-[44px] px-4 border border-neutral-300 rounded-sm font-sans text-xs uppercase tracking-widest text-neutral-700 hover:border-foreground"
          >
            {enAttente ? 'Renvoyer une invitation' : 'Inviter'}
            <span className="sr-only"> {nom}</span>
          </button>
          {enAttente && (
            <p className="font-sans text-[11px] text-neutral-600 mt-1">Un nouveau lien remplace le précédent.</p>
          )}
        </div>
      )}
    </div>
  )
}
