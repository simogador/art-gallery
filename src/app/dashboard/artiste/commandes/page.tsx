import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { acteurCourant } from '@/lib/acces'

// Story 2.4 : onglet de l'espace artiste, vide jusqu'au Lot 2 (achat en ligne).

export const metadata: Metadata = { title: 'Commandes — Espace artiste Errancy' }

export default async function CommandesPage() {
  // Rôle relu à chaque page : le layout n'est pas réexécuté lors d'une navigation interne.
  const acteur = await acteurCourant()
  if (acteur.type === 'visiteur') redirect('/auth/connexion')
  if (acteur.type !== 'artist') redirect('/dashboard')

  return (
    <div>
      <div className="mb-10">
        <p className="font-sans text-xs uppercase tracking-[0.25em] text-gold mb-3">Espace artiste</p>
        <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
          Commandes
        </h1>
      </div>
      <div className="py-16 px-6 border border-dashed border-neutral-300 rounded-sm text-center">
        <p className="font-sans text-sm text-neutral-600 max-w-md mx-auto">
          Les commandes de vos œuvres apparaîtront ici dès l&apos;ouverture des ventes en ligne. Vous pourrez alors les prendre en charge et saisir le suivi d&apos;expédition.
        </p>
      </div>
    </div>
  )
}
