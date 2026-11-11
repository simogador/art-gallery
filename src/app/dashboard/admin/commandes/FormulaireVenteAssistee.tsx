'use client'

import { useRef, useState } from 'react'
import { CODES_PAYS, nomPays, trierParNom } from '@/lib/livraison/pays'
import { fr } from '@/lib/i18n'
import { actionPoserVenteAssistee, type SaisieFormulaireVente } from './actions'

// Formulaire de la vente assistée (story 6.3) : état local, garde contre le double appui, pas de
// `useFormState` (testé dans un navigateur, tests/navigateur). Le résumé des erreurs et le résultat sont
// annoncés (`role="alert"` / `role="status"`) ; la saisie est conservée après un refus.

const CHAMP = 'mt-1 block w-full min-h-touch-target rounded-sm border border-neutral-500 bg-transparent px-3 font-sans text-input text-foreground'
const LIBELLE = 'block font-sans text-sm text-foreground'
const AIDE = 'mt-1 font-sans text-xs text-neutral-600'
const ERREUR = 'mt-1 font-sans text-sm text-foreground'

type Erreurs = Partial<Record<'email' | 'nom' | 'oeuvres' | 'heures', string>>
const PAYS = trierParNom(CODES_PAYS)

export function FormulaireVenteAssistee({ heuresParDefaut }: { heuresParDefaut: number }) {
  const t = fr.venteAssistee
  const occupe = useRef(false)
  const [saisie, setSaisie] = useState<SaisieFormulaireVente>({ email: '', nom: '', pays: 'FR', oeuvres: '', heures: String(heuresParDefaut) })
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const [enCours, setEnCours] = useState(false)
  const [refus, setRefus] = useState<string | null>(null)
  const [succes, setSucces] = useState<{ message: string; envoye: boolean } | null>(null)

  const change = (champ: keyof SaisieFormulaireVente) => (e: { target: { value: string } }) =>
    setSaisie((s) => ({ ...s, [champ]: e.target.value }))

  async function envoyer(e: { preventDefault: () => void }) {
    e.preventDefault()
    if (occupe.current) return
    setSucces(null)
    setRefus(null)
    // Vérifications locales, le serveur revérifie tout.
    const locales: Erreurs = {}
    if (saisie.oeuvres.trim() === '') locales.oeuvres = t.erreurs.oeuvresManquantes
    if (saisie.heures.trim() !== '' && !/^\d+$/.test(saisie.heures.trim())) locales.heures = t.erreurs.heuresInvalides
    setErreurs(locales)
    if (Object.keys(locales).length > 0) return
    occupe.current = true
    setEnCours(true)
    try {
      const resultat = await actionPoserVenteAssistee(saisie)
      if (resultat.ok) {
        setSucces({ message: resultat.message, envoye: resultat.envoye })
        setSaisie((s) => ({ ...s, email: '', nom: '', oeuvres: '' }))
        setErreurs({})
      } else {
        setRefus(resultat.message)
        setErreurs({ email: resultat.erreurs?.email, nom: resultat.erreurs?.nom })
      }
    } catch {
      setRefus(t.refus.indisponible)
    } finally {
      occupe.current = false
      setEnCours(false)
    }
  }

  const nbErreurs = Object.values(erreurs).filter(Boolean).length

  return (
    <form onSubmit={envoyer} noValidate className="mt-8 max-w-xl space-y-6">
      {nbErreurs > 0 && (
        <p role="alert" className="font-sans text-sm text-foreground">
          {t.resume(nbErreurs)}
        </p>
      )}
      <div>
        <label htmlFor="vente-email" className={LIBELLE}>{t.champs.email}</label>
        <input id="vente-email" type="email" autoComplete="off" value={saisie.email} onChange={change('email')} aria-invalid={Boolean(erreurs.email)} aria-describedby={erreurs.email ? 'vente-email-erreur' : undefined} className={CHAMP} />
        {erreurs.email && <p id="vente-email-erreur" className={ERREUR}>{erreurs.email}</p>}
      </div>
      <div>
        <label htmlFor="vente-nom" className={LIBELLE}>{t.champs.nom}</label>
        <input id="vente-nom" type="text" autoComplete="off" value={saisie.nom} onChange={change('nom')} aria-invalid={Boolean(erreurs.nom)} aria-describedby={erreurs.nom ? 'vente-nom-erreur' : undefined} className={CHAMP} />
        {erreurs.nom && <p id="vente-nom-erreur" className={ERREUR}>{erreurs.nom}</p>}
      </div>
      <div>
        <label htmlFor="vente-pays" className={LIBELLE}>{t.champs.pays}</label>
        <select id="vente-pays" value={saisie.pays} onChange={change('pays')} className={CHAMP}>
          {PAYS.map((code) => (
            <option key={code} value={code}>{nomPays(code)}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="vente-oeuvres" className={LIBELLE}>{t.champs.oeuvres}</label>
        <textarea id="vente-oeuvres" rows={4} value={saisie.oeuvres} onChange={change('oeuvres')} aria-invalid={Boolean(erreurs.oeuvres)} aria-describedby={erreurs.oeuvres ? 'vente-oeuvres-aide vente-oeuvres-erreur' : 'vente-oeuvres-aide'} className={`${CHAMP} py-2`} />
        <p id="vente-oeuvres-aide" className={AIDE}>{t.champs.oeuvresAide}</p>
        {erreurs.oeuvres && <p id="vente-oeuvres-erreur" className={ERREUR}>{erreurs.oeuvres}</p>}
      </div>
      <div>
        <label htmlFor="vente-heures" className={LIBELLE}>{t.champs.heures}</label>
        <input id="vente-heures" type="text" inputMode="numeric" value={saisie.heures} onChange={change('heures')} aria-invalid={Boolean(erreurs.heures)} aria-describedby={erreurs.heures ? 'vente-heures-aide vente-heures-erreur' : 'vente-heures-aide'} className={CHAMP} />
        <p id="vente-heures-aide" className={AIDE}>{t.champs.heuresAide(heuresParDefaut)}</p>
        {erreurs.heures && <p id="vente-heures-erreur" className={ERREUR}>{erreurs.heures}</p>}
      </div>
      <button type="submit" disabled={enCours} className="min-h-touch-target rounded-sm border border-foreground bg-foreground px-6 font-sans text-button text-background disabled:opacity-40">
        {enCours ? t.envoiEnCours : t.envoyer}
      </button>
      <div role="status" aria-live="polite">
        {succes && <p className="font-sans text-sm text-foreground">{succes.message}</p>}
      </div>
      {refus && (
        <p role="alert" className="font-sans text-sm text-foreground">
          {refus}
        </p>
      )}
    </form>
  )
}
