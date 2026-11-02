import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { acteurCourant } from '@/lib/acces'
import { listerZones } from '@/lib/livraison'
import { PageDepot } from '../depot/PageDepot'

export const metadata: Metadata = { title: 'Déposer une œuvre — Errancy' }
export const dynamic = 'force-dynamic'

// Story 2.5 : formulaire de dépôt vide ; le brouillon est créé au premier champ enregistré, puis
// l'adresse devient /dashboard/artiste/oeuvres/[slug].
export default async function NouvelleOeuvrePage() {
  // Rôle relu à chaque page : le layout n'est pas réexécuté lors d'une navigation interne.
  const acteur = await acteurCourant()
  if (acteur.type === 'visiteur') redirect('/auth/connexion')
  if (acteur.type !== 'artist') redirect('/dashboard')
  if (!acteur.artiste) redirect('/dashboard/artiste')

  const zones = await listerZones()
  return <PageDepot depot={null} zones={zones.map((z) => z.nom)} />
}
