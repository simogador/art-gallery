'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { fr } from '@/lib/i18n'
import {
  erreurChampCoordonnees,
  type ChampCoordonnees,
  type EntreeCoordonnees,
  type ErreursCoordonnees,
} from '@/lib/commandes/coordonnees-regles'
import type { ReponseCoordonnees } from './actions'
import { MARQUE_ENVOI } from './marque'

// Formulaire des coordonnées sans compte (story 7.3, FR-10, UX-DR37), sur le modèle de `/conseil` et de la
// demande de visite : libellés visibles, `autocomplete`, validation à la sortie du champ et à l'envoi
// (jamais à la frappe), message sous le champ et résumé en tête, saisie conservée après erreur, garde
// `useRef` contre le double appui. L'adresse est obligatoire ici, le téléphone facultatif. Le serveur
// revérifie tout. Sans `useFormState` (testable dans le navigateur).

const t = fr.coordonnees

const ID: Record<ChampCoordonnees, string> = {
  email: 'coordonnees-email',
  nom: 'coordonnees-nom',
  adresse: 'coordonnees-adresse',
  telephone: 'coordonnees-telephone',
}

const CLASSE_CHAMP =
  'w-full min-h-touch-target rounded-sm border bg-transparent px-4 py-2.5 font-sans text-input text-foreground placeholder:text-neutral-500'

type Props = {
  /** Champs demandés, dans l'ordre : tous pour un acheteur du panier, adresse et téléphone pour un passage posé par l'équipe. */
  champs: readonly ChampCoordonnees[]
  envoyer: (saisie: EntreeCoordonnees) => Promise<ReponseCoordonnees>
  libelleEnvoi: string
  libelleEnCours: string
  /** Message d'un refus du serveur autre que les champs (œuvre prise, plafond…). */
  messageRefus: (reponse: Extract<ReponseCoordonnees, { ok: false }>) => string
  /** Appelé après un envoi réussi (rafraîchissement de la page). */
  surSucces: () => void
  /** Envoi impossible pour une raison déjà affichée (œuvre non livrée, monnaies mêlées) : id du texte qui l'explique. */
  blocage?: { explication: string; id: string } | null
  /** Délai après lequel un succès resté sans effet (cookies refusés, page non remplacée) réarme le bouton. */
  delaiRearmementMs?: number
}

