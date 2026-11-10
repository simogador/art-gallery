'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AMBIANCES } from '@/lib/curation/depot-regles'
import { fr } from '@/lib/i18n'
import {
  CHAMPS_SELECTION,
  erreurChamp,
  type ChampSelection,
  type EntreeSelection,
  type ErreursSelection,
} from '@/lib/demandes/selection-regles'
import { envoyerDemandeSelection } from './actions'

// Formulaire de demande de sélection (story 4.2, FR-8, UX-DR44) : libellés visibles, validation à la
// sortie du champ et à l'envoi (jamais à la frappe), message sous le champ fautif et résumé en tête
// s'il y en a plusieurs, saisie conservée, bouton « Envoi… » qui ignore les doubles appuis.
// Le serveur revérifie tout : la validation d'ici n'est qu'une aide.

const t = fr.conseil
const VIDE: EntreeSelection = { espace: '', ambiances: [], precision: '', budget: '', email: '', telephone: '' }

const ID: Record<ChampSelection, string> = {
  espace: 'conseil-espace',
  ambiances: 'conseil-ambiances',
  precision: 'conseil-precision',
  budget: 'conseil-budget',
  email: 'conseil-email',
  telephone: 'conseil-telephone',
}

const CLASSE_CHAMP =
  'w-full min-h-touch-target rounded-sm border bg-transparent px-4 py-2.5 font-sans text-input text-foreground placeholder:text-neutral-500'

type Props = { delaiHeures: number }

