'use client'

import Link from 'next/link'
import { useFormState, useFormStatus } from 'react-dom'
import { LONGUEUR_MIN_MOT_DE_PASSE } from '@/lib/acces/regles'
import { actionActiver, type EtatActivation } from './actions'

// Formulaire d'activation (story 2.4) : e-mail prérempli en lecture seule, mot de passe, charte.
// Les erreurs sont reliées à leur champ (aria-describedby).

type Props = { email: string; charte: { titre: string; texte: string }[] }

function BoutonCreer() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[44px] px-6 bg-foreground text-background font-sans text-xs uppercase tracking-widest rounded-sm disabled:opacity-40"
    >
      {pending ? 'Création…' : 'Créer mon accès'}
    </button>
  )
}

const CHAMP = 'min-h-[44px] px-3 border border-neutral-500 rounded-sm font-sans text-base'
const LIBELLE = 'font-sans text-xs uppercase tracking-widest text-neutral-600'

export function FormulaireActivation({ email, charte }: Props) {
  const [etat, envoyer] = useFormState(actionActiver, null as EtatActivation)
  const erreur = (champ: 'motDePasse' | 'confirmation' | 'charte') => (etat?.champ === champ ? etat.message : null)

  if (etat?.cree) {
    return (
      <div role="status" className="flex flex-col items-start gap-4">
        <p className="font-sans text-sm text-neutral-700">{etat.message}</p>
        <Link
          href="/auth/connexion"
          className="inline-flex items-center min-h-[44px] px-6 bg-foreground text-background font-sans text-xs uppercase tracking-widest rounded-sm"
        >
          Se connecter
        </Link>
      </div>
    )
  }

  if (etat?.expire) {
    return (
      <p role="alert" className="font-sans text-sm text-red-700">
        {etat.message} Rechargez la page pour écrire à l&apos;équipe.
      </p>
    )
  }

  return (
    <form action={envoyer} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className={LIBELLE}>E-mail</label>
        <input id="email" type="email" value={email} readOnly autoComplete="username" className={`${CHAMP} bg-neutral-100 text-neutral-600`} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="motDePasse" className={LIBELLE}>Mot de passe ({LONGUEUR_MIN_MOT_DE_PASSE} caractères au moins)</label>
        <input
          id="motDePasse"
          name="motDePasse"
          type="password"
          required
          minLength={LONGUEUR_MIN_MOT_DE_PASSE}
          autoComplete="new-password"
          aria-invalid={Boolean(erreur('motDePasse'))}
          aria-describedby={erreur('motDePasse') ? 'erreur-motDePasse' : undefined}
          className={CHAMP}
        />
        {erreur('motDePasse') && <p id="erreur-motDePasse" className="font-sans text-xs text-red-700">{erreur('motDePasse')}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirmation" className={LIBELLE}>Confirmez le mot de passe</label>
        <input
          id="confirmation"
          name="confirmation"
          type="password"
          required
          autoComplete="new-password"
          aria-invalid={Boolean(erreur('confirmation'))}
          aria-describedby={erreur('confirmation') ? 'erreur-confirmation' : undefined}
          className={CHAMP}
        />
        {erreur('confirmation') && <p id="erreur-confirmation" className="font-sans text-xs text-red-700">{erreur('confirmation')}</p>}
      </div>

      <section aria-labelledby="titre-charte" className="border border-neutral-200 rounded-sm p-4 max-h-80 overflow-y-auto" tabIndex={0}>
        <h2 id="titre-charte" className="font-serif text-xl font-light text-foreground mb-3">Charte artiste</h2>
        <ol className="flex flex-col gap-3 list-decimal ps-5">
          {charte.map((article) => (
            <li key={article.titre} className="font-sans text-sm text-neutral-700">
              <strong className="font-medium">{article.titre}.</strong> {article.texte}
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-col gap-2">
        <label className="flex items-start gap-3 min-h-[44px] font-sans text-sm text-neutral-700 cursor-pointer">
          <input
            type="checkbox"
            name="charte"
            value="oui"
            aria-invalid={Boolean(erreur('charte'))}
            aria-describedby={erreur('charte') ? 'erreur-charte' : undefined}
            className="h-5 w-5 mt-0.5"
          />
          <span>J&apos;ai lu et j&apos;accepte la charte artiste.</span>
        </label>
        {erreur('charte') && <p id="erreur-charte" className="font-sans text-xs text-red-700">{erreur('charte')}</p>}
      </div>

      {etat && !etat.champ && (
        <p role="alert" className="font-sans text-sm text-red-700">{etat.message}</p>
      )}

      <div>
        <BoutonCreer />
      </div>
    </form>
  )
}
