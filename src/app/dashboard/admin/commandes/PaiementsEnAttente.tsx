'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { champsPrix } from '@/lib/catalogue/conversions'
import { fr, formaterMontant } from '@/lib/i18n'
import { MONTANT_MAX_CENTIMES } from '@/lib/paiement/ports'
import { actionAnnulerCommande, actionConstaterPaiement } from './actions'

// Commandes en attente de paiement et formulaire « Constater un paiement » (story 6.4). Le constat est
// irréversible : confirmation en deux temps par passage. État local, garde `useRef` contre le double
// appui, pas de `useFormState` (testé dans un navigateur). Un refus est annoncé sous la ligne du passage
// concerné (alerte), un succès en tête (la ligne disparaît à la relecture) ; la saisie est conservée
// après un refus et la liste est relue ensuite. Les totaux arrivent déjà formatés par la page.

export type VuePaiementEnAttente = {
  passageId: string
  acheteur: string
  /** Code de la monnaie du passage (étiquette du champ, montant confirmé). */
  devise: string
  total: string
  /** Total avec les commandes annulées du passage ; null sans commande annulée. */
  totalAvecAnnulees?: string | null
  commandes: { id: string; numero: string; oeuvres: string[] }[]
}

type Resultat = { passageId: string; ok: boolean; message: string }

const CHAMP = 'mt-1 block w-full min-h-touch-target rounded-sm border border-neutral-500 bg-transparent px-3 font-sans text-input text-foreground'
const BOUTON = 'min-h-touch-target rounded-sm border border-foreground px-4 font-sans text-button text-foreground disabled:opacity-40'

// « Annuler la commande » (story 6.5) : confirmation en deux temps, garde `useRef` contre le double appui.
// Rien n'est remboursé : aucun paiement n'est arrivé.
function AnnulerCommande({ passageId, commande, onDebut, onResultat }: {
  passageId: string
  commande: { id: string; numero: string }
  onDebut: () => void
  onResultat: (r: Resultat) => void
}) {
  const t = fr.paiement.annulation
  const occupe = useRef(false)
  const [confirmer, setConfirmer] = useState(false)
  const [enCours, setEnCours] = useState(false)

  async function annuler() {
    if (occupe.current) return
    occupe.current = true
    setEnCours(true)
    onDebut()
    try {
      const r = await actionAnnulerCommande(commande.id)
      setConfirmer(false)
      onResultat({ passageId, ok: r.ok, message: r.message })
    } catch {
      setConfirmer(false)
      onResultat({ passageId, ok: false, message: t.refus.indisponible })
    } finally {
      occupe.current = false
      setEnCours(false)
    }
  }

  return confirmer ? (
    <div className="mt-2 max-w-md">
      <p className="font-sans text-sm text-foreground">{t.confirmer(commande.numero)}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <button type="button" disabled={enCours} onClick={annuler} className={BOUTON}>
          {enCours ? t.enCours : t.oui}
        </button>
        <button type="button" disabled={enCours} onClick={() => setConfirmer(false)} className={BOUTON}>
          {t.non}
        </button>
      </div>
    </div>
  ) : (
    <button type="button" onClick={() => setConfirmer(true)} aria-label={`${t.bouton} ${commande.numero}`} className={`mt-2 ${BOUTON}`}>
      {t.bouton}
    </button>
  )
}

