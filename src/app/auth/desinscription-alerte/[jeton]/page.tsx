import type { Metadata } from 'next'
import Link from 'next/link'
import { desinscrirePrevenir } from '@/lib/demandes'
import { fr } from '@/lib/i18n'
import { CONTACT_EQUIPE } from '@/lib/reglages'

// Désinscription d'une alerte « Me prévenir » (FR-9, AD-14, story 4.5) : page publique, sans connexion.
// Le jeton du lien est consommé une seule fois et l'inscription retirée. Lien utilisé, périmé ou mal
// formé : message neutre, sans erreur technique (une valeur mal formée n'ouvre aucune transaction).
// Jamais d'index, jamais de référent (`next.config.mjs` et `referrer`), jamais le jeton dans un journal.

export const metadata: Metadata = { title: fr.desinscriptionAlerte.titrePage, robots: { index: false, follow: false }, referrer: 'no-referrer' }
export const dynamic = 'force-dynamic'

export default async function DesinscriptionAlertePage({ params }: { params: { jeton: string } }) {
  let confirmee = false
  let panne = false
  try {
    confirmee = await desinscrirePrevenir(params.jeton)
  } catch (erreur) {
    // Cause seulement (nom et code), jamais le jeton ni une adresse.
    console.error('[desinscription-alerte] traitement impossible', (erreur as { code?: string }).code ?? (erreur as Error).name)
    // Base indisponible : message distinct (le lien n'est pas consommé, l'internaute peut réessayer).
    panne = true
  }
  const d = fr.desinscriptionAlerte

  return (
    <div className="min-h-full flex justify-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-xl">
        <h1 className="font-serif font-light text-foreground text-3xl mb-4">{d.titre}</h1>
        <p role="status" className="font-sans text-base text-foreground">
          {panne ? d.indisponible : confirmee ? d.confirmee : d.invalide(CONTACT_EQUIPE)}
        </p>
        <p className="mt-8">
          <Link href="/" className="inline-flex min-h-touch-target items-center font-sans text-xs uppercase tracking-widest text-neutral-600 underline underline-offset-4 hover:text-foreground">
            {d.accueil}
          </Link>
        </p>
      </div>
    </div>
  )
}
