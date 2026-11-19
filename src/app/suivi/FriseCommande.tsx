import { fr, formaterDate } from '@/lib/i18n'
import type { CommandeSuivie, EtapeSuivi } from '@/lib/commandes'

// Frise d'une commande (story 7.7, UX `status-timeline`) : liste ordonnée des étapes connues, chacune avec son
// état dit en toutes lettres (« Faite le … », « À venir », « Prévue du … au … »), jamais par la couleur seule.
// Les dates viennent de la base (étapes faites) ou du calcul serveur (livraison prévue) : rien n'est déduit ici.
// Composant serveur ; aucun montant.

const t = fr.suivi.frise

function Statut({ etape, payee }: { etape: EtapeSuivi; payee: boolean }) {
  if (etape.cle === 'annulee') return <>{payee ? t.annuleePayee : t.annulee}</>
  if (etape.faite) return <>{t.faite(etape.date ? formaterDate(etape.date) : null)}</>
  if (etape.cle === 'livraison' && etape.date) {
    return <>{t.prevue(formaterDate(etape.date), etape.fin ? formaterDate(etape.fin) : null)}</>
  }
  // Délai minimum inconnu : seule la borne utile est donnée.
  if (etape.cle === 'livraison' && etape.fin) return <>{t.auPlusTard(formaterDate(etape.fin))}</>
  return <>{t.aVenir}</>
}

export function FriseCommande({ commande }: { commande: CommandeSuivie }) {
  const idTitre = `frise-${commande.numero}`
  // Étape courante : le paiement attendu seulement ; rien n'est « en cours » pour la livraison prévue.
  const courante = commande.etapes.findIndex((e) => !e.faite && e.cle !== 'livraison')
  const avecEstimation = commande.etapes.some((e) => e.cle === 'livraison' && (e.date || e.fin))
  // Annulée après un paiement constaté : le texte renvoie vers l'équipe au sujet du remboursement.
  const payee = commande.etat === 'annulee' && commande.etapes.some((e) => e.cle === 'paiement')
  return (
    <div>
      <h3 id={idTitre} className="font-sans text-xs uppercase tracking-widest text-neutral-600">
        {t.titre}
      </h3>
      <ol role="list" aria-labelledby={idTitre} className="mt-3 flex flex-col gap-4">
        {commande.etapes.map((etape, i) => (
          <li key={etape.cle} data-etape={etape.cle} data-faite={etape.faite ? 'oui' : 'non'} aria-current={i === courante ? 'step' : undefined} className="flex gap-3">
            <span
              aria-hidden="true"
              className={etape.faite ? 'mt-1 h-3 w-3 shrink-0 rounded-full border border-foreground bg-foreground' : 'mt-1 h-3 w-3 shrink-0 rounded-full border border-foreground bg-background'}
            />
            <div>
              <p className="font-sans text-sm text-foreground">{t.etapes[etape.cle]}</p>
              <p className="font-sans text-sm text-neutral-600">
                <Statut etape={etape} payee={payee} />
              </p>
            </div>
          </li>
        ))}
      </ol>
      {avecEstimation && <p className="mt-3 font-sans text-sm text-neutral-600">{t.estimation}</p>}
    </div>
  )
}
