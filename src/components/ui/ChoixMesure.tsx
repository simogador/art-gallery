'use client'

import { useEffect, useRef, useState } from 'react'
import { fr } from '@/lib/i18n'
import { EVENEMENT_GERER_MESURE, ROUTE_MESURE } from '@/lib/mesure/client'
import type { ChoixConsentement } from '@/lib/mesure/regles'
import { Button } from './Button'

// Story 4.8 (NFR-6) : choix de la mesure de la fréquentation. Bannière non bloquante (aucun fond
// grisé, aucune fenêtre surgissante, aucun piège du focus) avec « Accepter » et « Refuser » également
// visibles. Le choix est conservé par le serveur (cookie d'un an) ; `choix` est celui qu'il a lu. Le
// lien « Gérer la mesure » du pied de page (`BoutonGererMesure`) rouvre la bannière. Sans choix, rien
// n'est mesuré : le serveur relit le cookie à chaque événement. Aucun SDK de mesure ici : le
// navigateur ne parle qu'à `/api/mesure`.

type Arrivee = { utm: string | null; referent: string }

/** Vrai seulement si le serveur a répondu « ok » : le choix n'est enregistré (cookie posé) qu'alors. */
async function envoyer(corps: Record<string, unknown>): Promise<boolean> {
  try {
    const reponse = await fetch(ROUTE_MESURE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    })
    return reponse.ok
  } catch {
    return false
  }
}

// Hauteur de la bannière publiée pour les éléments fixes du bas de page (barre d'actions de la fiche).
const VARIABLE_HAUTEUR = '--hauteur-banniere'

export function ChoixMesure({ choix }: { choix: ChoixConsentement | null }) {
  const t = fr.mesure
  const [ouvert, setOuvert] = useState(choix === null)
  const [annonce, setAnnonce] = useState('')
  const [echec, setEchec] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const region = useRef<HTMLElement>(null)
  const retour = useRef<HTMLElement | null>(null)
  const demandeFocus = useRef(false)
  // Source d'arrivée : lue une fois, à l'arrivée sur le site (le layout reste monté ensuite), gardée
  // en mémoire seulement et envoyée au serveur après consentement (adresse du référent : domaine retenu côté serveur).
  const arrivee = useRef<Arrivee>({ utm: null, referent: '' })

  useEffect(() => {
    arrivee.current = {
      utm: new URLSearchParams(window.location.search).get('utm_source'),
      referent: document.referrer,
    }
    // Consentement déjà donné : le serveur garde l'identifiant et la source de la visite (sans effet s'ils y sont déjà).
    if (choix === 'accepte') void envoyer({ type: 'arrivee', ...arrivee.current })
    // Une seule fois, à l'arrivée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const rouvrir = () => {
      retour.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      demandeFocus.current = true
      setOuvert(true)
    }
    window.addEventListener(EVENEMENT_GERER_MESURE, rouvrir)
    return () => window.removeEventListener(EVENEMENT_GERER_MESURE, rouvrir)
  }, [])

  // Bannière rouverte à la demande du visiteur : le focus s'y pose ; la bannière du premier passage ne le prend jamais.
  useEffect(() => {
    if (ouvert && demandeFocus.current) {
      demandeFocus.current = false
      region.current?.focus()
    }
  }, [ouvert])

  // La bannière publie sa hauteur (variable CSS de la page) tant qu'elle est ouverte, puis la retire.
  useEffect(() => {
    const el = region.current
    if (!ouvert || !el) return
    const racine = document.documentElement
    const publier = () => racine.style.setProperty(VARIABLE_HAUTEUR, `${el.getBoundingClientRect().height}px`)
    publier()
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(publier) : null
    obs?.observe(el)
    return () => {
      obs?.disconnect()
      racine.style.removeProperty(VARIABLE_HAUTEUR)
    }
  }, [ouvert])

  // Le choix n'est annoncé et la bannière fermée qu'une fois enregistré par le serveur ; sinon elle reste ouverte.
  async function choisir(nouveau: ChoixConsentement) {
    if (enCours) return
    setEnCours(true)
    setEchec(false)
    const ok = await envoyer({ type: 'consentement', choix: nouveau, ...arrivee.current })
    setEnCours(false)
    if (!ok) {
      setEchec(true)
      return
    }
    setOuvert(false)
    setAnnonce(nouveau === 'accepte' ? t.enregistreAccepte : t.enregistreRefuse)
    const precedent = retour.current
    retour.current = null
    precedent?.focus()
  }

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {annonce}
      </p>
      {ouvert && (
        <section
          ref={region}
          tabIndex={-1}
          aria-labelledby="mesure-titre"
          className="fixed inset-x-0 bottom-0 z-40 max-h-[30vh] overflow-y-auto border-t border-neutral-200 bg-background px-4 py-4 text-foreground shadow-sm sm:px-8"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-3xl">
              <p id="mesure-titre" className="font-sans text-sm font-medium">
                {t.titre}
              </p>
              <p className="mt-1 font-sans text-sm text-neutral-600">{t.texte}</p>
              {echec && (
                <p role="alert" className="mt-1 font-sans text-sm text-foreground">
                  {t.echec}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:shrink-0">
              <Button type="button" variant="secondary" size="md" onClick={() => void choisir('accepte')}>
                {t.accepter}
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={() => void choisir('refuse')}>
                {t.refuser}
              </Button>
            </div>
          </div>
        </section>
      )}
    </>
  )
}

/** Lien « Gérer la mesure » du pied de page : rouvre la bannière (la page Cookies de l'Epic 7 le reprendra). */
export function BoutonGererMesure({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent(EVENEMENT_GERER_MESURE))}
    >
      {fr.mesure.gerer}
    </button>
  )
}
