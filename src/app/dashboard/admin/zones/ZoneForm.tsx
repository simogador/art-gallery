'use client'

import { useMemo, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { LONGUEUR_MAX_NOM } from '@/lib/livraison/messages'
import { paysSansZone } from '@/lib/livraison/pays'
import {
  actionCreerZone,
  actionModifierZone,
  actionSupprimerZone,
  type EtatFormulaireZone,
} from './actions'

// Formulaire d'une zone (story 2.3) : nom et pays. Un pays d'une autre zone est grisé, avec le nom
// de cette zone. « Cocher tous les pays sans zone » ne fait que cocher : rien n'est enregistré
// avant « Enregistrer ».

type Props = {
  zone?: { id: string; nom: string; pays: string[] }
  /** Tous les pays, triés et nommés par le serveur : même rendu au serveur et à l'hydratation. */
  listePays: { code: string; nom: string }[]
  /** Pays des autres zones : code → nom de la zone. */
  autresZones: Record<string, string>
}

function sansAccent(texte: string): string {
  return texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function BoutonConfirmerSuppression() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[44px] px-4 bg-red-600 text-white rounded-sm font-sans text-xs uppercase tracking-widest disabled:opacity-40"
    >
      {pending ? 'Suppression…' : 'Confirmer la suppression'}
    </button>
  )
}

function BoutonEnregistrer() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[44px] px-6 bg-foreground text-background font-sans text-xs uppercase tracking-widest rounded-sm disabled:opacity-40"
    >
      {pending ? 'Enregistrement…' : 'Enregistrer'}
    </button>
  )
}

function Message({ etat }: { etat: EtatFormulaireZone }) {
  if (!etat) return null
  return (
    <p
      role={etat.ok ? 'status' : 'alert'}
      className={`font-sans text-sm px-4 py-3 border rounded-sm ${
        etat.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      {etat.message}
    </p>
  )
}

export function ZoneForm({ zone, listePays, autresZones }: Props) {
  const action = zone ? actionModifierZone.bind(null, zone.id) : actionCreerZone
  const [etat, envoyer] = useFormState(action, null)
  const [coches, setCoches] = useState<Set<string>>(() => new Set(zone?.pays ?? []))
  const [filtre, setFiltre] = useState('')

  const recherche = sansAccent(filtre.trim())
  const visibles = useMemo(
    () =>
      new Set(
        listePays
          .filter((p) => !recherche || sansAccent(p.nom).includes(recherche) || p.code.toLowerCase() === recherche)
          .map((p) => p.code),
      ),
    [listePays, recherche],
  )
  const sansZone = paysSansZone(autresZones, coches)

  function basculer(code: string) {
    setCoches((avant) => {
      const apres = new Set(avant)
      if (apres.has(code)) apres.delete(code)
      else apres.add(code)
      return apres
    })
  }

  return (
    <div className="flex flex-col gap-10">
      <form action={envoyer} className="flex flex-col gap-6">

        <div className="flex flex-col gap-2 max-w-md">
          <label htmlFor="nom" className="font-sans text-xs uppercase tracking-widest text-neutral-600">
            Nom de la zone
          </label>
          <input
            id="nom"
            name="nom"
            required
            maxLength={LONGUEUR_MAX_NOM}
            defaultValue={zone?.nom}
            className="min-h-[44px] px-3 border border-neutral-300 rounded-sm font-sans text-sm"
          />
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="font-sans text-xs uppercase tracking-widest text-neutral-600 mb-2">
            Pays de la zone ({coches.size})
          </legend>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="filtre-pays" className="font-sans text-xs text-neutral-500">
                Filtrer la liste
              </label>
              <input
                id="filtre-pays"
                type="search"
                value={filtre}
                onChange={(e) => setFiltre(e.target.value)}
                className="min-h-[44px] px-3 border border-neutral-300 rounded-sm font-sans text-sm w-64"
              />
            </div>
            <button
              type="button"
              onClick={() => setCoches((avant) => new Set([...avant, ...sansZone]))}
              disabled={sansZone.length === 0}
              className="min-h-[44px] px-4 border border-neutral-300 rounded-sm font-sans text-xs uppercase tracking-widest text-neutral-700 hover:border-foreground disabled:opacity-40"
            >
              Cocher tous les pays sans zone ({sansZone.length})
            </button>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 border border-neutral-200 rounded-sm p-3 max-h-[28rem] overflow-y-auto">
            {listePays.map(({ code, nom }) => {
              const ailleurs = autresZones[code]
              return (
                <li key={code} className={visibles.has(code) ? '' : 'hidden'}>
                  <label
                    className={`flex items-center gap-3 min-h-[44px] font-sans text-sm ${
                      ailleurs ? 'text-neutral-400' : 'text-neutral-700 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="pays"
                      value={code}
                      checked={coches.has(code)}
                      disabled={Boolean(ailleurs)}
                      onChange={() => basculer(code)}
                      className="h-5 w-5"
                    />
                    <span>
                      {nom}
                      {ailleurs && <span className="text-xs"> — {ailleurs}</span>}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          {visibles.size === 0 && <p className="font-sans text-sm text-neutral-500">Aucun pays ne correspond.</p>}
        </fieldset>

        {/* Message près du bouton : visible sans remonter après un enregistrement. */}
        <Message etat={etat} />
        <div>
          <BoutonEnregistrer />
        </div>
      </form>

      {zone && <Suppression id={zone.id} />}
    </div>
  )
}

function Suppression({ id }: { id: string }) {
  const [etat, envoyer] = useFormState(actionSupprimerZone.bind(null, id), null)
  const [confirmer, setConfirmer] = useState(false)

  return (
    <section className="border-t border-neutral-200 pt-6 flex flex-col gap-3 max-w-xl">
      <h2 className="font-sans text-xs uppercase tracking-widest text-neutral-600">Supprimer la zone</h2>
      <Message etat={etat} />
      {confirmer ? (
        <form action={envoyer} className="flex flex-wrap items-center gap-3">
          <p className="font-sans text-sm text-neutral-600 w-full">
            La zone et sa liste de pays seront supprimées. Les pays redeviendront sans zone.
          </p>
          <button
            type="button"
            onClick={() => setConfirmer(false)}
            className="min-h-[44px] px-4 border border-neutral-300 rounded-sm font-sans text-xs uppercase tracking-widest"
          >
            Annuler
          </button>
          <BoutonConfirmerSuppression />
        </form>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setConfirmer(true)}
            className="min-h-[44px] px-4 border border-red-200 text-red-600 rounded-sm font-sans text-xs uppercase tracking-widest"
          >
            Supprimer la zone
          </button>
        </div>
      )}
    </section>
  )
}
