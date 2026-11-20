'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fr } from '@/lib/i18n'
import { DESCRIPTION_RECLAMATION, MOTIFS_RECLAMATION, PHOTOS_RECLAMATION, type MotifReclamation } from '@/lib/commandes/reclamation-regles'
import { envoyerACloudinary } from '@/components/dashboard/envoiCloudinary'
import { preparerPhotoReclamation, signalerUnProbleme } from './actions'

// « Signaler un problème » (story 8.5, FR-30, FR-15) : formulaire (motif, description, 0 à 3 photos), confirmation en
// deux temps (une seule réclamation par commande, elle ne se modifie pas), garde anti double appui par `useRef`,
// résultat annoncé dans une région `role="status"` (gardée montée après la bascule), `router.refresh()` pour relire la
// commande. Sans `useFormState` (test navigateur). Les photos partent directement à Cloudinary, signées par le
// serveur après vérification du jeton de suivi ; l'action serveur ne reçoit que leurs réponses. Le numéro de
// commande est le seul identifiant envoyé : le passage vient du jeton du navigateur.
// `proposer` faux : le composant reste monté (message de succès) sans bouton ni formulaire ; `delaiEchu` : note neutre.
export function SignalerProbleme({ numero, proposer = true, delaiEchu = false }: { numero: string; proposer?: boolean; delaiEchu?: boolean }) {
  const t = fr.suivi.reclamation
  const router = useRouter()
  const garde = useRef(false)
  const premierChoix = useRef<HTMLInputElement>(null)
  const confirmer = useRef<HTMLButtonElement>(null)
  const [etape, setEtape] = useState<'repos' | 'formulaire' | 'confirmation' | 'envoi' | 'fini'>('repos')
  const [motif, setMotif] = useState<MotifReclamation | ''>('')
  const [description, setDescription] = useState('')
  const [fichiers, setFichiers] = useState<File[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (etape === 'formulaire') premierChoix.current?.focus()
    if (etape === 'confirmation') confirmer.current?.focus()
  }, [etape])

  // L'input de fichiers n'existe qu'à l'étape « formulaire » : en y revenant il est vide, la sélection retenue l'est aussi.
  function versFormulaire() {
    setFichiers([])
    setEtape('formulaire')
  }

  function choisirPhotos(liste: FileList | null) {
    const choisis = Array.from(liste ?? [])
    if (choisis.length > PHOTOS_RECLAMATION.max) return setErreur(t.erreurs.photosTrop)
    if (choisis.some((f) => !f.type.startsWith('image/'))) return setErreur(t.erreurs.photoType)
    if (choisis.some((f) => f.size > PHOTOS_RECLAMATION.octetsMax)) return setErreur(t.erreurs.photoPoids)
    setErreur(null)
    setFichiers(choisis)
  }

  function continuer() {
    if (motif === '') return setErreur(t.erreurs.motif)
    const texte = description.trim()
    if (texte === '') return setErreur(t.erreurs.descriptionRequise)
    if ([...texte].length < DESCRIPTION_RECLAMATION.min) return setErreur(t.erreurs.descriptionTropCourte)
    if ([...texte].length > DESCRIPTION_RECLAMATION.max) return setErreur(t.erreurs.descriptionTropLongue)
    setErreur(null)
    setEtape('confirmation')
  }

  async function envoyer() {
    if (garde.current) return
    garde.current = true
    setEtape('envoi')
    try {
      const reponses: unknown[] = []
      for (const fichier of fichiers) {
        const signature = await preparerPhotoReclamation(numero)
        if (!signature.ok) {
          setErreur(signature.message)
          versFormulaire()
          return
        }
        const reponse = await envoyerACloudinary(signature.envoi, fichier, () => undefined)
        if (!reponse) {
          setErreur(t.erreurs.photoEnvoi)
          versFormulaire()
          return
        }
        reponses.push(reponse)
      }
      const r = await signalerUnProbleme(numero, { motif, description, photos: reponses })
      if (r.ok) {
        setMessage(r.message)
        setErreur(null)
        setEtape('fini')
        router.refresh()
      } else {
        setErreur(r.message)
        versFormulaire()
      }
    } catch {
      setErreur(t.erreurs.indisponible)
      versFormulaire()
    } finally {
      garde.current = false
    }
  }

  const id = `reclamation-${numero}`
  const enFormulaire = proposer && (etape === 'formulaire' || etape === 'confirmation' || etape === 'envoi')
  return (
    <div>
      {proposer && etape === 'repos' && (
        <button
          type="button"
          onClick={() => setEtape('formulaire')}
          className="inline-flex min-h-touch-target items-center border border-foreground px-6 font-sans text-sm text-foreground hover:bg-neutral-100"
        >
          {t.bouton}
        </button>
      )}
      {enFormulaire && (
        <div>
          {etape === 'formulaire' && (
            <div>
              <h4 className="font-serif text-heading-sm text-foreground">{t.titre}</h4>
              <p className="mt-1 font-sans text-sm text-neutral-600">{t.aide}</p>
              <fieldset className="mt-3">
                <legend className="font-sans text-sm text-foreground">{t.motifLibelle}</legend>
                {MOTIFS_RECLAMATION.map((valeur, i) => (
                  <label key={valeur} className="mt-1 flex min-h-touch-target items-center gap-2 font-sans text-sm text-foreground">
                    <input
                      type="radio"
                      name={`${id}-motif`}
                      value={valeur}
                      ref={i === 0 ? premierChoix : undefined}
                      checked={motif === valeur}
                      onChange={() => setMotif(valeur)}
                    />
                    {t.motifs[valeur]}
                  </label>
                ))}
              </fieldset>
              <label htmlFor={`${id}-description`} className="mt-3 block font-sans text-sm text-foreground">
                {t.descriptionLibelle}
              </label>
              <p id={`${id}-description-aide`} className="font-sans text-sm text-neutral-600">
                {t.descriptionAide}
              </p>
              <textarea
                id={`${id}-description`}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-describedby={`${id}-description-aide`}
                className="mt-1 block w-full min-h-touch-target rounded-sm border border-neutral-500 bg-transparent px-3 py-2 font-sans text-input text-foreground"
              />
              <label htmlFor={`${id}-photos`} className="mt-3 block font-sans text-sm text-foreground">
                {t.photosLibelle}
              </label>
              <p id={`${id}-photos-aide`} className="font-sans text-sm text-neutral-600">
                {t.photosAide}
              </p>
              <input
                id={`${id}-photos`}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => choisirPhotos(e.target.files)}
                aria-describedby={`${id}-photos-aide`}
                className="mt-1 block font-sans text-sm text-foreground"
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={continuer}
                  className="inline-flex min-h-touch-target items-center border border-foreground px-6 font-sans text-sm text-foreground hover:bg-neutral-100"
                >
                  {t.continuer}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEtape('repos')
                    setErreur(null)
                  }}
                  className="inline-flex min-h-touch-target items-center border border-neutral-500 px-6 font-sans text-sm text-foreground hover:bg-neutral-100"
                >
                  {t.annuler}
                </button>
              </div>
            </div>
          )}
          {(etape === 'confirmation' || etape === 'envoi') && (
            <div>
              <p className="font-sans text-sm text-foreground">{t.question}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  ref={confirmer}
                  disabled={etape === 'envoi'}
                  onClick={envoyer}
                  className="inline-flex min-h-touch-target items-center border border-foreground px-6 font-sans text-sm text-foreground hover:bg-neutral-100 disabled:opacity-40"
                >
                  {etape === 'envoi' ? t.enCours : t.confirmer}
                </button>
                <button
                  type="button"
                  disabled={etape === 'envoi'}
                  onClick={versFormulaire}
                  className="inline-flex min-h-touch-target items-center border border-neutral-500 px-6 font-sans text-sm text-foreground hover:bg-neutral-100 disabled:opacity-40"
                >
                  {t.retour}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {erreur && (
        <p role="alert" className="mt-2 font-sans text-sm text-foreground">
          {erreur}
        </p>
      )}
      {!proposer && delaiEchu && <p className="font-sans text-sm text-neutral-600">{t.delaiEchu}</p>}
      <p role="status" className="mt-2 font-sans text-sm text-neutral-600">
        {message}
      </p>
    </div>
  )
}