export function FormulaireConseil({ delaiHeures }: Props) {
  const [valeurs, setValeurs] = useState<EntreeSelection>(VIDE)
  const [erreurs, setErreurs] = useState<ErreursSelection>({})
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [termine, setTermine] = useState(false)
  const enCours = useRef(false)
  const resume = useRef<HTMLDivElement>(null)
  const confirmation = useRef<HTMLDivElement>(null)
  // Compte des envois refusés : le résumé reçoit le focus une fois affiché (pas avant, pour être lu).
  const [refusCompte, setRefusCompte] = useState(0)

  useEffect(() => {
    if (refusCompte > 0) resume.current?.focus()
  }, [refusCompte])
  useEffect(() => {
    if (termine) confirmation.current?.focus()
  }, [termine])

  const modifier = <C extends keyof EntreeSelection>(champ: C, valeur: EntreeSelection[C]) =>
    setValeurs((v) => ({ ...v, [champ]: valeur }))

  // À la sortie d'un champ : seulement le champ quitté (jamais à la frappe).
  const verifier = (champ: ChampSelection) =>
    setErreurs((e) => {
      const { [champ]: _ancienne, ...autres } = e
      const message = erreurChamp(champ, valeurs)
      return message ? { ...autres, [champ]: message } : autres
    })

  const basculerAmbiance = (code: string) => {
    const ambiances = valeurs.ambiances.includes(code) ? valeurs.ambiances.filter((a) => a !== code) : [...valeurs.ambiances, code]
    modifier('ambiances', ambiances)
    // Une ambiance cochée lève l'erreur « au moins une » sans attendre l'envoi.
    if (ambiances.length > 0) setErreurs(({ ambiances: _a, ...autres }) => autres)
  }

  async function envoyer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    // Double appui : un seul envoi à la fois (l'état React ne suffit pas entre deux clics rapprochés).
    if (enCours.current) return
    setMessage(null)
    const trouvees: ErreursSelection = {}
    for (const champ of CHAMPS_SELECTION) {
      const erreur = erreurChamp(champ, valeurs)
      if (erreur) trouvees[champ] = erreur
    }
    if (Object.keys(trouvees).length > 0) {
      setErreurs(trouvees)
      setRefusCompte((n) => n + 1)
      return
    }
    enCours.current = true
    setEnvoi(true)
    try {
      const reponse = await envoyerDemandeSelection(valeurs)
      if (reponse.ok) {
        setErreurs({})
        setTermine(true)
      } else if (reponse.code === 'invalide') {
        setErreurs(reponse.erreurs)
        setRefusCompte((n) => n + 1)
      } else {
        setMessage(reponse.code === 'trop_de_demandes' ? t.refus : t.indisponible)
      }
    } catch {
      setMessage(t.indisponible)
    } finally {
      enCours.current = false
      setEnvoi(false)
    }
  }

  if (termine) {
    return (
      <div ref={confirmation} tabIndex={-1} className="mt-10 border border-neutral-300 rounded-sm p-6 focus:outline-none">
        <p role="status" className="font-serif text-xl text-foreground">
          {t.confirmation(delaiHeures)}
        </p>
        <button
          type="button"
          onClick={() => {
            setValeurs(VIDE)
            setTermine(false)
          }}
          className="mt-6 min-h-touch-target px-4 font-sans text-sm text-foreground underline underline-offset-4"
        >
          {t.nouvelleDemande}
        </button>
      </div>
    )
  }

  const fautifs = CHAMPS_SELECTION.filter((c) => erreurs[c])
  const classe = (champ: ChampSelection) => `${CLASSE_CHAMP} ${erreurs[champ] ? 'border-red-600' : 'border-neutral-500'}`
  const lien = (champ: ChampSelection) => (erreurs[champ] ? `${ID[champ]}-erreur` : undefined)

  const Erreur = ({ champ }: { champ: ChampSelection }) =>
    erreurs[champ] ? (
      <p id={`${ID[champ]}-erreur`} className="mt-1.5 font-sans text-sm text-red-700">
        {erreurs[champ]}
      </p>
    ) : null

  return (
    <form onSubmit={envoyer} noValidate className="mt-10 flex flex-col gap-8" aria-busy={envoi}>
      <div ref={resume} tabIndex={-1} role={fautifs.length > 0 ? 'alert' : undefined} className="focus:outline-none">
        {fautifs.length > 0 && (
          <div className="border border-red-600 rounded-sm p-4">
            <p className="font-sans text-sm font-medium text-red-700">{t.resume(fautifs.length)}</p>
            <ul className="mt-2 list-disc ps-5 font-sans text-sm text-red-700">
              {fautifs.map((champ) => (
                <li key={champ}>
                  <a href={`#${ID[champ]}`} className="underline underline-offset-2">
                    {erreurs[champ]}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <label htmlFor={ID.espace} className="font-sans text-sm font-medium text-foreground">
          {t.champs.espace.libelle}
        </label>
        <p id={`${ID.espace}-aide`} className="mt-1 font-sans text-sm text-neutral-600">
          {t.champs.espace.aide}
        </p>
        <textarea
          id={ID.espace}
          name="espace"
          rows={4}
          value={valeurs.espace}
          onChange={(e) => modifier('espace', e.target.value)}
          onBlur={() => verifier('espace')}
          aria-invalid={erreurs.espace ? true : undefined}
          aria-describedby={[`${ID.espace}-aide`, lien('espace')].filter(Boolean).join(' ')}
          className={`mt-2 ${classe('espace')}`}
        />
        <Erreur champ="espace" />
      </div>

      <fieldset
        id={ID.ambiances}
        tabIndex={-1}
        aria-describedby={[`${ID.ambiances}-aide`, lien('ambiances')].filter(Boolean).join(' ')}
        // À la sortie du groupe (le focus quitte toutes les cases), pas à chaque case.
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) verifier('ambiances')
        }}
        className="m-0 border-0 p-0"
      >
        <legend className="font-sans text-sm font-medium text-foreground">{t.champs.ambiances.libelle}</legend>
        <p id={`${ID.ambiances}-aide`} className="mt-1 font-sans text-sm text-neutral-600">
          {t.champs.ambiances.aide}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
          {AMBIANCES.map((a) => (
            <label key={a.code} className="flex min-h-touch-target items-center gap-2 font-sans text-base text-foreground">
              <input
                type="checkbox"
                name="ambiances"
                value={a.code}
                checked={valeurs.ambiances.includes(a.code)}
                onChange={() => basculerAmbiance(a.code)}
                className="h-5 w-5"
              />
              {a.libelle}
            </label>
          ))}
        </div>
        <Erreur champ="ambiances" />
      </fieldset>

      <div>
        <label htmlFor={ID.precision} className="font-sans text-sm font-medium text-foreground">
          {t.champs.precision.libelle}
        </label>
        <textarea
          id={ID.precision}
          name="precision"
          rows={3}
          value={valeurs.precision}
          onChange={(e) => modifier('precision', e.target.value)}
          onBlur={() => verifier('precision')}
          aria-invalid={erreurs.precision ? true : undefined}
          aria-describedby={lien('precision')}
          className={`mt-2 ${classe('precision')}`}
        />
        <Erreur champ="precision" />
      </div>

      <div>
        <label htmlFor={ID.budget} className="font-sans text-sm font-medium text-foreground">
          {t.champs.budget.libelle}
        </label>
        <p id={`${ID.budget}-aide`} className="mt-1 font-sans text-sm text-neutral-600">
          {t.champs.budget.aide}
        </p>
        <input
          id={ID.budget}
          name="budget"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={valeurs.budget}
          onChange={(e) => modifier('budget', e.target.value)}
          onBlur={() => verifier('budget')}
          aria-invalid={erreurs.budget ? true : undefined}
          aria-describedby={[`${ID.budget}-aide`, lien('budget')].filter(Boolean).join(' ')}
          className={`mt-2 ${classe('budget')}`}
        />
        <Erreur champ="budget" />
      </div>

      <div>
        <label htmlFor={ID.email} className="font-sans text-sm font-medium text-foreground">
          {t.champs.email.libelle}
        </label>
        <input
          id={ID.email}
          name="email"
          type="email"
          autoComplete="email"
          value={valeurs.email}
          onChange={(e) => modifier('email', e.target.value)}
          onBlur={() => verifier('email')}
          aria-invalid={erreurs.email ? true : undefined}
          aria-describedby={lien('email')}
          className={`mt-2 ${classe('email')}`}
        />
        <Erreur champ="email" />
      </div>

      <div>
        <label htmlFor={ID.telephone} className="font-sans text-sm font-medium text-foreground">
          {t.champs.telephone.libelle}
        </label>
        <input
          id={ID.telephone}
          name="telephone"
          type="tel"
          autoComplete="tel"
          value={valeurs.telephone}
          onChange={(e) => modifier('telephone', e.target.value)}
          onBlur={() => verifier('telephone')}
          aria-invalid={erreurs.telephone ? true : undefined}
          aria-describedby={lien('telephone')}
          className={`mt-2 ${classe('telephone')}`}
        />
        <Erreur champ="telephone" />
      </div>

      {message && (
        <p role="alert" className="font-sans text-sm text-red-700">
          {message}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={envoi}
          className="min-h-touch-target rounded-sm border border-foreground bg-foreground px-8 py-3 font-sans text-sm font-medium uppercase tracking-widest text-background disabled:opacity-60"
        >
          {envoi ? t.envoiEnCours : t.envoyer}
        </button>
        <p className="mt-3 font-sans text-sm text-neutral-600">{t.confidentialite}</p>
      </div>
    </form>
  )
}
