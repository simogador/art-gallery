'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fr } from '@/lib/i18n'
import type { BilanAnnonce } from '@/lib/notifications'
import { actionAnnoncerOuverture, actionEssaiOuverture } from './actions'

// Commandes de l'annonce de l'ouverture (story 4.9) : envoi d'essai, puis envoi aux contacts en deux
// temps (« Annoncer l'ouverture » demande confirmation, « Envoyer à N personnes » envoie ce N précis).
// Extrait de la page pour être testé dans un navigateur (tests/navigateur). Pas de `useFormState` ni
// de transition : un état local et une garde contre le double appui. Une seule région `aria-live`,
// toujours présente, annonce les résultats ; le focus suit le geste (confirmation, puis bilan).

const BOUTON = 'min-h-touch-target rounded-sm border px-5 font-sans text-xs uppercase tracking-widest disabled:opacity-40'

export function AnnonceOuverture({ nombre }: { nombre: number }) {
  const o = fr.ouverture
  const router = useRouter()
  const occupe = useRef(false)
  const boutonConfirmer = useRef<HTMLButtonElement>(null)
  const titreBilan = useRef<HTMLHeadingElement>(null)
  const [n, setN] = useState(nombre)
  const [enCours, setEnCours] = useState<'essai' | 'envoi' | null>(null)
  const [confirmation, setConfirmation] = useState(false)
  const [essai, setEssai] = useState<string | null>(null)
  const [refus, setRefus] = useState<string | null>(null)
  const [bilan, setBilan] = useState<BilanAnnonce | null>(null)

  // Le serveur recharge le nombre après un envoi (`router.refresh()`).
  useEffect(() => setN(nombre), [nombre])
  useEffect(() => {
    if (confirmation) boutonConfirmer.current?.focus()
  }, [confirmation])
  useEffect(() => {
    if (bilan || refus) titreBilan.current?.focus()
  }, [bilan, refus])

  async function lancer(quoi: 'essai' | 'envoi', travail: () => Promise<void>) {
    if (occupe.current) return
    occupe.current = true
    setEnCours(quoi)
    try {
      await travail()
    } catch {
      if (quoi === 'essai') setEssai(o.refus.indisponible)
      else setRefus(o.refus.indisponible)
    } finally {
      occupe.current = false
      setEnCours(null)
      if (quoi === 'envoi') router.refresh()
    }
  }

  const essayer = () =>
    lancer('essai', async () => {
      setEssai(null)
      const resultat = await actionEssaiOuverture()
      setEssai(resultat.ok ? (resultat.reel ? o.essai.envoye : o.essai.horsProduction) : resultat.message)
    })

  const envoyer = () => {
    const confirme = n
    return lancer('envoi', async () => {
      setConfirmation(false)
      setRefus(null)
      setBilan(null)
      const resultat = await actionAnnoncerOuverture(confirme)
      if (resultat.ok) {
        setBilan(resultat.bilan)
        setN(resultat.bilan.restants)
      } else setRefus(resultat.message)
    })
  }

  return (
    <div>
      <section className="mt-8" aria-labelledby="ouverture-essai">
        <h2 id="ouverture-essai" className="font-serif text-xl text-foreground">
          {o.essai.titre}
        </h2>
        <p className="mt-1 font-sans text-sm text-neutral-600">{o.essai.texte}</p>
        <button type="button" disabled={enCours !== null} onClick={essayer} className={`${BOUTON} mt-3 border-neutral-200 text-foreground hover:border-foreground`}>
          {o.essai.bouton}
        </button>
      </section>

      <section className="mt-10" aria-labelledby="ouverture-envoi">
        <h2 id="ouverture-envoi" className="font-serif text-xl text-foreground">
          {o.envoi.titre}
        </h2>
        {n === 0 ? (
          <p className="mt-2 font-sans text-base text-foreground">{o.vide}</p>
        ) : confirmation ? (
          <div className="mt-2">
            <p className="font-sans text-base text-foreground">{o.envoi.confirmation(n)}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button ref={boutonConfirmer} type="button" disabled={enCours !== null} onClick={envoyer} className={`${BOUTON} border-foreground bg-foreground text-background`}>
                {o.envoi.confirmer(n)}
              </button>
              <button type="button" disabled={enCours !== null} onClick={() => setConfirmation(false)} className={`${BOUTON} border-neutral-200 text-foreground hover:border-foreground`}>
                {o.envoi.annuler}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={enCours !== null}
            onClick={() => {
              setBilan(null)
              setRefus(null)
              setConfirmation(true)
            }}
            className={`${BOUTON} mt-3 border-foreground bg-foreground text-background`}
          >
            {o.envoi.bouton}
          </button>
        )}
      </section>

      <div aria-live="polite" className="mt-6">
        {enCours === 'essai' && <p className="font-sans text-sm text-neutral-600">{o.essai.enCours}</p>}
        {enCours === 'envoi' && <p className="font-sans text-sm text-neutral-600">{o.envoi.enCours}</p>}
        {essai && <p className="font-sans text-sm text-foreground">{essai}</p>}
        {refus && (
          <div>
            <h3 ref={titreBilan} tabIndex={-1} className="sr-only">
              {o.bilan.titre}
            </h3>
            <p className="font-sans text-sm text-foreground">{refus}</p>
          </div>
        )}
        {bilan && (
          <div className="rounded-sm border border-neutral-200 p-4">
            <h3 ref={titreBilan} tabIndex={-1} className="font-serif text-lg text-foreground">
              {o.bilan.titre}
            </h3>
            <ul className="mt-2 font-sans text-sm text-foreground">
              <li>{o.bilan.prevenus(bilan.prevenus)}</li>
              <li>{o.bilan.echecs(bilan.echecs)}</li>
              <li>{o.bilan.restants(bilan.restants)}</li>
            </ul>
            {bilan.aSupprimer > 0 && <p className="mt-2 font-sans text-sm text-foreground">{o.bilan.aSupprimer(bilan.aSupprimer)}</p>}
            {bilan.arretEchecs && <p className="mt-2 font-sans text-sm text-foreground">{o.bilan.arret}</p>}
            {bilan.restants > 0 && <p className="mt-2 font-sans text-xs text-neutral-600">{o.bilan.relancer}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
