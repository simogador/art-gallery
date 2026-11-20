'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fr, SEPARATEUR } from '@/lib/i18n'
import { MOTIF_ANNULATION, validerMotif } from '@/lib/commandes/suivi-equipe-regles'
import { PREUVE, validerLivraison } from '@/lib/commandes/livraison-regles'
import type { AlerteRetard } from '@/lib/commandes/suivi-equipe-regles'
import { actionAccepterReclamation, actionAnnulerParLEquipe, actionEnregistrerLivraison, actionRefuserReclamation, actionRetourRecu } from './actions'

// Livraison constatée (story 8.4) : « Enregistrer la livraison » sur les commandes expédiées (source, preuve
// obligatoire au-dessus du seuil d'assurance, confirmation en deux temps) ; les livrées montrent date, source,
// preuve et fin du délai de retour.
// Commandes payées de l'équipe (story 8.3, FR-26) : alertes de retard en tête (deux, distinctes), une carte par
// commande (état, artiste, échéances, expédition, assurance, remboursement) et « Annuler la commande » en deux
// temps avec motif obligatoire. État local, garde `useRef` contre le double appui, pas de `useFormState` (test
// navigateur) ; un résultat est annoncé dans une région `role="status"` qui reçoit le focus, la liste est relue.
// Les dates et montants arrivent déjà formatés par la page ; aucune donnée personnelle de l'acheteur.

