import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { acteurCourant } from '@/lib/acces'
import { commandesDeLArtiste } from '@/lib/commandes'
import { fr } from '@/lib/i18n'
import { ListeCommandes } from './ListeCommandes'

// Commandes de l'artiste (story 8.1, FR-22, AD-15) : commandes `confirmee` (à prendre en charge, échéance la plus
// proche en tête) puis `prise_en_charge`. Accès décidé par `commandes` à partir de l'acteur relu en base ;
// indépendant de `LOT2_OUVERT` (les ventes assistées en font partie).

export const dynamic = 'force-dynamic'

const t = fr.commandesArtiste

export const metadata: Metadata = { title: t.titreDocument, robots: { index: false, follow: false } }

export default async function CommandesPage() {
  // Rôle relu à chaque page : le layout n'est pas réexécuté lors d'une navigation interne.
  const acteur = await acteurCourant()
  if (acteur.type === 'visiteur') redirect('/auth/connexion')
  if (acteur.type !== 'artist') redirect('/dashboard')

  const lu = await commandesDeLArtiste(acteur)
  const commandes = lu.ok ? lu.commandes : []

  return (
    <div>
      <div className="mb-10">
        <p className="mb-3 font-sans text-xs uppercase tracking-[0.25em] text-neutral-600">{t.surtitre}</p>
        <h1 className="font-serif font-light text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
          {t.titre}
        </h1>
      </div>
      {commandes.length === 0 ? (
        <div className="rounded-sm border border-dashed border-neutral-300 px-6 py-16 text-center">
          <p className="mx-auto max-w-md font-sans text-sm text-neutral-600">{t.vide}</p>
        </div>
      ) : (
        <ListeCommandes commandes={commandes} />
      )}
    </div>
  )
}
