'use client'

import { useId, useRef, useState } from 'react'
import Image from 'next/image'
import { useFormState, useFormStatus } from 'react-dom'
import { envoyerACloudinary } from '@/components/dashboard/envoiCloudinary'
import {
  CIBLES_PHOTO_ARTISTE,
  refusFichierArtiste,
  LIBELLES_FICHE_ARTISTE,
  LIMITES_FICHE_ARTISTE,
  type CiblePhotoArtiste,
  type ChampFicheArtiste,
} from '@/lib/curation/fiche-artiste-regles'
import {
  actionEnregistrerFiche,
  actionEnregistrerPhotoArtiste,
  actionPreparerEnvoiArtiste,
  type EtatFiche,
} from './actions'

// Page publique d'un artiste (story 3.11, FR-19) : l'équipe renseigne biographie, démarche, formation,
// expositions, portrait et photo d'atelier. Les photos partent du navigateur vers Cloudinary (signées
// par le serveur) ; en cas d'échec, l'ancienne photo reste.

export type FicheLue = {
  bio: string
  statement: string | null
  formation: string | null
  expositions: string | null
  imageUrl: string | null
  atelierUrl: string | null
}

const AIDES: Record<ChampFicheArtiste, string> = {
  bio: 'Texte de présentation, affiché en tête de la page. Obligatoire.',
  statement: 'La démarche de l’artiste, avec ses mots. Facultative.',
  formation: 'Écoles, ateliers, maîtres. Facultative.',
  expositions: 'Une exposition par ligne, au choix de l’équipe. Facultative.',
}

const LIGNES: Record<ChampFicheArtiste, number> = { bio: 6, statement: 5, formation: 3, expositions: 4 }

function Bouton({ children }: { children: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[44px] px-4 border border-neutral-300 rounded-sm font-sans text-xs uppercase tracking-widest text-neutral-700 hover:border-foreground disabled:opacity-40"
    >
      {pending ? 'Enregistrement…' : children}
    </button>
  )
}

function PhotoArtiste({ artistId, nom, cible, libelle, urlInitiale }: { artistId: string; nom: string; cible: CiblePhotoArtiste; libelle: string; urlInitiale: string | null }) {
  const id = useId()
  const champ = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState(urlInitiale)
  const [progression, setProgression] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  async function choisir(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    // Refus avant envoi : type ou taille (rien ne part vers Cloudinary).
    const refus = refusFichierArtiste(fichier)
    if (refus) {
      setErreur(refus)
      return
    }
    setErreur(null)
    setProgression(0)
    try {
      const preparation = await actionPreparerEnvoiArtiste(artistId, cible)
      if (!preparation.ok) {
        setErreur(preparation.message)
        return
      }
      const reponse = await envoyerACloudinary(preparation.envoi, fichier, setProgression)
      if (!reponse) {
        setErreur('Envoi impossible : la photo n’a pas été envoyée. L’ancienne photo est conservée.')
        return
      }
      const r = await actionEnregistrerPhotoArtiste(artistId, cible, reponse)
      if (r.ok) setUrl(r.url)
      else setErreur(r.message)
    } catch {
      setErreur('Envoi impossible : réessayez. L’ancienne photo est conservée.')
    } finally {
      setProgression(null)
    }
  }

  return (
    <div className="flex flex-col gap-2" aria-busy={progression !== null}>
      <p className="font-sans text-sm text-foreground">{libelle}</p>
      <div className="relative w-40 aspect-[3/4] bg-neutral-100 rounded-sm overflow-hidden flex items-center justify-center">
        {url ? (
          <Image src={url} alt={`${libelle} de ${nom}`} fill sizes="160px" className="object-cover" />
        ) : (
          <span className="font-sans text-xs text-neutral-600">Aucune photo</span>
        )}
      </div>
      <input ref={champ} id={`${id}-fichier`} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={choisir} />
      <button
        type="button"
        onClick={() => champ.current?.click()}
        disabled={progression !== null}
        aria-describedby={erreur ? `${id}-erreur` : undefined}
        className="min-h-[44px] w-40 px-3 font-sans text-xs uppercase tracking-widest border border-foreground rounded-sm hover:bg-foreground hover:text-background disabled:opacity-40 disabled:cursor-wait"
      >
        {url ? 'Remplacer' : 'Ajouter une photo'}
        <span className="sr-only">{` : ${libelle} de ${nom}`}</span>
      </button>
      <p className="font-sans text-xs text-neutral-600" aria-live="polite">
        {progression !== null ? `Envoi en cours… ${progression} %` : ''}
      </p>
      {erreur && (
        <p id={`${id}-erreur`} role="alert" className="font-sans text-xs text-red-700">
          {erreur}
        </p>
      )}
    </div>
  )
}

export function FicheArtiste({ artistId, nom, fiche }: { artistId: string; nom: string; fiche: FicheLue }) {
  const [etat, envoyer] = useFormState(actionEnregistrerFiche.bind(null, artistId), null as EtatFiche)
  const id = `fiche-${artistId}`
  const erreur = etat && !etat.ok ? etat.message : null
  const valeurs: Record<ChampFicheArtiste, string> = {
    bio: fiche.bio,
    statement: fiche.statement ?? '',
    formation: fiche.formation ?? '',
    expositions: fiche.expositions ?? '',
  }
  const champs = Object.keys(LIBELLES_FICHE_ARTISTE) as ChampFicheArtiste[]

  return (
    <details className="border-t border-neutral-200 pt-3">
      <summary className="min-h-[44px] flex items-center cursor-pointer font-sans text-sm text-foreground">
        Page publique de {nom}
      </summary>
      <div className="mt-3 flex flex-col gap-6">
        <div className="flex flex-wrap gap-8">
          {CIBLES_PHOTO_ARTISTE.map(({ cible, libelle }) => (
            <PhotoArtiste
              key={cible}
              artistId={artistId}
              nom={nom}
              cible={cible}
              libelle={libelle}
              urlInitiale={cible === 'portrait' ? fiche.imageUrl : fiche.atelierUrl}
            />
          ))}
        </div>
        <form action={envoyer} className="flex flex-col gap-4">
          {champs.map((c) => (
            <div key={c} className="flex flex-col gap-1">
              <label htmlFor={`${id}-${c}`} className="font-sans text-sm text-foreground">
                {LIBELLES_FICHE_ARTISTE[c]}
              </label>
              <textarea
                id={`${id}-${c}`}
                name={c}
                rows={LIGNES[c]}
                maxLength={LIMITES_FICHE_ARTISTE[c]}
                required={c === 'bio'}
                defaultValue={valeurs[c]}
                aria-describedby={`${id}-${c}-aide`}
                className="w-full px-3 py-2 border border-neutral-500 rounded-sm font-sans text-base"
              />
              <p id={`${id}-${c}-aide`} className="font-sans text-xs text-neutral-600">
                {AIDES[c]}
              </p>
            </div>
          ))}
          <div>
            <Bouton>Enregistrer la page</Bouton>
          </div>
          {erreur && (
            <p role="alert" className="font-sans text-xs text-red-700">
              {erreur}
            </p>
          )}
          {etat?.ok && (
            <p role="status" className="font-sans text-xs text-green-800">
              {etat.message}
            </p>
          )}
        </form>
      </div>
    </details>
  )
}
