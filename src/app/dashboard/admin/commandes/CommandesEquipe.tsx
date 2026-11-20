'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fr, SEPARATEUR } from '@/lib/i18n'
import { MOTIF_ANNULATION, validerMotif } from '@/lib/commandes/suivi-equipe-regles'
import type { AlerteRetard } from '@/lib/commandes/suivi-equipe-regles'
import { actionAnnulerParLEquipe } from './actions'

// Commandes payées de l'équipe (story 8.3, FR-26) : alertes de retard en tête (deux, distinctes), une carte par
// commande (état, artiste, échéances, expédition, assurance, remboursement) et « Annuler la commande » en deux
// temps avec motif obligatoire. État local, garde `useRef` contre le double appui, pas de `useFormState` (test
// navigateur) ; un résultat est annoncé dans une région `role="status"` qui reçoit le focus, la liste est relue.
// Les dates et montants arrivent déjà formatés par la page ; aucune donnée personnelle de l'acheteur.

export type VueCommandeEquipe = {
  numero: string
  etat: 'confirmee' | 'prise_en_charge' | 'expediee' | 'annulee'
  artiste: string | null
  oeuvres: string[]
  priseEnChargeAvant: string
  priseEnChargeLe: string
  expedieAvant: string
  expedieeLe: string
  transporteur: string | null
  numeroSuivi: string | null
  envoiAssure: boolean
  referenceAssurance: string | null
  /** Remboursement déjà formaté (« Demandé, 1 040 € ») ; null sans remboursement. */
  remboursement: string | null
  annuleeLe: string | null
  motif: string | null
  alertes: AlerteRetard[]
  annulable: boolean
}

type Resultat = { ok: boolean; message: string }

const BOUTON = 'min-h-touch-target rounded-sm border border-foreground px-4 font-sans text-button text-foreground disabled:opacity-40'
const CHAMP = 'mt-1 block w-full min-h-touch-target rounded-sm border border-neutral-500 bg-transparent px-3 py-2 font-sans text-input text-foreground'

function Annulation({ numero, occupe, onDebut, onResultat }: { numero: string; occupe: boolean; onDebut: () => void; onResultat: (r: Resultat) => void }) {
  const t = fr.commandesEquipe.annulation
  const garde = useRef(false)
  const [etape, setEtape] = useState<'repos' | 'motif' | 'confirmation'>('repos')
  const [motif, setMotif] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const champ = useRef<HTMLTextAreaElement>(null)
  const confirmer = useRef<HTMLButtonElement>(null)

  // Le focus suit l'étape qui s'ouvre (comme PriseEnCharge) : le champ du motif, puis le bouton de confirmation.
  useEffect(() => {
    if (etape === 'motif') champ.current?.focus()
    if (etape === 'confirmation') confirmer.current?.focus()
  }, [etape])

  function continuer() {
    const v = validerMotif(motif)
    if (!v.ok) {
      setErreur(t.erreurs[v.erreur])
      return
    }
    setErreur(null)
    setEtape('confirmation')
  }

  async function annuler() {
    if (garde.current) return
    garde.current = true
    setEnCours(true)
    onDebut()
    try {
      const r = await actionAnnulerParLEquipe(numero, motif)
      if (r.ok) setEtape('repos')
      else if (r.champ === 'motif') {
        setErreur(r.message)
        setEtape('motif')
      }
      onResultat({ ok: r.ok, message: r.message })
    } catch {
      onResultat({ ok: false, message: t.refus.indisponible })
    } finally {
      garde.current = false
      setEnCours(false)
    }
  }

  if (etape === 'repos') {
    return (
      <button type="button" disabled={occupe} onClick={() => setEtape('motif')} aria-label={`${t.bouton} ${numero}`} className={`mt-3 ${BOUTON}`}>
        {t.bouton}
      </button>
    )
  }
  if (etape === 'motif') {
    const id = `motif-${numero}`
    return (
      <div className="mt-3">
        <label htmlFor={id} className="font-sans text-sm text-foreground">{t.motifLibelle}</label>
        <p id={`${id}-aide`} className="font-sans text-sm text-neutral-600">{t.motifAide}</p>
        <textarea
          id={id}
          value={motif}
          rows={3}
          ref={champ}
          maxLength={MOTIF_ANNULATION.max}
          onChange={(e) => setMotif(e.target.value)}
          aria-describedby={erreur ? `${id}-aide ${id}-erreur` : `${id}-aide`}
          aria-invalid={erreur ? true : undefined}
          className={CHAMP}
        />
        {erreur && <p id={`${id}-erreur`} role="alert" className="mt-1 font-sans text-sm text-foreground">{erreur}</p>}
        <div className="mt-2 flex flex-wrap gap-3">
          <button type="button" onClick={continuer} className={BOUTON}>{t.continuer}</button>
          <button type="button" onClick={() => { setEtape('repos'); setErreur(null) }} className={BOUTON}>{t.non}</button>
        </div>
      </div>
    )
  }
  return (
    <div className="mt-3">
      <p className="font-sans text-sm text-foreground">{t.confirmer(numero)}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <button type="button" ref={confirmer} disabled={enCours} onClick={annuler} className={BOUTON}>{enCours ? t.enCours : t.oui}</button>
        <button type="button" disabled={enCours} onClick={() => setEtape('motif')} className={BOUTON}>{t.non}</button>
      </div>
    </div>
  )
}

