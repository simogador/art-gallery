'use client'

import { useId, useRef, useState } from 'react'
import Image from 'next/image'
import { ID_CHAMP, refusFichier, type TypePhoto } from '@/lib/curation/depot-regles'

// `photo-slot` (UX-DR27, story 2.5) : une case légendée par prise de vue, une photo chacune.
// Ajout depuis l'appareil photo ou la galerie du téléphone (le sélecteur du système propose les
// deux), « Remplacer » sur une case remplie. L'état est toujours écrit, jamais porté par la couleur.

type Props = {
  type: TypePhoto
  legende: string
  obligatoire: boolean
  nature: 'image' | 'video'
  url: string | null
  /** Envoie le fichier (signature, envoi direct, vérification) ; renvoie un message d'erreur ou null. */
  envoyer: (type: TypePhoto, fichier: File, progression: (pourcent: number) => void) => Promise<string | null>
}

export function CasePhoto({ type, legende, obligatoire, nature, url, envoyer }: Props) {
  const id = useId()
  const champ = useRef<HTMLInputElement>(null)
  const [enCours, setEnCours] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  async function choisir(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    e.target.value = '' // même fichier choisi deux fois : l'événement doit se redéclencher
    if (!fichier) return
    // Refus avant envoi : type ou taille (rien ne part vers Cloudinary).
    const refus = refusFichier(type, fichier)
    if (refus) {
      setErreur(refus)
      return
    }
    setErreur(null)
    setEnCours(0)
    try {
      setErreur(await envoyer(type, fichier, setEnCours))
    } finally {
      setEnCours(null)
    }
  }

  const action = url ? 'Remplacer' : nature === 'video' ? 'Ajouter une vidéo' : 'Ajouter une photo'
  const etat = enCours !== null ? `Envoi en cours… ${enCours} %` : url ? 'Ajoutée' : obligatoire ? 'Obligatoire' : 'Facultative'

  return (
    <div
      className={`flex flex-col border rounded-sm p-2 ${url ? 'border-neutral-300' : obligatoire ? 'border-foreground border-dashed' : 'border-neutral-400 border-dashed'}`}
      aria-busy={enCours !== null}
    >
      <div className="relative aspect-square bg-neutral-100 rounded-sm overflow-hidden flex items-center justify-center">
        {url && nature === 'image' ? (
          <Image src={url} alt={`${legende} : photo ajoutée`} fill sizes="(min-width: 1024px) 220px, 45vw" className="object-cover" />
        ) : url ? (
          <video src={url} className="absolute inset-0 w-full h-full object-cover" muted playsInline preload="metadata" aria-label={`${legende} : vidéo ajoutée`} />
        ) : (
          <span aria-hidden="true" className="font-sans text-2xl text-neutral-400">+</span>
        )}
      </div>
      <p id={`${id}-legende`} className="font-sans text-sm text-foreground mt-2 leading-snug">{legende}</p>
      <p className="font-sans text-xs text-neutral-600 mt-0.5" aria-live="polite">{etat}</p>
      <input
        ref={champ}
        id={`${id}-fichier`}
        type="file"
        accept={nature === 'video' ? 'video/*' : 'image/*'}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={choisir}
      />
      <button
        id={ID_CHAMP.photo(type)}
        type="button"
        onClick={() => champ.current?.click()}
        disabled={enCours !== null}
        aria-label={`${action} : ${legende}`}
        aria-describedby={erreur ? `${id}-erreur` : undefined}
        className="mt-2 min-h-[44px] px-3 font-sans text-xs uppercase tracking-widest border border-foreground rounded-sm hover:bg-foreground hover:text-background transition-colors duration-200 disabled:opacity-40 disabled:cursor-wait"
      >
        {action}
      </button>
      {erreur && (
        <p id={`${id}-erreur`} role="alert" className="font-sans text-xs text-red-600 mt-2">
          Erreur : {erreur}
        </p>
      )}
    </div>
  )
}
