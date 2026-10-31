import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { acteurCourant } from '@/lib/acces'
import { CODES_PAYS, listerZones, nomPays, trierParNom } from '@/lib/livraison'

export const metadata: Metadata = { title: 'Zones de livraison — Admin Errancy' }
export const dynamic = 'force-dynamic'

export default async function AdminZonesPage() {
  if ((await acteurCourant()).type !== 'admin') redirect('/dashboard')

  const zones = await listerZones()
  const attribues = new Set(zones.flatMap((z) => z.pays))
  const sansZone = trierParNom(CODES_PAYS.filter((c) => !attribues.has(c)))

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-3">Livraison</p>
          <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
            Zones de livraison
          </h1>
          <p className="font-sans text-sm text-neutral-400 mt-2">
            {zones.length} zone{zones.length > 1 ? 's' : ''} · les artistes fixent leurs frais et délais pour chacune.
          </p>
        </div>
        <Link
          href="/dashboard/admin/zones/nouvelle"
          className="inline-flex items-center min-h-[44px] px-5 bg-foreground text-background font-sans text-xs uppercase tracking-widest rounded-sm"
        >
          Nouvelle zone
        </Link>
      </div>

      {zones.length === 0 ? (
        <p className="font-sans text-sm text-neutral-500 border border-dashed border-neutral-300 rounded-sm p-6">
          Aucune zone pour l&apos;instant : les artistes ne peuvent pas encore indiquer leurs frais d&apos;envoi.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {zones.map((zone) => (
            <li key={zone.id} className="p-4 border border-neutral-200 rounded-sm flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-serif text-base font-light text-foreground">{zone.nom}</p>
                <p className="font-sans text-xs text-neutral-400 mt-1">
                  {zone.pays.length} pays · {zone.offres} offre{zone.offres > 1 ? 's' : ''}
                </p>
                <p className="font-sans text-xs text-neutral-500 mt-2 line-clamp-2">
                  {zone.pays.map(nomPays).join(', ') || 'Aucun pays'}
                </p>
              </div>
              <Link
                href={`/dashboard/admin/zones/${zone.id}`}
                className="inline-flex items-center min-h-[44px] px-4 border border-neutral-300 rounded-sm font-sans text-xs uppercase tracking-widest text-neutral-700 hover:border-foreground"
              >
                Modifier<span className="sr-only"> la zone {zone.nom}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-10">
        <summary className="font-sans text-sm text-neutral-600 cursor-pointer min-h-[44px] flex items-center">
          {sansZone.length} pays sans zone (livraison impossible)
        </summary>
        <p className="font-sans text-xs text-neutral-500 mt-2">{sansZone.map(nomPays).join(', ') || 'Aucun'}</p>
      </details>
    </div>
  )
}