export function CommandesEquipe({
  commandes,
  alertes,
  tronque = false,
}: {
  commandes: VueCommandeEquipe[]
  alertes: { priseEnCharge: string[]; expedition: string[] }
  tronque?: boolean
}) {
  const t = fr.commandesEquipe
  const router = useRouter()
  const statut = useRef<HTMLDivElement>(null)
  const [occupe, setOccupe] = useState(false)
  const [resultat, setResultat] = useState<Resultat | null>(null)

  useEffect(() => {
    if (resultat) statut.current?.focus()
  }, [resultat])

  function fini(r: Resultat) {
    setResultat(r)
    setOccupe(false)
    router.refresh()
  }

  const aucuneAlerte = alertes.priseEnCharge.length === 0 && alertes.expedition.length === 0
  const ligne = (libelle: string, valeur: string | null) =>
    valeur === null || valeur === '' ? null : (
      <p>
        <span className="text-neutral-600">{libelle}</span> {valeur}
      </p>
    )

  return (
    <div>
      <div role="status" aria-live="polite" tabIndex={-1} ref={statut}>
        {resultat && <p className="mt-3 font-sans text-sm text-foreground">{resultat.message}</p>}
      </div>
      <section aria-labelledby="alertes-retard" className="mt-3 font-sans text-sm text-foreground">
        <h3 id="alertes-retard" className="font-serif text-lg text-foreground">{t.alertes.titre}</h3>
        {aucuneAlerte && <p className="text-neutral-600">{t.alertes.aucune}</p>}
        {alertes.priseEnCharge.length > 0 && (
          <p data-alerte="prise_en_charge_en_retard">
            <strong>{t.alertes.priseEnCharge}</strong>
            {SEPARATEUR}
            {alertes.priseEnCharge.join(', ')}
          </p>
        )}
        {alertes.expedition.length > 0 && (
          <p data-alerte="expedition_en_retard">
            <strong>{t.alertes.expedition}</strong>
            {SEPARATEUR}
            {alertes.expedition.join(', ')}
          </p>
        )}
      </section>
      {tronque && <p className="mt-3 font-sans text-sm text-neutral-600">{t.tronque}</p>}
      {commandes.length === 0 ? (
        <p className="mt-3 font-sans text-sm text-neutral-600">{t.vide}</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {commandes.map((c) => (
            <li key={c.numero} className="rounded-sm border border-neutral-500 p-4 font-sans text-sm text-foreground">
              <p className="font-medium">
                {c.numero}
                {SEPARATEUR}
                {t.etats[c.etat]}
              </p>
              {c.alertes.length > 0 && (
                <p className="font-medium">{c.alertes.map((a) => t.alertes.enRetard[a]).join(SEPARATEUR)}</p>
              )}
              {ligne(t.champs.artiste, c.artiste)}
              {ligne(t.champs.oeuvres, c.oeuvres.join(', '))}
              {(c.etat === 'confirmee' || c.etat === 'prise_en_charge') && ligne(t.champs.priseEnChargeAvant, c.priseEnChargeAvant)}
              {c.priseEnChargeLe !== t.absent && ligne(t.champs.priseEnChargeLe, c.priseEnChargeLe)}
              {(c.etat === 'confirmee' || c.etat === 'prise_en_charge') && ligne(t.champs.expedieAvant, c.expedieAvant)}
              {c.etat === 'expediee' && (
                <>
                  {ligne(t.champs.expedieeLe, c.expedieeLe)}
                  {ligne(t.champs.transporteur, c.transporteur)}
                  {ligne(t.champs.numeroSuivi, c.numeroSuivi)}
                  {ligne(t.champs.envoiAssure, c.envoiAssure ? t.oui : t.non)}
                  {c.envoiAssure && ligne(t.champs.referenceAssurance, c.referenceAssurance)}
                </>
              )}
              {ligne(t.champs.remboursement, c.remboursement)}
              {c.etat === 'annulee' && (
                <>
                  {ligne(t.champs.annuleeLe, c.annuleeLe)}
                  {ligne(t.champs.motif, c.motif)}
                </>
              )}
              {c.annulable && <Annulation numero={c.numero} occupe={occupe} onDebut={() => setOccupe(true)} onResultat={fini} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
