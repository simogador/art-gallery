import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { acteurCourant } from '@/lib/acces'
import { CODES_PAYS, attributionsPays, nomPays, trierParNom } from '@/lib/livraison'
import { ZoneForm } from '../ZoneForm'

export const metadata: Metadata = { title: 'Nouvelle zone — Admin Errancy' }
export const dynamic = 'force-dynamic'

export default async function NouvelleZonePage() {
  if ((await acteurCourant()).type !== 'admin') redirect('/dashboard')

  const attributions = await attributionsPays()
  const autresZones = Object.fromEntries(Object.entries(attributions).map(([code, a]) => [code, a.zone]))

  const listePays = trierParNom(CODES_PAYS).map((code) => ({ code, nom: nomPays(code) }))

  return (
    <div>
      <div className="mb-10">
        <Link href="/dashboard/admin/zones" className="font-sans text-xs uppercase tracking-widest text-neutral-400 hover:text-foreground">
          Zones de livraison
        </Link>
        <h1 className="font-serif font-light text-foreground mt-4" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
          Nouvelle zone
        </h1>
      </div>
      <ZoneForm listePays={listePays} autresZones={autresZones} />
    </div>
  )
}
