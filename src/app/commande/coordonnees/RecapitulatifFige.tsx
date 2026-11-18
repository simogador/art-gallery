import { fr, formaterMontant } from '@/lib/i18n'
import { nomPays } from '@/lib/livraison/pays'
import type { Recapitulatif } from '@/lib/commandes'

// Commandes d'un passage déjà créé (story 7.3) : lignes figées à la création du passage, jamais
// recalculées ; aucun total n'est additionné ici (le récapitulatif final est la story 7.4). Composant serveur.

const t = fr.commande

export function RecapitulatifFige({ recapitulatif }: { recapitulatif: Pick<Recapitulatif, 'pays' | 'commandes'> }) {
  return (
    <section aria-labelledby="recapitulatif-titre" className="mt-8">
      <h2 id="recapitulatif-titre" className="font-serif text-heading-md text-foreground">
        {fr.coordonnees.passage.titre}
      </h2>
      <p className="mt-1 font-sans text-sm text-neutral-600">{fr.coordonnees.livraison(nomPays(recapitulatif.pays))}</p>
      {recapitulatif.commandes.map((commande) => (
        <section key={commande.numero} aria-labelledby={`commande-${commande.numero}`} className="mt-8">
          <h3 id={`commande-${commande.numero}`} className="font-sans text-xs uppercase tracking-widest text-neutral-600">
            {t.numero(commande.numero)}
          </h3>
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
      <p className="mt-6 font-sans text-xs text-neutral-600">{fr.livraison.droitsNonInclus}</p>
    </section>
  )
}
