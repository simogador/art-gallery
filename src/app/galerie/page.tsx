import { cookies } from 'next/headers'
import Link from 'next/link'
import type { Metadata } from 'next'
import { lireGalerie } from '@/lib/catalogue'
import {
  adresseGalerie,
  filtresActifs,
  sansFiltre,
  TECHNIQUES,
  type CleFiltre,
  type FiltresGalerie,
  type OptionsGalerie,
  type ParametresAdresse,
} from '@/lib/catalogue/filtres'
import { AMBIANCES, COULEURS_DOMINANTES } from '@/lib/curation/depot-regles'
import { fr, formaterMontant } from '@/lib/i18n'
import { COOKIE_PAYS, lirePays, nomPays } from '@/lib/livraison'
import { PAS_AFFICHAGE } from '@/lib/catalogue/filtres'
import { urlAbsolue } from '@/lib/reglages'
import { PaysLivraison, UniteToggle } from '@/components/ui'
import { BoutonConseil } from '@/components/ui/BoutonConseil'
import { FormulaireFiltres, PucesFiltres, type Puce } from './FiltresGalerie'
import { VignetteOeuvre } from './VignetteOeuvre'

export const metadata: Metadata = {
  title: 'Collection',
  description: fr.galerie.description,
  // Toutes les variantes filtrées ont la même adresse canonique.
  alternates: { canonical: urlAbsolue('/galerie') },
}

// Story 3.3 : prix livré et délai vers le pays du visiteur (cookie `pays`, France par défaut).
// Story 3.9 : filtres, tri et nombre d'œuvres affichées lus dans l'adresse (partageable, retour
// arrière fiable) ; page rendue à chaque requête (cookie et adresse).

function libelleFiltre(cle: CleFiltre, f: FiltresGalerie, options: OptionsGalerie): string {
  const rangee = fr.fiche.rangee
  switch (cle) {
    case 'prix':
      return fr.galerie.puces.prixMax(formaterMontant((f.prixMax ?? 0) * 100, 'EUR'))
    case 'format':
      return f.format ? rangee.format[f.format] : ''
    case 'orientation':
      return f.orientation ? rangee.orientation[f.orientation] : ''
    case 'couleur':
      return COULEURS_DOMINANTES.find((c) => c.code === f.couleur)?.libelle ?? ''
    case 'ambiance':
      return AMBIANCES.find((a) => a.code === f.ambiance)?.libelle ?? ''
    case 'technique':
      return f.technique ? fr.galerie.techniques[TECHNIQUES.find((t) => t.code === f.technique)!.code] : ''
    case 'artiste':
      return fr.galerie.puces.artiste(options.artistes.find((a) => a.slug === f.artiste)?.nom ?? '')
    case 'paysartiste':
      return fr.galerie.puces.paysArtiste(f.pays ?? '')
    case 'dispo':
      return fr.galerie.puces.disponibles
  }
}

export default async function GaleriePage({ searchParams }: { searchParams: ParametresAdresse }) {
  const pays = lirePays(cookies().get(COOKIE_PAYS)?.value)
  const nom = nomPays(pays)
  const { filtres, options, totalCatalogue, total, oeuvres } = await lireGalerie(pays, searchParams)

  const actifs = filtresActifs(filtres)
  const puces: Puce[] = actifs.map((cle) => ({
    cle,
    libelle: libelleFiltre(cle, filtres, options),
    href: adresseGalerie(sansFiltre(filtres, cle)),
  }))
  const dernier = actifs.length > 0 ? puces[puces.length - 1] : null
  const reste = total > oeuvres.length

  return (
    <div className="container-premium pb-16 pt-28 md:pb-24 md:pt-36">
      <h1 className="font-serif text-display-md text-foreground">{fr.galerie.titre}</h1>
      <p aria-live="polite" className="mt-3 font-sans text-base text-neutral-600">
        {fr.galerie.resultats(total, nom)}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        <PaysLivraison code={pays} nom={nom} />
        <UniteToggle />
      </div>

      <div className="mt-6 space-y-4">
        <FormulaireFiltres filtres={filtres} options={options} />
        <PucesFiltres puces={puces} />
      </div>

      {oeuvres.length > 0 ? (
        <ul aria-label={fr.galerie.liste} className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
          {oeuvres.map((o) => (
            <li key={o.id}>
              <VignetteOeuvre artwork={o} paysNom={nom} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-16 text-center">
          {totalCatalogue === 0 && !dernier ? (
            <p className="font-sans text-base text-neutral-600">{fr.galerie.collectionVide}</p>
          ) : (
            <>
              <p className="font-sans text-base text-foreground">{fr.galerie.vide}</p>
              {dernier && (
                <Link
                  href={dernier.href}
                  className="mt-4 inline-flex min-h-touch-target items-center text-foreground underline underline-offset-4"
                >
                  {fr.galerie.retirerDernier}
                </Link>
              )}
            </>
          )}
        </div>
      )}

      {reste && (
        <div className="mt-10 text-center">
          <Link
            href={adresseGalerie(filtres, { n: filtres.n + PAS_AFFICHAGE })}
            scroll={false}
            className="inline-flex min-h-touch-target items-center rounded-sm border border-foreground px-6 font-sans text-button text-foreground hover:bg-neutral-100"
          >
            {fr.galerie.afficherPlus}
          </Link>
        </div>
      )}

      <section aria-label={fr.conseilWhatsApp.section} className="mt-16 border-t border-neutral-200 pt-10 text-center">
        <BoutonConseil className="inline-block" />
      </section>
    </div>
  )
}
