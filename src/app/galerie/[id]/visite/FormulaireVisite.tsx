'use client'

import { useEffect, useRef, useState, type FocusEvent, type FormEvent } from 'react'
import { fr, formaterDateHeure, fuseauAppareil, heureMurale, heureMuraleEnUtc } from '@/lib/i18n'
import {
  CHAMPS_VISITE,
  LIMITES_VISITE,
  creneauxSaisis,
  erreurChampVisite,
  type ChampVisite,
  type EntreeVisite,
  type ErreursVisite,
} from '@/lib/demandes/visite-regles'
import { envoyerDemandeVisite } from './actions'

// Formulaire de demande de visite (story 4.3, FR-8, UX-DR44), sur le modèle de `/conseil` (4.2) :
// libellés visibles, validation à la sortie du champ (ou du groupe) et à l'envoi, jamais à la frappe,
// message sous le champ et résumé en tête, saisie conservée, « Envoi… » qui ignore les doubles appuis.
// Les créneaux sont saisis dans le fuseau de l'appareil (lu après le montage : le serveur ne le
// connaît pas) et envoyés tels quels avec ce fuseau ; le serveur revérifie tout.

const t = fr.visite
const NOMBRE_CHAMPS_CRENEAU = LIMITES_VISITE.creneauxMax

const ID: Record<ChampVisite, string> = {
  type: 'visite-type',
  creneaux: 'visite-creneaux',
  email: 'visite-email',
  telephone: 'visite-telephone',
}
const idCreneau = (i: number) => `visite-creneau-${i + 1}`

const CLASSE_CHAMP =
  'w-full min-h-touch-target rounded-sm border bg-transparent px-4 py-2.5 font-sans text-input text-foreground placeholder:text-neutral-500'

type Props = {
  slug: string
  /** L'artiste accepte les visites en atelier : sinon l'option n'est pas proposée. */
  atelierAccepte: boolean
  delaiHeures: number
}

