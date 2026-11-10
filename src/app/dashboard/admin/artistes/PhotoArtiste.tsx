'use client'

import { useId, useRef, useState } from 'react'
import Image from 'next/image'
import { envoyerACloudinary } from '@/components/dashboard/envoiCloudinary'
import { refusFichierArtiste, type CiblePhotoArtiste } from '@/lib/curation/fiche-artiste-regles'
import { actionEnregistrerPhotoArtiste, actionPreparerEnvoiArtiste } from './actions'

// Envoi d'une photo d'artiste (story 3.11), extrait de FicheArtiste pour être testé dans un navigateur
// (tests/navigateur). Les photos partent du navigateur vers Cloudinary (signées par le serveur) ; en
// cas d'échec, l'ancienne photo reste.

export const MESSAGES_PHOTO_ARTISTE = {
  envoiRefuse: 'Envoi impossible : la photo n’a pas été envoyée. L’ancienne photo est conservée.',
  echec: 'Envoi impossible : réessayez. L’ancienne photo est conservée.',
} as const

export const LIBELLES_PHOTO_ARTISTE = { remplacer: 'Remplacer', ajouter: 'Ajouter une photo' } as const

export function PhotoArtiste({ artistId, nom, cible, libelle, urlInitiale }: { artistId: string; nom: string; cible: CiblePhotoArtiste; libelle: string; urlInitiale: string | null }) {
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
        setErreur(MESSAGES_PHOTO_ARTISTE.envoiRefuse)
        return
      }
      const r = await actionEnregistrerPhotoArtiste(artistId, cible, reponse)
      if (r.ok) setUrl(r.url)
      else setErreur(r.message)
    } catch {
      setErreur(MESSAGES_PHOTO_ARTISTE.echec)
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
        {url ? LIBELLES_PHOTO_ARTISTE.remplacer : LIBELLES_PHOTO_ARTISTE.ajouter}
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
