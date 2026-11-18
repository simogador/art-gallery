import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import Link from 'next/link'
import { COOKIE_PAYS, lirePays, nomPays } from '@/lib/livraison'
import { lot2Ouvert } from '@/lib/reglages'
import { fr } from '@/lib/i18n'
import { BoutonConseil } from '@/components/ui/BoutonConseil'
import { CartContent } from './CartContent'

// Panier public (FR-10, story 7.2) : aucune connexion demandée. Le navigateur ne garde que des slugs ;
// `CartContent` les envoie à l'action `recalculerPanier`, qui relit tout en base pour le pays du
// cookie. Rendue à chaque requête (cookie `pays`, bouton Conseil dépendant de l'heure).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: fr.panier.titreDocument, robots: { index: false } }

export default function PanierPage() {
  const t = fr.panier
  const pays = lirePays(cookies().get(COOKIE_PAYS)?.value)

  return (
    <div className="min-h-screen bg-background pb-40 pt-28">
      <div className="container-premium max-w-4xl">
        <div className="mb-10">
          <nav aria-label={t.filAriane} className="mb-8 flex items-center gap-2 font-sans text-xs uppercase tracking-widest text-neutral-600">
            <Link href="/" className="inline-flex min-h-touch-target items-center hover:text-foreground">
              {t.accueil}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-foreground">{t.titreDocument}</span>
          </nav>
          <span className="mb-4 block font-sans text-xs uppercase tracking-[0.25em] text-neutral-600">{t.surtitre}</span>
          <h1 className="font-serif text-display-md font-light text-foreground">{t.titre}</h1>
          <div className="divider mt-4" />
        </div>

        <CartContent
          pays={{ code: pays, nom: nomPays(pays) }}
          achatOuvert={lot2Ouvert()}
          conseil={<BoutonConseil contexte={{ type: 'general' }} />}
        />
      </div>
    </div>
  )
}