export type VueCommandeEquipe = {
  numero: string
  etat: 'confirmee' | 'prise_en_charge' | 'expediee' | 'livree' | 'retournee' | 'annulee'
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
  /** `expediee` : « Enregistrer la livraison » proposé (story 8.4). */
  livrable: boolean
  /** La preuve de livraison est obligatoire (au-dessus du seuil d'assurance). */
  preuveRequise: boolean
  /** Commande livrée : date, source (déjà libellée), preuve saisie et fin du délai de retour. */
  livreeLe: string | null
  livraisonSource: string | null
  preuveLivraison: string | null
  retourAvant: string | null
  /** Réclamation de l'acheteur (story 8.5), déjà libellée ; null sans réclamation. Visible de l'équipe seulement. */
  reclamation: {
    motif: string
    description: string
    etat: 'ouverte' | 'acceptee' | 'refusee'
    motifRefus: string | null
    decideLe: string | null
    photos: string[]
    /** Réclamation acceptée d'une commande livrée seulement (décision 6A) : e-mail de l'acheteur. */
    emailAcheteur?: string
  } | null
  /** « Retour reçu » proposé (réclamation acceptée) et montant de la commande, déjà formaté. */
  retournable: boolean
  montantCommande: string | null
  retourRecuLe: string | null
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

function Reclamation({ numero, vue, occupe, onDebut, onResultat }: { numero: string; vue: NonNullable<VueCommandeEquipe['reclamation']>; occupe: boolean; onDebut: () => void; onResultat: (r: Resultat) => void }) {
  const t = fr.commandesEquipe.reclamation
  const garde = useRef(false)
  const [etape, setEtape] = useState<'repos' | 'accepter' | 'refus' | 'refus_confirmation'>('repos')
  const [motif, setMotif] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const champ = useRef<HTMLTextAreaElement>(null)
  const confirmer = useRef<HTMLButtonElement>(null)
  const id = `reclamation-${numero}`

  useEffect(() => {
    if (etape === 'refus') champ.current?.focus()
    if (etape === 'accepter' || etape === 'refus_confirmation') confirmer.current?.focus()
  }, [etape])

  function continuerRefus() {
    const v = validerMotif(motif)
    if (!v.ok) {
      setErreur(t.erreurs[v.erreur])
      return
    }
    setErreur(null)
    setEtape('refus_confirmation')
  }

  async function lancer(action: () => ReturnType<typeof actionAccepterReclamation>, retour: 'refus' | 'repos') {
    if (garde.current) return
    garde.current = true
    setEnCours(true)
    onDebut()
    try {
      const r = await action()
      if (r.ok) setEtape('repos')
      else {
        if (r.champ === 'motif') setErreur(r.message)
        setEtape(retour)
      }
      onResultat({ ok: r.ok, message: r.message })
    } catch {
      onResultat({ ok: false, message: t.refus.indisponible })
    } finally {
      garde.current = false
      setEnCours(false)
    }
  }

  return (
    <div className="mt-2">
      {vue.etat === 'ouverte' && etape === 'repos' && (
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={occupe} onClick={() => setEtape('accepter')} aria-label={`${t.accepter} ${numero}`} className={BOUTON}>
            {t.accepter}
          </button>
          <button type="button" disabled={occupe} onClick={() => setEtape('refus')} aria-label={`${t.refuser} ${numero}`} className={BOUTON}>
            {t.refuser}
          </button>
        </div>
      )}
      {etape === 'accepter' && (
        <div>
          <p className="font-sans text-sm text-foreground">{t.accepterConfirmer(numero)}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" ref={confirmer} disabled={enCours} onClick={() => lancer(() => actionAccepterReclamation(numero), 'repos')} className={BOUTON}>
              {enCours ? t.enCours : t.oui}
            </button>
            <button type="button" disabled={enCours} onClick={() => setEtape('repos')} className={BOUTON}>{t.non}</button>
          </div>
        </div>
      )}
      {etape === 'refus' && (
        <div>
          <label htmlFor={`${id}-motif`} className="font-sans text-sm text-foreground">{t.motifLibelle}</label>
          <p id={`${id}-aide`} className="font-sans text-sm text-neutral-600">{t.motifAide}</p>
          <textarea
            id={`${id}-motif`}
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
            <button type="button" onClick={continuerRefus} className={BOUTON}>{t.continuer}</button>
            <button type="button" onClick={() => { setEtape('repos'); setErreur(null) }} className={BOUTON}>{t.non}</button>
          </div>
        </div>
      )}
      {etape === 'refus_confirmation' && (
        <div>
          <p className="font-sans text-sm text-foreground">{t.confirmerRefus(numero)}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" ref={confirmer} disabled={enCours} onClick={() => lancer(() => actionRefuserReclamation(numero, motif), 'refus')} className={BOUTON}>
              {enCours ? t.enCours : t.oui}
            </button>
            <button type="button" disabled={enCours} onClick={() => setEtape('refus')} className={BOUTON}>{t.non}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function RetourRecu({ numero, montantCommande, occupe, onDebut, onResultat }: { numero: string; montantCommande: string | null; occupe: boolean; onDebut: () => void; onResultat: (r: Resultat) => void }) {
  const t = fr.commandesEquipe.reclamation
  const garde = useRef(false)
  const [etape, setEtape] = useState<'repos' | 'saisie' | 'confirmation'>('repos')
  const [montant, setMontant] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const champ = useRef<HTMLInputElement>(null)
  const confirmer = useRef<HTMLButtonElement>(null)
  const id = `retour-${numero}`

  useEffect(() => {
    if (etape === 'saisie') champ.current?.focus()
    if (etape === 'confirmation') confirmer.current?.focus()
  }, [etape])

  async function enregistrer() {
    if (garde.current) return
    garde.current = true
    setEnCours(true)
    onDebut()
    try {
      const r = await actionRetourRecu(numero, montant)
      if (r.ok) setEtape('repos')
      else {
        setErreur(r.message)
        setEtape('saisie')
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
      <button type="button" disabled={occupe} onClick={() => setEtape('saisie')} aria-label={`${t.retourBouton} ${numero}`} className={`mt-2 ${BOUTON}`}>
        {t.retourBouton}
      </button>
    )
  }
  if (etape === 'saisie') {
    return (
      <div className="mt-2">
        <p className="font-sans text-sm text-neutral-600">{t.retourIntro}</p>
        <label htmlFor={`${id}-montant`} className="mt-2 block font-sans text-sm text-foreground">{t.montantLibelle}</label>
        <p id={`${id}-aide`} className="font-sans text-sm text-neutral-600">{t.montantAide(montantCommande ?? '')}</p>
        <input
          id={`${id}-montant`}
          ref={champ}
          type="text"
          inputMode="decimal"
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          aria-describedby={erreur ? `${id}-aide ${id}-erreur` : `${id}-aide`}
          aria-invalid={erreur ? true : undefined}
          className={CHAMP}
        />
        {erreur && <p id={`${id}-erreur`} role="alert" className="mt-1 font-sans text-sm text-foreground">{erreur}</p>}
        <div className="mt-2 flex flex-wrap gap-3">
          <button type="button" onClick={() => { setErreur(null); setEtape('confirmation') }} className={BOUTON}>{t.continuer}</button>
          <button type="button" onClick={() => { setEtape('repos'); setErreur(null) }} className={BOUTON}>{t.non}</button>
        </div>
      </div>
    )
  }
  return (
    <div className="mt-2">
      <p className="font-sans text-sm text-foreground">{t.confirmerRetour(numero)}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <button type="button" ref={confirmer} disabled={enCours} onClick={enregistrer} className={BOUTON}>{enCours ? t.enCours : t.oui}</button>
        <button type="button" disabled={enCours} onClick={() => setEtape('saisie')} className={BOUTON}>{t.non}</button>
      </div>
    </div>
  )
}

function Livraison({ numero, preuveRequise, occupe, onDebut, onResultat }: { numero: string; preuveRequise: boolean; occupe: boolean; onDebut: () => void; onResultat: (r: Resultat) => void }) {
  const t = fr.commandesEquipe.livraison
  const garde = useRef(false)
  const [etape, setEtape] = useState<'repos' | 'saisie' | 'confirmation'>('repos')
  const [source, setSource] = useState<'equipe_suivi' | 'equipe_preuve'>(preuveRequise ? 'equipe_preuve' : 'equipe_suivi')
  const [preuve, setPreuve] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const champ = useRef<HTMLInputElement>(null)
  const confirmer = useRef<HTMLButtonElement>(null)
  const id = `livraison-${numero}`

  useEffect(() => {
    if (etape === 'saisie') champ.current?.focus()
    if (etape === 'confirmation') confirmer.current?.focus()
  }, [etape])

  function continuer() {
    const v = validerLivraison({ source, preuve }, preuveRequise)
    if (!v.ok) {
      setErreur(v.erreurs.preuve ? t.erreurs[v.erreurs.preuve] : v.erreurs.source === 'preuve_requise' ? t.erreurs.preuve_requise : t.erreurs.source)
      return
    }
    setErreur(null)
    setEtape('confirmation')
  }

  async function enregistrer() {
    if (garde.current) return
    garde.current = true
    setEnCours(true)
    onDebut()
    try {
      const r = await actionEnregistrerLivraison(numero, source, preuve)
      if (r.ok) setEtape('repos')
      else {
        setErreur(r.message)
        setEtape('saisie')
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
      <button type="button" disabled={occupe} onClick={() => setEtape('saisie')} aria-label={`${t.bouton} ${numero}`} className={`mt-3 ${BOUTON}`}>
        {t.bouton}
      </button>
    )
  }
  if (etape === 'saisie') {
    return (
      <div className="mt-3">
        <p className="font-sans text-sm text-neutral-600">{t.intro}</p>
        <fieldset className="mt-2">
          <legend className="font-sans text-sm text-foreground">{t.sourceLibelle}</legend>
          {(['equipe_suivi', 'equipe_preuve'] as const).map((valeur) => (
            <label key={valeur} className="mt-1 flex min-h-touch-target items-center gap-2 font-sans text-sm text-foreground">
              <input
                type="radio"
                name={`${id}-source`}
                value={valeur}
                checked={source === valeur}
                disabled={preuveRequise && valeur === 'equipe_suivi'}
                onChange={() => setSource(valeur)}
              />
              {t.sources[valeur]}
            </label>
          ))}
        </fieldset>
        <label htmlFor={`${id}-preuve`} className="mt-2 block font-sans text-sm text-foreground">{t.preuveLibelle}</label>
        <p id={`${id}-aide`} className="font-sans text-sm text-neutral-600">{preuveRequise || source === 'equipe_preuve' ? t.preuveAideRequise : t.preuveAide}</p>
        <input
          id={`${id}-preuve`}
          ref={champ}
          type="text"
          value={preuve}
          maxLength={PREUVE.max}
          onChange={(e) => setPreuve(e.target.value)}
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
        <button type="button" ref={confirmer} disabled={enCours} onClick={enregistrer} className={BOUTON}>{enCours ? t.enCours : t.oui}</button>
        <button type="button" disabled={enCours} onClick={() => setEtape('saisie')} className={BOUTON}>{t.non}</button>
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

  const aTraiter = commandes.filter((c) => c.etat === 'livree' && !!c.reclamation && c.reclamation.etat !== 'refusee')
  const autres = commandes.filter((c) => !aTraiter.includes(c))
  const carte = (c: VueCommandeEquipe) => (
    <li key={c.numero} className="rounded-sm border border-neutral-500 p-4 font-sans text-sm text-foreground">
      <p className="font-medium">
        {c.numero}
        {SEPARATEUR}
        {t.etats[c.etat]}
      </p>
      {c.alertes.length > 0 && <p className="font-medium">{c.alertes.map((a) => t.alertes.enRetard[a]).join(SEPARATEUR)}</p>}
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
      {(c.etat === 'livree' || c.etat === 'retournee') && (
        <>
          {ligne(t.champs.livreeLe, c.livreeLe)}
          {ligne(t.champs.livraisonSource, c.livraisonSource)}
          {ligne(t.champs.preuveLivraison, c.preuveLivraison)}
          {ligne(t.champs.retourAvant, c.retourAvant)}
        </>
      )}
      {c.reclamation && (
        <div data-reclamation={c.reclamation.etat} className="mt-1">
          {ligne(t.reclamation.champs.etat, t.reclamation.etats[c.reclamation.etat])}
          {ligne(t.reclamation.champs.motif, c.reclamation.motif)}
          <p className="break-words whitespace-pre-wrap">
            <span className="text-neutral-600">{t.reclamation.champs.description}</span> {c.reclamation.description}
          </p>
          {c.reclamation.photos.length > 0 && (
            <p>
              <span className="me-2 text-neutral-600">{t.reclamation.champs.photos}</span>
              {c.reclamation.photos.map((url, i) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="me-3 underline">
                  {t.reclamation.photo(i + 1)}
                </a>
              ))}
            </p>
          )}
          {c.reclamation.emailAcheteur !== undefined && (
            <div data-email-acheteur>
              {ligne(t.reclamation.champs.emailAcheteur, c.reclamation.emailAcheteur)}
              <p className="text-neutral-600">{t.reclamation.emailAcheteurAide}</p>
            </div>
          )}
          {c.reclamation.etat === 'refusee' && ligne(t.reclamation.champs.motifRefus, c.reclamation.motifRefus)}
          {c.reclamation.etat !== 'ouverte' && ligne(t.reclamation.champs.decideLe, c.reclamation.decideLe)}
        </div>
      )}
      {c.etat === 'retournee' && ligne(t.reclamation.champs.retourRecuLe, c.retourRecuLe)}
      {ligne(t.champs.remboursement, c.remboursement)}
      {c.etat === 'annulee' && (
        <>
          {ligne(t.champs.annuleeLe, c.annuleeLe)}
          {ligne(t.champs.motif, c.motif)}
        </>
      )}
      {c.reclamation && <Reclamation numero={c.numero} vue={c.reclamation} occupe={occupe} onDebut={() => setOccupe(true)} onResultat={fini} />}
      {c.retournable && <RetourRecu numero={c.numero} montantCommande={c.montantCommande} occupe={occupe} onDebut={() => setOccupe(true)} onResultat={fini} />}
      {c.livrable && <Livraison numero={c.numero} preuveRequise={c.preuveRequise} occupe={occupe} onDebut={() => setOccupe(true)} onResultat={fini} />}
      {c.annulable && <Annulation numero={c.numero} occupe={occupe} onDebut={() => setOccupe(true)} onResultat={fini} />}
    </li>
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
      {aTraiter.length > 0 && (
        <section aria-labelledby="reclamations-a-traiter" className="mt-6">
          <h3 id="reclamations-a-traiter" className="font-serif text-lg text-foreground">{t.reclamation.ouvertes}</h3>
          <ul className="mt-3 space-y-4">{aTraiter.map(carte)}</ul>
        </section>
      )}
      {aTraiter.length === 0 && <p className="mt-3 font-sans text-sm text-neutral-600">{t.reclamation.aucune}</p>}
      {commandes.length === 0 && <p className="mt-3 font-sans text-sm text-neutral-600">{t.vide}</p>}
      {autres.length > 0 && <ul className="mt-3 space-y-4">{autres.map(carte)}</ul>}
    </div>
  )
}
