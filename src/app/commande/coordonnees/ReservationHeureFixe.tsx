'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { fr, formaterDate, formaterHeure, fuseauAppareil } from '@/lib/i18n'
import { reprendreReservation, type ReponseCoordonnees } from './actions'
import { MARQUE_ENVOI } from './marque'

// Réservation affichée en heure fixe (story 7.3, FR-12, UX-DR37), dans le fuseau de l'appareil : jamais de
// compte à rebours, jamais de couleur. « Œuvres réservées pour vous jusqu'à 15 h 42. » ; à l'échéance,
// « Votre réservation a pris fin à 15 h 42. » et, pour un passage de l'acheteur sans compte,
// « Continuer » retente la réservation du même passage. Jamais « terminée » d'après la seule horloge de
// l'appareil : à l'échéance locale, UN `router.refresh()` (un seul minuteur) ; seule la réponse du serveur
// (`echue`) change la phrase. Horloge en avance : la phrase d'attente reste. Le serveur ne connaît pas le
// fuseau : la phrase s'écrit après le montage (le jour « aujourd'hui » est lu une fois, au montage).

const t = fr.coordonnees
const DELAI_MAX_MS = 2 ** 31 - 1

type Props = {
  /** Échéance de la réservation (ISO). */
  echeance: string
  /** Le serveur juge la réservation terminée (fermée ou dépassée). */
  echue: boolean
  /** « Continuer » retente la réservation (passage de l'acheteur sans compte) ; absent pour une vente assistée. */
  reprise?: { titres: Record<string, string> }
  /** Lit la marque d'envoi pour placer le focus sur la phrase ; faux quand un autre composant s'en charge. */
  consommerMarque?: boolean
  children?: ReactNode
}

function phraseReservation(echeance: Date, echue: boolean, maintenant: Date, fuseau: string): string {
  const heure = formaterHeure(echeance, fuseau)
  const memeJour = formaterDate(echeance, { fuseau }) === formaterDate(maintenant, { fuseau })
  if (memeJour) return echue ? t.terminee(heure) : t.reservee(heure)
  const jour = formaterDate(echeance, { fuseau, annee: false })
  return echue ? t.termineeLeJour(jour, heure) : t.reserveeLeJour(jour, heure)
}

export function ReservationHeureFixe({ echeance, echue, reprise, consommerMarque = true, children }: Props) {
  const routeur = useRouter()
  const refresh = useRef(routeur.refresh)
  refresh.current = routeur.refresh
  const finMs = new Date(echeance).getTime()
  const [lecture, setLecture] = useState<{ maintenant: Date; fuseau: string } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const garde = useRef(false)
  const zone = useRef<HTMLDivElement>(null)

  useEffect(() => setLecture({ maintenant: new Date(), fuseau: fuseauAppareil() }), [])

  // Après un envoi ou une reprise réussis, le focus vient sur la phrase (une fois) et la marque est purgée.
  // Relancé à chaque nouvelle échéance : le composant survit au rafraîchissement de la page.
  useEffect(() => {
    if (!consommerMarque) return
    try {
      if (sessionStorage.getItem(MARQUE_ENVOI) === '1') {
        sessionStorage.removeItem(MARQUE_ENVOI)
        zone.current?.focus()
      }
    } catch {
      // Stockage indisponible : pas de focus déplacé.
    }
  }, [echeance, consommerMarque])

  // Bascule « terminée » reçue du serveur (même instance, `echue` passe de faux à vrai) : le focus vient sur la
  // phrase, dont la région `role="status"` annonce « Votre réservation a pris fin… ».
  const echuePrecedente = useRef(echue)
  useEffect(() => {
    if (!echuePrecedente.current && echue) zone.current?.focus()
    echuePrecedente.current = echue
  }, [echue])

  // Un seul minuteur, posé sur l'échéance : UN rafraîchissement pour demander son état au serveur. Les
  // dépendances sont des valeurs stables (chaîne, booléen) : aucun rendu ne le relance.
  useEffect(() => {
    if (echue) return
    const minuteur = setTimeout(() => refresh.current(), Math.min(Math.max(0, finMs - Date.now()), DELAI_MAX_MS))
    return () => clearTimeout(minuteur)
  }, [finMs, echue])

  async function continuer() {
    if (garde.current) return
    garde.current = true
    setEnCours(true)
    setMessage(null)
    let reussi = false
    try {
      const reponse: ReponseCoordonnees = await reprendreReservation()
      if (reponse.ok) {
        reussi = true
        try {
          sessionStorage.setItem(MARQUE_ENVOI, '1')
        } catch {
          // Sans stockage, seul le focus après la reprise s'en passe.
        }
        refresh.current()
      } else if (reponse.code === 'oeuvre_indisponible') {
        const titre = reprise?.titres[reponse.slug]
        setMessage(titre ? t.refus.oeuvreIndisponible(titre) : t.refus.oeuvreSansTitre)
      } else if (reponse.code === 'prix_change') {
        setMessage(t.refus.prixChange(reprise?.titres[reponse.slug] ?? fr.panier.oeuvreSansTitre))
      } else if (reponse.code === 'plafond_atteint') {
        setMessage(t.refus.plafond)
      } else if (reponse.code === 'ferme') {
        setMessage(t.refus.ferme)
      } else {
        setMessage(t.refus.indisponible)
      }
    } catch {
      setMessage(t.refus.indisponible)
    } finally {
      if (!reussi) {
        garde.current = false
        setEnCours(false)
      }
    }
  }

  // Réponse reçue : la nouvelle échéance (props) rend la main au bouton.
  useEffect(() => {
    garde.current = false
    setEnCours(false)
  }, [echeance])

  return (
    <div ref={zone} tabIndex={-1} className="focus:outline-none">
      <p role="status" className="font-sans text-base text-foreground">
        {lecture === null ? '' : phraseReservation(new Date(finMs), echue, lecture.maintenant, lecture.fuseau)}
      </p>
      {echue && reprise && (
        <div className="mt-4">
          <button
            type="button"
            onClick={continuer}
            disabled={enCours}
            className="min-h-touch-target rounded-sm border border-foreground bg-foreground px-8 py-3 font-sans text-sm font-medium text-background disabled:border-neutral-200 disabled:bg-neutral-200 disabled:text-neutral-600"
          >
            {enCours ? t.repriseEnCours : t.reprendre}
          </button>
        </div>
      )}
      {message && (
        <p role="alert" className="mt-3 font-sans text-sm text-red-700">
          {message}
        </p>
      )}
      {children}
    </div>
  )
}
