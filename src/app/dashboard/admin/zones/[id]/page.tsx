import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { acteurCourant } from '@/lib/acces'
import { CODES_PAYS, attributionsPays, lireZone, nomPays, trierParNom } from '@/lib/livraison'
import { ZoneForm } from '../ZoneForm'

export const metadata: Metadata = { title: 'Zone de livraison — Admin Errancy' }
export const dynamic = 'force-dynamic'

export default async function ZonePage({ params }: { params: { id: string } }) {
  if ((await acteurCourant()).type !== 'admin') redirect('/dashboard')

  const [zone, attributions] = await Promise.all([lireZone(params.id), attributionsPays()])
  if (!zone) notFound()
  const autresZones = Object.fromEntries(
    Object.entries(attributions)
      .filter(([, a]) => a.zoneId !== zone.id)
      .map(([code, a]) => [code, a.zone]),
  )

  const listePays = trierParNom(CODES_PAYS).map((code) => ({ code, nom: nomPays(code) }))

  return (
    <div>
      <div className="mb-10">
        <Link href="/dashboard/admin/zones" className="font-sans text-xs uppercase tracking-widest text-neutral-400 hover:text-foreground">
          Zones de livraison
        </Link>
        <h1 className="font-serif font-light text-foreground mt-4" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
          {zone.nom}
        </h1>
        <p className="font-sans text-sm text-neutral-400 mt-2">
          {zone.pays.length} pays · {zone.offres} offre{zone.offres > 1 ? 's' : ''} de livraison
        </p>
      </div>
      <ZoneForm zone={zone} listePays={listePays} autresZones={autresZones} />
    </div>
  )
}
