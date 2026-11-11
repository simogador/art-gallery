import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { acteurCourant } from '@/lib/acces'
import { fr } from '@/lib/i18n'
import { DUREE_RESERVATION_VENTE_ASSISTEE_HEURES } from '@/lib/reglages'
import { FormulaireVenteAssistee } from './FormulaireVenteAssistee'

// Vente assistée (story 6.3, FR-12) : l'équipe réserve des œuvres pour un acheteur identifié et lui
// envoie le lien de sa commande. Rendue à chaque requête, admin seulement. Indépendante de `LOT2_OUVERT`.
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export const metadata: Metadata = { title: fr.venteAssistee.titrePage, robots: { index: false, follow: false } }

export default async function AdminCommandesPage() {
  const acteur = await acteurCourant()
  if (acteur.type !== 'admin') redirect('/dashboard')

  return (
    <div>
      <h1 className="font-serif text-3xl text-foreground">{fr.venteAssistee.titre}</h1>
      <p className="mt-2 max-w-prose font-sans text-sm text-neutral-600">{fr.venteAssistee.introduction}</p>
      <FormulaireVenteAssistee heuresParDefaut={DUREE_RESERVATION_VENTE_ASSISTEE_HEURES} />
    </div>
  )
}
