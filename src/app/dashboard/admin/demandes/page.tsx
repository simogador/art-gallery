import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { acteurCourant } from '@/lib/acces'
import { fileDesDemandes, libelleEtatDemande, type DemandeLue } from '@/lib/demandes'
import { AMBIANCES } from '@/lib/curation/depot-regles'
import { fr, SEPARATEUR, formaterDate, formaterDateHeure, formaterMontant } from '@/lib/i18n'
import { CommandeEtat } from './CommandeEtat'

// File des demandes de l'équipe (story 4.6, FR-25, FR-8) : demandes de visite et de sélection, de la
// plus ancienne à la plus récente. Rendue à chaque requête, jamais mise en cache : elle porte les
// coordonnées des visiteurs, montrées à l'administrateur seulement.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: fr.demandes.titrePage, robots: { index: false, follow: false } }

interface Props {
  searchParams?: { traitees?: string | string[] }
}

function Champ({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <dt className="font-sans text-[10px] uppercase tracking-widest text-neutral-600">{libelle}</dt>
      <dd className="font-sans text-sm text-foreground">{children}</dd>
    </div>
  )
}

function LigneDemande({ demande }: { demande: DemandeLue }) {
  const d = fr.demandes
  return (
    <li className="rounded-sm border border-neutral-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="font-serif text-lg text-foreground">
          {d.types[demande.type]}
          {demande.type === 'visite' && `${SEPARATEUR}${d.typesVisite[demande.typeVisite]}`}
        </h2>
        <p className="font-sans text-xs text-neutral-600">{d.recue(formaterDate(demande.recueLe))}</p>
      </div>
      <p className="mt-1 font-sans text-xs uppercase tracking-widest text-foreground">{d.etatActuel(libelleEtatDemande(demande.etat))}</p>

      <dl>
        {demande.type === 'visite' ? (
          <>
            <Champ libelle={d.oeuvre}>
              {demande.oeuvre ? (
                <Link href={`/galerie/${demande.oeuvre.slug}`} className="underline underline-offset-4">
                  {demande.oeuvre.titre}
                </Link>
              ) : (
                d.oeuvreSupprimee
              )}
            </Champ>
            <Champ libelle={d.creneaux(demande.fuseau)}>
              <ul>
                {demande.creneaux.map((c) => (
                  <li key={c.toISOString()}>{formaterDateHeure(c, { fuseau: demande.fuseau, jourSemaine: true })}</li>
                ))}
              </ul>
            </Champ>
          </>
        ) : (
          <>
            <Champ libelle={d.espace}>{demande.espace}</Champ>
            {demande.ambiances.length > 0 && <Champ libelle={d.ambiances}>{demande.ambiances.map((a) => AMBIANCES.find((x) => x.code === a)?.libelle ?? a).join(', ')}</Champ>}
            {demande.precision && <Champ libelle={d.precision}>{demande.precision}</Champ>}
            <Champ libelle={d.budget}>{formaterMontant(demande.budgetCentimes)}</Champ>
          </>
        )}
        <Champ libelle={d.email}>{demande.email}</Champ>
        {demande.telephone && <Champ libelle={d.telephone}>{demande.telephone}</Champ>}
      </dl>

      {demande.changement && (
        <p className="mt-3 font-sans text-xs text-neutral-600">
          {d.dernierChangement(demande.changement.par ?? d.auteurInconnu, formaterDateHeure(demande.changement.le))}
        </p>
      )}
      <CommandeEtat
        type={demande.type}
        id={demande.id}
        etat={demande.etat}
        nom={d.nomDemande(d.types[demande.type], formaterDate(demande.recueLe))}
      />
    </li>
  )
}

export default async function AdminDemandesPage({ searchParams }: Props) {
  const acteur = await acteurCourant()
  if (acteur.type !== 'admin') redirect('/dashboard')

  const brut = searchParams?.traitees
  const traitees = brut === '1'
  const resultat = await fileDesDemandes(acteur, { traitees })
  if (!resultat.ok) redirect('/dashboard')

  return (
    <div>
      <h1 className="font-serif text-3xl text-foreground">{fr.demandes.titre}</h1>
      <p className="mt-2 font-sans text-sm text-neutral-600">{fr.demandes.introduction}</p>
      <p className="mt-4">
        <Link
          href={traitees ? '/dashboard/admin/demandes' : '/dashboard/admin/demandes?traitees=1'}
          className="inline-flex min-h-touch-target items-center font-sans text-xs uppercase tracking-widest text-neutral-600 underline underline-offset-4 hover:text-foreground"
        >
          {traitees ? fr.demandes.masquerTraitees : fr.demandes.voirTraitees}
        </Link>
      </p>

      {resultat.demandes.length === 0 ? (
        <p role="status" className="mt-8 font-sans text-base text-foreground">
          {fr.demandes.vide}
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {resultat.demandes.map((demande) => (
            <LigneDemande key={`${demande.type}:${demande.id}`} demande={demande} />
          ))}
        </ul>
      )}
    </div>
  )
}
