import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { BoutonConseil } from '@/components/ui/BoutonConseil'
import { lireRecapitulatifAssiste, type Recapitulatif } from '@/lib/commandes'
import { fr, formaterDateHeure, formaterMontant } from '@/lib/i18n'
import { nomPays } from '@/lib/livraison/pays'
import { COOKIE_COMMANDE } from './cookie'

// Commande d'une vente assistée (story 6.3, FR-12) : le jeton arrive par le cookie httpOnly posé par
// /commande/[jeton], jamais par l'URL. Relue en base à chaque requête : réservation active et non
// échue, sinon « Ce lien n'est plus actif ». Montants lus sur les lignes figées de la commande (aucun
// total additionné ici), réservation en heure fixe (jamais de compte à rebours). Hors mesure.

export const metadata: Metadata = { title: fr.commande.titrePage, robots: { index: false, follow: false }, referrer: 'no-referrer' }
export const dynamic = 'force-dynamic'

export default async function CommandePage() {
  const jeton = cookies().get(COOKIE_COMMANDE)?.value
  let recapitulatif: Recapitulatif | null = null
  let panne = false
  if (jeton) {
    try {
      recapitulatif = await lireRecapitulatifAssiste(jeton)
    } catch {
      panne = true
    }
  }
  const t = fr.commande

  if (panne) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="font-serif text-3xl text-foreground">{t.titre}</h1>
        <p role="alert" className="mt-3 font-sans text-sm text-foreground">{t.panne}</p>
        <BoutonConseil className="mt-8" />
      </div>
    )
  }

  if (!recapitulatif) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="font-serif text-3xl text-foreground">{t.inactif.titre}</h1>
        <p className="mt-3 font-sans text-sm text-neutral-600">{t.inactif.texte}</p>
        <BoutonConseil className="mt-8" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="font-serif text-3xl text-foreground">{t.titre}</h1>
      <p className="mt-3 font-sans text-sm text-foreground">{t.reserveJusqua(formaterDateHeure(recapitulatif.echeance))}</p>
      <p className="mt-1 font-sans text-sm text-neutral-600">{t.livraison(nomPays(recapitulatif.pays))}</p>

      {recapitulatif.commandes.map((commande) => (
        <section key={commande.numero} aria-labelledby={`commande-${commande.numero}`} className="mt-10">
          <h2 id={`commande-${commande.numero}`} className="font-sans text-xs uppercase tracking-widest text-neutral-600">
            {t.numero(commande.numero)}
          </h2>
          <ul className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200">
            {commande.lignes.map((ligne) => (
              <li key={ligne.slug} className="py-4">
                <p className="font-serif text-xl text-foreground">{ligne.titre}</p>
                <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 font-sans text-sm text-neutral-600">
                  <dt>{t.prix}</dt>
                  <dd className="text-end">{formaterMontant(ligne.prixCentimes, ligne.devise)}</dd>
                  <dt>{t.frais}</dt>
                  <dd className="text-end">{formaterMontant(ligne.fraisCentimes, ligne.devise)}</dd>
                  <dt className="text-foreground">{t.total}</dt>
                  <dd className="text-end text-foreground">{formaterMontant(ligne.totalCentimes, ligne.devise)}</dd>
                </dl>
                <p className="mt-2 font-sans text-xs text-neutral-600">{t.delai(ligne.delaiMinJours, ligne.delaiMaxJours)}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="mt-6 font-sans text-xs text-neutral-600">{t.droitsNonInclus}</p>
      <p className="mt-6 font-sans text-sm text-foreground">{t.paiement}</p>
      <BoutonConseil className="mt-8" />
    </div>
  )
}
