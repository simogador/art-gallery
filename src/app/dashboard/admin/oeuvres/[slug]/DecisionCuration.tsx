'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useFormState, useFormStatus } from 'react-dom'
import {
  CONTROLES_CURATION,
  controleComplet,
  LIMITES_COMMENTAIRE,
  validerCommentaire,
  type CodeControle,
} from '@/lib/curation/curation-regles'
import { longueur } from '@/lib/curation/depot-regles'
import { actionRenvoyer, actionValider, type EtatDecision } from '../actions'

// Liste de contrôle et décision de l'équipe sur une œuvre en curation (story 2.7). « Valider »
// reste indisponible tant que les quatre points ne sont pas cochés (le serveur le revérifie) ;
// « Renvoyer à l'artiste » exige un commentaire de 10 à 1 000 caractères.

function Bouton({ children, disabled, describedBy, principal }: {
  children: string
  disabled?: boolean
  describedBy?: string
  principal?: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-describedby={describedBy}
      className={`min-h-[44px] px-5 font-sans text-xs uppercase tracking-widest rounded-sm disabled:opacity-40 disabled:cursor-not-allowed ${
        principal ? 'bg-foreground text-background' : 'border border-neutral-400 text-foreground hover:border-foreground'
      }`}
    >
      {pending ? 'Enregistrement…' : children}
    </button>
  )
}

export function DecisionCuration({ slug, accordSigne }: { slug: string; accordSigne: boolean }) {
  const [coches, setCoches] = useState<CodeControle[]>([])
  const [commentaire, setCommentaire] = useState('')
  const [erreurLocale, setErreurLocale] = useState<string | null>(null)
  const [etatValider, valider] = useFormState(actionValider.bind(null, slug), null as EtatDecision)
  const [etatRenvoyer, renvoyer] = useFormState(actionRenvoyer.bind(null, slug), null as EtatDecision)

  const complet = controleComplet(coches)
  const basculer = (code: CodeControle, coche: boolean) =>
    setCoches((c) => (coche ? [...c.filter((x) => x !== code), code] : c.filter((x) => x !== code)))
  const erreurCommentaire = erreurLocale ?? etatRenvoyer?.erreurCommentaire ?? null

  return (
    <div className="flex flex-col gap-10">
      <form action={valider} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-1">
          <legend className="font-serif font-light text-foreground text-2xl mb-3">Liste de contrôle</legend>
          {CONTROLES_CURATION.map((c) => (
            <label key={c.code} className="flex items-center gap-3 min-h-[44px] font-sans text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                name="controle"
                value={c.code}
                checked={coches.includes(c.code)}
                onChange={(e) => basculer(c.code, e.currentTarget.checked)}
                className="w-5 h-5 accent-foreground"
              />
              {c.libelle}
            </label>
          ))}
        </fieldset>

        {!accordSigne && (
          <p className="font-sans text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-sm px-4 py-3 max-w-prose">
            Accord non signé : la validation sera refusée tant que la date de signature de l&apos;accord écrit de
            l&apos;artiste n&apos;est pas enregistrée.{' '}
            <Link href="/dashboard/admin/artistes" className="underline">
              Enregistrer l&apos;accord
            </Link>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Bouton principal disabled={!complet} describedBy={complet ? undefined : 'aide-valider'}>
            Valider
          </Bouton>
          {!complet && (
            <p id="aide-valider" className="font-sans text-xs text-neutral-600">
              Cochez les quatre points pour valider.
            </p>
          )}
        </div>
        {etatValider && (
          <p role="alert" className="font-sans text-sm text-red-700 max-w-prose">
            {etatValider.message}
          </p>
        )}
      </form>

      <form
        action={renvoyer}
        onSubmit={(e) => {
          const lu = validerCommentaire(commentaire)
          if (!lu.ok) {
            e.preventDefault()
            setErreurLocale(lu.erreur)
            document.getElementById('commentaire-renvoi')?.focus()
          }
        }}
        className="flex flex-col gap-3 border-t border-neutral-200 pt-8"
      >
        <h2 className="font-serif font-light text-foreground text-2xl">Renvoyer à l&apos;artiste</h2>
        {coches.map((code) => (
          <input key={code} type="hidden" name="controle" value={code} />
        ))}
        <label htmlFor="commentaire-renvoi" className="font-sans text-sm text-neutral-700">
          Commentaire pour l&apos;artiste (obligatoire, {LIMITES_COMMENTAIRE.min} à 1 000 caractères)
        </label>
        <p id="aide-commentaire" className="font-sans text-xs text-neutral-600 max-w-prose">
          L&apos;artiste le lira sur la fiche de son œuvre, qui redevient un brouillon modifiable. Aucun e-mail n&apos;est
          envoyé.
        </p>
        <textarea
          id="commentaire-renvoi"
          name="commentaire"
          rows={5}
          value={commentaire}
          onChange={(e) => {
            setCommentaire(e.currentTarget.value)
            setErreurLocale(null)
          }}
          aria-invalid={erreurCommentaire ? true : undefined}
          aria-describedby={['aide-commentaire', 'compte-commentaire', erreurCommentaire ? 'erreur-commentaire' : null]
            .filter(Boolean)
            .join(' ')}
          className="w-full max-w-prose px-3 py-2 border border-neutral-500 rounded-sm font-sans text-base"
        />
        <p id="compte-commentaire" className="font-sans text-xs text-neutral-500">
          {longueur(commentaire.trim())} / 1 000 caractères
        </p>
        {erreurCommentaire && (
          <p id="erreur-commentaire" role="alert" className="font-sans text-sm text-red-700">
            {erreurCommentaire}
          </p>
        )}
        {etatRenvoyer && !etatRenvoyer.erreurCommentaire && (
          <p role="alert" className="font-sans text-sm text-red-700 max-w-prose">
            {etatRenvoyer.message}
          </p>
        )}
        <div>
          <Bouton>Renvoyer à l&apos;artiste</Bouton>
        </div>
      </form>
    </div>
  )
}
