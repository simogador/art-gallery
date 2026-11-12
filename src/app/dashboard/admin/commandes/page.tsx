import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { acteurCourant } from '@/lib/acces'
import { reservationsDeLEquipe } from '@/lib/commandes'
import { fr, formaterDateHeure, SEPARATEUR } from '@/lib/i18n'
import { DUREE_RESERVATION_VENTE_ASSISTEE_HEURES } from '@/lib/reglages'
import { FormulaireVenteAssistee } from './FormulaireVenteAssistee'
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
  const quand = (d: Date | null) => (d ? formaterDateHeure(d) : '—')
  const beneficiaire = (b: { nom: string; email: string } | null) => (b ? `${b.nom} (${b.email})` : t.beneficiaireInconnu)

  return (
    <div>
      <h1 className="font-serif text-3xl text-foreground">{fr.venteAssistee.titre}</h1>
      <p className="mt-2 max-w-prose font-sans text-sm text-neutral-600">{fr.venteAssistee.introduction}</p>
      <FormulaireVenteAssistee heuresParDefaut={DUREE_RESERVATION_VENTE_ASSISTEE_HEURES} />
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
