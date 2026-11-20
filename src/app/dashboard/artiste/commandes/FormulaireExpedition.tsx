'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fr } from '@/lib/i18n'
import { LONGUEUR_MAX } from '@/lib/commandes/expedition-regles'
import { actionMarquerExpediee } from './actions'

// « Marquer comme expédiée » (story 8.2, FR-22, OQ-5) : transporteur, numéro de suivi et, au-dessus du seuil
// d'assurance (`assurance`, décidé par le serveur), case « envoi assuré avec preuve de livraison » et
// référence. État local sans `useFormState`, garde `useRef` contre le double appui, résumé des erreurs en
// tête (focus), résultat annoncé dans une région `role="status"`, page relue ensuite (`router.refresh()`) : le
// serveur décide de tout, ce composant ne fait que saisir. Saisie conservée en cas d'erreur.

const t = fr.commandesArtiste.expedition
const CHAMP = 'mt-1 block min-h-touch-target w-full rounded-sm border border-neutral-500 bg-transparent px-3 font-sans text-input text-foreground'
const BOUTON = 'min-h-touch-target rounded-sm px-5 font-sans text-button disabled:opacity-40'

type Erreurs = Partial<Record<'transporteur' | 'numeroSuivi' | 'envoiAssure' | 'referenceAssurance', string>>

export function FormulaireExpedition({ numero, assurance, seuil, expediee = false }: { numero: string; assurance: boolean; seuil: string; expediee?: boolean }) {
  const router = useRouter()
  const occupe = useRef(false)
  const resume = useRef<HTMLDivElement>(null)
  const statut = useRef<HTMLDivElement>(null)
  const [transporteur, setTransporteur] = useState('')
  const [numeroSuivi, setNumeroSuivi] = useState('')
  const [envoiAssure, setEnvoiAssure] = useState(false)
  const [reference, setReference] = useState('')
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [fait, setFait] = useState(false)
  const nombre = Object.keys(erreurs).length

  useEffect(() => {
    if (nombre > 0) resume.current?.focus()
  }, [nombre, erreurs])

  useEffect(() => {
    if (message && nombre === 0) statut.current?.focus()
  }, [message, nombre, expediee])

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    if (occupe.current || fait) return
    occupe.current = true
    setEnCours(true)
    setMessage(null)
    try {
      const r = await actionMarquerExpediee(numero, { transporteur, numeroSuivi, envoiAssure, referenceAssurance: reference })
      setMessage(r.message)
      setErreurs(r.erreurs ?? {})
      if (r.ok) {
        setFait(true)
        router.refresh()
      }
    } catch {
      setErreurs({})
      setMessage(t.erreurs.indisponible)
    } finally {
      occupe.current = false
      setEnCours(false)
    }
  }

  const champs: { id: keyof Erreurs; libelle: string }[] = [
    { id: 'transporteur', libelle: t.transporteur },
    { id: 'numeroSuivi', libelle: t.numeroSuivi },
  ]

  // Commande expédiée (page relue) : le formulaire disparaît, l'annonce du résultat reste dans la même région.
  if (expediee) {
    return (
      <div role="status" aria-live="polite" tabIndex={-1} ref={statut}>
        {message && <p className="font-sans text-sm text-foreground">{message}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={envoyer} noValidate aria-labelledby="titre-expedition" className="rounded-sm border border-neutral-500 p-4">
      <h2 id="titre-expedition" className="font-sans text-xs uppercase tracking-[0.2em] text-neutral-600">
        {t.titre}
      </h2>
      <p className="mt-2 font-sans text-sm text-foreground">{t.intro}</p>
      <div ref={resume} tabIndex={-1} role="alert" className={nombre > 0 ? 'mt-3 rounded-sm border border-foreground p-3' : undefined}>
        {nombre > 0 && (
          <>
            <p className="font-sans text-sm font-medium text-foreground">{message}</p>
            <ul className="mt-1 list-disc ps-5 font-sans text-sm text-foreground">
              {(Object.keys(erreurs) as (keyof Erreurs)[]).map((c) => (
                <li key={c}>
                  <a href={`#expedition-${c}`}>{erreurs[c]}</a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {champs.map(({ id, libelle }) => (
        <div key={id} className="mt-4">
          <label htmlFor={`expedition-${id}`} className="font-sans text-sm text-foreground">
            {libelle}
          </label>
          <input
            id={`expedition-${id}`}
            name={id}
            type="text"
            autoComplete="off"
            maxLength={LONGUEUR_MAX}
            value={id === 'transporteur' ? transporteur : numeroSuivi}
            onChange={(ev) => (id === 'transporteur' ? setTransporteur(ev.target.value) : setNumeroSuivi(ev.target.value))}
            aria-invalid={erreurs[id] ? true : undefined}
            aria-describedby={erreurs[id] ? `expedition-${id}-erreur` : undefined}
            className={CHAMP}
          />
          {erreurs[id] && (
            <p id={`expedition-${id}-erreur`} className="mt-1 font-sans text-sm text-foreground">
              {erreurs[id]}
            </p>
          )}
        </div>
      ))}
      {assurance && (
        <fieldset className="mt-4">
          <legend className="font-sans text-sm text-foreground">{t.assuranceIntro(seuil)}</legend>
          <label htmlFor="expedition-envoiAssure" className="mt-2 flex min-h-touch-target items-center gap-3 font-sans text-sm text-foreground">
            <input
              id="expedition-envoiAssure"
              type="checkbox"
              checked={envoiAssure}
              onChange={(ev) => setEnvoiAssure(ev.target.checked)}
              aria-invalid={erreurs.envoiAssure ? true : undefined}
              aria-describedby={erreurs.envoiAssure ? 'expedition-envoiAssure-erreur' : undefined}
              className="h-5 w-5"
            />
            {t.assuranceCase}
          </label>
          {erreurs.envoiAssure && (
            <p id="expedition-envoiAssure-erreur" className="font-sans text-sm text-foreground">
              {erreurs.envoiAssure}
            </p>
          )}
          <div className="mt-2">
            <label htmlFor="expedition-referenceAssurance" className="font-sans text-sm text-foreground">
              {t.reference}
            </label>
            <input
              id="expedition-referenceAssurance"
              name="referenceAssurance"
              type="text"
              autoComplete="off"
              maxLength={LONGUEUR_MAX}
              value={reference}
              onChange={(ev) => setReference(ev.target.value)}
              aria-invalid={erreurs.referenceAssurance ? true : undefined}
              aria-describedby={erreurs.referenceAssurance ? 'expedition-referenceAssurance-erreur' : undefined}
              className={CHAMP}
            />
            {erreurs.referenceAssurance && (
              <p id="expedition-referenceAssurance-erreur" className="mt-1 font-sans text-sm text-foreground">
                {erreurs.referenceAssurance}
              </p>
            )}
          </div>
        </fieldset>
      )}
      <p className="mt-4 font-sans text-sm text-foreground">{t.definitif}</p>
      <div className="mt-2">
        <button type="submit" disabled={enCours || fait} className={`${BOUTON} bg-foreground text-neutral-200 fond-sombre`}>
          {enCours ? t.enCours : t.marquer}
        </button>
      </div>
      <div role="status" aria-live="polite" tabIndex={-1} ref={statut} className="mt-3">
        {message && nombre === 0 && <p className="font-sans text-sm text-foreground">{message}</p>}
      </div>
    </form>
  )
}
