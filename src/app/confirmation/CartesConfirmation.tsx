import { fr, formaterMontant } from '@/lib/i18n'
import type { CommandeConfirmation } from '@/lib/commandes'

// Cartes numérotées de la confirmation (story 7.6) : une par commande (numéro, artiste, œuvres, délai, état).
// Tous les montants viennent du serveur (lignes figées et agrégats de la base) : rien n'est additionné ici.
// « Confirmée » n'apparaît que pour une commande `confirmee` relue en base. Composant serveur.

const t = fr.confirmation
const p = fr.paiementAcheteur

const LIBELLE = { confirmee: t.etats.confirmee, en_attente_paiement: t.etats.enAttente, annulee: t.etats.annulee } as const

export function CartesConfirmation({ commandes }: { commandes: CommandeConfirmation[] }) {
  return (
    <ul className="flex flex-col gap-6">
      {commandes.map((commande) => {
        const avecDelai = commande.delaiMinJours > 0 && commande.delaiMaxJours > 0
        return (
          <li key={commande.numero}>
            <section aria-labelledby={`commande-${commande.numero}`} className="rounded-sm border border-neutral-200">
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-200 px-4 py-4 sm:px-6">
                <div>
                  <h2 id={`commande-${commande.numero}`} className="font-sans text-xs uppercase tracking-widest text-neutral-600">
                    {p.commande(commande.numero)}
                  </h2>
                  {commande.artiste.trim() !== '' && (
                    <p className="mt-1 font-serif text-heading-sm text-foreground">{p.artiste(commande.artiste)}</p>
                  )}
                </div>
                <p data-etat={commande.etat} className="font-sans text-sm text-foreground">
                  {LIBELLE[commande.etat]}
                </p>
              </header>
              <ul className="divide-y divide-neutral-200">
                {commande.lignes.map((ligne) => (
                  <li key={ligne.slug} className="px-4 py-4 sm:px-6">
                    <p className="font-serif text-base text-foreground">{ligne.titre}</p>
                  </li>
                ))}
              </ul>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-neutral-200 px-4 py-4 font-sans text-sm sm:px-6">
                {avecDelai && (
                  <>
                    <dt className="text-neutral-600">{p.delai}</dt>
                    <dd className="text-end text-foreground">{p.delaiJours(commande.delaiMinJours, commande.delaiMaxJours)}</dd>
                  </>
                )}
                <dt className="text-foreground">{p.prixTotal}</dt>
                <dd className="text-end font-serif text-lg text-foreground">{formaterMontant(commande.totalCentimes, commande.devise)}</dd>
              </dl>
            </section>
          </li>
        )
      })}
    </ul>
  )
}
