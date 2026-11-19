import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { BoutonConseil } from '@/components/ui/BoutonConseil'
import { lireSuiviPassage } from '@/lib/commandes'
import { fr } from '@/lib/i18n'
import { COOKIE_SUIVI } from './cookie'
import { ListeSuivi } from './ListeSuivi'
import { SuiviClos } from './SuiviClos'

// Suivi des commandes d'un acheteur sans compte (FR-15, AD-14, story 7.7) : le jeton `suivi` du cookie (posé par
// l'échange `/suivi/[jeton]` ou par « Suivre mes commandes ») donne le passage, relu en base à chaque requête.
// Étapes connues seulement (commande reçue, paiement constaté, annulée, livraison prévue) : transporteur, numéro
// de suivi et expédition viennent avec l'Epic 8 (décision 1A). Lien inconnu, périmé, révoqué ou commandes toutes
// annulées : la MÊME page « close », sans rien indiquer de plus. Jamais d'adresse, de téléphone ni de coordonnées
// d'artiste. Fonctionne Lot 2 fermé (les ventes assistées n'en dépendent pas). Hors mesure, `noindex`.

export const metadata: Metadata = { title: fr.suivi.titreDocument, robots: { index: false, follow: false }, referrer: 'no-referrer' }
export const dynamic = 'force-dynamic'

export default async function SuiviPage() {
  const suivi = await lireSuiviPassage(cookies().get(COOKIE_SUIVI)?.value)
  if (!suivi || suivi.fermee) return <SuiviClos conseil={<BoutonConseil />} />
  const numeros = suivi.commandes.map((c) => c.numero)
  return <ListeSuivi commandes={suivi.commandes} conseil={<BoutonConseil contexte={{ type: 'commande', numeros }} />} />
}