export function FormulaireCoordonnees({ champs, envoyer, libelleEnvoi, libelleEnCours, messageRefus, surSucces, blocage, delaiRearmementMs = 8000 }: Props) {
  const [valeurs, setValeurs] = useState<EntreeCoordonnees>({ email: '', nom: '', adresse: '', telephone: '' })
  const [erreurs, setErreurs] = useState<ErreursCoordonnees>({})
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const enCours = useRef(false)
  const resume = useRef<HTMLDivElement>(null)
  const [refusCompte, setRefusCompte] = useState(0)

  useEffect(() => {
    if (refusCompte > 0) resume.current?.focus()
  }, [refusCompte])
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (minuteur.current) clearTimeout(minuteur.current)
  }, [])

  const options = { adresseObligatoire: true }
  const verifier = (champ: ChampCoordonnees) =>
    setErreurs((e) => {
      const { [champ]: _ancienne, ...autres } = e
      const erreur = erreurChampCoordonnees(champ, valeurs, options)
      return erreur ? { ...autres, [champ]: erreur } : autres
    })

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    // Double appui : un seul envoi à la fois (l'état React ne suffit pas entre deux clics rapprochés).
    if (enCours.current || blocage) return
    setMessage(null)
    const trouvees: ErreursCoordonnees = {}
    for (const champ of champs) {
      const erreur = erreurChampCoordonnees(champ, valeurs, options)
      if (erreur) trouvees[champ] = erreur
    }
    if (Object.keys(trouvees).length > 0) {
      setErreurs(trouvees)
      setRefusCompte((n) => n + 1)
      return
    }
    enCours.current = true
    setEnvoi(true)
    let reussi = false
    try {
      const reponse = await envoyer(valeurs)
      if (reponse.ok) {
        reussi = true
        setErreurs({})
        try {
          sessionStorage.setItem(MARQUE_ENVOI, '1')
        } catch {
          // Stockage indisponible (fenêtre privée) : seul le focus après l'envoi s'en passe.
        }
        surSucces()
        // Si la page n'a pas été remplacée (cookie refusé, réponse sans effet), le bouton est réarmé.
        minuteur.current = setTimeout(() => {
          enCours.current = false
          setEnvoi(false)
        }, delaiRearmementMs)
      } else if (reponse.code === 'invalide') {
        setErreurs(reponse.erreurs)
        setRefusCompte((n) => n + 1)
      } else {
        setMessage(messageRefus(reponse))
      }
    } catch {
      setMessage(t.refus.indisponible)
    } finally {
      // Un envoi réussi garde le bouton bloqué jusqu'au rafraîchissement de la page.
      if (!reussi) {
        enCours.current = false
        setEnvoi(false)
      }
    }
  }

  const fautifs = champs.filter((c) => erreurs[c])
  const classe = (champ: ChampCoordonnees) => `${CLASSE_CHAMP} ${erreurs[champ] ? 'border-red-600' : 'border-neutral-500'}`
  const decrit = (champ: ChampCoordonnees) =>
    [champ === 'adresse' ? `${ID.adresse}-aide` : undefined, erreurs[champ] ? `${ID[champ]}-erreur` : undefined].filter(Boolean).join(' ') || undefined
  const Erreur = ({ champ }: { champ: ChampCoordonnees }) =>
    erreurs[champ] ? (
      <p id={`${ID[champ]}-erreur`} className="mt-1.5 font-sans text-sm text-red-700">
        {erreurs[champ]}
      </p>
    ) : null

  const commun = (champ: ChampCoordonnees) => ({
    id: ID[champ],
    name: champ,
    value: valeurs[champ],
    onBlur: () => verifier(champ),
    'aria-invalid': erreurs[champ] ? (true as const) : undefined,
    'aria-describedby': decrit(champ),
    className: `mt-2 ${classe(champ)}`,
  })

  return (
    <form method="post" onSubmit={soumettre} noValidate className="flex flex-col gap-8" aria-busy={envoi}>
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

      {champs.includes('email') && (
        <div>
          <label htmlFor={ID.email} className="font-sans text-sm font-medium text-foreground">
            {t.champs.email.libelle}
          </label>
          <input {...commun('email')} type="email" autoComplete="email" onChange={(e) => setValeurs((v) => ({ ...v, email: e.target.value }))} />
          <Erreur champ="email" />
        </div>
      )}

      {champs.includes('nom') && (
        <div>
          <label htmlFor={ID.nom} className="font-sans text-sm font-medium text-foreground">
            {t.champs.nom.libelle}
          </label>
          <input {...commun('nom')} type="text" autoComplete="name" onChange={(e) => setValeurs((v) => ({ ...v, nom: e.target.value }))} />
          <Erreur champ="nom" />
        </div>
      )}

      {champs.includes('adresse') && (
        <div>
          <label htmlFor={ID.adresse} className="font-sans text-sm font-medium text-foreground">
            {t.champs.adresse.libelle}
          </label>
          <p id={`${ID.adresse}-aide`} className="mt-1 font-sans text-sm text-neutral-600">
            {t.champs.adresse.aide}
          </p>
          <textarea
            {...commun('adresse')}
            rows={3}
            autoComplete="street-address"
            onChange={(e) => setValeurs((v) => ({ ...v, adresse: e.target.value }))}
          />
          <Erreur champ="adresse" />
        </div>
      )}

      {champs.includes('telephone') && (
        <div>
          <label htmlFor={ID.telephone} className="font-sans text-sm font-medium text-foreground">
            {t.champs.telephone.libelle}
          </label>
          <input {...commun('telephone')} type="tel" autoComplete="tel" onChange={(e) => setValeurs((v) => ({ ...v, telephone: e.target.value }))} />
          <Erreur champ="telephone" />
        </div>
      )}

      {message && (
        <p role="alert" className="font-sans text-sm text-red-700">
          {message}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={envoi || Boolean(blocage)}
          aria-describedby={blocage?.id}
          className="min-h-touch-target rounded-sm border border-foreground bg-foreground px-8 py-3 font-sans text-sm font-medium text-background disabled:border-neutral-200 disabled:bg-neutral-200 disabled:text-neutral-600"
        >
          {envoi ? libelleEnCours : libelleEnvoi}
        </button>
        {blocage && (
          <p id={blocage.id} className="mt-3 font-sans text-sm text-neutral-600">
            {blocage.explication}
          </p>
        )}
      </div>
    </form>
  )
}
