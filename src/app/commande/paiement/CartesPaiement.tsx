import { fr, formaterMontant } from '@/lib/i18n'
import { nomPays } from '@/lib/livraison/pays'
import type { RecapitulatifPaiement } from '@/lib/commandes'

// Récapitulatif complet avant paiement (story 7.4, FR-11) : une carte par commande (artiste, œuvres, prix,
// livraison, prix total, délai) puis le total général. Tous les montants viennent du serveur (lignes figées
// et agrégats de la base) : rien n'est additionné ni recalculé ici. Composant serveur.

const t = fr.paiementAcheteur

export function CartesPaiement({ recapitulatif }: { recapitulatif: RecapitulatifPaiement }) {
  const { commandes, devise } = recapitulatif
  const plusieurs = commandes.length > 1
  const avecDelai = (c: RecapitulatifPaiement['commandes'][number]) => c.delaiMinJours > 0 && c.delaiMaxJours > 0
  const tousAvecDelai = commandes.every(avecDelai)
  return (
    <section aria-labelledby="recapitulatif-titre" className="mt-8">
      <h2 id="recapitulatif-titre" className="font-serif text-heading-md text-foreground">
        {fr.coordonnees.passage.titre}
      </h2>
      <p className="mt-1 font-sans text-sm text-neutral-600">{t.livraison(nomPays(recapitulatif.pays))}</p>
      {plusieurs && tousAvecDelai && (
        <p className="mt-4 font-sans text-sm text-foreground">
          {t.colis(
            commandes.length,
            commandes.map((c) => t.delaiJours(c.delaiMinJours, c.delaiMaxJours)),
          )}
        </p>
      )}
      <div className="mt-6 flex flex-col gap-6">
        {commandes.map((commande) => (
          <section key={commande.numero} aria-labelledby={`commande-${commande.numero}`} className="rounded-sm border border-neutral-200">
            <header className="border-b border-neutral-200 px-4 py-4 sm:px-6">
              <h3 id={`commande-${commande.numero}`} className="font-sans text-xs uppercase tracking-widest text-neutral-600">
                {t.commande(commande.numero)}
              </h3>
              {commande.artiste.trim() !== '' && (
                <p className="mt-1 font-serif text-heading-sm text-foreground">{t.artiste(commande.artiste)}</p>
              )}
            </header>
            {commande.lignes.length === 0 && <p className="px-4 py-4 font-sans text-sm text-neutral-600 sm:px-6">{t.sansOeuvre}</p>}
            <ul className="divide-y divide-neutral-200">
              {commande.lignes.map((ligne) => (
                <li key={ligne.slug} className="px-4 py-4 sm:px-6">
                  <p className="font-serif text-base text-foreground">{ligne.titre}</p>
                  <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 font-sans text-sm">
                    <dt className="text-neutral-600">{t.oeuvres}</dt>
                    <dd className="text-end text-foreground">{formaterMontant(ligne.prixCentimes, ligne.devise)}</dd>
                    <dt className="text-neutral-600">{t.livraisonLigne}</dt>
                    <dd className="text-end text-foreground">{formaterMontant(ligne.fraisCentimes, ligne.devise)}</dd>
                  </dl>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-neutral-200 px-4 py-4 font-sans text-sm sm:px-6">
              {avecDelai(commande) && (
                <>
                  <dt className="text-neutral-600">{t.delai}</dt>
                  <dd className="text-end text-foreground">{t.delaiJours(commande.delaiMinJours, commande.delaiMaxJours)}</dd>
                </>
              )}
              <dt className="text-foreground">{t.prixTotal}</dt>
              <dd className="text-end font-serif text-lg text-foreground">{formaterMontant(commande.totalCentimes, commande.devise)}</dd>
            </dl>
          </section>
        ))}
      </div>
      <section aria-labelledby="total-general" className="mt-8 rounded-sm border border-neutral-200 px-4 py-4 sm:px-6">
        <h3 id="total-general" className="font-sans text-xs uppercase tracking-widest text-neutral-600">
          {t.totalGeneral}
        </h3>
        {plusieurs && (
          <p className="mt-2 font-sans text-sm text-neutral-600">
            {t.additionTotaux(commandes.map((c) => formaterMontant(c.totalCentimes, c.devise)))}
          </p>
        )}
        <p className="mt-1 font-serif text-display-md text-foreground">{formaterMontant(recapitulatif.totalCentimes, devise)}</p>
        <p className="mt-1 font-sans text-sm text-neutral-600">{fr.livraison.droitsNonInclus}</p>
      </section>
    </section>
  )
}
