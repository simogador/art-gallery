import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { acteurCourant } from '@/lib/acces'
import { nombreContactsAPrevenir } from '@/lib/demandes'
import { fr } from '@/lib/i18n'
import { AnnonceOuverture } from './AnnonceOuverture'

// Annonce de l'ouverture (story 4.9, FR-35) : rendue à chaque requête, admin seulement. Elle ne lève
// pas la maintenance (variable Vercel `MAINTENANCE_MODE`) ni ne touche `robots.txt`. L'envoi est
// séquentiel et borné en durée (`DUREE_MAX_ANNONCE_SECONDES` de `reglages`, sous cette limite).
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export const metadata: Metadata = { title: fr.ouverture.titrePage, robots: { index: false, follow: false } }

export default async function AdminOuverturePage() {
  const acteur = await acteurCourant()
  if (acteur.type !== 'admin') redirect('/dashboard')
  const resultat = await nombreContactsAPrevenir(acteur)
  if (!resultat.ok) redirect('/dashboard')

  return (
    <div>
      <h1 className="font-serif text-3xl text-foreground">{fr.ouverture.titre}</h1>
      <p className="mt-2 font-sans text-sm text-neutral-600">{fr.ouverture.introduction}</p>
      <p className="mt-1 font-sans text-sm text-neutral-600">{fr.ouverture.nonLevee}</p>
      <p className="mt-6 font-serif text-2xl text-foreground">{fr.ouverture.nombre(resultat.nombre)}</p>
      <AnnonceOuverture nombre={resultat.nombre} />
    </div>
  )
}
