'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fr } from '@/lib/i18n'
import { actionMarquerRemboursementEffectue } from './actions'

// Remboursements à traiter (story 6.5) : l'équipe rembourse l'acheteur à la main (OQ-1 ouverte), puis
// marque la demande effectuée. État local, garde `useRef` contre le double appui, pas de `useFormState`
// (test navigateur). Un résultat est annoncé dans une région `role="status"` qui reçoit le focus ; la
// liste est relue ensuite. Les montants et dates arrivent déjà formatés par la page.

export type VueRemboursement = {
  id: string
  commande: string
  acheteur: string
  montant: string
  demandeLe: string
}

type Resultat = { ok: boolean; message: string }

const BOUTON = 'min-h-touch-target rounded-sm border border-foreground px-4 font-sans text-button text-foreground disabled:opacity-40'

export function RemboursementsEquipe({ remboursements }: { remboursements: VueRemboursement[] }) {
  const t = fr.paiement.remboursements
  const router = useRouter()
  const occupe = useRef(false)
  const statut = useRef<HTMLDivElement>(null)
  const [enCours, setEnCours] = useState<string | null>(null)
  const [resultat, setResultat] = useState<Resultat | null>(null)

  useEffect(() => {
    if (resultat) statut.current?.focus()
  }, [resultat])

  async function marquer(id: string) {
    if (occupe.current) return
    occupe.current = true
    setEnCours(id)
    setResultat(null)
    try {
      const r = await actionMarquerRemboursementEffectue(id)
      setResultat({ ok: r.ok, message: r.message })
      router.refresh()
    } catch {
      setResultat({ ok: false, message: t.refus.indisponible })
    } finally {
      occupe.current = false
      setEnCours(null)
    }
  }

  return (
    <div>
      <div role="status" aria-live="polite" tabIndex={-1} ref={statut}>
        {resultat && <p className="mt-3 font-sans text-sm text-foreground">{resultat.message}</p>}
      </div>
      {remboursements.length === 0 ? (
        <p className="mt-3 font-sans text-sm text-neutral-600">{t.vide}</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {remboursements.map((r) => (
            <li key={r.id} className="rounded-sm border border-neutral-500 p-4 font-sans text-sm text-foreground">
              <p>
                <span className="text-neutral-600">{t.commande}</span> {r.commande}
              </p>
              <p>
                <span className="text-neutral-600">{t.acheteur}</span> {r.acheteur}
              </p>
              <p>
                <span className="text-neutral-600">{t.montant}</span> {r.montant}
              </p>
              <p>
                <span className="text-neutral-600">{t.demandeLe}</span> {r.demandeLe}
              </p>
              <button
                type="button"
                disabled={enCours !== null}
                onClick={() => marquer(r.id)}
                aria-label={`${t.bouton} ${r.commande}`}
                className={`mt-3 ${BOUTON}`}
              >
                {enCours === r.id ? t.enCours : t.bouton}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
