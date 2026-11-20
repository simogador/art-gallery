import Link from 'next/link'
import { fr } from '@/lib/i18n'
import type { CommandeDeLArtiste } from '@/lib/commandes'
import { HeureFixe } from './HeureFixe'

// Liste des commandes de l'artiste (story 8.1) : numéro, œuvres, prénom et pays de l'acheteur, état écrit en
// toutes lettres (« À prendre en charge avant … », « Échéance dépassée », « Prise en charge le … »), jamais par la
// couleur seule. Aucune adresse ni montant. Composant serveur, partagé par la liste et l'accueil.

const t = fr.commandesArtiste

export function ListeCommandes({ commandes }: { commandes: CommandeDeLArtiste[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {commandes.map((c) => (
        <li key={c.numero}>
          <Link
            href={`/dashboard/artiste/commandes/${encodeURIComponent(c.numero)}`}
            className="block rounded-sm border border-neutral-200 p-4 transition-colors duration-200 hover:border-neutral-500"
          >
            <p className="font-sans text-xs uppercase tracking-widest text-neutral-600">{t.commande(c.numero)}</p>
            <p className="mt-1 font-serif text-base text-foreground">{c.oeuvres.join(', ')}</p>
            <p className="mt-1 font-sans text-sm text-neutral-600">{t.acheteur(c.prenom, c.pays.nom)}</p>
            <p data-etat={c.etat} className="mt-2 font-sans text-sm text-foreground">
              {c.etat === 'livree' ? (
                <>
                  {t.livreeLe} {c.livreeLe && <HeureFixe iso={c.livreeLe.toISOString()} />}
                </>
              ) : c.etat === 'expediee' ? (
                <>
                  {t.expedieeLe} {c.expedieeLe && <HeureFixe iso={c.expedieeLe.toISOString()} />}
                </>
              ) : c.etat === 'prise_en_charge' ? (
                <>
                  {t.priseLe} {c.priseEnChargeLe && <HeureFixe iso={c.priseEnChargeLe.toISOString()} />}
                </>
              ) : c.priseEnChargeAvant ? (
                <>
                  {t.avant} <HeureFixe iso={c.priseEnChargeAvant.toISOString()} />
                </>
              ) : (
                t.sansEcheance
              )}
            </p>
            {c.echeanceDepassee && <p className="mt-1 font-sans text-sm font-medium text-foreground">{t.depassee}</p>}
          </Link>
        </li>
      ))}
    </ul>
  )
}
