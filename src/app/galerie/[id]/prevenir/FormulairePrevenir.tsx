'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { fr } from '@/lib/i18n'
import { CHAMPS_PREVENIR, erreurChampPrevenir, type ChampPrevenir, type EntreePrevenir, type ErreursPrevenir } from '@/lib/demandes/prevenir-regles'
import { envoyerInscriptionPrevenir } from './actions'

// Formulaire « Me prévenir » (story 4.5, FR-9), sur le modèle de la demande de visite (4.3) : libellé
// visible, validation à la sortie du champ et à l'envoi, jamais à la frappe, message sous le champ et
// résumé en tête, saisie conservée, « Envoi… » qui ignore les doubles appuis. Le serveur revérifie tout.

const t = fr.prevenir

const ID: Record<ChampPrevenir, string> = { email: 'prevenir-email' }

const CLASSE_CHAMP =
  'w-full min-h-touch-target rounded-sm border bg-transparent px-4 py-2.5 font-sans text-input text-foreground placeholder:text-neutral-500'

export function FormulairePrevenir({ slug, contact }: { slug: string; contact: string }) {
  const [valeurs, setValeurs] = useState<EntreePrevenir>({ email: '' })
  const [erreurs, setErreurs] = useState<ErreursPrevenir>({})
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [termine, setTermine] = useState(false)
  const enCours = useRef(false)
  const resume = useRef<HTMLDivElement>(null)
  const confirmation = useRef<HTMLDivElement>(null)
  const [refusCompte, setRefusCompte] = useState(0)

  useEffect(() => {
    if (refusCompte > 0) resume.current?.focus()
  }, [refusCompte])
  useEffect(() => {
    if (termine) confirmation.current?.focus()
  }, [termine])

  const verifier = (champ: ChampPrevenir) =>
    setErreurs((e) => {
      const { [champ]: _ancienne, ...autres } = e
      const message = erreurChampPrevenir(champ, valeurs)
      return message ? { ...autres, [champ]: message } : autres
    })

  async function envoyer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    // Double appui : un seul envoi à la fois (l'état React ne suffit pas entre deux clics rapprochés).
    if (enCours.current) return
    setMessage(null)
    const trouvees: ErreursPrevenir = {}
    for (const champ of CHAMPS_PREVENIR) {
      const erreur = erreurChampPrevenir(champ, valeurs)
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
      const reponse = await envoyerInscriptionPrevenir(slug, valeurs)
      if (reponse.ok) {
        setErreurs({})
        setTermine(true)
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
          {t.confirmation}
        </p>
      </div>
    )
  }

  const fautifs = CHAMPS_PREVENIR.filter((c) => erreurs[c])

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

      <div>
        <label htmlFor={ID.email} className="font-sans text-sm font-medium text-foreground">
          {t.champs.email.libelle}
        </label>
        <input
          id={ID.email}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={valeurs.email}
          onChange={(e) => setValeurs({ email: e.target.value })}
          onBlur={() => verifier('email')}
          aria-invalid={erreurs.email ? true : undefined}
          aria-describedby={erreurs.email ? `${ID.email}-erreur` : undefined}
          className={`mt-2 ${CLASSE_CHAMP} ${erreurs.email ? 'border-red-600' : 'border-neutral-500'}`}
        />
        {erreurs.email && (
          <p id={`${ID.email}-erreur`} className="mt-1.5 font-sans text-sm text-red-700">
            {erreurs.email}
          </p>
        )}
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
        <p className="mt-3 font-sans text-sm text-neutral-600">{t.confidentialite(contact)}</p>
      </div>
    </form>
  )
}
