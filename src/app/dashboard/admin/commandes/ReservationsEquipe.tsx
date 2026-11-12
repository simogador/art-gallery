'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fr } from '@/lib/i18n'
import { actionLibererVenteAssistee, actionRenvoyerLien } from './actions'

// Réservations en cours de l'équipe (story 6.3 bis) : « Libérer » demande une confirmation, « Renvoyer
// le lien » n'apparaît que si l'e-mail n'est pas parti. État local, garde `useRef`, sans `useFormState`
// (testé dans un navigateur) ; le résultat est annoncé (`role="status"`), la liste est relue ensuite.
// Les dates arrivent déjà formatées par la page (module i18n, aucun format ici).

export type VueReservation = {
  passageId: string
  beneficiaire: string
  origine: string
  echeance: string
  echue: boolean
  lienActif: boolean
  liberable: boolean
  oeuvres: string[]
}

const BOUTON = 'min-h-touch-target rounded-sm border border-foreground px-4 font-sans text-button text-foreground disabled:opacity-40'

export function ReservationsEquipe({ ventes }: { ventes: VueReservation[] }) {
  const t = fr.venteAssistee.suivi
  const router = useRouter()
  const occupe = useRef(false)
  const [enCours, setEnCours] = useState(false)
  const [aConfirmer, setAConfirmer] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)

  async function agir(action: () => Promise<{ ok: boolean; message: string }>) {
    if (occupe.current) return
    occupe.current = true
    setEnCours(true)
    setMessage(null)
    try {
      const r = await action()
      setMessage({ ok: r.ok, texte: r.message })
      setAConfirmer(null)
      router.refresh()
    } catch {
      setMessage({ ok: false, texte: t.refus.indisponible })
    } finally {
      occupe.current = false
      setEnCours(false)
    }
  }

  return (
    <div>
      <div role="status" aria-live="polite">
        {message?.ok && <p className="mt-3 font-sans text-sm text-foreground">{message.texte}</p>}
      </div>
      {message && !message.ok && (
        <p role="alert" className="mt-3 font-sans text-sm text-foreground">
          {message.texte}
        </p>
      )}
      {ventes.length === 0 ? (
        <p className="mt-3 font-sans text-sm text-neutral-600">{t.vide}</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {ventes.map((v) => (
            <li key={v.passageId} className="rounded-sm border border-neutral-500 p-4 font-sans text-sm text-foreground">
              <p>
                <span className="text-neutral-600">{t.beneficiaire}</span> {v.beneficiaire}
              </p>
              <p>
                <span className="text-neutral-600">{t.oeuvres}</span> {v.oeuvres.join(', ')}
              </p>
              <p>
                <span className="text-neutral-600">{t.origine}</span> {v.origine}
              </p>
              <p>
                <span className="text-neutral-600">{t.echeance}</span> {v.echeance}
                {v.echue && <> ({t.echue})</>}
              </p>
              <p>{v.lienActif ? t.lienEnvoye : t.lienNonEnvoye}</p>
              {!v.liberable ? null : aConfirmer === v.passageId ? (
                <div className="mt-3">
                  <p>{t.confirmerLiberer(v.oeuvres.join(', '))}</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <button type="button" disabled={enCours} onClick={() => agir(() => actionLibererVenteAssistee(v.passageId))} className={BOUTON}>
                      {enCours ? t.enCours : t.confirmer}
                    </button>
                    <button type="button" disabled={enCours} onClick={() => setAConfirmer(null)} className={BOUTON}>
                      {t.annuler}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-3">
                  <button type="button" disabled={enCours} onClick={() => setAConfirmer(v.passageId)} className={BOUTON}>
                    {t.liberer}
                  </button>
                  {!v.lienActif && !v.echue && (
                    <button type="button" disabled={enCours} onClick={() => agir(() => actionRenvoyerLien(v.passageId))} className={BOUTON}>
                      {enCours ? t.enCours : t.renvoyer}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
