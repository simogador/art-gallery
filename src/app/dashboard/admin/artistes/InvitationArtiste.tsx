'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { formaterDateHeure } from '@/lib/i18n'
import { actionInviter, type EtatInvitation } from './actions'

// Invitation d'un artiste sans compte (story 2.4, 4.1) : saisie de l'e-mail ; l'e-mail d'invitation
// part du site et le lien n'est jamais affiché. Un envoi refusé se dit et se relance.

type Props = {
  artistId: string
  nom: string
  /** Invitation encore valable, s'il y en a une. */
  enAttente: { email: string; statut: 'envoyee' | 'echec' | 'en_cours' | 'lien_manuel'; echeance: string | null } | null
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
      {pending ? 'Envoi…' : 'Envoyer l’invitation'}
    </button>
  )
}

function Envoyee({ email, echeance }: { email: string; echeance: string }) {
  return (
    <p role="status" className="font-sans text-xs text-green-800 border border-green-200 bg-green-50 rounded-sm p-3">
      Invitation envoyée à {email}. Le lien expire le {dateLongue(echeance)}.
    </p>
  )
}

function etatEnAttente(enAttente: NonNullable<Props['enAttente']>): { texte: string; alerte: boolean } {
  switch (enAttente.statut) {
    case 'echec':
      return { texte: `L’e-mail n’est pas parti (invitation pour ${enAttente.email}). Relancez l’invitation.`, alerte: true }
    case 'en_cours':
      return { texte: `Envoi de l’invitation à ${enAttente.email} en cours.`, alerte: false }
    case 'lien_manuel':
      return { texte: `Lien créé pour ${enAttente.email}, valable jusqu’au ${dateLongue(enAttente.echeance ?? '')}.`, alerte: false }
    case 'envoyee':
      return { texte: `Invitation envoyée à ${enAttente.email}, valable jusqu’au ${dateLongue(enAttente.echeance ?? '')}.`, alerte: false }
  }
}

export function InvitationArtiste({ artistId, nom, enAttente }: Props) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, envoyer] = useFormState(actionInviter.bind(null, artistId), null as EtatInvitation)

  if (etat?.ok) return <Envoyee email={etat.email} echeance={etat.echeance} />

  return (
    <div className="flex flex-col gap-2">
      {enAttente && !ouvert && (
        <p
          role={etatEnAttente(enAttente).alerte ? 'alert' : undefined}
          className={`font-sans text-xs ${etatEnAttente(enAttente).alerte ? 'text-red-700' : 'text-neutral-600'}`}
        >
          {etatEnAttente(enAttente).texte}
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
            {enAttente ? (enAttente.statut === 'echec' ? 'Relancer l’invitation' : 'Renvoyer une invitation') : 'Inviter'}
            <span className="sr-only"> {nom}</span>
          </button>
          {enAttente && enAttente.statut !== 'echec' && (
            <p className="font-sans text-[11px] text-neutral-600 mt-1">Un nouvel e-mail remplace le précédent.</p>
          )}
        </div>
      )}
    </div>
  )
}