function Constat({ vue, resultat, onDebut, onResultat }: {
  vue: VuePaiementEnAttente
  resultat: Resultat | null
  onDebut: () => void
  onResultat: (r: Resultat) => void
}) {
  const t = fr.paiement
  const occupe = useRef(false)
  const [reference, setReference] = useState('')
  const [montant, setMontant] = useState('')
  const [erreurs, setErreurs] = useState<{ reference?: string; montant?: string }>({})
  const [aConfirmer, setAConfirmer] = useState<number | null>(null)
  const [enCours, setEnCours] = useState(false)

  function verifier(e: { preventDefault: () => void }) {
    e.preventDefault()
    if (occupe.current) return
    const locales: typeof erreurs = {}
    if (reference.trim() === '') locales.reference = t.erreurs.reference
    const prix = champsPrix(montant)
    const centimes = prix.ok ? prix.champs.prixCentimes : null
    if (centimes === null || centimes > MONTANT_MAX_CENTIMES) locales.montant = t.erreurs.montant
    setErreurs(locales)
    if (Object.keys(locales).length > 0) return
    onDebut()
    setAConfirmer(centimes)
  }

  async function constater() {
    if (occupe.current) return
    occupe.current = true
    setEnCours(true)
    onDebut()
    try {
      const r = await actionConstaterPaiement(vue.passageId, reference, montant)
      if (r.ok) {
        setReference('')
        setMontant('')
      }
      setAConfirmer(null)
      onResultat({ passageId: vue.passageId, ok: r.ok, message: r.message })
    } catch {
      setAConfirmer(null)
      onResultat({ passageId: vue.passageId, ok: false, message: t.refus.indisponible })
    } finally {
      occupe.current = false
      setEnCours(false)
    }
  }

  const id = `paiement-${vue.passageId}`
  const nb = Object.values(erreurs).filter(Boolean).length
  return (
    <div>
      <form onSubmit={verifier} noValidate className="mt-4 max-w-md space-y-4">
        {nb > 0 && (
          <p role="alert" className="font-sans text-sm text-foreground">
            {t.resume(nb)}
          </p>
        )}
        <div>
          <label htmlFor={`${id}-reference`} className="block font-sans text-sm text-foreground">{t.champs.reference}</label>
          <input id={`${id}-reference`} type="text" autoComplete="off" value={reference} onChange={(e) => { setReference(e.target.value); setAConfirmer(null) }} aria-invalid={Boolean(erreurs.reference)} aria-describedby={`${id}-reference-aide`} className={CHAMP} />
          <p id={`${id}-reference-aide`} className="mt-1 font-sans text-xs text-neutral-600">{erreurs.reference ?? t.champs.referenceAide}</p>
        </div>
        <div>
          <label htmlFor={`${id}-montant`} className="block font-sans text-sm text-foreground">{t.champs.montant(vue.devise)}</label>
          <input id={`${id}-montant`} type="text" inputMode="decimal" autoComplete="off" value={montant} onChange={(e) => { setMontant(e.target.value); setAConfirmer(null) }} aria-invalid={Boolean(erreurs.montant)} aria-describedby={`${id}-montant-aide`} className={CHAMP} />
          <p id={`${id}-montant-aide`} className="mt-1 font-sans text-xs text-neutral-600">{erreurs.montant ?? t.champs.montantAide}</p>
        </div>
        {aConfirmer === null && (
          <button type="submit" disabled={enCours} className={BOUTON}>
            {t.bouton}
          </button>
        )}
      </form>
      {aConfirmer !== null && (
        <div className="mt-3 max-w-md">
          <p className="font-sans text-sm text-foreground">{t.confirmer(formaterMontant(aConfirmer, vue.devise), vue.commandes.length)}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" disabled={enCours} onClick={constater} className={BOUTON}>
              {enCours ? t.enCours : t.oui}
            </button>
            <button type="button" disabled={enCours} onClick={() => setAConfirmer(null)} className={BOUTON}>
              {t.annuler}
            </button>
          </div>
        </div>
      )}
      {resultat && !resultat.ok && (
        <p role="alert" className="mt-3 font-sans text-sm text-foreground">
          {resultat.message}
        </p>
      )}
    </div>
  )
}

export function PaiementsEnAttente({ passages }: { passages: VuePaiementEnAttente[] }) {
  const t = fr.paiement
  const router = useRouter()
  const [resultat, setResultat] = useState<Resultat | null>(null)
  const statut = useRef<HTMLDivElement>(null)
  // Un succès est annoncé et reçoit le focus : la ligne concernée disparaît à la relecture de la liste.
  useEffect(() => {
    if (resultat?.ok) statut.current?.focus()
  }, [resultat])

  return (
    <div>
      <div role="status" aria-live="polite" tabIndex={-1} ref={statut}>
        {resultat?.ok && <p className="mt-3 font-sans text-sm text-foreground">{resultat.message}</p>}
      </div>
      {passages.length === 0 ? (
        <p className="mt-3 font-sans text-sm text-neutral-600">{t.vide}</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {passages.map((p) => (
            <li key={p.passageId} className="rounded-sm border border-neutral-500 p-4 font-sans text-sm text-foreground">
              <p>
                <span className="text-neutral-600">{t.acheteur}</span> {p.acheteur}
              </p>
              {p.commandes.map((c) => (
                <div key={c.id}>
                  <p>
                    <span className="text-neutral-600">{t.commande}</span> {c.numero} <span className="text-neutral-600">{t.oeuvres}</span> {c.oeuvres.join(', ')}
                  </p>
                  <AnnulerCommande
                    passageId={p.passageId}
                    commande={c}
                    onDebut={() => setResultat(null)}
                    onResultat={(r) => {
                      setResultat(r)
                      router.refresh()
                    }}
                  />
                </div>
              ))}
              <p>
                <span className="text-neutral-600">{t.totalARecevoir}</span> {p.total}
              </p>
              {p.totalAvecAnnulees && (
                <p>
                  <span className="text-neutral-600">{t.totalAvecAnnulees}</span> {p.totalAvecAnnulees}
                </p>
              )}
              <Constat
                vue={p}
                resultat={resultat?.passageId === p.passageId ? resultat : null}
                onDebut={() => setResultat(null)}
                onResultat={(r) => {
                  setResultat(r)
                  router.refresh()
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