export function FormulaireVisite({ slug, atelierAccepte, delaiHeures }: Props) {
  const vide = (): EntreeVisite => ({
    type: atelierAccepte ? '' : 'distance',
    creneaux: Array<string>(NOMBRE_CHAMPS_CRENEAU).fill(''),
    fuseau: '',
    email: '',
    telephone: '',
  })
  const [valeurs, setValeurs] = useState<EntreeVisite>(vide)
  const [erreurs, setErreurs] = useState<ErreursVisite>({})
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [termine, setTermine] = useState<EntreeVisite | null>(null)
  const enCours = useRef(false)
  const resume = useRef<HTMLDivElement>(null)
  const confirmation = useRef<HTMLDivElement>(null)
  const [refusCompte, setRefusCompte] = useState(0)

  // Fuseau de l'appareil : seulement dans le navigateur.
  useEffect(() => {
    const fuseau = fuseauAppareil()
    setValeurs((v) => ({ ...v, fuseau }))
  }, [])
  useEffect(() => {
    if (refusCompte > 0) resume.current?.focus()
  }, [refusCompte])
  useEffect(() => {
    if (termine) confirmation.current?.focus()
  }, [termine])

  const contexte = () => ({ atelierAccepte, maintenant: new Date() })

  const verifier = (champ: ChampVisite) =>
    setErreurs((e) => {
      const { [champ]: _ancienne, ...autres } = e
      const message = erreurChampVisite(champ, valeurs, contexte())
      return message ? { ...autres, [champ]: message } : autres
    })

  // À la sortie d'un groupe (le focus quitte toutes ses cases), pas à chaque case.
  const sortieDuGroupe = (champ: ChampVisite) => (e: FocusEvent<HTMLFieldSetElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) verifier(champ)
  }

  const modifierCreneau = (i: number, valeur: string) =>
    setValeurs((v) => ({ ...v, creneaux: v.creneaux.map((c, j) => (j === i ? valeur : c)) }))

  async function envoyer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    // Double appui : un seul envoi à la fois (l'état React ne suffit pas entre deux clics rapprochés).
    if (enCours.current) return
    setMessage(null)
    const trouvees: ErreursVisite = {}
    for (const champ of CHAMPS_VISITE) {
      const erreur = erreurChampVisite(champ, valeurs, contexte())
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
      const reponse = await envoyerDemandeVisite(slug, valeurs)
      if (reponse.ok) {
        setErreurs({})
        setTermine(valeurs)
      } else if (reponse.code === 'invalide') {
        setErreurs(reponse.erreurs)
        setRefusCompte((n) => n + 1)
      } else {
        setMessage(
          reponse.code === 'trop_de_demandes' ? t.refus : reponse.code === 'oeuvre_indisponible' ? t.oeuvreIndisponible : t.indisponible,
        )
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
      <div ref={confirmation} tabIndex={-1} className="mt-10 rounded-sm border border-neutral-300 p-6 focus:outline-none">
        <p role="status" className="font-serif text-xl text-foreground">
          {t.confirmation(delaiHeures)}
        </p>
        <p className="mt-4 font-sans text-sm text-neutral-600">{t.rappelCreneaux(termine.fuseau)}</p>
        <ul className="mt-2 list-disc ps-5 font-sans text-base text-foreground">
          {creneauxSaisis(termine).map((c) => (
            <li key={c}>{formaterDateHeure(heureMuraleEnUtc(c, termine.fuseau), { fuseau: termine.fuseau, jourSemaine: true })}</li>
          ))}
        </ul>
      </div>
    )
  }

  const fautifs = CHAMPS_VISITE.filter((c) => erreurs[c])
  const classe = (champ: ChampVisite) => `${CLASSE_CHAMP} ${erreurs[champ] ? 'border-red-600' : 'border-neutral-500'}`
  const lien = (champ: ChampVisite) => (erreurs[champ] ? `${ID[champ]}-erreur` : undefined)
  // Bornes du sélecteur de date (aide seulement ; la règle fait foi).
  const maintenant = new Date()
  // La minute en cours est refusée (« à venir ») : la première proposable est la suivante.
  const minuteSuivante = new Date(Math.floor(maintenant.getTime() / 60_000) * 60_000 + 60_000)
  const min = valeurs.fuseau ? heureMurale(minuteSuivante, valeurs.fuseau) ?? undefined : undefined
  const max = valeurs.fuseau
    ? heureMurale(new Date(maintenant.getTime() + LIMITES_VISITE.horizonJours * 24 * 3_600_000), valeurs.fuseau) ?? undefined
    : undefined

  const Erreur = ({ champ }: { champ: ChampVisite }) =>
    erreurs[champ] ? (
      <p id={`${ID[champ]}-erreur`} className="mt-1.5 font-sans text-sm text-red-700">
        {erreurs[champ]}
      </p>
    ) : null

  const types = atelierAccepte ? (['distance', 'atelier'] as const) : (['distance'] as const)

  return (
    <form method="post" onSubmit={envoyer} noValidate className="mt-10 flex flex-col gap-8" aria-busy={envoi}>
      <div ref={resume} tabIndex={-1} role={fautifs.length > 0 ? 'alert' : undefined} className="focus:outline-none">
        {fautifs.length > 0 && (
          <div className="rounded-sm border border-red-600 p-4">
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

      <fieldset
        id={ID.type}
        tabIndex={-1}
        aria-describedby={lien('type')}
        onBlur={sortieDuGroupe('type')}
        className="m-0 border-0 p-0"
      >
        <legend className="font-sans text-sm font-medium text-foreground">{t.champs.type.libelle}</legend>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
          {types.map((type) => (
            <label key={type} className="flex min-h-touch-target items-center gap-2 font-sans text-base text-foreground">
              <input
                type="radio"
                name="type"
                value={type}
                checked={valeurs.type === type}
                onChange={() => {
                  setValeurs((v) => ({ ...v, type }))
                  setErreurs(({ type: _t, ...autres }) => autres)
                }}
                className="h-5 w-5"
              />
              {t.champs.type[type]}
            </label>
          ))}
        </div>
        <Erreur champ="type" />
      </fieldset>

      <fieldset
        id={ID.creneaux}
        tabIndex={-1}
        aria-describedby={[`${ID.creneaux}-aide`, valeurs.fuseau ? `${ID.creneaux}-fuseau` : undefined, lien('creneaux')].filter(Boolean).join(' ')}
        onBlur={sortieDuGroupe('creneaux')}
        className="m-0 border-0 p-0"
      >
        <legend className="font-sans text-sm font-medium text-foreground">{t.champs.creneaux.libelle}</legend>
        <p id={`${ID.creneaux}-aide`} className="mt-1 font-sans text-sm text-neutral-600">
          {t.champs.creneaux.aide(LIMITES_VISITE.horizonJours)}
        </p>
        {valeurs.fuseau && (
          <p id={`${ID.creneaux}-fuseau`} className="mt-1 font-sans text-sm text-neutral-600">
            {t.champs.creneaux.fuseau(valeurs.fuseau)}
          </p>
        )}
        <div className="mt-2 flex flex-col gap-4">
          {valeurs.creneaux.map((creneau, i) => (
            <div key={idCreneau(i)}>
              <label htmlFor={idCreneau(i)} className="font-sans text-sm text-foreground">
                {t.champs.creneaux.creneau(i + 1, i >= LIMITES_VISITE.creneauxMin)}
              </label>
              <input
                id={idCreneau(i)}
                name={`creneau-${i + 1}`}
                type="datetime-local"
                min={min}
                max={max}
                value={creneau}
                onChange={(e) => modifierCreneau(i, e.target.value)}
                aria-invalid={erreurs.creneaux ? true : undefined}
                aria-describedby={lien('creneaux')}
                className={`mt-1 ${classe('creneaux')}`}
              />
            </div>
          ))}
        </div>
        <Erreur champ="creneaux" />
      </fieldset>

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
          onChange={(e) => setValeurs((v) => ({ ...v, email: e.target.value }))}
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
          onChange={(e) => setValeurs((v) => ({ ...v, telephone: e.target.value }))}
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
