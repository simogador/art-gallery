'use client'

import { useCallback, useId, useRef, useState, useTransition } from 'react'
import { ConfirmSheet } from './ConfirmSheet'
import {
  actionAnnulerDeclaration,
  actionDeclarer,
  actionRemettreEnVente,
  type Retour,
} from '@/app/dashboard/artiste/oeuvres/disponibilite/actions'
import { LIBELLES_DECLARATION, type TypeDeclaration } from '@/lib/disponibilite/etats'

// `availability-picker` (story 2.8, FR-21) : l'artiste change la disponibilité d'une œuvre publiée en
// deux touches — « Changer la disponibilité » ouvre le choix « Vendue ailleurs » / « Retirer de la
// vente », puis la feuille de confirmation. Œuvre vendue : « Écrire à l'équipe » seulement. Œuvre
// retirée : « Remettre en vente » (retour en curation). Déclaration récente : « Annuler ».
// Les droits et transitions sont revérifiés par le serveur ; cibles de 44 px.

const BOUTON =
  'inline-flex items-center justify-center min-h-11 px-4 border border-neutral-300 rounded-sm font-sans text-xs uppercase tracking-widest text-foreground hover:border-foreground transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50'

export type AvailabilityPickerProps = {
  slug: string
  titre: string
  declarations: TypeDeclaration[]
  contactEquipe: boolean
  remiseEnVente: boolean
  /** Adresse de « Écrire à l'équipe » (CONTACT_EQUIPE). */
  contact: string
  /** Délai d'annulation en minutes, annoncé dans la feuille. */
  delaiAnnulationMinutes: number
  /** « Annuler » encore possible : heure limite lisible (« 10 h 27 »), sinon null. */
  annulableJusquA: string | null
  retour: Retour
}

type Choix = TypeDeclaration | 'remise'

const TITRES: Record<Choix, (t: string) => string> = {
  vendue_ailleurs: (t) => `Déclarer « ${t} » vendue ailleurs ?`,
  retiree: (t) => `Retirer « ${t} » de la vente ?`,
  remise: (t) => `Remettre « ${t} » en vente ?`,
}

export function AvailabilityPicker(p: AvailabilityPickerProps) {
  const [choixOuvert, setChoixOuvert] = useState(false)
  const [choix, setChoix] = useState<Choix | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, demarrer] = useTransition()
  const declencheur = useRef<HTMLElement | null>(null)
  const idChoix = useId()

  const ouvrir = (c: Choix, bouton: HTMLElement) => {
    declencheur.current = bouton
    setErreur(null)
    setChoix(c)
  }
  const fermer = useCallback(() => {
    setChoix(null)
    setErreur(null)
  }, [])
  const confirmer = () => {
    if (!choix) return
    demarrer(async () => {
      // En cas de succès, le serveur redirige (bandeau) : seul un refus revient ici.
      const r = choix === 'remise' ? await actionRemettreEnVente(p.slug) : await actionDeclarer(p.slug, choix, p.retour)
      if (r && !r.ok) setErreur(r.message)
    })
  }

  const vide = p.declarations.length === 0 && !p.contactEquipe && !p.remiseEnVente && !p.annulableJusquA
  if (vide) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {p.declarations.length > 0 && (
          <button
            type="button"
            className={BOUTON}
            aria-expanded={choixOuvert}
            aria-controls={choixOuvert ? idChoix : undefined}
            onClick={() => setChoixOuvert((o) => !o)}
          >
            Changer la disponibilité
          </button>
        )}
        {p.remiseEnVente && (
          <button type="button" className={BOUTON} onClick={(e) => ouvrir('remise', e.currentTarget)}>
            Remettre en vente
          </button>
        )}
        {p.contactEquipe && (
          <a
            className={BOUTON}
            href={`mailto:${p.contact}?subject=${encodeURIComponent(`Œuvre vendue : ${p.titre}`)}`}
          >
            Écrire à l&apos;équipe
          </a>
        )}
        {p.annulableJusquA && <BoutonAnnulerDeclaration slug={p.slug} retour={p.retour} jusqua={p.annulableJusquA} />}
      </div>

      {p.declarations.length > 0 && choixOuvert && (
        <div id={idChoix} role="group" aria-label={`Nouvelle disponibilité de « ${p.titre} »`} className="flex flex-wrap gap-2">
          {p.declarations.map((t) => (
            <button key={t} type="button" className={BOUTON} onClick={(e) => ouvrir(t, e.currentTarget)}>
              {LIBELLES_DECLARATION[t]}
            </button>
          ))}
        </div>
      )}

      <ConfirmSheet
        ouverte={choix !== null}
        titre={choix ? TITRES[choix](p.titre) : ''}
        enCours={enCours}
        erreur={erreur}
        onAnnuler={fermer}
        onConfirmer={confirmer}
        retourFocus={declencheur}
      >
        {choix === 'vendue_ailleurs' && (
          <p>
            Elle reste visible sur le site avec la mention « Vendue » et ne peut plus être commandée.
            Vous pourrez annuler pendant {p.delaiAnnulationMinutes} minutes.
          </p>
        )}
        {choix === 'retiree' && (
          <p>
            Elle disparaît du site : sa page renvoie vers votre page d&apos;artiste. Vous pourrez annuler pendant{' '}
            {p.delaiAnnulationMinutes} minutes, puis la remettre en vente en la renvoyant en curation.
          </p>
        )}
        {choix === 'remise' && (
          <p>
            Elle repasse en curation : l&apos;équipe Errancy la relit avant qu&apos;elle réapparaisse sur le site.
          </p>
        )}
      </ConfirmSheet>
    </div>
  )
}

/** « Annuler » la dernière déclaration, depuis le bandeau ou la fiche de l'œuvre. */
export function BoutonAnnulerDeclaration({
  slug,
  retour,
  jusqua,
  lien = false,
}: {
  slug: string
  retour: Retour
  /** Heure limite lisible, annoncée à côté du bouton (sauf dans le bandeau). */
  jusqua?: string
  /** Style de lien (bandeau). */
  lien?: boolean
}) {
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, demarrer] = useTransition()
  const idErreur = useId()
  const annuler = () =>
    demarrer(async () => {
      const r = await actionAnnulerDeclaration(slug, retour)
      if (r && !r.ok) setErreur(r.message)
    })
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={annuler}
        disabled={enCours}
        aria-describedby={erreur ? idErreur : undefined}
        className={
          lien
            ? 'min-h-11 px-1 font-sans text-sm underline underline-offset-4 text-foreground hover:text-neutral-600 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'
            : BOUTON
        }
      >
        {enCours ? 'Annulation…' : lien ? 'Annuler' : `Annuler (jusqu’à ${jusqua})`}
      </button>
      {erreur && (
        <span id={idErreur} role="alert" className="font-sans text-xs text-red-700">
          {erreur}
        </span>
      )}
    </span>
  )
}
