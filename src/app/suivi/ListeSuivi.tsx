import { fr } from '@/lib/i18n'
import type { CommandeSuivie } from '@/lib/commandes'
import { Cadre } from './Cadre'
import { ConfirmerReception } from './ConfirmerReception'
import { FriseCommande } from './FriseCommande'
import { SignalerProbleme } from './SignalerProbleme'

// Commandes d'un passage avec leur frise (story 7.7) : numéro, artiste, état, œuvres (titre figé), délai estimé,
// étapes. Aucun montant, aucune adresse ni coordonnée. Le bouton Conseil (avec les numéros de commande) est reçu
// en propriété. « J'ai reçu l'œuvre » (story 8.4) n'est proposé que si le serveur l'a calculé (`peutConfirmerReception`). Composant serveur.

const t = fr.suivi
const LIBELLE = { confirmee: t.etats.confirmee, prise_en_charge: t.etats.priseEnCharge, expediee: t.etats.expediee, livree: t.etats.livree, retournee: t.etats.retournee, en_attente_paiement: t.etats.enAttente, annulee: t.etats.annulee } as const

export function ListeSuivi({ commandes, conseil }: { commandes: CommandeSuivie[]; conseil: React.ReactNode }) {
  const enAttente = commandes.some((c) => c.etat === 'en_attente_paiement')
  return (
    <Cadre titre={t.titre}>
      {enAttente && <p className="mb-8 font-sans text-sm text-foreground">{t.attente}</p>}
      <ul className="flex flex-col gap-6">
        {commandes.map((commande) => {
          const avecDelai = commande.etat !== 'annulee' && commande.etat !== 'livree' && commande.etat !== 'retournee' && commande.delaiMinJours > 0 && commande.delaiMaxJours > 0
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
                  {(commande.peutConfirmerReception || commande.etat === 'livree') && <ConfirmerReception numero={commande.numero} proposer={commande.peutConfirmerReception} />}
                  {commande.etat === 'livree' && (
                    <SignalerProbleme numero={commande.numero} proposer={commande.peutSignalerProbleme} delaiEchu={!commande.peutSignalerProbleme && commande.reclamation === null} />
                  )}
                  {commande.reclamation && (
                    <div data-reclamation={commande.reclamation.etat} className="font-sans text-sm text-foreground">
                      <p>{t.reclamation.etats[commande.reclamation.etat]}</p>
                      {commande.reclamation.etat === 'refusee' && commande.reclamation.motifRefus && (
                        <p data-motif-refus className="mt-1 break-words text-neutral-600">
                          {t.reclamation.motifRefus(commande.reclamation.motifRefus)}
                        </p>
                      )}
                    </div>
                  )}
                  {commande.remboursement && <p data-remboursement={commande.remboursement} className="font-sans text-sm text-foreground">{t.reclamation.remboursement[commande.remboursement]}</p>}
                  {commande.etat === 'expediee' && !commande.peutConfirmerReception && <p className="font-sans text-sm text-neutral-600">{t.reception.parLEquipe}</p>}
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
