import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { millimetresEnCentimetres } from '@/lib/catalogue/conversions'
import {
  AMBIANCES,
  apercuDimensions,
  centimesEnSaisie,
  COULEURS_DOMINANTES,
  ENGAGEMENTS,
  LIBELLES_CHAMPS,
  PHOTOS,
  type OffreDepot,
} from '@/lib/curation/depot-regles'
import type { RecapitulatifCuration as Recap } from '@/lib/curation'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { LIBELLES_ETAT } from '@/lib/disponibilite/etats'

// Œuvre en curation (story 2.6) : récapitulatif en lecture seule et délai de réponse de l'équipe.
// Aucun champ modifiable : l'artiste ne modifie plus une œuvre envoyée.

const libelle = (liste: readonly { code: string; libelle: string }[], code: string | null) =>
  liste.find((e) => e.code === code)?.libelle ?? '—'

const euros = (centimes: number | null) => (centimes === null ? '—' : `${centimesEnSaisie(centimes) || '0'} €`)

function offreLue(o: OffreDepot | undefined): string {
  if (!o) return 'Non renseignée'
  if (!o.livree) return 'Je ne livre pas cette zone'
  const transport =
    o.transportMinJours === o.transportMaxJours ? `${o.transportMinJours} j` : `${o.transportMinJours} à ${o.transportMaxJours} j`
  return `${euros(o.fraisCentimes)} · préparation ${o.preparationJours} j · transport ${transport}`
}

export function RecapitulatifCuration({ recap, delaiJours }: { recap: Recap; delaiJours: number }) {
  const dimensions = [recap.hauteurMm, recap.largeurMm, recap.profondeurMm]
    .filter((v): v is number => v !== null)
    .map((v) => millimetresEnCentimetres(v))
    .join(' × ')
  const pouces = apercuDimensions({
    hauteur: millimetresEnCentimetres(recap.hauteurMm),
    largeur: millimetresEnCentimetres(recap.largeurMm),
    profondeur: millimetresEnCentimetres(recap.profondeurMm),
  })
  const envoyee = recap.envoyeeLe
    ? new Date(recap.envoyeeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div>
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/dashboard/artiste/oeuvres"
            className="font-sans text-xs uppercase tracking-widest text-neutral-500 hover:text-foreground transition-colors duration-200"
          >
            Mes œuvres
          </Link>
          <span aria-hidden="true" className="text-neutral-300">›</span>
          <span className="font-sans text-xs uppercase tracking-widest text-neutral-600 truncate max-w-xs">{recap.titre}</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
            {recap.titre}
          </h1>
          <StatusBadge etat="en_curation" libelle={LIBELLES_ETAT.en_curation} />
        </div>
        <p role="status" className="font-sans text-sm text-foreground bg-neutral-50 border border-neutral-200 rounded-sm px-4 py-3 mt-4 max-w-prose">
          {envoyee ? `Envoyée à l’équipe Errancy le ${envoyee}. ` : 'Envoyée à l’équipe Errancy. '}
          L&apos;équipe vous répond sous {delaiJours} jours. En attendant, l&apos;œuvre ne se modifie plus.
        </p>
      </div>

      <div className="flex flex-col gap-10">
        <Bloc titre="1. Photos">
          <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {PHOTOS.filter((p) => recap.photosLues[p.type]).map((p) => {
              const url = recap.photosLues[p.type]!.url
              return (
                <li key={p.type} className="flex flex-col gap-2">
                  <div className="relative aspect-square bg-neutral-100 rounded-sm overflow-hidden">
                    {p.nature === 'image' ? (
                      <Image src={url} alt={p.legende} fill sizes="(min-width: 1024px) 220px, 45vw" className="object-cover" />
                    ) : (
                      <video src={url} className="absolute inset-0 w-full h-full object-cover" muted playsInline preload="metadata" aria-label={p.legende} />
                    )}
                  </div>
                  <p className="font-sans text-sm text-foreground">{p.legende}</p>
                </li>
              )
            })}
          </ul>
        </Bloc>

        <Bloc titre="2. Informations">
          <Liste
            lignes={[
              [LIBELLES_CHAMPS.titre, recap.titre],
              [LIBELLES_CHAMPS.technique, recap.technique],
              [LIBELLES_CHAMPS.annee, recap.annee ?? '—'],
              [LIBELLES_CHAMPS.histoire, recap.histoire],
              [LIBELLES_CHAMPS.ambiance, libelle(AMBIANCES, recap.ambiance)],
            ]}
          />
        </Bloc>

        <Bloc titre="3. Dimensions et prix">
          <Liste
            lignes={[
              ['Dimensions', dimensions ? `${dimensions} cm${pouces ? ` (${pouces})` : ''}` : '—'],
              [LIBELLES_CHAMPS.couleurDominante, libelle(COULEURS_DOMINANTES, recap.couleurDominante)],
              ['Prix de l’œuvre seule', euros(recap.prixCentimes)],
            ]}
          />
        </Bloc>

        <Bloc titre="4. Expédition">
          <Liste
            lignes={[
              ...recap.zones.map((z): [string, ReactNode] => [z.nom, offreLue(recap.offres.find((o) => o.zoneId === z.id))]),
              ['Visites en atelier', recap.visitesAtelier === null ? '—' : recap.visitesAtelier ? 'Oui' : 'Non'],
            ]}
          />
        </Bloc>

        <Bloc titre="5. Engagements">
          <ul className="flex flex-col gap-2">
            {ENGAGEMENTS.map((e) => (
              <li key={e} className="font-sans text-sm text-foreground">
                <span aria-hidden="true">{recap[e] ? '✓ ' : '○ '}</span>
                {LIBELLES_CHAMPS[e]}
                {!recap[e] && ' (non coché)'}
              </li>
            ))}
          </ul>
        </Bloc>
      </div>
    </div>
  )
}

function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="border-t border-neutral-200 pt-8">
      <h2 className="font-serif font-light text-foreground text-2xl mb-5">{titre}</h2>
      {children}
    </section>
  )
}

function Liste({ lignes }: { lignes: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-[minmax(0,14rem)_1fr] gap-x-6 gap-y-3">
      {lignes.map(([terme, valeur]) => (
        <div key={terme} className="contents">
          <dt className="font-sans text-sm text-neutral-600">{terme}</dt>
          <dd className="font-sans text-sm text-foreground whitespace-pre-line">{valeur || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
