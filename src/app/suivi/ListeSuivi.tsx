import { fr } from '@/lib/i18n'
import type { CommandeSuivie } from '@/lib/commandes'
import { Cadre } from './Cadre'
import { FriseCommande } from './FriseCommande'

// Commandes d'un passage avec leur frise (story 7.7) : numéro, artiste, état, œuvres (titre figé), délai estimé,
// étapes. Aucun montant, aucune adresse ni coordonnée. Le bouton Conseil (avec les numéros de commande) est reçu
// en propriété. Composant serveur.

const t = fr.suivi
const LIBELLE = { confirmee: t.etats.confirmee, prise_en_charge: t.etats.priseEnCharge, expediee: t.etats.expediee, en_attente_paiement: t.etats.enAttente, annulee: t.etats.annulee } as const

export function ListeSuivi({ commandes, conseil }: { commandes: CommandeSuivie[]; conseil: React.ReactNode }) {
  const enAttente = commandes.some((c) => c.etat === 'en_attente_paiement')
  return (
    <Cadre titre={t.titre}>
      {enAttente && <p className="mb-8 font-sans text-sm text-foreground">{t.attente}</p>}
      <ul className="flex flex-col gap-6">
        {commandes.map((commande) => {
          const avecDelai = commande.etat !== 'annulee' && commande.delaiMinJours > 0 && commande.delaiMaxJours > 0
          return (
            <li key={commande.numero}>
              <section aria-labelledby={`commande-${commande.numero}`} className="rounded-sm border border-neutral-200">
                <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-200 px-4 py-4 sm:px-6">
                  <div>
                    <h2 id={`commande-${commande.numero}`} className="font-sans text-xs uppercase tracking-widest text-neutral-600">
                      {t.commande(commande.numero)}
                    </h2>
                    {commande.artiste.trim() !== '' && <p className="mt-1 font-serif text-heading-sm text-foreground">{t.artiste(commande.artiste)}</p>}
                  </div>
                  <p data-etat={commande.etat} className="font-sans text-sm text-foreground">
                    {LIBELLE[commande.etat]}
                  </p>
                </header>
                <ul className="divide-y divide-neutral-200">
                  {commande.oeuvres.map((titre, i) => (
                    <li key={`${i}-${titre}`} className="px-4 py-4 sm:px-6">
                      <p className="font-serif text-base text-foreground">{titre}</p>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col gap-4 border-t border-neutral-200 px-4 py-4 sm:px-6">
                  {avecDelai && <p className="font-sans text-sm text-foreground">{t.delai(commande.delaiMinJours, commande.delaiMaxJours)}</p>}
                  <FriseCommande commande={commande} />
                </div>
              </section>
            </li>
          )
        })}
      </ul>
      <p className="mt-8 font-sans text-sm text-neutral-600">{t.aide}</p>
      <div className="mt-4">{conseil}</div>
    </Cadre>
  )
}
