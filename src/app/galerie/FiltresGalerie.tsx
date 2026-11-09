import Link from 'next/link'
import { Button } from '@/components/ui'
import { AMBIANCES, COULEURS_DOMINANTES } from '@/lib/curation/depot-regles'
import { FORMATS, ORIENTATIONS, TECHNIQUES, TRIS, type FiltresGalerie, type OptionsGalerie } from '@/lib/catalogue/filtres'
import { fr } from '@/lib/i18n'

// Filtres de la galerie (story 3.9, FR-17, UX-DR20) : « Modifier les filtres » est un formulaire
// GET natif (fonctionne sans JavaScript, l'adresse porte les filtres) ; chaque filtre actif est une
// puce-lien qui le retire. Composants serveur : les valeurs viennent de l'adresse déjà lue.

export type Puce = { cle: string; libelle: string; href: string }

const CHAMP = 'min-h-touch-target w-full text-input text-foreground bg-background border border-neutral-200 rounded-sm px-3'

function Liste({
  nom,
  libelle,
  valeur,
  vide,
  options,
}: {
  nom: string
  libelle: string
  valeur: string | undefined
  vide: string
  options: readonly { valeur: string; libelle: string }[]
}) {
  const id = `filtre-${nom}`
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-sans text-caption text-neutral-600">
        {libelle}
      </label>
      <select id={id} name={nom} defaultValue={valeur ?? ''} className={CHAMP}>
        <option value="">{vide}</option>
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
    </div>
  )
}

export function PucesFiltres({ puces }: { puces: Puce[] }) {
  if (puces.length === 0) return null
  return (
    <ul aria-label={fr.galerie.filtresActifs} className="flex flex-wrap gap-2">
      {puces.map((p) => (
        <li key={p.cle}>
          <Link
            href={p.href}
            aria-label={fr.galerie.retirer(p.libelle)}
            className="inline-flex min-h-touch-target items-center gap-2 rounded-sm border border-neutral-200 px-3 font-sans text-button text-foreground hover:border-foreground"
          >
            <span>{p.libelle}</span>
            <span aria-hidden="true">{fr.galerie.croix}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function FormulaireFiltres({ filtres, options }: { filtres: FiltresGalerie; options: OptionsGalerie }) {
  const c = fr.galerie.champs
  const rangee = fr.fiche.rangee
  return (
    <details className="rounded-sm border border-neutral-200">
      <summary className="flex min-h-touch-target cursor-pointer items-center px-3 font-sans text-button text-foreground">
        {fr.galerie.modifierFiltres}
      </summary>
      <form method="get" action="/galerie" className="grid grid-cols-1 gap-4 border-t border-neutral-200 p-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="filtre-prix" className="font-sans text-caption text-neutral-600">
            {c.prixMax}
          </label>
          <input
            id="filtre-prix"
            name="prix"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            defaultValue={filtres.prixMax ?? ''}
            className={CHAMP}
          />
        </div>
        <Liste
          nom="format"
          libelle={c.format}
          valeur={filtres.format}
          vide={fr.galerie.tous}
          options={FORMATS.map((v) => ({ valeur: v, libelle: rangee.format[v] }))}
        />
        <Liste
          nom="orientation"
          libelle={c.orientation}
          valeur={filtres.orientation}
          vide={fr.galerie.toutes}
          options={ORIENTATIONS.map((v) => ({ valeur: v, libelle: rangee.orientation[v] }))}
        />
        <Liste
          nom="couleur"
          libelle={c.couleur}
          valeur={filtres.couleur}
          vide={fr.galerie.toutes}
          options={COULEURS_DOMINANTES.map((v) => ({ valeur: v.code, libelle: v.libelle }))}
        />
        <Liste
          nom="ambiance"
          libelle={c.ambiance}
          valeur={filtres.ambiance}
          vide={fr.galerie.toutes}
          options={AMBIANCES.map((v) => ({ valeur: v.code, libelle: v.libelle }))}
        />
        <Liste
          nom="technique"
          libelle={c.technique}
          valeur={filtres.technique}
          vide={fr.galerie.toutes}
          options={TECHNIQUES.map((v) => ({ valeur: v.code, libelle: fr.galerie.techniques[v.code] }))}
        />
        <Liste
          nom="artiste"
          libelle={c.artiste}
          valeur={filtres.artiste}
          vide={fr.galerie.tous}
          options={options.artistes.map((a) => ({ valeur: a.slug, libelle: a.nom }))}
        />
        <Liste
          nom="paysartiste"
          libelle={c.paysArtiste}
          valeur={filtres.pays}
          vide={fr.galerie.tous}
          options={options.pays.map((p) => ({ valeur: p, libelle: p }))}
        />
        <Liste
          nom="tri"
          libelle={c.tri}
          valeur={filtres.tri === 'defaut' ? undefined : filtres.tri}
          vide={fr.galerie.tris.defaut}
          options={TRIS.filter((t) => t !== 'defaut').map((t) => ({ valeur: t, libelle: fr.galerie.tris[t] }))}
        />
        <label className="flex min-h-touch-target items-center gap-3 font-sans text-button text-foreground">
          <input type="checkbox" name="dispo" value="1" defaultChecked={filtres.disponibles} className="h-5 w-5" />
          {c.disponibles}
        </label>
        <div className="sm:col-span-2 lg:col-span-3">
          <Button type="submit">{fr.galerie.appliquer}</Button>
        </div>
      </form>
    </details>
  )
}
