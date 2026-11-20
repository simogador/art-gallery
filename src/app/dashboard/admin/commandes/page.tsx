import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { acteurCourant } from '@/lib/acces'
import { commandesDeLEquipe, commandesEnAttenteDeLEquipe, incidentsDeLEquipe, remboursementsDeLEquipe, reservationsDeLEquipe } from '@/lib/commandes'
import { fr, formaterDateHeure, formaterMontant, SEPARATEUR } from '@/lib/i18n'
import { DUREE_RESERVATION_VENTE_ASSISTEE_HEURES } from '@/lib/reglages'
import { CommandesEquipe } from './CommandesEquipe'
import { FormulaireVenteAssistee } from './FormulaireVenteAssistee'
import { PaiementsEnAttente } from './PaiementsEnAttente'
import { RemboursementsEquipe } from './RemboursementsEquipe'
import { ReservationsEquipe } from './ReservationsEquipe'

// Vente assistée (story 6.3, FR-12) : l'équipe réserve des œuvres pour un acheteur identifié et lui
// envoie le lien de sa commande. Rendue à chaque requête, admin seulement. Indépendante de `LOT2_OUVERT`.
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export const metadata: Metadata = { title: fr.venteAssistee.titrePage, robots: { index: false, follow: false } }

export default async function AdminCommandesPage() {
  const acteur = await acteurCourant()
  if (acteur.type !== 'admin') redirect('/dashboard')

  const t = fr.venteAssistee.suivi
  // Une panne de lecture n'empêche pas de poser une vente : message distinct, formulaire intact.
  const vue = await reservationsDeLEquipe(acteur).catch(() => undefined)
  const p = fr.paiement
  const enAttente = await commandesEnAttenteDeLEquipe(acteur).catch(() => undefined)
  const incidents = await incidentsDeLEquipe(acteur).catch(() => undefined)
  const remboursements = await remboursementsDeLEquipe(acteur).catch(() => undefined)
  const suivi = await commandesDeLEquipe(acteur).catch(() => undefined)
  const ce = fr.commandesEquipe
  const quand = (d: Date | null) => (d ? formaterDateHeure(d) : '—')
  const beneficiaire = (b: { nom: string; email: string } | null) => (b ? `${b.nom} (${b.email})` : t.beneficiaireInconnu)

  return (
    <div>
      <h1 className="font-serif text-3xl text-foreground">{fr.venteAssistee.titre}</h1>
      <p className="mt-2 max-w-prose font-sans text-sm text-neutral-600">{fr.venteAssistee.introduction}</p>
      <FormulaireVenteAssistee heuresParDefaut={DUREE_RESERVATION_VENTE_ASSISTEE_HEURES} />
      <section aria-labelledby="commandes-payees" className="mt-12">
        <h2 id="commandes-payees" className="font-serif text-2xl text-foreground">{ce.titre}</h2>
        <p className="mt-2 max-w-prose font-sans text-sm text-neutral-600">{ce.introduction}</p>
        {suivi ? (
          <CommandesEquipe
            alertes={suivi.alertes}
            tronque={suivi.tronque}
            commandes={suivi.commandes.map((c) => ({
              numero: c.numero,
              etat: c.etat,
              artiste: c.artiste,
              oeuvres: c.oeuvres,
              priseEnChargeAvant: quand(c.priseEnChargeAvant),
              priseEnChargeLe: quand(c.priseEnChargeLe),
              expedieAvant: quand(c.expedieAvant),
              expedieeLe: quand(c.expedieeLe),
              transporteur: c.transporteur,
              numeroSuivi: c.numeroSuivi,
              envoiAssure: c.envoiAssure,
              referenceAssurance: c.referenceAssurance,
              remboursement: c.remboursement
                ? ce.remboursements[c.remboursement.etat](formaterMontant(c.remboursement.montantCentimes, c.remboursement.devise))
                : null,
              annuleeLe: c.annulation ? quand(c.annulation.le) : null,
              motif: c.annulation?.motif ?? null,
              alertes: c.alertes,
              annulable: c.annulable,
              livrable: c.livrable,
              preuveRequise: c.preuveRequise,
              livreeLe: c.livraison ? quand(c.livraison.le) : null,
              livraisonSource: c.livraison?.source ? ce.livraison.sourcesConstat[c.livraison.source] : null,
              preuveLivraison: c.livraison?.preuve ?? null,
              retourAvant: c.livraison ? quand(c.livraison.retourAvant) : null,
              reclamation: c.reclamation
                ? {
                    motif: ce.reclamation.motifs[c.reclamation.motif],
                    description: c.reclamation.description,
                    etat: c.reclamation.etat,
                    motifRefus: c.reclamation.motifRefus,
                    decideLe: c.reclamation.decideLe ? quand(c.reclamation.decideLe) : null,
                    photos: c.reclamation.photos,
                  }
                : null,
              retournable: c.retournable,
              montantCommande: c.allocationCentimes === null ? null : formaterMontant(c.allocationCentimes, c.devise),
              retourRecuLe: c.retourRecuLe ? quand(c.retourRecuLe) : null,
            }))}
          />
        ) : (
          <p role="alert" className="mt-3 font-sans text-sm text-foreground">{ce.panne}</p>
        )}
      </section>
      <section aria-labelledby="paiements-a-constater" className="mt-12">
        <h2 id="paiements-a-constater" className="font-serif text-2xl text-foreground">{p.titre}</h2>
        <p className="mt-2 max-w-prose font-sans text-sm text-neutral-600">{p.introduction}</p>
        {enAttente ? (
          <PaiementsEnAttente
            passages={enAttente.map((c) => ({
              passageId: c.passageId,
              acheteur: beneficiaire(c.acheteur),
              devise: c.devise,
              total: formaterMontant(c.totalCentimes, c.devise),
              totalAvecAnnulees: c.totalAvecAnnuleesCentimes === null ? null : formaterMontant(c.totalAvecAnnuleesCentimes, c.devise),
              commandes: c.commandes,
            }))}
          />
        ) : (
          <p role="alert" className="mt-3 font-sans text-sm text-foreground">{p.incidents.panne}</p>
        )}
      </section>
      <section aria-labelledby="incidents-paiement" className="mt-12">
        <h2 id="incidents-paiement" className="font-serif text-2xl text-foreground">{p.incidents.titre}</h2>
        {incidents === undefined && <p role="alert" className="mt-3 font-sans text-sm text-foreground">{p.incidents.panne}</p>}
        {incidents && incidents.length === 0 && <p className="mt-3 font-sans text-sm text-neutral-600">{p.incidents.vide}</p>}
        {incidents && incidents.length > 0 && (
          <>
            <p className="mt-2 max-w-prose font-sans text-sm text-neutral-600">{p.incidents.suite}</p>
            <ul className="mt-3 space-y-3">
              {incidents.map((i) => (
                <li key={i.id} className="font-sans text-sm text-foreground">
                  {[
                    p.incidents.causes[i.cause === 'devise_differente' ? 'monnaie_differente' : i.cause],
                    i.commandeNumero ? `${p.incidents.commande} ${i.commandeNumero}` : null,
                    beneficiaire(i.acheteur),
                    // Commande annulée : le montant est celui à rembourser (allocation), pas un écart de montant.
                    i.cause === 'oeuvre_indisponible' || i.cause === 'commande_annulee'
                      ? i.attenduCentimes === null ? null : `${p.incidents.aRembourser} ${formaterMontant(i.attenduCentimes, i.devise ?? undefined)}`
                      : i.attenduCentimes === null ? null : `${p.incidents.attendu} ${formaterMontant(i.attenduCentimes, i.devise ?? undefined)}`,
                    i.cause === 'oeuvre_indisponible' || i.cause === 'commande_annulee'
                      ? null
                      : i.recuCentimes === null ? null : `${p.incidents.recu} ${formaterMontant(i.recuCentimes, i.devise ?? undefined)}`,
                    `${p.incidents.le} ${quand(i.creeLe)}`,
                  ]
                    .filter((x): x is string => x !== null)
                    .join(SEPARATEUR)}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section aria-labelledby="remboursements-a-traiter" className="mt-12">
        <h2 id="remboursements-a-traiter" className="font-serif text-2xl text-foreground">{p.remboursements.titre}</h2>
        <p className="mt-2 max-w-prose font-sans text-sm text-neutral-600">{p.remboursements.introduction}</p>
        {remboursements ? (
          <RemboursementsEquipe
            remboursements={remboursements.map((r) => ({
              id: r.id,
              commande: r.commandeNumero,
              acheteur: beneficiaire(r.acheteur),
              montant: formaterMontant(r.montantCentimes, r.devise),
              demandeLe: quand(r.demandeLe),
            }))}
          />
        ) : (
          <p role="alert" className="mt-3 font-sans text-sm text-foreground">{p.remboursements.panne}</p>
        )}
      </section>
      <section aria-labelledby="reservations-en-cours" className="mt-12">
        <h2 id="reservations-en-cours" className="font-serif text-2xl text-foreground">{t.titreEnCours}</h2>
        {vue ? (
          <ReservationsEquipe
            ventes={vue.enCours.map((v) => ({
              passageId: v.passageId,
              beneficiaire: beneficiaire(v.beneficiaire),
              origine: t.origines[v.origine],
              echeance: quand(v.echeance),
              echue: v.echue,
              lienActif: v.lienActif,
              liberable: v.liberable,
              oeuvres: v.oeuvres.map((o) => o.titre),
            }))}
          />
        ) : (
          <p role="alert" className="mt-3 font-sans text-sm text-foreground">{t.panne}</p>
        )}
      </section>
      <section aria-labelledby="reservations-terminees" className="mt-12">
        <h2 id="reservations-terminees" className="font-serif text-2xl text-foreground">{t.titreJournal}</h2>
        {vue && vue.terminees.length === 0 && <p className="mt-3 font-sans text-sm text-neutral-600">{t.videJournal}</p>}
        {vue && vue.terminees.length > 0 && (
          <ul className="mt-3 space-y-3">
            {vue.terminees.map((r, i) => (
              <li key={`${r.passageId}-${r.slug}-${i}`} className="font-sans text-sm text-foreground">
                {[r.titre, beneficiaire(r.beneficiaire), t.origines[r.origine], t.issues[r.issue], `${t.par} ${r.par ?? t.parAutomatique}`, `${t.le} ${quand(r.issueLe)}`].join(SEPARATEUR)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
